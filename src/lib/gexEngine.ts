import axios from 'axios';
import {
  bsGamma, bsDelta, bsVega, bsCharm, bsVanna, bsVomma, bsZomma,
  impliedVol, RISK_FREE_RATE, DIV_YIELD,
} from './blackScholes.ts';

export interface GexRow {
  strike: number; expiry: string; dte: number; flag: 'C' | 'P';
  oi: number; volume: number; bid: number; ask: number; mid: number;
  iv: number; delta: number; gamma: number; vega: number;
  charm: number; vanna: number; vomma: number; zomma: number;
  call_gex: number; put_gex: number;
  call_vol_gex: number; put_vol_gex: number;
}

export interface AggRow {
  strike: number;
  call_gex: number; put_gex: number; gex_net: number;
  call_vol_gex: number; put_vol_gex: number; vol_gex_net: number;
  call_oi: number; put_oi: number; oi: number;
  iv: number; dist_pct: number;
  dex_net: number; vex_net: number; cex_net: number; vanna_net: number;
}

export interface KeyLevels {
  gamma_flip: number; call_wall: number; put_wall: number;
  call_wall_gex: number; put_wall_gex: number;
  max_pain: number; vol_trigger: number;
  mom_wall: number | null; mom_val: number;
}

export interface GexResult {
  ticker: string; spot: number;
  levels: KeyLevels;
  agg: AggRow[];
  exps: string[];
  regime: { is_long_gamma: boolean; label: string; bias: string; bias_color: string };
  totals: {
    net_gex: number; net_vol_gex: number; gex_ratio: number;
    dex: number; vex: number; cex: number; vanna: number; atm_iv: number;
    call_gex: number; put_gex: number;
  };
  flow: { ratio: number; net: number };
  iv_rv_spread: number;
  timestamp: string;
  uoa: { strike: number; expiration: string; flag: 'C' | 'P'; volume: number; oi: number; bid: number; ask: number; mid: number; intrinsic: number; extrinsic: number; dte: number; iv: number; }[];
  raw: { strike: number; expiration: string; callGEX: number; putGEX: number; volume?: number; oi?: number; flag?: 'C' | 'P'; ask?: number; bid?: number; dte?: number; mid?: number; iv?: number }[];
  summary: {
    price_change: number; price_change_percent: number;
    high: number; low: number; volume: number;
    iv30: number; bid: number; ask: number;
  };
}

// Ensure you set FLOQ_API_KEY in your AI Studio secrets tab
const FLOQ_API_KEY = process.env.FLOQ_API_KEY || '';
let _floqUrl = (process.env.FLOQ_API_URL || 'https://api.floq.data').replace(/^['"]|['"]$/g, '').trim();
if (!_floqUrl.startsWith('http')) _floqUrl = 'https://api.floq.data';
const FLOQ_URL = _floqUrl;

const CBOE_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Referer': 'https://www.cboe.com/',
  'Origin': 'https://www.cboe.com',
};

const SYSTEM_HEADERS_B = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
  'Referer': 'https://finance.yahoo.com/',
  'Origin': 'https://finance.yahoo.com'
};

export async function getSpot(ticker: string): Promise<number> {
  const symUpper = ticker.toUpperCase();
  const promises: Promise<number>[] = [];
  
  console.log(`[Engine] Resolving spot for ${symUpper}`);

  if (FLOQ_API_KEY) {
    // Try both /spot/ and /price/ for FloQ as coverage varies
    const floqSources = [`${FLOQ_URL}/spot/${symUpper}`, `${FLOQ_URL}/price/${symUpper}`];
    floqSources.forEach(urlShort => {
      promises.push(
        axios.get(urlShort, { 
          headers: { 'Authorization': `Bearer ${FLOQ_API_KEY}` },
          timeout: 6000 
        }).then(r => {
          const p = parseFloat(r.data?.data?.current_price || r.data?.price || r.data?.data?.price || 0);
          if (p > 0) {
            console.log(`[Engine] Spot for ${symUpper} found via Floq (${urlShort.includes('spot') ? 'spot' : 'price'}): ${p}`);
            return p;
          }
          throw new Error('Invalid');
        }).catch(e => {
          if (e.response?.status !== 404) {
            console.warn(`[Engine] Floq source fail for ${urlShort}: ${e.message}`);
          }
          throw e; // Promise.any will handle it
        })
      );
    });
  }

  const symbolMapping: Record<string, string> = { 
    'SPX': '^GSPC', 'NDX': '^IXIC', 'RUT': '^RUT', 
    'DIA': '^DJI', 'VIX': '^VIX', 'TYX': '^TYX', 'TNX': '^TNX',
    'IWM': 'IWM', 'QQQ': 'QQQ', 'SPY': 'SPY'
  };
  const yahooSym = symbolMapping[symUpper] || symUpper;
  
  // Try Query2 first, fallback to Query1
  ['query2', 'query1'].forEach(sub => {
    promises.push(
      axios.get(`https://${sub}.finance.yahoo.com/v8/finance/chart/${yahooSym}?interval=1m&range=1d`, { 
        headers: SYSTEM_HEADERS_B,
        timeout: 6000
      }).then(r => {
        const meta = r.data.chart.result[0].meta;
        const p = meta.regularMarketPrice || meta.previousClose;
        if (p > 0) {
          console.log(`[Engine] Spot for ${symUpper} found via Yahoo (${sub}): ${p}`);
          return p;
        }
        throw new Error('Invalid');
      }).catch(e => {
        console.warn(`[Engine] Yahoo (${sub}) spot fail for ${symUpper}: ${e.message}`);
        throw e;
      })
    );
  });
  
  const variants = [symUpper];
  if (['SPX', 'NDX', 'RUT', 'VIX', 'DIA', 'QQQ', 'SPY'].includes(symUpper)) variants.push(`_${symUpper}`);

  variants.forEach(v => {
    promises.push(
      axios.get(`https://cdn.cboe.com/api/global/delayed_quotes/options/${v}.json`, { 
        headers: CBOE_HEADERS,
        timeout: 6000
      }).then(r => {
        const p = parseFloat(r.data.data?.current_price || r.data.data?.last_trade_price || 0);
        if (p > 0) {
          console.log(`[Engine] Spot for ${symUpper} found via CBOE (${v}): ${p}`);
          return p;
        }
        throw new Error('Invalid');
      }).catch(e => {
        if (e.response?.status !== 404) {
          console.warn(`[Engine] CBOE spot fail for ${v}: ${e.message}`);
        }
        throw e;
      })
    );
  });

  try {
    return await Promise.any(promises);
  } catch (e) {
    console.error(`[Engine] Total spot resolve failure for ${symUpper} - All sources exhausted.`);
    return 0;
  }
}

async function getChain(ticker: string): Promise<any> {
  const sym = ticker.toUpperCase();
  const variants = [sym];
  if (['SPX', 'NDX', 'RUT', 'VIX', 'DIA', 'QQQ', 'SPY'].includes(sym)) {
    variants.unshift(`_${sym}`); 
  }

  const promises: Promise<any>[] = [];

  variants.forEach(v => {
    promises.push(
      axios.get(`https://cdn.cboe.com/api/global/delayed_quotes/options/${v}.json`, { 
        headers: CBOE_HEADERS, 
        timeout: 12000 
      }).then(r => {
        if (r.data?.data?.options?.length) {
          console.log(`[Engine] Chain for ${sym} found via CBOE (${v})`);
          return r.data;
        }
        throw new Error('No options');
      })
    );
  });

  if (FLOQ_API_KEY) {
    // Try both /chain/ and /options/ endpoints if one is 404
    const floqChainUrls = [`${FLOQ_URL}/chain/${sym}`, `${FLOQ_URL}/options/${sym}`];
    floqChainUrls.forEach(url => {
       promises.push(
        axios.get(url, { 
          headers: { 
            'Authorization': `Bearer ${FLOQ_API_KEY}`,
            'Accept': 'application/json' 
          },
          timeout: 10000
        }).then(r => {
          if (r.data?.data?.options?.length || r.data?.options?.length) {
            console.log(`[Engine] Chain for ${sym} found via Floq (${url.includes('chain') ? 'chain' : 'options'})`);
            return r.data;
          }
          throw new Error('No options');
        }).catch(e => {
           if (e.response?.status !== 404) {
             console.warn(`[Engine] Floq chain source fail for ${url}: ${e.message}`);
           }
           throw e;
        })
      );
    });
  }

  try {
    return await Promise.any(promises);
  } catch (e) {
    console.error(`[Engine] Total chain resolve failure for ${sym}. Sources checked: ${variants.length + (FLOQ_API_KEY ? 2 : 0)}`);
    throw new Error(`Data Relay Offline: No options chain could be located for ${sym} from any provider.`);
  }
}

function parseSymbol(sym: string): { expiry: string; flag: 'C' | 'P'; strike: number } | null {
  if (!sym) return null;
  const clean = sym.trim();
  const m = clean.match(/(\d{6})([CP])(\d{8})$/);
  if (!m) return null;
  const expiry = `20${m[1].slice(0, 2)}-${m[1].slice(2, 4)}-${m[1].slice(4, 6)}`;
  return { expiry, flag: m[2] as 'C' | 'P', strike: parseInt(m[3]) / 1000 };
}

function parseCboeChain(data: any, spot: number, maxExp = 4) {
  const options = data.data.options || [];
  
  // Get current date in NY timezone
  const now = new Date();
  const nyDateStr = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  
  const [mm, dd, yyyy] = nyDateStr.split('/');
  const todayNY = new Date(`${yyyy}-${mm}-${dd}T00:00:00`);

  const byExp: Record<string, any[]> = {};
  for (const opt of options) {
    const parsed = parseSymbol(opt.option || '');
    if (!parsed) continue;
    if (!byExp[parsed.expiry]) byExp[parsed.expiry] = [];
    byExp[parsed.expiry].push({ ...opt, _expiry: parsed.expiry, _flag: parsed.flag, _strike: parsed.strike });
  }

  const dte = (expiryStr: string) => {
    const expDate = new Date(expiryStr + 'T00:00:00');
    const diffTime = expDate.getTime() - todayNY.getTime();
    return Math.round(diffTime / 86400000);
  };

  let sortedExps = Object.keys(byExp)
    .filter(e => dte(e) >= 0)
    .sort((a, b) => dte(a) - dte(b));

  if (maxExp === 0) {
    // 0 means strictly 0-DTE only
    sortedExps = sortedExps.filter(e => dte(e) === 0);
  } else if (maxExp < 99) {
    sortedExps = sortedExps.slice(0, Math.max(1, maxExp));
  } // if 99 or more, return all unfiltered

  const chains: Record<string, any[]> = {};
  for (const exp of sortedExps) {
    chains[exp] = byExp[exp].map(opt => ({
      strike: opt._strike, flag: opt._flag,
      oi: parseFloat(opt.open_interest || '0') || 0,
      volume: parseFloat(opt.volume || '0') || 0,
      bid: parseFloat(opt.bid || '0') || 0,
      ask: parseFloat(opt.ask || '0') || 0,
      iv_raw: parseFloat(opt.iv || '0') || 0,
      gamma_raw: opt.gamma !== undefined ? parseFloat(opt.gamma) : null,
      delta_raw: opt.delta !== undefined ? parseFloat(opt.delta) : null,
      vega_raw: opt.vega !== undefined ? parseFloat(opt.vega) : null,
    }));
  }
  return { chains, exps: sortedExps, dte };
}

function processChain(opts: any[], spot: number, T: number, r: number, q: number, expiry: string, days: number): GexRow[] {
  const atmIVs = opts
    .filter(o => o.strike >= spot * 0.98 && o.strike <= spot * 1.02 && o.iv_raw > 0.05)
    .map(o => o.iv_raw);
  const atmIVBase = atmIVs.length ? atmIVs.sort((a, b) => a - b)[Math.floor(atmIVs.length / 2)] : 0.20;

  const rows: GexRow[] = [];
  for (const o of opts) {
    if (o.strike <= 0) continue;
    
    // RELAXED FILTERS:
    // Allow strikes within 30% of spot (up from 8%)
    // Allow strikes with any open interest (down from 100)
    const distPct = Math.abs(o.strike - spot) / spot;
    if (distPct > 0.30) continue;
    if (o.oi < 1) continue; 

    const mid = (o.bid > 0 && o.ask > 0) ? (o.bid + o.ask) / 2 : 0;

    let iv: number | null = null;
    if (mid > 0.05) iv = impliedVol(mid, spot, o.strike, T, r, q, o.flag);
    if (iv === null || iv <= 0.005) {
      if (o.iv_raw > 0.05) iv = o.iv_raw;
      else if (mid > 0.05) iv = atmIVBase * (1 + distPct * 0.5);
      else {
        // If still no IV, but we have OI, use a fallback IV
        iv = atmIVBase; 
      }
    }
    iv = Math.min(iv, 1.5);

    // Calculate Greeks via Black-Scholes for precision (CBOE rounds to 3 decimal places which ruins GEX at the tails)
    const gamma = bsGamma(spot, o.strike, T, r, q, iv);
    const delta = bsDelta(spot, o.strike, T, r, q, iv, o.flag);
    const vega = bsVega(spot, o.strike, T, r, q, iv);
    const charm = bsCharm(spot, o.strike, T, r, q, iv, o.flag);
    const vanna = bsVanna(spot, o.strike, T, r, q, iv);
    const vomma = bsVomma(spot, o.strike, T, r, q, iv);
    const zomma = bsZomma(spot, o.strike, T, r, q, iv);

    const gexOI = gamma * o.oi * 100 * Math.pow(spot, 2) * 0.01 / 1e9;
    const gexVol = gamma * o.volume * 100 * Math.pow(spot, 2) * 0.01 / 1e9;

    rows.push({
      strike: o.strike, expiry, dte: days, flag: o.flag,
      oi: o.oi, volume: o.volume, bid: o.bid, ask: o.ask, mid,
      iv, delta, gamma, vega, charm, vanna, vomma, zomma,
      call_gex: o.flag === 'C' ? gexOI : 0,
      put_gex: o.flag === 'P' ? -gexOI : 0,
      call_vol_gex: o.flag === 'C' ? gexVol : 0,
      put_vol_gex: o.flag === 'P' ? -gexVol : 0,
    });
  }
  return rows;
}

function aggregate(rows: GexRow[], spot: number): AggRow[] {
  const byStrike: Record<number, GexRow[]> = {};
  for (const r of rows) {
    if (!byStrike[r.strike]) byStrike[r.strike] = [];
    byStrike[r.strike].push(r);
  }

  return Object.entries(byStrike)
    .map(([k, rs]) => {
      const strike = parseFloat(k);
      const call_gex = rs.reduce((s, r) => s + r.call_gex, 0);
      const put_gex = rs.reduce((s, r) => s + r.put_gex, 0);
      const call_vol_gex = rs.reduce((s, r) => s + r.call_vol_gex, 0);
      const put_vol_gex = rs.reduce((s, r) => s + r.put_vol_gex, 0);
      const call_oi = rs.filter(r => r.flag === 'C').reduce((s, r) => s + r.oi, 0);
      const put_oi = rs.filter(r => r.flag === 'P').reduce((s, r) => s + r.oi, 0);
      const dex = rs.reduce((s, r) => s + r.delta * r.oi * 100, 0);
      const vex = rs.reduce((s, r) => s + r.vega * r.oi * 100 / 1e6, 0);
      const cex = rs.reduce((s, r) => s + r.charm * r.oi * 100 / 1e6, 0);
      const vanna = rs.reduce((s, r) => s + r.vanna * r.oi * 100 / 1e6, 0);
      const ivAvg = rs.reduce((s, r) => s + r.iv, 0) / rs.length;

      return {
        strike, call_gex, put_gex,
        gex_net: call_gex + put_gex,
        call_vol_gex, put_vol_gex,
        vol_gex_net: call_vol_gex + put_vol_gex,
        call_oi, put_oi, oi: call_oi + put_oi,
        iv: ivAvg, dist_pct: ((strike - spot) / spot) * 100,
        dex_net: dex, vex_net: vex, cex_net: cex, vanna_net: vanna,
      };
    })
    .sort((a, b) => a.strike - b.strike);
}

function computeKeyLevels(agg: AggRow[], spot: number, raw: GexRow[]): KeyLevels {
  let gammaFlip = spot * 0.99;
  const cum: number[] = [];
  let c = 0;
  for (const a of agg) { c += a.gex_net; cum.push(c); }
  for (let i = 0; i < cum.length - 1; i++) {
    if (cum[i] * cum[i + 1] < 0) { gammaFlip = agg[i].strike; break; }
  }

  const pos = agg.filter(a => a.gex_net > 0);
  const neg = agg.filter(a => a.gex_net < 0);
  const callWallObj = pos.length ? pos.reduce((m, a) => a.gex_net > m.gex_net ? a : m) : null;
  const putWallObj = neg.length ? neg.reduce((m, a) => a.gex_net < m.gex_net ? a : m) : null;
  
  const callWall = callWallObj ? callWallObj.strike : spot * 1.01;
  const putWall = putWallObj ? putWallObj.strike : spot * 0.99;
  const callWallGex = callWallObj ? callWallObj.gex_net : 0;
  const putWallGex = putWallObj ? Math.abs(putWallObj.gex_net) : 0;

  const callOIByStrike: Record<number, number> = {};
  const putOIByStrike: Record<number, number> = {};
  for (const r of raw) {
    if (r.flag === 'C') callOIByStrike[r.strike] = (callOIByStrike[r.strike] || 0) + r.oi;
    else putOIByStrike[r.strike] = (putOIByStrike[r.strike] || 0) + r.oi;
  }
  const strikes = agg.map(a => a.strike).filter(s => s >= spot * 0.75 && s <= spot * 1.25);
  let minPain = Infinity, maxPain = spot;
  for (const k of strikes) {
    let pain = 0;
    for (const s of strikes) {
      if (s < k) pain += (k - s) * (callOIByStrike[s] || 0) * 100;
      if (s > k) pain += (s - k) * (putOIByStrike[s] || 0) * 100;
    }
    if (pain < minPain) { minPain = pain; maxPain = k; }
  }

  let volTrigger = spot, momWall: number | null = null, momVal = 0;
  const withAbsVol = agg.map(a => ({ ...a, absVolGex: Math.abs(a.call_vol_gex) + Math.abs(a.put_vol_gex) }));
  if (withAbsVol.length > 0) {
    const topVol = withAbsVol.reduce((m, a) => a.absVolGex > m.absVolGex ? a : m, withAbsVol[0]);
    if (topVol) volTrigger = topVol.strike;
  }
  
  if (agg.length > 0) {
    const topMom = agg.reduce((m, a) => Math.abs(a.vol_gex_net) > Math.abs(m.vol_gex_net) ? a : m, agg[0]);
    if (topMom && Math.abs(topMom.vol_gex_net) > 0) {
      momWall = topMom.strike; momVal = topMom.vol_gex_net;
    }
  }

  return { 
    gamma_flip: gammaFlip, 
    call_wall: callWall, 
    put_wall: putWall, 
    call_wall_gex: callWallGex,
    put_wall_gex: putWallGex,
    max_pain: maxPain, 
    vol_trigger: volTrigger, 
    mom_wall: momWall, 
    mom_val: momVal 
  };
}

function computeFlow(raw: GexRow[]): { ratio: number; net: number } {
  if (!raw.length) return { ratio: 0.5, net: 0 };
  let bullish = 0, bearish = 0;
  for (const r of raw) {
    const mid = Math.max(r.mid, 0.01);
    const spread = Math.max(r.ask - r.bid, 0);
    const aggr = spread > 0.001 ? Math.min(Math.max((r.mid - r.bid) / spread, 0), 1) : 0.5;
    const dv = mid * 100 * r.volume;
    if (r.flag === 'C') { bullish += dv * aggr; bearish += dv * (1 - aggr); }
    else { bearish += dv * aggr; bullish += dv * (1 - aggr); }
  }
  const total = bullish + bearish;
  return { ratio: total > 0 ? Math.round((bullish / total) * 1000) / 1000 : 0.5, net: bullish - bearish };
}

async function computeIVRVSpread(raw: GexRow[], spot: number, ticker: string): Promise<number> {
  try {
    if (!raw.length) return 0;
    const nearestExp = raw.reduce((m, r) => r.expiry < m ? r.expiry : m, raw[0].expiry);
    const near = raw.filter(r => r.expiry === nearestExp);
    const atm = near.filter(r => r.strike >= spot * 0.99 && r.strike <= spot * 1.01);
    const ivAtm = (atm.length ? atm : near).reduce((s, r) => s + r.iv, 0) / (atm.length || near.length) * 100;

    let closes: number[] = [];
    
    // Replace Yahoo data for FloQ API KEY
    if (FLOQ_API_KEY) {
      try {
        const r = await axios.get(`${FLOQ_URL}/chart/${ticker}?interval=1d&range=30d`, { 
          headers: { 'Authorization': `Bearer ${FLOQ_API_KEY}` },
          timeout: 2000
        });
        if (r.data) {
           closes = (r.data.chart?.result?.[0]?.indicators?.quote?.[0]?.close || []).filter((c: any) => c != null);
        }
      } catch(e) {}
    }
    
    // Fallback to Yahoo API 
    if (closes.length === 0) {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=30d`;
      try {
        const res = await axios.get(url, { 
          headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
          timeout: 2000
        });
        closes = (res.data.chart?.result?.[0]?.indicators?.quote?.[0]?.close || []).filter((c: any) => c != null);
      } catch (e) {}
    }
    
    if (closes.length < 5) return 0;

    const logRets = closes.slice(1).map((c, i) => Math.log(c / closes[i]));
    const last20 = logRets.slice(-20);
    const mean = last20.reduce((s, r) => s + r, 0) / last20.length;
    const variance = last20.reduce((s, r) => s + Math.pow((r - mean), 2), 0) / last20.length;
    const hv20 = Math.sqrt(variance * 252) * 100;

    return Math.round((ivAtm - hv20) * 100) / 100;
  } catch { return 0; }
}

export async function fetchGexData(ticker: string, maxExpirations = 4): Promise<GexResult> {
  const [chainData, fresherSpot] = await Promise.all([
    getChain(ticker),
    getSpot(ticker).catch(() => 0)
  ]);
  
  let spot = fresherSpot;
  if (!spot || spot <= 0) {
    spot = parseFloat(chainData.data?.current_price || 0);
  }

  if (!spot || isNaN(spot)) throw new Error(`Pricing Failure: Unable to resolve spot price for ${ticker}`);

  const r = RISK_FREE_RATE;
  const q = DIV_YIELD[ticker] ?? 0.01;
  const { chains, exps, dte } = parseCboeChain(chainData, spot, maxExpirations);

  const allRows: GexRow[] = [];
  for (const exp of exps) {
    const days = dte(exp);
    if (days > 90) continue;
    const T = Math.max(days, 0.5) / 365;
    allRows.push(...processChain(chains[exp], spot, T, r, q, exp, days));
  }

  if (!allRows.length) throw new Error(`No GEX data for ${ticker}`);

  const agg = aggregate(allRows, spot);
  const levels = computeKeyLevels(agg, spot, allRows);
  const flow = computeFlow(allRows);
  const ivRv = await computeIVRVSpread(allRows, spot, ticker);

  const isLong = spot > levels.gamma_flip;
  const totalVomma = allRows.reduce((s, r) => s + r.vomma, 0);
  const bias = isLong ? 'BUY DIPS' : totalVomma > 0 ? 'LONG VOLATILITY' : 'NEUTRAL';
  const biasColor = isLong ? '#10b981' : totalVomma > 0 ? '#ef4444' : '#f59e0b';

  const netGex = agg.reduce((s, a) => s + a.gex_net, 0);
  const netVolGex = agg.reduce((s, a) => s + a.vol_gex_net, 0);
  const totalCallGex = agg.reduce((s, a) => s + a.call_gex, 0);
  const totalPutGex = agg.reduce((s, a) => s + Math.abs(a.put_gex), 0);
  const gexRatio = (totalCallGex + totalPutGex) > 0 ? totalCallGex / (totalCallGex + totalPutGex) : 0.5;
  const dex = agg.reduce((s, a) => s + a.dex_net, 0);
  const vex = agg.reduce((s, a) => s + a.vex_net, 0);
  const cex = agg.reduce((s, a) => s + a.cex_net, 0);
  const vanna = agg.reduce((s, a) => s + a.vanna_net, 0);
  const atmRows = agg.filter(a => Math.abs(a.dist_pct) <= 0.5);
  const atmIV = atmRows.length ? (atmRows.reduce((s, a) => s + a.iv, 0) / atmRows.length) * 100 : 0;

  const maxGex = agg.reduce((m, a) => Math.max(m, Math.abs(a.gex_net)), 0);
  const filteredAgg = agg.filter(a => Math.abs(a.gex_net) > maxGex * 0.01 || Math.abs(a.gex_net) > 0.05 || a.oi > 500);

  // Return a much wider range of strikes to avoid "empty levels" look
  // Show roughly 50 strikes around the spot or the whole chain if it's smaller
  let closestIdx = 0;
  let minDiff = Infinity;
  for (let i = 0; i < filteredAgg.length; i++) {
    const diff = Math.abs(filteredAgg[i].strike - spot);
    if (diff < minDiff) { minDiff = diff; closestIdx = i; }
  }
  
  const showAgg = filteredAgg.slice(Math.max(0, closestIdx - 50), Math.min(filteredAgg.length, closestIdx + 51));

  const summaryData = chainData.data || {};

  const uoa = allRows
    .filter(r => r.volume > r.oi && r.volume >= 50)
    .sort((a, b) => b.volume - a.volume)
    .slice(0, 30)
    .map(r => {
      const intrinsic = r.flag === 'C' ? Math.max(0, spot - r.strike) : Math.max(0, r.strike - spot);
      const extrinsic = Math.max(0, r.mid - intrinsic);
      return {
        strike: r.strike, expiration: r.expiry, flag: r.flag,
        volume: r.volume, oi: r.oi, bid: r.bid, ask: r.ask, mid: r.mid,
        intrinsic, extrinsic, dte: r.dte, iv: r.iv,
      };
    });

  return {
    ticker, spot, levels,
    agg: showAgg,
    exps,
    regime: {
      is_long_gamma: isLong,
      label: isLong ? 'LONG GAMMA · STABLE' : 'SHORT GAMMA · VOLATILE',
      bias, bias_color: biasColor,
    },
    totals: { net_gex: netGex, net_vol_gex: netVolGex, gex_ratio: gexRatio, dex, vex, cex, vanna, atm_iv: atmIV, call_gex: totalCallGex, put_gex: totalPutGex },
    flow, iv_rv_spread: ivRv,
    timestamp: new Date().toISOString(),
    uoa,
    raw: allRows.filter(r => showAgg.some(a => a.strike === r.strike)).map(r => ({ strike: r.strike, expiration: r.expiry, callGEX: r.call_gex, putGEX: r.put_gex, volume: r.volume, oi: r.oi, flag: r.flag, ask: r.ask, bid: r.bid, dte: r.dte, mid: r.mid, iv: r.iv })),
    summary: {
      price_change: parseFloat(summaryData.price_change || '0'),
      price_change_percent: parseFloat(summaryData.price_change_percent || '0'),
      high: parseFloat(summaryData.high || '0'),
      low: parseFloat(summaryData.low || '0'),
      volume: parseFloat(summaryData.volume || '0'),
      iv30: parseFloat(summaryData.iv30 || '0'),
      bid: parseFloat(summaryData.bid || '0'),
      ask: parseFloat(summaryData.ask || '0'),
    }
  };
}

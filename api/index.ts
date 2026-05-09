import express from 'express';
import cors from 'cors';
import axios from 'axios';
import { GoogleGenAI } from '@google/genai';
import { fetchGexData } from '../src/lib/gexEngine.js';

const app = express();
app.use(cors());
app.use(express.json());

// API functionality here...
const router = express.Router();

// Memory Cache
const cache: Record<string, { data: any; ts: number }> = {};
const CACHE_TTL = 30 * 1000; 
const CHART_CACHE_TTL = 60 * 1000; 

// Logging Middleware for the router
router.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[API] ${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`);
  });
  next();
});

const SYSTEM_HEADERS_B = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Origin': 'https://finance.yahoo.com',
  'Referer': 'https://finance.yahoo.com/',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache'
};

const SYSTEM_HEADERS_A = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Referer': 'https://www.cboe.com/',
  'Origin': 'https://www.cboe.com',
};

// --- API ROUTES ---

router.get('/market-status', (req, res) => {
  try {
    const now = new Date();
    const nyTime = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      weekday: 'short',
      hour12: false,
    }).formatToParts(now);

    const hour = parseInt(nyTime.find(p => p.type === 'hour')?.value || '0');
    const minute = parseInt(nyTime.find(p => p.type === 'minute')?.value || '0');
    const weekday = nyTime.find(p => p.type === 'weekday')?.value || '';
    
    const isWeekend = ['Sat', 'Sun'].includes(weekday);
    const totalMinutes = hour * 60 + minute;
    
    const isRegularHours = totalMinutes >= 570 && totalMinutes < 960;
    const isPreMarket = totalMinutes >= 240 && totalMinutes < 570;
    const isAfterHours = totalMinutes >= 960 && totalMinutes < 1200;

    let status = 'CLOSED';
    let label = 'Market Closed';
    let color = '#ef4444'; 

    if (isWeekend) {
      status = 'CLOSED';
      label = 'Weekend - Closed';
    } else if (isRegularHours) {
      status = 'LIVE';
      label = 'Market Live';
      color = '#10b981';
    } else if (isPreMarket) {
      status = 'PRE';
      label = 'Pre-Market';
      color = '#f59e0b';
    } else if (isAfterHours) {
      status = 'AFTER';
      label = 'After Hours';
      color = '#3b82f6';
    }

    res.json({
      status,
      label,
      color,
      nyTime: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`,
      isLive: status === 'LIVE',
    });
  } catch (e: any) {
    res.status(500).json({ error: 'Market status failure', details: e.message });
  }
});

router.get('/ratio/:ticker', async (req, res) => {
  const { ticker } = req.params;
  const cacheKey = `ratio_${ticker}`;
  if (cache[cacheKey] && Date.now() - cache[cacheKey].ts < CACHE_TTL) return res.json(cache[cacheKey].data);

  try {
    const symbolMapping: Record<string, string> = { 
      'SPY': 'ES=F', 
      'QQQ': 'NQ=F', 
      'IWM': 'RTY=F',
      'DIA': 'YM=F',
      'VIX': 'VX=F',
      'GLD': 'GC=F',
      'SLV': 'SI=F',
      'USO': 'CL=F',
      'UNG': 'NG=F',
      'TLT': 'ZB=F',
      'XLE': 'CL=F' 
    };
    const futuresTicker = symbolMapping[ticker.toUpperCase()] || ticker.toUpperCase();
    
    console.log(`[API] Fetching ratio for ${ticker} / ${futuresTicker}`);
    const [futureRes, spotRes] = await Promise.all([
      axios.get(`https://query2.finance.yahoo.com/v8/finance/chart/${futuresTicker}?interval=1m&range=1d`, { headers: SYSTEM_HEADERS_B, timeout: 10000 }),
      axios.get(`https://query2.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1m&range=1d`, { headers: SYSTEM_HEADERS_B, timeout: 10000 })
    ]);

    if (!futureRes.data.chart?.result || !spotRes.data.chart?.result) {
      console.warn(`[API] Ratio fetch yielded no results for ${ticker}`);
      return res.status(404).json({ error: 'Ticker not found', ticker });
    }

    const futurePrice = futureRes.data.chart.result[0].meta.regularMarketPrice || futureRes.data.chart.result[0].meta.previousClose;
    const spotPrice = spotRes.data.chart.result[0].meta.regularMarketPrice || spotRes.data.chart.result[0].meta.previousClose;

    const result = { ticker, futuresTicker, ratio: futurePrice / spotPrice, spotPrice, futurePrice, ts: Date.now() };
    cache[cacheKey] = { data: result, ts: Date.now() };
    res.json(result);
  } catch (error: any) {
    console.error(`[API] Ratio fetch failed for ${ticker}:`, error.message);
    const fallbacks: Record<string, number> = { 'SPY': 10.0, 'QQQ': 42.0 };
    res.json({ ticker, ratio: fallbacks[ticker] || 1.0, error: 'Remote fetch failed', details: error.message });
  }
});

router.get('/chain/:symbol', async (req, res) => {
  const { symbol } = req.params;
  const cacheKey = `chain_${symbol}`;
  if (cache[cacheKey] && Date.now() - cache[cacheKey].ts < CACHE_TTL) return res.json(cache[cacheKey].data);

  const symUpper = symbol.toUpperCase();
  const variations = [symUpper];
  if (['SPX', 'NDX', 'RUT', 'VIX'].includes(symUpper)) variations.unshift(`_${symUpper}`);

  try {
    const promises = variations.map(v => 
      axios.get(`https://cdn.cboe.com/api/global/delayed_quotes/options/${v}.json`, { 
        headers: SYSTEM_HEADERS_A, 
        timeout: 10000 
      }).then(r => {
        if (r.data?.data?.options) return r.data;
        throw new Error('No options');
      })
    );
    const data = await Promise.any(promises).catch(() => null);
    if (data) {
      cache[cacheKey] = { data, ts: Date.now() };
      return res.json(data);
    }
  } catch (e) {}

  res.status(500).json({ error: 'Failed to fetch chain data' });
});

router.get('/spot/:ticker', async (req, res) => {
  const { ticker } = req.params;
  const cacheKey = `spot_${ticker}`;
  if (cache[cacheKey] && Date.now() - cache[cacheKey].ts < CACHE_TTL) return res.json({ price: cache[cacheKey].data });

  try {
    const response = await axios.get(`https://cdn.cboe.com/api/global/delayed_quotes/options/${ticker.toUpperCase()}.json`, { headers: SYSTEM_HEADERS_A, timeout: 10000 });
    const price = response.data.data.current_price;
    cache[cacheKey] = { data: price, ts: Date.now() };
    res.json({ price });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch spot price', details: error.message });
  }
});

router.get('/v1/chart-data/:ticker', async (req, res) => {
  const { ticker } = req.params;
  const { interval = '5m', range = '1d' } = req.query;
  const cacheKey = `chart_${ticker}_${interval}_${range}`;
  if (cache[cacheKey] && Date.now() - cache[cacheKey].ts < CHART_CACHE_TTL) return res.json(cache[cacheKey].data);

  try {
    const url = `https://query2.finance.yahoo.com/v8/finance/chart/${ticker.toUpperCase()}?interval=${interval}&range=${range}`;
    const response = await axios.get(url, { headers: SYSTEM_HEADERS_B, timeout: 10000 });
    
    if (!response.data.chart?.result) {
      return res.status(404).json({ error: 'Ticker not found', details: `No chart data available for ${ticker}` });
    }
    
    cache[cacheKey] = { data: response.data, ts: Date.now() };
    res.json(response.data);
  } catch (error: any) {
    const status = error.response?.status === 404 ? 404 : 500;
    res.status(status).json({ error: 'Chart Fetch Failed', details: error.message });
  }
});

router.get('/news', async (req, res) => {
  const cacheKey = 'yahoo_news_ai_v3';
  const force = req.query.force === 'true';

  if (!force && cache[cacheKey] && Date.now() - cache[cacheKey].ts < 3 * 60 * 1000) { 
    return res.json(cache[cacheKey].data);
  }

  try {
    const urls = [
      'https://query2.finance.yahoo.com/v1/finance/search?q=financial%20news&quotesCount=0&newsCount=10',
      'https://query2.finance.yahoo.com/v1/finance/search?q=us%20equities&quotesCount=0&newsCount=10',
      'https://query2.finance.yahoo.com/v1/finance/search?q=tech%20stocks&quotesCount=0&newsCount=10'
    ];
    
    let allNews: any[] = [];
    try {
       const responses = await Promise.all(urls.map(u => axios.get(u, { headers: SYSTEM_HEADERS_B, timeout: 10000 })));
       responses.forEach(r => {
          if (r.data && r.data.news) allNews = allNews.concat(r.data.news);
       });
    } catch(e) {
       console.error("Yahoo News Fetch error", e);
    }

    const uniqueNews = new Map();
    for (const item of allNews) {
        if (!uniqueNews.has(item.uuid)) uniqueNews.set(item.uuid, item);
    }
    const mergedNews = Array.from(uniqueNews.values())
        .sort((a: any, b: any) => b.providerPublishTime - a.providerPublishTime)
        .slice(0, 15);

    const newsData = mergedNews.map((item: any) => ({
      date: new Date(item.providerPublishTime * 1000).toISOString(),
      title: item.title,
      url: item.link,
      source: item.publisher || 'Yahoo Finance',
      original_symbols: item.relatedTickers || [],
      summary: item.summary || ''
    }));

    let enhancedNews = newsData.map((item: any) => {
      return { 
        ...item, 
        sentiment: 'Neutral', 
        tickers: item.original_symbols && item.original_symbols.length > 0 ? item.original_symbols : ['Macro'], 
        ai_description: item.summary || item.title 
      };
    });

    try {
      const genAI = getAI();
      if (genAI && newsData.length > 0) {
        const prompt = `Elite quant strategist. Analyze these news headlines and return a JSON array of objects [{index:number, sentiment:string, tickers:string[], description:string}] for: \n` + newsData.map((n: any, i: number) => `${i}: ${n.title}`).join('\n');
        
        const aiPromise = genAI.models.generateContent({
           model: 'gemini-1.5-flash',
           contents: prompt,
           config: { responseMimeType: "application/json" }
        });
        
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000));
        const result: any = await Promise.race([aiPromise, timeoutPromise]);
        const aiData = JSON.parse(result.text);
        
        enhancedNews = newsData.map((item: any, i: number) => {
            const analysis = Array.isArray(aiData) ? aiData.find((a: any) => a.index === i) : null;
            return analysis ? { 
              ...item, 
              sentiment: analysis.sentiment, 
              tickers: analysis.tickers || item.original_symbols, 
              ai_description: analysis.description 
            } : item;
        });
      }
    } catch (aiError) {
      console.error("News AI Sentiment Error:", aiError);
    }

    cache[cacheKey] = { data: enhancedNews, ts: Date.now() };
    res.json(enhancedNews);
  } catch (error: any) {
    res.status(500).json({ error: 'News Fetch Failed', details: error.message });
  }
});

router.get('/macro/benchmarks', async (req, res) => {
  const cacheKey = 'macro_benchmarks';
  if (cache[cacheKey] && Date.now() - cache[cacheKey].ts < 30 * 1000) return res.json(cache[cacheKey].data);

  const tickers: Record<string, string> = {
    'DXY': 'DX-Y.NYB', 'VIX': '^VIX', 'US10Y': '^TNX', 'US2Y': 'US2Y=X', 'GOLD': 'GC=F', 'COPPER': 'HG=F', 'OIL': 'CL=F', 'SPX': '^GSPC', 'BTC': 'BTC-USD', 'HYG': 'HYG', 'US13W': '^IRX', 'US5Y': '^FVX', 'US30Y': '^TYX'
  };

  const results: any = {};
  await Promise.all(Object.entries(tickers).map(async ([key, symbol]) => {
    try {
      const resp = await axios.get(`https://query2.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=5d`, { headers: SYSTEM_HEADERS_B, timeout: 10000 });
      const meta = resp.data.chart.result[0].meta;
      const price = meta.regularMarketPrice || meta.previousClose;
      results[key] = { price, change: price - meta.previousClose, changePercent: ((price-meta.previousClose)/meta.previousClose)*100, symbol };
    } catch { results[key] = { price: 0, change: 0, changePercent: 0, error: true }; }
  }));

  // Calculated benchmarks
  if (results.COPPER && !results.COPPER.error && results.GOLD && !results.GOLD.error && results.GOLD.price > 0) {
    const ratio = (results.COPPER.price / results.GOLD.price) * 100;
    results['HG_GC_RATIO'] = { price: ratio, change: 0, changePercent: 0, symbol: 'HG_GC' };
  }
  if (results.US10Y && !results.US10Y.error && results.US2Y && !results.US2Y.error) {
    const spread = (results.US10Y.price - results.US2Y.price);
    results['SPREAD_2s10s'] = { price: spread, change: 0, changePercent: 0, symbol: '2s10s' };
  }

  cache[cacheKey] = { data: results, ts: Date.now() };
  res.json(results);
});

router.get('/v1/options-data', async (req, res) => {
  const { ticker = 'SPY', exps = '1' } = req.query;
  const force = req.query.force === 'true';
  const cacheKey = `gex_data_${ticker}_${exps}`;

  if (!force && cache[cacheKey] && Date.now() - cache[cacheKey].ts < 5 * 60 * 1000) {
    return res.json(cache[cacheKey].data);
  }

  try {
    console.log(`[API] Processing GEX data for ${ticker} (Exps: ${exps})`);
    const data = await fetchGexData(ticker as string, parseInt(exps as string));
    cache[cacheKey] = { data, ts: Date.now() };
    res.json(data);
  } catch (e: any) {
    console.error(`[API] GEX Engine Error for ${ticker}:`, e.message);
    const status = (e.message.includes('No GEX data') || e.message.includes('No options chain')) ? 404 : 500;
    res.status(status).json({ error: 'GEX processing failed', details: e.message });
  }
});

let aiClient: GoogleGenAI | null = null;
const getAI = () => {
  if (!aiClient && process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY') {
    aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return aiClient;
};

router.get('/macro/synthesis', async (req, res) => {
  const { symbol } = req.query;
  const cacheKey = `macro_synthesis_${symbol || 'global'}`;
  if (cache[cacheKey] && Date.now() - cache[cacheKey].ts < 5 * 60 * 1000) return res.json(cache[cacheKey].data);

  const fallbackData = {
    regime: "Expansion", regimeScore: 65, narrative: `Global growth resilient. ${symbol ? `${symbol} maintains strong beta to liquidity flows.` : ''}`,
    statusMsg: "NOMINAL",
    keyIndicators: [
      { name: "Real GDP", status: "Expanding", value: "2.4%", implication: "Growth resilient", trend: [1.8, 2.0, 2.1, 2.2, 2.3, 2.4, 2.4], change: "+0.2%", importance: 9 },
      { name: "Core PCE", status: "Cooling", value: "2.8%", implication: "Disinflation intact", trend: [3.5, 3.2, 3.1, 3.0, 2.9, 2.8, 2.8], change: "-0.1%", importance: 10 },
      { name: "Nonfarm Payrolls", status: "Robust", value: "275k", implication: "Labor tight", trend: [210, 225, 230, 245, 260, 275, 275], change: "+15k", importance: 8 },
      { name: "ISM Manuf.", status: "Contraction", value: "49.2", implication: "Sector soft", trend: [47, 47.5, 48, 48.5, 49, 49.2, 49.2], change: "+0.2", importance: 7 },
      { name: "Consumer Conf.", status: "Stagnant", value: "104.7", implication: "Sentiment mixed", trend: [102, 103, 104, 104.5, 104.7, 104.7, 104.7], change: "-0.3", importance: 6 },
      { name: "Housing Starts", status: "Falling", value: "1.3M", implication: "Rates impact", trend: [1.5, 1.45, 1.4, 1.38, 1.35, 1.3, 1.3], change: "-50k", importance: 5 },
      { name: "Retail Sales", status: "Flat", value: "0.6%", implication: "Spending pivot", trend: [0.8, 0.7, 0.65, 0.6, 0.61, 0.59, 0.6], change: "+0.01%", importance: 7 },
      { name: "Unit Labor Cost", status: "Rising", value: "3.2%", implication: "Wage pressure", trend: [2.8, 2.9, 3.0, 3.1, 3.15, 3.2, 3.2], change: "+0.05%", importance: 8 },
      { name: "M2 Money Supply", status: "Neutral", value: "-0.2%", implication: "Liquidity drain", trend: [-0.5, -0.4, -0.3, -0.25, -0.21, -0.2, -0.2], change: "+0.01%", importance: 7 }
    ],
    playbook: {
      direction: { summary: "NEUTRAL", details: "Market digesting recent moves", biasScore: 0 },
      volatility: { summary: "RANGE-BOUND", details: "VIX near long-term average" },
      positionSize: { summary: "STANDARD", details: "100% of normal" },
      macroRange: { summary: "±1.5%", details: "Straddle pricing fair" },
      optionsPricing: [
        { label: "EXPECTED MOVE (2D)", val: "±1.2%", sub: "Priced in" },
        { label: "IV TERM STRUCTURE", val: "Contango", sub: "Normal" },
        { label: "PUT/CALL SKEW", val: "Flat", sub: "Neutral positioning" },
        { label: "P/C OI RATIO", val: "1.0", sub: "Balanced" },
        { label: "MAX PAIN", val: "At The Money", sub: "Pin risk" }
      ],
      vixIntelligence: {
        actual: 15.0,
        fair: 16.5,
        status: "RANGE-BOUND",
        details: "Vol in normal range",
        signal: "NEUTRAL"
      },
      recommendedStrategies: [
        { name: "Iron Condors", confidence: "MEDIUM", details: "Sell iron condors — neutral, collect theta" }
      ],
      liquidityTrend: [
        { date: "4W Ago", value: 12.5, description: "Fed Repo injection" },
        { date: "3W Ago", value: -8.2, description: "TGA Refilling" },
        { date: "2W Ago", value: -15.4, description: "Tax season drain" },
        { date: "1W Ago", value: 5.1, description: "RRP unwind" },
        { date: "Current", value: -12.0, description: "Net liquidity extraction" }
      ]
    },
    sectors: [{ name: "Tech", performance: 1.2, status: "Leading" }, { name: "Financials", performance: 0.8, status: "Leading" }, { name: "Energy", performance: -0.5, status: "Lagging" }, { name: "Healthcare", performance: 0.2, status: "Neutral" }, { name: "Utilities", performance: -1.2, status: "Lagging" }, { name: "Industrials", performance: 0.5, status: "Leading" }],
    economicCalendar: [{ event: "FOMC Rate Decision", date: "Next Week", impact: "High", forecast: "Pause" }, { event: "CPI Release", date: "In 2 Days", impact: "High", forecast: "0.3% MoM" }],
    policyWatch: { fed: "Data-Dependent", action: "Pause", nextMeeting: "Scheduled", quantTightening: "Active" },
    assetClassViews: { equities: "Neutral", fixed_income: "Overweight", commodities: "Neutral", forex_carry: "Neutral" },
    riskAudit: ["Geopolitical escalation in the Middle East", "Commercial Real Estate stress", "Liquidity pockets drying up"],
    detailedReport: "# Macro Report\n\nResilient expansion observed. Core inflation is cooling..."
  };

  try {
    const genAI = getAI();
    if (!genAI) return res.json(fallbackData);
    
    const schema = {
      type: "object",
      properties: {
        regime: { type: "string" },
        regimeScore: { type: "number" },
        narrative: { type: "string" },
        statusMsg: { type: "string" },
        keyIndicators: { 
          type: "array", 
          items: { 
            type: "object", 
            properties: { 
              name: { type: "string" }, 
              status: { type: "string" }, 
              value: { type: "string" }, 
              implication: { type: "string" },
              trend: { type: "array", items: { type: "number" } },
              change: { type: "string" },
              importance: { type: "number" }
            }, 
            required: ["name", "status", "value", "implication", "trend", "change", "importance"] 
          } 
        },
        playbook: {
          type: "object",
          properties: {
            direction: { type: "object", properties: { summary: { type: "string" }, details: { type: "string" }, biasScore: { type: "number" } }, required: ["summary", "details", "biasScore"] },
            volatility: { type: "object", properties: { summary: { type: "string" }, details: { type: "string" } }, required: ["summary", "details"] },
            positionSize: { type: "object", properties: { summary: { type: "string" }, details: { type: "string" } }, required: ["summary", "details"] },
            macroRange: { type: "object", properties: { summary: { type: "string" }, details: { type: "string" } }, required: ["summary", "details"] },
            optionsPricing: { type: "array", items: { type: "object", properties: { label: { type: "string" }, val: { type: "string" }, sub: { type: "string" } }, required: ["label", "val", "sub"] } },
            vixIntelligence: { type: "object", properties: { actual: { type: "number" }, fair: { type: "number" }, status: { type: "string" }, details: { type: "string" }, signal: { type: "string" } }, required: ["actual", "fair", "status", "details", "signal"] },
            recommendedStrategies: { type: "array", items: { type: "object", properties: { name: { type: "string" }, confidence: { type: "string" }, details: { type: "string" } }, required: ["name", "confidence", "details"] } },
            liquidityTrend: { 
              type: "array", 
              items: { 
                type: "object", 
                properties: { 
                  date: { type: "string" }, 
                  value: { type: "number" }, 
                  description: { type: "string" } 
                }, 
                required: ["date", "value", "description"] 
              } 
            }
          },
          required: ["direction", "volatility", "positionSize", "macroRange", "optionsPricing", "vixIntelligence", "recommendedStrategies", "liquidityTrend"]
        },
        sectors: { type: "array", items: { type: "object", properties: { name: { type: "string" }, performance: { type: "number" }, status: { type: "string" } }, required: ["name", "performance", "status"] } },
        economicCalendar: { type: "array", items: { type: "object", properties: { event: { type: "string" }, date: { type: "string" }, impact: { type: "string" }, forecast: { type: "string" } }, required: ["event", "date", "impact", "forecast"] } },
        policyWatch: { type: "object", properties: { fed: { type: "string" }, action: { type: "string" }, nextMeeting: { type: "string" }, quantTightening: { type: "string" } }, required: ["fed", "action", "nextMeeting", "quantTightening"] },
        assetClassViews: { type: "object", properties: { equities: { type: "string" }, fixed_income: { type: "string" }, commodities: { type: "string" }, forex_carry: { type: "string" } }, required: ["equities", "fixed_income", "commodities", "forex_carry"] },
        riskAudit: { type: "array", items: { type: "string" } },
        detailedReport: { type: "string" }
      },
      required: ["regime", "regimeScore", "narrative", "statusMsg", "keyIndicators", "playbook", "sectors", "economicCalendar", "policyWatch", "assetClassViews", "riskAudit", "detailedReport"]
    };

    const liveBenchmarks = cache['macro_benchmarks']?.data || {};
    const contextStr = Object.keys(liveBenchmarks).length > 0 
      ? `Current live market data: ${JSON.stringify(liveBenchmarks)}. `
      : '';

    const aiPromise = genAI.models.generateContent({
      model: "gemini-1.5-flash",
      contents: `
          DATE: ${new Date().toISOString()}
          CONTEXT: ${contextStr}
          TARGET SYMBOL: ${symbol || 'GLOBAL MACRO'}
          
          Act as a world-class Macro Strategist and Quantitative Researcher. 
          Your task is to synthesize the current global macroeconomic landscape.
          
          ${symbol ? `SPECIFIC FOCUS: Analyze how the current macro regime (GDP, Inflation, Fed Policy) specifically impacts ${symbol}. Explain its "Macro Beta" and sensitivity to the current liquidity environment.` : 'Focus on the global macro landscape.'}
          
          DIRECTIONS:
          1. Determine the current Market Regime.
          2. Provide exactly 9 highly realistic macro indicators.
          3. For EACH indicator, provide details including a 7-reading trend array.
          4. Generate a detailed, professional macro report using Markdown.
          5. Ensure all data reflects the context of ${symbol || 'global equities'}.
          6. statusMsg should be a technical string like "STRESS DETECTED" or "NOMINAL".
          
          Strictly adhere to the following JSON schema:
        `,
      config: { 
        responseMimeType: "application/json",
        // @ts-ignore
        responseSchema: schema
      }
    });
    
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 15000));
    
    const result: any = await Promise.race([aiPromise, timeoutPromise]);
    const data = JSON.parse(result.text);
    cache[cacheKey] = { data, ts: Date.now() };
    res.json(data);
  } catch (error) { 
    console.error("Synthesis AI Error:", error);
    res.json(fallbackData); 
  }
});

router.get('/system/health', (req, res) => {
  res.json({
    status: 'online',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    env: {
      NODE_ENV: process.env.NODE_ENV,
      HAS_GEMINI: !!process.env.GEMINI_API_KEY,
      HAS_FLOQ: !!process.env.FLOQ_API_KEY
    }
  });
});

router.all('/*', (req, res) => res.status(404).json({ error: 'API route not found' }));

// Mount router on app for serverless environments
app.use('/api', router);
// Also mount on root in case the rewrite strips /api
app.use('/', router);

export { router };
export default app;

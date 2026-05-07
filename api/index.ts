import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import axios from 'axios';
import { GoogleGenAI } from '@google/genai';
import * as cheerio from 'cheerio';
import { fetchGexData } from '../src/lib/gexEngine';

const app = express();
app.use(cors());
app.use(express.json());

// Memory Cache
const cache: Record<string, { data: any; ts: number }> = {};
const CACHE_TTL = 15 * 1000; 
const CHART_CACHE_TTL = 15 * 1000; 

const SYSTEM_HEADERS_B = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Origin': 'https://finance.yahoo.com',
  'Referer': 'https://finance.yahoo.com/',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache'
};

const SYSTEM_HEADERS_A = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Referer': 'https://www.cboe.com/',
  'Origin': 'https://www.cboe.com',
};

// --- API ROUTES ---

app.get('/api/market-status', (req, res) => {
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

let aiClient: GoogleGenAI | null = null;
const getAI = () => {
  if (!aiClient && process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY') {
    aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return aiClient;
};

app.get('/api/ratio/:ticker', async (req, res) => {
  const { ticker } = req.params;
  const cacheKey = `ratio_${ticker}`;
  if (cache[cacheKey] && Date.now() - cache[cacheKey].ts < CACHE_TTL) return res.json(cache[cacheKey].data);

  try {
    const symbolMapping: Record<string, string> = { 'SPY': 'ES=F', 'QQQ': 'NQ=F', 'IWM': 'RTY=F' };
    const futuresTicker = symbolMapping[ticker] || 'ES=F';
    
    const [futureRes, spotRes] = await Promise.all([
      axios.get(`https://query2.finance.yahoo.com/v8/finance/chart/${futuresTicker}?interval=1m&range=1d`, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 10000 }),
      axios.get(`https://query2.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1m&range=1d`, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 10000 })
    ]);

    const futurePrice = futureRes.data.chart.result[0].meta.regularMarketPrice || futureRes.data.chart.result[0].meta.previousClose;
    const spotPrice = spotRes.data.chart.result[0].meta.regularMarketPrice || spotRes.data.chart.result[0].meta.previousClose;

    const result = { ticker, futuresTicker, ratio: futurePrice / spotPrice, spotPrice, futurePrice, ts: Date.now() };
    cache[cacheKey] = { data: result, ts: Date.now() };
    res.json(result);
  } catch (error: any) {
    const fallbacks: Record<string, number> = { 'SPY': 10.0, 'QQQ': 42.0 };
    res.json({ ticker, ratio: fallbacks[ticker] || 1.0, error: 'Remote fetch failed', details: error.message });
  }
});

app.get('/api/chain/:symbol', async (req, res) => {
  const { symbol } = req.params;
  const cacheKey = `chain_${symbol}`;
  if (cache[cacheKey] && Date.now() - cache[cacheKey].ts < CACHE_TTL) return res.json(cache[cacheKey].data);

  const symUpper = symbol.toUpperCase();
  const variations = [symUpper];
  if (['SPX', 'NDX', 'RUT', 'VIX', 'DIA'].includes(symUpper)) variations.unshift(`_${symUpper}`);

  for (const v of variations) {
    try {
      const response = await axios.get(`https://cdn.cboe.com/api/global/delayed_quotes/options/${v}.json`, { headers: SYSTEM_HEADERS_A, timeout: 5000 });
      if (response.data?.data?.options) {
           cache[cacheKey] = { data: response.data, ts: Date.now() };
           return res.json(response.data);
      }
    } catch (e) {}
  }
  res.status(500).json({ error: 'Failed to fetch chain data' });
});

app.get('/api/spot/:ticker', async (req, res) => {
  const { ticker } = req.params;
  const cacheKey = `spot_${ticker}`;
  if (cache[cacheKey] && Date.now() - cache[cacheKey].ts < CACHE_TTL) return res.json({ price: cache[cacheKey].data });

  try {
    const response = await axios.get(`https://cdn.cboe.com/api/global/delayed_quotes/options/${ticker.toUpperCase()}.json`, { headers: SYSTEM_HEADERS_A, timeout: 5000 });
    const price = response.data.data.current_price;
    cache[cacheKey] = { data: price, ts: Date.now() };
    res.json({ price });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch spot price', details: error.message });
  }
});

app.get('/api/yahoo/chart/:ticker', async (req, res) => {
  const { ticker } = req.params;
  const { interval = '5m', range = '1d' } = req.query;
  const cacheKey = `chart_${ticker}_${interval}_${range}`;
  if (cache[cacheKey] && Date.now() - cache[cacheKey].ts < CHART_CACHE_TTL) return res.json(cache[cacheKey].data);

  try {
    const url = `https://query2.finance.yahoo.com/v8/finance/chart/${ticker.toUpperCase()}?interval=${interval}&range=${range}`;
    const response = await axios.get(url, { headers: SYSTEM_HEADERS_B, timeout: 10000 });
    cache[cacheKey] = { data: response.data, ts: Date.now() };
    res.json(response.data);
  } catch (error: any) {
    res.status(500).json({ error: 'Chart Fetch Failed', details: error.message });
  }
});

app.get('/api/news', async (req, res) => {
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
       const responses = await Promise.all(urls.map(u => axios.get(u, { headers: SYSTEM_HEADERS_A, timeout: 10000 })));
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

    const getHeuristicAnalysis = (title: string) => {
      const lower = title.toLowerCase();
      let posScore = 0, negScore = 0;
      const posWords = ['surge', 'up', 'gain', 'buy', 'bull', 'rally', 'beat', 'soar', 'jump', 'upgrade', 'higher', 'growth', 'strong'];
      const negWords = ['plunge', 'down', 'loss', 'sell', 'bear', 'crash', 'miss', 'drop', 'fall', 'downgrade', 'lower', 'weak', 'risk', 'burn', 'cut'];
      posWords.forEach(w => { if (lower.includes(w)) posScore++; });
      negWords.forEach(w => { if (lower.includes(w)) negScore++; });
      let sentiment = 'Neutral';
      if (posScore > negScore) sentiment = 'Positive';
      if (negScore > posScore) sentiment = 'Negative';
      let desc = title;
      if (desc.length > 100) desc = desc.substring(0, 97) + '...';
      return { sentiment, desc };
    };

    let enhancedNews = newsData.map((item: any) => {
      const heur = getHeuristicAnalysis(item.title);
      return { ...item, sentiment: heur.sentiment, tickers: item.original_symbols || ['Macro'], ai_description: heur.desc };
    });

    try {
      const genAI = getAI();
      if (genAI && newsData.length > 0) {
        const prompt = `Elite quant strategist. Analyze these and return JSON array [{index:number, sentiment:string, tickers:string[], description:string}] for: \n` + newsData.map((n: any, i: number) => `${i}: ${n.title}`).join('\n');
        const result = await genAI.models.generateContent({
           model: 'gemini-1.5-flash',
           contents: [prompt],
           config: { responseMimeType: "application/json" }
        });
        const aiData = JSON.parse(result.text);
        enhancedNews = newsData.map((item: any, i: number) => {
            const analysis = aiData.find((a: any) => a.index === i);
            return analysis ? { ...item, sentiment: analysis.sentiment, tickers: analysis.tickers || item.original_symbols, ai_description: analysis.description } : item;
        });
      }
    } catch (aiError) {}

    cache[cacheKey] = { data: enhancedNews, ts: Date.now() };
    res.json(enhancedNews);
  } catch (error: any) {
    res.status(500).json({ error: 'News Fetch Failed', details: error.message });
  }
});

app.get('/api/macro/benchmarks', async (req, res) => {
  const cacheKey = 'macro_benchmarks';
  if (cache[cacheKey] && Date.now() - cache[cacheKey].ts < 5 * 60 * 1000) return res.json(cache[cacheKey].data);

  const tickers: Record<string, string> = {
    'DXY': 'DX-Y.NYB', 'VIX': '^VIX', 'US10Y': '^TNX', 'US2Y': 'US2Y=X', 'GOLD': 'GC=F', 'OIL': 'CL=F', 'SPX': '^GSPC', 'BTC': 'BTC-USD'
  };

  const results: any = {};
  await Promise.all(Object.entries(tickers).map(async ([key, symbol]) => {
    try {
      const resp = await axios.get(`https://query2.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=5d`, { headers: SYSTEM_HEADERS_B, timeout: 5000 });
      const meta = resp.data.chart.result[0].meta;
      const price = meta.regularMarketPrice || meta.previousClose;
      results[key] = { price, change: price - meta.previousClose, changePercent: ((price-meta.previousClose)/meta.previousClose)*100, symbol };
    } catch { results[key] = { price: 0, change: 0, changePercent: 0, error: true }; }
  }));
  cache[cacheKey] = { data: results, ts: Date.now() };
  res.json(results);
});

app.get('/api/gex', async (req, res) => {
  const { ticker = 'SPY', exps = '1' } = req.query;
  try {
    const data = await fetchGexData(ticker as string, parseInt(exps as string));
    res.json(data);
  } catch (e: any) {
    console.error("GEX Engine Error:", e.message);
    res.status(500).json({ error: 'GEX processing failed', details: e.message });
  }
});

app.get('/api/macro/synthesis', async (req, res) => {
  const cacheKey = 'macro_synthesis';
  if (cache[cacheKey] && Date.now() - cache[cacheKey].ts < 30 * 60 * 1000) return res.json(cache[cacheKey].data);

  const fallbackData = {
    regime: "Expansion", regimeScore: 65, narrative: "Global growth resilient.",
    keyIndicators: [{ name: "Real GDP", status: "Stable", value: "2.4%", implication: "Supportive" }],
    sectors: [{ name: "Tech", performance: 1.2, status: "Leading" }],
    economicCalendar: [{ event: "FOMC", date: "TBD", impact: "High", forecast: "Pause" }],
    policyWatch: { fed: "Data-Dependent", action: "Pause", nextMeeting: "Scheduled", quantTightening: "Active" },
    assetClassViews: { equities: "Neutral", fixed_income: "Overweight", commodities: "Neutral", forex_carry: "Neutral" },
    riskAudit: ["Geopolitical escalation"],
    detailedReport: "# Macro Report\n\nResilient expansion observed."
  };

  try {
    const genAI = getAI();
    if (!genAI) return res.json(fallbackData);
    const result = await genAI.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: [{ role: 'user', parts: [{ text: "Elite macro strategist. Analyze current landscape. JSON format. Concise narrative (max 30 words)." }] }],
      config: { responseMimeType: "application/json" }
    });
    const data = JSON.parse(result.text);
    cache[cacheKey] = { data, ts: Date.now() };
    res.json(data);
  } catch (error) { res.json(fallbackData); }
});

app.all('/api/*', (req, res) => res.status(404).json({ error: 'API Not Found' }));

export default app;

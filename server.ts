import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import axios from 'axios';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import * as cheerio from 'cheerio';
import { fetchGexData } from './src/lib/gexEngine';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3000;

// Memory Cache
const cache: Record<string, { data: any; ts: number }> = {};
const CACHE_TTL = 58 * 1000; // 58 seconds
const CHART_CACHE_TTL = 15 * 1000; // 15 seconds for more real-time charts

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

  if (cache[cacheKey] && Date.now() - cache[cacheKey].ts < CACHE_TTL) {
    return res.json(cache[cacheKey].data);
  }

  try {
    const symbolMapping: Record<string, string> = {
      'SPY': 'ES=F',
      'QQQ': 'NQ=F',
      'IWM': 'RTY=F',
    };

    const futuresTicker = symbolMapping[ticker] || 'ES=F';
    
    // Fetch Futures Price
    const futureRes = await axios.get(`https://query2.finance.yahoo.com/v8/finance/chart/${futuresTicker}?interval=1m&range=1d`, { 
      headers: { 'User-Agent': 'Mozilla/5.0' }, 
      timeout: 10000 
    });
    const futureMeta = futureRes.data.chart.result[0].meta;
    const futurePrice = futureMeta.regularMarketPrice || futureMeta.previousClose;

    // Fetch Spot Price (the ETF)
    const spotRes = await axios.get(`https://query2.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1m&range=1d`, { 
      headers: { 'User-Agent': 'Mozilla/5.0' }, 
      timeout: 10000 
    });
    const spotMeta = spotRes.data.chart.result[0].meta;
    const spotPrice = spotMeta.regularMarketPrice || spotMeta.previousClose;

    const ratio = futurePrice / spotPrice;
    const result = { ticker, futuresTicker, ratio, spotPrice, futurePrice, ts: Date.now() };
    
    cache[cacheKey] = { data: result, ts: Date.now() };
    res.json(result);
  } catch (error) {
    console.error('Ratio Fetch Error:', error);
    // Fallback defaults as per request
    const fallbacks: Record<string, number> = { 'SPY': 10.0, 'QQQ': 42.0 };
    res.json({ ticker, ratio: fallbacks[ticker] || 1.0, error: 'Remote fetch failed' });
  }
});

app.get('/api/chain/:symbol', async (req, res) => {
  const { symbol } = req.params;
  const cacheKey = `chain_${symbol}`;

  if (cache[cacheKey] && Date.now() - cache[cacheKey].ts < CACHE_TTL) {
    return res.json(cache[cacheKey].data);
  }

  const FLOQ_URL = (process.env.FLOQ_API_URL || 'https://api.floq.data').replace(/^['"]|['"]$/g, '').trim();

  const symUpper = symbol.toUpperCase();
  const variations = [symUpper];
  if (['SPX', 'NDX', 'RUT', 'VIX'].includes(symUpper)) {
    variations.push(`^${symUpper}`);
  }

  try {
    let floqData = null;
    if (process.env.FLOQ_API_KEY) {
      for (const variant of variations) {
        try {
          const response = await axios.get(`${FLOQ_URL}/chain/${variant}`, {
            headers: { 
              'Authorization': `Bearer ${process.env.FLOQ_API_KEY}`,
              'Accept': 'application/json' 
            },
            timeout: 10000
          });
          if (response.data && response.data.data) {
            floqData = response.data;
            break;
          }
        } catch (e: any) {
          if (e.response?.status !== 404) {
            console.warn(`FLOQ API variation ${variant} failed:`, e.message);
          }
        }
      }
    }

    if (floqData) {
        cache[cacheKey] = { data: floqData, ts: Date.now() };
        return res.json(floqData);
    }
    
    // Fallback to CBOE
    const urls = [
      `https://cdn.cboe.com/api/global/delayed_quotes/options/${symbol.toUpperCase()}.json`,
      `https://cdn.cboe.com/api/global/delayed_quotes/options/_${symbol.toUpperCase()}.json`
    ];

    for (const url of urls) {
      try {
        const response = await axios.get(url, { headers: SYSTEM_HEADERS_A, timeout: 15000 });
        if (response.data && response.data.data && response.data.data.options) {
             cache[cacheKey] = { data: response.data, ts: Date.now() };
             return res.json(response.data);
        }
      } catch (e) {
        continue;
      }
    }
    
    res.status(500).json({ error: 'Failed to fetch chain data' });
  } catch (error) {
    console.error('Chain Fetch Error (FLOQ/CBOE):', error);
    res.status(500).json({ error: 'Failed' });
  }
});

app.get('/api/spot/:ticker', async (req, res) => {
  const { ticker } = req.params;
  const cacheKey = `spot_${ticker}`;

  if (cache[cacheKey] && Date.now() - cache[cacheKey].ts < CACHE_TTL) {
    return res.json({ price: cache[cacheKey].data });
  }

  const FLOQ_URL = (process.env.FLOQ_API_URL || 'https://api.floq.data').replace(/^['"]|['"]$/g, '').trim();

  const symUpper = ticker.toUpperCase();
  const variations = [symUpper];
  if (['SPX', 'NDX', 'RUT', 'VIX'].includes(symUpper)) {
    variations.push(`^${symUpper}`);
  }

  let floqPrice = null;

  try {
    if (process.env.FLOQ_API_KEY) {
      for (const variant of variations) {
        try {
          const response = await axios.get(`${FLOQ_URL}/spot/${variant}`, {
            headers: { 
              'Authorization': `Bearer ${process.env.FLOQ_API_KEY}`,
              'Accept': 'application/json' 
            },
            timeout: 8000
          });
          if (response.data && (response.data.current_price || response.data.price)) {
            floqPrice = parseFloat(response.data.current_price || response.data.price);
            break;
          }
        } catch (e: any) {
           if (e.response?.status !== 404) {
             console.warn(`FLOQ API spot variation ${variant} failed:`, e.message);
           }
        }
      }
    }
    
    if (floqPrice) {
      cache[cacheKey] = { data: floqPrice, ts: Date.now() };
      return res.json({ price: floqPrice });
    }
    
    const response = await axios.get(`https://cdn.cboe.com/api/global/delayed_quotes/options/${ticker.toUpperCase()}.json`, { headers: SYSTEM_HEADERS_A });
    const price = response.data.data.current_price;
    cache[cacheKey] = { data: price, ts: Date.now() };
    res.json({ price });
  } catch (error) {
    res.status(500).json({ error: 'Failed' });
  }
});

app.get('/api/yahoo/chart/:ticker', async (req, res) => {
  const { ticker } = req.params;
  const { interval = '5m', range = '1d' } = req.query;
  
  if (!ticker || ticker === 'undefined') {
    return res.status(400).json({ error: 'Ticker is required' });
  }

  const cacheKey = `chart_${ticker}_${interval}_${range}`;
  if (cache[cacheKey] && Date.now() - cache[cacheKey].ts < CHART_CACHE_TTL) {
    return res.json(cache[cacheKey].data);
  }

  try {
    const symbolMapping: Record<string, string> = {
      'SPY': 'SPY',
      'QQQ': 'QQQ',
      'IWM': 'IWM',
    };
    
    const symbol = symbolMapping[ticker as string] || ticker;
    if (symbol === 'undefined' || !symbol) {
       return res.status(400).json({ error: 'Invalid ticker' });
    }
    
    let url = `https://query2.finance.yahoo.com/v8/finance/chart/${symbol.toUpperCase()}?interval=${interval}&range=${range}`;
    let fetchHeaders: any = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      'Accept': 'application/json, text/plain, */*',
      'Cache-Control': 'no-cache'
    };

    let response;
    try {
      response = await axios.get(url, { 
        headers: fetchHeaders,
        timeout: 10000,
        validateStatus: (status) => status < 500
      });
    } catch (e: any) {
      console.warn(`Yahoo API failed (${e.message || 'Error'}) for ${symbol}`);
      return res.status(500).json({ error: 'Yahoo API threw an exception', message: e.message });
    }

    if (typeof response.data === 'string' && response.data.trim().startsWith('<!')) {
      console.error(`Chart API returned HTML instead of JSON for ${symbol}`);
      return res.status(response.status !== 200 ? response.status : 502).json({ error: 'Returned HTML instead of JSON. Potential block or captcha.' });
    }

    if (response.status !== 200) {
      console.warn(`Chart API returned ${response.status} for ${symbol}`);
      return res.status(response.status).json(typeof response.data === 'object' ? response.data : { error: 'API Error', status: response.status });
    }
    
    // Parse if it came as a string but looks like JSON
    let finalData = response.data;
    if (typeof finalData === 'string' && finalData.trim().startsWith('{')) {
      try { finalData = JSON.parse(finalData); } catch(e) {}
    }

    cache[cacheKey] = { data: finalData, ts: Date.now() };
    res.json(finalData);
  } catch (error: any) {
    console.error('Chart Fetch Error:', error.message);
    res.status(500).json({ 
      error: 'Failed to fetch chart data',
      message: error.message,
      ticker
    });
  }
});

app.get('/api/news', async (req, res) => {
  const cacheKey = 'yahoo_news_ai_v3';
  const force = req.query.force === 'true';

  if (!force && cache[cacheKey] && Date.now() - cache[cacheKey].ts < 3 * 60 * 1000) { // 3 min cache for news
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
          if (r.data && r.data.news) {
             allNews = allNews.concat(r.data.news);
          }
       });
    } catch(e) {
       console.error("Yahoo News Fetch error", e);
    }

    // Deduplicate by UUID
    const uniqueNews = new Map();
    for (const item of allNews) {
        if (!uniqueNews.has(item.uuid)) {
            uniqueNews.set(item.uuid, item);
        }
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

    // Start with default data, send it to client if we time out
    const getHeuristicAnalysis = (title: string) => {
      const lower = title.toLowerCase();
      let posScore = 0;
      let negScore = 0;
      
      const posWords = ['surge', 'up', 'gain', 'buy', 'bull', 'rally', 'beat', 'soar', 'jump', 'upgrade', 'higher', 'growth', 'strong'];
      const negWords = ['plunge', 'down', 'loss', 'sell', 'bear', 'crash', 'miss', 'drop', 'fall', 'downgrade', 'lower', 'weak', 'risk', 'burn', 'cut'];
      
      posWords.forEach(w => { if (lower.includes(w)) posScore++; });
      negWords.forEach(w => { if (lower.includes(w)) negScore++; });
      
      let sentiment = 'Neutral';
      if (posScore > negScore) sentiment = 'Positive';
      if (negScore > posScore) sentiment = 'Negative';

      // Clean description: just the title but shorter if needed, highlighting implication
      let desc = title;
      if (desc.length > 100) desc = desc.substring(0, 97) + '...';
      if (sentiment === 'Positive') desc += ' (Bullish catalyst observed)';
      if (sentiment === 'Negative') desc += ' (Bearish pressure indicated)';

      return { sentiment, desc };
    };

    let enhancedNews = newsData.map((item: any) => {
      const heur = getHeuristicAnalysis(item.title);
      return {
        ...item,
        sentiment: heur.sentiment,
        tickers: item.original_symbols || ['Macro'],
        ai_description: heur.desc
      };
    });

    try {
      const genAI = getAI();
      if (genAI && newsData.length > 0) {
        // Fire logic asynchronously or wait it out? 
        // For speed, let's just do a fast flash request
        const prompt = `You are an elite quantitative analyst. Analyze these headlines and return a JSON array with one object per headline index.

CRITICAL INSTRUCTIONS:
- strictly limit to 1-2 sentences focusing ON 1-2 critical action items or market implications relevant to institutional traders.
- DO NOT mention the news publisher (e.g., "Benzinga", "Yahoo", "Bloomberg") in your description unless they are explicitly mentioned in the article as the primary subject.
- DO NOT default to classifying everything as 'SPY' or 'IWM'. Remove all mentions of 'Benzinga', 'SPY', and 'IWM' unless they are explicitly mentioned in the article as the primary subject. Use specific stock tickers (e.g., 'NVDA', 'AAPL', 'TSLA') if the news implies them. If no specific ticker, use macro ETFs (but avoid SPY and IWM unless explicitly mentioned).
- Focus ONLY on critical action items or pure market implications for institutional flow. Remove all fluff and narrative.

Format per index:
- index: integer
- sentiment: "Positive", "Neutral", or "Negative"
- tickers: Array of 1-3 specific tickers directly affected.
- description: 1-2 ultra-concise sentences. Action items or implications only.

Headlines with context from Yahoo Finance:
` + newsData.map((n: any, i: number) => `${i}: Title: ${n.title} (Related Tickers: ${n.original_symbols.join(', ') || 'None'})`).join('\n');

        const result = await genAI.models.generateContent({
           model: 'gemini-1.5-flash',
           contents: [prompt],
           config: {
              responseMimeType: "application/json",
           }
        });

        const text = result.text;

        if (text) {
           let cleanText = text.trim();
           if (cleanText.startsWith('```json')) cleanText = cleanText.substring(7);
           if (cleanText.startsWith('```')) cleanText = cleanText.substring(3);
           if (cleanText.endsWith('```')) cleanText = cleanText.substring(0, cleanText.length - 3);
           try {
              const aiData = JSON.parse(cleanText.trim());
              enhancedNews = newsData.map((item: any, i: number) => {
                  const analysis = aiData.find((a: any) => a.index === i);
                  if (analysis && analysis.sentiment) {
                      return { 
                        ...item, 
                        sentiment: analysis.sentiment, 
                        tickers: analysis.tickers && analysis.tickers.length > 0 ? analysis.tickers : item.original_symbols, 
                        ai_description: analysis.description 
                      };
                  }
                  return { ...item, sentiment: 'Neutral', ai_description: item.title };
              });
           } catch(e) {
              console.error("Failed to parse Gemini news JSON:", e, cleanText.substring(0, 50));
           }
        }
      }
    } catch (aiError) {
      console.error("Gemini AI Analysis Error:", aiError);
    }

    cache[cacheKey] = { data: enhancedNews, ts: Date.now() };
    res.json(enhancedNews);
  } catch (error) {
    console.error('News Fetch Error:', error);
    res.status(500).json({ error: 'Failed' });
  }
});

app.get('/api/macro/benchmarks', async (req, res) => {
  const cacheKey = 'macro_benchmarks';
  if (cache[cacheKey] && Date.now() - cache[cacheKey].ts < 5 * 60 * 1000) {
    return res.json(cache[cacheKey].data);
  }

  const tickers = {
    'DXY': 'DX-Y.NYB',
    'VIX': '^VIX',
    'US10Y': '^TNX',
    'US2Y': 'US2Y=X',
    'US5Y': '^FVX',
    'US13W': '^IRX',
    'US30Y': '^TYX',
    'GOLD': 'GC=F',
    'COPPER': 'HG=F',
    'OIL': 'CL=F',
    'SPX': '^GSPC',
    'HYG': 'HYG',
    'BTC': 'BTC-USD',
    'ETH': 'ETH-USD'
  };

  const results: any = {};
  
  try {
    const promises = Object.entries(tickers).map(async ([key, symbol]) => {
      try {
        const url = `https://query2.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=5d`;
        const resp = await axios.get(url, { headers: SYSTEM_HEADERS_B, timeout: 5000 });
        const meta = resp.data.chart.result[0].meta;
        const price = meta.regularMarketPrice || meta.previousClose;
        const prevClose = meta.previousClose;
        const change = price - prevClose;
        const changePercent = (change / prevClose) * 100;
        
        results[key] = {
          price,
          change,
          changePercent,
          symbol
        };
      } catch (err) {
        // Last-resort fallback values if Yahoo fails
        const defaults: any = {
           'DXY': 104.2, 'VIX': 14.5, 'US10Y': 4.45, 'US2Y': 4.85, 'BTC': 65000, 'HYG': 77.5
        };
        results[key] = { price: defaults[key] || 0, change: 0, changePercent: 0, error: true };
      }
    });

    await Promise.all(promises);
    
    // Add Yield Spread
    if (results.US10Y && results.US2Y && results.US10Y.price && results.US2Y.price) {
      results['SPREAD_2s10s'] = {
        price: results.US10Y.price - results.US2Y.price,
        change: 0,
        changePercent: 0
      };
    }

    // Add Copper/Gold Ratio
    if (results.COPPER && results.GOLD && results.COPPER.price && results.GOLD.price) {
       results['HG_GC_RATIO'] = {
         price: (results.COPPER.price / results.GOLD.price) * 1000,
         change: 0,
         changePercent: 0
       };
    }

    cache[cacheKey] = { data: results, ts: Date.now() };
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: 'Failed' });
  }
});

app.get('/api/gex', async (req, res) => {
  const { ticker = 'SPY', exps = '1' } = req.query;
  const cacheKey = `gex_data_${ticker}_${exps}`;

  if (!ticker) return res.status(400).json({ error: 'Ticker is required' });

  if (cache[cacheKey] && Date.now() - cache[cacheKey].ts < CACHE_TTL) {
    return res.json(cache[cacheKey].data);
  }

  try {
    const data = await fetchGexData(ticker as string, parseInt(exps as string));
    cache[cacheKey] = { data, ts: Date.now() };
    res.json(data);
  } catch (error: any) {
    console.error('GEX Fetch Error:', error.message);
    res.status(500).json({ error: error.message || 'Failed to fetch GEX data' });
  }
});

// AI Macro Synthesis Endpoint
app.get('/api/macro/synthesis', async (req, res) => {
  const cacheKey = 'macro_synthesis';
  if (cache[cacheKey] && Date.now() - cache[cacheKey].ts < 30 * 60 * 1000) { // 30 min cache
    return res.json(cache[cacheKey].data);
  }

  const fallbackData = {
    regime: "Expansion",
    regimeScore: 65,
    narrative: "Global growth remains resilient led by US services, but sticky inflation keeps central banks cautious. Traders should monitor the 10Y yield for breakouts as a signal for regime shift towards stagflation risk.",
    keyIndicators: [
      { "name": "Real GDP Growth", "status": "Stable", "value": "2.4%", "implication": "Resilient output supporting risk assets." },
      { "name": "Core CPI", "status": "Sticky", "value": "3.7%", "implication": "Prevents immediate pivot to rate cuts." },
      { "name": "Global M2 Flow", "status": "Expanding", "value": "Positive", "implication": "Improving liquidity baseline." },
      { "name": "Systemic Stress", "status": "Normal", "value": "Low", "implication": "No immediate contagion signals." },
      { "name": "Institutional Flow", "status": "Neutral", "value": "Balanced", "implication": "Rotation into value/cyclicals." }
    ],
    sectors: [
      { "name": "Technology", "performance": 1.2, "status": "Leading" },
      { "name": "Energy", "performance": -0.5, "status": "Lagging" },
      { "name": "Healthcare", "performance": 0.3, "status": "Neutral" },
      { "name": "Financials", "performance": 0.8, "status": "Leading" },
      { "name": "Utilities", "performance": -0.2, "status": "Neutral" },
      { "name": "Consumer Disc.", "performance": 0.5, "status": "Neutral" }
    ],
    economicCalendar: [
      { "event": "FOMC Decision", "date": "TBD", "impact": "High", "forecast": "Pause" },
      { "event": "Non-Farm Payrolls", "date": "Friday", "impact": "High", "forecast": "180k" }
    ],
    policyWatch: {
      "fed": "Data-Dependent",
      "action": "Pause",
      "nextMeeting": "Scheduled",
      "quantTightening": "Active"
    },
    assetClassViews: {
      "equities": "Neutral",
      "fixed_income": "Overweight",
      "commodities": "Neutral",
      "forex_carry": "Neutral"
    },
    riskAudit: [
      "Geopolitical escalation in energy corridors.",
      "Fixed rate mortgage reset wave in Europe.",
      "Fiscal deficit sustainability concerns."
    ],
    detailedReport: "# Macro Strategy Report\n\n## Market Regime Analysis\nWe are currently observing a **resilient expansion** characterized by strong labor markets and stabilizing manufacturing PMIs. However, the 'last mile' of inflation remains difficult, suggesting a higher-for-longer rate environment.\n\n## Actionable Trading Keys\n1. **Long Duration** on pullbacks in yields above 4.7% (10Y).\n2. **Sector Rotation**: Focus on Financials and Industrials as growth stabilizes.\n3. **Risk Management**: Maintain hedges in volatility (VIX calls) as systemic risk metrics creep higher."
  };

  try {
    const genAI = getAI();
    if (!genAI) {
      return res.json(fallbackData);
    }

    // Fetch some recent news to give context to the AI
    let newsContext = "";
    try {
      const newsRes = await axios.get('https://query2.finance.yahoo.com/v1/finance/search?q=macro%20economy&newsCount=10', { headers: SYSTEM_HEADERS_A });
      newsContext = newsRes.data.news.map((n: any) => n.title).join('\n');
    } catch {}

    const prompt = `You are a world-class Global Macro Strategist and Quantitative Researcher. Analyze the current global economic landscape based on this context and your internal knowledge.
    
    Context:
    ${newsContext}
    
    Provide a professional-grade macro synthesis report in JSON format. 
    The "narrative" MUST be extremely concise (max 30 words), actionable for a professional trader, and focus on the current regime and its primary drivers.
    The "detailedReport" should be a longer markdown string (300+ words) providing a deep dive for the "View Full Report" section.

    JSON Schema:
    {
      "regime": "Expansion" | "Recession" | "Stagflation" | "Recovery" | "Soft Landing",
      "regimeScore": number (0-100),
      "narrative": "string",
      "keyIndicators": [
        { "name": "string", "status": "string", "value": "string", "implication": "string" }
      ],
      "sectors": [
        { "name": "string", "performance": number, "status": "Leading" | "Lagging" | "Neutral" }
      ],
      "economicCalendar": [
        { "event": "string", "date": "string", "impact": "High" | "Medium" | "Low", "forecast": "string" }
      ],
      "policyWatch": {
        "fed": "Hawkish" | "Dovish" | "Neutral" | "Data-Dependent",
        "action": "Pause" | "Cut" | "Hike",
        "nextMeeting": "string",
        "quantTightening": "Active" | "Pausing" | "Tapering"
      },
      "assetClassViews": {
        "equities": "Overweight" | "Underweight" | "Neutral",
        "fixed_income": "Overweight" | "Underweight" | "Neutral",
        "commodities": "Overweight" | "Underweight" | "Neutral",
        "forex_carry": "string"
      },
      "riskAudit": ["string"],
      "detailedReport": "string (Markdown)"
    }
    
    Strictly return JSON. No markdown blocks.`;

    const result = await genAI.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: [prompt],
      config: { 
        responseMimeType: "application/json"
      }
    });

    const data = JSON.parse(result.text);
    cache[cacheKey] = { data, ts: Date.now() };
    res.json(data);
  } catch (error) {
    console.error('Macro Synthesis Error:', error);
    res.json(fallbackData);
  }
});

// --- VITE MIDDLEWARE ---

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Elite Terminal] Server active at http://localhost:${PORT}`);
  });
}

startServer();

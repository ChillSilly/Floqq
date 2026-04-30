import express from 'express';
import cors from 'cors';
import axios from 'axios';
import { GoogleGenAI, Type } from '@google/genai';
import * as cheerio from 'cheerio';

const app = express();
app.use(cors());
app.use(express.json());

// Memory Cache
const cache: Record<string, { data: any; ts: number }> = {};
const CACHE_TTL = 58 * 1000; // 58 seconds

const SYSTEM_HEADERS_B = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept': 'application/json',
};

const SYSTEM_HEADERS_A = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Referer': 'https://www.google.com/',
  'Origin': 'https://www.google.com/',
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
  const { ticker } = (req.params as any);
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
    const futureRes = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${futuresTicker}?interval=1m&range=1d`, { headers: SYSTEM_HEADERS_B });
    const futureMeta = futureRes.data.chart.result[0].meta;
    const futurePrice = futureMeta.regularMarketPrice || futureMeta.previousClose;

    // Fetch Spot Price (the ETF)
    const spotRes = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1m&range=1d`, { headers: SYSTEM_HEADERS_B });
    const spotMeta = spotRes.data.chart.result[0].meta;
    const spotPrice = spotMeta.regularMarketPrice || spotMeta.previousClose;

    const ratio = futurePrice / spotPrice;
    const result = { ticker, futuresTicker, ratio, spotPrice, futurePrice, ts: Date.now() };
    
    cache[cacheKey] = { data: result, ts: Date.now() };
    res.json(result);
  } catch (error) {
    console.error('Ratio Fetch Error:', error);
    const fallbacks: Record<string, number> = { 'SPY': 10.0, 'QQQ': 42.0 };
    res.json({ ticker, ratio: fallbacks[ticker] || 1.0, error: 'Remote fetch failed' });
  }
});

app.get('/api/chain/:symbol', async (req, res) => {
  const { symbol } = (req.params as any);
  const cacheKey = `chain_${symbol}`;

  if (cache[cacheKey] && Date.now() - cache[cacheKey].ts < CACHE_TTL) {
    return res.json(cache[cacheKey].data);
  }

  try {
    let spotPrice = 0;
    try {
      const spotRes = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol.toUpperCase()}?interval=1m&range=1d`, { headers: SYSTEM_HEADERS_B });
      const spotMeta = spotRes.data.chart.result[0].meta;
      spotPrice = spotMeta.regularMarketPrice || spotMeta.previousClose;
    } catch(err) {
      console.warn("Could not fetch spot price for", symbol, "using fallback.");
    }

    const alpacaKey = process.env.APCA_API_KEY_ID || 'PKP6JPYFGE77PL32QB3DO6WVCH';
    const alpacaSecret = process.env.APCA_API_SECRET_KEY || 'EVKt1FsFqJmWbMyZV4YekUVQYNgBqMPSoNm21b4emruR';
    
    let snapshots: Record<string, any> = {};
    let pageToken = '';
    
    for (let i = 0; i < 3; i++) {
        const url = `https://data.alpaca.markets/v1beta1/options/snapshots/${symbol.toUpperCase()}?feed=indicative&limit=1000` + (pageToken ? `&page_token=${pageToken}` : '');
        try {
           const response = await axios.get(url, {
             headers: {
               'APCA-API-KEY-ID': alpacaKey,
               'APCA-API-SECRET-KEY': alpacaSecret
             }
           });
           
           if (response.data && response.data.snapshots) {
               Object.assign(snapshots, response.data.snapshots);
               pageToken = response.data.next_page_token;
               if (!pageToken) break;
           } else {
               break;
           }
        } catch(e: any) {
           console.error("Alpaca fetch error details:", e?.response?.data || e.message);
           break;
        }
    }

    const options = Object.entries(snapshots).map(([optSymbol, snap]: [string, any]) => {
      return {
         option: optSymbol,
         open_interest: snap.dailyBar?.v || snap.latestTrade?.s || 100,
         iv: snap.impliedVolatility,
         gamma: snap.greeks?.gamma,
         delta: snap.greeks?.delta,
         vega: snap.greeks?.vega,
         volume: snap.dailyBar?.v || 0,
         mark: snap.latestQuote?.ap || 0
      };
    });

    const data = {
       data: {
          current_price: spotPrice,
          options: options
       }
    };

    if (!options.length) {
       throw new Error("No data from Alpaca");
    }

    cache[cacheKey] = { data, ts: Date.now() };
    return res.json(data);
  } catch (error) {
    console.error('Chain Fetch Error (Alpaca):', error);
    try {
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
    } catch(fallbackErr) {}
    
    res.status(500).json({ error: 'Failed to fetch chain data' });
  }
});

app.get('/api/spot/:ticker', async (req, res) => {
  const { ticker } = (req.params as any);
  const cacheKey = `spot_${ticker}`;

  if (cache[cacheKey] && Date.now() - cache[cacheKey].ts < CACHE_TTL) {
    return res.json({ price: cache[cacheKey].data });
  }

  try {
    const response = await axios.get(`https://cdn.cboe.com/api/global/delayed_quotes/options/${ticker.toUpperCase()}.json`, { headers: SYSTEM_HEADERS_A });
    const price = response.data.data.current_price;
    cache[cacheKey] = { data: price, ts: Date.now() };
    res.json({ price });
  } catch (error) {
    res.status(500).json({ error: 'Failed' });
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
       const responses = await Promise.all(urls.map(u => axios.get(u, { headers: SYSTEM_HEADERS_A })));
       responses.forEach(r => {
          if (r.data && r.data.news) {
             allNews = allNews.concat(r.data.news);
          }
       });
    } catch(e) {
       console.error("Yahoo News Fetch error", e);
    }

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
      original_symbols: item.relatedTickers || []
    }));

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
        const prompt = `You are an elite quantitative analyst. Analyze these headlines and return a JSON array with one object per headline index.

CRITICAL INSTRUCTIONS:
- strictly limit to 1-2 sentences focusing ON 1-2 critical action items or market implications relevant to institutional traders.
- DO NOT mention the news publisher (e.g., "Benzinga", "Yahoo", "Bloomberg") in your description unless they are explicitly mentioned in the article as the primary subject.
- DO NOT default to classifying everything as 'SPY' or 'IWM'. Remove all mentions of 'Benzinga', 'SPY', and 'IWM' unless they are explicitly mentioned in the article as the primary subject. Use specific stock tickers (e.g., 'NVDA', 'AAPL', 'TSLA') if the news implies them. If no specific ticker, use macro ETFs (but avoid SPY and IWM unless explicitly mentioned).
- Focus ONLY on critical action items or pure market implications for institutional flow. Remove all fluff and narrative.

Headlines with context from Yahoo Finance:
` + newsData.map((n: any, i: number) => `${i}: Title: ${n.title} (Related Tickers: ${n.original_symbols.join(', ') || 'None'})`).join('\n');

        const result = await genAI.models.generateContent({
           model: 'gemini-3-flash-preview',
           contents: [{ role: 'user', parts: [{ text: prompt }] }],
           config: {
              responseMimeType: "application/json",
           }
        });

        const aiText = result.text;
        if (aiText) {
           let cleanText = aiText.trim();
           try {
              const aiData = JSON.parse(cleanText);
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
           } catch(e) {}
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

export default app;

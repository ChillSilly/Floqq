import express from 'express';
import cors from 'cors';
import axios from 'axios';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3000;

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

  try {
    // Try both URL formats as in Python script
    const urls = [
      `https://cdn.cboe.com/api/global/delayed_quotes/options/${symbol.toUpperCase()}.json`,
      `https://cdn.cboe.com/api/global/delayed_quotes/options/_${symbol.toUpperCase()}.json`
    ];

    let data = null;
    for (const url of urls) {
      try {
        const response = await axios.get(url, { headers: SYSTEM_HEADERS_A, timeout: 15000 });
        if (response.data && response.data.data && response.data.data.options) {
          data = response.data;
          break;
        }
      } catch (e) {
        continue;
      }
    }

    if (!data) throw new Error('Could not fetch options chain data');

    cache[cacheKey] = { data, ts: Date.now() };
    res.json(data);
  } catch (error) {
    console.error('Chain Fetch Error:', error);
    res.status(500).json({ error: 'Failed to fetch chain data' });
  }
});

app.get('/api/spot/:ticker', async (req, res) => {
  const { ticker } = req.params;
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
  const cacheKey = 'finviz_news_ai_v1';

  if (cache[cacheKey] && Date.now() - cache[cacheKey].ts < 3 * 60 * 1000) { // 3 min cache for news
    return res.json(cache[cacheKey].data);
  }

  try {
    const auth = '4523f960-91b2-406a-99f4-b8b7e3f5ca1f';
    const url = `https://elite.finviz.com/news_export?v=1&auth=${auth}`;
    
    const response = await axios.get(url, { responseType: 'text' });
    const rows = response.data.trim().split('\n');
    
    // Finviz CSV format for news export: Date,Title,Link,Source
    const newsData = rows.slice(1).map(row => {
      // Simple regex for CSV parsing to handle quoted strings with commas
      const matches = row.match(/(".*?"|[^,]+)/g) || [];
      const clean = (val: string) => val ? val.replace(/^"|"$/g, '').trim() : '';
      
      return {
        date: clean(matches[0]),
        title: clean(matches[1]),
        url: clean(matches[2]),
        source: clean(matches[3])
      };
    }).filter(n => n.title && n.url).slice(0, 30); // limit to top 30 for AI analysis

    let enhancedNews = newsData;

    try {
      const genAI = getAI();
      if (genAI) {
        const prompt = `Analyze these financial news headlines for their impact on the options market.
For each index, provide:
- sentiment: "Positive", "Neutral", "Negative"
- tickers: an array of 1-4 highly liquid options tickers affected (e.g., ["SPY", "QQQ"], ["NVDA"], ["IWM"]). If none are obvious based on the headline, use ["SPY"].
- description: A comprehensive, highly detailed 3-4 sentence explanation. You MUST explicitly explain how the news affects the specific options tickers you listed. You MUST include expected sentiment and direction, potential implied volatility (IV) shifts (e.g., expanding or contracting), and specific actions market makers or institutional flow are likely taking (e.g., selling calls, delta hedging, rolling puts).

Headlines:
` + newsData.map((n, i) => `${i}: ${n.source} - ${n.title}`).join('\n');

        const result = await genAI.models.generateContent({
           model: 'gemini-3-flash-preview',
           contents: prompt,
           config: {
              responseMimeType: "application/json",
              responseSchema: {
                 type: Type.ARRAY,
                 items: {
                    type: Type.OBJECT,
                    properties: {
                       index: { type: Type.INTEGER },
                       sentiment: { type: Type.STRING, enum: ["Positive", "Neutral", "Negative"] },
                       tickers: { type: Type.ARRAY, items: { type: Type.STRING } },
                       description: { type: Type.STRING }
                    },
                    required: ["index", "sentiment", "tickers", "description"]
                 }
              }
           }
        });

        if (result.text) {
           const aiData = JSON.parse(result.text);
           enhancedNews = newsData.map((item, i) => {
               const analysis = aiData.find((a: any) => a.index === i);
               if (analysis) {
                   return { ...item, sentiment: analysis.sentiment, tickers: analysis.tickers, ai_description: analysis.description };
               }
               return item;
           });
        }
      }
    } catch (aiError) {
      console.error("Gemini AI Analysis Error:", aiError);
      // fallback to un-enhanced if AI fails
    }

    cache[cacheKey] = { data: enhancedNews, ts: Date.now() };
    res.json(enhancedNews);
  } catch (error) {
    console.error('News Fetch Error:', error);
    res.status(500).json({ error: 'Failed' });
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

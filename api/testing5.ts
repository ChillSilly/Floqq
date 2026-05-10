import axios from 'axios';
const SYSTEM_HEADERS_B = {};
const TICKER_CORRELATIONS: any = {
  'DIA': ['^DJI', 'DOW JONES', 'DOW', 'IWM', 'SPY', 'BLUE CHIP'],
};
const tickerStr = 'DIA';
const tickerMapping: any = {
  'US30': 'Dow Jones Industrial Average',
  'YM': 'Dow Jones futures',
  'DIA': 'Dow Jones Industrial Average ETF',
  'NQ': 'Nasdaq 100',
  'ES': 'S&P 500 futures',
  'SPY': 'SP500 ETF',
  'QQQ': 'Nasdaq ETF'
};

async function test() {
    const expandedSearch = tickerMapping[tickerStr] || tickerStr;

    let queries = tickerStr 
      ? [
          tickerStr, 
          expandedSearch !== tickerStr ? expandedSearch : `${tickerStr} stock`
        ]
      : ['US equities', 'stock market today'];
    
    // Add correlated queries if ticker provided taking top 2
    if (tickerStr && TICKER_CORRELATIONS[tickerStr]) {
      const correlated = TICKER_CORRELATIONS[tickerStr].slice(0, 2);
      correlated.forEach((c: any) => {
        queries.push(c);
      });
    }
      
    const uniqueNews = new Map();
    
    await Promise.all(queries.map(async (q) => {
      try {
        const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=0&newsCount=15`;
        const r = await axios.get(url, { headers: SYSTEM_HEADERS_B, timeout: 8000 });
        if (r.data && r.data.news) {
          r.data.news.forEach((item: any) => {
            if (!uniqueNews.has(item.uuid)) uniqueNews.set(item.uuid, item);
          });
        }
      } catch(e: any) {
        console.error(`Yahoo News Fetch error for query: ${q}`, e.message);
      }
    }));

    const mergedNews = Array.from(uniqueNews.values())
        .sort((a: any, b: any) => b.providerPublishTime - a.providerPublishTime)
        .slice(0, 40);

    const newsData = mergedNews.map((item: any) => {
      const foundTickers = new Set<string>();
      if (item.relatedTickers) item.relatedTickers.forEach((t: string) => foundTickers.add(t.toUpperCase()));
      return {
        uuid: item.uuid,
        title: item.title,
        tickers: Array.from(foundTickers).slice(0, 8),
        summary: item.summary || item.title
      };
    });

    const finalNews = newsData.filter(item => {
      if (!tickerStr) return true;
      const correlates = TICKER_CORRELATIONS[tickerStr] || [];
      const relevantKeywords = [tickerStr, ...correlates];
      
      const text = (item.title + ' ' + (item.summary || '')).toUpperCase();
      const mentionsRelevance = relevantKeywords.some(keyword => text.includes(keyword.toUpperCase()));
      const hasRelatedTicker = item.tickers.some((t: string) => relevantKeywords.includes(t));

      return mentionsRelevance || hasRelatedTicker;
    });

    console.log("Final News Length:", finalNews.length);
}
test();

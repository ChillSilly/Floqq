import axios from 'axios';
const TICKER_CORRELATIONS: any = {
  'DIA': ['^DJI', 'DOW JONES', 'DOW', 'IWM', 'SPY', 'BLUE CHIP'],
};
const tickerStr = 'DIA';

async function test() {
  const q = 'DIA';
  const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=0&newsCount=15`;
  const r = await axios.get(url);
  const arr = r.data.news;

  const newsData = arr.map((item: any) => {
    const foundTickers = new Set<string>();
    if (item.relatedTickers) item.relatedTickers.forEach((t: string) => foundTickers.add(t.toUpperCase()));
    return {
      title: item.title,
      summary: item.summary,
      tickers: Array.from(foundTickers)
    };
  });

  const finalNews = newsData.filter((item: any) => {
    const correlates = TICKER_CORRELATIONS[tickerStr] || [];
    const relevantKeywords = [tickerStr, ...correlates];
    
    // Check word boundaries to avoid 'DOWNLOAD' matching 'DOW'
    const titleAndSummary = (item.title + ' ' + (item.summary || '')).toUpperCase();
    
    // A simple regex word boundary check might be better
    const mentionsRelevance = relevantKeywords.some((keyword: string) => {
       const regex = new RegExp(`\\b${keyword.replace('^', '\\^')}\\b`, 'i');
       return regex.test(titleAndSummary);
    });
    
    const hasRelatedTicker = item.tickers.some((t: string) => relevantKeywords.includes(t));

    return mentionsRelevance || hasRelatedTicker;
  });

  console.log("Filtered Length:", finalNews.length);
  console.log("Original Length:", newsData.length);
}
test();

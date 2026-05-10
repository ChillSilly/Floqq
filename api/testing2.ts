import axios from 'axios';
const SYSTEM_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
};

async function test() {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/DIA?interval=1d&range=1d`; // Wait, no, we want news.
  
  // What about Yahoo's feeds? Or RSS? 
  // Let's test Yahoo's news endpoint.
  // There's a hidden news endpoint used by chart: query.finance.yahoo.com/v2/finance/news
  const feedUrl = `https://query2.finance.yahoo.com/v2/finance/news?symbols=DIA`;
  try {
    const r = await axios.get(feedUrl, { headers: SYSTEM_HEADERS });
    console.log(r.data.news ? r.data.news.map(n => n.title) : 'No news field');
  } catch(e) { console.log(e.message); }
}
test();

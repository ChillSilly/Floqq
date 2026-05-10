import axios from 'axios';
const SYSTEM_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
};

async function test() {
  const url = `https://query2.finance.yahoo.com/v1/finance/search?q=DIA&quotesCount=0&newsCount=15`;
  try {
    const r = await axios.get(url, { headers: SYSTEM_HEADERS });
    console.log(r.data.news.map(n => n.title));
  } catch(e) { console.log(e.message); }
}
test();

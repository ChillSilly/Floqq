import axios from 'axios';
axios.get('https://query2.finance.yahoo.com/v1/finance/search?q=SPY&quotesCount=0&newsCount=5', {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
  }
}).then(r => console.log(JSON.stringify(r.data.news, null, 2))).catch(e => console.error(e.message));

const axios = require('axios');
(async () => {
  try {
    const res = await axios.get('https://query2.finance.yahoo.com/v1/finance/search?q=DIA&quotesCount=0&newsCount=5');
    console.log(res.data.news.map(n => n.title).join('\n'));
  } catch (e) {
    console.log(e.message);
  }
})();

import axios from 'axios';
async function test() {
   try {
       const u = 'https://query2.finance.yahoo.com/v1/finance/search?q=financial%20news&quotesCount=0&newsCount=5';
       const r = await axios.get(u, { headers: { 'User-Agent': 'Mozilla/5.0' } });
       if (r.data?.news) {
           console.log(r.data.news[0].link);
       }
   } catch(e) { console.error(e) }
}
test();

import https from 'https';
import * as cheerio from 'cheerio';

const url = 'https://finance.yahoo.com/m/99dec080-95c0-3889-8f8c-0e142514c0b1/nebraska-lottery-results%3A-see.html';

async function test() {
   try {
      const html: string = await new Promise((resolve, reject) => {
         https.get(url, { maxHeaderSize: 1048576 * 2, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }, (res) => {
            console.log("Status:", res.statusCode);
            console.log("Location:", res.headers.location);
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
         }).on('error', reject);
      });
      console.log('Fetched HTML length:', html.length);
      const $ = cheerio.load(html);
      let text = $('article').text();
      console.log('Article text length:', text.length);
   } catch(e) {
      console.error(e);
   }
}
test();

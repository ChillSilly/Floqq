import https from 'https';

async function fetchCboeStat() {
  const url = 'https://cdn.cboe.com/api/global/us_indices/daily_prices/VIX_History.csv'; 
  console.log('We may need to discover the api endpoint for the market stats...');
  
  const urls = [
    'https://cdn.cboe.com/api/global/exchange/market_statistics/',
    'https://cdn.cboe.com/api/global/us_options/market_statistics/',
    'https://www.cboe.com/markets/us/options/market-statistics/data/',
    'https://cdn.cboe.com/api/global/market_statistics/',
  ];
  for (const u of urls) {
    try {
      const r = await fetch(u);
      console.log(u, r.status);
    } catch(e) { }
  }
}
fetchCboeStat();

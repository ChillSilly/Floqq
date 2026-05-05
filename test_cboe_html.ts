async function checkPage() {
  const r = await fetch('https://www.cboe.com/markets/us/options/market-statistics/');
  const text = await r.text();
  const ratioIdx = text.indexOf('ratio');
  const marketStatsIdx = text.indexOf('totalVolume');
  console.log('ratio?', ratioIdx, text.slice(Math.max(0, ratioIdx-100), ratioIdx+100));
  
  const m = text.match(/https:\/\/cdn.cboe.com\/api\/[a-zA-Z0-9.\/_:-]*/g);
  if(m) console.log('Found APIs:', new Set(m));
}
checkPage();

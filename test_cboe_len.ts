import fs from 'fs';
async function testCboe() {
  const r = await fetch('https://cdn.cboe.com/api/global/delayed_quotes/options/_SPX.json');
  const d = await r.json();
  const options = d.data.options;
  
  const expirations = new Set();
  const strikes = new Set();
  options.forEach((o: any) => {
    const match = o.option.match(/(\d{6})[CP](\d{8})/);
    if(match) {
      expirations.add(match[1]);
      strikes.add(parseInt(match[2])/1000);
    }
  });
  console.log(`Total Options: ${options.length}`);
  console.log(`Unique Expirations: ${expirations.size}`);
  console.log(`Unique Strikes: ${strikes.size}`);
  
  // Save specific strikes for a specific expiration for inspection
  const sortedExps = [...expirations].sort();
  const exp0 = sortedExps[0];
  const nearOpts = options.filter((o: any) => o.option.includes(exp0 as string));
  console.log(`Options for ${exp0}: ${nearOpts.length}`);
}
testCboe();

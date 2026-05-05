import { bsGamma } from './src/lib/blackScholes';
async function run() {
  const r = await fetch('https://cdn.cboe.com/api/global/delayed_quotes/options/_SPX.json');
  const d = await r.json();
  const options = d.data.options;
  const spot = d.data.current_price;
  
  for(let i=0; i<options.length; i++) {
    const o = options[i];
    const match = o.option.match(/(\d{6})([CP])(\d{8})/);
    if(match) {
      const strike = parseInt(match[3], 10)/1000;
      if(strike >= spot - 15 && strike <= spot + 15) {
        console.log(`Strike ${strike}: cboe gamma = ${o.gamma}, bsGamma = ${bsGamma(spot, strike, 5/365, 0.05, 0.01, parseFloat(o.iv))}`);
      }
    }
  }
}
run();

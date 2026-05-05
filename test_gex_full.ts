import { fetchGexData } from './src/lib/gexEngine';
fetchGexData('SPX', 99).then(data => {
  const spot = data.spot;
  const agg = data.agg;
  console.log('Spot', spot);
  for(let i=0; i<agg.length; i++) {
    if(agg[i].strike > spot - 20 && Math.abs(agg[i].strike - spot) < 20) {
      console.log(`Strike: ${agg[i].strike}, Net GEX: ${agg[i].gex_net.toFixed(2)}, Call OI: ${agg[i].call_oi}, Put OI: ${agg[i].put_oi}`);
    }
  }
}).catch(console.error);

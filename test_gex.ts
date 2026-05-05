import { fetchGexData } from './src/lib/gexEngine';
fetchGexData('SPX', 4).then(data => {
  const spot = data.spot;
  const agg = data.agg;
  console.log('Spot', spot);
  for(let i=0; i<agg.length; i++) {
    if(agg[i].strike > spot - 50 && Math.abs(agg[i].strike - spot) < 50) {
      console.log(`Strike: ${agg[i].strike}, Net GEX: ${agg[i].gex_net}, Call OI: ${agg[i].call_oi}, Put OI: ${agg[i].put_oi}, Call Vol: ${agg[i].call_vol_gex}, IV: ${agg[i].iv}`);
    }
  }
}).catch(console.error);

import { fetchGexData } from './src/lib/gexEngine.js'; // Use .ts extension or import? 
// No, I'll just write a quick script that uses the data directly.
async function test() {
  const res = await fetch('http://localhost:3000/api/gex?ticker=QQQ&exps=30');
  const text = await res.text();
  if (text.startsWith('<!')) { console.error("HTML error from API!"); return; }
  const data = JSON.parse(text);
  if (data.agg) {
    const max = data.agg.reduce((m, a) => Math.max(m, Math.abs(a.gex_net)), 0);
    console.log("Max GEX:", max);
    const m2 = data.agg.sort((a,b) => Math.abs(b.gex_net) - Math.abs(a.gex_net));
    console.log("Top 5 GEX strikes:", m2.slice(0,5).map(o => ({ strike: o.strike, gex_net: o.gex_net })));
  } else {
    console.log(data);
  }
}
test();

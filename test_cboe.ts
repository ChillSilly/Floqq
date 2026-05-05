async function fetchCboe() {
  const r = await fetch('https://cdn.cboe.com/api/global/delayed_quotes/options/_SPX.json');
  const txt = await r.text();
  const data = JSON.parse(txt).data;
  const spot = data.current_price;
  console.log('Spot:', spot);
  const options = data.options;
  // let's parse the strike from the option string like SPX260515C07200000 -> 7200
  // String is: SPX + YYMMDD + C/P + 07200000 (which is 07200.000)
  
  const optionsWithStrike = options.map((o: any) => {
    // 012345678901234567
    // SPX260515C07200000
    // SPXW2605...
    const match = o.option.match(/([A-Z]+)(\d{6})([CP])(\d{8})/);
    if (!match) return null;
    const strike = parseInt(match[4], 10) / 1000;
    return { ...o, strike, type: match[3] };
  }).filter(Boolean);
  
  const atmOptions = optionsWithStrike.filter((o: any) => Math.abs(o.strike - spot) < 50);
  console.log('Found ATM options:', atmOptions.length);
  console.log(atmOptions.slice(0, 2));
}
fetchCboe();

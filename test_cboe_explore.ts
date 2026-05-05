async function explore() {
  const urls = [
    'https://cdn.cboe.com/api/global/delayed_quotes/quotes/_SPX.json',
    'https://cdn.cboe.com/api/global/delayed_quotes/options/_SPX.json',
    'https://www.cboe.com/api/global/delayed_quotes/options/_SPX.json'
  ];
  for (const u of urls) {
    try {
      console.log('fetching', u);
      const r = await fetch(u);
      if (r.ok) console.log(r.status, (await r.text()).slice(0, 100));
      else console.log(r.status);
    } catch(e) { console.error(e) }
  }
}
explore();

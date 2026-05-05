async function test() {
  try {
    const res = await fetch('https://cdn.cboe.com/api/global/delayed_quotes/options/QQQ.json');
    const text = await res.text();
    console.log("Status:", res.status);
    console.log("Text length:", text.length);
    console.log("Text start:", text.substring(0, 50));
    try {
      const data = JSON.parse(text);
      console.log('Spot:', data.data.current_price);
      console.log('Options length:', data.data.options.length);
      console.log('First option:', data.data.options[0]);
    } catch(e) {
      console.error("JSON parse failed");
    }
  } catch(e) {
    console.error(e);
  }
}
test();

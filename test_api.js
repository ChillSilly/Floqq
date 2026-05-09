async function test() {
  try {
    console.log("Fetching /api/gex...");
    const res = await fetch('http://localhost:3000/api/gex?ticker=SPY');
    console.log("Status:", res.status);
    console.log("Text:", (await res.text()).substring(0, 200));
  } catch (e) {
    console.error("Fetch 1 failed:", e);
  }
  
  try {
    console.log("Fetching /api/yahoo/chart/SPY...");
    const res2 = await fetch('http://localhost:3000/api/yahoo/chart/SPY?interval=1m&range=1d');
    console.log("Status:", res2.status);
    console.log("Text:", (await res2.text()).substring(0, 200));
  } catch (e) {
    console.error("Fetch 2 failed:", e);
  }
}

test();

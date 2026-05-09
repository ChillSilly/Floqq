async function test() {
  try {
    console.log("Fetching /api/health...");
    const resH = await fetch('http://localhost:3000/api/health');
    console.log("Health Status:", resH.status);
    console.log("Health Text:", await resH.text());
  } catch (e) {
    console.error("Health Fetch failed:", e);
  }

  try {
    console.log("Fetching /api/v1/options-data?ticker=SPY...");
    const res = await fetch('http://localhost:3000/api/v1/options-data?ticker=SPY');
    console.log("Status:", res.status);
    console.log("Content-Type:", res.headers.get('content-type'));
    const text = await res.text();
    console.log("Text snapshot:", text.substring(0, 200));
  } catch (e) {
    console.error("Fetch failed:", e);
  }
}

test();

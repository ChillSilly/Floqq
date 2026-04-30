const axios = require('axios');

async function testAlpaca() {
  try {
    const url = 'https://data.alpaca.markets/v1beta1/options/snapshots/SPY?feed=indicative&limit=5';
    const response = await axios.get(url, {
      headers: {
        'APCA-API-KEY-ID': 'PKP6JPYFGE77PL32QB3DO6WVCH',
        'APCA-API-SECRET-KEY': 'EVKt1FsFqJmWbMyZV4YekUVQYNgBqMPSoNm21b4emruR'
      }
    });
    console.log("Success with indicative:");
    console.log(JSON.stringify(response.data, null, 2));
  } catch (err) {
    console.error("Error indicative:", err.response ? err.response.data : err.message);
  }
}

testAlpaca();

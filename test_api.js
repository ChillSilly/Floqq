const axios = require("axios");

async function test() {
  try {
    const res = await axios.get("http://localhost:3000/api/chain/SPY");
    console.log(res.data);
  } catch (err) {
    console.error(err.response ? err.response.data : err.message);
  }
}

test();

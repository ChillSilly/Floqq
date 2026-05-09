import http from 'http';
http.get('http://localhost:3000/api/v1/options-data?ticker=SPY&exps=1', (res) => {
  let data = '';
  console.log('Status:', res.statusCode);
  console.log('Headers:', res.headers);
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('Body:', data.substring(0, 500)));
});

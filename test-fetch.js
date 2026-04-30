import http from 'http';

['/api/ratio/SPY', '/api/spot/SPY', '/api/chain/SPY', '/api/news'].forEach(path => {
  http.get({
    hostname: 'localhost',
    port: 3000,
    path: path
  }, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        JSON.parse(data);
        console.log(`Success ${path}: ✅ ${data.substring(0, 50)}`);
      } catch (e) {
        console.log(`Failed ${path}: ❌ (Status: ${res.statusCode}) - ${data.substring(0, 100)}`);
      }
    });
  }).on('error', err => console.log('Error', path, err.message));
});

const url = 'http://localhost:3000/api/analyze-article';
const run = async () => {
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: 'https://finance.yahoo.com/news/stock-market-news-today-april-29-2024.html' })
        });
        const text = await res.text();
        console.log(res.status, text);
    } catch(e) {
        console.error(e);
    }
}
run();

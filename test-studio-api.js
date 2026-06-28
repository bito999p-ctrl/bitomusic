async function test() {
  const playlistId = '7cff9e0c-6e73-40be-b1a4-1a8a9d3e4ae4';
  const urls = [
    `https://studio-api.suno.ai/v1/playlist/${playlistId}`,
    `https://studio-api.suno.ai/v1/playlist/${playlistId}/?page=1`,
    `https://studio-api.suno.ai/v1/playlist/${playlistId}/clips`,
    `https://studio-api.suno.ai/v1/playlist/${playlistId}/?page=2`
  ];

  for (const url of urls) {
    console.log(`\nFetching: ${url}`);
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      console.log('Status:', res.status);
      const text = await res.text();
      console.log('Content snippet (100 chars):', text.slice(0, 150));
    } catch(err) {
      console.error('Error:', err.message);
    }
  }
}
test();

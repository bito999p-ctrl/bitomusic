async function test() {
  const playlistId = '7cff9e0c-6e73-40be-b1a4-1a8a9d3e4ae4';
  const urls = [
    `https://suno.com/api/playlist/${playlistId}`,
    `https://suno.com/api/playlist/${playlistId}/clips`,
    `https://suno.com/api/playlist/${playlistId}/?page=2`,
    `https://suno.com/playlist/${playlistId}?page=2`,
    `https://suno.com/playlist/${playlistId}/?page=2`
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
      console.log('Content snippet (150 chars):', text.slice(0, 150));
      
      // If status is 200, check if we find "audio_url" or "id"
      if (res.status === 200) {
        console.log('Contains "audio_url":', text.includes('audio_url'));
        // Find how many UUIDs
        const uuids = text.match(/[a-f0-9\-]{36}/gi) || [];
        console.log('Total UUIDs found:', uuids.length);
      }
    } catch(err) {
      console.error('Error:', err.message);
    }
  }
}
test();

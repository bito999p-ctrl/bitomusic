async function test() {
  const url = 'https://suno.com/playlist/7cff9e0c-6e73-40be-b1a4-1a8a9d3e4ae4';
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  });
  const html = await res.text();
  
  // Count matches of cdn1.suno.ai/UUID.mp3
  const regex = /https:\/\/cdn1\.suno\.ai\/[a-f0-9\-]{36}\.mp3/gi;
  const matches = html.match(regex) || [];
  const uniqueMatches = new Set(matches);
  
  console.log(`Total mp3 URLs found in raw HTML: ${matches.length}`);
  console.log(`Unique mp3 URLs found: ${uniqueMatches.size}`);
}
test();

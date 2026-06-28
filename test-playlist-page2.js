async function test() {
  const playlistId = '7cff9e0c-6e73-40be-b1a4-1a8a9d3e4ae4';
  
  const getTracks = async (url) => {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    const html = await res.text();
    
    // Extract Next.js pushes
    let pos = 0;
    const pushes = [];
    while (true) {
      const idx = html.indexOf('self.__next_f.push(', pos);
      if (idx === -1) break;

      let braceCount = 0;
      let endIdx = -1;
      let inString = false;
      let quoteChar = null;
      let escaped = false;
      const startIdx = idx + 'self.__next_f.push('.length;

      for (let i = startIdx; i < html.length; i++) {
        const char = html[i];
        if (escaped) {
          escaped = false;
          continue;
        }
        if (char === '\\') {
          escaped = true;
          continue;
        }
        if (inString) {
          if (char === quoteChar) {
            inString = false;
          }
        } else {
          if (char === '"' || char === "'") {
            inString = true;
            quoteChar = char;
          } else if (char === '(' || char === '[') {
            braceCount++;
          } else if (char === ')' || char === ']') {
            braceCount--;
            if (braceCount === 0) {
              endIdx = i;
              break;
            }
          }
        }
      }

      if (endIdx !== -1) {
        const argStr = html.slice(startIdx, endIdx + 1);
        const commaIdx = argStr.indexOf(',');
        if (commaIdx !== -1) {
          let strVal = argStr.slice(commaIdx + 1).trim();
          if (strVal.endsWith(']')) {
            strVal = strVal.slice(0, -1).trim();
          }
          if ((strVal.startsWith('"') && strVal.endsWith('"')) || (strVal.startsWith("'") && strVal.endsWith("'"))) {
            strVal = strVal.slice(1, -1);
            let jsString = '"' + strVal.replace(/(^"|"$)/g, '') + '"';
            try {
              const decoded = JSON.parse(jsString);
              pushes.push(decoded);
            } catch (err) {
              let unescaped = strVal.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
              pushes.push(unescaped);
            }
          }
        }
        pos = endIdx + 1;
      } else {
        pos = idx + 1;
      }
    }

    const combined = pushes.join('');
    const seenTrackIds = new Set();
    const seenAudioUrls = new Set();
    const idRegex = /"id"\s*:\s*"([a-f0-9\-]{36})"/gi;
    let idMatch;
    const tracks = [];

    while ((idMatch = idRegex.exec(combined)) !== null) {
      const uuid = idMatch[1];
      if (seenTrackIds.has(uuid)) continue;

      let startIdx = -1;
      let braceLevel = 0;
      for (let i = idMatch.index; i >= 0; i--) {
        if (combined[i] === '}') braceLevel++;
        else if (combined[i] === '{') {
          if (braceLevel === 0) {
            startIdx = i;
            break;
          } else {
            braceLevel--;
          }
        }
      }

      if (startIdx !== -1) {
        let braceCount = 0;
        let endIdx = -1;
        for (let i = startIdx; i < combined.length; i++) {
          if (combined[i] === '{') braceCount++;
          else if (combined[i] === '}') {
            braceCount--;
            if (braceCount === 0) {
              endIdx = i;
              break;
            }
          }
        }

        if (endIdx !== -1) {
          const objStr = combined.slice(startIdx, endIdx + 1);
          const titleMatch = objStr.match(/"title"\s*:\s*"([^"]+)"/i);
          if (titleMatch) {
            const audioMatch = objStr.match(/"audio_url"\s*:\s*"([^"]+)"/i);
            const audio_url = audioMatch ? audioMatch[1] : `https://cdn1.suno.ai/${uuid}.mp3`;
            
            if (seenAudioUrls.has(audio_url)) continue;
            
            seenTrackIds.add(uuid);
            seenAudioUrls.add(audio_url);
            tracks.push(titleMatch[1]);
          }
        }
      }
    }
    return tracks;
  };

  console.log('Fetching Page 1...');
  const p1 = await getTracks(`https://suno.com/playlist/${playlistId}`);
  console.log(`Page 1 tracks count: ${p1.length}`);
  console.log('First 5:', p1.slice(0, 5));
  console.log('Last 5:', p1.slice(-5));

  console.log('\nFetching Page 2 (with ?page=2)...');
  const p2 = await getTracks(`https://suno.com/playlist/${playlistId}?page=2`);
  console.log(`Page 2 tracks count: ${p2.length}`);
  console.log('First 5:', p2.slice(0, 5));
  console.log('Last 5:', p2.slice(-5));
}
test();

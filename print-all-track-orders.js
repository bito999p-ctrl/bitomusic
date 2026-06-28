async function test() {
  const url = 'https://suno.com/@bito999?page=songs';
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
    const startIdx = idx + 'self.__next_f.push('.length;

    for (let i = startIdx; i < html.length; i++) {
      if (html[i] === '(' || html[i] === '[') braceCount++;
      else if (html[i] === ')' || html[i] === ']') {
        braceCount--;
        if (braceCount === 0) {
          endIdx = i;
          break;
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

  // Extract tracks as we do in server.js
  const tracks = [];
  const seenTrackIds = new Set();
  const seenAudioUrls = new Set();
  const idRegex = /"id"\s*:\s*"([a-f0-9\-]{36})"/gi;
  let idMatch;

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
          
          const title = titleMatch[1];
          const createdMatch = objStr.match(/"created_at"\s*:\s*"([^"]+)"/i);
          const created_at = createdMatch ? createdMatch[1] : '';

          tracks.push({
            id: uuid,
            title,
            created_at,
            indexInCombined: idMatch.index
          });
        }
      }
    }
  }

  console.log('UNSORTED tracks in order of appearance in combined:');
  tracks.forEach((t, i) => {
    console.log(`[${i}] Title: ${t.title} | Created At: ${t.created_at} | Index: ${t.indexInCombined}`);
  });
}
test();

async function test() {
  const url = 'https://suno.com/playlist/7cff9e0c-6e73-40be-b1a4-1a8a9d3e4ae4';
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
  const seenIds = new Set();
  const regex = /[a-f0-9\-]{36}/gi;
  let match;
  while ((match = regex.exec(combined)) !== null) {
    seenIds.add(match[0]);
  }
  console.log(`Total UUIDs in RSC: ${seenIds.size}`);
  console.log('Sample UUIDs in RSC:', Array.from(seenIds).slice(0, 10));
}
test();

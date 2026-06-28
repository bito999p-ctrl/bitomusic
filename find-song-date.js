async function findSong() {
  const url = 'https://suno.com/@bito999?page=songs';
  console.log(`Fetching profile: ${url}`);
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  });
  const html = await res.text();
  
  // Extract self.__next_f.push
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
  
  // Look for all instances of "君の話は"
  const songName = '君の話は';
  let sPos = 0;
  while (true) {
    const idx = combined.indexOf(songName, sPos);
    if (idx === -1) break;
    console.log(`Found "${songName}" at index ${idx}`);
    // Print 500 characters around it
    console.log(combined.slice(Math.max(0, idx - 100), idx + 2500));
    sPos = idx + 1;
    break; // Just print the first match
  }
}
findSong();

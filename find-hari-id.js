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
  
  const songName = '帰宅即ハリネズミ';
  const songIdx = combined.indexOf(songName);
  if (songIdx !== -1) {
    console.log(`Found "${songName}" in combined payload. Context:`);
    const context = combined.slice(Math.max(0, songIdx - 400), songIdx + 1600);
    console.log(context);
    
    // Check if there is any "$5f" or similar near "prompt"
    const promptMatch = context.match(/"prompt"\s*:\s*"([^"]+)"/i);
    if (promptMatch) {
      const ref = promptMatch[1];
      console.log(`\nMatched prompt value: "${ref}"`);
      
      const key = ref.replace(/^\$L?/, '');
      console.log(`Searching for key: "${key}"`);
      
      // Let's search for the key definition in combined!
      // In Next.js RSC, a variable definition is usually:
      // "5f":"..." or 5f:"..."
      // Let's do a regex search for the key definition:
      const defRegex = new RegExp(`(?:\\b${key}\\b|"${key}")\\s*:\\s*"([^"]+)"`, 'i');
      const defMatch = combined.match(defRegex);
      if (defMatch) {
        console.log(`Found definition of "${key}" using regex! Value:`);
        console.log(defMatch[1].slice(0, 150));
      } else {
        console.log(`Definition of "${key}" NOT found with regex.`);
        // Let's print occurrences of the word key
        const term = `"${key}":`;
        const idxOfKey = combined.indexOf(term);
        if (idxOfKey !== -1) {
          console.log(`Found "${term}" at index ${idxOfKey}. Context:`);
          console.log(combined.slice(Math.max(0, idxOfKey - 50), idxOfKey + 400));
        } else {
          console.log(`"${term}" not found. Trying unquoted...`);
          const term2 = `${key}:`;
          const idxOfKey2 = combined.indexOf(term2);
          if (idxOfKey2 !== -1) {
            console.log(`Found "${term2}" at index ${idxOfKey2}. Context:`);
            console.log(combined.slice(Math.max(0, idxOfKey2 - 50), idxOfKey2 + 400));
          }
        }
      }
    }
  }
}
test();

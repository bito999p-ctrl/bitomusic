async function resolveRscReference(combined, ref) {
  if (!ref || typeof ref !== 'string' || !ref.startsWith('$')) return ref;
  
  const key = ref.replace(/^\$L?/, '');
  let searchStr = `\n${key}:`;
  let idx = combined.indexOf(searchStr);
  if (idx === -1) {
    searchStr = `${key}:`;
    if (combined.startsWith(searchStr)) {
      idx = 0;
    }
  }
  
  if (idx !== -1) {
    const lineStart = idx + searchStr.length;
    let lineEnd = combined.indexOf('\n', lineStart);
    if (lineEnd === -1) {
      lineEnd = combined.length;
    }
    const lineContent = combined.slice(lineStart, lineEnd);
    if (lineContent.startsWith('T')) {
      const commaIdx = lineContent.indexOf(',');
      if (commaIdx !== -1) {
        return lineContent.slice(commaIdx + 1);
      }
    }
    return lineContent;
  }
  return ref;
}

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
  const ref = "$5f";
  console.log('Resolving reference "$5f"...');
  const resolved = await resolveRscReference(combined, ref);
  console.log('Resolved Value snippet (150 chars):');
  console.log(resolved.slice(0, 150));
  console.log('\nUnescaped Value snippet:');
  console.log(resolved.replace(/\\n/g, '\n').slice(0, 150));
}
test();

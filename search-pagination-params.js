const fs = require('fs');
const content = fs.readFileSync('profile_combined.txt', 'utf8');

const keywords = ['page', 'offset', 'cursor', 'limit', 'skip', 'count', 'next', 'prev', 'scroll'];
keywords.forEach(kw => {
  let pos = 0;
  let matches = [];
  while (true) {
    const idx = content.indexOf(`"${kw}"`, pos);
    if (idx === -1) break;
    matches.push(content.slice(Math.max(0, idx - 40), idx + 60));
    pos = idx + 1;
    if (matches.length >= 10) break; // limit print
  }
  if (matches.length > 0) {
    console.log(`Keyword: "${kw}" found ${matches.length} times:`);
    matches.forEach(m => console.log(`  ...${m.trim()}...`));
  }
});

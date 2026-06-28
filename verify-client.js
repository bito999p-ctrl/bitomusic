try {
  console.log('Testing public/audio-engine.js import...');
  // Since they are ES modules, we can read them and verify syntax using vm or a quick check,
  // or compile a small dynamic import. But wait, Node doesn't support ES module imports in standard require unless configured,
  // but we can parse it using standard syntax check by compiling it with `vm.Script`.
  const vm = require('vm');
  const fs = require('fs');

  const aeContent = fs.readFileSync('public/audio-engine.js', 'utf8');
  new vm.Script(aeContent);
  console.log('[PASS] public/audio-engine.js syntax is valid.');

  const pContent = fs.readFileSync('public/player.js', 'utf8');
  // player.js is also an ES module
  new vm.Script(pContent);
  console.log('[PASS] public/player.js syntax is valid.');
  
} catch (err) {
  console.error('[FAIL] Syntax error found:', err.message);
  process.exit(1);
}
process.exit(0);

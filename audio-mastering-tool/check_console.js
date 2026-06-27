const { exec } = require('child_process');
const http = require('http');

// Start headless chrome
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const cmd = `"${chromePath}" --headless --disable-gpu --remote-debugging-port=9222 http://localhost:8080`;

console.log('Launching headless Chrome...');
const chromeProcess = exec(cmd);

setTimeout(() => {
  // Connect to Chrome debugging port to get console logs
  http.get('http://127.0.0.1:9222/json/list', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        const list = JSON.parse(data);
        if (list.length > 0) {
          console.log('Page debug URL found:', list[0].webSocketDebuggerUrl);
          console.log(list);
        } else {
          console.log('No pages found in Chrome.');
        }
      } catch (e) {
        console.error('Failed to parse page list:', e);
      }
      chromeProcess.kill();
      process.exit(0);
    });
  }).on('error', (err) => {
    console.error('Failed to connect to Chrome debugging port:', err);
    chromeProcess.kill();
    process.exit(1);
  });
}, 3000);

const { exec } = require('child_process');
const http = require('http');

// Start dev server if not running
console.log('Starting dev server...');
const serverProcess = exec('cmd.exe /c "npm run dev"');

setTimeout(() => {
  // Start headless chrome
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const cmd = `"${chromePath}" --headless --disable-gpu --remote-debugging-port=9222 http://localhost:8080`;

  console.log('Launching headless Chrome...');
  const chromeProcess = exec(cmd);

  setTimeout(() => {
    http.get('http://127.0.0.1:9222/json/list', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const list = JSON.parse(data);
        const page = list.find(p => p.type === 'page' && p.url.includes('localhost:8080'));
        if (!page) {
          console.error('Page not found');
          chromeProcess.kill();
          serverProcess.kill();
          process.exit(1);
        }

        const ws = new WebSocket(page.webSocketDebuggerUrl);
        ws.onopen = () => {
          // Evaluate wrapper offsetTop and offsetParent
          ws.send(JSON.stringify({
            id: 10,
            method: 'Runtime.evaluate',
            params: {
              expression: `(function() {
                const wrapper = document.querySelector('.app-sticky-header-wrapper');
                return JSON.stringify({
                  offsetTop: wrapper ? wrapper.offsetTop : null,
                  offsetParent: wrapper && wrapper.offsetParent ? wrapper.offsetParent.tagName + '.' + wrapper.offsetParent.className : null,
                  scrollY: window.scrollY
                });
              })()`
            }
          }));
        };

        ws.onmessage = (event) => {
          const msg = JSON.parse(event.data);
          if (msg.id === 10) {
            console.log('Offset Results:', msg.result.result.value);
            ws.close();
            chromeProcess.kill();
            serverProcess.kill();
            process.exit(0);
          }
        };
      });
    }).on('error', (err) => {
      console.error('Error:', err);
      chromeProcess.kill();
      serverProcess.kill();
      process.exit(1);
    });
  }, 3000);
}, 2000);

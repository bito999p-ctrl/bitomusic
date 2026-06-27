const { exec } = require('child_process');
const http = require('http');

console.log('Starting dev server...');
const serverProcess = exec('cmd.exe /c "npm run dev"');

setTimeout(() => {
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
          ws.send(JSON.stringify({ id: 1, method: 'Runtime.enable' }));
          
          ws.send(JSON.stringify({
            id: 10,
            method: 'Runtime.evaluate',
            params: {
              expression: `(function() {
                // Mock load audio file state
                document.getElementById('main-upload-panel').classList.add('hidden');
                document.getElementById('player-panel').classList.remove('hidden');
                document.body.classList.add('has-track');
                
                const header = document.querySelector('.app-header');
                const wrapper = document.querySelector('.app-sticky-header-wrapper');
                return JSON.stringify({
                  headerOffsetTop: header ? header.offsetTop : null,
                  headerOffsetHeight: header ? header.offsetHeight : null,
                  wrapperOffsetTop: wrapper ? wrapper.offsetTop : null,
                  baseThreshold: header ? header.offsetTop + header.offsetHeight + 20 - 15 : null,
                  scrollY: window.scrollY
                });
              })()`
            }
          }));
        };

        ws.onmessage = (event) => {
          const msg = JSON.parse(event.data);
          if (msg.id === 10) {
            console.log('Math Results:', msg.result.result.value);
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

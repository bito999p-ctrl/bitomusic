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
          console.log('Enabling Runtime and Console...');
          ws.send(JSON.stringify({ id: 1, method: 'Console.enable' }));
          ws.send(JSON.stringify({ id: 2, method: 'Runtime.enable' }));
          ws.send(JSON.stringify({ id: 3, method: 'Log.enable' }));
          
          // Inject console log in handleScroll
          ws.send(JSON.stringify({
            id: 11,
            method: 'Runtime.evaluate',
            params: {
              expression: `(function() {
                // Mock load audio file state
                document.getElementById('main-upload-panel').classList.add('hidden');
                document.getElementById('player-panel').classList.remove('hidden');
                document.body.classList.add('has-track');
                
                // Add console logger to window scroll
                window.addEventListener('scroll', () => {
                  const wrapper = document.querySelector('.app-sticky-header-wrapper');
                  console.log('SCROLL_LOG:', JSON.stringify({
                    scrollY: window.scrollY,
                    offsetTop: wrapper ? wrapper.offsetTop : null,
                    className: wrapper ? wrapper.className : ''
                  }));
                });
              })()`
            }
          }));

          // Scroll after 1s
          setTimeout(() => {
            console.log('Scrolling to 50px...');
            ws.send(JSON.stringify({
              id: 12,
              method: 'Runtime.evaluate',
              params: { expression: 'window.scrollTo(0, 50)' }
            }));
          }, 1000);

          // Scroll after 2s
          setTimeout(() => {
            console.log('Scrolling to 120px...');
            ws.send(JSON.stringify({
              id: 13,
              method: 'Runtime.evaluate',
              params: { expression: 'window.scrollTo(0, 120)' }
            }));
          }, 2000);

          // Scroll after 3s
          setTimeout(() => {
            console.log('Scrolling to 250px...');
            ws.send(JSON.stringify({
              id: 14,
              method: 'Runtime.evaluate',
              params: { expression: 'window.scrollTo(0, 250)' }
            }));
          }, 3000);
        };

        ws.onmessage = (event) => {
          const msg = JSON.parse(event.data);
          if (msg.method === 'Runtime.consoleAPICalled') {
            const args = msg.params.args.map(a => a.value || a.description).join(' ');
            console.log(`[Console] ${args}`);
          }
        };

        // Exit after 6 seconds
        setTimeout(() => {
          ws.close();
          chromeProcess.kill();
          serverProcess.kill();
          process.exit(0);
        }, 6000);
      });
    }).on('error', (err) => {
      console.error('Error:', err);
      chromeProcess.kill();
      serverProcess.kill();
      process.exit(1);
    });
  }, 3000);
}, 2000);

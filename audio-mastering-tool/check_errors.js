const { exec } = require('child_process');
const http = require('http');

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
        console.error('Mastering page not found');
        chromeProcess.kill();
        process.exit(1);
      }

      console.log('Connecting to WebSocket:', page.webSocketDebuggerUrl);
      const ws = new WebSocket(page.webSocketDebuggerUrl);

      ws.onopen = () => {
        console.log('Connected! Enabling Console and Runtime...');
        ws.send(JSON.stringify({ id: 1, method: 'Console.enable' }));
        ws.send(JSON.stringify({ id: 2, method: 'Runtime.enable' }));
        ws.send(JSON.stringify({ id: 3, method: 'Log.enable' }));
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.method === 'Runtime.consoleAPICalled') {
          const args = msg.params.args.map(a => a.value || a.description).join(' ');
          console.log(`[Browser Console] [${msg.params.type}] ${args}`);
        } else if (msg.method === 'Runtime.exceptionThrown') {
          console.error('[Browser Exception]', msg.params.exceptionDetails.exception.description);
        } else if (msg.method === 'Log.entryAdded') {
          console.log('[Browser Log]', msg.params.entry.text);
        } else if (msg.id === 10) {
          console.log('[Browser DOM Diagnostics]', msg.result.result.value);
        }
      };

      // Let's run a test evaluate after 3 seconds
      setTimeout(() => {
        ws.send(JSON.stringify({
          id: 10,
          method: 'Runtime.evaluate',
          params: {
            expression: `(function() {
              const playerPanel = document.getElementById('player-panel');
              const mainUpload = document.getElementById('main-upload-panel');
              const trackInfo = document.getElementById('track-info');
              const controls = document.querySelector('.player-controls');
              const hasTrack = document.body.classList.contains('has-track');
              return JSON.stringify({
                playerPanel: !!playerPanel,
                mainUpload: !!mainUpload,
                trackInfo: !!trackInfo,
                controls: !!controls,
                hasTrack,
                playerPanelClasses: playerPanel ? playerPanel.className : '',
                controlsDisplay: controls ? window.getComputedStyle(controls).display : ''
              });
            })()`
          }
        }));
      }, 3000);

      // Exit after 8 seconds
      setTimeout(() => {
        console.log('Closing WebSocket and Chrome...');
        ws.close();
        chromeProcess.kill();
        process.exit(0);
      }, 8000);
    });
  }).on('error', (err) => {
    console.error('Failed to connect to Chrome debugging port:', err);
    chromeProcess.kill();
    process.exit(1);
  });
}, 3000);

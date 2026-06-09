const http = require('http');

const OAUTH_PORT = 38471;
const CALLBACK_PATH = '/auth/callback';
const DONE_PATH = '/auth/done';

let server = null;
let timeoutId = null;

const CALLBACK_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>PrintGet — Signing in</title>
  <style>
    body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f8fafc; color: #334155; }
    .box { text-align: center; padding: 2rem; max-width: 360px; }
    .spinner { width: 40px; height: 40px; border: 3px solid #e2e8f0; border-top-color: #2563eb; border-radius: 50%; animation: spin 0.7s linear infinite; margin: 0 auto 1rem; }
    @keyframes spin { to { transform: rotate(360deg); } }
    h2 { margin: 0 0 0.5rem; font-size: 1.25rem; color: #0f172a; }
    p { margin: 0; line-height: 1.5; color: #64748b; font-size: 0.95rem; }
  </style>
</head>
<body>
  <div class="box">
    <div class="spinner" id="spin"></div>
    <h2>Signing in to PrintGet…</h2>
    <p id="msg">Connecting to the desktop app…</p>
  </div>
  <script>
    (function () {
      const msg = document.getElementById('msg');
      const spin = document.getElementById('spin');
      const hash = window.location.hash.substring(1);
      if (!hash) {
        spin.style.display = 'none';
        msg.textContent = 'No sign-in data received. Close this tab and try again in PrintGet.';
        return;
      }
      const body = hash;
      const doneUrl = '${DONE_PATH}';
      fetch(doneUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body,
        keepalive: true,
      })
        .then(function () {
          spin.style.display = 'none';
          msg.textContent = 'Success! Switch back to the PrintGet app — you can close this browser tab.';
        })
        .catch(function () {
          spin.style.display = 'none';
          msg.textContent = 'Opening PrintGet…';
          setTimeout(function () {
            window.location.href = 'printget://auth/callback#' + body;
          }, 400);
        });
    })();
  </script>
</body>
</html>`;

function stopOAuthCallbackServer() {
  if (timeoutId) {
    clearTimeout(timeoutId);
    timeoutId = null;
  }
  if (server) {
    server.close();
    server = null;
  }
}

function startOAuthCallbackServer(onTokens) {
  stopOAuthCallbackServer();

  return new Promise((resolve, reject) => {
    server = http.createServer((req, res) => {
      const url = new URL(req.url, `http://127.0.0.1:${OAUTH_PORT}`);

      if (req.method === 'GET' && url.pathname === CALLBACK_PATH) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(CALLBACK_HTML);
        return;
      }

      if (req.method === 'POST' && url.pathname === DONE_PATH) {
        let body = '';
        req.on('data', (chunk) => {
          body += chunk;
        });
        req.on('end', () => {
          if (body) {
            onTokens(`http://127.0.0.1:${OAUTH_PORT}${CALLBACK_PATH}#${body}`);
          }
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(
            '<!DOCTYPE html><html><body style="font-family:system-ui;text-align:center;padding:40px;color:#334155">' +
              '<h2 style="color:#0f172a">Signed in!</h2><p>You can close this tab.</p></body></html>'
          );
          stopOAuthCallbackServer();
        });
        return;
      }

      res.writeHead(404);
      res.end('Not found');
    });

    server.on('error', (err) => {
      stopOAuthCallbackServer();
      reject(err);
    });

    server.listen(OAUTH_PORT, '127.0.0.1', () => {
      console.log(`🔐 OAuth callback server listening on http://127.0.0.1:${OAUTH_PORT}${CALLBACK_PATH}`);
      timeoutId = setTimeout(() => {
        console.log('🔐 OAuth callback server timed out');
        stopOAuthCallbackServer();
      }, 10 * 60 * 1000);
      resolve(`http://127.0.0.1:${OAUTH_PORT}${CALLBACK_PATH}`);
    });
  });
}

module.exports = {
  startOAuthCallbackServer,
  stopOAuthCallbackServer,
  OAUTH_PORT,
  CALLBACK_PATH,
};

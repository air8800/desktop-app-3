const { BrowserWindow } = require('electron');
const { OAUTH_PORT, CALLBACK_PATH, stopOAuthCallbackServer } = require('./oauthCallbackServer');

let oauthWindow = null;

function isOAuthResultUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const lower = url.toLowerCase();
  if (lower.includes('access_token=') || lower.includes('error=')) return true;
  if (lower.includes(`127.0.0.1:${OAUTH_PORT}`) && lower.includes(CALLBACK_PATH)) return true;
  if (lower.includes('printget.in') && lower.includes('/auth/desktop-callback')) return true;
  if (lower.startsWith('printget://') && lower.includes('auth/callback')) return true;
  return false;
}

function normalizeOAuthCallbackUrl(url) {
  if (url.startsWith('printget://')) return url;
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes('printget.in') && parsed.pathname.includes('desktop-callback')) {
      return `printget://auth/callback${parsed.hash || ''}${parsed.search ? parsed.search.replace('?', '#') : ''}`;
    }
  } catch {
    /* ignore */
  }
  return url;
}

function closeOAuthWindow() {
  if (oauthWindow && !oauthWindow.isDestroyed()) {
    oauthWindow.close();
  }
  oauthWindow = null;
}

function tryFinishOAuth(url, onTokens) {
  if (!isOAuthResultUrl(url)) return false;
  const normalized = normalizeOAuthCallbackUrl(url);
  onTokens(normalized);
  closeOAuthWindow();
  stopOAuthCallbackServer();
  return true;
}

/**
 * Google sign-in inside the app — no switching to Chrome/Edge required.
 */
function openOAuthSignInWindow(parentWindow, startUrl, onTokens) {
  closeOAuthWindow();

  oauthWindow = new BrowserWindow({
    width: 520,
    height: 720,
    parent: parentWindow && !parentWindow.isDestroyed() ? parentWindow : undefined,
    modal: Boolean(parentWindow && !parentWindow.isDestroyed()),
    show: false,
    autoHideMenuBar: true,
    title: 'Sign in with Google — PrintGet',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  const attachNavigationHandlers = (wc) => {
    const onNav = (_event, url) => {
      tryFinishOAuth(url, onTokens);
    };
    wc.on('will-redirect', onNav);
    wc.on('will-navigate', onNav);
    wc.on('did-navigate', (_event, url) => onNav(null, url));
    wc.on('did-navigate-in-page', (_event, url) => onNav(null, url));
  };

  attachNavigationHandlers(oauthWindow.webContents);

  oauthWindow.once('ready-to-show', () => {
    if (oauthWindow && !oauthWindow.isDestroyed()) oauthWindow.show();
  });

  oauthWindow.on('closed', () => {
    oauthWindow = null;
  });

  oauthWindow.loadURL(startUrl).catch((err) => {
    console.error('OAuth window load failed:', err);
    closeOAuthWindow();
  });

  return oauthWindow;
}

module.exports = {
  openOAuthSignInWindow,
  closeOAuthWindow,
  isOAuthResultUrl,
};

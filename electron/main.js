"use strict";

const { app, BrowserWindow, ipcMain, dialog, Menu, shell, protocol, session } = require('electron');
const path = require('path');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');

autoUpdater.logger = console;
const isDev = require('electron-is-dev');
const {
  APP_NAME,
  APP_ID,
  OAUTH_PROTOCOL,
  isProduction,
  getRendererIndexPath,
  getPreloadPath,
  getWindowIconPath,
} = require('./appConfig');
const {
  suppressConsoleInProduction,
  applyAppHardening,
  hardenBrowserWindow,
} = require('./security');

suppressConsoleInProduction();
applyAppHardening();

if (!isDev) {
  console.log(`🚀 Starting ${APP_NAME}...`);
}
const Store = require('electron-store');
const { exec } = require('child_process');
const util = require('util');
const os = require('os');

// CRITICAL: Register custom protocol scheme BEFORE app is ready
// CRITICAL: Register custom protocol scheme BEFORE app is ready
// This is required for the local-pdf:// protocol to work

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'local-pdf',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      bypassCSP: true,
      corsEnabled: true,
      stream: true
    }
  },
  {
    scheme: 'printget',
    privileges: {
      standard: true,
      secure: true,
    }
  }
]);
console.log('✅ [PROTOCOL] local-pdf scheme registered as privileged');


console.log('📦 Loading print modules...');

let paperSizeConfig, directPrint, advancedPaperSizeControl, pdfPrintManager;
let silentPdfPrinting, mupdfPrinting, cpdftPrinting, nativePrintEngine;
let isSupportedPaperSize, getAvailablePaperSizes;

try {
  const psc = require('./paperSizeConfig');
  isSupportedPaperSize = psc.isSupportedPaperSize;
  getAvailablePaperSizes = psc.getAvailablePaperSizes;
  console.log('✅ paperSizeConfig loaded');
} catch (e) { console.error('❌ paperSizeConfig failed:', e.message); }

try { directPrint = require('./directPrint'); console.log('✅ directPrint loaded'); }
catch (e) { console.error('❌ directPrint failed:', e.message); }

try { advancedPaperSizeControl = require('./advancedPaperSizeControl'); console.log('✅ advancedPaperSizeControl loaded'); }
catch (e) { console.error('❌ advancedPaperSizeControl failed:', e.message); }

try { pdfPrintManager = require('./pdfPrintManager'); console.log('✅ pdfPrintManager loaded'); }
catch (e) { console.error('❌ pdfPrintManager failed:', e.message); }

try { silentPdfPrinting = require('./silentPdfPrinting'); console.log('✅ silentPdfPrinting loaded'); }
catch (e) { console.error('❌ silentPdfPrinting failed:', e.message); }

try { mupdfPrinting = require('./mupdfPrinting'); console.log('✅ mupdfPrinting loaded'); }
catch (e) { console.error('❌ mupdfPrinting failed:', e.message); }



try { cpdftPrinting = require('./cpdftPrinting'); console.log('✅ cpdftPrinting loaded'); }
catch (e) { console.error('❌ cpdftPrinting failed:', e.message); }

try { nativePrintEngine = require('./nativePrintEngine'); console.log('✅ nativePrintEngine loaded'); }
catch (e) { console.error('❌ nativePrintEngine failed:', e.message); }

let recipeProcessor;
try { recipeProcessor = require('./recipeProcessor'); console.log('✅ recipeProcessor loaded'); }
catch (e) { console.error('❌ recipeProcessor failed:', e.message); }

let downloadManager;
try { downloadManager = require('./downloadManager'); console.log('✅ downloadManager loaded'); }
catch (e) { console.error('❌ downloadManager failed:', e.message); }

console.log('📦 All modules loaded, initializing app...');

const execPromise = util.promisify(exec);

let pendingOAuthUrl = null;

app.setName(APP_NAME);
if (process.platform === 'win32') {
  app.setAppUserModelId(APP_ID);
}

function getProtocolUrlFromArgv(argv) {
  return argv.find((arg) => typeof arg === 'string' && arg.startsWith(`${OAUTH_PROTOCOL}://`));
}

let oauthFocusTimer = null;
let lastOAuthDeliveryKey = '';
let lastOAuthDeliveryAt = 0;

function oauthDeliveryKey(url) {
  if (!url || typeof url !== 'string') return '';
  const hash = url.includes('#') ? url.split('#')[1] : '';
  const token = hash.match(/access_token=([^&]+)/);
  return token ? token[1].slice(0, 48) : hash.slice(0, 48);
}

function bringMainWindowForwardSmoothly() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  if (!mainWindow.isVisible()) mainWindow.show();
  mainWindow.focus();
}

function scheduleSmoothOAuthFocus() {
  if (oauthFocusTimer) clearTimeout(oauthFocusTimer);
  oauthFocusTimer = setTimeout(() => {
    oauthFocusTimer = null;
    bringMainWindowForwardSmoothly();
  }, 600);
}

function deliverOAuthUrl(url) {
  const key = oauthDeliveryKey(url);
  const now = Date.now();
  if (key && key === lastOAuthDeliveryKey && now - lastOAuthDeliveryAt < 8000) {
    return;
  }
  if (key) {
    lastOAuthDeliveryKey = key;
    lastOAuthDeliveryAt = now;
  }

  console.log('🔐 OAuth callback received');
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('oauth-callback', url);
    scheduleSmoothOAuthFocus();
  } else {
    pendingOAuthUrl = url;
  }
}

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, commandLine) => {
    const url = getProtocolUrlFromArgv(commandLine);
    if (url) {
      deliverOAuthUrl(url);
      return;
    }
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(OAUTH_PROTOCOL, process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient(OAUTH_PROTOCOL);
}

app.on('open-url', (event, url) => {
  event.preventDefault();
  if (url.startsWith(`${OAUTH_PROTOCOL}://`)) deliverOAuthUrl(url);
});

const { startOAuthCallbackServer, stopOAuthCallbackServer } = require('./oauthCallbackServer');
const { openOAuthSignInWindow, closeOAuthWindow } = require('./oauthWindow');

// Initialize the store for persistent data
const store = new Store();

// Auth session IPC handlers
ipcMain.handle('auth-get-session', async () => {
  try {
    const session = store.get('auth-session');
    return { success: true, session: session || null };
  } catch (error) {
    return { success: false, error: error.message, session: null };
  }
});

ipcMain.handle('auth-set-session', async (_event, session) => {
  try {
    store.set('auth-session', session);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('auth-clear-session', async () => {
  try {
    store.delete('auth-session');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('open-external-url', async (_event, url) => {
  try {
    await shell.openExternal(url);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

const PARTNER_API_BASE = process.env.PRINTGET_API_URL || 'https://printget.in';

ipcMain.handle('partner-api-fetch', async (_event, { path, method = 'POST', body, headers = {} }) => {
  try {
    const res = await fetch(`${PARTNER_API_BASE}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
      body: body != null ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }
    return { ok: res.ok, status: res.status, data };
  } catch (error) {
    return { ok: false, status: 0, data: null, error: error.message };
  }
});

ipcMain.handle('prepare-oauth-redirect', async () => {
  try {
    const redirectUrl = await startOAuthCallbackServer((url) => {
      deliverOAuthUrl(url);
    });
    return { success: true, redirectUrl };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('stop-oauth-redirect', async () => {
  stopOAuthCallbackServer();
  closeOAuthWindow();
  return { success: true };
});

ipcMain.handle('open-oauth-sign-in', async (_event, startUrl) => {
  try {
    if (!startUrl || typeof startUrl !== 'string') {
      return { success: false, error: 'Missing sign-in URL' };
    }
    await startOAuthCallbackServer((url) => deliverOAuthUrl(url));
    openOAuthSignInWindow(mainWindow, startUrl, (url) => deliverOAuthUrl(url));
    return { success: true };
  } catch (error) {
    closeOAuthWindow();
    stopOAuthCallbackServer();
    return { success: false, error: error.message };
  }
});

let mainWindow;
let allowQuit = false;
let mapsPopupWindow = null;

function isGoogleMapsUrl(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    return (
      host.includes('google.') &&
      (u.pathname.includes('/maps') || host.startsWith('maps.'))
    );
  } catch {
    const lower = String(url).toLowerCase();
    return lower.includes('google.com/maps') || lower.includes('maps.google');
  }
}

function trackMapsPopupWindow(win) {
  mapsPopupWindow = win;
  win.on('closed', () => {
    if (mapsPopupWindow === win) mapsPopupWindow = null;
  });
}

function configurePopupWindowHandlers(parentWindow) {
  parentWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isGoogleMapsUrl(url)) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 1100,
          height: 800,
          autoHideMenuBar: false,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false,
            devTools: !isProduction,
          },
        },
      };
    }
    return { action: 'allow' };
  });

  parentWindow.webContents.on('did-create-window', (childWindow) => {
    trackMapsPopupWindow(childWindow);
    configurePopupWindowHandlers(childWindow);
  });
}

function createWindow() {
  const iconPath = getWindowIconPath();
  const windowOptions = {
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: APP_NAME,
    show: false,
    backgroundColor: '#0f172a',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: getPreloadPath(),
      devTools: !isProduction,
      webSecurity: true,
      allowRunningInsecureContent: false,
      enableBlinkFeatures: '',
    },
    autoHideMenuBar: true,
  };

  if (fs.existsSync(iconPath)) {
    windowOptions.icon = iconPath;
  }

  mainWindow = new BrowserWindow(windowOptions);

  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      ...(isDev ? [{ role: 'viewMenu' }] : []),
      { role: 'editMenu' },
    ])
  );

  const startUrl = isDev
    ? 'http://localhost:5173'
    : `file://${getRendererIndexPath()}`;

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.loadURL(startUrl);

  configurePopupWindowHandlers(mainWindow);
  hardenBrowserWindow(mainWindow, {
    appOrigin: isDev ? 'http://localhost:5173' : 'file://',
  });

  mainWindow.webContents.on('did-finish-load', () => {
    if (pendingOAuthUrl) {
      mainWindow.webContents.send('oauth-callback', pendingOAuthUrl);
      pendingOAuthUrl = null;
    }
  });

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  mainWindow.on('close', (event) => {
    if (!allowQuit) {
      event.preventDefault();
      mainWindow.webContents.send('app-close-requested');
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Set main window for download manager
  if (downloadManager) {
    downloadManager.setMainWindow(mainWindow);
  }
}

app.whenReady().then(() => {
  const clipboardPermissions = new Set([
    'clipboard-read',
    'clipboard-write',
    'clipboard-sanitized-write',
  ]);

  session.defaultSession.setPermissionCheckHandler((_webContents, permission) => {
    if (clipboardPermissions.has(permission)) return true;
    return permission === 'geolocation' || permission === 'notifications';
  });

  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback, details) => {
    if (clipboardPermissions.has(permission)) {
      callback(true);
      return;
    }
    if (permission === 'geolocation' || permission === 'notifications') {
      callback(true);
      return;
    }
    try {
      if (details.requestingUrl && new URL(details.requestingUrl).hostname.includes('google.')) {
        callback(true);
        return;
      }
    } catch {
      /* ignore */
    }
    callback(false);
  });

  // Register custom protocol to serve local PDF files directly
  // This allows PDF.js to load via fetch() without base64 encoding overhead

  protocol.handle('local-pdf', async (request) => {
    try {
      // Use query parameter to avoid URL normalization issues (stripping colons, lowercasing drive letters)
      // Format: local-pdf://read?path=C%3A%2FUsers%2F...
      const url = new URL(request.url);
      let filePath = url.searchParams.get('path');

      // Fallback to pathname if query param is missing (legacy support)
      if (!filePath) {
        filePath = decodeURIComponent(url.pathname);
        if (process.platform === 'win32' && filePath.startsWith('/')) {
          filePath = filePath.substring(1);
        }
      }

      console.log('📂 [PROTOCOL] Request:', request.url);
      console.log('📂 [PROTOCOL] Resolved path:', filePath);

      // Check if file exists
      if (!filePath || !fs.existsSync(filePath)) {
        console.error('❌ [PROTOCOL] File not found:', filePath);
        return new Response('File not found', { status: 404 });
      }

      // Return the file directly as a Response
      const fileBuffer = fs.readFileSync(filePath);
      console.log(`✅ [PROTOCOL] Serving ${Math.round(fileBuffer.length / 1024)}KB`);

      return new Response(fileBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Length': fileBuffer.length.toString(),
        }
      });
    } catch (error) {
      console.error('❌ [PROTOCOL] Error serving PDF:', error);
      return new Response('Error: ' + error.message, { status: 500 });
    }
  });

  console.log('✅ [PROTOCOL] local-pdf:// protocol registered');

  createWindow();

  // Check for updates on startup
  if (!isDev) {
    autoUpdater.checkForUpdatesAndNotify().catch(err => {
      console.error('Failed to check for updates:', err);
    });

    autoUpdater.on('update-available', (info) => {
      console.log('Update available:', info.version);
    });

    autoUpdater.on('update-downloaded', (info) => {
      dialog.showMessageBox({
        type: 'info',
        title: 'Update Ready',
        message: 'A new version of PrintGet Shop Manager has been downloaded. Restart the application to apply the updates.',
        buttons: ['Restart and Install', 'Install Later']
      }).then((result) => {
        if (result.response === 0) {
          allowQuit = true;
          autoUpdater.quitAndInstall();
        }
      });
    });
  }

  const startupOAuthUrl = getProtocolUrlFromArgv(process.argv);
  if (startupOAuthUrl) deliverOAuthUrl(startupOAuthUrl);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('app-quit-confirmed', async () => {
  allowQuit = true;
  if (mainWindow) mainWindow.close();
  return { success: true };
});

// ============================================================================
// RECIPE-BASED PDF PROCESSING
// ============================================================================

ipcMain.handle('process-pdf-with-recipe', async (event, pdfUrl, recipe) => {
  try {
    console.log('🔄 Processing PDF with recipe:', { pdfUrl, hasRecipe: !!recipe });

    if (!recipeProcessor) {
      throw new Error('Recipe processor not loaded');
    }

    const result = await recipeProcessor.processRemotePdfWithRecipe(pdfUrl, recipe);

    if (result.success) {
      console.log('✅ PDF processed successfully:', result.processedPath);

      // Read the processed PDF and convert to base64 data URL
      // This allows the browser to load it without file:// security restrictions
      const pdfBuffer = fs.readFileSync(result.processedPath);
      const base64Pdf = pdfBuffer.toString('base64');
      const dataUrl = `data:application/pdf;base64,${base64Pdf}`;

      console.log(`📄 Converted to data URL (${Math.round(base64Pdf.length / 1024)}KB)`);

      return {
        success: true,
        processedPath: result.processedPath,
        processedUrl: dataUrl,  // Data URL instead of file:// URL
        processed: result.processed,
        originalSize: result.originalSize,
        processedSize: result.processedSize
      };
    } else {
      console.error('❌ PDF processing failed:', result.error);
      return { success: false, error: result.error };
    }
  } catch (error) {
    console.error('❌ Recipe processing error:', error);
    return { success: false, error: error.message };
  }
});

// ============================================================================
// QR CODE FUNCTIONS
// ============================================================================

ipcMain.handle('save-qr-image', async (event, imageData) => {
  try {
    store.set('payment-qr', imageData);
    return { success: true };
  } catch (error) {
    console.error('Error saving QR image:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-qr-image', async () => {
  try {
    const qrImage = store.get('payment-qr');
    return { success: true, data: qrImage };
  } catch (error) {
    console.error('Error getting QR image:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('upload-qr-image', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['jpg', 'png', 'jpeg'] }],
    });

    if (result.canceled) {
      return { success: false, error: 'File selection canceled' };
    }

    store.set('payment-qr', result.filePaths[0]);
    return { success: true, path: result.filePaths[0] };
  } catch (error) {
    console.error('Error uploading QR image:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('expand-url', async (_event, url) => expandMapsUrl(url));

async function expandMapsUrl(url) {
  const headers = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  };
  const response = await fetch(url, { method: 'GET', redirect: 'follow', headers });
  const finalUrl = response.url || url;
  if (finalUrl === url && isShortMapsHost(url)) {
    throw new Error('Share link did not expand');
  }
  return finalUrl;
}

const SCRAPE_MAPS_ADDRESS_JS = `(function() {
  const clean = (s) => (s || '').replace(/^Address:\\s*/i, '').trim();
  const btn = document.querySelector('button[data-item-id="address"]');
  if (btn) {
    const label = btn.getAttribute('aria-label') || btn.innerText;
    if (label) return clean(label);
  }
  for (const el of document.querySelectorAll('.Io6YTe.fontBodyMedium, .rogA2c .Io6YTe, [class*="Io6YTe"]')) {
    const t = (el.innerText || '').trim();
    if (t.length > 20 && /\\d{6}/.test(t)) return clean(t);
  }
  return null;
})()`;

async function scrapeAddressFromWebContents(webContents) {
  await new Promise((r) => setTimeout(r, 3500));
  return webContents.executeJavaScript(SCRAPE_MAPS_ADDRESS_JS);
}

async function fetchAddressFromMapsPage(expandedUrl) {
  if (mapsPopupWindow && !mapsPopupWindow.isDestroyed()) {
    const openUrl = mapsPopupWindow.webContents.getURL();
    if (isGoogleMapsUrl(openUrl)) {
      try {
        const address = await scrapeAddressFromWebContents(mapsPopupWindow.webContents);
        if (address) return address;
      } catch {
        /* fall through to hidden window */
      }
    }
  }

  return new Promise((resolve, reject) => {
    const win = new BrowserWindow({
      show: false,
      webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: false },
    });
    const timeout = setTimeout(() => {
      if (!win.isDestroyed()) win.destroy();
      reject(new Error('Timed out reading address from Google Maps'));
    }, 25000);

    win.webContents.on('did-finish-load', async () => {
      try {
        const address = await scrapeAddressFromWebContents(win.webContents);
        clearTimeout(timeout);
        if (!win.isDestroyed()) win.destroy();
        if (address) resolve(address);
        else reject(new Error('Could not read street address from this Maps link'));
      } catch (err) {
        clearTimeout(timeout);
        if (!win.isDestroyed()) win.destroy();
        reject(err);
      }
    });

    win.webContents.on('did-fail-load', () => {
      clearTimeout(timeout);
      if (!win.isDestroyed()) win.destroy();
      reject(new Error('Failed to load Google Maps page'));
    });

    win.loadURL(expandedUrl);
  });
}

ipcMain.handle('fetch-maps-place-address', async (_event, url) => {
  try {
    const expandedUrl = await expandMapsUrl(url);
    const address = await fetchAddressFromMapsPage(expandedUrl);
    return { address, expandedUrl };
  } catch (error) {
    console.error('fetch-maps-place-address:', error);
    throw error;
  }
});

function isShortMapsHost(url) {
  const lower = String(url).toLowerCase();
  return (
    lower.includes('maps.app.goo.gl') ||
    lower.includes('goo.gl/maps') ||
    lower.includes('g.page/')
  );
}

ipcMain.handle('get-maps-window-url', async () => {
  if (!mapsPopupWindow || mapsPopupWindow.isDestroyed()) {
    throw new Error('Click Open Maps first, then search for your shop and pin it.');
  }
  const url = mapsPopupWindow.webContents.getURL();
  if (!isGoogleMapsUrl(url)) {
    throw new Error('In Maps, open your shop pin first, then click Get link from Maps.');
  }
  return url;
});

// ============================================================================
// PRINTER FUNCTIONS
// ============================================================================

ipcMain.handle('get-printers', async () => {
  try {
    let printers = [];

    if (process.platform === 'win32') {
      try {
        // Use PowerShell command with proper syntax
        const { stdout } = await execPromise(
          'powershell.exe -Command "Get-Printer | Select-Object Name,PrinterStatus,IsDefault | ConvertTo-Json"'
        );
        if (stdout) {
          const systemPrinters = JSON.parse(stdout);
          // Handle both single printer and multiple printers cases
          const printersArray = Array.isArray(systemPrinters) ? systemPrinters : [systemPrinters];
          printers = printersArray.map(printer => ({
            name: printer.Name,
            status: printer.PrinterStatus === 1 ? 'Ready' : 'Not Ready',
            default: printer.IsDefault || false
          }));
        }
      } catch (error) {
        console.error('Error getting system printers:', error);
      }
    } else if (process.platform === 'darwin') {
      try {
        // macOS printer detection
        const { stdout } = await execPromise('lpstat -p');
        const printerLines = stdout.split('\n').filter(line => line.startsWith('printer'));
        printers = printerLines.map(line => {
          const name = line.split(' ')[1];
          return {
            name: name,
            status: 'Ready',
            default: false
          };
        });
      } catch (error) {
        console.error('Error getting macOS printers:', error);
      }
    } else {
      try {
        // Linux printer detection
        const { stdout } = await execPromise('lpstat -p');
        const printerLines = stdout.split('\n').filter(line => line.includes('printer'));
        printers = printerLines.map(line => {
          const name = line.split(' ')[1];
          return {
            name: name,
            status: 'Ready',
            default: false
          };
        });
      } catch (error) {
        console.error('Error getting Linux printers:', error);
      }
    }

    // If no printers were found, add default virtual printer
    if (printers.length === 0) {
      printers.push({
        name: 'Microsoft Print to PDF',
        status: 'Ready',
        default: true
      });
    }

    // Add paper size support information
    const printersWithPaperSizes = printers.map(printer => {
      return {
        ...printer,
        supportedPaperSizes: getAvailablePaperSizes().map(size => size.key)
      };
    });

    return { success: true, printers: printersWithPaperSizes };
  } catch (error) {
    console.error('Error getting printers:', error);
    return { success: false, error: error.message };
  }
});

// ============================================================================
// PRINT FUNCTIONS WITH PAPER SIZE SUPPORT
// ============================================================================

// Download file from URL - IMPROVED WITH BETTER ERROR HANDLING AND URL ENCODING
async function downloadFile(fileUrl, filename) {
  try {
    const tempDir = path.join(os.tmpdir(), 'xerox-print-jobs');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const timestamp = Date.now();
    const fileExtension = path.extname(filename);
    const baseName = path.basename(filename, fileExtension);

    // Create a simpler filename to avoid path length issues
    const simplifiedBaseName = baseName
      .replace(/[^a-zA-Z0-9]/g, '_')  // Replace non-alphanumeric with underscore
      .substring(0, 50);              // Limit length

    const uniqueFilename = `${simplifiedBaseName}_${timestamp}${fileExtension}`;
    const filePath = path.join(tempDir, uniqueFilename);

    console.log('📥 Downloading file:', { fileUrl, filePath });

    // Check if URL needs encoding
    let processedUrl = fileUrl;
    if (fileUrl.includes(' ') || fileUrl.includes('%20')) {
      // URL already has spaces or encoded spaces, ensure proper encoding
      processedUrl = encodeURI(decodeURI(fileUrl));
    }

    // Use fetch API instead of curl for better reliability
    const response = await fetch(processedUrl);

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const fileBuffer = await response.arrayBuffer();
    fs.writeFileSync(filePath, Buffer.from(fileBuffer));

    if (!fs.existsSync(filePath)) {
      throw new Error('File download failed - file not found after download');
    }

    const stats = fs.statSync(filePath);
    if (stats.size === 0) {
      throw new Error('File download failed - downloaded file is empty');
    }

    return filePath;
  } catch (error) {
    console.error('❌ Download error:', error);
    throw error;
  }
}

// Main print function with paper size support
ipcMain.handle('download-and-print-file', async (event, fileUrl, filename, printerName, copies = 1, paperSize = 'A4', colorMode = 'BW', printType = 'Single', nupPages = 1, nupOrientation = 'portrait', orderMark = null) => {
  try {
    console.log('🖨️ Starting print job with ALL parameters:', {
      fileUrl: fileUrl ? (fileUrl.length > 50 ? fileUrl.substring(0, 50) + '...' : fileUrl) : 'undefined',
      filename,
      printerName,
      copies,
      paperSize,
      colorMode,
      printType,
      nupPages,
      nupOrientation
    });

    // Validate paper size
    if (!isSupportedPaperSize(paperSize)) {
      console.warn(`Unsupported paper size: ${paperSize}, defaulting to A4`);
      paperSize = 'A4';
    }

    let filePath;

    // Check if fileUrl is actually a local file path that exists
    if (fileUrl && typeof fileUrl === 'string' && fs.existsSync(fileUrl)) {
      console.log('📂 File exists locally, skipping download:', fileUrl);
      filePath = fileUrl;
    } else {
      // Download the file
      filePath = await downloadFile(fileUrl, filename);
      console.log('📁 File downloaded to:', filePath);
    }

    // Check if it's a PDF file
    const isPdf = path.extname(filePath).toLowerCase() === '.pdf';

    if (isPdf) {
      // PREFERRED: Native Print Engine (pdf-lib + PDFtoPrinter and/or SumatraPDF).
      // Order ID stamping runs inside nativePrintEngine.processPdf — only when this path is used.
      // Previously we gated on Sumatra only; shops with PDFtoPrinter but no Sumatra fell through to
      // legacy printers and never received orderMark.
      const canUseNativePrint =
        nativePrintEngine.isPDFtoPrinterAvailable(isDev) || nativePrintEngine.isSumatraAvailable(isDev);

      if (canUseNativePrint) {
        console.log('✅ Using Native Print Engine (pdf-lib + silent PDF printing)', {
          pdfToPrinter: nativePrintEngine.isPDFtoPrinterAvailable(isDev),
          sumatra: nativePrintEngine.isSumatraAvailable(isDev),
          hasOrderMark: !!orderMark
        });
        return await nativePrintEngine.printPdfNatively(filePath, printerName, {
          paperSize,
          copies,
          colorMode,
          printType,
          nupPages: nupPages || 1,
          nupOrientation: nupOrientation || 'portrait',
          orderMark: orderMark || null
        }, isDev);
      }

      console.log('⚠️ Native print engine unavailable (need PDFtoPrinter.exe and/or SumatraPDF.exe in extraResources). Trying legacy methods — order ID on PDF will not be applied.');

      // LEGACY FALLBACK: Try cpdf if installed
      const isCpdftAvailable = await cpdftPrinting.isCpdftInstalled();

      if (isCpdftAvailable) {
        const cpdftResult = await cpdftPrinting.processPdfWithCpdf(filePath, printerName, paperSize, copies, colorMode, printType, nupPages || 1, nupOrientation);

        if (cpdftResult.success) {
          return await silentPdfPrinting.printPdfSilently(cpdftResult.processedFilePath, printerName, paperSize, copies, colorMode, printType, 1, nupOrientation);
        } else {
          console.log('⚠️ cpdf processing failed, falling back to other methods');
        }
      }



      // LEGACY FALLBACK: Try MuPDF
      const isMuPDFAvailable = await mupdfPrinting.isMuPDFInstalled();

      if (isMuPDFAvailable) {
        return await mupdfPrinting.printPdfSilently(filePath, printerName, paperSize, copies, colorMode, printType, nupPages || 1, nupOrientation);
      }

      // LAST RESORT: Try silentPdfPrinting (needs external SumatraPDF)
      return await silentPdfPrinting.printPdfSilently(filePath, printerName, paperSize, copies, colorMode, printType, nupPages || 1, nupOrientation);
    } else {
      // Force paper size setting using advanced methods
      await advancedPaperSizeControl.forcePaperSize(printerName, paperSize);

      // Use direct printing for Windows
      if (process.platform === 'win32') {
        return await directPrint.printFileDirectly(filePath, printerName, paperSize, copies, colorMode, printType, nupPages || 1, nupOrientation);
      } else {
        // For other platforms, use a simpler approach with duplex support
        const duplexOption = printType === 'Double' ? '-o sides=two-sided-long-edge' : '-o sides=one-sided';
        const colorOption = colorMode === 'Color' ? '' : '-o ColorModel=Gray';

        const printCommand = process.platform === 'darwin'
          ? `lp -d "${printerName}" -n ${copies} -o media=${paperSize} ${duplexOption} ${colorOption} "${filePath}"`
          : `lp -d "${printerName}" -n ${copies} -o media=${paperSize} ${duplexOption} ${colorOption} "${filePath}"`;

        console.log('🖨️ Executing print command:', printCommand);
        await execPromise(printCommand);

        return {
          success: true,
          message: `Print job sent to ${printerName} with ${paperSize} paper size, ${copies} copies, ${colorMode} mode, ${printType} printing`,
          command: process.platform === 'darwin' ? 'macOS lp' : 'Linux lp'
        };
      }
    }
  } catch (error) {
    console.error('❌ Print job failed:', error);
    return {
      success: false,
      error: error.message,
      paperSize
    };
  }
});

// Test printing function with paper size
ipcMain.handle('test-print', async (event, printerName, paperSize = 'A4') => {
  try {
    console.log('🧪 Testing printer with paper size:', { printerName, paperSize });

    // Validate paper size
    if (!isSupportedPaperSize(paperSize)) {
      console.warn(`Unsupported paper size: ${paperSize}, defaulting to A4`);
      paperSize = 'A4';
    }

    // Force paper size setting using advanced methods
    await advancedPaperSizeControl.forcePaperSize(printerName, paperSize);

    // Use direct print for Windows
    if (process.platform === 'win32') {
      return await directPrint.createAndPrintTestFile(printerName, paperSize);
    } else {
      // For other platforms, create a simple test file
      const tempDir = path.join(os.tmpdir(), 'xerox-print-jobs');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const testFilePath = path.join(tempDir, `test-print-${Date.now()}.txt`);
      const testContent = `Test Print Job\nPrinter: ${printerName}\nPaper Size: ${paperSize}\nTime: ${new Date().toLocaleString()}\nThis is a test print to verify printer connectivity.\n\nIf you can read this, your printer is working correctly!`;

      fs.writeFileSync(testFilePath, testContent);

      // Print the test file
      const printCommand = process.platform === 'darwin'
        ? `lp -d "${printerName}" -o media=${paperSize} "${testFilePath}"`
        : `lp -d "${printerName}" -o media=${paperSize} "${testFilePath}"`;

      console.log('🧪 Executing test print command:', printCommand);
      await execPromise(printCommand);

      // Clean up test file
      try {
        fs.unlinkSync(testFilePath);
      } catch (cleanupError) {
        console.log('⚠️ Could not clean up test file:', cleanupError.message);
      }

      return {
        success: true,
        message: `Test print sent to ${printerName} with ${paperSize} paper size`,
        command: process.platform === 'darwin' ? 'macOS lp' : 'Linux lp'
      };
    }
  } catch (error) {
    console.error('❌ Test print failed:', error);
    return {
      success: false,
      error: error.message,
      paperSize,
      printerName
    };
  }
});

// Open file in default application (for manual printing)
ipcMain.handle('open-file-for-printing', async (event, fileUrl, filename) => {
  try {
    console.log('📂 Opening file for manual printing:', filename);

    // Download file first - using improved download function
    const filePath = await downloadFile(fileUrl, filename);

    // Open file with default application
    await shell.openPath(filePath);

    console.log('✅ File opened successfully');
    return {
      success: true,
      message: `Opened ${filename} for manual printing`,
      filePath
    };
  } catch (error) {
    console.error('❌ Failed to open file:', error);
    return { success: false, error: error.message };
  }
});

// Clean up old print files
ipcMain.handle('cleanup-print-files', async () => {
  try {
    const tempDir = path.join(os.tmpdir(), 'xerox-print-jobs');

    if (fs.existsSync(tempDir)) {
      const files = fs.readdirSync(tempDir);
      const now = Date.now();
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours

      let cleanedCount = 0;

      for (const file of files) {
        const filePath = path.join(tempDir, file);
        const stats = fs.statSync(filePath);

        if (now - stats.mtime.getTime() > maxAge) {
          fs.unlinkSync(filePath);
          cleanedCount++;
        }
      }

      console.log(`🧹 Cleaned up ${cleanedCount} old print files`);
      return { success: true, cleanedCount };
    }

    return { success: true, cleanedCount: 0 };
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    return { success: false, error: error.message };
  }
});

// ============================================================================
// JOB MANAGEMENT FUNCTIONS
// ============================================================================

ipcMain.handle('mark-job-printed', async (event, jobId) => {
  try {
    console.log('✅ Job marked as printed:', jobId);
    if (downloadManager) {
      downloadManager.markAsPrinted(jobId);
    }
    return { success: true, jobId };
  } catch (error) {
    console.error('Error marking job as printed:', error);
    return { success: false, error: error.message };
  }
});

// ============================================================================
// DOWNLOAD MANAGER FUNCTIONS
// ============================================================================

ipcMain.handle('download-start', async (event, jobId, fileUrl, filename) => {
  try {
    if (!downloadManager) throw new Error('Download manager not loaded');
    const result = await downloadManager.startDownload(jobId, fileUrl, filename);
    return result;
  } catch (error) {
    console.error('❌ Download start error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('download-pause', async (event, jobId) => {
  try {
    if (!downloadManager) throw new Error('Download manager not loaded');
    return downloadManager.pauseDownload(jobId);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('download-resume', async (event, jobId) => {
  try {
    if (!downloadManager) throw new Error('Download manager not loaded');
    return downloadManager.resumeDownload(jobId);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('download-cancel', async (event, jobId) => {
  try {
    if (!downloadManager) throw new Error('Download manager not loaded');
    return downloadManager.cancelDownload(jobId);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('download-delete', async (event, jobId) => {
  try {
    if (!downloadManager) throw new Error('Download manager not loaded');
    return downloadManager.deleteDownloadedFile(jobId);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('download-status', async () => {
  try {
    if (!downloadManager) throw new Error('Download manager not loaded');
    return { success: true, ...downloadManager.getStatus() };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('download-get-path', async (event, jobId) => {
  try {
    if (!downloadManager) throw new Error('Download manager not loaded');
    const filePath = downloadManager.getFilePath(jobId);
    return { success: !!filePath, filePath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('download-is-ready', async (event, jobId) => {
  try {
    if (!downloadManager) throw new Error('Download manager not loaded');
    return { success: true, ready: downloadManager.isDownloaded(jobId) };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Read local PDF file and return as base64 data URL (for PDF.js compatibility)
ipcMain.handle('read-local-pdf', async (event, filePath) => {
  try {
    const fs = require('fs');

    if (!fs.existsSync(filePath)) {
      return { success: false, error: 'File not found: ' + filePath };
    }

    console.log('📂 [MAIN] Reading local PDF file:', filePath);
    const startTime = Date.now();

    const fileBuffer = fs.readFileSync(filePath);
    const base64 = fileBuffer.toString('base64');
    const dataUrl = `data:application/pdf;base64,${base64}`;

    const duration = Date.now() - startTime;
    console.log(`✅ [MAIN] Local PDF read in ${duration}ms (${Math.round(fileBuffer.length / 1024)}KB)`);

    return { success: true, dataUrl, size: fileBuffer.length };
  } catch (error) {
    console.error('❌ [MAIN] Failed to read local PDF:', error);
    return { success: false, error: error.message };
  }
});

// ============================================================================
// PAPER SIZE FUNCTIONS
// ============================================================================

// Get available paper sizes
ipcMain.handle('get-available-paper-sizes', async () => {
  try {
    const paperSizes = getAvailablePaperSizes();
    return {
      success: true,
      paperSizes
    };
  } catch (error) {
    console.error('Error getting paper sizes:', error);
    return { success: false, error: error.message };
  }
});

// ============================================================================
// DIRECT PRINTING FUNCTION FOR WINDOWS
// ============================================================================

// Direct printing for Windows using batch file
ipcMain.handle('direct-print-windows', async (event, filePath, printerName, paperSize = 'A4', copies = 1, colorMode = 'BW', printType = 'Single', nupPages = 1, nupOrientation = 'portrait', orderMark = null) => {
  try {
    console.log('🖨️ Direct Windows printing:', { filePath, printerName, paperSize, copies, colorMode, printType, nupPages, nupOrientation });

    if (process.platform !== 'win32') {
      throw new Error('Direct Windows printing is only available on Windows');
    }

    // Check if it's a PDF file
    const isPdf = path.extname(filePath).toLowerCase() === '.pdf';

    if (isPdf) {
      const canUseNativePrint =
        nativePrintEngine.isPDFtoPrinterAvailable(isDev) || nativePrintEngine.isSumatraAvailable(isDev);

      if (canUseNativePrint) {
        console.log('✅ Using Native Print Engine (direct-print path)', {
          pdfToPrinter: nativePrintEngine.isPDFtoPrinterAvailable(isDev),
          sumatra: nativePrintEngine.isSumatraAvailable(isDev),
          hasOrderMark: !!orderMark
        });
        return await nativePrintEngine.printPdfNatively(filePath, printerName, {
          paperSize,
          copies,
          colorMode,
          printType,
          nupPages: nupPages || 1,
          nupOrientation: nupOrientation || 'portrait',
          orderMark: orderMark || null
        }, isDev);
      }

      console.log('⚠️ Native print engine unavailable. Trying legacy methods — order ID on PDF will not be applied.');

      // LEGACY FALLBACK: Try cpdf if installed
      const isCpdftAvailable = await cpdftPrinting.isCpdftInstalled();

      if (isCpdftAvailable) {
        const cpdftResult = await cpdftPrinting.processPdfWithCpdf(filePath, printerName, paperSize, copies, colorMode, printType, nupPages || 1, nupOrientation);

        if (cpdftResult.success) {
          return await silentPdfPrinting.printPdfSilently(cpdftResult.processedFilePath, printerName, paperSize, copies, colorMode, printType, 1, nupOrientation);
        } else {
          console.log('⚠️ cpdf processing failed, falling back to other methods');
        }
      }



      // LEGACY FALLBACK: Try MuPDF
      const isMuPDFAvailable = await mupdfPrinting.isMuPDFInstalled();

      if (isMuPDFAvailable) {
        return await mupdfPrinting.printPdfSilently(filePath, printerName, paperSize, copies, colorMode, printType, nupPages, nupOrientation);
      }

      // LAST RESORT: Try silentPdfPrinting
      return await silentPdfPrinting.printPdfSilently(filePath, printerName, paperSize, copies, colorMode, printType, nupPages, nupOrientation);
    }

    // For non-PDF files, force paper size and use direct print
    await advancedPaperSizeControl.forcePaperSize(printerName, paperSize);
    const result = await directPrint.printFileDirectly(filePath, printerName, paperSize, copies, colorMode, printType);
    return result;
  } catch (error) {
    console.error('❌ Direct Windows printing failed:', error);
    return {
      success: false,
      error: error.message,
      filePath,
      printerName
    };
  }
});

// ============================================================================
// ADVANCED PAPER SIZE CONTROL FUNCTIONS
// ============================================================================

// Force paper size for a printer
ipcMain.handle('force-paper-size', async (event, printerName, paperSize) => {
  try {
    console.log('🔧 Forcing paper size:', { printerName, paperSize });

    if (process.platform !== 'win32') {
      throw new Error('Advanced paper size control is only available on Windows');
    }

    const result = await advancedPaperSizeControl.forcePaperSize(printerName, paperSize);
    return result;
  } catch (error) {
    console.error('❌ Force paper size failed:', error);
    return {
      success: false,
      error: error.message,
      printerName,
      paperSize
    };
  }
});

// Create test print with specific paper size
ipcMain.handle('create-test-print-with-paper-size', async (event, printerName, paperSize) => {
  try {
    console.log('🧪 Creating test print with paper size:', { printerName, paperSize });

    if (process.platform !== 'win32') {
      throw new Error('Advanced paper size control is only available on Windows');
    }

    const result = await advancedPaperSizeControl.createTestPrintWithPaperSize(printerName, paperSize);
    return result;
  } catch (error) {
    console.error('❌ Test print creation failed:', error);
    return {
      success: false,
      error: error.message,
      printerName,
      paperSize
    };
  }
});

// ============================================================================
// TEST PRINT FUNCTIONS FOR DIFFERENT PAPER SIZES
// ============================================================================

// Create and print test image for specific paper size
ipcMain.handle('create-test-image', async (event, paperSize) => {
  try {
    console.log('🧪 Creating test image for paper size:', paperSize);

    if (!isSupportedPaperSize(paperSize)) {
      console.warn(`Unsupported paper size: ${paperSize}, defaulting to A4`);
      paperSize = 'A4';
    }

    const result = await directPrint.createTestImageFile(paperSize);
    return result;
  } catch (error) {
    console.error('❌ Test image creation failed:', error);
    return {
      success: false,
      error: error.message,
      paperSize
    };
  }
});

// Create and print test PDF for specific paper size
ipcMain.handle('create-test-pdf', async (event, paperSize) => {
  try {
    console.log('🧪 Creating test PDF for paper size:', paperSize);

    if (!isSupportedPaperSize(paperSize)) {
      console.warn(`Unsupported paper size: ${paperSize}, defaulting to A4`);
      paperSize = 'A4';
    }

    const result = await directPrint.createTestPdfFile(paperSize);
    return result;
  } catch (error) {
    console.error('❌ Test PDF creation failed:', error);
    return {
      success: false,
      error: error.message,
      paperSize
    };
  }
});

// ============================================================================
// PDF FUNCTIONS
// ============================================================================

// Get PDF information
ipcMain.handle('get-pdf-info', async (event, filePath) => {
  try {
    console.log('📄 Getting PDF info for:', filePath);

    // This would use PDF.js in a real implementation
    // For now, we'll return mock data
    return {
      success: true,
      info: {
        numPages: 5,
        pageSize: {
          width: 595,
          height: 842,
          unit: 'pt'
        },
        isPortrait: true,
        suggestedPaperSize: 'A4'
      }
    };
  } catch (error) {
    console.error('❌ Failed to get PDF info:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

// Print PDF with specific paper size
ipcMain.handle('print-pdf', async (event, filePath, printerName, paperSize, copies = 1, colorMode = 'BW', printType = 'Single', nupPages = 1, nupOrientation = 'portrait') => {
  try {
    console.log('🖨️ Printing PDF with paper size:', {
      filePath,
      printerName,
      paperSize,
      copies,
      colorMode,
      printType,
      nupPages,
      nupOrientation
    });

    // Check if cpdf is installed (best option)
    const isCpdftAvailable = await cpdftPrinting.isCpdftInstalled();

    if (isCpdftAvailable) {
      // Use cpdf for PDF processing (best quality)
      const cpdftResult = await cpdftPrinting.processPdfWithCpdf(filePath, printerName, paperSize, copies, colorMode, printType, nupPages, nupOrientation);

      if (cpdftResult.success) {
        // Now print the processed file with SumatraPDF
        return await silentPdfPrinting.printPdfSilently(cpdftResult.processedFilePath, printerName, paperSize, copies, colorMode, printType, 1, nupOrientation);
      } else {
        console.log('⚠️ cpdf processing failed, falling back to other methods');
      }
    }

    // Check if MuPDF is installed as fallback
    const isMuPDFAvailable = await mupdfPrinting.isMuPDFInstalled();

    if (isMuPDFAvailable) {
      // Use MuPDF for PDF printing
      return await mupdfPrinting.printPdfSilently(filePath, printerName, paperSize, copies, colorMode, printType, nupPages);
    } else {
      // Fallback to SumatraPDF or other methods
      return await silentPdfPrinting.printPdfSilently(filePath, printerName, paperSize, copies, colorMode, printType, nupPages);
    }
  } catch (error) {
    console.error('❌ PDF printing failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

// Find installed PDF readers
ipcMain.handle('find-pdf-readers', async () => {
  try {
    console.log('🔍 Finding installed PDF readers');

    const readers = [];



    // Check for MuPDF
    const muPdfPath = await mupdfPrinting.findMuPDF();
    if (muPdfPath) {
      readers.push({
        name: 'MuPDF',
        path: muPdfPath,
        supportsCustomPaperSize: true,
        supportsSilentPrinting: true
      });
    }

    // Check for SumatraPDF
    const sumatraPath = await silentPdfPrinting.findSumatraPDF();
    if (sumatraPath) {
      readers.push({
        name: 'SumatraPDF',
        path: sumatraPath,
        supportsCustomPaperSize: true,
        supportsSilentPrinting: true
      });
    }

    // Add other readers from pdfPrintManager
    const otherReaders = await pdfPrintManager.findPdfReaders();
    if (otherReaders && otherReaders.length > 0) {
      readers.push(...otherReaders);
    }

    return {
      success: true,
      readers
    };
  } catch (error) {
    console.error('❌ Failed to find PDF readers:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

// Check if MuPDF is installed
ipcMain.handle('check-mupdf-installed', async () => {
  try {
    const isInstalled = await mupdfPrinting.isMuPDFInstalled();
    const version = isInstalled ? await mupdfPrinting.getMuPDFVersion() : null;

    return {
      success: true,
      installed: isInstalled,
      version
    };
  } catch (error) {
    console.error('Error checking MuPDF installation:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

// Check if cpdf is installed
ipcMain.handle('check-cpdf-installed', async () => {
  try {
    const isInstalled = await cpdftPrinting.isCpdftInstalled();
    const version = isInstalled ? await cpdftPrinting.getCpdftVersion() : null;

    return {
      success: true,
      installed: isInstalled,
      version
    };
  } catch (error) {
    console.error('Error checking cpdf installation:', error);
    return {
      success: false,
      error: error.message
    };
  }
});



// ============================================================================
// NATIVE PRINT ENGINE STATUS
// ============================================================================

// Check Native Print Engine status (pdf-lib + bundled SumatraPDF)
ipcMain.handle('check-native-print-engine', async () => {
  try {
    const isSumatraAvailable = nativePrintEngine.isSumatraAvailable(isDev);
    const sumatraPath = nativePrintEngine.getSumatraPath(isDev);

    return {
      success: true,
      available: isSumatraAvailable,
      sumatraPath,
      engine: 'Native Print Engine (pdf-lib + bundled SumatraPDF)',
      features: {
        nupLayouts: true,
        paperSizeControl: true,
        silentPrinting: isSumatraAvailable,
        colorModeControl: true,
        duplexPrinting: true
      },
      message: isSumatraAvailable
        ? 'Native Print Engine ready - no external dependencies needed!'
        : 'SumatraPDF.exe not found in extraResources folder. Please add it to enable silent printing.'
    };
  } catch (error) {
    console.error('Error checking Native Print Engine:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

// Cleanup temp files from Native Print Engine
ipcMain.handle('cleanup-native-engine-temp', async () => {
  try {
    const result = nativePrintEngine.cleanupTempFiles();
    return result;
  } catch (error) {
    console.error('Error cleaning up Native Print Engine temp files:', error);
    return {
      success: false,
      error: error.message
    };
  }
});
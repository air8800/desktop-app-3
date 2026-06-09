"use strict";

const { app, shell } = require("electron");
const { isProduction } = require("./appConfig");

const DEVTOOLS_SHORTCUTS = new Set([
  "f12",
  "i",
  "j",
  "c",
  "u",
  "k",
]);

function isDevtoolsShortcut(input) {
  if (!input || input.type === "keyUp") return false;
  const key = String(input.key || "").toLowerCase();
  if (key === "f12") return true;
  const mod = input.control || input.meta;
  const shift = input.shift;
  if (!mod || !shift) return false;
  return DEVTOOLS_SHORTCUTS.has(key);
}

function suppressConsoleInProduction() {
  if (!isProduction) return;
  const noop = () => {};
  console.log = noop;
  console.info = noop;
  console.debug = noop;
  console.warn = noop;
}

function applyAppHardening() {
  if (!isProduction) return;

  app.commandLine.appendSwitch("disable-features", "ElectronDevToolsExtensions");
  app.commandLine.appendSwitch("disable-blink-features", "AutomationControlled");
}

function hardenBrowserWindow(win, { appOrigin = null, allowDevtools = false } = {}) {
  if (!win || win.isDestroyed()) return;

  const webContents = win.webContents;

  if (!isProduction || allowDevtools) return;

  webContents.on("devtools-opened", () => {
    webContents.closeDevTools();
  });

  webContents.on("before-input-event", (event, input) => {
    if (isDevtoolsShortcut(input)) {
      event.preventDefault();
    }
  });

  webContents.on("will-navigate", (event, url) => {
    if (url.startsWith("file://")) return;
    if (appOrigin && url.startsWith(appOrigin)) return;
    event.preventDefault();
    if (/^https?:\/\//i.test(url)) {
      shell.openExternal(url).catch(() => {});
    }
  });

  webContents.on("will-attach-webview", (event) => {
    event.preventDefault();
  });

  webContents.setVisualZoomLevelLimits(1, 1);
}

module.exports = {
  suppressConsoleInProduction,
  applyAppHardening,
  hardenBrowserWindow,
};

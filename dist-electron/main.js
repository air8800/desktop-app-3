"use strict";
const { app, BrowserWindow, ipcMain, dialog, Menu } = require("electron");
const path = require("path");
const isDev = require("electron-is-dev");
const Store = require("electron-store");
const { exec } = require("child_process");
const util = require("util");
const execPromise = util.promisify(exec);
const store = new Store();
let mainWindow;
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js")
    },
    icon: path.join(__dirname, "../public/icon.png"),
    // Remove the menu bar
    autoHideMenuBar: true,
    menuBarVisible: false
  });
  Menu.setApplicationMenu(null);
  const startUrl = isDev ? "http://localhost:5173" : `file://${path.join(__dirname, "../dist/index.html")}`;
  mainWindow.loadURL(startUrl);
  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}
app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
ipcMain.handle("save-qr-image", async (event, imageData) => {
  try {
    store.set("payment-qr", imageData);
    return { success: true };
  } catch (error) {
    console.error("Error saving QR image:", error);
    return { success: false, error: error.message };
  }
});
ipcMain.handle("get-qr-image", async () => {
  try {
    const qrImage = store.get("payment-qr");
    return { success: true, data: qrImage };
  } catch (error) {
    console.error("Error getting QR image:", error);
    return { success: false, error: error.message };
  }
});
ipcMain.handle("upload-qr-image", async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ["openFile"],
      filters: [{ name: "Images", extensions: ["jpg", "png", "jpeg"] }]
    });
    if (result.canceled) {
      return { success: false, error: "File selection canceled" };
    }
    store.set("payment-qr", result.filePaths[0]);
    return { success: true, path: result.filePaths[0] };
  } catch (error) {
    console.error("Error uploading QR image:", error);
    return { success: false, error: error.message };
  }
});
ipcMain.handle("get-printers", async () => {
  try {
    let printers = [];
    if (process.platform === "win32") {
      try {
        const { stdout } = await execPromise('powershell.exe -Command "Get-Printer | Select-Object Name,PrinterStatus,IsDefault | ConvertTo-Json"');
        if (stdout) {
          const systemPrinters = JSON.parse(stdout);
          const printersArray = Array.isArray(systemPrinters) ? systemPrinters : [systemPrinters];
          printers = printersArray.map((printer) => ({
            name: printer.Name,
            status: printer.PrinterStatus === 1 ? "Ready" : "Not Ready",
            default: printer.IsDefault || false
          }));
        }
      } catch (error) {
        console.error("Error getting system printers:", error);
      }
    }
    if (printers.length === 0) {
      printers.push({
        name: "Microsoft Print to PDF",
        status: "Ready",
        default: true
      });
    }
    return { success: true, printers };
  } catch (error) {
    console.error("Error getting printers:", error);
    return { success: false, error: error.message };
  }
});
ipcMain.handle("mark-job-printed", async (event, jobId) => {
  try {
    return { success: true, jobId };
  } catch (error) {
    console.error("Error marking job as printed:", error);
    return { success: false, error: error.message };
  }
});

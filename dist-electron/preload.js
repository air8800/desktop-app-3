"use strict";
const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld(
  "electron",
  {
    // QR Code functions
    saveQRImage: (imageData) => ipcRenderer.invoke("save-qr-image", imageData),
    getQRImage: () => ipcRenderer.invoke("get-qr-image"),
    uploadQRImage: () => ipcRenderer.invoke("upload-qr-image"),
    // Printer functions
    getPrinters: () => ipcRenderer.invoke("get-printers"),
    // Job management
    markJobPrinted: (jobId) => ipcRenderer.invoke("mark-job-printed", jobId)
  }
);

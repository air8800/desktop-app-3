const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld(
  "electron",
  {
    // QR Code functions
    saveQRImage: (imageData) => ipcRenderer.invoke("save-qr-image", imageData),
    getQRImage: () => ipcRenderer.invoke("get-qr-image"),
    uploadQRImage: () => ipcRenderer.invoke("upload-qr-image"),

    // Printer functions
    getPrinters: () => ipcRenderer.invoke("get-printers"),

    // Print job functions with paper size support
    downloadAndPrintFile: (fileUrl, filename, printerName, copies, paperSize, colorMode, printType, nupPages, nupOrientation, orderMark) =>
      ipcRenderer.invoke("download-and-print-file", fileUrl, filename, printerName, copies, paperSize, colorMode, printType, nupPages, nupOrientation, orderMark),

    // Test printer function with paper size
    testPrint: (printerName, paperSize) =>
      ipcRenderer.invoke("test-print", printerName, paperSize),

    openFileForPrinting: (fileUrl, filename) =>
      ipcRenderer.invoke("open-file-for-printing", fileUrl, filename),

    cleanupPrintFiles: () => ipcRenderer.invoke("cleanup-print-files"),

    // Job management
    markJobPrinted: (jobId) => ipcRenderer.invoke("mark-job-printed", jobId),

    // Paper size functions
    getAvailablePaperSizes: () => ipcRenderer.invoke("get-available-paper-sizes"),

    // Direct Windows printing function
    directPrintWindows: (filePath, printerName, paperSize, copies, colorMode, printType, nupPages, nupOrientation) =>
      ipcRenderer.invoke("direct-print-windows", filePath, printerName, paperSize, copies, colorMode, printType, nupPages, nupOrientation),

    // Test print functions for different paper sizes
    createTestImage: (paperSize) => ipcRenderer.invoke("create-test-image", paperSize),
    createTestPdf: (paperSize) => ipcRenderer.invoke("create-test-pdf", paperSize),

    // Advanced paper size control functions
    forcePaperSize: (printerName, paperSize) =>
      ipcRenderer.invoke("force-paper-size", printerName, paperSize),

    createTestPrintWithPaperSize: (printerName, paperSize) =>
      ipcRenderer.invoke("create-test-print-with-paper-size", printerName, paperSize),

    // PDF functions
    getPdfInfo: (filePath) => ipcRenderer.invoke("get-pdf-info", filePath),
    findPdfReaders: () => ipcRenderer.invoke("find-pdf-readers"),

    // MuPDF functions
    checkMuPDFInstalled: () => ipcRenderer.invoke("check-mupdf-installed"),

    // cpdf functions
    checkCpdftInstalled: () => ipcRenderer.invoke("check-cpdf-installed"),


    // Recipe-based PDF processing
    processPdfWithRecipe: (pdfUrl, recipe) =>
      ipcRenderer.invoke("process-pdf-with-recipe", pdfUrl, recipe),

    // Expand short URLs
    expandUrl: (url) => ipcRenderer.invoke("expand-url", url),
    fetchMapsPlaceAddress: (url) => ipcRenderer.invoke("fetch-maps-place-address", url),
    getMapsWindowUrl: () => ipcRenderer.invoke("get-maps-window-url"),

    // Auth session (electron-store)
    authGetSession: () => ipcRenderer.invoke("auth-get-session"),
    authSetSession: (session) => ipcRenderer.invoke("auth-set-session", session),
    authClearSession: () => ipcRenderer.invoke("auth-clear-session"),
    openExternalUrl: (url) => ipcRenderer.invoke("open-external-url", url),
    partnerApiFetch: (path, options) => ipcRenderer.invoke("partner-api-fetch", { path, ...options }),
    prepareOAuthRedirect: () => ipcRenderer.invoke("prepare-oauth-redirect"),
    stopOAuthRedirect: () => ipcRenderer.invoke("stop-oauth-redirect"),
    openOAuthSignIn: (url) => ipcRenderer.invoke("open-oauth-sign-in", url),
    onOAuthCallback: (callback) => {
      const handler = (_event, url) => callback(url);
      ipcRenderer.on("oauth-callback", handler);
      return () => ipcRenderer.removeListener("oauth-callback", handler);
    },

    // App lifecycle — close confirmation from renderer
    onAppCloseRequested: (callback) => {
      const handler = () => callback();
      ipcRenderer.on("app-close-requested", handler);
      return () => ipcRenderer.removeListener("app-close-requested", handler);
    },
    confirmAppQuit: () => ipcRenderer.invoke("app-quit-confirmed"),

    // Download manager functions
    downloadStart: (jobId, fileUrl, filename) =>
      ipcRenderer.invoke("download-start", jobId, fileUrl, filename),
    downloadPause: (jobId) => ipcRenderer.invoke("download-pause", jobId),
    downloadResume: (jobId) => ipcRenderer.invoke("download-resume", jobId),
    downloadCancel: (jobId) => ipcRenderer.invoke("download-cancel", jobId),
    downloadDelete: (jobId) => ipcRenderer.invoke("download-delete", jobId),
    downloadStatus: () => ipcRenderer.invoke("download-status"),
    downloadGetPath: (jobId) => ipcRenderer.invoke("download-get-path", jobId),
    downloadIsReady: (jobId) => ipcRenderer.invoke("download-is-ready", jobId),

    // Read local PDF file as base64 data URL (for PDF.js compatibility)
    readLocalPdf: (filePath) => ipcRenderer.invoke("read-local-pdf", filePath),

    onDownloadUpdate: (callback) => {
      ipcRenderer.on("download-update", (event, data) => callback(data));
      return () => ipcRenderer.removeAllListeners("download-update");
    }
  }
);
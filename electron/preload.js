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
    downloadAndPrintFile: (fileUrl, filename, printerName, copies, paperSize, colorMode, printType, nupPages, nupOrientation) =>
      ipcRenderer.invoke("download-and-print-file", fileUrl, filename, printerName, copies, paperSize, colorMode, printType, nupPages, nupOrientation),
    
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
    
    // Ghostscript functions
    checkGhostscriptInstalled: () => ipcRenderer.invoke("check-ghostscript-installed")
  }
);
/// <reference types="vite/client" />

interface Window {
  electron: {
    saveQRImage: (imageData: string) => Promise<{ success: boolean, error?: string }>;
    getQRImage: () => Promise<{ success: boolean, data: string | null, error?: string }>;
    uploadQRImage: () => Promise<{ success: boolean, path?: string, error?: string }>;
    getPrinters: () => Promise<{ success: boolean, printers: Array<{ name: string, status: string, default: boolean, supportedPaperSizes?: string[] }>, error?: string }>;
    
    // 🔥 FIXED: Print job functions with paper size support
    downloadAndPrintFile: (fileUrl: string, filename: string, printerName: string, copies?: number, paperSize?: string, colorMode?: string, printType?: string, nupPages?: number, nupOrientation?: string) =>
      Promise<{ success: boolean, message?: string, filePath?: string, printCommand?: string, paperSize?: string, error?: string }>;
    
    // 🔥 ENHANCED: Test printer function with paper size
    testPrint: (printerName: string, paperSize?: string) => 
      Promise<{ success: boolean, command?: string, paperSize?: string, error?: string }>;
    
    openFileForPrinting: (fileUrl: string, filename: string) => 
      Promise<{ success: boolean, message?: string, filePath?: string, error?: string }>;
    
    cleanupPrintFiles: () => Promise<{ success: boolean, cleanedCount?: number, error?: string }>;
    
    markJobPrinted: (jobId: string) => Promise<{ success: boolean, jobId: string, error?: string }>;
    
    // 🔥 NEW: Paper size functions
    getAvailablePaperSizes: () => Promise<{ success: boolean, paperSizes?: Array<{ key: string, name: string, description: string, width: number, height: number, unit: string }>, error?: string }>;
    
    // 🔥 NEW: Direct Windows printing
    directPrintWindows: (filePath: string, printerName: string, paperSize: string, copies: number, colorMode?: string, printType?: string, nupPages?: number, nupOrientation?: string) =>
      Promise<{ success: boolean, message?: string, error?: string }>;
      
    // 🔥 NEW: PDF functions
    getPdfInfo: (filePath: string) => Promise<{ success: boolean, info?: any, error?: string }>;
    printPdf: (filePath: string, printerName: string, paperSize: string, copies: number, colorMode?: string, printType?: string, nupPages?: number, nupOrientation?: string) =>
      Promise<{ success: boolean, message?: string, error?: string }>;
    findPdfReaders: () => Promise<{ success: boolean, readers?: any, error?: string }>;
    
    // 🔥 NEW: MuPDF functions
    checkMuPDFInstalled: () => Promise<{ success: boolean, installed: boolean, version?: string, error?: string }>;
    
    // 🔥 NEW: cpdf functions
    checkCpdftInstalled: () => Promise<{ success: boolean, installed: boolean, version?: string, error?: string }>;
    
    // 🔥 NEW: Ghostscript functions
    checkGhostscriptInstalled: () => Promise<{ success: boolean, installed: boolean, version?: string, error?: string }>;
  };
}
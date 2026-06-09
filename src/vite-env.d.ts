/// <reference types="vite/client" />

interface Window {
  electron: {
    saveQRImage: (imageData: string) => Promise<{ success: boolean, error?: string }>;
    getQRImage: () => Promise<{ success: boolean, data: string | null, error?: string }>;
    uploadQRImage: () => Promise<{ success: boolean, path?: string, error?: string }>;
    getPrinters: () => Promise<{ success: boolean, printers: Array<{ name: string, status: string, default: boolean, supportedPaperSizes?: string[] }>, error?: string }>;

    // 🔥 FIXED: Print job functions with paper size support
    downloadAndPrintFile: (
      fileUrl: string,
      filename: string,
      printerName: string,
      copies?: number,
      paperSize?: string,
      colorMode?: string,
      printType?: string,
      nupPages?: number,
      nupOrientation?: string,
      orderMark?: {
        shopOrderNumber?: number | null;
        orderIdentification?: string | null;
        orderUuid?: string;
        slipBranding?: {
          shopName?: string;
          shopWebUrl?: string;
          qrImageUrl?: string | null;
        } | null;
      } | null
    ) => Promise<{ success: boolean, message?: string, filePath?: string, printCommand?: string, paperSize?: string, error?: string }>;

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



    // 🔥 NEW: Recipe-based PDF processing
    processPdfWithRecipe: (pdfUrl: string, recipe: any) => Promise<{
      success: boolean,
      processedPath?: string,
      processedUrl?: string,
      processed?: boolean,
      originalSize?: number,
      processedSize?: number,
      error?: string
    }>;

    // 📥 Download manager functions
    downloadStart: (jobId: string, fileUrl: string, filename: string) => Promise<{ success: boolean, filePath?: string, cached?: boolean, error?: string }>;
    downloadPause: (jobId: string) => Promise<{ success: boolean, error?: string }>;
    downloadResume: (jobId: string) => Promise<{ success: boolean, error?: string }>;
    downloadCancel: (jobId: string) => Promise<{ success: boolean, error?: string }>;
    downloadDelete: (jobId: string) => Promise<{ success: boolean, error?: string }>;
    downloadStatus: () => Promise<{ success: boolean, downloading?: any[], downloaded?: any[], error?: string }>;
    downloadGetPath: (jobId: string) => Promise<{ success: boolean, filePath?: string, error?: string }>;
    downloadIsReady: (jobId: string) => Promise<{ success: boolean, ready?: boolean, error?: string }>;
    onDownloadUpdate: (callback: (data: { downloading: any[], downloaded: any[] }) => void) => () => void;

    expandUrl: (url: string) => Promise<string>;
    fetchMapsPlaceAddress: (url: string) => Promise<{ address: string; expandedUrl: string }>;
    getMapsWindowUrl: () => Promise<string>;

    authGetSession: () => Promise<{ success: boolean; session?: unknown; error?: string }>;
    authSetSession: (session: unknown) => Promise<{ success: boolean; error?: string }>;
    authClearSession: () => Promise<{ success: boolean; error?: string }>;
    openExternalUrl: (url: string) => Promise<{ success: boolean; error?: string }>;
    partnerApiFetch: (
      path: string,
      options?: { method?: string; body?: unknown; headers?: Record<string, string> }
    ) => Promise<{ ok: boolean; status: number; data: unknown; error?: string }>;
    prepareOAuthRedirect: () => Promise<{ success: boolean; redirectUrl?: string; error?: string }>;
    stopOAuthRedirect: () => Promise<{ success: boolean }>;
    openOAuthSignIn: (url: string) => Promise<{ success: boolean; error?: string }>;
    onOAuthCallback: (callback: (url: string) => void) => () => void;

    onAppCloseRequested: (callback: () => void) => () => void;
    confirmAppQuit: () => Promise<{ success: boolean; error?: string }>;

    // 📂 Read local PDF file as base64 data URL (for PDF.js compatibility)
    readLocalPdf: (filePath: string) => Promise<{ success: boolean, dataUrl?: string, size?: number, error?: string }>;
  };
}
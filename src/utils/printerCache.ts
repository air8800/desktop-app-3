/**
 * Printer Cache Utility
 * Caches printer list to avoid repeated IPC calls on every preview open.
 */

interface PrinterInfo {
    name: string;
    status: string;
    default: boolean;
}

interface PrinterCache {
    printers: PrinterInfo[];
    lastUpdated: number;
    isLoading: boolean;
    loadPromise: Promise<PrinterInfo[]> | null;
}

// Global cache (survives re-renders, cleared on app restart)
const printerCache: PrinterCache = {
    printers: [],
    lastUpdated: 0,
    isLoading: false,
    loadPromise: null,
};

// Cache expires after 5 minutes
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Get printers from cache or load if needed.
 * Uses singleton pattern to prevent duplicate IPC calls.
 */
export const getCachedPrinters = async (): Promise<PrinterInfo[]> => {
    const now = Date.now();

    // Return cached if valid
    if (printerCache.printers.length > 0 && (now - printerCache.lastUpdated) < CACHE_TTL_MS) {
        console.log('🖨️ [CACHE] Using cached printers:', printerCache.printers.length);
        return printerCache.printers;
    }

    // If already loading, wait for the existing promise
    if (printerCache.isLoading && printerCache.loadPromise) {
        console.log('🖨️ [CACHE] Waiting for existing printer load...');
        return printerCache.loadPromise;
    }

    // Start loading
    printerCache.isLoading = true;
    console.log('🖨️ [CACHE] Loading printers from Electron...');

    printerCache.loadPromise = (async () => {
        try {
            if (window.electron?.getPrinters) {
                const result = await window.electron.getPrinters();
                if (result.success && result.printers) {
                    printerCache.printers = result.printers;
                    printerCache.lastUpdated = Date.now();
                    console.log('🖨️ [CACHE] Printers cached:', result.printers.length);
                    return result.printers;
                }
            }
            return [];
        } catch (error) {
            console.error('🖨️ [CACHE] Error loading printers:', error);
            return [];
        } finally {
            printerCache.isLoading = false;
            printerCache.loadPromise = null;
        }
    })();

    return printerCache.loadPromise;
};

/**
 * Get default printer from cached list.
 */
export const getDefaultPrinter = async (): Promise<PrinterInfo | null> => {
    const printers = await getCachedPrinters();
    return printers.find(p => p.default) || printers[0] || null;
};

/**
 * Force refresh printer cache.
 */
export const refreshPrinterCache = async (): Promise<PrinterInfo[]> => {
    printerCache.lastUpdated = 0; // Invalidate cache
    return getCachedPrinters();
};

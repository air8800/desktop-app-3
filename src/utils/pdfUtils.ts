import * as pdfjsLib from 'pdfjs-dist';
import { assetUrl } from './assetUrl';

// Resolve worker/cMap paths relative to the document URL so they work both in
// dev (served from "/") and in production Electron builds loaded via file://,
// where a leading "/" would incorrectly resolve to the filesystem root.
const PDF_WORKER_SRC = assetUrl('pdf-worker/pdf.worker.min.js');
const PDF_CMAP_URL = assetUrl('pdf-worker/cmaps/');

pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_WORKER_SRC;

// PDF Document Cache - dramatically improves performance by avoiding re-downloads
interface CachedPdfDocument {
  document: pdfjsLib.PDFDocumentProxy;
  url: string;
  loadedAt: number;
}

const pdfCache = new Map<string, CachedPdfDocument>();
const CACHE_EXPIRY_MS = 10 * 60 * 1000;

/**
 * Get or load a PDF document with caching
 * This dramatically speeds up repeated access to the same PDF
 */
export const getCachedPdfDocument = async (
  fileUrl: string,
  onProgress?: (loaded: number, total: number) => void
): Promise<pdfjsLib.PDFDocumentProxy> => {
  const cached = pdfCache.get(fileUrl);
  const now = Date.now();

  if (cached && (now - cached.loadedAt) < CACHE_EXPIRY_MS) {
    console.log('✅ Using cached PDF document:', fileUrl);
    return cached.document;
  }

  // If cached but expired, destroy the old document to free memory
  if (cached) {
    console.log('🔄 Cache expired, destroying old PDF document');
    cached.document.destroy();
  }

  console.log('📥 Loading PDF document:', fileUrl);

  const loadingTask = pdfjsLib.getDocument({
    url: fileUrl,
    cMapUrl: PDF_CMAP_URL,
    cMapPacked: true,
    disableRange: false,
    disableStream: false,
    disableAutoFetch: false
  });

  // Track download progress if callback provided
  if (onProgress) {
    loadingTask.onProgress = (progressData: { loaded: number; total: number }) => {
      if (progressData.total > 0) {
        const percent = Math.round((progressData.loaded / progressData.total) * 100);
        console.log(`📥 Download progress: ${percent}% (${Math.round(progressData.loaded / 1024)}KB / ${Math.round(progressData.total / 1024)}KB)`);
        onProgress(progressData.loaded, progressData.total);
      }
    };
  }

  const pdfDocument = await loadingTask.promise;

  pdfCache.set(fileUrl, {
    document: pdfDocument,
    url: fileUrl,
    loadedAt: now
  });

  console.log(`💾 PDF cached (cache size: ${pdfCache.size})`);

  return pdfDocument;
};

/**
 * Clear the PDF cache (useful when memory is limited)
 * Properly destroys PDF documents to free memory
 */
export const clearPdfCache = () => {
  pdfCache.forEach((cached) => {
    cached.document.destroy();
  });
  pdfCache.clear();
  console.log('🗑️ PDF cache cleared and memory freed');
};

/**
 * Preload a PDF in the background for instant viewing later
 * Returns a Promise that resolves when the PDF is cached
 */
export const preloadPdf = async (fileUrl: string): Promise<void> => {
  if (!fileUrl) return;

  console.log('🚀 Preloading PDF in background:', fileUrl);

  try {
    await getCachedPdfDocument(fileUrl);
    console.log('✅ PDF preloaded successfully:', fileUrl);
  } catch (error) {
    console.warn('⚠️ PDF preload failed (non-critical):', error);
    // Don't throw - allow upload to succeed even if preload fails
  }
};

// Interface for PDF document info
export interface PdfInfo {
  numPages: number;
  pageSize: {
    width: number;
    height: number;
    unit: string;
  };
  isPortrait: boolean;
  title?: string;
  author?: string;
  suggestedPaperSize?: string;
}

/**
 * Get information about a PDF document
 * @param fileUrl URL or path to the PDF file
 * @returns Promise with PDF information
 */
export const getPdfInfo = async (fileUrl: string): Promise<PdfInfo> => {
  try {
    const pdfDocument = await getCachedPdfDocument(fileUrl);

    // Get the first page to determine size
    const page = await pdfDocument.getPage(1);
    const viewport = page.getViewport({ scale: 1.0 });

    // Get document metadata with type assertion
    const metadata = await pdfDocument.getMetadata() as any;

    // Determine if portrait or landscape
    const isPortrait = viewport.width <= viewport.height;

    // Determine suggested paper size based on dimensions
    const suggestedPaperSize = determinePaperSize(viewport.width, viewport.height);

    return {
      numPages: pdfDocument.numPages,
      pageSize: {
        width: viewport.width,
        height: viewport.height,
        unit: 'pt' // PDF uses points (1/72 inch)
      },
      isPortrait,
      title: metadata?.info?.Title,
      author: metadata?.info?.Author,
      suggestedPaperSize
    };
  } catch (error) {
    console.error('Error getting PDF info:', error);
    throw error;
  }
};

/**
 * Calculate optimal scale to fit PDF page in container at 100% view
 * @param pdfWidth PDF page width in points
 * @param pdfHeight PDF page height in points
 * @param containerWidth Container width in pixels
 * @param containerHeight Container height in pixels
 * @param maxScale Maximum scale to prevent over-zooming
 * @returns Optimal scale factor
 */
export const calculateOptimalScale = (
  pdfWidth: number,
  pdfHeight: number,
  containerWidth: number,
  containerHeight: number,
  maxScale: number = 1.5
): number => {
  // Calculate scale to fit width and height
  const scaleX = (containerWidth * 0.85) / pdfWidth; // 85% of container width for padding
  const scaleY = (containerHeight * 0.85) / pdfHeight; // 85% of container height for padding

  // Use the smaller scale to ensure the page fits completely
  const optimalScale = Math.min(scaleX, scaleY);

  // Ensure we don't exceed maxScale and don't go below 0.3
  return Math.max(0.3, Math.min(optimalScale, maxScale));
};

/**
 * Get PDF page viewport with optimal scaling
 * @param fileUrl URL or path to the PDF file
 * @param pageNumber Page number to get viewport for
 * @param containerWidth Container width in pixels
 * @param containerHeight Container height in pixels
 * @returns Promise with viewport and optimal scale
 */
export const getPdfPageViewport = async (
  fileUrl: string,
  pageNumber: number,
  containerWidth: number,
  containerHeight: number
): Promise<{ viewport: any; optimalScale: number; pageWidth: number; pageHeight: number }> => {
  try {
    const pdfDocument = await getCachedPdfDocument(fileUrl);
    const page = await pdfDocument.getPage(pageNumber);

    // Get page dimensions at scale 1.0
    const baseViewport = page.getViewport({ scale: 1.0 });

    // Calculate optimal scale for 100% view
    const optimalScale = calculateOptimalScale(
      baseViewport.width,
      baseViewport.height,
      containerWidth,
      containerHeight
    );

    // Get viewport with optimal scale
    const viewport = page.getViewport({ scale: optimalScale });

    console.log('📐 PDF Page Viewport Calculation:', {
      pageNumber,
      baseWidth: baseViewport.width,
      baseHeight: baseViewport.height,
      containerWidth,
      containerHeight,
      optimalScale: optimalScale.toFixed(3),
      finalWidth: viewport.width,
      finalHeight: viewport.height
    });

    return {
      viewport,
      optimalScale,
      pageWidth: baseViewport.width,
      pageHeight: baseViewport.height
    };
  } catch (error) {
    console.error('Error getting PDF page viewport:', error);
    throw error;
  }
};

/**
 * Determine the closest standard paper size based on dimensions
 * @param width Width in points
 * @param height Height in points
 * @returns Suggested paper size name
 */
const determinePaperSize = (width: number, height: number): string => {
  // Convert to mm (1 pt = 0.352778 mm)
  const widthMm = width * 0.352778;
  const heightMm = height * 0.352778;

  // Sort dimensions to compare regardless of orientation
  const [smallerDim, largerDim] = [widthMm, heightMm].sort((a, b) => a - b);

  // Standard paper sizes in mm [width, height] (smaller dimension first)
  const paperSizes = {
    'A3': [297, 420],
    'A4': [210, 297],
    'A5': [148, 210],
    'Letter': [216, 279], // 8.5 x 11 inches in mm
    'Legal': [216, 356],  // 8.5 x 14 inches in mm
    'Executive': [184, 267] // 7.25 x 10.5 inches in mm
  };

  // Find the closest match
  let closestSize = 'A4'; // Default
  let minDifference = Number.MAX_VALUE;

  for (const [size, [w, h]] of Object.entries(paperSizes)) {
    // Calculate difference as percentage of area
    const areaDiff = Math.abs((smallerDim * largerDim) - (w * h)) / (w * h);

    if (areaDiff < minDifference) {
      minDifference = areaDiff;
      closestSize = size;
    }
  }

  return closestSize;
};

/**
 * Get page dimensions at a specific scale
 * @param fileUrl URL or path to the PDF file
 * @param pageNumber Page number (1-based)
 * @param scale Scale factor
 * @returns Promise with scaled width and height
 */
export const getScaledPageDimensions = async (
  fileUrl: string,
  pageNumber: number,
  scale: number
): Promise<{ width: number; height: number }> => {
  try {
    const pdfDocument = await getCachedPdfDocument(fileUrl);
    const page = await pdfDocument.getPage(pageNumber);
    const viewport = page.getViewport({ scale });
    return {
      width: viewport.width,
      height: viewport.height
    };
  } catch (error) {
    console.error('Error getting scaled page dimensions:', error);
    throw error;
  }
};

/**
 * Render a PDF page to a canvas element
 * @param fileUrl URL or path to the PDF file
 * @param pageNumber Page number to render (1-based)
 * @param canvas Canvas element to render to
 * @param scale Scale factor for rendering
 */
export const renderPdfPage = async (
  fileUrl: string,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  scale: number = 1.0
): Promise<void> => {
  try {
    const pdfDocument = await getCachedPdfDocument(fileUrl);

    // Get the requested page
    const page = await pdfDocument.getPage(pageNumber);

    // Set up canvas for rendering
    const viewport = page.getViewport({ scale });
    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('Could not get canvas context');
    }

    canvas.height = viewport.height;
    canvas.width = viewport.width;

    // Render the page
    const renderContext = {
      canvasContext: context,
      viewport: viewport
    };

    await page.render(renderContext).promise;

  } catch (error) {
    console.error('Error rendering PDF page:', error);
    throw error;
  }
};

/**
 * Get the total number of pages in a PDF document
 * @param fileUrl URL or path to the PDF file
 * @param onProgress Optional callback for download progress updates
 * @returns Promise with the number of pages
 */
export const getPdfPageCount = async (
  fileUrl: string,
  onProgress?: (loaded: number, total: number) => void
): Promise<number> => {
  try {
    const pdfDocument = await getCachedPdfDocument(fileUrl, onProgress);
    return pdfDocument.numPages;
  } catch (error) {
    console.error('Error getting PDF page count:', error);
    throw error;
  }
};

/**
 * Check if a file is a valid PDF
 * @param file File object to check
 * @returns Promise<boolean> indicating if the file is a valid PDF
 */
export const isValidPdf = async (file: File): Promise<boolean> => {
  try {
    // Check file extension first
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return false;
    }

    // Try to load the first page
    const fileUrl = URL.createObjectURL(file);
    const loadingTask = pdfjsLib.getDocument({
      url: fileUrl,
      cMapUrl: PDF_CMAP_URL,
      cMapPacked: true,
      disableRange: false,
      disableStream: false,
      disableAutoFetch: false
    });

    const pdfDocument = await loadingTask.promise;

    // If we can get the first page, it's a valid PDF
    await pdfDocument.getPage(1);

    // Clean up
    URL.revokeObjectURL(fileUrl);

    return true;
  } catch (error) {
    console.error('Invalid PDF file:', error);
    return false;
  }
};

/**
 * Get the appropriate paper size for printing a PDF
 * @param fileUrl URL or path to the PDF file
 * @returns Promise with the suggested paper size
 */
export const getSuggestedPaperSize = async (fileUrl: string): Promise<string> => {
  const pdfInfo = await getPdfInfo(fileUrl);
  return pdfInfo.suggestedPaperSize || 'A4'; // Default to A4 if no suggestion
};
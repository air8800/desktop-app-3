import React, { useEffect, useRef, useState, useCallback } from 'react';
import { getPdfPageCount, getScaledPageDimensions } from '../utils/pdfUtils';
import {
  renderNupPreview,
  renderSinglePageOnPaper,
  applyGrayscaleFilter,
  calculateNupOptimalScale,
  calculatePaperOptimalScale,
  drawSettingsIndicators,
  PAPER_SIZES,
  PaperSizeKey,
  calculateTotalSheets,
  getSheetStartPage,
  getSheetPages,
  getSheetFromPage,
  calculateNupLayout
} from '../utils/pdfTransformations';
import { getCachedPrinters, getDefaultPrinter } from '../utils/printerCache';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Printer, Download, FileText, AlertTriangle, RefreshCw, Maximize, Minimize, Settings, X } from 'lucide-react';

interface PdfPreviewProps {
  fileUrl: string;
  jobData?: {
    paper_size?: string;
    copies?: number;
    color_mode?: 'BW' | 'Color';
    print_type?: 'Single' | 'Double';
    pages_per_sheet?: number;
    nup_orientation?: 'portrait' | 'landscape';
    margin?: 'off' | 'low' | 'normal';
  };
  onPrint?: (printOptions: {
    printerName: string;
    paperSize: string;
    copies: number;
    colorMode: string;
    printType: string;
    nupPages: number;
    nupOrientation: string;
  }) => Promise<void>;
  onClose?: () => void;
  isProcessing?: boolean; // New prop to control external processing state
  isDownloading?: boolean; // New prop for download state
  downloadProgress?: number; // New prop for download progress
}

const PdfPreview: React.FC<PdfPreviewProps> = ({
  fileUrl,
  jobData,
  onPrint,
  onClose,
  isProcessing = false,
  isDownloading = false,
  downloadProgress = 0
}) => {
  const mountStart = performance.now();
  // Use a ref to log only on mount, not every render
  const isFirstRender = useRef(true);
  if (isFirstRender.current) {
    console.log(`⚡ [PERF] PdfPreview MOUNTING at ${mountStart.toFixed(2)}ms`);
  }

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const renderLockRef = useRef(false);
  const renderTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const enhancementTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const renderVersionRef = useRef(0); // Track render version to prevent stale renders

  // PDF state - simplified to only track sheet number
  const [currentSheet, setCurrentSheet] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.0);
  const [optimalScale, setOptimalScale] = useState(1.0);
  const [pageWidth, setPageWidth] = useState(0);
  const [pageHeight, setPageHeight] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingStatus, setLoadingStatus] = useState('Initializing...');
  const [isRendering, setIsRendering] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [showEnhancingBadge, setShowEnhancingBadge] = useState(false); // New state for delayed badge
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 3;

  // Print settings - Pre-filled from job data if available
  const [printerName, setPrinterName] = useState('');
  const [paperSize, setPaperSize] = useState(jobData?.paper_size || 'A4');
  const [copies, setCopies] = useState(jobData?.copies || 1);
  const [colorMode, setColorMode] = useState<'BW' | 'Color'>(jobData?.color_mode || 'BW');
  const [printType, setPrintType] = useState<'Single' | 'Double'>(jobData?.print_type || 'Single');
  const [nupPages, setNupPages] = useState(jobData?.pages_per_sheet || 1);
  const [nupOrientation, setNupOrientation] = useState<'portrait' | 'landscape'>('landscape'); // Always landscape for N-up
  const [marginSetting, setMarginSetting] = useState<'off' | 'low' | 'normal'>(jobData?.margin || 'normal');

  // UI state
  const [availablePrinters, setAvailablePrinters] = useState<Array<{ name: string, status: string, default: boolean }>>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  // Available paper sizes
  const paperSizes = [
    { value: 'A3', label: 'A3 (297 × 420 mm)' },
    { value: 'A4', label: 'A4 (210 × 297 mm)' },
    { value: 'A5', label: 'A5 (148 × 210 mm)' },
    { value: 'Letter', label: 'Letter (8.5 × 11 inches)' },
    { value: 'Legal', label: 'Legal (8.5 × 14 inches)' },
    { value: 'Executive', label: 'Executive (7.25 × 10.5 inches)' }
  ];


  // Derived values - calculate on demand, no separate state
  const totalSheets = totalPages > 0 ? calculateTotalSheets(totalPages, nupPages) : 0;
  const currentPage = nupPages > 1 ? getSheetStartPage(currentSheet, nupPages) : currentSheet;

  // Load PDF and printers on mount
  useEffect(() => {
    const effectStart = performance.now();
    if (isFirstRender.current) {
      console.log(`⚡ [PERF] PdfPreview useEffect (Mount Done) at ${effectStart.toFixed(2)}ms (Render took: ${(effectStart - mountStart).toFixed(2)}ms)`);
      isFirstRender.current = false;
    }

    loadPrinters(); // Always load printers

    // Decouple PDF loading from mount to ensure instant modal appearance
    if (!isProcessing) {
      setTimeout(() => {
        loadPdf();
      }, 10);
    }
  }, [fileUrl, isProcessing]);

  // Sync margin from parent prop when it changes
  useEffect(() => {
    if (jobData?.margin && jobData.margin !== marginSetting) {
      setMarginSetting(jobData.margin);
    }
  }, [jobData?.margin]);

  // Re-render PDF when settings change - INSTANT for first page, minimal debounce for changes
  useEffect(() => {
    if (canvasRef.current && !isLoading && !error && totalPages > 0 && !isProcessing) {
      // Increment render version to invalidate any in-flight renders
      renderVersionRef.current += 1;

      // Clear any pending timeouts
      if (renderTimeoutRef.current) {
        clearTimeout(renderTimeoutRef.current);
      }
      if (enhancementTimeoutRef.current) {
        clearTimeout(enhancementTimeoutRef.current);
        enhancementTimeoutRef.current = null;
        // CRITICAL: Release lock when cancelling enhancement to prevent deadlock
        renderLockRef.current = false;
      }

      // OPTIMIZATION: Progressive rendering for instant feedback
      // First render at low quality (fast), then enhance to high quality
      const isFirstPage = currentSheet === 1 && scale === optimalScale;
      const delay = isFirstPage ? 0 : 5;

      renderTimeoutRef.current = setTimeout(() => {
        // Start with low quality render for instant preview
        renderPreview(true);
      }, delay);
    }

    return () => {
      // Increment version to cancel any in-flight renders
      renderVersionRef.current += 1;

      // Clear pending timeouts
      if (renderTimeoutRef.current) {
        clearTimeout(renderTimeoutRef.current);
      }
      if (enhancementTimeoutRef.current) {
        clearTimeout(enhancementTimeoutRef.current);
        // CRITICAL: Release lock when cancelling enhancement to prevent deadlock
        renderLockRef.current = false;
        setIsRendering(false);
        setIsEnhancing(false);
      }
    };
  }, [currentSheet, scale, isLoading, error, fileUrl, totalPages, colorMode, printType, nupPages, nupOrientation, paperSize, optimalScale, isProcessing, marginSetting]);
  // Handle N-up mode change
  const handleNupChange = (newNupPages: number) => {
    setNupPages(newNupPages);
    setCurrentSheet(1); // Reset to first sheet when changing N-up mode
  };

  // Effect to manage "Enhancing" badge delay
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (isEnhancing) {
      // Only show badge if enhancing takes longer than 5 seconds
      timeout = setTimeout(() => {
        setShowEnhancingBadge(true);
      }, 5000); // 5 second delay as requested
    } else {
      setShowEnhancingBadge(false);
    }
    return () => clearTimeout(timeout);
  }, [isEnhancing]);

  // Render preview with all transformations applied
  const renderPreview = async (lowQuality: boolean = false, retryCount: number = 0) => {
    const renderStartTime = performance.now();
    console.log('⏱️ [RENDER TIMING] renderPreview() started:', lowQuality ? 'LOW QUALITY' : 'HIGH QUALITY');

    if (!canvasRef.current) {
      console.warn('⚠️ Canvas ref not available');
      return;
    }

    // Prevent multiple simultaneous renders - retry with exponential backoff (infinite retries)
    if (renderLockRef.current) {
      const delay = Math.min(10 * Math.pow(1.5, Math.min(retryCount, 10)), 100); // Exponential backoff, max 100ms
      console.log(`⏳ Render already in progress, scheduling retry #${retryCount + 1} in ${delay.toFixed(0)}ms`);
      setTimeout(() => renderPreview(lowQuality, retryCount + 1), delay);
      return;
    }

    // Capture render version to detect stale renders IMMEDIATELY after acquiring lock
    const myVersion = renderVersionRef.current;

    renderLockRef.current = true;

    // CRITICAL: Check version immediately after acquiring lock, before any work
    if (myVersion !== renderVersionRef.current) {
      console.log('🚫 Render superseded immediately after acquiring lock');
      renderLockRef.current = false;
      return;
    }

    if (lowQuality) {
      setIsRendering(true);
    } else {
      setIsEnhancing(true);
    }
    setError(null);

    try {
      // 1. Calculate and set CSS dimensions explicitly (Fixes "Small -> Big" jump)
      // We always set layout to the TARGET scale, not the render scale
      // This ensures the box size is stable even if we render a low-res bitmap
      let cssWidth = 0;
      let cssHeight = 0;

      if (nupPages > 1) {
        const layout = calculateNupLayout(paperSize as PaperSizeKey, nupPages, 'landscape');
        cssWidth = layout.paperWidth * scale; // Use state 'scale', not 'renderScale'
        cssHeight = layout.paperHeight * scale;
      } else {
        // For single page, use PAPER dimensions (not PDF page dimensions)
        // This shows how content will fit on the selected paper
        const paper = PAPER_SIZES[paperSize as PaperSizeKey];
        if (paper) {
          cssWidth = paper.width * scale;
          cssHeight = paper.height * scale;
        } else {
          // Fallback to PDF dimensions if paper size unknown
          const dims = await getScaledPageDimensions(fileUrl, currentSheet, scale);
          cssWidth = dims.width;
          cssHeight = dims.height;
        }
      }

      // Check version before DOM update
      if (myVersion !== renderVersionRef.current) { renderLockRef.current = false; return; }

      // Apply consistent CSS sizing BEFORE rendering
      if (canvasRef.current) {
        canvasRef.current.style.width = `${cssWidth}px`;
        canvasRef.current.style.height = `${cssHeight}px`;
      }

      // 2. Double Buffering: Render to Offscreen Canvas (Fixes "White Flash")
      const offscreenCanvas = document.createElement('canvas');
      // For high quality single page, viewport handles sizing
      // For N-up, renderNupPreview handles sizing based on logic

      const renderScale = lowQuality ? scale * 0.4 : scale; // Low quality bitmap scale
      const renderQuality = lowQuality ? 0.5 : (window.devicePixelRatio || 1);

      console.log('🎨 Rendering to offscreen buffer:', {
        sheet: currentSheet,
        scale: renderScale.toFixed(2),
        quality: lowQuality ? 'low' : 'high',
        cssSize: `${Math.round(cssWidth)}x${Math.round(cssHeight)}`
      });

      if (nupPages > 1) {
        await renderNupPreview(
          fileUrl,
          currentSheet,
          offscreenCanvas,
          paperSize as PaperSizeKey,
          nupPages,
          'landscape',
          renderScale,
          totalPages,
          true // preventStyleResize: TRUE - we handle style manually above
        );
      } else {
        // Render single page fitted onto paper-sized canvas
        const marginFactor = marginSetting === 'off' ? 1.0 : marginSetting === 'low' ? 0.97 : 0.92;
        await renderSinglePageOnPaper(
          fileUrl,
          currentSheet,
          offscreenCanvas,
          paperSize as PaperSizeKey,
          renderScale,
          renderQuality,
          true, // preventStyleResize: TRUE
          marginFactor
        );
      }

      // 3. Commit Offscreen Buffer to Main Canvas (Atomic Update)
      if (myVersion !== renderVersionRef.current) {
        console.log('🚫 Render became stale during offscreen drawing, aborting commit');
        renderLockRef.current = false;
        setIsRendering(false);
        setIsEnhancing(false);
        return;
      }

      const ctx = canvasRef.current.getContext('2d', { alpha: false });
      if (ctx) {
        // Resize main canvas to match offscreen buffer (bitmap size)
        // Note: CSS size is already set and stable
        canvasRef.current.width = offscreenCanvas.width;
        canvasRef.current.height = offscreenCanvas.height;

        // Draw content instantly
        ctx.drawImage(offscreenCanvas, 0, 0);
      }

      // 4. Apply filters (if any) to MAIN canvas
      if (colorMode === 'BW') {
        applyGrayscaleFilter(canvasRef.current);
      }

      const renderEndTime = performance.now();
      console.log('✅ Preview rendered successfully');
      setRetryCount(0);

      // If this was low quality render, schedule high quality enhancement
      if (lowQuality) {
        setIsRendering(false);
        enhancementTimeoutRef.current = setTimeout(() => {
          if (myVersion === renderVersionRef.current && renderLockRef.current && enhancementTimeoutRef.current) {
            enhancementTimeoutRef.current = null;
            renderLockRef.current = false;
            renderPreview(false); // Render high quality
          } else {
            renderLockRef.current = false;
          }
        }, 50);
        return;
      }
    } catch (err) {
      console.error('❌ Error rendering preview:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to render PDF preview: ${errorMessage}`);

      if (retryCount < maxRetries) {
        setRetryCount(prev => prev + 1);
        renderLockRef.current = false;
        setTimeout(() => renderPreview(lowQuality, retryCount + 1), 200);
      }
    } finally {
      if (!lowQuality) {
        setIsRendering(false);
        setIsEnhancing(false);
        renderLockRef.current = false;
      }
    }
  };

  // Calculate optimal scale when container size changes or page changes
  useEffect(() => {
    const calculateOptimalScale = async () => {
      if (viewerRef.current && !isLoading && !error && totalPages > 0) {
        try {
          const containerRect = viewerRef.current.getBoundingClientRect();
          const containerWidth = containerRect.width - 32; // Account for padding
          const containerHeight = containerRect.height - 32;

          if (containerWidth > 0 && containerHeight > 0) {
            let newOptimalScale: number;

            // Calculate scale based on N-up setting
            if (nupPages > 1) {
              // Always use landscape for N-up to show pages side-by-side
              newOptimalScale = calculateNupOptimalScale(
                paperSize as PaperSizeKey,
                nupPages,
                'landscape',
                containerWidth,
                containerHeight
              );
            } else {
              // Use paper dimensions for optimal scale calculation
              newOptimalScale = calculatePaperOptimalScale(
                paperSize as PaperSizeKey,
                containerWidth,
                containerHeight
              );
            }

            setOptimalScale(newOptimalScale);
            setScale(newOptimalScale);

            console.log('📐 Optimal scale calculated:', {
              page: currentPage,
              nupPages,
              containerSize: { width: containerWidth, height: containerHeight },
              optimalScale: newOptimalScale.toFixed(3)
            });
          }
        } catch (error) {
          console.error('Error calculating optimal scale:', error);
        }
      }
    };

    calculateOptimalScale();

    // Recalculate on window resize
    const handleResize = () => {
      setTimeout(calculateOptimalScale, 100);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [currentPage, isLoading, error, fileUrl, totalPages, nupPages, nupOrientation, paperSize]);

  // Handle fullscreen toggle
  const [containerDims, setContainerDims] = useState<{ width: number; height: number } | null>(null);
  const [isLayoutReady, setIsLayoutReady] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      setIsLayoutReady(false); // Reset on unmount
    };
  }, [isFullscreen]);

  // NEW: Robust ResizeObserver for container
  // This replaces window.resize listeners and manual bounding client rect checks
  // It ensures we only calculate scale when the container is TRULY ready and sized
  useEffect(() => {
    if (!viewerRef.current) return;

    // Disconnect any previous observer if it exists (cleanup handled by return)
    const observer = new ResizeObserver((entries) => {
      // Use requestAnimationFrame to throttle and avoid "ResizeObserver loop limit exceeded"
      window.requestAnimationFrame(() => {
        if (!entries.length) return;

        const entry = entries[0];
        const { width, height } = entry.contentRect;

        // Only update if dimensions are valid and changed meaningfully (>1px)
        if (width > 0 && height > 0) {
          setContainerDims(prev => {
            if (!prev || Math.abs(prev.width - width) > 1 || Math.abs(prev.height - height) > 1) {
              console.log('📏 Container resized:', Math.round(width), 'x', Math.round(height));
              return { width, height };
            }
            return prev;
          });
        }
      });
    });

    observer.observe(viewerRef.current);
    return () => observer.disconnect();
  }, []); // Empty dependency array = setup once on mount

  // Recalculate scale whenever container dimensions change
  useEffect(() => {
    if (!containerDims || !fileUrl) return;

    const calculateScale = async () => {
      // Reset layout readiness to ensure smooth entry animation
      setIsLayoutReady(false);

      // Don't modify scale if user is manually zooming (optional check, but safer to respect "Fit" logic initially)
      // For now, we enforce "Fit" on resize as per standard PDF viewers

      let newOptimalScale = 1.0;
      const { width: containerWidth, height: containerHeight } = containerDims;

      // Account for padding
      const effectiveWidth = containerWidth - 32;
      const effectiveHeight = containerHeight - 32;

      if (effectiveWidth <= 0 || effectiveHeight <= 0) return;

      try {
        // Same logic as before, but triggered by reliable observer
        if (nupPages > 1) {
          newOptimalScale = calculateNupOptimalScale(
            paperSize as PaperSizeKey,
            nupPages,
            'landscape',
            effectiveWidth,
            effectiveHeight
          );
        } else {
          // Use paper dimensions for scale calculation
          newOptimalScale = calculatePaperOptimalScale(
            paperSize as PaperSizeKey,
            effectiveWidth,
            effectiveHeight
          );
        }

        console.log('📐 Updating scale to fit:', newOptimalScale.toFixed(3));
        setScale(newOptimalScale);

        // Mark layout as ready - this reveals the canvas
        // Double RAF + Timeout guarantees the browser paints "opacity-0" state first
        // and adds a slight delay so the animation is perceptible
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setTimeout(() => {
              setIsLayoutReady(true);
            }, 100);
          });
        });

      } catch (e) {
        console.warn('Silent scale calc error:', e);
      }
    };

    calculateScale();
  }, [containerDims, fileUrl, nupPages, paperSize]);


  const loadPdf = async () => {
    const loadStartTime = performance.now();
    console.log('⏱️ [PDF TIMING] loadPdf() started at:', new Date().toISOString());
    console.log('⏱️ [PDF TIMING] File URL length:', fileUrl.length);

    try {
      setIsLoading(true);
      setError(null);
      setLoadingStatus('Loading PDF...');

      console.log(`📄 Loading PDF (attempt ${retryCount + 1}/${maxRetries + 1})...`);

      // Get total pages (this triggers the download) with progress tracking
      const downloadStartTime = performance.now();
      console.log('⏱️ [PDF TIMING] Download started at +', (downloadStartTime - loadStartTime).toFixed(2), 'ms');
      setLoadingStatus('Downloading PDF...');
      const pageCount = await getPdfPageCount(fileUrl, (loaded, total) => {
        const percent = Math.round((loaded / total) * 100);
        setLoadingStatus(`Loading... ${percent}%`);
      });
      const downloadEndTime = performance.now();
      console.log(`📄 PDF loaded: ${pageCount} pages`);
      console.log('⏱️ [PDF TIMING] Download completed at +', (downloadEndTime - loadStartTime).toFixed(2), 'ms');
      console.log('⏱️ [PDF TIMING] Download duration:', (downloadEndTime - downloadStartTime).toFixed(2), 'ms');

      // Note: We NO LONGER calculate scale here manually.
      // We rely on setContainerDims / useEffect to trigger it once layout is stable.
      // This prevents the race condition.

      setTotalPages(pageCount);
      setCurrentSheet(1);
      setIsLoading(false);

      const loadEndTime = performance.now();
      console.log('⏱️ [PDF TIMING] loadPdf() completed at +', (loadEndTime - loadStartTime).toFixed(2), 'ms');
      console.log('⏱️ [PDF TIMING] Total load time:', (loadEndTime - loadStartTime).toFixed(2), 'ms');
    } catch (err) {
      console.error(`❌ Error loading PDF (attempt ${retryCount + 1}/${maxRetries + 1}):`, err);
      console.log('⏱️ [PDF TIMING] loadPdf() ERROR at +', (performance.now() - loadStartTime).toFixed(2), 'ms');

      if (retryCount < maxRetries) {
        console.log(`🔄 Retrying... (${retryCount + 1}/${maxRetries})`);
        setLoadingStatus(`Retrying (${retryCount + 1}/${maxRetries})...`);
        setRetryCount(prev => prev + 1);
        setTimeout(() => loadPdf(), 300);
        return;
      }

      setError('Failed to load PDF. The file may be corrupted or not accessible.');
      setIsLoading(false);
    }
  };

  const loadPrinters = async () => {
    try {
      console.log('🖨️ Loading printers from cache...');
      const printers = await getCachedPrinters();

      if (printers && printers.length > 0) {
        setAvailablePrinters(printers);
        console.log('🖨️ Cached printers loaded:', printers.length);

        // Set default printer
        const defaultPrinter = await getDefaultPrinter();
        if (defaultPrinter) {
          setPrinterName(defaultPrinter.name);
          console.log('🖨️ Default printer set to:', defaultPrinter.name);
        }
      }
    } catch (error) {
      console.error('❌ Error loading cached printers:', error);
    }
  };

  // Navigation handlers - simplified
  const handlePreviousPage = () => {
    if (currentSheet > 1) {
      setCurrentSheet(currentSheet - 1);
    }
  };

  const handleNextPage = () => {
    if (currentSheet < totalSheets) {
      setCurrentSheet(currentSheet + 1);
    }
  };

  // Enhanced zoom handlers with percentage-based steps
  const handleZoomIn = () => {
    setScale(prevScale => {
      // Use larger steps for better zoom control
      const newScale = Math.min(prevScale * 1.25, 5.0);
      console.log('🔍 Zoom In - Scale changed to:', newScale.toFixed(3), `(${Math.round(newScale * 100)}%)`);
      return newScale;
    });
  };

  const handleZoomOut = () => {
    setScale(prevScale => {
      // Use larger steps for better zoom control
      const newScale = Math.max(prevScale * 0.8, 0.3);
      console.log('🔍 Zoom Out - Scale changed to:', newScale.toFixed(3), `(${Math.round(newScale * 100)}%)`);
      return newScale;
    });
  };

  // Reset to optimal scale (100% page view)
  const handleResetZoom = () => {
    setScale(optimalScale);
    console.log('🔍 Reset Zoom - Scale reset to optimal:', optimalScale.toFixed(3), `(${Math.round(optimalScale * 100)}%)`);
  };

  // Set specific zoom level
  const setZoomLevel = (level: number) => {
    const newScale = optimalScale * (level / 100);
    setScale(newScale);
    console.log('🔍 Zoom Level Set:', `${level}%`, `(scale: ${newScale.toFixed(3)})`);
  };

  // Print handler - SIMPLIFIED
  const handlePrint = async () => {
    if (!onPrint || !printerName) {
      alert('Please select a printer before printing');
      return;
    }

    setIsPrinting(true);

    try {
      const printOptions = {
        printerName: printerName,
        paperSize: paperSize,
        copies: copies,
        colorMode: colorMode,
        printType: printType,
        nupPages: nupPages,
        nupOrientation: 'landscape' as const // Always landscape for proper side-by-side layout
      };

      console.log('🖨️ PdfPreview: Printing with options:', printOptions);
      await onPrint(printOptions);

      console.log('✅ Print function completed successfully');

      // Show success notification
      const event = new CustomEvent('show-notification', {
        detail: {
          type: 'success',
          message: `Print job sent to ${printerName}${nupPages > 1 ? ` with ${nupPages} pages side-by-side` : ''}`
        }
      });
      window.dispatchEvent(event);

    } catch (error) {
      console.error('❌ Print error:', error);

      // Show error notification
      const event = new CustomEvent('show-notification', {
        detail: {
          type: 'error',
          message: `Print failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      });
      window.dispatchEvent(event);
    } finally {
      setIsPrinting(false);
    }
  };

  const handleDownload = () => {
    // Create a link and trigger download
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = fileUrl.split('/').pop() || 'document.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleRetry = () => {
    setRetryCount(0);
    setError(null);
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };


  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-lg shadow-lg flex flex-col ${isFullscreen ? 'fixed inset-0 z-50' : 'h-[80vh]'
        }`}
      ref={containerRef}
    >
      {/* SIMPLIFIED Header with essential controls only */}
      <div className="flex justify-between items-center py-3 px-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-t-lg flex-shrink-0">
        <div className="flex items-center space-x-3">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">PDF Preview</h3>

          {/* Page navigation */}
          <div className="flex items-center space-x-2">
            <button
              onClick={handlePreviousPage}
              disabled={currentSheet <= 1}
              className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title={nupPages > 1 ? "Previous Sheet" : "Previous Page"}
            >
              <ChevronLeft className="h-4 w-4 text-gray-700 dark:text-gray-300" />
            </button>

            <div className="text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-md min-w-[80px] text-center">
              {nupPages > 1 ? (
                <span title={`Displaying pages ${getSheetPages(currentSheet, nupPages, totalPages).join(', ')}`}>
                  Sheet {currentSheet} / {totalSheets}
                </span>
              ) : (
                <span>Page {currentSheet} / {totalPages}</span>
              )}
            </div>

            <button
              onClick={handleNextPage}
              disabled={currentSheet >= totalSheets}
              className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title={nupPages > 1 ? "Next Sheet" : "Next Page"}
            >
              <ChevronRight className="h-4 w-4 text-gray-700 dark:text-gray-300" />
            </button>
          </div>
        </div>

        {/* Right side controls */}
        <div className="flex items-center space-x-2">
          {/* Zoom controls */}
          <button
            onClick={handleZoomOut}
            disabled={scale <= 0.3}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Zoom Out (Ctrl+-)"
          >
            <ZoomOut className="h-4 w-4 text-gray-700 dark:text-gray-300" />
          </button>

          {/* Zoom dropdown */}
          <div className="relative group">
            <button
              onClick={handleResetZoom}
              className="text-sm font-medium text-gray-700 dark:text-gray-300 px-3 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors min-w-[60px] text-center"
              title="Click to reset zoom, hover for presets"
            >
              {Math.round((scale / optimalScale) * 100)}%
            </button>

            {/* Zoom presets dropdown */}
            <div className="hidden group-hover:block absolute top-full right-0 mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-1 z-50 min-w-[100px]">
              {[50, 75, 100, 125, 150, 200, 300].map(level => (
                <button
                  key={level}
                  onClick={() => setZoomLevel(level)}
                  className={`w-full px-4 py-2 text-sm text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${Math.round((scale / optimalScale) * 100) === level
                    ? 'text-blue-600 dark:text-blue-400 font-medium'
                    : 'text-gray-700 dark:text-gray-300'
                    }`}
                >
                  {level}%
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleZoomIn}
            disabled={scale >= 3.0}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Zoom In (Ctrl++)"
          >
            <ZoomIn className="h-4 w-4 text-gray-700 dark:text-gray-300" />
          </button>

          {/* Action buttons */}
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          >
            {isFullscreen ?
              <Minimize className="h-4 w-4 text-gray-700 dark:text-gray-300" /> :
              <Maximize className="h-4 w-4 text-gray-700 dark:text-gray-300" />
            }
          </button>

          <button
            onClick={handleDownload}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="Download"
          >
            <Download className="h-4 w-4 text-gray-700 dark:text-gray-300" />
          </button>

          {/* Close button */}
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 transition-colors ml-2"
              title="Close"
            >
              <X className="h-5 w-5 text-gray-700 dark:text-gray-300" />
            </button>
          )}
        </div>
      </div>

      {/* SIMPLIFIED Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* PDF Viewer - Takes most of the space */}
        <div
          className="flex-1 overflow-auto bg-gray-100 dark:bg-gray-700 flex items-center justify-center p-4 relative"
          ref={viewerRef}
        >
          {/* Loading overlay - shown while PDF is loading */}
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white dark:bg-gray-800 z-20">
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 border-4 border-blue-200 dark:border-blue-800 border-t-blue-600 rounded-full animate-spin mb-4"></div>
                <p className="text-gray-600 dark:text-gray-400 text-lg font-medium">Loading PDF...</p>
              </div>
            </div>
          )}

          {/* Error overlay - shown when there's an error */}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-white dark:bg-gray-800 z-20">
              <div className="flex flex-col items-center max-w-md">
                <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4">
                  <FileText className="h-8 w-8 text-red-600 dark:text-red-400" />
                </div>
                <h3 className="text-lg font-medium text-red-600 dark:text-red-400 mb-2">Error Loading PDF</h3>
                <p className="text-gray-600 dark:text-gray-400 text-center mb-4">{error}</p>
                <button
                  onClick={handleRetry}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Retry Loading
                </button>
              </div>
            </div>
          )}

          {/* Processing overlay - shown when edits are being applied */}
          {isProcessing && (
            <div className="absolute inset-0 flex items-center justify-center bg-white dark:bg-gray-800 z-30">
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 border-4 border-blue-200 dark:border-blue-800 border-t-blue-600 rounded-full animate-spin mb-4"></div>
                <p className="text-gray-600 dark:text-gray-400 text-lg font-medium">Applying edits...</p>
              </div>
            </div>
          )}

          {/* Rendering overlay - shown while initial render (low quality phase) */}
          {/* Also shown while waiting for Layout to be ready (fixes "Jump" glitch) */}
          {((isRendering && !isLoading && !error && !isProcessing) || (!isLayoutReady && !isLoading && !error)) && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900/10 dark:bg-gray-900/30 z-10">
              <div className="bg-white dark:bg-gray-800 px-4 py-2 rounded-lg shadow-lg flex items-center">
                <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mr-2"></div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {!isLayoutReady ? 'Preparing layout...' : 'Loading preview...'}
                </span>
              </div>
            </div>
          )}

          {/* Processing overlay - shown when edits are being applied */}
          {isProcessing && (
            <div className="absolute inset-0 flex items-center justify-center bg-white dark:bg-gray-800 z-30">
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 border-4 border-blue-200 dark:border-blue-800 border-t-blue-600 rounded-full animate-spin mb-4"></div>
                <p className="text-gray-600 dark:text-gray-400 text-lg font-medium">Applying edits...</p>
              </div>
            </div>
          )}

          {/* Download overlay - shown when file is downloading */}
          {isDownloading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white dark:bg-gray-800 z-30">
              <div className="flex flex-col items-center max-w-xs w-full px-6">
                <div className="w-16 h-16 border-4 border-blue-200 dark:border-blue-800 border-t-blue-600 rounded-full animate-spin mb-4"></div>
                <p className="text-gray-900 dark:text-white text-lg font-medium mb-2">Downloading file...</p>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 mb-1">
                  <div className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" style={{ width: `${downloadProgress}%` }}></div>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">{Math.round(downloadProgress)}% complete</p>
              </div>
            </div>
          )}

          {/* Enhancing indicator - Top Right - ANIMATED AS REQUESTED */}
          {showEnhancingBadge && !isLoading && !error && !isRendering && !isProcessing && (
            <>
              <div className="absolute top-4 right-4 z-20 animate-fade-in-down">
                <div className="bg-blue-600 text-white px-3 py-1.5 rounded-full shadow-lg flex items-center space-x-2">
                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-xs font-bold tracking-wide">ENHANCING...</span>
                </div>
              </div>

              {/* Low Quality Warning - Bottom Center - TRANSPARENT OVERLAY AS REQUESTED */}
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-20 animate-fade-in-up">
                <div className="bg-black/50 backdrop-blur-sm text-white px-4 py-2 rounded-full shadow-md border border-white/20">
                  <p className="text-xs font-medium">To ensure fast loading, initial quality is reduced</p>
                </div>
              </div>
            </>
          )}

          <div
            className={`shadow-xl bg-white rounded-lg overflow-hidden relative transition-all duration-700 ease-[cubic-bezier(0.25,1,0.5,1)] transform ${isLayoutReady ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-8 scale-95'}`}
          >
            <canvas ref={canvasRef} className="block" />
          </div>
        </div>

        {/* SIMPLIFIED Print Settings Panel - Right sidebar */}
        <div className="w-80 border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 flex-shrink-0 overflow-y-auto">
          <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center">
            <Printer className="h-5 w-5 mr-2" />
            Print Settings
          </h4>

          <div className="space-y-4">
            {/* Printer Selection */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Printer:
              </label>
              <select
                value={printerName}
                onChange={(e) => setPrinterName(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Choose Printer</option>
                {availablePrinters.map((printer) => (
                  <option key={printer.name} value={printer.name}>
                    {printer.name} {printer.status === 'Ready' ? '✓' : '⚠️'} {printer.default ? '(Default)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Paper Size */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Paper Size:
              </label>
              <select
                value={paperSize}
                onChange={(e) => setPaperSize(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer focus:ring-2 focus:ring-blue-500"
              >
                {paperSizes.map((size) => (
                  <option key={size.value} value={size.value}>
                    {size.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Pages per Sheet - ENHANCED */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Layout (N-up):
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleNupChange(1)}
                  className={`px-3 py-2 text-sm rounded-lg border transition-colors ${nupPages === 1
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                >
                  Normal
                </button>
                <button
                  onClick={() => handleNupChange(2)}
                  className={`px-3 py-2 text-sm rounded-lg border transition-colors ${nupPages === 2
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                >
                  2-up
                </button>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {nupPages === 1 ? 'One page per sheet' : `${nupPages} pages side-by-side (landscape)`}
              </p>
              {nupPages > 1 && totalPages > 0 && (
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                  {totalSheets} sheet{totalSheets !== 1 ? 's' : ''} total
                </p>
              )}
            </div>

            {/* Copies */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Copies:
              </label>
              <input
                type="number"
                min="1"
                max="100"
                value={copies}
                onChange={(e) => setCopies(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Color Mode */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Color:
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setColorMode('BW')}
                  className={`px-3 py-2 text-sm rounded-lg border transition-colors ${colorMode === 'BW'
                    ? 'bg-gray-600 text-white border-gray-600'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                >
                  B&W
                </button>
                <button
                  onClick={() => setColorMode('Color')}
                  className={`px-3 py-2 text-sm rounded-lg border transition-colors ${colorMode === 'Color'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                >
                  Color
                </button>
              </div>
            </div>

            {/* Print Type */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Sides:
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setPrintType('Single')}
                  className={`px-3 py-2 text-sm rounded-lg border transition-colors ${printType === 'Single'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                >
                  Single
                </button>
                <button
                  onClick={() => setPrintType('Double')}
                  className={`px-3 py-2 text-sm rounded-lg border transition-colors ${printType === 'Double'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                >
                  Double
                </button>
              </div>
            </div>

            {/* Print Button */}
            {onPrint && (
              <button
                onClick={handlePrint}
                disabled={!printerName || isPrinting || isRendering}
                className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl mt-6"
              >
                {isPrinting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    Printing...
                  </>
                ) : (
                  <>
                    <Printer className="h-5 w-5 mr-2" />
                    Print {nupPages > 1 ? `${nupPages}-up` : 'Normal'} ({colorMode})
                  </>
                )}
              </button>
            )}

            {!printerName && (
              <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <div className="flex items-center text-yellow-800 dark:text-yellow-300">
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  <span className="text-sm font-medium">Select a printer</span>
                </div>
              </div>
            )}

            {/* PDF Info */}
            <div className="mt-6 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Document Info</h5>
              <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                <div>Total Pages: {totalPages}</div>
                {nupPages > 1 && (
                  <>
                    <div>Total Sheets: {totalSheets}</div>
                    <div>Current Sheet: {currentSheet}</div>
                    <div>Pages on Sheet: {getSheetPages(currentSheet, nupPages, totalPages).join(', ')}</div>
                  </>
                )}
                {pageWidth > 0 && pageHeight > 0 && (
                  <div>Page Size: {Math.round(pageWidth)} × {Math.round(pageHeight)} pt</div>
                )}
                <div>Zoom: {Math.round(scale * 100)}%</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PdfPreview;
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { getPdfPageCount, getPdfPageViewport } from '../utils/pdfUtils';
import {
  renderHighQualityPdfPage,
  renderNupPreview,
  applyGrayscaleFilter,
  calculateNupOptimalScale,
  drawSettingsIndicators,
  PAPER_SIZES,
  PaperSizeKey,
  calculateTotalSheets,
  getSheetStartPage,
  getSheetPages,
  getSheetFromPage
} from '../utils/pdfTransformations';
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
}

const PdfPreview: React.FC<PdfPreviewProps> = ({ fileUrl, jobData, onPrint, onClose }) => {
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
  
  // UI state
  const [availablePrinters, setAvailablePrinters] = useState<Array<{name: string, status: string, default: boolean}>>([]);
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
    loadPdf();
    loadPrinters();
  }, [fileUrl]);

  // Re-render PDF when settings change - INSTANT for first page, minimal debounce for changes
  useEffect(() => {
    if (canvasRef.current && !isLoading && !error && totalPages > 0) {
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
  }, [currentSheet, scale, isLoading, error, fileUrl, totalPages, colorMode, printType, nupPages, nupOrientation, paperSize, optimalScale]);

  // Handle N-up mode change
  const handleNupChange = (newNupPages: number) => {
    setNupPages(newNupPages);
    setCurrentSheet(1); // Reset to first sheet when changing N-up mode
  };

  // Render preview with all transformations applied
  const renderPreview = async (lowQuality: boolean = false, retryCount: number = 0) => {
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
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d', { 
        alpha: false,  // No transparency for better performance
        willReadFrequently: false 
      });

      if (!ctx) {
        throw new Error('Failed to get canvas context');
      }

      // Use lower quality for initial render, full quality for enhancement
      const renderScale = lowQuality ? scale * 0.4 : scale;
      const renderQuality = lowQuality ? 0.5 : (window.devicePixelRatio || 1);

      console.log('🎨 Rendering preview:', {
        sheet: currentSheet,
        totalPages,
        totalSheets,
        nupPages,
        scale: renderScale.toFixed(2),
        quality: lowQuality ? 'low' : 'high'
      });

      // Checkpoint 2: Check version before sheet validation
      if (myVersion !== renderVersionRef.current) {
        console.log('🚫 Render superseded before validation');
        renderLockRef.current = false;
        setIsRendering(false);
        setIsEnhancing(false);
        return;
      }

      // Validate sheet number
      if (currentSheet < 1 || currentSheet > totalSheets) {
        console.warn(`⚠️ Invalid sheet: ${currentSheet}/${totalSheets}`);
        renderLockRef.current = false;
        setIsRendering(false);
        setIsEnhancing(false);
        return;
      }

      // Check if this render has been superseded
      if (myVersion !== renderVersionRef.current) {
        console.log('🚫 Render superseded, aborting');
        renderLockRef.current = false;
        setIsRendering(false);
        setIsEnhancing(false);
        return;
      }

      // CRITICAL FIX: Complete canvas reset for clean rendering
      // 1. Save current context state
      ctx.save();
      
      // 2. Reset transform matrix to identity
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      
      // 3. Fill with white background (ensures no transparency artifacts)
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Render based on N-up setting
      if (nupPages > 1) {
        const pagesToShow = getSheetPages(currentSheet, nupPages, totalPages);
        console.log(`📑 Rendering sheet ${currentSheet} with pages:`, pagesToShow);

        await renderNupPreview(
          fileUrl,
          currentSheet,
          canvas,
          paperSize as PaperSizeKey,
          nupPages,
          'landscape',
          renderScale,
          totalPages
        );
        
        // Check version immediately after async rendering
        if (myVersion !== renderVersionRef.current) {
          console.log('🚫 Render became stale during N-up drawing, aborting');
          renderLockRef.current = false;
          setIsRendering(false);
          setIsEnhancing(false);
          return;
        }
      } else {
        console.log(`📄 Rendering single page ${currentSheet}`);
        // Render single page
        await renderHighQualityPdfPage(
          fileUrl,
          currentSheet,
          canvas,
          renderScale,
          renderQuality
        );
        
        // Check version immediately after async rendering
        if (myVersion !== renderVersionRef.current) {
          console.log('🚫 Render became stale during single page drawing, aborting');
          renderLockRef.current = false;
          setIsRendering(false);
          setIsEnhancing(false);
          return;
        }
      }

      // Restore context state
      ctx.restore();

      // CRITICAL: Final version check before applying filters and committing
      if (myVersion !== renderVersionRef.current) {
        console.log('🚫 Render became stale after drawing, aborting before filters');
        renderLockRef.current = false;
        setIsRendering(false);
        setIsEnhancing(false);
        return;
      }

      // Apply grayscale filter if B&W mode
      if (colorMode === 'BW') {
        console.log('🎨 Applying B&W filter');
        applyGrayscaleFilter(canvas);
      }

      console.log('✅ Preview rendered successfully');
      setRetryCount(0); // Reset retry count on success
      
      // If this was low quality render, schedule high quality enhancement
      if (lowQuality) {
        setIsRendering(false);
        // Schedule enhancement with version check
        enhancementTimeoutRef.current = setTimeout(() => {
          // Check if this render is still current
          if (myVersion === renderVersionRef.current && renderLockRef.current && enhancementTimeoutRef.current) {
            enhancementTimeoutRef.current = null;
            // Release lock so high quality render can proceed
            renderLockRef.current = false;
            renderPreview(false); // Render high quality version
          } else {
            console.log('🚫 Enhancement cancelled (render superseded)');
            renderLockRef.current = false;
          }
        }, 50);
        return; // Return early, lock will be released by timeout or cancelled by cleanup
      }
    } catch (err) {
      console.error('❌ Error rendering preview:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to render PDF preview: ${errorMessage}`);

      // Retry logic with faster recovery
      if (retryCount < maxRetries) {
        console.log(`Retrying... (${retryCount + 1}/${maxRetries})`);
        setRetryCount(prev => prev + 1);
        renderLockRef.current = false; // Release lock before retry
        setTimeout(() => renderPreview(lowQuality), 200); // Reduced from 500ms to 200ms
      }
    } finally {
      // Only release lock and clear states if not low quality (which returns early)
      if (!lowQuality) {
        // Always clear states and release lock, even for stale renders
        // This prevents stuck UI indicators
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
              const { optimalScale: calcScale, pageWidth: newPageWidth, pageHeight: newPageHeight } =
                await getPdfPageViewport(fileUrl, currentPage, containerWidth, containerHeight);
              newOptimalScale = calcScale;
              setPageWidth(newPageWidth);
              setPageHeight(newPageHeight);
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
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFullscreen]);

  const loadPdf = async () => {
    try {
      setIsLoading(true);
      setError(null);
      setLoadingStatus('Loading PDF...');

      console.log(`📄 Loading PDF (attempt ${retryCount + 1}/${maxRetries + 1}):`, fileUrl);

      // Get total pages (this triggers the download)
      setLoadingStatus('Processing document...');
      const pageCount = await getPdfPageCount(fileUrl);
      console.log(`📄 PDF loaded: ${pageCount} pages`);

      // CRITICAL FIX: Calculate optimal scale BEFORE triggering render
      // This ensures first render uses correct scale, preventing double-render bug
      if (viewerRef.current && pageCount > 0) {
        setLoadingStatus('Preparing preview...');
        const containerRect = viewerRef.current.getBoundingClientRect();
        const containerWidth = containerRect.width - 32;
        const containerHeight = containerRect.height - 32;

        if (containerWidth > 0 && containerHeight > 0) {
          console.log('📐 Calculating optimal scale immediately...');
          
          // Calculate for first page
          const { optimalScale: calcScale, pageWidth: newPageWidth, pageHeight: newPageHeight } =
            await getPdfPageViewport(fileUrl, 1, containerWidth, containerHeight);
          
          console.log('✅ Optimal scale calculated:', calcScale.toFixed(3));
          
          // Set everything at once to prevent intermediate renders
          setPageWidth(newPageWidth);
          setPageHeight(newPageHeight);
          setOptimalScale(calcScale);
          setScale(calcScale);
        }
      }

      // Now set state - render will use correct scale immediately
      setTotalPages(pageCount);
      setCurrentSheet(1);
      setIsLoading(false);
    } catch (err) {
      console.error(`❌ Error loading PDF (attempt ${retryCount + 1}/${maxRetries + 1}):`, err);

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
    if (window.electron) {
      try {
        console.log('🖨️ Loading available printers...');
        const result = await window.electron.getPrinters();
        
        if (result.success && result.printers) {
          setAvailablePrinters(result.printers);
          console.log('🖨️ Available printers:', result.printers);
          
          // Set default printer
          const defaultPrinter = result.printers.find(p => p.default);
          if (defaultPrinter) {
            setPrinterName(defaultPrinter.name);
            console.log('🖨️ Default printer set to:', defaultPrinter.name);
          } else if (result.printers.length > 0) {
            setPrinterName(result.printers[0].name);
            console.log('🖨️ First printer set to:', result.printers[0].name);
          }
        }
      } catch (error) {
        console.error('❌ Error loading printers:', error);
      }
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
      const newScale = Math.min(prevScale * 1.25, 3.0);
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
      className={`bg-white dark:bg-gray-800 rounded-lg shadow-lg flex flex-col ${
        isFullscreen ? 'fixed inset-0 z-50' : 'h-[80vh]'
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
                  className={`w-full px-4 py-2 text-sm text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                    Math.round((scale / optimalScale) * 100) === level
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
                <p className="text-gray-600 dark:text-gray-400 text-lg font-medium">{loadingStatus}</p>
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

          {/* Rendering overlay - shown while initial render (low quality phase) */}
          {isRendering && !isLoading && !error && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900/10 dark:bg-gray-900/30 z-10">
              <div className="bg-white dark:bg-gray-800 px-4 py-2 rounded-lg shadow-lg flex items-center">
                <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mr-2"></div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Loading preview...</span>
              </div>
            </div>
          )}
          
          {/* Subtle enhancing indicator - shown during quality upgrade (no overlay, just corner badge) */}
          {isEnhancing && !isLoading && !error && !isRendering && (
            <div className="absolute top-2 right-2 bg-blue-600 text-white px-2 py-1 rounded text-xs font-medium z-10 flex items-center">
              <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin mr-1"></div>
              Enhancing...
            </div>
          )}

          <div className="shadow-xl bg-white rounded-lg overflow-hidden relative">
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
                  className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                    nupPages === 1
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  Normal
                </button>
                <button
                  onClick={() => handleNupChange(2)}
                  className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                    nupPages === 2
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
                  className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                    colorMode === 'BW'
                      ? 'bg-gray-600 text-white border-gray-600'
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  B&W
                </button>
                <button
                  onClick={() => setColorMode('Color')}
                  className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                    colorMode === 'Color'
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
                  className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                    printType === 'Single'
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  Single
                </button>
                <button
                  onClick={() => setPrintType('Double')}
                  className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                    printType === 'Double'
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
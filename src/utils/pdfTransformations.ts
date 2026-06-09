import { getCachedPdfDocument } from './pdfUtils';

// Paper size dimensions in points (1 point = 1/72 inch)
export const PAPER_SIZES = {
  A3: { width: 842, height: 1191, label: 'A3 (297 × 420 mm)' },
  A4: { width: 595, height: 842, label: 'A4 (210 × 297 mm)' },
  A5: { width: 420, height: 595, label: 'A5 (148 × 210 mm)' },
  Letter: { width: 612, height: 792, label: 'Letter (8.5 × 11 inches)' },
  Legal: { width: 612, height: 1008, label: 'Legal (8.5 × 14 inches)' },
  Executive: { width: 522, height: 756, label: 'Executive (7.25 × 10.5 inches)' }
} as const;

export type PaperSizeKey = keyof typeof PAPER_SIZES;

/**
 * Calculate total number of sheets for N-up printing
 */
export const calculateTotalSheets = (totalPages: number, nupPages: number): number => {
  if (nupPages <= 1) return totalPages;
  return Math.ceil(totalPages / nupPages);
};

/**
 * Get the starting page number for a given sheet
 */
export const getSheetStartPage = (sheetNumber: number, nupPages: number): number => {
  return (sheetNumber - 1) * nupPages + 1;
};

/**
 * Get all page numbers that should appear on a given sheet
 */
export const getSheetPages = (sheetNumber: number, nupPages: number, totalPages: number): number[] => {
  const startPage = getSheetStartPage(sheetNumber, nupPages);
  const pages: number[] = [];

  for (let i = 0; i < nupPages; i++) {
    const pageNum = startPage + i;
    if (pageNum <= totalPages) {
      pages.push(pageNum);
    }
  }

  return pages;
};

/**
 * Get which sheet contains a given page number
 */
export const getSheetFromPage = (pageNumber: number, nupPages: number): number => {
  if (nupPages <= 1) return pageNumber;
  return Math.ceil(pageNumber / nupPages);
};

/**
 * Apply grayscale filter to canvas for B&W preview
 */
export const applyGrayscaleFilter = (canvas: HTMLCanvasElement): void => {
  const context = canvas.getContext('2d');
  if (!context) return;

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    // Use luminance calculation for accurate grayscale conversion
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    data[i] = gray;     // Red
    data[i + 1] = gray; // Green
    data[i + 2] = gray; // Blue
    // Alpha channel (data[i + 3]) remains unchanged
  }

  context.putImageData(imageData, 0, 0);
};

/**
 * Calculate dimensions for N-up layout
 */
export const calculateNupLayout = (
  paperSize: PaperSizeKey,
  nupPages: number,
  orientation: 'portrait' | 'landscape'
): {
  paperWidth: number;
  paperHeight: number;
  columns: number;
  rows: number;
  cellWidth: number;
  cellHeight: number;
  margin: number;
  gap: number;
} => {
  const paper = PAPER_SIZES[paperSize];
  let paperWidth = paper.width;
  let paperHeight = paper.height;

  // Swap dimensions for landscape orientation
  if (orientation === 'landscape') {
    [paperWidth, paperHeight] = [paperHeight, paperWidth];
  }

  // Define margin and gap
  const margin = 36; // 0.5 inch margin
  const gap = 18; // 0.25 inch gap between pages

  let columns = 1;
  let rows = 1;

  // Calculate grid layout based on N-up value
  if (nupPages === 2) {
    columns = 2;
    rows = 1;
  } else if (nupPages === 4) {
    columns = 2;
    rows = 2;
  } else if (nupPages === 6) {
    columns = 3;
    rows = 2;
  } else if (nupPages === 9) {
    columns = 3;
    rows = 3;
  }

  // Calculate cell dimensions
  const availableWidth = paperWidth - (2 * margin) - ((columns - 1) * gap);
  const availableHeight = paperHeight - (2 * margin) - ((rows - 1) * gap);
  const cellWidth = availableWidth / columns;
  const cellHeight = availableHeight / rows;

  return {
    paperWidth,
    paperHeight,
    columns,
    rows,
    cellWidth,
    cellHeight,
    margin,
    gap
  };
};

/**
 * Render PDF page with high quality and proper scaling for high-DPI displays
 */
export const renderHighQualityPdfPage = async (
  fileUrl: string,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  scale: number = 1.0,
  devicePixelRatio: number = window.devicePixelRatio || 1,
  preventStyleResize: boolean = false
): Promise<void> => {
  try {
    console.log('🖼️ Rendering single page:', { pageNumber, scale });

    const pdfDocument = await getCachedPdfDocument(fileUrl);

    // Validate page number
    if (pageNumber < 1 || pageNumber > pdfDocument.numPages) {
      throw new Error(`Invalid page number ${pageNumber}. Document has ${pdfDocument.numPages} pages.`);
    }

    const page = await pdfDocument.getPage(pageNumber);

    // Use moderate quality multiplier to prevent crashes and improve performance
    const qualityMultiplier = Math.min(1.5, devicePixelRatio);
    const viewport = page.getViewport({ scale: scale * qualityMultiplier });
    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('Could not get canvas context');
    }

    // Set canvas size for high quality rendering
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    if (!preventStyleResize) {
      canvas.style.width = `${viewport.width / qualityMultiplier}px`;
      canvas.style.height = `${viewport.height / qualityMultiplier}px`;
    }

    // Clear canvas first with white background
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);

    // Enable image smoothing for better quality
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';

    // Render the page with optimal settings
    const renderContext = {
      canvasContext: context,
      viewport: viewport,
      intent: 'display',
      renderInteractiveForms: false,
      annotationMode: 0
    };

    await page.render(renderContext).promise;

    console.log('✨ High-quality PDF page rendered:', {
      pageNumber,
      scale: scale.toFixed(2),
      dpr: devicePixelRatio,
      canvasSize: { width: canvas.width, height: canvas.height },
      displaySize: { width: canvas.style.width, height: canvas.style.height }
    });
  } catch (error) {
    console.error('Error rendering high-quality PDF page:', error);
    throw error;
  }
};

/**
 * Render N-up layout preview
 */
export const renderNupPreview = async (
  fileUrl: string,
  sheetNumber: number,
  canvas: HTMLCanvasElement,
  paperSize: PaperSizeKey,
  nupPages: number,
  orientation: 'portrait' | 'landscape',
  scale: number = 1.0,
  totalPdfPages: number,
  preventStyleResize: boolean = false
): Promise<void> => {
  try {
    console.log('🔧 Starting N-up render:', { sheetNumber, nupPages, orientation, paperSize });

    const layout = calculateNupLayout(paperSize, nupPages, orientation);
    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('Could not get canvas context');
    }

    // Use moderate quality multiplier to prevent crashes and improve performance
    const qualityMultiplier = Math.min(1.5, window.devicePixelRatio || 1);
    const displayScale = scale * qualityMultiplier;

    // Set canvas size
    canvas.width = layout.paperWidth * displayScale;
    canvas.height = layout.paperHeight * displayScale;

    if (!preventStyleResize) {
      canvas.style.width = `${layout.paperWidth * scale}px`;
      canvas.style.height = `${layout.paperHeight * scale}px`;
    }

    // Clear canvas with white background
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);

    // Enable high quality rendering
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';

    // Draw paper border (subtle)
    context.strokeStyle = '#e0e0e0';
    context.lineWidth = 1 * displayScale;
    context.strokeRect(0, 0, canvas.width, canvas.height);

    // Load PDF document
    console.log('📄 Loading PDF document...');
    const pdfDocument = await getCachedPdfDocument(fileUrl);
    console.log(`📚 PDF loaded: ${totalPdfPages} pages total`);

    // Get the pages that should appear on this sheet
    const pagesToRender = getSheetPages(sheetNumber, nupPages, totalPdfPages);
    console.log(`🎯 Rendering sheet ${sheetNumber} with pages:`, pagesToRender);

    // Render each page in the N-up grid
    let pageIndex = 0;

    outerLoop: for (let row = 0; row < layout.rows; row++) {
      for (let col = 0; col < layout.columns; col++) {
        // Stop if we've rendered all pages for this sheet
        if (pageIndex >= pagesToRender.length) {
          console.log(`✋ Stopping at page index ${pageIndex} - all sheet pages rendered`);
          break outerLoop;
        }

        const currentPage = pagesToRender[pageIndex];

        try {
          console.log(`🎨 Rendering page ${currentPage} at position [${row}, ${col}]`);

          // Calculate position for this cell
          const x = (layout.margin + col * (layout.cellWidth + layout.gap)) * displayScale;
          const y = (layout.margin + row * (layout.cellHeight + layout.gap)) * displayScale;

          // Get the page
          const page = await pdfDocument.getPage(currentPage);

          // Calculate scale to fit in cell while maintaining aspect ratio
          const pageViewport = page.getViewport({ scale: 1.0 });
          const scaleX = (layout.cellWidth * displayScale) / pageViewport.width;
          const scaleY = (layout.cellHeight * displayScale) / pageViewport.height;
          const pageScale = Math.min(scaleX, scaleY) * 0.95; // 95% to leave small margin

          const scaledViewport = page.getViewport({ scale: pageScale });

          // Create temporary canvas for this page
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = scaledViewport.width;
          tempCanvas.height = scaledViewport.height;

          const tempContext = tempCanvas.getContext('2d');
          if (!tempContext) {
            console.warn(`⚠️ Could not get context for page ${currentPage}`);
            pageIndex++;
            continue;
          }

          // Clear temp canvas
          tempContext.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
          tempContext.imageSmoothingEnabled = true;
          tempContext.imageSmoothingQuality = 'high';

          // Render page to temporary canvas
          await page.render({
            canvasContext: tempContext,
            viewport: scaledViewport,
            intent: 'display',
            renderInteractiveForms: false,
            annotationMode: 0
          }).promise;

          // Calculate centered position in cell
          const offsetX = x + ((layout.cellWidth * displayScale - scaledViewport.width) / 2);
          const offsetY = y + ((layout.cellHeight * displayScale - scaledViewport.height) / 2);

          // Draw the rendered page onto main canvas
          context.save();
          context.imageSmoothingEnabled = true;
          context.imageSmoothingQuality = 'high';
          context.drawImage(tempCanvas, offsetX, offsetY);
          context.restore();

          // Draw cell border
          context.save();
          context.strokeStyle = '#d0d0d0';
          context.lineWidth = 0.5 * displayScale;
          context.strokeRect(x, y, layout.cellWidth * displayScale, layout.cellHeight * displayScale);
          context.restore();

          console.log(`✅ Page ${currentPage} rendered successfully`);

          pageIndex++;
        } catch (pageError) {
          console.error(`❌ Error rendering page ${currentPage}:`, pageError);
          pageIndex++;
          continue;
        }
      }
    }

    console.log('✨ N-up layout rendered:', {
      nupPages,
      orientation,
      paperSize,
      layout: `${layout.columns}x${layout.rows}`,
      sheetNumber,
      pagesRendered: pagesToRender
    });
  } catch (error) {
    console.error('Error rendering N-up preview:', error);
    throw error;
  }
};

/**
 * Draw paper size boundary overlay
 */
export const drawPaperBoundary = (
  canvas: HTMLCanvasElement,
  paperSize: PaperSizeKey,
  scale: number = 1.0
): void => {
  const context = canvas.getContext('2d');
  if (!context) return;

  const paper = PAPER_SIZES[paperSize];
  const devicePixelRatio = window.devicePixelRatio || 1;
  const displayScale = scale * devicePixelRatio;

  // Save current context state
  context.save();

  // Draw paper outline
  context.strokeStyle = '#2563eb';
  context.lineWidth = 2 * displayScale;
  context.setLineDash([10 * displayScale, 5 * displayScale]);
  context.strokeRect(0, 0, paper.width * displayScale, paper.height * displayScale);

  // Add paper size label
  context.fillStyle = '#2563eb';
  context.font = `bold ${12 * displayScale}px Arial`;
  const label = PAPER_SIZES[paperSize].label;
  context.fillText(label, 10 * displayScale, 20 * displayScale);

  // Restore context state
  context.restore();
};

/**
 * Calculate optimal scale for displaying PDF with N-up layout
 */
export const calculateNupOptimalScale = (
  paperSize: PaperSizeKey,
  nupPages: number,
  orientation: 'portrait' | 'landscape',
  containerWidth: number,
  containerHeight: number
): number => {
  const layout = calculateNupLayout(paperSize, nupPages, orientation);

  const scaleX = (containerWidth * 0.85) / layout.paperWidth;
  const scaleY = (containerHeight * 0.85) / layout.paperHeight;

  const optimalScale = Math.min(scaleX, scaleY);

  return Math.max(0.3, Math.min(optimalScale, 1.5));
};

/**
 * Calculate optimal scale for displaying a paper-sized preview in a container
 */
export const calculatePaperOptimalScale = (
  paperSize: PaperSizeKey,
  containerWidth: number,
  containerHeight: number
): number => {
  const paper = PAPER_SIZES[paperSize];
  if (!paper) return 1.0;

  const scaleX = (containerWidth * 0.85) / paper.width;
  const scaleY = (containerHeight * 0.85) / paper.height;

  const optimalScale = Math.min(scaleX, scaleY);
  return Math.max(0.3, Math.min(optimalScale, 3.0));
};

/**
 * Render a single PDF page fitted onto a paper-sized canvas.
 * This simulates how the print engine will output the page:
 * - Canvas is the paper size
 * - PDF content is scaled to optimally fill the paper (fit-to-page)
 * - Auto-rotates landscape content on portrait paper for optimal space usage
 * - Content is centered on the paper
 */
export const renderSinglePageOnPaper = async (
  fileUrl: string,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  paperSize: PaperSizeKey,
  scale: number = 1.0,
  devicePixelRatio: number = window.devicePixelRatio || 1,
  preventStyleResize: boolean = false,
  marginFactor: number = 0.92
): Promise<void> => {
  try {
    const paper = PAPER_SIZES[paperSize];
    if (!paper) throw new Error(`Unknown paper size: ${paperSize}`);

    const pdfDocument = await getCachedPdfDocument(fileUrl);
    if (pageNumber < 1 || pageNumber > pdfDocument.numPages) {
      throw new Error(`Invalid page number ${pageNumber}. Document has ${pdfDocument.numPages} pages.`);
    }

    const page = await pdfDocument.getPage(pageNumber);
    const baseViewport = page.getViewport({ scale: 1.0 });

    // Determine effective content dimensions
    let contentW = baseViewport.width;
    let contentH = baseViewport.height;

    const contentIsLandscape = contentW > contentH;
    const paperIsPortrait = paper.width < paper.height;

    // Decide if we should auto-rotate content for optimal space usage
    // If content is landscape and paper is portrait, rotating 90° uses more paper area
    let shouldAutoRotate = false;
    if (contentIsLandscape && paperIsPortrait) {
      // Check if rotating gives better area usage
      const fitScaleNormal = Math.min(paper.width / contentW, paper.height / contentH);
      const fitScaleRotated = Math.min(paper.width / contentH, paper.height / contentW);
      shouldAutoRotate = fitScaleRotated > fitScaleNormal;
    } else if (!contentIsLandscape && !paperIsPortrait) {
      // Portrait content on landscape paper
      const fitScaleNormal = Math.min(paper.width / contentW, paper.height / contentH);
      const fitScaleRotated = Math.min(paper.width / contentH, paper.height / contentW);
      shouldAutoRotate = fitScaleRotated > fitScaleNormal;
    }

    // After potential rotation, determine the effective content dimensions for fitting
    let effectiveW = contentW;
    let effectiveH = contentH;
    if (shouldAutoRotate) {
      [effectiveW, effectiveH] = [effectiveH, effectiveW];
    }

    // Calculate fit-to-page scale (allow both up and down scaling)
    // marginFactor controls how much of the paper area is used (1.0 = edge-to-edge, 0.92 = 4% margin each side)
    const fitScaleX = (paper.width * marginFactor) / effectiveW;
    const fitScaleY = (paper.height * marginFactor) / effectiveH;
    const fitScale = Math.min(fitScaleX, fitScaleY);

    console.log('📄 renderSinglePageOnPaper:', {
      pageNumber,
      paperSize,
      paperDims: `${paper.width}x${paper.height}`,
      contentDims: `${contentW.toFixed(0)}x${contentH.toFixed(0)}`,
      shouldAutoRotate,
      fitScale: fitScale.toFixed(3),
      viewScale: scale.toFixed(3)
    });

    // Quality multiplier for hi-DPI
    const qualityMultiplier = Math.min(1.5, devicePixelRatio);
    const displayScale = scale * qualityMultiplier;

    // Set canvas to paper dimensions at the display scale
    canvas.width = paper.width * displayScale;
    canvas.height = paper.height * displayScale;

    if (!preventStyleResize) {
      canvas.style.width = `${paper.width * scale}px`;
      canvas.style.height = `${paper.height * scale}px`;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get canvas context');

    // White paper background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw subtle paper border
    ctx.strokeStyle = '#d0d0d0';
    ctx.lineWidth = 1 * displayScale;
    ctx.strokeRect(0.5, 0.5, canvas.width - 1, canvas.height - 1);

    // Render the PDF page to a temp canvas at the fit scale
    const pdfRenderScale = fitScale * qualityMultiplier;
    let renderViewport;
    if (shouldAutoRotate) {
      // Rotate the viewport 90° for auto-rotation
      renderViewport = page.getViewport({ scale: fitScale * qualityMultiplier, rotation: 90 });
    } else {
      renderViewport = page.getViewport({ scale: fitScale * qualityMultiplier });
    }

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = renderViewport.width;
    tempCanvas.height = renderViewport.height;

    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) throw new Error('Could not get temp canvas context');

    tempCtx.imageSmoothingEnabled = true;
    tempCtx.imageSmoothingQuality = 'high';

    await page.render({
      canvasContext: tempCtx,
      viewport: renderViewport,
      intent: 'display',
      annotationMode: 0
    }).promise;

    // Center the rendered content on the paper canvas
    // The content was rendered at fitScale (which includes the margin factor)
    // We need to draw it on the paper canvas at the correct proportional size

    // The rendered content dimensions in paper-space (points) are:
    //   scaledContentW = effectiveW * fitScale  (in points, with margin applied)
    //   scaledContentH = effectiveH * fitScale  (in points, with margin applied)
    // On the canvas, these become:
    //   drawW = scaledContentW * displayScale = effectiveW * fitScale * displayScale
    //   drawH = scaledContentH * displayScale = effectiveH * fitScale * displayScale
    // But tempCanvas was rendered at fitScale * qualityMultiplier, so we scale it to displayScale:
    //   drawW = tempCanvas.width * (displayScale / pdfRenderScale)
    //     BUT this equals effectiveW * scale * qualityMultiplier which CANCELS the margin
    // FIX: Draw at the correct size that preserves the fitScale margin
    const scaledContentW = effectiveW * fitScale; // content size in paper points (with margin)
    const scaledContentH = effectiveH * fitScale;
    const drawW = scaledContentW * displayScale;
    const drawH = scaledContentH * displayScale;

    const offsetX = (canvas.width - drawW) / 2;
    const offsetY = (canvas.height - drawH) / 2;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(
      tempCanvas,
      0, 0, tempCanvas.width, tempCanvas.height,
      offsetX, offsetY,
      drawW, drawH
    );

    console.log('✨ Paper preview rendered:', {
      pageNumber,
      paperSize,
      canvasSize: `${canvas.width}x${canvas.height}`,
      contentOnPaper: `${Math.round(tempCanvas.width * (displayScale / pdfRenderScale))}x${Math.round(tempCanvas.height * (displayScale / pdfRenderScale))}`,
      offset: `${Math.round(offsetX)},${Math.round(offsetY)}`,
      autoRotated: shouldAutoRotate
    });

  } catch (error) {
    console.error('Error rendering single page on paper:', error);
    throw error;
  }
};

/**
 * Add visual indicators overlay (settings badges)
 */
export const drawSettingsIndicators = (
  canvas: HTMLCanvasElement,
  settings: {
    paperSize: PaperSizeKey;
    colorMode: 'BW' | 'Color';
    printType: 'Single' | 'Double';
    nupPages: number;
    copies: number;
  }
): void => {
  const context = canvas.getContext('2d');
  if (!context) return;

  const devicePixelRatio = window.devicePixelRatio || 1;
  context.save();

  // Badge configuration
  const badgeHeight = 24 * devicePixelRatio;
  const badgePadding = 8 * devicePixelRatio;
  const badgeMargin = 10 * devicePixelRatio;
  const fontSize = 11 * devicePixelRatio;

  // Create badges array
  const badges = [
    { text: settings.paperSize, color: '#2563eb', bg: '#dbeafe' },
    { text: settings.colorMode, color: settings.colorMode === 'BW' ? '#4b5563' : '#059669', bg: settings.colorMode === 'BW' ? '#e5e7eb' : '#d1fae5' },
    { text: settings.printType === 'Double' ? 'Duplex' : 'Simplex', color: '#7c3aed', bg: '#ede9fe' },
    { text: settings.nupPages > 1 ? `${settings.nupPages}-up` : 'Normal', color: '#dc2626', bg: '#fee2e2' },
    { text: `${settings.copies}x`, color: '#ea580c', bg: '#ffedd5' }
  ];

  // Draw badges at top-right corner
  let xOffset = canvas.width - badgeMargin;
  const yOffset = badgeMargin;

  badges.reverse().forEach(badge => {
    context.font = `${fontSize}px Arial`;
    const textWidth = context.measureText(badge.text).width;
    const badgeWidth = textWidth + 2 * badgePadding;

    xOffset -= badgeWidth + badgeMargin / 2;

    // Draw badge background
    context.fillStyle = badge.bg;
    context.fillRect(xOffset, yOffset, badgeWidth, badgeHeight);

    // Draw badge border
    context.strokeStyle = badge.color;
    context.lineWidth = 1.5 * devicePixelRatio;
    context.strokeRect(xOffset, yOffset, badgeWidth, badgeHeight);

    // Draw badge text
    context.fillStyle = badge.color;
    context.textBaseline = 'middle';
    context.fillText(badge.text, xOffset + badgePadding, yOffset + badgeHeight / 2);
  });

  context.restore();
};

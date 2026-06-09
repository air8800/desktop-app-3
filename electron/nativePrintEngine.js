const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const { PDFDocument, degrees } = require('pdf-lib');
const { applyOrderIdentificationToPdfBytes } = require('./orderIdentificationMark');

const TEMP_DIR = path.join(os.tmpdir(), 'xerox-print-jobs');

if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// Total PDF Printer (PDFPrinter.exe) path helpers
const getPDFPrinterAppPath = (isDev) => {
  const baseDir = isDev
    ? path.join(__dirname, '..', 'extraResources')
    : path.join(process.resourcesPath, 'extraResources');

  // 1. Check direct path
  let possiblePath = path.join(baseDir, 'PDFPrinter.exe');
  if (fs.existsSync(possiblePath)) return possiblePath;

  // 2. Check inside "Total PDF Printer" subfolder (what user pasted)
  possiblePath = path.join(baseDir, 'Total PDF Printer', 'PDFPrinter.exe');
  if (fs.existsSync(possiblePath)) return possiblePath;

  // 3. Check inside "PDFPrinter" subfolder
  possiblePath = path.join(baseDir, 'PDFPrinter', 'PDFPrinter.exe');
  if (fs.existsSync(possiblePath)) return possiblePath;

  // Default to direct path
  return path.join(baseDir, 'PDFPrinter.exe');
};

const isPDFPrinterAppAvailable = (isDev) => {
  const printerPath = getPDFPrinterAppPath(isDev);
  return fs.existsSync(printerPath);
};

// SumatraPDF path helpers
const getSumatraPath = (isDev) => {
  if (isDev) {
    return path.join(__dirname, '..', 'extraResources', 'SumatraPDF.exe');
  } else {
    return path.join(process.resourcesPath, 'extraResources', 'SumatraPDF.exe');
  }
};

const isSumatraAvailable = (isDev) => {
  const sumatraPath = getSumatraPath(isDev);
  return fs.existsSync(sumatraPath);
};

// PDFtoPrinter.exe path helpers (for silent vector-preserving printing)
const getPDFtoPrinterPath = (isDev) => {
  if (isDev) {
    return path.join(__dirname, '..', 'extraResources', 'PDFtoPrinter.exe');
  } else {
    return path.join(process.resourcesPath, 'extraResources', 'PDFtoPrinter.exe');
  }
};

const isPDFtoPrinterAvailable = (isDev) => {
  const pdfToPrinterPath = getPDFtoPrinterPath(isDev);
  return fs.existsSync(pdfToPrinterPath);
};

// 2Printer.exe path helpers (best control: papersize, tray, scale via CMD)
const get2PrinterPath = (isDev) => {
  // Define potential base directories
  const potentialDirs = [
    isDev ? path.join(__dirname, '..', 'extraResources') : null,
    process.resourcesPath ? path.join(process.resourcesPath, 'extraResources') : null,
    path.join(__dirname, '..', '..', 'extraResources'), // In case structure differs
    process.cwd() // Root check
  ].filter(Boolean);

  console.log('🔍 Checking for 2Printer in dirs:', potentialDirs);

  for (const baseDir of potentialDirs) {
    // Check inside "2Printer" subfolder (full installation)
    let possiblePath = path.join(baseDir, '2Printer', '2Printer.exe');
    if (fs.existsSync(possiblePath)) {
      console.log('✅ Found 2Printer at:', possiblePath);
      return possiblePath;
    }

    // Check direct path
    possiblePath = path.join(baseDir, '2Printer.exe');
    if (fs.existsSync(possiblePath)) {
      console.log('✅ Found 2Printer at:', possiblePath);
      return possiblePath;
    }
  }

  console.log('❌ 2Printer not found in any standard location');

  // Fallback to standard Dev path to avoid returning null/undefined
  const fallback = isDev
    ? path.join(__dirname, '..', 'extraResources', '2Printer', '2Printer.exe')
    : path.join(process.resourcesPath, 'extraResources', '2Printer', '2Printer.exe');

  return fallback;
};

const is2PrinterAvailable = (isDev) => {
  const printerPath = get2PrinterPath(isDev);
  return fs.existsSync(printerPath);
};

// ============================================================================
// PRINT JOB SERIALIZATION (prevents "PDFtoPrinter is already at work" errors)
// ============================================================================
let printLockPromise = Promise.resolve();

/**
 * Acquire print lock — ensures only one PDFtoPrinter job runs at a time.
 * Returns a release function to call when done.
 */
const acquirePrintLock = () => {
  let releaseLock;
  const previousLock = printLockPromise;
  printLockPromise = new Promise(resolve => {
    releaseLock = resolve;
  });
  return {
    waitForTurn: previousLock,
    release: releaseLock
  };
};

/**
 * Kill any stale PDFtoPrinter.exe processes that may be hanging.
 */
const killStalePDFtoPrinter = async () => {
  try {
    await execPromise('taskkill /IM PDFtoPrinter.exe /F 2>nul', { timeout: 5000 });
    console.log('🔪 Killed stale PDFtoPrinter process');
    await new Promise(resolve => setTimeout(resolve, 1000));
  } catch {
    // No process to kill — that's fine
  }
};

// Kill any stale PDFtoPrinter.exe processes on startup
killStalePDFtoPrinter().then(() => {
  console.log('✅ Startup cleanup: PDFtoPrinter check complete');
}).catch(() => { });

// Print with PDFtoPrinter.exe (silent, vector-preserving via Windows GDI)
// Sends PDF directly to printer via PDFtoPrinter.exe (pdf-lib handles all preprocessing)
const printWithPDFtoPrinter = async (filePath, printerName, options = {}, isDev = true) => {
  const {
    copies = 1,
    paperSize = 'A4',
    colorMode = 'Color',
    nupOrientation = 'portrait'
  } = options;

  const pdfToPrinterPath = getPDFtoPrinterPath(isDev);

  if (!fs.existsSync(pdfToPrinterPath)) {
    throw new Error(`PDFtoPrinter.exe not found at: ${pdfToPrinterPath}`);
  }

  console.log('🖨️ Using PDFtoPrinter.exe for silent vector-preserving print...');
  console.log('📄 Settings:', { paperSize, colorMode, copies, nupOrientation });

  // Initialize printFilePath to the input file — this is the fallback if preprocessing fails
  let printFilePath = filePath;
  let tempFileCreated = false;

  // Set printer paper size (best-effort, non-blocking)
  try {
    await setPrinterPaperSize(printerName, paperSize);
  } catch (psError) {
    console.warn('⚠️ Could not set printer paper size:', psError.message);
  }

  console.log('📄 Printing PDF:', printFilePath);

  // PDFtoPrinter.exe syntax: PDFtoPrinter.exe "filename" ["printername"]
  const command = `"${pdfToPrinterPath}" "${printFilePath}" "${printerName}"`;
  console.log('🖨️ Executing PDFtoPrinter command:', command);

  // Acquire print lock to serialize PDFtoPrinter calls
  const lock = acquirePrintLock();
  console.log('🔒 Waiting for print lock...');
  await lock.waitForTurn;
  console.log('🔓 Print lock acquired');

  try {
    // Small delay to ensure file is fully released/written
    if (tempFileCreated) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Execute for each copy with retry logic
    const MAX_RETRIES = 3;
    for (let i = 0; i < copies; i++) {
      let lastError;
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          await execPromise(command);
          if (copies > 1) {
            console.log(`✅ Copy ${i + 1}/${copies} sent`);
          }
          lastError = null;
          break; // Success, move to next copy
        } catch (execError) {
          lastError = execError;
          // Exit code 11 = "PDFtoPrinter is already at work"
          if (execError.code === 11 && attempt < MAX_RETRIES) {
            const delay = attempt * 2000; // 2s, 4s
            console.warn(`⚠️ PDFtoPrinter busy (attempt ${attempt}/${MAX_RETRIES}), killing stale processes and retrying in ${delay / 1000}s...`);
            await killStalePDFtoPrinter();
            await new Promise(resolve => setTimeout(resolve, delay));
          } else {
            throw execError;
          }
        }
      }
      if (lastError) throw lastError;

      // Small delay between copies to prevent overlap
      if (i < copies - 1) {
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }

    console.log('✅ PDFtoPrinter print job sent successfully');

    // Clean up temp file after a delay
    if (tempFileCreated && fs.existsSync(printFilePath)) {
      setTimeout(() => {
        try {
          if (fs.existsSync(printFilePath)) {
            fs.unlinkSync(printFilePath);
            console.log('🧹 Cleaned up preprocessed PDF');
          }
        } catch (e) {
          // Ignore cleanup errors
        }
      }, 10000);
    }

    return {
      success: true,
      engine: 'PDFtoPrinter',
      command,
      message: `Print job sent to ${printerName} via PDFtoPrinter: ${copies} copies, ${paperSize}, ${colorMode}`
    };
  } catch (error) {
    console.error('❌ PDFtoPrinter printing failed:', error.message);
    throw error;
  } finally {
    // ALWAYS release the lock so other jobs can proceed
    lock.release();
    console.log('🔓 Print lock released');
  }
};

// Windows DMPAPERSIZE constants for Set-PrintConfiguration
const WINDOWS_PAPER_SIZES = {
  'Letter': 1,    // DMPAPER_LETTER
  'Legal': 5,     // DMPAPER_LEGAL
  'Executive': 7, // DMPAPER_EXECUTIVE
  'A3': 8,        // DMPAPER_A3
  'A4': 9,        // DMPAPER_A4
  'A5': 11        // DMPAPER_A5
};

/**
 * Set printer paper size using Windows Print Configuration API.
 * This ensures the printer uses the correct paper tray/size regardless of its default.
 * NOTE: Set-PrintConfiguration does NOT have an -Orientation parameter.
 * Orientation is handled by the PDF content itself (pdf-lib bakes rotation in).
 */
const setPrinterPaperSize = async (printerName, paperSize) => {
  const winPaperSize = WINDOWS_PAPER_SIZES[paperSize];
  if (!winPaperSize) {
    console.warn(`⚠️ No Windows paper size mapping for: ${paperSize}, skipping`);
    return;
  }

  try {
    console.log(`📋 Setting printer paper size: ${printerName} → ${paperSize} (Windows code: ${winPaperSize})`);

    // Escape printer name for PowerShell (handle single quotes)
    const escapedPrinter = printerName.replace(/'/g, "''");

    // Set paper size ONLY — no Orientation parameter exists on Set-PrintConfiguration
    const psCommand = `powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Set-PrintConfiguration -PrinterName '${escapedPrinter}' -PaperSize ${winPaperSize} -ErrorAction Stop"`;

    await execPromise(psCommand, { timeout: 10000 });
    console.log(`✅ Printer paper size set: ${paperSize} on ${printerName}`);
  } catch (error) {
    console.warn(`⚠️ Set-PrintConfiguration failed (non-critical): ${error.message}`);
    // Don't throw - this is a best-effort enhancement. 
  }
};



const PAPER_SIZES = {
  'A3': { width: 841.89, height: 1190.55 },
  'A4': { width: 595.28, height: 841.89 },
  'A5': { width: 419.53, height: 595.28 },
  'Letter': { width: 612, height: 792 },
  'Legal': { width: 612, height: 1008 },
  'Executive': { width: 522, height: 756 }
};

const createNupLayout = async (pdfBytes, nupPages, targetPaperSize = 'A4', nupOrientation = 'portrait') => {
  try {
    console.log(`📊 Creating ${nupPages}-up layout with pdf-lib (${nupOrientation})...`);

    if (nupPages === 1) {
      return pdfBytes;
    }

    const sourcePdf = await PDFDocument.load(pdfBytes);
    const newPdf = await PDFDocument.create();

    const sourcePages = sourcePdf.getPages();
    const pageCount = sourcePages.length;

    const basePaperSize = PAPER_SIZES[targetPaperSize] || PAPER_SIZES['A4'];

    const isLandscape = nupOrientation === 'landscape';
    const targetSize = isLandscape
      ? { width: basePaperSize.height, height: basePaperSize.width }
      : { width: basePaperSize.width, height: basePaperSize.height };

    let cols, rows;
    switch (nupPages) {
      case 2:
        if (isLandscape) {
          cols = 2; rows = 1;
        } else {
          cols = 1; rows = 2;
        }
        break;
      case 4:
        cols = 2; rows = 2;
        break;
      case 6:
        if (isLandscape) {
          cols = 3; rows = 2;
        } else {
          cols = 2; rows = 3;
        }
        break;
      case 9:
        cols = 3; rows = 3;
        break;
      default:
        cols = 2; rows = 2;
    }

    const cellWidth = targetSize.width / cols;
    const cellHeight = targetSize.height / rows;

    for (let i = 0; i < pageCount; i += nupPages) {
      const newPage = newPdf.addPage([targetSize.width, targetSize.height]);

      for (let j = 0; j < nupPages && (i + j) < pageCount; j++) {
        const sourcePageIndex = i + j;
        const sourcePage = sourcePdf.getPages()[sourcePageIndex];
        const [embeddedPage] = await newPdf.embedPages([sourcePage]);

        const pageRotation = sourcePage.getRotation().angle;

        const col = j % cols;
        const row = Math.floor(j / cols);

        const x = col * cellWidth;
        const y = targetSize.height - (row + 1) * cellHeight;

        const sourceDims = embeddedPage.scale(1);

        let effectiveWidth = sourceDims.width;
        let effectiveHeight = sourceDims.height;

        if (pageRotation === 90 || pageRotation === 270) {
          [effectiveWidth, effectiveHeight] = [effectiveHeight, effectiveWidth];
        }

        const scaleX = cellWidth / effectiveWidth;
        const scaleY = cellHeight / effectiveHeight;
        const scale = Math.min(scaleX, scaleY) * 0.95;

        const scaledWidth = sourceDims.width * scale;
        const scaledHeight = sourceDims.height * scale;

        let offsetX, offsetY;
        if (pageRotation === 90 || pageRotation === 270) {
          offsetX = (cellWidth - scaledHeight) / 2;
          offsetY = (cellHeight - scaledWidth) / 2;
        } else {
          offsetX = (cellWidth - scaledWidth) / 2;
          offsetY = (cellHeight - scaledHeight) / 2;
        }

        newPage.drawPage(embeddedPage, {
          x: x + offsetX,
          y: y + offsetY,
          width: scaledWidth,
          height: scaledHeight
        });
      }

      // If we created a Landscape page for N-up, rotate it 90 degrees (CCW 270)
      // so it becomes a "Portrait" page with sideways content.
      // This allows printing on Portrait paper without driver orientation issues.
      if (isLandscape) {
        newPage.setRotation(degrees(270));
        // Note: Visually this makes top->right.
        // If user wants top->left, use 90.
        // Standard is usually 270 (Top of content at Right edge of Portrait page).
      }
    }

    const newPdfBytes = await newPdf.save();
    console.log(`✅ N-up layout created: ${Math.ceil(pageCount / nupPages)} sheets (${nupOrientation})`);
    return newPdfBytes;

  } catch (error) {
    console.error('❌ N-up layout creation failed:', error);
    return pdfBytes;
  }
};

const resizePdfToPaperSize = async (pdfBytes, targetPaperSize = 'A4', nupPages = 1) => {
  try {
    console.log(`📄 Resizing PDF to ${targetPaperSize} (nupPages: ${nupPages})...`);

    // Normalize paper size lookup (case-insensitive)
    const normalizedSizeKey = Object.keys(PAPER_SIZES).find(k => k.toLowerCase() === targetPaperSize.toLowerCase());
    const targetSize = normalizedSizeKey ? PAPER_SIZES[normalizedSizeKey] : null;

    if (!targetSize) {
      console.warn(`⚠️ Unknown paper size: ${targetPaperSize}, defaulting to A4`);
      // Fallback to A4 if completely unknown
      // But if we return original bytes, we might miss resizing.
      // Better to default to A4 explicitly? Or just use A4 dims.
      // Let's use A4 dims if not found.
    }
    const finalTargetSize = targetSize || PAPER_SIZES['A4'];

    const startTime = Date.now();
    console.log(`⏱️ Processing started...`);
    console.log(`📦 Input file size: ${(pdfBytes.length / 1024 / 1024).toFixed(2)} MB`);

    const sourcePdf = await PDFDocument.load(pdfBytes);
    const newPdf = await PDFDocument.create();

    const sourcePages = sourcePdf.getPages();

    // DISABLED OPTIMIZATION: PDFtoPrinter doesn't scale properly, so we must always
    // resize the PDF to match the target paper size exactly.
    // This ensures the printed output matches the PDF preview dimensions.
    console.log('📐 Processing PDF to ensure exact target paper dimensions...');

    // Check if ANY page actually needs resizing/rotation correction
    let needsProcessing = false;
    for (let i = 0; i < sourcePages.length; i++) {
      const sourcePage = sourcePages[i];
      const pageRotation = sourcePage.getRotation().angle;
      const mediaBox = sourcePage.getMediaBox();
      let sourceWidth = mediaBox.width;
      let sourceHeight = mediaBox.height;
      if (pageRotation === 90 || pageRotation === 270) {
        [sourceWidth, sourceHeight] = [sourceHeight, sourceWidth];
      }

      const sourceIsLandscape = sourceWidth > sourceHeight;
      const targetIsPortrait = finalTargetSize.width < finalTargetSize.height;

      let finalTargetWidth = finalTargetSize.width;
      let finalTargetHeight = finalTargetSize.height;

      // Logic must match execution loop: Force Portrait + Rotation
      // Do NOT swap dimensions here. 
      // If we swapped, we might falsely think "No Processing Needed" for exact-fit landscape.

      const widthDiff = Math.abs(sourceWidth - finalTargetWidth);
      const heightDiff = Math.abs(sourceHeight - finalTargetHeight);

      // If dimensions differ by more than 1 point, or rotation isn't 0 (meaning we need to bake rotation)
      // We consider it needing processing.
      // NOTE: If rotation is 90, we WANT to process it to bake it upright for the printer.
      if (widthDiff > 1 || heightDiff > 1 || pageRotation !== 0) {
        needsProcessing = true;
        break;
      }
    }

    if (!needsProcessing) {
      console.log('✨ PDF matches target paper size and rotation perfectly. Skipping resize processing.');
      return pdfBytes;
    }

    // Batch embed all pages to PREVENT resource duplication (bloat fix)
    const embeddedPages = await newPdf.embedPages(sourcePages);

    for (let i = 0; i < sourcePages.length; i++) {
      const sourcePage = sourcePages[i];
      const embeddedPage = embeddedPages[i];

      let pageRotation = sourcePage.getRotation().angle;
      const mediaBox = sourcePage.getMediaBox();


      let sourceWidth = mediaBox.width;
      let sourceHeight = mediaBox.height;

      if (pageRotation === 90 || pageRotation === 270) {
        [sourceWidth, sourceHeight] = [sourceHeight, sourceWidth];
      }

      console.log(`📄 Page ${i + 1}: ${sourceWidth}x${sourceHeight}, rotation: ${pageRotation}°`);

      const sourceIsLandscape = sourceWidth > sourceHeight;
      const targetIsPortrait = finalTargetSize.width < finalTargetSize.height;

      let finalTargetWidth = finalTargetSize.width;
      let finalTargetHeight = finalTargetSize.height;

      if (sourceIsLandscape && targetIsPortrait) {
        console.log('🔄 Visual Landscape on Portrait Paper: Auto-rotating content 90° (to 270°) to fit.');
        // Do NOT swap target dimensions. Keep them Portrait.
        // Force 270 degrees (Top-Left orientation, effectively 90 CW)
        if (pageRotation === 0 || pageRotation === 180) {
          pageRotation = 270;
        }
      }

      const newPage = newPdf.addPage([finalTargetWidth, finalTargetHeight]);



      const embeddedDims = embeddedPage.scale(1);

      let effectiveWidth = embeddedDims.width;
      let effectiveHeight = embeddedDims.height;

      if (pageRotation === 90 || pageRotation === 270) {
        [effectiveWidth, effectiveHeight] = [effectiveHeight, effectiveWidth];
      }

      const scaleX = finalTargetWidth / effectiveWidth;
      const scaleY = finalTargetHeight / effectiveHeight;
      // Fit-to-page: scale content to optimally fill the paper (both up and down)
      const scale = Math.min(scaleX, scaleY);

      // Used to have safety margin (0.94), but user requested exact scale respect.
      // Now using exact calculated scale to fit content to page bounds.

      const scaledWidth = embeddedDims.width * scale;
      const scaledHeight = embeddedDims.height * scale;

      let x, y;
      if (pageRotation === 90) {
        // Rotated 90 deg CCW: Up w, Left h
        // Anchor moves to Bottom-Right
        x = (finalTargetWidth + scaledHeight) / 2;
        y = (finalTargetHeight - scaledWidth) / 2;
      } else if (pageRotation === 270) {
        // Rotated 270 deg CCW (90 CW): Down w, Right h
        // Anchor moves to Top-Left of visual box
        // Centering: x = (PageW - H)/2, y = (PageH + W)/2
        x = (finalTargetWidth - scaledHeight) / 2;
        y = (finalTargetHeight + scaledWidth) / 2;
      } else if (pageRotation === 180) {
        // Rotated 180: Left w, Down h
        // Anchor moves to Top-Right of visual box
        x = (finalTargetWidth + scaledWidth) / 2;
        y = (finalTargetHeight + scaledHeight) / 2;
      } else {
        // 0 rotation
        x = (finalTargetWidth - scaledWidth) / 2;
        y = (finalTargetHeight - scaledHeight) / 2;
      }

      newPage.drawPage(embeddedPage, {
        x: x,
        y: y,
        width: scaledWidth,
        height: scaledHeight,
        rotate: degrees(pageRotation)
      });
    }

    const newPdfBytes = await newPdf.save({ useObjectStreams: true });
    console.log(`📦 Output file size: ${(newPdfBytes.length / 1024 / 1024).toFixed(2)} MB`);
    console.log(`⏱️ Total time (Processed): ${(Date.now() - startTime) / 1000}s`);
    console.log(`✅ PDF resized to ${targetPaperSize}`);
    return newPdfBytes;

  } catch (error) {
    console.error('❌ PDF resize failed:', error);
    return pdfBytes;
  }
};

const processPdf = async (inputPath, options = {}) => {
  try {
    const {
      paperSize = 'A4',
      nupPages = 1,
      nupOrientation = 'portrait',
      colorMode = 'BW',
      orderMark = null
    } = options;

    console.log('🔄 Processing PDF with pdf-lib:', { paperSize, nupPages, nupOrientation, colorMode });

    let pdfBytes = fs.readFileSync(inputPath);

    if (nupPages > 1) {
      pdfBytes = await createNupLayout(pdfBytes, nupPages, paperSize, nupOrientation);
    }

    if (nupPages === 1) {
      pdfBytes = await resizePdfToPaperSize(pdfBytes, paperSize, nupPages);
    }

    if (orderMark) {
      pdfBytes = await applyOrderIdentificationToPdfBytes(pdfBytes, orderMark, paperSize);
      console.log('🏷️ Order identification applied:', orderMark);
    }

    const timestamp = Date.now();
    const outputPath = path.join(TEMP_DIR, `processed_${timestamp}.pdf`);
    fs.writeFileSync(outputPath, pdfBytes);

    console.log('✅ PDF processing complete:', outputPath);
    return {
      success: true,
      outputPath,
      originalPath: inputPath
    };

  } catch (error) {
    console.error('❌ PDF processing failed:', error);
    return {
      success: false,
      error: error.message,
      outputPath: inputPath
    };
  }
};

// ============================================================================
// 2PRINTER — Full CLI control: papersize, copies, scale, orient, color via -props
// NOTE: 2Printer papersize takes numeric DMPAPERSIZE IDs (e.g. 9=A4, 5=Legal, 1=Letter),
// NOT paper size names. See WINDOWS_PAPER_SIZES above for the mapping.
// ============================================================================

const printWith2Printer = async (filePath, printerName, options = {}, isDev = true) => {
  const {
    copies = 1,
    paperSize = 'A4',
    colorMode = 'color',
    nupOrientation = 'portrait'
  } = options;

  const lock = acquirePrintLock();

  try {
    await lock.waitForTurn;
    console.log('🔒 Print lock acquired for 2Printer');

    const twoPrinterPath = get2PrinterPath(isDev);

    if (!fs.existsSync(twoPrinterPath)) {
      throw new Error(`2Printer.exe not found at: ${twoPrinterPath}`);
    }

    if (!fs.existsSync(filePath)) {
      throw new Error(`PDF file not found: ${filePath}`);
    }

    const numericPaperId = WINDOWS_PAPER_SIZES[paperSize];
    const colorValue = (colorMode === 'grayscale' || colorMode === 'BW') ? 'grayscale' : 'color';
    const orientValue = nupOrientation === 'landscape' ? 'landscape' : 'portrait';

    let propsArgs = [
      `copies:${copies}`,
      `scale:fit`,
      `orient:${orientValue}`,
      `color:${colorValue}`
    ];

    if (numericPaperId) {
      propsArgs.push(`papersize:${numericPaperId}`);
      console.log(`📄 2Printer paper size: ${paperSize} → numeric ID ${numericPaperId}`);
    } else {
      console.warn(`⚠️ No numeric paper ID for ${paperSize}, 2Printer will use printer defaults`);
    }

    const propsStr = propsArgs.join(' ');
    const iniPath = path.join(__dirname, '..', '2Printer_utf8.ini');
    const command = `"${twoPrinterPath}" -src "${filePath}" -prn "${printerName}" -props ${propsStr} -options silent:yes alerts:no skip_prn_enum:yes -inipath "${iniPath}"`;

    console.log('🖨️ 2Printer command:', command);

    const result = await execPromise(command, {
      cwd: path.dirname(twoPrinterPath),
      maxBuffer: 1024 * 1024
    });

    console.log('📋 2Printer stdout:', result.stdout || '(none)');
    if (result.stderr) {
      console.warn('⚠️ 2Printer stderr:', result.stderr);
    }

    console.log('✅ 2Printer print job sent successfully');

    return {
      success: true,
      message: `Printed via 2Printer with papersize:${paperSize} (ID ${numericPaperId || 'default'})`,
      engine: '2Printer',
      paperSize
    };

  } catch (error) {
    console.error('❌ 2Printer failed:', error.message);
    if (error.stderr) console.error('📋 2Printer stderr:', error.stderr);
    if (error.stdout) console.error('📋 2Printer stdout:', error.stdout);
    if (error.code) console.error('📋 2Printer exit code:', error.code);
    if (error.killed) console.error('📋 2Printer was killed (timeout)');
    throw error;
  } finally {
    lock.release();
    console.log('🔓 Print lock released (2Printer)');
  }
};

const printWithSumatra = async (filePath, printerName, options = {}, isDev = true) => {
  try {
    const {
      paperSize = 'A4',
      copies = 1,
      colorMode = 'BW',
      printType = 'Single',
      nupOrientation = 'portrait'
    } = options;

    const sumatraPath = getSumatraPath(isDev);

    if (!fs.existsSync(sumatraPath)) {
      throw new Error(`SumatraPDF not found at: ${sumatraPath}. Please place SumatraPDF.exe in extraResources folder.`);
    }

    const settingsParts = [];
    settingsParts.push(`${copies}x`);
    settingsParts.push(`paper=${paperSize}`);
    // Add 'fit' to scale PDF content to fit within the paper size
    // This ensures the printed output matches the PDF preview dimensions
    settingsParts.push('fit');
    // DISABLED: monochrome flag may cause SumatraPDF to rasterize the PDF
    // settingsParts.push(colorMode === 'Color' ? 'color' : 'monochrome');
    settingsParts.push(printType === 'Double' ? 'duplex' : 'simplex');

    if (nupOrientation === 'landscape') {
      settingsParts.push('landscape');
    }

    const printSettings = settingsParts.join(',');

    const command = `"${sumatraPath}" -print-to "${printerName}" -print-settings "${printSettings}" -silent "${filePath}"`;

    console.log('🖨️ Executing SumatraPDF command:', command);

    await execPromise(command);

    console.log('✅ Print job sent successfully');

    return {
      success: true,
      engine: 'SumatraPDF',
      command,
      message: `Print job sent to ${printerName}: ${paperSize}, ${copies} copies, ${colorMode}, ${printType}, ${nupOrientation}`
    };

  } catch (error) {
    console.error('❌ SumatraPDF printing failed:', error);
    throw error;
  }
};

// Print with Total PDF Printer (PDFPrinter.exe)
// Supports explicit paper size via -ps "Size"
const printWithPDFPrinter = async (filePath, printerName, options = {}, isDev = true) => {
  try {
    const {
      paperSize = 'A4',
      copies = 1,
      // Total PDF Printer might support color/duplex but we focus on paper size for now
    } = options;

    const printerAppPath = getPDFPrinterAppPath(isDev);

    if (!fs.existsSync(printerAppPath)) {
      throw new Error(`PDFPrinter.exe not found at: ${printerAppPath}`);
    }

    // Total PDF Printer syntax (based on standard CoolUtils CLI):
    // PDFPrinter.exe "input.pdf" -pr "Printer Name" -ps "PaperSize" [-copy N]

    // Process input path for safety
    const safeFilePath = `"${filePath}"`;
    const safePrinterName = `"${printerName}"`;
    const safePaperSize = `"${paperSize}"`;

    const command = `"${printerAppPath}" ${safeFilePath} -pr ${safePrinterName} -ps ${safePaperSize} -copy ${copies}`;

    console.log('🖨️ Executing Total PDF Printer command:', command);

    // Add timeout to prevent hanging if the tool pops up a window
    await execPromise(command, { timeout: 20000 });

    console.log('✅ Print job sent successfully via PDFPrinter');

    return {
      success: true,
      method: 'Total PDF Printer (PDFPrinter.exe)',
      command,
      message: `Print job sent to ${printerName}: ${paperSize}, ${copies} copies`
    };

  } catch (error) {
    console.error('❌ Total PDF Printer failed:', error.message);
    throw error;
  }
};

const printPdfNatively = async (filePath, printerName, options = {}, isDev = true) => {
  try {
    const {
      paperSize = 'A4',
      copies = 1,
      colorMode = 'BW',
      printType = 'Single',
      nupPages = 1,
      nupOrientation = 'portrait',
      orderMark = null
    } = options;

    console.log('🖨️ Native Print Engine - Starting print job:', {
      filePath,
      printerName,
      paperSize,
      copies,
      colorMode,
      printType,
      nupPages,
      nupOrientation
    });

    let printFilePath = filePath;

    // Detect page orientation from PDF BEFORE processing
    let detectedLandscape = false;
    try {
      const pdfBytes = fs.readFileSync(filePath);
      const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
      const firstPage = pdfDoc.getPage(0);
      const { width, height } = firstPage.getSize();
      const rotation = firstPage.getRotation().angle;

      // Account for rotation when determining orientation
      let effectiveWidth = width;
      let effectiveHeight = height;
      if (rotation === 90 || rotation === 270) {
        [effectiveWidth, effectiveHeight] = [effectiveHeight, effectiveWidth];
      }

      detectedLandscape = effectiveWidth > effectiveHeight;
      console.log(`📐 Page orientation detected: ${detectedLandscape ? 'LANDSCAPE' : 'PORTRAIT'} (${effectiveWidth.toFixed(0)}x${effectiveHeight.toFixed(0)}, rotation: ${rotation}°)`);
    } catch (detectError) {
      console.warn('⚠️ Could not detect page orientation:', detectError.message);
    }

    // For N-up layout creation: use landscape if source pages are landscape (side-by-side).
    // resizePdfToPaperSize will then rotate the landscape output to portrait automatically.
    const nupLayoutOrientation = detectedLandscape ? 'landscape' : nupOrientation;

    console.log(`📐 N-up layout orientation: ${nupLayoutOrientation} (detected=${detectedLandscape}, nupPages=${nupPages})`);

    // ALWAYS process PDF to ensure dimensions match target paper size exactly.
    // resizePdfToPaperSize handles landscape→portrait rotation, so the output is always portrait.
    const processResult = await processPdf(filePath, {
      paperSize,
      nupPages,
      nupOrientation: nupLayoutOrientation,
      colorMode,
      orderMark
    });

    if (processResult.success) {
      printFilePath = processResult.outputPath;
      console.log('📄 Using processed PDF:', printFilePath);
    }

    // Helper to clean up temp files after printing
    const cleanupTemp = () => {
      if (printFilePath !== filePath && fs.existsSync(printFilePath)) {
        setTimeout(() => {
          try {
            if (fs.existsSync(printFilePath)) fs.unlinkSync(printFilePath);
          } catch (e) { }
        }, 5000);
      }
    };

    // 1. PRIMARY: PDFtoPrinter (free, vectors preserved)
    if (isPDFtoPrinterAvailable(isDev)) {
      console.log('🚀 Using PDFtoPrinter (primary — free, vectors preserved)...');
      try {
        const result = await printWithPDFtoPrinter(printFilePath, printerName, {
          copies,
          paperSize,
          colorMode,
          nupOrientation: 'portrait'
        }, isDev);

        console.log('✅ PDFtoPrinter print succeeded!');
        cleanupTemp();
        return {
          success: true,
          engine: 'PDFtoPrinter',
          message: result.message,
          paperSize,
          copies,
          colorMode
        };
      } catch (pdfToPrinterError) {
        console.warn('⚠️ PDFtoPrinter failed. Falling back to SumatraPDF.', pdfToPrinterError.message);
      }
    }

    // 2. FALLBACK: SumatraPDF
    if (isSumatraAvailable(isDev)) {
      console.log('⚠️ Falling back to SumatraPDF (last resort)...');
      const result = await printWithSumatra(printFilePath, printerName, {
        copies,
        paperSize,
        colorMode,
        printType,
        nupOrientation: 'portrait'
      }, isDev);

      cleanupTemp();
      return {
        success: true,
        engine: 'SumatraPDF',
        message: result.message,
        paperSize,
        copies,
        colorMode
      };
    }

    // 4. No print engine available
    throw new Error('No print engine found. Please add PDFtoPrinter.exe to extraResources/');

  } catch (error) {
    console.error('❌ Native Print Engine failed:', error);
    return {
      success: false,
      error: error.message,
      message: `Print failed: ${error.message}`
    };
  }
};

const cleanupTempFiles = () => {
  try {
    if (fs.existsSync(TEMP_DIR)) {
      const files = fs.readdirSync(TEMP_DIR);
      const now = Date.now();
      const maxAge = 60 * 60 * 1000;

      let cleanedCount = 0;

      for (const file of files) {
        const filePath = path.join(TEMP_DIR, file);
        const stats = fs.statSync(filePath);

        if (now - stats.mtime.getTime() > maxAge) {
          fs.unlinkSync(filePath);
          cleanedCount++;
        }
      }

      console.log(`🧹 Cleaned up ${cleanedCount} old temp files`);
      return { success: true, cleanedCount };
    }

    return { success: true, cleanedCount: 0 };
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  printPdfNatively,
  processPdf,
  createNupLayout,
  resizePdfToPaperSize,
  isSumatraAvailable,
  getSumatraPath,
  cleanupTempFiles,
  PAPER_SIZES,
  // PDFtoPrinter functions (primary — free, vectors, .dat paper control)
  getPDFtoPrinterPath,
  isPDFtoPrinterAvailable,
  printWithPDFtoPrinter,
  // 2Printer functions (fallback — paid $149)
  get2PrinterPath,
  is2PrinterAvailable,
  printWith2Printer,
  // Total PDF Printer helpers
  getPDFPrinterAppPath,
  isPDFPrinterAppAvailable
};

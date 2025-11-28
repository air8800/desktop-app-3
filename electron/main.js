"use strict";
const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron');
const path = require('path');
const isDev = require('electron-is-dev');
const Store = require('electron-store');
const { exec } = require('child_process');
const util = require('util');
const fs = require('fs');
const os = require('os');
const { isSupportedPaperSize, getAvailablePaperSizes } = require('./paperSizeConfig');
const directPrint = require('./directPrint');
const advancedPaperSizeControl = require('./advancedPaperSizeControl');
const pdfPrintManager = require('./pdfPrintManager');
const silentPdfPrinting = require('./silentPdfPrinting');
const mupdfPrinting = require('./mupdfPrinting');
const ghostscriptPrinting = require('./ghostscriptPrinting');
const cpdftPrinting = require('./cpdftPrinting');

const execPromise = util.promisify(exec);

// Initialize the store for persistent data
const store = new Store();

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    icon: path.join(__dirname, '../public/icon.png'),
    // Remove the menu bar
    autoHideMenuBar: true,
    menuBarVisible: false,
  });

  // Completely remove the menu bar
  Menu.setApplicationMenu(null);

  const startUrl = isDev
    ? 'http://localhost:5173'
    : `file://${path.join(__dirname, '../dist/index.html')}`;

  mainWindow.loadURL(startUrl);

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ============================================================================
// QR CODE FUNCTIONS
// ============================================================================

ipcMain.handle('save-qr-image', async (event, imageData) => {
  try {
    store.set('payment-qr', imageData);
    return { success: true };
  } catch (error) {
    console.error('Error saving QR image:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-qr-image', async () => {
  try {
    const qrImage = store.get('payment-qr');
    return { success: true, data: qrImage };
  } catch (error) {
    console.error('Error getting QR image:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('upload-qr-image', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['jpg', 'png', 'jpeg'] }],
    });

    if (result.canceled) {
      return { success: false, error: 'File selection canceled' };
    }

    store.set('payment-qr', result.filePaths[0]);
    return { success: true, path: result.filePaths[0] };
  } catch (error) {
    console.error('Error uploading QR image:', error);
    return { success: false, error: error.message };
  }
});

// ============================================================================
// PRINTER FUNCTIONS
// ============================================================================

ipcMain.handle('get-printers', async () => {
  try {
    let printers = [];

    if (process.platform === 'win32') {
      try {
        // Use PowerShell command with proper syntax
        const { stdout } = await execPromise(
          'powershell.exe -Command "Get-Printer | Select-Object Name,PrinterStatus,IsDefault | ConvertTo-Json"'
        );
        if (stdout) {
          const systemPrinters = JSON.parse(stdout);
          // Handle both single printer and multiple printers cases
          const printersArray = Array.isArray(systemPrinters) ? systemPrinters : [systemPrinters];
          printers = printersArray.map(printer => ({
            name: printer.Name,
            status: printer.PrinterStatus === 1 ? 'Ready' : 'Not Ready',
            default: printer.IsDefault || false
          }));
        }
      } catch (error) {
        console.error('Error getting system printers:', error);
      }
    } else if (process.platform === 'darwin') {
      try {
        // macOS printer detection
        const { stdout } = await execPromise('lpstat -p');
        const printerLines = stdout.split('\n').filter(line => line.startsWith('printer'));
        printers = printerLines.map(line => {
          const name = line.split(' ')[1];
          return {
            name: name,
            status: 'Ready',
            default: false
          };
        });
      } catch (error) {
        console.error('Error getting macOS printers:', error);
      }
    } else {
      try {
        // Linux printer detection
        const { stdout } = await execPromise('lpstat -p');
        const printerLines = stdout.split('\n').filter(line => line.includes('printer'));
        printers = printerLines.map(line => {
          const name = line.split(' ')[1];
          return {
            name: name,
            status: 'Ready',
            default: false
          };
        });
      } catch (error) {
        console.error('Error getting Linux printers:', error);
      }
    }

    // If no printers were found, add default virtual printer
    if (printers.length === 0) {
      printers.push({
        name: 'Microsoft Print to PDF',
        status: 'Ready',
        default: true
      });
    }

    // Add paper size support information
    const printersWithPaperSizes = printers.map(printer => {
      return {
        ...printer,
        supportedPaperSizes: getAvailablePaperSizes().map(size => size.key)
      };
    });

    return { success: true, printers: printersWithPaperSizes };
  } catch (error) {
    console.error('Error getting printers:', error);
    return { success: false, error: error.message };
  }
});

// ============================================================================
// PRINT FUNCTIONS WITH PAPER SIZE SUPPORT
// ============================================================================

// Download file from URL - IMPROVED WITH BETTER ERROR HANDLING AND URL ENCODING
async function downloadFile(fileUrl, filename) {
  try {
    const tempDir = path.join(os.tmpdir(), 'xerox-print-jobs');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const timestamp = Date.now();
    const fileExtension = path.extname(filename);
    const baseName = path.basename(filename, fileExtension);
    
    // Create a simpler filename to avoid path length issues
    const simplifiedBaseName = baseName
      .replace(/[^a-zA-Z0-9]/g, '_')  // Replace non-alphanumeric with underscore
      .substring(0, 50);              // Limit length
    
    const uniqueFilename = `${simplifiedBaseName}_${timestamp}${fileExtension}`;
    const filePath = path.join(tempDir, uniqueFilename);

    console.log('📥 Downloading file:', { fileUrl, filePath });

    // Check if URL needs encoding
    let processedUrl = fileUrl;
    if (fileUrl.includes(' ') || fileUrl.includes('%20')) {
      // URL already has spaces or encoded spaces, ensure proper encoding
      processedUrl = encodeURI(decodeURI(fileUrl));
    }

    // Use fetch API instead of curl for better reliability
    const response = await fetch(processedUrl);
    
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    
    const fileBuffer = await response.arrayBuffer();
    fs.writeFileSync(filePath, Buffer.from(fileBuffer));

    if (!fs.existsSync(filePath)) {
      throw new Error('File download failed - file not found after download');
    }

    const stats = fs.statSync(filePath);
    if (stats.size === 0) {
      throw new Error('File download failed - downloaded file is empty');
    }

    return filePath;
  } catch (error) {
    console.error('❌ Download error:', error);
    throw error;
  }
}

// Main print function with paper size support
ipcMain.handle('download-and-print-file', async (event, fileUrl, filename, printerName, copies = 1, paperSize = 'A4', colorMode = 'BW', printType = 'Single', nupPages = 1, nupOrientation = 'portrait') => {
  try {
    console.log('🖨️ Starting print job with ALL parameters:', {
      fileUrl,
      filename,
      printerName,
      copies,
      paperSize,
      colorMode,
      printType,
      nupPages,
      nupOrientation
    });

    // Validate paper size
    if (!isSupportedPaperSize(paperSize)) {
      console.warn(`Unsupported paper size: ${paperSize}, defaulting to A4`);
      paperSize = 'A4';
    }

    // Download the file
    const filePath = await downloadFile(fileUrl, filename);
    console.log('📁 File downloaded to:', filePath);

    // Check if it's a PDF file
    const isPdf = path.extname(filePath).toLowerCase() === '.pdf';
    
    if (isPdf) {
      // Check if cpdf is installed (best option)
      const isCpdftAvailable = await cpdftPrinting.isCpdftInstalled();
      
      if (isCpdftAvailable) {
        // Use cpdf for PDF processing (best quality)
        const cpdftResult = await cpdftPrinting.processPdfWithCpdf(filePath, printerName, paperSize, copies, colorMode, printType, nupPages || 1, nupOrientation);
        
        if (cpdftResult.success) {
          // Now print the processed file with SumatraPDF
          return await silentPdfPrinting.printPdfSilently(cpdftResult.processedFilePath, printerName, paperSize, copies, colorMode, printType, 1, nupOrientation);
        } else {
          console.log('⚠️ cpdf processing failed, falling back to other methods');
        }
      }
      
      // Check if Ghostscript is installed (fallback)
      const isGsAvailable = await ghostscriptPrinting.isGhostscriptInstalled();
      
      if (isGsAvailable) {
        // Use Ghostscript for PDF printing
        return await ghostscriptPrinting.printPdfSilently(filePath, printerName, paperSize, copies, colorMode, printType, nupPages || 1, nupOrientation);
      } else {
        // Check if MuPDF is installed as fallback
        const isMuPDFAvailable = await mupdfPrinting.isMuPDFInstalled();
        
        if (isMuPDFAvailable) {
          // Use MuPDF for PDF printing
          return await mupdfPrinting.printPdfSilently(filePath, printerName, paperSize, copies, colorMode, printType, nupPages || 1, nupOrientation);
        } else {
          // Fallback to SumatraPDF or other methods
          return await silentPdfPrinting.printPdfSilently(filePath, printerName, paperSize, copies, colorMode, printType, nupPages || 1, nupOrientation);
        }
      }
    } else {
      // Force paper size setting using advanced methods
      await advancedPaperSizeControl.forcePaperSize(printerName, paperSize);

      // Use direct printing for Windows
      if (process.platform === 'win32') {
        return await directPrint.printFileDirectly(filePath, printerName, paperSize, copies, colorMode, printType, nupPages || 1, nupOrientation);
      } else {
        // For other platforms, use a simpler approach with duplex support
        const duplexOption = printType === 'Double' ? '-o sides=two-sided-long-edge' : '-o sides=one-sided';
        const colorOption = colorMode === 'Color' ? '' : '-o ColorModel=Gray';

        const printCommand = process.platform === 'darwin'
          ? `lp -d "${printerName}" -n ${copies} -o media=${paperSize} ${duplexOption} ${colorOption} "${filePath}"`
          : `lp -d "${printerName}" -n ${copies} -o media=${paperSize} ${duplexOption} ${colorOption} "${filePath}"`;

        console.log('🖨️ Executing print command:', printCommand);
        await execPromise(printCommand);

        return {
          success: true,
          message: `Print job sent to ${printerName} with ${paperSize} paper size, ${copies} copies, ${colorMode} mode, ${printType} printing`,
          command: process.platform === 'darwin' ? 'macOS lp' : 'Linux lp'
        };
      }
    }
  } catch (error) {
    console.error('❌ Print job failed:', error);
    return { 
      success: false, 
      error: error.message,
      paperSize
    };
  }
});

// Test printing function with paper size
ipcMain.handle('test-print', async (event, printerName, paperSize = 'A4') => {
  try {
    console.log('🧪 Testing printer with paper size:', { printerName, paperSize });
    
    // Validate paper size
    if (!isSupportedPaperSize(paperSize)) {
      console.warn(`Unsupported paper size: ${paperSize}, defaulting to A4`);
      paperSize = 'A4';
    }
    
    // Force paper size setting using advanced methods
    await advancedPaperSizeControl.forcePaperSize(printerName, paperSize);
    
    // Use direct print for Windows
    if (process.platform === 'win32') {
      return await directPrint.createAndPrintTestFile(printerName, paperSize);
    } else {
      // For other platforms, create a simple test file
      const tempDir = path.join(os.tmpdir(), 'xerox-print-jobs');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const testFilePath = path.join(tempDir, `test-print-${Date.now()}.txt`);
      const testContent = `Test Print Job\nPrinter: ${printerName}\nPaper Size: ${paperSize}\nTime: ${new Date().toLocaleString()}\nThis is a test print to verify printer connectivity.\n\nIf you can read this, your printer is working correctly!`;
      
      fs.writeFileSync(testFilePath, testContent);
      
      // Print the test file
      const printCommand = process.platform === 'darwin'
        ? `lp -d "${printerName}" -o media=${paperSize} "${testFilePath}"`
        : `lp -d "${printerName}" -o media=${paperSize} "${testFilePath}"`;
      
      console.log('🧪 Executing test print command:', printCommand);
      await execPromise(printCommand);
      
      // Clean up test file
      try {
        fs.unlinkSync(testFilePath);
      } catch (cleanupError) {
        console.log('⚠️ Could not clean up test file:', cleanupError.message);
      }
      
      return { 
        success: true, 
        message: `Test print sent to ${printerName} with ${paperSize} paper size`,
        command: process.platform === 'darwin' ? 'macOS lp' : 'Linux lp'
      };
    }
  } catch (error) {
    console.error('❌ Test print failed:', error);
    return { 
      success: false, 
      error: error.message,
      paperSize,
      printerName
    };
  }
});

// Open file in default application (for manual printing)
ipcMain.handle('open-file-for-printing', async (event, fileUrl, filename) => {
  try {
    console.log('📂 Opening file for manual printing:', filename);

    // Download file first - using improved download function
    const filePath = await downloadFile(fileUrl, filename);

    // Open file with default application
    await shell.openPath(filePath);

    console.log('✅ File opened successfully');
    return { 
      success: true, 
      message: `Opened ${filename} for manual printing`,
      filePath
    };
  } catch (error) {
    console.error('❌ Failed to open file:', error);
    return { success: false, error: error.message };
  }
});

// Clean up old print files
ipcMain.handle('cleanup-print-files', async () => {
  try {
    const tempDir = path.join(os.tmpdir(), 'xerox-print-jobs');
    
    if (fs.existsSync(tempDir)) {
      const files = fs.readdirSync(tempDir);
      const now = Date.now();
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours
      
      let cleanedCount = 0;
      
      for (const file of files) {
        const filePath = path.join(tempDir, file);
        const stats = fs.statSync(filePath);
        
        if (now - stats.mtime.getTime() > maxAge) {
          fs.unlinkSync(filePath);
          cleanedCount++;
        }
      }
      
      console.log(`🧹 Cleaned up ${cleanedCount} old print files`);
      return { success: true, cleanedCount };
    }
    
    return { success: true, cleanedCount: 0 };
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    return { success: false, error: error.message };
  }
});

// ============================================================================
// JOB MANAGEMENT FUNCTIONS
// ============================================================================

ipcMain.handle('mark-job-printed', async (event, jobId) => {
  try {
    console.log('✅ Job marked as printed:', jobId);
    return { success: true, jobId };
  } catch (error) {
    console.error('Error marking job as printed:', error);
    return { success: false, error: error.message };
  }
});

// ============================================================================
// PAPER SIZE FUNCTIONS
// ============================================================================

// Get available paper sizes
ipcMain.handle('get-available-paper-sizes', async () => {
  try {
    const paperSizes = getAvailablePaperSizes();
    return { 
      success: true, 
      paperSizes
    };
  } catch (error) {
    console.error('Error getting paper sizes:', error);
    return { success: false, error: error.message };
  }
});

// ============================================================================
// DIRECT PRINTING FUNCTION FOR WINDOWS
// ============================================================================

// Direct printing for Windows using batch file
ipcMain.handle('direct-print-windows', async (event, filePath, printerName, paperSize = 'A4', copies = 1, colorMode = 'BW', printType = 'Single', nupPages = 1, nupOrientation = 'portrait') => {
  try {
    console.log('🖨️ Direct Windows printing:', { filePath, printerName, paperSize, copies, colorMode, printType, nupPages, nupOrientation });
    
    if (process.platform !== 'win32') {
      throw new Error('Direct Windows printing is only available on Windows');
    }
    
    // Check if it's a PDF file
    const isPdf = path.extname(filePath).toLowerCase() === '.pdf';
    
    if (isPdf) {
      // Check if cpdf is installed (best option)
      const isCpdftAvailable = await cpdftPrinting.isCpdftInstalled();
      
      if (isCpdftAvailable) {
        // Use cpdf for PDF processing (best quality)
        const cpdftResult = await cpdftPrinting.processPdfWithCpdf(filePath, printerName, paperSize, copies, colorMode, printType, nupPages || 1, nupOrientation);
        
        if (cpdftResult.success) {
          // Now print the processed file with SumatraPDF
          return await silentPdfPrinting.printPdfSilently(cpdftResult.processedFilePath, printerName, paperSize, copies, colorMode, printType, 1, nupOrientation);
        } else {
          console.log('⚠️ cpdf processing failed, falling back to other methods');
        }
      }
      
      // Check if Ghostscript is installed (fallback)
      const isGsAvailable = await ghostscriptPrinting.isGhostscriptInstalled();
      
      if (isGsAvailable) {
        // Use Ghostscript for PDF printing
        return await ghostscriptPrinting.printPdfSilently(filePath, printerName, paperSize, copies, colorMode, printType, nupPages, nupOrientation);
      } else {
        // Check if MuPDF is installed as fallback
        const isMuPDFAvailable = await mupdfPrinting.isMuPDFInstalled();
        
        if (isMuPDFAvailable) {
          // Use MuPDF for PDF printing
          return await mupdfPrinting.printPdfSilently(filePath, printerName, paperSize, copies, colorMode, printType, nupPages, nupOrientation);
        } else {
          // Fallback to SumatraPDF or other methods
          return await silentPdfPrinting.printPdfSilently(filePath, printerName, paperSize, copies, colorMode, printType, nupPages, nupOrientation);
        }
      }
    }
    
    // First, force the paper size setting
    await advancedPaperSizeControl.forcePaperSize(printerName, paperSize);
    
    // Then print the file
    const result = await directPrint.printFileDirectly(filePath, printerName, paperSize, copies, colorMode, printType);
    return result;
  } catch (error) {
    console.error('❌ Direct Windows printing failed:', error);
    return { 
      success: false, 
      error: error.message,
      filePath,
      printerName
    };
  }
});

// ============================================================================
// ADVANCED PAPER SIZE CONTROL FUNCTIONS
// ============================================================================

// Force paper size for a printer
ipcMain.handle('force-paper-size', async (event, printerName, paperSize) => {
  try {
    console.log('🔧 Forcing paper size:', { printerName, paperSize });
    
    if (process.platform !== 'win32') {
      throw new Error('Advanced paper size control is only available on Windows');
    }
    
    const result = await advancedPaperSizeControl.forcePaperSize(printerName, paperSize);
    return result;
  } catch (error) {
    console.error('❌ Force paper size failed:', error);
    return { 
      success: false, 
      error: error.message,
      printerName,
      paperSize
    };
  }
});

// Create test print with specific paper size
ipcMain.handle('create-test-print-with-paper-size', async (event, printerName, paperSize) => {
  try {
    console.log('🧪 Creating test print with paper size:', { printerName, paperSize });
    
    if (process.platform !== 'win32') {
      throw new Error('Advanced paper size control is only available on Windows');
    }
    
    const result = await advancedPaperSizeControl.createTestPrintWithPaperSize(printerName, paperSize);
    return result;
  } catch (error) {
    console.error('❌ Test print creation failed:', error);
    return { 
      success: false, 
      error: error.message,
      printerName,
      paperSize
    };
  }
});

// ============================================================================
// TEST PRINT FUNCTIONS FOR DIFFERENT PAPER SIZES
// ============================================================================

// Create and print test image for specific paper size
ipcMain.handle('create-test-image', async (event, paperSize) => {
  try {
    console.log('🧪 Creating test image for paper size:', paperSize);
    
    if (!isSupportedPaperSize(paperSize)) {
      console.warn(`Unsupported paper size: ${paperSize}, defaulting to A4`);
      paperSize = 'A4';
    }
    
    const result = await directPrint.createTestImageFile(paperSize);
    return result;
  } catch (error) {
    console.error('❌ Test image creation failed:', error);
    return { 
      success: false, 
      error: error.message,
      paperSize
    };
  }
});

// Create and print test PDF for specific paper size
ipcMain.handle('create-test-pdf', async (event, paperSize) => {
  try {
    console.log('🧪 Creating test PDF for paper size:', paperSize);
    
    if (!isSupportedPaperSize(paperSize)) {
      console.warn(`Unsupported paper size: ${paperSize}, defaulting to A4`);
      paperSize = 'A4';
    }
    
    const result = await directPrint.createTestPdfFile(paperSize);
    return result;
  } catch (error) {
    console.error('❌ Test PDF creation failed:', error);
    return { 
      success: false, 
      error: error.message,
      paperSize
    };
  }
});

// ============================================================================
// PDF FUNCTIONS
// ============================================================================

// Get PDF information
ipcMain.handle('get-pdf-info', async (event, filePath) => {
  try {
    console.log('📄 Getting PDF info for:', filePath);
    
    // This would use PDF.js in a real implementation
    // For now, we'll return mock data
    return { 
      success: true, 
      info: {
        numPages: 5,
        pageSize: {
          width: 595,
          height: 842,
          unit: 'pt'
        },
        isPortrait: true,
        suggestedPaperSize: 'A4'
      }
    };
  } catch (error) {
    console.error('❌ Failed to get PDF info:', error);
    return { 
      success: false, 
      error: error.message
    };
  }
});

// Print PDF with specific paper size
ipcMain.handle('print-pdf', async (event, filePath, printerName, paperSize, copies = 1, colorMode = 'BW', printType = 'Single', nupPages = 1, nupOrientation = 'portrait') => {
  try {
    console.log('🖨️ Printing PDF with paper size:', {
      filePath,
      printerName,
      paperSize,
      copies,
      colorMode,
      printType,
      nupPages,
      nupOrientation
    });
    
    // Check if cpdf is installed (best option)
    const isCpdftAvailable = await cpdftPrinting.isCpdftInstalled();
    
    if (isCpdftAvailable) {
      // Use cpdf for PDF processing (best quality)
      const cpdftResult = await cpdftPrinting.processPdfWithCpdf(filePath, printerName, paperSize, copies, colorMode, printType, nupPages, nupOrientation);
      
      if (cpdftResult.success) {
        // Now print the processed file with SumatraPDF
        return await silentPdfPrinting.printPdfSilently(cpdftResult.processedFilePath, printerName, paperSize, copies, colorMode, printType, 1, nupOrientation);
      } else {
        console.log('⚠️ cpdf processing failed, falling back to other methods');
      }
    }
    
    // Check if Ghostscript is installed (fallback)
    const isGsAvailable = await ghostscriptPrinting.isGhostscriptInstalled();
    
    if (isGsAvailable) {
      // Use Ghostscript for PDF printing
      return await ghostscriptPrinting.printPdfSilently(filePath, printerName, paperSize, copies, colorMode, printType, nupPages);
    } else {
      // Check if MuPDF is installed as fallback
      const isMuPDFAvailable = await mupdfPrinting.isMuPDFInstalled();
      
      if (isMuPDFAvailable) {
        // Use MuPDF for PDF printing
        return await mupdfPrinting.printPdfSilently(filePath, printerName, paperSize, copies, colorMode, printType, nupPages);
      } else {
        // Fallback to SumatraPDF or other methods
        return await silentPdfPrinting.printPdfSilently(filePath, printerName, paperSize, copies, colorMode, printType, nupPages);
      }
    }
  } catch (error) {
    console.error('❌ PDF printing failed:', error);
    return { 
      success: false, 
      error: error.message
    };
  }
});

// Find installed PDF readers
ipcMain.handle('find-pdf-readers', async () => {
  try {
    console.log('🔍 Finding installed PDF readers');
    
    const readers = [];
    
    // Check for Ghostscript
    const gsPath = await ghostscriptPrinting.findGhostscript();
    if (gsPath) {
      readers.push({
        name: 'Ghostscript',
        path: gsPath,
        supportsCustomPaperSize: true,
        supportsSilentPrinting: true
      });
    }
    
    // Check for MuPDF
    const muPdfPath = await mupdfPrinting.findMuPDF();
    if (muPdfPath) {
      readers.push({
        name: 'MuPDF',
        path: muPdfPath,
        supportsCustomPaperSize: true,
        supportsSilentPrinting: true
      });
    }
    
    // Check for SumatraPDF
    const sumatraPath = await silentPdfPrinting.findSumatraPDF();
    if (sumatraPath) {
      readers.push({
        name: 'SumatraPDF',
        path: sumatraPath,
        supportsCustomPaperSize: true,
        supportsSilentPrinting: true
      });
    }
    
    // Add other readers from pdfPrintManager
    const otherReaders = await pdfPrintManager.findPdfReaders();
    if (otherReaders && otherReaders.length > 0) {
      readers.push(...otherReaders);
    }
    
    return { 
      success: true, 
      readers
    };
  } catch (error) {
    console.error('❌ Failed to find PDF readers:', error);
    return { 
      success: false, 
      error: error.message
    };
  }
});

// Check if MuPDF is installed
ipcMain.handle('check-mupdf-installed', async () => {
  try {
    const isInstalled = await mupdfPrinting.isMuPDFInstalled();
    const version = isInstalled ? await mupdfPrinting.getMuPDFVersion() : null;
    
    return {
      success: true,
      installed: isInstalled,
      version
    };
  } catch (error) {
    console.error('Error checking MuPDF installation:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

// Check if cpdf is installed
ipcMain.handle('check-cpdf-installed', async () => {
  try {
    const isInstalled = await cpdftPrinting.isCpdftInstalled();
    const version = isInstalled ? await cpdftPrinting.getCpdftVersion() : null;
    
    return {
      success: true,
      installed: isInstalled,
      version
    };
  } catch (error) {
    console.error('Error checking cpdf installation:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

// Check if Ghostscript is installed
ipcMain.handle('check-ghostscript-installed', async () => {
  try {
    const isInstalled = await ghostscriptPrinting.isGhostscriptInstalled();
    const version = isInstalled ? await ghostscriptPrinting.getGhostscriptVersion() : null;
    
    return {
      success: true,
      installed: isInstalled,
      version
    };
  } catch (error) {
    console.error('Error checking Ghostscript installation:', error);
    return {
      success: false,
      error: error.message
    };
  }
});
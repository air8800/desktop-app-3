// Silent PDF Printing Module - COMPLETELY REWRITTEN
// Handles direct PDF printing with enforced paper size

const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// Temporary directory for print jobs
const TEMP_DIR = path.join(os.tmpdir(), 'xerox-print-jobs');

// Ensure temp directory exists
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// Paths to check for SumatraPDF installation
const SUMATRA_PATHS = [
  'C:\\Program Files\\SumatraPDF\\SumatraPDF.exe',
  'C:\\Program Files (x86)\\SumatraPDF\\SumatraPDF.exe',
  path.join(os.homedir(), 'AppData\\Local\\SumatraPDF\\SumatraPDF.exe')
];

// Find SumatraPDF installation
const findSumatraPDF = async () => {
  console.log('🔍 Searching for SumatraPDF installation...');
  
  // Only available on Windows
  if (process.platform !== 'win32') {
    console.log('❌ SumatraPDF is only available on Windows');
    return null;
  }

  // Check common installation paths
  for (const sumatraPath of SUMATRA_PATHS) {
    if (fs.existsSync(sumatraPath)) {
      console.log('✅ Found SumatraPDF at:', sumatraPath);
      return sumatraPath;
    }
  }

  // Try to find in PATH
  try {
    const { stdout } = await execPromise('where SumatraPDF.exe');
    if (stdout && stdout.trim()) {
      const sumatraPath = stdout.trim().split('\r\n')[0];
      console.log('✅ Found SumatraPDF in PATH:', sumatraPath);
      return sumatraPath;
    }
  } catch (error) {
    console.log('SumatraPDF not found in PATH');
  }

  console.log('❌ SumatraPDF not found');
  return null;
};

// Convert PDF to N-up layout using Ghostscript
const convertPdfToNup = async (inputPath, outputPath, nupPages) => {
  try {
    console.log('📊 Converting PDF to N-up layout using Ghostscript:', nupPages, 'pages per sheet');
    
    // Find Ghostscript for N-up conversion
    const { findGhostscript } = require('./ghostscriptPrinting');
    const gsPath = await findGhostscript();
    if (!gsPath) {
      console.log('⚠️ Ghostscript not found, skipping N-up conversion');
      return inputPath;
    }
    
    // Map N-up pages to Ghostscript layout
    const nupLayouts = {
      2: '1x2',   // 1 column, 2 rows (portrait)
      4: '2x2',   // 2 columns, 2 rows
      6: '2x3',   // 2 columns, 3 rows
      8: '2x4',   // 2 columns, 4 rows
      9: '3x3',   // 3 columns, 3 rows
      16: '4x4'   // 4 columns, 4 rows
    };
    
    const layout = nupLayouts[nupPages] || '2x2';
    
    console.log('📊 Ghostscript N-up layout mapping:', {
      nupPages,
      layout,
      inputPath
    });
    
    // Use Ghostscript's built-in N-up capability
    const command = `"${gsPath}" -sDEVICE=pdfwrite -dNOPAUSE -dQUIET -dBATCH -dSAFER ` +
      `-dNup=${nupPages} -dNupPageOrder=0 -dNupAutoRotate=false ` +
      `-sPAPERSIZE=a4 -dFIXEDMEDIA -dPDFFitPage ` +
      `-sOutputFile="${outputPath}" "${inputPath}"`;
    
    console.log('🔄 Executing Ghostscript N-up command:', command);
    await execPromise(command);
    
    // Check if output file exists and has content
    if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
      console.log('✅ Ghostscript N-up conversion successful:', outputPath);
      console.log('📊 N-up file size:', fs.statSync(outputPath).size, 'bytes');
      return outputPath;
    } else {
      console.log('⚠️ Ghostscript N-up conversion failed, using original file');
      return inputPath;
    }
  } catch (error) {
    console.error('❌ Ghostscript N-up conversion error:', error);
    console.log('📊 Failed N-up conversion details:', {
      inputPath,
      outputPath,
      nupPages
    });
    return inputPath; // Return original file on error
  }
};

// Convert PDF to specific paper size using Ghostscript
const convertPdfToPaperSize = async (inputPath, outputPath, paperSize, colorMode = 'BW') => {
  try {
    console.log('📄 Converting PDF to paper size:', paperSize, 'with color mode:', colorMode);
    
    const { findGhostscript } = require('./ghostscriptPrinting');
    const gsPath = await findGhostscript();
    if (!gsPath) {
      console.log('⚠️ Ghostscript not found, skipping conversion');
      return inputPath;
    }
    
    const gsPaperSizes = {
      'A3': 'a3',
      'A4': 'a4',
      'A5': 'a5',
      'Letter': 'letter',
      'Legal': 'legal',
      'Executive': 'executive'
    };
    
    const gsPaperSize = gsPaperSizes[paperSize] || 'a4';
    
    const colorParams = colorMode === 'Color' 
      ? '-sColorConversionStrategy=LeaveColorUnchanged -dProcessColorModel=/DeviceRGB' 
      : '-sColorConversionStrategy=Gray -dProcessColorModel=/DeviceGray';
    
    const command = `"${gsPath}" -sDEVICE=pdfwrite -sPAPERSIZE=${gsPaperSize} -dFIXEDMEDIA -dPDFFitPage ${colorParams} -dCompatibilityLevel=1.4 -dNOPAUSE -dQUIET -dBATCH -sOutputFile="${outputPath}" "${inputPath}"`;
    
    console.log('🔄 Executing Ghostscript command:', command);
    await execPromise(command);
    
    if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
      console.log('✅ PDF converted successfully:', outputPath);
      return outputPath;
    } else {
      console.log('⚠️ Ghostscript conversion failed, using original file');
      return inputPath;
    }
  } catch (error) {
    console.error('❌ PDF conversion error:', error);
    return inputPath;
  }
};

// Print PDF with SumatraPDF - CLEAN IMPLEMENTATION
const printPdfWithSumatra = async (filePath, printerName, paperSize, copies = 1, colorMode = 'BW', printType = 'Single', nupPages = 1) => {
  try {
    console.log('🖨️ Starting SumatraPDF printing with settings:', {
      filePath,
      printerName,
      paperSize,
      copies,
      colorMode,
      printType,
      nupPages
    });

    const sumatraPath = await findSumatraPDF();
    if (!sumatraPath) {
      throw new Error('SumatraPDF not found. Please install SumatraPDF for better PDF printing.');
    }
    
    // Build print settings string correctly
    const printSettings = `${copies}x,${paperSize},${colorMode === 'Color' ? 'color' : 'monochrome'},${printType === 'Double' ? 'duplex' : 'simplex'}`;
    
    console.log('📊 SumatraPDF print settings:', printSettings);
    
    // Execute SumatraPDF command
    const command = `"${sumatraPath}" -print-to "${printerName}" -print-settings "${printSettings}" -silent "${filePath}"`;
    
    console.log('🖨️ Executing SumatraPDF command:', command);
    
    await execPromise(command);
    
    console.log('✅ SumatraPDF printing completed successfully');
    
    return {
      success: true,
      method: 'SumatraPDF Silent Print',
      command,
      message: `Print job sent to ${printerName} with ${paperSize} paper size, ${copies} copies, ${colorMode} mode, ${printType} printing${nupPages > 1 ? `, ${nupPages} pages per sheet` : ''}`
    };
  } catch (error) {
    console.error('❌ SumatraPDF printing failed:', error);
    throw error;
  }
};

// Print PDF silently using batch file (fallback method)
const printPdfSilentlyWithBatch = async (filePath, printerName, paperSize, copies = 1, colorMode = 'BW', printType = 'Single', nupPages = 1) => {
  try {
    console.log('🖨️ Printing PDF silently with batch file:', {
      filePath,
      printerName,
      paperSize,
      copies,
      colorMode,
      printType,
      nupPages
    });
    
    // Create batch file
    const batchFilePath = path.join(TEMP_DIR, `silent_print_${Date.now()}.bat`);
    
    const batchContent = `@echo off
echo ===============================================================
echo SILENT PDF PRINTING WITH PAPER SIZE ENFORCEMENT
echo ===============================================================
echo File: ${filePath}
echo Printer: ${printerName}
echo Paper Size: ${paperSize}
echo Copies: ${copies}
echo Color Mode: ${colorMode}
echo Print Type: ${printType}
echo Pages per Sheet: ${nupPages}
echo ===============================================================

echo.
echo STEP 1: Setting printer paper size using PowerShell...
powershell.exe -Command "$ErrorActionPreference = 'Stop'; try { Set-PrintConfiguration -PrinterName '${printerName}' -PaperSize ${paperSize} -ErrorAction SilentlyContinue; Write-Host 'Paper size set to ${paperSize} successfully' } catch { Write-Host 'Error setting paper size: ' $_.Exception.Message }"

echo.
echo STEP 1.1: Setting color mode using PowerShell...
powershell.exe -Command "$ErrorActionPreference = 'Stop'; try { Set-PrintConfiguration -PrinterName '${printerName}' -Color ${colorMode === 'Color'} -ErrorAction SilentlyContinue; Write-Host 'Color mode set to ${colorMode} successfully' } catch { Write-Host 'Error setting color mode: ' $_.Exception.Message }"

echo.
echo STEP 1.2: Setting print type using PowerShell...
powershell.exe -Command "$ErrorActionPreference = 'Stop'; try { Set-PrintConfiguration -PrinterName '${printerName}' -DuplexingMode ${printType === 'Double' ? 'TwoSidedLongEdge' : 'OneSided'} -ErrorAction SilentlyContinue; Write-Host 'Print type set to ${printType} successfully' } catch { Write-Host 'Error setting print type: ' $_.Exception.Message }"

echo.
echo STEP 2: Checking for SumatraPDF...
where SumatraPDF.exe >nul 2>&1
if %ERRORLEVEL% EQU 0 (
  echo SumatraPDF found, using it for printing...
  SumatraPDF.exe -print-to "${printerName}" -print-settings "${copies}x,${paperSize},${colorMode === 'Color' ? 'color' : 'monochrome'},${printType === 'Double' ? 'duplex' : 'simplex'}" -silent "${filePath}"
  if %ERRORLEVEL% EQU 0 (
    echo SumatraPDF printing successful!
    exit /b 0
  ) else (
    echo SumatraPDF printing failed with error code %ERRORLEVEL%
    echo Trying alternative methods...
  )
) else (
  echo SumatraPDF not found, checking common installation paths...
  
  if exist "C:\\Program Files\\SumatraPDF\\SumatraPDF.exe" (
    echo Found SumatraPDF in Program Files
    "C:\\Program Files\\SumatraPDF\\SumatraPDF.exe" -print-to "${printerName}" -print-settings "${copies}x,${paperSize},${colorMode === 'Color' ? 'color' : 'monochrome'},${printType === 'Double' ? 'duplex' : 'simplex'}" -silent "${filePath}"
    if %ERRORLEVEL% EQU 0 (
      echo SumatraPDF printing successful!
      exit /b 0
    )
  )
  
  if exist "C:\\Program Files (x86)\\SumatraPDF\\SumatraPDF.exe" (
    echo Found SumatraPDF in Program Files (x86)
    "C:\\Program Files (x86)\\SumatraPDF\\SumatraPDF.exe" -print-to "${printerName}" -print-settings "${copies}x,${paperSize},${colorMode === 'Color' ? 'color' : 'monochrome'},${printType === 'Double' ? 'duplex' : 'simplex'}" -silent "${filePath}"
    if %ERRORLEVEL% EQU 0 (
      echo SumatraPDF printing successful!
      exit /b 0
    )
  )
  
  echo SumatraPDF not found or failed, trying system print command...
)

echo.
echo STEP 3: Using Windows print command as last resort...
print /d:"${printerName}" "${filePath}"
if %ERRORLEVEL% EQU 0 (
  echo Windows print command successful!
  exit /b 0
)

echo All printing methods failed!
echo Please try printing manually by opening the file.
echo File location: ${filePath}
echo.
echo Press any key to close this window...
pause > nul
exit /b 1`;

    fs.writeFileSync(batchFilePath, batchContent);
    
    // Execute batch file with visible console to see output
    const batchCommand = `start cmd.exe /k "${batchFilePath}"`;
    console.log('🚀 Executing batch command:', batchCommand);
    
    await execPromise(batchCommand);
    
    return {
      success: true,
      method: 'Batch File Print',
      command: batchCommand,
      message: `Print job sent to ${printerName} with ${paperSize} paper size, ${copies} copies, ${colorMode} mode, ${printType} printing${nupPages > 1 ? `, ${nupPages} pages per sheet` : ''}`
    };
  } catch (error) {
    console.error('❌ Batch file printing failed:', error);
    throw error;
  }
};

// Main print function - CLEAN AND SIMPLE
const printPdfSilently = async (filePath, printerName, paperSize, copies = 1, colorMode = 'BW', printType = 'Single', nupPages = 1) => {
  try {
    console.log('🖨️ Printing PDF silently with options:', {
      filePath,
      printerName,
      paperSize,
      copies,
      colorMode,
      printType,
      nupPages
    });

    let processedFilePath = filePath;
    
    // Step 1: Handle N-up conversion using Ghostscript (if needed)
    if (nupPages > 1) {
      console.log('📊 N-up printing requested - using Ghostscript for layout conversion');
      
      const fileExt = path.extname(filePath);
      const baseName = path.basename(filePath, fileExt);
      const nupOutputPath = path.join(TEMP_DIR, `${baseName}_${nupPages}up${fileExt}`);
      
      processedFilePath = await convertPdfToNup(filePath, nupOutputPath, nupPages);
      
      if (processedFilePath !== filePath) {
        console.log('✅ N-up conversion successful, using converted file');
      } else {
        console.log('📊 Using original file - printer will handle layout');
      }
    }
    
    // Step 2: Convert PDF to target paper size using Ghostscript (if needed)
    const fileExt = path.extname(processedFilePath);
    const baseName = path.basename(processedFilePath, fileExt);
    const outputPath = path.join(TEMP_DIR, `${baseName}_${paperSize}${fileExt}`);
    
    const convertedFilePath = await convertPdfToPaperSize(processedFilePath, outputPath, paperSize, colorMode);
    
    // Step 3: Try SumatraPDF first
    try {
      console.log('🖨️ Attempting to print with SumatraPDF...');
      const result = await printPdfWithSumatra(convertedFilePath, printerName, paperSize, copies, colorMode, printType, nupPages);
      
      // Clean up temporary files
      cleanupTempFiles(convertedFilePath, processedFilePath, filePath);
      
      return result;
    } catch (sumatraError) {
      console.error('❌ SumatraPDF printing failed:', sumatraError);
      console.log('🔄 Trying fallback batch method...');
      
      // Step 4: Fallback to batch file method
      const result = await printPdfSilentlyWithBatch(convertedFilePath, printerName, paperSize, copies, colorMode, printType, nupPages);
      
      // Clean up temporary files
      cleanupTempFiles(convertedFilePath, processedFilePath, filePath);
      
      return result;
    }
  } catch (error) {
    console.error('❌ Silent PDF printing failed:', error);
    return {
      success: false,
      error: error.message,
      message: `Print job failed for ${printerName} with ${paperSize} paper size`
    };
  }
};

// Clean up temporary files
const cleanupTempFiles = (convertedFilePath, processedFilePath, originalFilePath) => {
  try {
    if (convertedFilePath !== processedFilePath && fs.existsSync(convertedFilePath)) {
      fs.unlinkSync(convertedFilePath);
      console.log('🧹 Cleaned up temporary Ghostscript PDF');
    }
    
    if (processedFilePath !== originalFilePath && fs.existsSync(processedFilePath)) {
      fs.unlinkSync(processedFilePath);
      console.log('🧹 Cleaned up temporary N-up PDF');
    }
  } catch (cleanupError) {
    console.log('⚠️ Could not clean up temporary files:', cleanupError.message);
  }
};

module.exports = {
  printPdfSilently,
  findSumatraPDF
};
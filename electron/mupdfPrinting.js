// Silent PDF Printing Module with MuPDF
// Handles PDF printing with enforced paper size

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

// Paths to check for MuPDF installation
const MUPDF_PATHS = {
  win32: [
    'C:\\Program Files\\MuPDF\\mutool.exe', // Add your specific path first
    'C:\\Program Files (x86)\\MuPDF\\mutool.exe',
    'C:\\Program Files\\mupdf\\mutool.exe',
    'C:\\Program Files (x86)\\mupdf\\mutool.exe',
    path.join(os.homedir(), 'AppData\\Local\\Programs\\MuPDF\\mutool.exe'),
    path.join(os.homedir(), 'AppData\\Local\\MuPDF\\mutool.exe'),
    // Add more common installation paths
    'C:\\mupdf\\mutool.exe',
    'D:\\mupdf\\mutool.exe',
    'C:\\tools\\mupdf\\mutool.exe',
    'D:\\tools\\mupdf\\mutool.exe'
  ],
  darwin: [
    '/usr/local/bin/mutool',
    '/opt/homebrew/bin/mutool',
    '/Applications/MuPDF.app/Contents/MacOS/mutool'
  ],
  linux: [
    '/usr/bin/mutool',
    '/usr/local/bin/mutool'
  ]
};

// Paths to check for SumatraPDF installation
const SUMATRA_PATHS = [
  'C:\\Program Files\\SumatraPDF\\SumatraPDF.exe',
  'C:\\Program Files (x86)\\SumatraPDF\\SumatraPDF.exe',
  path.join(os.homedir(), 'AppData\\Local\\SumatraPDF\\SumatraPDF.exe')
];

// Find MuPDF installation with enhanced detection
const findMuPDF = async () => {
  console.log('🔍 Searching for MuPDF installation...');
  
  const platformPaths = MUPDF_PATHS[process.platform] || [];
  
  // Check common installation paths
  for (const muPdfPath of platformPaths) {
    if (fs.existsSync(muPdfPath)) {
      console.log('✅ Found MuPDF at:', muPdfPath);
      return muPdfPath;
    }
  }
  
  // Try to find in PATH
  try {
    const command = process.platform === 'win32' ? 'where mutool' : 'which mutool';
    console.log('🔍 Checking PATH with command:', command);
    
    const { stdout } = await execPromise(command);
    if (stdout && stdout.trim()) {
      const muPdfPath = stdout.trim().split('\n')[0];
      console.log('✅ Found MuPDF in PATH:', muPdfPath);
      return muPdfPath;
    }
  } catch (error) {
    console.log('MuPDF not found in PATH');
  }
  
  // Try to find by searching common directories
  if (process.platform === 'win32') {
    try {
      console.log('🔍 Searching for MuPDF in Program Files directories...');
      
      // Search in Program Files
      const { stdout: pfStdout } = await execPromise('dir /s /b "C:\\Program Files\\*mutool.exe" 2>nul');
      if (pfStdout && pfStdout.trim()) {
        const muPdfPath = pfStdout.trim().split('\r\n')[0];
        console.log('✅ Found MuPDF in Program Files:', muPdfPath);
        return muPdfPath;
      }
      
      // Search in Program Files (x86)
      const { stdout: pf86Stdout } = await execPromise('dir /s /b "C:\\Program Files (x86)\\*mutool.exe" 2>nul');
      if (pf86Stdout && pf86Stdout.trim()) {
        const muPdfPath = pf86Stdout.trim().split('\r\n')[0];
        console.log('✅ Found MuPDF in Program Files (x86):', muPdfPath);
        return muPdfPath;
      }
      
      // Search in user's AppData
      const appDataPath = path.join(os.homedir(), 'AppData');
      const { stdout: appDataStdout } = await execPromise(`dir /s /b "${appDataPath}\\*mutool.exe" 2>nul`);
      if (appDataStdout && appDataStdout.trim()) {
        const muPdfPath = appDataStdout.trim().split('\r\n')[0];
        console.log('✅ Found MuPDF in AppData:', muPdfPath);
        return muPdfPath;
      }
    } catch (error) {
      console.log('Error searching for MuPDF in directories:', error.message);
    }
  }
  
  console.log('❌ MuPDF not found after extensive search');
  return null;
};

// Find SumatraPDF installation
const findSumatraPDF = async () => {
  // Only available on Windows
  if (process.platform !== 'win32') {
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

// Convert PDF to specific paper size using MuPDF
const convertPdfToPaperSize = async (inputPath, outputPath, paperSize) => {
  try {
    console.log('📄 Converting PDF to paper size:', paperSize);
    
    // Find MuPDF
    const muPdfPath = await findMuPDF();
    if (!muPdfPath) {
      console.log('⚠️ MuPDF not found, skipping conversion');
      return inputPath;
    }
    
    // Map paper size to dimensions in points (72 points = 1 inch)
    const paperSizes = {
      'A3': [841.89, 1190.55],
      'A4': [595.28, 841.89],
      'A5': [419.53, 595.28],
      'Letter': [612, 792],
      'Legal': [612, 1008],
      'Executive': [522, 756]
    };
    
    const [width, height] = paperSizes[paperSize] || paperSizes['A4'];
    
    // Create a command to convert the PDF using MuPDF's draw command (not print)
    // MuPDF 1.26.2 uses 'draw' command for rendering PDFs
    const command = `"${muPdfPath}" draw -o "${outputPath}" -O "media=${width}x${height}" "${inputPath}"`;
    
    console.log('🔄 Executing MuPDF command:', command);
    await execPromise(command);
    
    // Check if output file exists and has content
    if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
      console.log('✅ PDF converted successfully:', outputPath);
      return outputPath;
    } else {
      console.log('⚠️ PDF conversion failed, using original file');
      return inputPath;
    }
  } catch (error) {
    console.error('❌ PDF conversion error:', error);
    return inputPath; // Return original file on error
  }
};

// Print PDF using SumatraPDF
const printPdfWithSumatra = async (filePath, printerName, paperSize, copies = 1, colorMode = 'BW', printType = 'Single') => {
  try {
    // Find SumatraPDF first
    const sumatraPath = await findSumatraPDF();
    if (!sumatraPath) {
      throw new Error('SumatraPDF not found. Please install SumatraPDF for better PDF printing.');
    }

    // Build print settings string
    const printSettings = `${copies}x,${paperSize},${colorMode === 'Color' ? 'color' : 'monochrome'},${printType === 'Double' ? 'duplex' : 'simplex'}`;

    // Use SumatraPDF's command-line options for printing
    const command = `"${sumatraPath}" -print-to "${printerName}" -print-settings "${printSettings}" -silent "${filePath}"`;

    console.log('🖨️ Executing SumatraPDF command:', command);
    await execPromise(command);

    return {
      success: true,
      method: 'SumatraPDF Silent Print',
      command,
      message: `Print job sent to ${printerName} with ${paperSize} paper size, ${copies} copies, ${colorMode} mode, ${printType} printing`
    };
  } catch (error) {
    console.error('❌ SumatraPDF printing failed:', error);
    throw error;
  }
};

// Create a batch file for printing with MuPDF and SumatraPDF
const createPrintBatchFile = (filePath, printerName, paperSize, copies = 1, colorMode = 'BW', printType = 'Single', nupPages = 1) => {
  const batchFilePath = path.join(TEMP_DIR, `mupdf_print_${Date.now()}.bat`);
  
  const batchContent = `@echo off
echo ===============================================================
echo PRINTING PDF WITH MUPDF CONVERSION AND SUMATRAPDF PRINTING
echo ===============================================================
echo File: ${filePath}
echo Printer: ${printerName}
echo Paper Size: ${paperSize}
echo Copies: ${copies}
echo Color Mode: ${colorMode}
echo Print Type: ${printType}
echo ===============================================================

echo.
echo STEP 1: Checking for MuPDF...
set FOUND_MUPDF=0
set MUPDF_PATH=

REM Check specific path first
if exist "C:\\Program Files\\MuPDF\\mutool.exe" (
  set MUPDF_PATH="C:\\Program Files\\MuPDF\\mutool.exe"
  set FOUND_MUPDF=1
  echo Found MuPDF at specific path
  goto MUPDF_FOUND
)

REM Check in PATH
where mutool.exe >nul 2>&1
if %ERRORLEVEL% EQU 0 (
  for /f "tokens=*" %%i in ('where mutool.exe') do set MUPDF_PATH=%%i
  set FOUND_MUPDF=1
  echo Found MuPDF in PATH: %MUPDF_PATH%
  goto MUPDF_FOUND
)

REM Check common installation paths
if exist "C:\\Program Files\\mupdf\\mutool.exe" (
  set MUPDF_PATH="C:\\Program Files\\mupdf\\mutool.exe"
  set FOUND_MUPDF=1
  echo Found MuPDF in Program Files
  goto MUPDF_FOUND
)

if exist "C:\\Program Files\\MuPDF\\mutool.exe" (
  set MUPDF_PATH="C:\\Program Files\\MuPDF\\mutool.exe"
  set FOUND_MUPDF=1
  echo Found MuPDF in Program Files
  goto MUPDF_FOUND
)

if exist "C:\\Program Files (x86)\\mupdf\\mutool.exe" (
  set MUPDF_PATH="C:\\Program Files (x86)\\mupdf\\mutool.exe"
  set FOUND_MUPDF=1
  echo Found MuPDF in Program Files (x86)
  goto MUPDF_FOUND
)

if exist "C:\\Program Files (x86)\\MuPDF\\mutool.exe" (
  set MUPDF_PATH="C:\\Program Files (x86)\\MuPDF\\mutool.exe"
  set FOUND_MUPDF=1
  echo Found MuPDF in Program Files (x86)
  goto MUPDF_FOUND
)

REM Check in user's AppData
if exist "%APPDATA%\\..\\Local\\Programs\\MuPDF\\mutool.exe" (
  set MUPDF_PATH="%APPDATA%\\..\\Local\\Programs\\MuPDF\\mutool.exe"
  set FOUND_MUPDF=1
  echo Found MuPDF in AppData
  goto MUPDF_FOUND
)

if exist "%APPDATA%\\..\\Local\\MuPDF\\mutool.exe" (
  set MUPDF_PATH="%APPDATA%\\..\\Local\\MuPDF\\mutool.exe"
  set FOUND_MUPDF=1
  echo Found MuPDF in AppData
  goto MUPDF_FOUND
)

REM Check in C: and D: drives
if exist "C:\\mupdf\\mutool.exe" (
  set MUPDF_PATH="C:\\mupdf\\mutool.exe"
  set FOUND_MUPDF=1
  echo Found MuPDF in C:\\mupdf
  goto MUPDF_FOUND
)

if exist "D:\\mupdf\\mutool.exe" (
  set MUPDF_PATH="D:\\mupdf\\mutool.exe"
  set FOUND_MUPDF=1
  echo Found MuPDF in D:\\mupdf
  goto MUPDF_FOUND
)

echo MuPDF not found, skipping conversion step...
goto SUMATRA_CHECK

:MUPDF_FOUND
if %FOUND_MUPDF% EQU 1 (
  echo Creating temporary print-ready PDF...
  set TEMP_PDF=${TEMP_DIR}\\print_ready_%RANDOM%.pdf
  
  REM Use draw command instead of print (MuPDF 1.26.2 doesn't have print command)
  %MUPDF_PATH% draw -o "%TEMP_PDF%" -O "media=${paperSize}" "${filePath}"
  
  if exist "%TEMP_PDF%" (
    echo Conversion successful, using converted file for printing
    set PRINT_FILE="%TEMP_PDF%"
  ) else (
    echo Conversion failed, using original file
    set PRINT_FILE="${filePath}"
  )
) else (
  echo Using original file without conversion
  set PRINT_FILE="${filePath}"
)

:SUMATRA_CHECK
echo.
echo STEP 2: Checking for SumatraPDF...
set FOUND_SUMATRA=0
set SUMATRA_PATH=

where SumatraPDF.exe >nul 2>&1
if %ERRORLEVEL% EQU 0 (
  for /f "tokens=*" %%i in ('where SumatraPDF.exe') do set SUMATRA_PATH=%%i
  set FOUND_SUMATRA=1
  echo Found SumatraPDF in PATH: %SUMATRA_PATH%
  goto SUMATRA_FOUND
)

if exist "C:\\Program Files\\SumatraPDF\\SumatraPDF.exe" (
  set SUMATRA_PATH="C:\\Program Files\\SumatraPDF\\SumatraPDF.exe"
  set FOUND_SUMATRA=1
  echo Found SumatraPDF in Program Files
  goto SUMATRA_FOUND
)

if exist "C:\\Program Files (x86)\\SumatraPDF\\SumatraPDF.exe" (
  set SUMATRA_PATH="C:\\Program Files (x86)\\SumatraPDF\\SumatraPDF.exe"
  set FOUND_SUMATRA=1
  echo Found SumatraPDF in Program Files (x86)
  goto SUMATRA_FOUND
)

if exist "%APPDATA%\\..\\Local\\SumatraPDF\\SumatraPDF.exe" (
  set SUMATRA_PATH="%APPDATA%\\..\\Local\\SumatraPDF\\SumatraPDF.exe"
  set FOUND_SUMATRA=1
  echo Found SumatraPDF in AppData
  goto SUMATRA_FOUND
)

echo SumatraPDF not found, trying alternative methods...
goto ALTERNATIVE_METHODS

:SUMATRA_FOUND
if %FOUND_SUMATRA% EQU 1 (
  echo.
  echo STEP 3: Printing with SumatraPDF...
  %SUMATRA_PATH% -print-to "${printerName}" -print-settings "${copies}x,${paperSize},${colorMode === 'Color' ? 'color' : 'monochrome'},${printType === 'Double' ? 'duplex' : 'simplex'}" -silent %PRINT_FILE%
  
  if %ERRORLEVEL% EQU 0 (
    echo SumatraPDF printing successful!
    goto CLEANUP
  ) else (
    echo SumatraPDF printing failed with error code %ERRORLEVEL%
    echo Trying alternative methods...
  )
)

:ALTERNATIVE_METHODS
echo.
echo STEP 4: Trying alternative printing methods...

REM Try Adobe Reader if available
where AcroRd32.exe >nul 2>&1
if %ERRORLEVEL% EQU 0 (
  echo Using Adobe Reader for printing...
  for /f "tokens=*" %%i in ('where AcroRd32.exe') do set ADOBE_PATH=%%i
  "%ADOBE_PATH%" /t %PRINT_FILE% "${printerName}" "" "${paperSize}"
  if %ERRORLEVEL% EQU 0 (
    echo Adobe Reader printing successful!
    goto CLEANUP
  )
)

REM Try PowerShell printing
echo Using PowerShell for printing...
powershell.exe -Command "$ErrorActionPreference = 'Stop'; try { Set-PrintConfiguration -PrinterName '${printerName}' -PaperSize ${paperSize} -Color ${colorMode === 'Color'} -DuplexingMode ${printType === 'Double' ? 'TwoSidedLongEdge' : 'OneSided'}; for ($i=1; $i -le ${copies}; $i++) { Start-Process -FilePath %PRINT_FILE% -Verb Print -WindowStyle Hidden; Start-Sleep -Seconds 2 }; exit 0 } catch { Write-Host $_.Exception.Message; exit 1 }"

if %ERRORLEVEL% EQU 0 (
  echo PowerShell printing successful!
  goto CLEANUP
)

REM Last resort - Windows print command
echo Using Windows print command...
print /d:"${printerName}" %PRINT_FILE%

if %ERRORLEVEL% EQU 0 (
  echo Windows print command successful!
  goto CLEANUP
)

echo All printing methods failed!
echo Please try printing manually by opening the file.
echo.

:CLEANUP
echo.
echo Cleaning up temporary files...
if defined TEMP_PDF (
  if exist %TEMP_PDF% (
    del %TEMP_PDF%
    echo Temporary PDF deleted
  )
)

echo.
echo Print job completed!
exit /b 0
`;
  
  fs.writeFileSync(batchFilePath, batchContent);
  return batchFilePath;
};

// Print PDF silently using MuPDF for conversion and SumatraPDF for printing
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

    // Step 1: Convert PDF to target paper size using MuPDF
    const fileExt = path.extname(filePath);
    const baseName = path.basename(filePath, fileExt);
    const outputPath = path.join(TEMP_DIR, `${baseName}_${paperSize}${fileExt}`);
    
    console.log('📄 Converting PDF to correct paper size...');
    const convertedFilePath = await convertPdfToPaperSize(filePath, outputPath, paperSize);
    
    // Step 2: Print using SumatraPDF if available
    try {
      console.log('🖨️ Attempting to print with SumatraPDF...');
      const result = await printPdfWithSumatra(convertedFilePath, printerName, paperSize, copies, colorMode, printType);
      
      // Clean up the converted file if it's different from the original
      if (convertedFilePath !== filePath && fs.existsSync(convertedFilePath)) {
        try {
          fs.unlinkSync(convertedFilePath);
          console.log('🧹 Cleaned up temporary converted PDF');
        } catch (cleanupError) {
          console.log('⚠️ Could not clean up temporary file:', cleanupError.message);
        }
      }
      
      return result;
    } catch (sumatraError) {
      console.error('❌ SumatraPDF printing failed:', sumatraError);
      console.log('🔄 Falling back to batch file method...');
      
      // Step 3: Fallback to batch file method
      const batchFilePath = createPrintBatchFile(convertedFilePath, printerName, paperSize, copies, colorMode, printType, nupPages);
      console.log('📝 Created batch file for printing:', batchFilePath);
      
      // Execute batch file
      const command = `start /min cmd /c "${batchFilePath}"`;
      console.log('🚀 Executing command:', command);
      await execPromise(command);
      
      return {
        success: true,
        method: 'Batch File Print',
        message: `Print job sent to ${printerName} with ${paperSize} paper size, ${copies} copies, ${colorMode} mode, ${printType} printing${nupPages > 1 ? `, ${nupPages}-up layout` : ''}`
      };
    }
  } catch (error) {
    console.error('❌ Silent PDF printing failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Check if MuPDF is installed
const isMuPDFInstalled = async () => {
  try {
    const muPdfPath = await findMuPDF();
    return !!muPdfPath;
  } catch (error) {
    console.error('Error checking MuPDF installation:', error);
    return false;
  }
};

// Get MuPDF version
const getMuPDFVersion = async () => {
  try {
    const muPdfPath = await findMuPDF();
    if (!muPdfPath) {
      return null;
    }
    
    const { stdout } = await execPromise(`"${muPdfPath}" -v`);
    return stdout.trim();
  } catch (error) {
    console.error('Error getting MuPDF version:', error);
    return null;
  }
};

module.exports = {
  findMuPDF,
  printPdfSilently,
  isMuPDFInstalled,
  getMuPDFVersion,
  convertPdfToPaperSize,
  findSumatraPDF
};
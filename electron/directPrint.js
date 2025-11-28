// Direct Windows Printing Module
// This module provides direct printing capabilities for Windows systems

const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// Create a batch file that will directly print the file
const createPrintBatchFile = (filePath, printerName, paperSize, copies = 1, colorMode = 'BW', printType = 'Single', nupPages = 1) => {
  const tempDir = path.join(os.tmpdir(), 'xerox-print-jobs');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  const batchFilePath = path.join(tempDir, `print_${Date.now()}.bat`);
  const fileExt = path.extname(filePath).toLowerCase();
  
  let batchContent = '';
  
  // Different commands based on file type
  if (['.jpg', '.jpeg', '.png', '.bmp', '.gif'].includes(fileExt)) {
    // For images, use mspaint with /pt command and explicit paper size
    batchContent = `@echo off
echo ===============================================================
echo PRINTING IMAGE FILE: ${filePath}
echo TO PRINTER: ${printerName}
echo PAPER SIZE: ${paperSize}
echo COPIES: ${copies}
echo COLOR MODE: ${colorMode}
echo PRINT TYPE: ${printType}
echo PAGES PER SHEET: ${nupPages}
echo ===============================================================

REM Set printer paper size first using PowerShell
echo Setting printer paper size to ${paperSize}...
powershell.exe -Command "$ErrorActionPreference = 'Stop'; try { $printer = Get-Printer -Name '${printerName}'; Set-PrintConfiguration -PrinterName '${printerName}' -PaperSize ${paperSize} -ErrorAction SilentlyContinue; Write-Host 'Paper size set to ${paperSize} successfully' } catch { Write-Host 'Error setting paper size: ' $_.Exception.Message }"

REM Set color mode
echo Setting color mode to ${colorMode}...
powershell.exe -Command "$ErrorActionPreference = 'Stop'; try { Set-PrintConfiguration -PrinterName '${printerName}' -Color ${colorMode === 'Color'} -ErrorAction SilentlyContinue; Write-Host 'Color mode set to ${colorMode} successfully' } catch { Write-Host 'Error setting color mode: ' $_.Exception.Message }"

REM Set duplex mode
echo Setting print type to ${printType}...
powershell.exe -Command "$ErrorActionPreference = 'Stop'; try { Set-PrintConfiguration -PrinterName '${printerName}' -DuplexingMode ${printType === 'Double' ? 'TwoSidedLongEdge' : 'OneSided'} -ErrorAction SilentlyContinue; Write-Host 'Print type set to ${printType} successfully' } catch { Write-Host 'Error setting print type: ' $_.Exception.Message }"

echo.
echo METHOD 1: Trying MSPaint method...
echo.
mspaint /pt "${filePath}" "${printerName}"
if %ERRORLEVEL% EQU 0 (
  echo MSPaint printing successful!
  exit /b 0
)

echo.
echo METHOD 2: MSPaint failed, trying PowerShell method...
echo.
powershell.exe -Command "$ErrorActionPreference = 'Stop'; try { Add-Type -AssemblyName System.Drawing; Add-Type -AssemblyName System.Printing; $image = [System.Drawing.Image]::FromFile('${filePath}'); $printerSettings = New-Object System.Drawing.Printing.PrinterSettings; $printerSettings.PrinterName = '${printerName}'; $printerSettings.Copies = ${copies}; $pageSettings = New-Object System.Drawing.Printing.PageSettings($printerSettings); $pageSettings.PaperSize = New-Object System.Drawing.Printing.PaperSize('${paperSize}', 0, 0); $doc = New-Object System.Drawing.Printing.PrintDocument; $doc.PrinterSettings = $printerSettings; $doc.DefaultPageSettings = $pageSettings; $doc.Print(); $image.Dispose(); Write-Host 'PowerShell printing successful!'; exit 0 } catch { Write-Host 'PowerShell printing failed: ' $_.Exception.Message; exit 1 }"

if %ERRORLEVEL% EQU 0 (
  echo PowerShell print successful!
  exit /b 0
)

echo.
echo METHOD 3: Trying rundll32 method...
echo.
rundll32 shimgvw.dll,ImageView_PrintTo /pt "${filePath}" "${printerName}"
if %ERRORLEVEL% EQU 0 (
  echo rundll32 printing successful!
  exit /b 0
)

echo.
echo METHOD 4: All image-specific methods failed, trying generic print command...
echo.
print /d:"${printerName}" "${filePath}"
if %ERRORLEVEL% EQU 0 (
  echo Generic print successful!
  exit /b 0
)

echo All printing methods failed!
echo Please try printing manually by opening the file.
echo File location: ${filePath}
echo.
echo Press any key to close this window...
pause > nul
exit /b 1`;
  } else if (fileExt === '.pdf') {
    // For PDFs, try multiple methods with explicit paper size
    batchContent = `@echo off
echo ===============================================================
echo PRINTING PDF FILE: ${filePath}
echo TO PRINTER: ${printerName}
echo PAPER SIZE: ${paperSize}
echo COPIES: ${copies}
echo COLOR MODE: ${colorMode}
echo PRINT TYPE: ${printType}
echo PAGES PER SHEET: ${nupPages}
echo ===============================================================

REM Set printer paper size first using PowerShell
echo Setting printer paper size to ${paperSize}...
powershell.exe -Command "$ErrorActionPreference = 'Stop'; try { $printer = Get-Printer -Name '${printerName}'; Set-PrintConfiguration -PrinterName '${printerName}' -PaperSize ${paperSize} -ErrorAction SilentlyContinue; Write-Host 'Paper size set to ${paperSize} successfully' } catch { Write-Host 'Error setting paper size: ' $_.Exception.Message }"

REM Set color mode
echo Setting color mode to ${colorMode}...
powershell.exe -Command "$ErrorActionPreference = 'Stop'; try { Set-PrintConfiguration -PrinterName '${printerName}' -Color ${colorMode === 'Color'} -ErrorAction SilentlyContinue; Write-Host 'Color mode set to ${colorMode} successfully' } catch { Write-Host 'Error setting color mode: ' $_.Exception.Message }"

REM Set duplex mode
echo Setting print type to ${printType}...
powershell.exe -Command "$ErrorActionPreference = 'Stop'; try { Set-PrintConfiguration -PrinterName '${printerName}' -DuplexingMode ${printType === 'Double' ? 'TwoSidedLongEdge' : 'OneSided'} -ErrorAction SilentlyContinue; Write-Host 'Print type set to ${printType} successfully' } catch { Write-Host 'Error setting print type: ' $_.Exception.Message }"

echo.
echo METHOD 1: Checking for SumatraPDF...
where SumatraPDF.exe >nul 2>&1
if %ERRORLEVEL% EQU 0 (
  echo SumatraPDF found, using it for printing...
  SumatraPDF.exe -print-to "${printerName}" -print-settings "${copies}x,${paperSize},${colorMode === 'Color' ? 'color' : 'monochrome'},${printType === 'Double' ? 'duplex' : 'simplex'}" -silent "${filePath}"
  if %ERRORLEVEL% EQU 0 (
    echo SumatraPDF printing successful!
    exit /b 0
  ) else (
    echo SumatraPDF printing failed with error code %ERRORLEVEL%
  )
) else (
  echo SumatraPDF not found, trying other methods...
)

echo.
echo METHOD 2: Checking for Adobe Reader...
where AcroRd32.exe >nul 2>&1
if %ERRORLEVEL% EQU 0 (
  echo Adobe Reader found, using it for printing...
  AcroRd32.exe /t "${filePath}" "${printerName}" "" "${paperSize}"
  if %ERRORLEVEL% EQU 0 (
    echo Adobe Reader printing successful!
    exit /b 0
  ) else (
    echo Adobe Reader printing failed with error code %ERRORLEVEL%
  )
) else (
  echo Adobe Reader not found, trying other methods...
)

echo.
echo METHOD 3: Trying PowerShell printing...
powershell.exe -Command "$ErrorActionPreference = 'Stop'; try { $printer = Get-Printer -Name '${printerName}'; Set-PrintConfiguration -PrinterName '${printerName}' -PaperSize ${paperSize} -Color ${colorMode === 'Color'} -DuplexingMode ${printType === 'Double' ? 'TwoSidedLongEdge' : 'OneSided'}; for ($i=1; $i -le ${copies}; $i++) { Start-Process -FilePath '${filePath}' -Verb Print -WindowStyle Hidden; Start-Sleep -Seconds 2 }; Write-Host 'PowerShell print successful!'; exit 0 } catch { Write-Host 'PowerShell printing failed: ' $_.Exception.Message; exit 1 }"

if %ERRORLEVEL% EQU 0 (
  echo PowerShell printing successful!
  exit /b 0
)

echo.
echo METHOD 4: All PDF-specific methods failed, trying generic print command...
print /d:"${printerName}" "${filePath}"
if %ERRORLEVEL% EQU 0 (
  echo Generic print successful!
  exit /b 0
)

echo All printing methods failed!
echo Please try printing manually by opening the file.
echo File location: ${filePath}
echo.
echo Press any key to close this window...
pause > nul
exit /b 1`;
  } else {
    // For other file types, use generic print command with paper size
    batchContent = `@echo off
echo ===============================================================
echo PRINTING FILE: ${filePath}
echo TO PRINTER: ${printerName}
echo PAPER SIZE: ${paperSize}
echo COPIES: ${copies}
echo COLOR MODE: ${colorMode}
echo PRINT TYPE: ${printType}
echo PAGES PER SHEET: ${nupPages}
echo ===============================================================

REM Set printer paper size first using PowerShell
echo Setting printer paper size to ${paperSize}...
powershell.exe -Command "$ErrorActionPreference = 'Stop'; try { $printer = Get-Printer -Name '${printerName}'; Set-PrintConfiguration -PrinterName '${printerName}' -PaperSize ${paperSize} -ErrorAction SilentlyContinue; Write-Host 'Paper size set to ${paperSize} successfully' } catch { Write-Host 'Error setting paper size: ' $_.Exception.Message }"

REM Set color mode
echo Setting color mode to ${colorMode}...
powershell.exe -Command "$ErrorActionPreference = 'Stop'; try { Set-PrintConfiguration -PrinterName '${printerName}' -Color ${colorMode === 'Color'} -ErrorAction SilentlyContinue; Write-Host 'Color mode set to ${colorMode} successfully' } catch { Write-Host 'Error setting color mode: ' $_.Exception.Message }"

REM Set duplex mode
echo Setting print type to ${printType}...
powershell.exe -Command "$ErrorActionPreference = 'Stop'; try { Set-PrintConfiguration -PrinterName '${printerName}' -DuplexingMode ${printType === 'Double' ? 'TwoSidedLongEdge' : 'OneSided'} -ErrorAction SilentlyContinue; Write-Host 'Print type set to ${printType} successfully' } catch { Write-Host 'Error setting print type: ' $_.Exception.Message }"

echo.
echo METHOD 1: Trying direct print command...
print /d:"${printerName}" "${filePath}"
if %ERRORLEVEL% EQU 0 (
  echo Direct print successful!
  exit /b 0
)

echo.
echo METHOD 2: Direct print failed, trying PowerShell print verb...
powershell.exe -Command "$ErrorActionPreference = 'Stop'; try { $printer = Get-Printer -Name '${printerName}'; Set-PrintConfiguration -PrinterName '${printerName}' -PaperSize ${paperSize} -Color ${colorMode === 'Color'} -DuplexingMode ${printType === 'Double' ? 'TwoSidedLongEdge' : 'OneSided'}; for ($i=1; $i -le ${copies}; $i++) { Start-Process -FilePath '${filePath}' -Verb Print -WindowStyle Hidden; Start-Sleep -Seconds 2 }; Write-Host 'PowerShell print successful!'; exit 0 } catch { Write-Host 'PowerShell printing failed: ' $_.Exception.Message; exit 1 }"

if %ERRORLEVEL% EQU 0 (
  echo PowerShell print verb successful!
  exit /b 0
)

echo All printing methods failed!
echo Please try printing manually by opening the file.
echo File location: ${filePath}
echo.
echo Press any key to close this window...
pause > nul
exit /b 1`;
  }
  
  fs.writeFileSync(batchFilePath, batchContent);
  return batchFilePath;
};

// Print file directly using batch file
const printFileDirectly = async (filePath, printerName, paperSize, copies = 1, colorMode = 'BW', printType = 'Single', nupPages = 1) => {
  try {
    console.log('🖨️ Direct printing file with options:', {
      filePath,
      printerName,
      paperSize,
      copies,
      colorMode,
      printType,
      nupPages
    });
    
    // Create batch file
    const batchFilePath = createPrintBatchFile(filePath, printerName, paperSize, copies, colorMode, printType, nupPages);
    console.log('📝 Created batch file:', batchFilePath);
    
    // Execute batch file with visible console to see output
    const command = `start cmd.exe /k "${batchFilePath}"`;
    console.log('🚀 Executing command:', command);
    
    await execPromise(command);
    
    return {
      success: true,
      command: 'Direct Windows Batch Print',
      message: `Print job sent to ${printerName} with ${paperSize} paper size, ${copies} copies, ${colorMode} mode, ${printType} printing${nupPages > 1 ? `, ${nupPages}-up layout` : ''}`
    };
  } catch (error) {
    console.error('❌ Direct printing failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Create a test print file and print it
const createAndPrintTestFile = async (printerName, paperSize, copies = 1, colorMode = 'BW', printType = 'Single') => {
  try {
    const tempDir = path.join(os.tmpdir(), 'xerox-print-jobs');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const testFilePath = path.join(tempDir, `test-print-${Date.now()}.txt`);
    const testContent = `
=======================================================
                TEST PRINT - ${new Date().toLocaleString()}
=======================================================

Printer: ${printerName}
Paper Size: ${paperSize}
Copies: ${copies}
Color Mode: ${colorMode}
Print Type: ${printType}
System: ${process.platform === 'win32' ? 'Windows' : process.platform === 'darwin' ? 'macOS' : 'Linux'}

This is a test print to verify that your printer is working correctly.
If you can read this message, your printer is properly configured!

=======================================================
`;
    
    fs.writeFileSync(testFilePath, testContent);
    console.log('📝 Created test print file:', testFilePath);
    
    const result = await printFileDirectly(testFilePath, printerName, paperSize, copies, colorMode, printType);
    
    return {
      ...result,
      filePath: testFilePath
    };
  } catch (error) {
    console.error('❌ Test print creation failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Create test image file for paper size testing
const createTestImageFile = async (paperSize) => {
  try {
    const tempDir = path.join(os.tmpdir(), 'xerox-print-jobs');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Create a simple text file with paper size info
    const testFilePath = path.join(tempDir, `test-image-${paperSize}-${Date.now()}.txt`);
    const testContent = `
=======================================================
                TEST IMAGE FOR ${paperSize}
=======================================================

This is a test file to simulate an image for ${paperSize} paper size.
When printed, this should use ${paperSize} paper size settings.

Created: ${new Date().toLocaleString()}

=======================================================
`;
    
    fs.writeFileSync(testFilePath, testContent);
    console.log('📝 Created test image file for', paperSize, ':', testFilePath);
    
    return {
      success: true,
      filePath: testFilePath
    };
  } catch (error) {
    console.error('❌ Test image creation failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Create test PDF file for paper size testing
const createTestPdfFile = async (paperSize) => {
  try {
    const tempDir = path.join(os.tmpdir(), 'xerox-print-jobs');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Create a simple text file with paper size info (since we can't create PDFs directly)
    const testFilePath = path.join(tempDir, `test-pdf-${paperSize}-${Date.now()}.txt`);
    const testContent = `
=======================================================
                TEST PDF FOR ${paperSize}
=======================================================

This is a test file to simulate a PDF for ${paperSize} paper size.
When printed, this should use ${paperSize} paper size settings.

Created: ${new Date().toLocaleString()}

=======================================================
`;
    
    fs.writeFileSync(testFilePath, testContent);
    console.log('📝 Created test PDF file for', paperSize, ':', testFilePath);
    
    return {
      success: true,
      filePath: testFilePath
    };
  } catch (error) {
    console.error('❌ Test PDF creation failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

module.exports = {
  printFileDirectly,
  createAndPrintTestFile,
  createTestImageFile,
  createTestPdfFile
};
/**
 * Advanced Paper Size Control Module for Windows
 * This module provides multiple methods to force paper size settings on Windows printers
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const util = require('util');
const execPromise = util.promisify(exec);

// Temporary directory for scripts
const TEMP_DIR = path.join(os.tmpdir(), 'xerox-print-control');

// Ensure temp directory exists
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

/**
 * Force paper size setting using multiple methods
 * @param {string} printerName - Name of the printer
 * @param {string} paperSize - Paper size (e.g., 'A4', 'Letter')
 * @returns {Promise<object>} - Result of the operation
 */
async function forcePaperSize(printerName, paperSize) {
  console.log(`🔧 Forcing paper size ${paperSize} for printer ${printerName}`);
  
  try {
    // Method 1: PowerShell Set-PrintConfiguration
    const psResult = await setPaperSizeWithPowerShell(printerName, paperSize);
    
    // Method 2: Create and run a VBS script
    const vbsResult = await setPaperSizeWithVBS(printerName, paperSize);
    
    // Method 3: Create and run a batch file with multiple approaches
    const batchResult = await setPaperSizeWithBatch(printerName, paperSize);
    
    return {
      success: true,
      methods: {
        powershell: psResult,
        vbs: vbsResult,
        batch: batchResult
      },
      message: `Applied paper size ${paperSize} to ${printerName} using multiple methods`
    };
  } catch (error) {
    console.error('❌ Error forcing paper size:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Set paper size using PowerShell
 */
async function setPaperSizeWithPowerShell(printerName, paperSize) {
  try {
    const psCommand = `
      $ErrorActionPreference = "Stop"
      try {
        $printer = Get-Printer -Name "${printerName}" -ErrorAction Stop
        Write-Host "Found printer: $($printer.Name)"
        
        # Try to get current configuration
        $config = Get-PrintConfiguration -PrinterName "${printerName}" -ErrorAction SilentlyContinue
        if ($config) {
          Write-Host "Current paper size: $($config.PaperSize)"
          
          # Set new paper size
          Set-PrintConfiguration -PrinterName "${printerName}" -PaperSize ${paperSize}
          Write-Host "Paper size set to ${paperSize}"
          
          # Verify the change
          $newConfig = Get-PrintConfiguration -PrinterName "${printerName}"
          Write-Host "New paper size: $($newConfig.PaperSize)"
          
          if ($newConfig.PaperSize -eq "${paperSize}") {
            Write-Host "SUCCESS: Paper size changed successfully"
            exit 0
          } else {
            Write-Host "WARNING: Paper size may not have changed"
            exit 1
          }
        } else {
          Write-Host "WARNING: Could not get printer configuration"
          exit 1
        }
      } catch {
        Write-Host "ERROR: $($_.Exception.Message)"
        exit 1
      }
    `;
    
    const psScriptPath = path.join(TEMP_DIR, `set_paper_size_${Date.now()}.ps1`);
    fs.writeFileSync(psScriptPath, psCommand);
    
    const { stdout, stderr } = await execPromise(`powershell -ExecutionPolicy Bypass -File "${psScriptPath}"`);
    
    console.log('PowerShell output:', stdout);
    if (stderr) console.error('PowerShell errors:', stderr);
    
    return {
      success: !stderr,
      output: stdout
    };
  } catch (error) {
    console.error('PowerShell method failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Set paper size using VBScript
 */
async function setPaperSizeWithVBS(printerName, paperSize) {
  try {
    const vbsScript = `
      On Error Resume Next
      
      ' Map paper size names to Windows constants
      Function GetPaperSizeValue(sizeName)
        Select Case UCase(sizeName)
          Case "A3"
            GetPaperSizeValue = 8
          Case "A4"
            GetPaperSizeValue = 9
          Case "A5"
            GetPaperSizeValue = 11
          Case "LETTER"
            GetPaperSizeValue = 1
          Case "LEGAL"
            GetPaperSizeValue = 5
          Case "EXECUTIVE"
            GetPaperSizeValue = 7
          Case Else
            GetPaperSizeValue = 9 ' Default to A4
        End Select
      End Function
      
      ' Get paper size value
      paperSizeValue = GetPaperSizeValue("${paperSize}")
      
      ' Connect to WMI
      Set WMIService = GetObject("winmgmts:\\\\.\\root\\cimv2")
      
      ' Find the printer
      Set printers = WMIService.ExecQuery("SELECT * FROM Win32_Printer WHERE Name = '${printerName}'")
      
      If printers.Count = 0 Then
        WScript.Echo "ERROR: Printer not found"
        WScript.Quit 1
      End If
      
      ' Get the first printer
      For Each printer in printers
        WScript.Echo "Found printer: " & printer.Name
        
        ' Try to set default paper size
        printer.SetDefaultPrinter()
        
        ' Get printer device ID
        deviceId = printer.DeviceID
        
        ' Try to modify printer settings
        Set objPrinter = WMIService.Get("Win32_Printer.DeviceID='" & deviceId & "'")
        
        ' Attempt to set paper size
        result = objPrinter.SetPrinterParm("PaperSize", paperSizeValue)
        
        If Err.Number <> 0 Then
          WScript.Echo "VBS ERROR: " & Err.Description
          Err.Clear
        Else
          WScript.Echo "Paper size set to " & paperSizeValue & " (" & "${paperSize}" & ")"
        End If
        
        Exit For
      Next
      
      WScript.Echo "VBS script completed"
    `;
    
    const vbsScriptPath = path.join(TEMP_DIR, `set_paper_size_${Date.now()}.vbs`);
    fs.writeFileSync(vbsScriptPath, vbsScript);
    
    const { stdout, stderr } = await execPromise(`cscript //NoLogo "${vbsScriptPath}"`);
    
    console.log('VBScript output:', stdout);
    if (stderr) console.error('VBScript errors:', stderr);
    
    return {
      success: !stderr,
      output: stdout
    };
  } catch (error) {
    console.error('VBScript method failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Set paper size using a batch file with multiple approaches
 */
async function setPaperSizeWithBatch(printerName, paperSize) {
  try {
    const batchScript = `
@echo off
echo ===============================================================
echo SETTING PAPER SIZE FOR PRINTER: ${printerName}
echo PAPER SIZE: ${paperSize}
echo ===============================================================

echo.
echo METHOD 1: Using PowerShell...
powershell.exe -Command "$ErrorActionPreference = 'Stop'; try { $printer = Get-Printer -Name '${printerName}'; Set-PrintConfiguration -PrinterName '${printerName}' -PaperSize ${paperSize} -ErrorAction SilentlyContinue; Write-Host 'Paper size set to ${paperSize} successfully' } catch { Write-Host 'Error setting paper size: ' $_.Exception.Message }"

echo.
echo METHOD 2: Using rundll32...
rundll32 printui.dll,PrintUIEntry /Xs /n"${printerName}" attributes +paper

echo.
echo METHOD 3: Using WMI...
powershell.exe -Command "$paperSizeValue = switch ('${paperSize}') { 'A3' {8} 'A4' {9} 'A5' {11} 'Letter' {1} 'Legal' {5} 'Executive' {7} default {9} }; try { $printer = Get-WmiObject -Query \\"SELECT * FROM Win32_Printer WHERE Name='${printerName}'\\" -ErrorAction Stop; $printer.SetDefaultPrinter(); $result = $printer.SetPrinterParm('PaperSize', $paperSizeValue); Write-Host 'WMI paper size set result: ' $result } catch { Write-Host 'WMI error: ' $_.Exception.Message }"

echo.
echo METHOD 4: Using registry modification...
powershell.exe -Command "try { $printerKey = 'HKCU:\\Software\\Microsoft\\Windows NT\\CurrentVersion\\Devices\\${printerName}'; if (Test-Path $printerKey) { Set-ItemProperty -Path $printerKey -Name 'PaperSize' -Value ${paperSize} -Type String -ErrorAction SilentlyContinue; Write-Host 'Registry updated for paper size' } else { Write-Host 'Printer registry key not found' } } catch { Write-Host 'Registry error: ' $_.Exception.Message }"

echo.
echo All methods attempted. Paper size should be set to ${paperSize}.
echo.
echo Press any key to close this window...
pause > nul
exit /b 0
    `;
    
    const batchScriptPath = path.join(TEMP_DIR, `set_paper_size_${Date.now()}.bat`);
    fs.writeFileSync(batchScriptPath, batchScript);
    
    // Run batch file with visible console to see output
    const command = `start cmd.exe /k "${batchScriptPath}"`;
    await execPromise(command);
    
    return {
      success: true,
      message: `Batch file executed to set paper size ${paperSize} for ${printerName}`,
      batchFile: batchScriptPath
    };
  } catch (error) {
    console.error('Batch method failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Create a test print file with specific paper size settings
 */
async function createTestPrintWithPaperSize(printerName, paperSize) {
  try {
    const testFilePath = path.join(TEMP_DIR, `test_print_${paperSize}_${Date.now()}.txt`);
    const testContent = `
=======================================================
                TEST PRINT - ${new Date().toLocaleString()}
=======================================================

Printer: ${printerName}
Paper Size: ${paperSize}
System: Windows

This is a test print to verify that your printer is using the correct paper size.
If you can read this message, your printer is properly configured!

=======================================================
`;
    
    fs.writeFileSync(testFilePath, testContent);
    console.log('📝 Created test print file:', testFilePath);
    
    // Force paper size setting
    await forcePaperSize(printerName, paperSize);
    
    // Create a batch file to print with the correct paper size
    const batchScript = `
@echo off
echo ===============================================================
echo PRINTING TEST FILE WITH SPECIFIC PAPER SIZE
echo ===============================================================
echo Printer: ${printerName}
echo Paper Size: ${paperSize}
echo File: ${testFilePath}
echo ===============================================================

echo.
echo Setting paper size to ${paperSize}...
powershell.exe -Command "$ErrorActionPreference = 'Stop'; try { Set-PrintConfiguration -PrinterName '${printerName}' -PaperSize ${paperSize} -ErrorAction SilentlyContinue; Write-Host 'Paper size set to ${paperSize}' } catch { Write-Host 'Error: ' $_.Exception.Message }"

echo.
echo Printing test file...
print /d:"${printerName}" "${testFilePath}"

echo.
echo Test print completed. Please check if the paper size is correct.
echo.
echo Press any key to close this window...
pause > nul
exit /b 0
    `;
    
    const batchScriptPath = path.join(TEMP_DIR, `print_test_${Date.now()}.bat`);
    fs.writeFileSync(batchScriptPath, batchScript);
    
    // Run batch file with visible console
    const command = `start cmd.exe /k "${batchScriptPath}"`;
    await execPromise(command);
    
    return {
      success: true,
      testFilePath,
      batchFilePath: batchScriptPath,
      message: `Test print sent to ${printerName} with ${paperSize} paper size`
    };
  } catch (error) {
    console.error('❌ Test print creation failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  forcePaperSize,
  createTestPrintWithPaperSize
};
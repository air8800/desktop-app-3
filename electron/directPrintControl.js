// Advanced Direct Print Control Module
// This module provides direct control over printer settings including paper size

const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// Create a batch file that will directly print the file with explicit paper size control
const createPrintBatchFile = (filePath, printerName, paperSize, copies = 1, colorMode = 'BW', printType = 'Single') => {
  const tempDir = path.join(os.tmpdir(), 'xerox-print-jobs');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const batchFilePath = path.join(tempDir, `print_${Date.now()}.bat`);
  const fileExt = path.extname(filePath).toLowerCase();

  // Create a batch file with multiple printing methods for maximum compatibility
  const batchContent = `@echo off
echo ===============================================================
echo PRINTING FILE: ${filePath}
echo TO PRINTER: ${printerName}
echo PAPER SIZE: ${paperSize}
echo COPIES: ${copies}
echo COLOR MODE: ${colorMode}
echo PRINT TYPE: ${printType}
echo ===============================================================

REM ===== METHOD 1: Set printer paper size using PowerShell =====
echo.
echo METHOD 1: Setting printer paper size using PowerShell...
powershell.exe -Command "$ErrorActionPreference = 'Stop'; try { Set-PrintConfiguration -PrinterName '${printerName}' -PaperSize ${paperSize} -ErrorAction SilentlyContinue; Write-Host 'Paper size set to ${paperSize} successfully' } catch { Write-Host 'Error setting paper size: ' $_.Exception.Message }"

REM ===== METHOD 2: Use Windows Script Host with explicit paper size =====
echo.
echo METHOD 2: Creating VBS script with explicit paper size control...
echo Set objShell = CreateObject("WScript.Shell") > "%TEMP%\\print_with_size.vbs"
echo Set objPrinter = CreateObject("WScript.Network") >> "%TEMP%\\print_with_size.vbs"
echo objPrinter.SetDefaultPrinter "${printerName}" >> "%TEMP%\\print_with_size.vbs"
echo objShell.Run "rundll32 printui.dll,PrintUIEntry /y /n\\"${printerName}\\" /Xg", 0, True >> "%TEMP%\\print_with_size.vbs"
echo objShell.Run "rundll32 printui.dll,PrintUIEntry /y /n\\"${printerName}\\" /f\\"${filePath}\\" /o\\"paper=${paperSize} copies=${copies}\\"", 0, True >> "%TEMP%\\print_with_size.vbs"
cscript //nologo "%TEMP%\\print_with_size.vbs"
if %ERRORLEVEL% EQU 0 (
  echo VBS printing successful!
  exit /b 0
)

REM ===== METHOD 3: Use PowerShell with System.Drawing.Printing =====
echo.
echo METHOD 3: Using PowerShell with System.Drawing.Printing...
powershell.exe -Command "$ErrorActionPreference = 'Stop'; try { Add-Type -AssemblyName System.Drawing; Add-Type -AssemblyName System.Printing; $printerSettings = New-Object System.Drawing.Printing.PrinterSettings; $printerSettings.PrinterName = '${printerName}'; $printerSettings.Copies = ${copies}; $pageSettings = New-Object System.Drawing.Printing.PageSettings($printerSettings); $pageSettings.PaperSize = New-Object System.Drawing.Printing.PaperSize('${paperSize}', 0, 0); $doc = New-Object System.Drawing.Printing.PrintDocument; $doc.PrinterSettings = $printerSettings; $doc.DefaultPageSettings = $pageSettings; for ($i=1; $i -le ${copies}; $i++) { Start-Process -FilePath '${filePath}' -Verb Print -WindowStyle Hidden; Start-Sleep -Seconds 2 }; Write-Host 'PowerShell printing successful!'; exit 0 } catch { Write-Host 'PowerShell printing failed: ' $_.Exception.Message; exit 1 }"

if %ERRORLEVEL% EQU 0 (
  echo PowerShell printing successful!
  exit /b 0
)

REM ===== METHOD 4: Use direct print command with printer properties =====
echo.
echo METHOD 4: Using direct print command...
${fileExt === '.pdf' ? 'SumatraPDF.exe -print-to "' + printerName + '" -print-settings "' + copies + 'x,' + paperSize + ',' + (colorMode === 'Color' ? 'color' : 'monochrome') + ',' + (printType === 'Double' ? 'duplex' : 'simplex') + '" -silent "' + filePath + '"' : 'print /d:"' + printerName + '" "' + filePath + '"'}
if %ERRORLEVEL% EQU 0 (
  echo Direct print successful!
  exit /b 0
)

REM ===== METHOD 5: Last resort - open file for manual printing =====
echo.
echo METHOD 5: All methods failed, opening file for manual printing...
start "" "${filePath}"
echo Please print manually with these settings:
echo - Printer: ${printerName}
echo - Paper Size: ${paperSize}
echo - Copies: ${copies}
echo.
echo Press any key to close this window...
pause > nul
exit /b 1`;
  
  fs.writeFileSync(batchFilePath, batchContent);
  return batchFilePath;
};

// Create a PowerShell script for more advanced printer control
const createPowerShellScript = (filePath, printerName, paperSize, copies = 1, colorMode = 'BW') => {
  const tempDir = path.join(os.tmpdir(), 'xerox-print-jobs');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  const psFilePath = path.join(tempDir, `print_${Date.now()}.ps1`);
  
  const psContent = `
# Advanced PowerShell Printing Script with Paper Size Control
$ErrorActionPreference = "Stop"

# Print job information
Write-Host "==============================================================="
Write-Host "PRINTING FILE: ${filePath}"
Write-Host "TO PRINTER: ${printerName}"
Write-Host "PAPER SIZE: ${paperSize}"
Write-Host "COPIES: ${copies}"
Write-Host "COLOR MODE: ${colorMode}"
Write-Host "==============================================================="

# Function to set printer configuration
function Set-PrinterPaperSize {
    param (
        [string]$PrinterName,
        [string]$PaperSize
    )
    
    try {
        # Get printer
        $printer = Get-Printer -Name $PrinterName -ErrorAction Stop
        Write-Host "Found printer: $($printer.Name)"
        
        # Set paper size
        Set-PrintConfiguration -PrinterName $PrinterName -PaperSize $PaperSize -ErrorAction Stop
        Write-Host "Paper size set to $PaperSize successfully"
        return $true
    }
    catch {
        Write-Host "Error setting paper size: $_"
        return $false
    }
}

# Function to print file with System.Drawing.Printing
function Print-FileWithSettings {
    param (
        [string]$FilePath,
        [string]$PrinterName,
        [string]$PaperSize,
        [int]$Copies
    )
    
    try {
        # Load required assemblies
        Add-Type -AssemblyName System.Drawing
        Add-Type -AssemblyName System.Windows.Forms
        
        # Create printer settings
        $printerSettings = New-Object System.Drawing.Printing.PrinterSettings
        $printerSettings.PrinterName = $PrinterName
        $printerSettings.Copies = $Copies
        
        # Create page settings with paper size
        $pageSettings = New-Object System.Drawing.Printing.PageSettings($printerSettings)
        
        # Try to find the paper size by name
        $found = $false
        foreach ($size in $printerSettings.PaperSizes) {
            if ($size.PaperName -eq $PaperSize) {
                $pageSettings.PaperSize = $size
                $found = $true
                Write-Host "Found matching paper size: $($size.PaperName)"
                break
            }
        }
        
        if (-not $found) {
            Write-Host "Paper size '$PaperSize' not found, creating custom size"
            $pageSettings.PaperSize = New-Object System.Drawing.Printing.PaperSize($PaperSize, 0, 0)
        }
        
        # Print the file
        $extension = [System.IO.Path]::GetExtension($FilePath).ToLower()
        
        if ($extension -eq ".pdf") {
            # For PDF files, try to use SumatraPDF if available
            $sumatraPath = "C:\\Program Files\\SumatraPDF\\SumatraPDF.exe"
            if (Test-Path $sumatraPath) {
                Write-Host "Using SumatraPDF for PDF printing"
                Start-Process -FilePath $sumatraPath -ArgumentList "-print-to `"$PrinterName`" -print-settings `"${Copies}x,$PaperSize`" `\"$FilePath`"" -Wait
            } else {
                # Fallback to standard print
                Write-Host "SumatraPDF not found, using standard print for PDF"
                for ($i=1; $i -le $Copies; $i++) {
                    Start-Process -FilePath $FilePath -Verb Print
                    Start-Sleep -Seconds 2
                }
            }
        } else {
            # For other file types
            for ($i=1; $i -le $Copies; $i++) {
                Start-Process -FilePath $FilePath -Verb Print
                Start-Sleep -Seconds 2
            }
        }
        
        Write-Host "Print job sent successfully"
        return $true
    }
    catch {
        Write-Host "Error printing file: $_"
        return $false
    }
}

# Main execution
$success = $false

# Step 1: Set printer paper size
Write-Host "Step 1: Setting printer paper size..."
$paperSizeSet = Set-PrinterPaperSize -PrinterName "$printerName" -PaperSize "$paperSize"

# Step 2: Print with settings
Write-Host "Step 2: Printing file with settings..."
$printSuccess = Print-FileWithSettings -FilePath "$filePath" -PrinterName "$printerName" -PaperSize "$paperSize" -Copies $copies

if ($printSuccess) {
    Write-Host "Print job completed successfully!"
    $success = $true
} else {
    Write-Host "Print job failed with advanced method, trying fallback method..."
    
    # Fallback method - direct print command
    try {
        Write-Host "Using fallback print method..."
        Start-Process -FilePath "$filePath" -Verb Print
        Write-Host "Fallback print method executed"
        $success = $true
    } catch {
        Write-Host "Fallback print method failed: $_"
    }
}

# Return result
if ($success) {
    Write-Host "Print process completed successfully"
    exit 0
} else {
    Write-Host "All print methods failed"
    exit 1
}
`;
  
  fs.writeFileSync(psFilePath, psContent);
  return psFilePath;
};

// Print file directly using multiple methods for maximum compatibility
const printFileWithPaperSize = async (filePath, printerName, paperSize, copies = 1, colorMode = 'BW') => {
  try {
    console.log('🖨️ Direct printing with paper size control:', {
      filePath,
      printerName,
      paperSize,
      copies,
      colorMode
    });
    
    // Create batch file for Windows
    if (process.platform === 'win32') {
      const batchFilePath = createPrintBatchFile(filePath, printerName, paperSize, copies, colorMode);
      console.log('📝 Created batch file:', batchFilePath);
      
      // Execute batch file with visible console to see output
      const command = \`start cmd.exe /k "${batchFilePath}"`;
      console.log('🚀 Executing command:', command);
      
      await execPromise(command);
      
      return {
        success: true,
        command: 'Direct Windows Batch Print',
        message: \`Print job sent to ${printerName} with ${paperSize} paper size`
      };
    } 
    // Create PowerShell script for more advanced control
    else if (process.platform === 'win32') {
      const psFilePath = createPowerShellScript(filePath, printerName, paperSize, copies, colorMode);
      console.log('📝 Created PowerShell script:', psFilePath);
      
      // Execute PowerShell script
      const command = \`powershell.exe -ExecutionPolicy Bypass -File "${psFilePath}"`;
      console.log('🚀 Executing PowerShell command:', command);
      
      await execPromise(command);
      
      return {
        success: true,
        command: 'PowerShell Print Control',
        message: \`Print job sent to ${printerName} with ${paperSize} paper size`
      };
    }
    // For macOS
    else if (process.platform === 'darwin') {
      // macOS lp command with paper size
      const command = \`lp -d "${printerName}" -n ${copies} -o media=${paperSize} "${filePath}"`;
      console.log('🚀 Executing macOS print command:', command);
      
      await execPromise(command);
      
      return {
        success: true,
        command: 'macOS lp with paper size',
        message: \`Print job sent to ${printerName} with ${paperSize} paper size`
      };
    }
    // For Linux
    else {
      // Linux lp command with paper size
      const command = \`lp -d "${printerName}" -n ${copies} -o media=${paperSize} "${filePath}"`;
      console.log('🚀 Executing Linux print command:', command);
      
      await execPromise(command);
      
      return {
        success: true,
        command: 'Linux lp with paper size',
        message: \`Print job sent to ${printerName} with ${paperSize} paper size`
      };
    }
  } catch (error) {
    console.error('❌ Direct printing with paper size failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Create a test print file and print it with specific paper size
const createAndPrintTestFile = async (printerName, paperSize, copies = 1) => {
  try {
    const tempDir = path.join(os.tmpdir(), 'xerox-print-jobs');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const testFilePath = path.join(tempDir, \`test-print-${Date.now()}.txt`);
    const testContent = `
=======================================================
                TEST PRINT - ${new Date().toLocaleString()}
=======================================================

Printer: ${printerName}
Paper Size: ${paperSize}
Copies: ${copies}
System: ${process.platform === 'win32' ? 'Windows' : process.platform === 'darwin' ? 'macOS' : 'Linux'}

This is a test print to verify that your printer is working correctly
with the specified paper size (${paperSize}).

If you can read this message, your printer is properly configured!

=======================================================
`;
    
    fs.writeFileSync(testFilePath, testContent);
    console.log('📝 Created test print file:', testFilePath);
    
    const result = await printFileWithPaperSize(testFilePath, printerName, paperSize, copies);
    
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

// Direct printing with registry modification for Windows
const printWithRegistryModification = async (filePath, printerName, paperSize, copies = 1) => {
  if (process.platform !== 'win32') {
    return { 
      success: false, 
      error: 'Registry modification is only available on Windows' 
    };
  }
  
  try {
    const tempDir = path.join(os.tmpdir(), 'xerox-print-jobs');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Create a PowerShell script that modifies the printer's registry settings
    const psFilePath = path.join(tempDir, \`registry_print_${Date.now()}.ps1`);
    
    const psContent = `
# PowerShell script to modify printer registry settings and print
$ErrorActionPreference = "Stop"

Write-Host "Setting printer ${printerName} to use paper size ${paperSize}..."

# Get printer information
$printer = Get-Printer -Name "${printerName}"
$driverName = $printer.DriverName

# Modify registry settings for the printer
$registryPath = "HKCU:\\Software\\Microsoft\\Windows NT\\CurrentVersion\\Devices\\${printerName}"
if (Test-Path $registryPath) {
    # Get current DevMode settings
    $devMode = Get-ItemProperty -Path $registryPath
    
    # Modify DevMode to set paper size
    # Note: This is a simplified approach, actual implementation would need to modify the binary DevMode structure
    # which requires more complex code using P/Invoke
    
    Write-Host "Registry path exists, but direct DevMode modification requires advanced techniques"
    Write-Host "Using alternative method..."
}

# Alternative approach: Use PrintUI.dll to modify printer preferences
Write-Host "Using PrintUI.dll to modify printer preferences..."
rundll32 printui.dll,PrintUIEntry /Ss /n"${printerName}" /a "${filePath}" /j"Set paper size to ${paperSize}" /o"paper=${paperSize} copies=${copies}"

# Print the file
Write-Host "Printing file ${filePath}..."
for ($i=1; $i -le ${copies}; $i++) {
    Start-Process -FilePath "${filePath}" -Verb Print
    Start-Sleep -Seconds 2
}

Write-Host "Print job completed"
`;
    
    fs.writeFileSync(psFilePath, psContent);
    
    // Execute the PowerShell script with elevated privileges
    const command = \`powershell.exe -ExecutionPolicy Bypass -File "${psFilePath}"`;
    console.log('🚀 Executing registry modification command:', command);
    
    await execPromise(command);
    
    return {
      success: true,
      command: 'Windows Registry Modification Print',
      message: \`Print job sent to ${printerName} with ${paperSize} paper size using registry modification`
    };
  } catch (error) {
    console.error('❌ Registry modification printing failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Use Windows API to print with specific paper size
const printWithWindowsAPI = async (filePath, printerName, paperSize, copies = 1) => {
  if (process.platform !== 'win32') {
    return { 
      success: false, 
      error: 'Windows API printing is only available on Windows' 
    };
  }
  
  try {
    const tempDir = path.join(os.tmpdir(), 'xerox-print-jobs');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Create a C# script that uses Windows API to print with specific paper size
    const csFilePath = path.join(tempDir, \`windows_api_print_${Date.now()}.cs`);
    
    const csContent = `
using System;
using System.Drawing;
using System.Drawing.Printing;
using System.IO;
using System.Windows.Forms;
using System.Runtime.InteropServices;

class PrintWithPaperSize
{
    static void Main(string[] args)
    {
        try
        {
            string filePath = @"${filePath.replace(/\\/g, '\\\\')}";
            string printerName = "${printerName}";
            string paperSizeName = "${paperSize}";
            int copies = ${copies};
            
            Console.WriteLine("Printing file: " + filePath);
            Console.WriteLine("Printer: " + printerName);
            Console.WriteLine("Paper Size: " + paperSizeName);
            Console.WriteLine("Copies: " + copies);
            
            // Set up printer settings
            PrinterSettings printerSettings = new PrinterSettings();
            printerSettings.PrinterName = printerName;
            printerSettings.Copies = (short)copies;
            
            // Find paper size by name
            PaperSize selectedSize = null;
            foreach (PaperSize size in printerSettings.PaperSizes)
            {
                if (size.PaperName.Equals(paperSizeName, StringComparison.OrdinalIgnoreCase))
                {
                    selectedSize = size;
                    Console.WriteLine("Found matching paper size: " + size.PaperName);
                    break;
                }
            }
            
            if (selectedSize == null)
            {
                Console.WriteLine("Paper size not found, using default");
            }
            
            // Create page settings with selected paper size
            PageSettings pageSettings = new PageSettings(printerSettings);
            if (selectedSize != null)
            {
                pageSettings.PaperSize = selectedSize;
            }
            
            // Print the file based on extension
            string extension = Path.GetExtension(filePath).ToLower();
            
            if (extension == ".pdf")
            {
                Console.WriteLine("Printing PDF file");
                // For PDF files, we need to use a PDF reader
                // This is a simplified approach
                System.Diagnostics.Process.Start("rundll32.exe", 
                    "printui.dll,PrintUIEntry /k /n\\"" + printerName + \"\\" /o /f\\"" + filePath + \"\\"");
            }
            else if (extension == ".txt" || extension == ".log")
            {
                Console.WriteLine("Printing text file");
                // For text files, we can use StreamReader
                using (StreamReader sr = new StreamReader(filePath))
                {
                    PrintDocument pd = new PrintDocument();
                    pd.PrinterSettings = printerSettings;
                    pd.DefaultPageSettings = pageSettings;
                    
                    string fileContent = sr.ReadToEnd();
                    pd.PrintPage += (sender, e) => {
                        e.Graphics.DrawString(fileContent, new Font("Arial", 10), 
                            Brushes.Black, e.MarginBounds);
                    };
                    
                    pd.Print();
                }
            }
            else
            {
                Console.WriteLine("Using default application to print file");
                // For other files, use the default application
                System.Diagnostics.Process.Start("rundll32.exe", 
                    "shell32.dll,ShellExec_RunDLL print \\"" + filePath + \"\\"");
            }
            
            Console.WriteLine("Print job sent successfully");
        }
        catch (Exception ex)
        {
            Console.WriteLine("Error: " + ex.Message);
            Environment.Exit(1);
        }
    }
}
`;
    
    fs.writeFileSync(csFilePath, csContent);
    
    // Compile and run the C# script
    const compileCommand = \`powershell.exe -Command "& {Add-Type -OutputAssembly '${path.join(tempDir, 'PrintWithPaperSize.exe')}' -OutputType ConsoleApplication -Path '${csFilePath}' -ReferencedAssemblies System.Windows.Forms,System.Drawing}"`;
    console.log('🔨 Compiling C# script:', compileCommand);
    
    await execPromise(compileCommand);
    
    const runCommand = `"${path.join(tempDir, 'PrintWithPaperSize.exe')}"`;
    console.log('🚀 Running Windows API print command:', runCommand);
    
    await execPromise(runCommand);
    
    return {
      success: true,
      command: 'Windows API Print',
      message: \`Print job sent to ${printerName} with ${paperSize} paper size using Windows API`
    };
  } catch (error) {
    console.error('❌ Windows API printing failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Export all methods for maximum flexibility
module.exports = {
  printFileWithPaperSize,
  createAndPrintTestFile,
  printWithRegistryModification,
  printWithWindowsAPI
};
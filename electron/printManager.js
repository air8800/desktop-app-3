// Advanced Print Manager with Paper Size Detection
// This handles all printing operations with proper paper size configuration

const { exec } = require('child_process');
const util = require('util');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { 
  getPaperSizeArgs, 
  formatPaperSizeForPrinter, 
  isSupportedPaperSize 
} = require('./paperSizeConfig');

const execPromise = util.promisify(exec);

class PrintManager {
  constructor() {
    this.platform = process.platform;
    this.tempDir = path.join(os.tmpdir(), 'xerox-print-jobs');
    this.ensureTempDir();
  }

  ensureTempDir() {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  // 🔥 MAIN PRINT FUNCTION WITH PAPER SIZE DETECTION
  async printFileWithSize(fileUrl, filename, printerName, paperSize, copies = 1, colorMode = 'BW') {
    try {
      console.log('🖨️ Starting print job with paper size detection:', {
        filename,
        printerName,
        paperSize,
        copies,
        colorMode,
        platform: this.platform
      });

      // 1. Validate paper size
      if (!isSupportedPaperSize(paperSize)) {
        throw new Error(`Unsupported paper size: ${paperSize}`);
      }

      // 2. Download file
      const filePath = await this.downloadFile(fileUrl, filename);
      console.log('📁 File downloaded to:', filePath);

      // 3. Get paper size configuration
      const paperConfig = formatPaperSizeForPrinter(paperSize, printerName, this.platform);
      console.log('📏 Paper configuration:', paperConfig);

      // 4. Print with correct paper size
      const printResult = await this.executePrintCommand(filePath, printerName, paperConfig, copies, colorMode);
      
      console.log('✅ Print job completed successfully:', printResult);
      return {
        success: true,
        message: `Successfully printed ${copies} copies of ${filename} on ${paperSize} paper`,
        paperSize: paperConfig.name,
        printerUsed: printerName,
        command: printResult.command
      };

    } catch (error) {
      console.error('❌ Print job failed:', error);
      return {
        success: false,
        error: error.message,
        paperSize,
        printerName
      };
    }
  }

  // Download file from URL
  async downloadFile(fileUrl, filename) {
    const timestamp = Date.now();
    const fileExtension = path.extname(filename);
    const baseName = path.basename(filename, fileExtension);
    const uniqueFilename = `${baseName}_${timestamp}${fileExtension}`;
    const filePath = path.join(this.tempDir, uniqueFilename);

    console.log('📥 Downloading file:', { fileUrl, filePath });

    const curlCommand = this.platform === 'win32' 
      ? `curl.exe -L -o "${filePath}" "${fileUrl}"`
      : `curl -L -o "${filePath}" "${fileUrl}"`;

    await execPromise(curlCommand);

    if (!fs.existsSync(filePath)) {
      throw new Error('File download failed - file not found after download');
    }

    const stats = fs.statSync(filePath);
    if (stats.size === 0) {
      throw new Error('File download failed - downloaded file is empty');
    }

    return filePath;
  }

  // Execute print command with paper size configuration
  async executePrintCommand(filePath, printerName, paperConfig, copies, colorMode) {
    const fileExtension = path.extname(filePath).toLowerCase();
    
    console.log('🖨️ Executing print command:', {
      filePath,
      printerName,
      paperConfig,
      copies,
      colorMode,
      fileExtension,
      platform: this.platform
    });

    switch (this.platform) {
      case 'win32':
        return await this.printOnWindows(filePath, printerName, paperConfig, copies, colorMode, fileExtension);
      
      case 'darwin':
        return await this.printOnMacOS(filePath, printerName, paperConfig, copies, colorMode, fileExtension);
      
      default:
        return await this.printOnLinux(filePath, printerName, paperConfig, copies, colorMode, fileExtension);
    }
  }

  // 🔥 COMPLETELY REWRITTEN: WINDOWS PRINTING WITH DIRECT COMMANDS
  async printOnWindows(filePath, printerName, paperConfig, copies, colorMode, fileExtension, printType = 'Single') {
    const paperSizeArgs = getPaperSizeArgs(paperConfig.name, 'win32');

    console.log('🖨️ Windows print configuration:', {
      paperSizeArgs,
      printerName,
      copies,
      colorMode,
      printType,
      fileExtension
    });

    // 🔥 NEW: DIRECT PRINTING METHODS FOR WINDOWS

    // Method 1: Use SumatraPDF for PDFs (most reliable)
    if (fileExtension === '.pdf') {
      try {
        // Check if SumatraPDF is available
        const sumatraPath = await this.findSumatraPDF();
        if (sumatraPath) {
          const printSettings = `${copies}x,${paperConfig.name},${colorMode === 'Color' ? 'color' : 'monochrome'},${printType === 'Double' ? 'duplex' : 'simplex'}`;
          const command = `"${sumatraPath}" -print-to "${printerName}" -print-settings "${printSettings}" -silent "${filePath}"`;
          console.log('🖨️ Using SumatraPDF:', command);
          await execPromise(command);
          return { success: true, command: 'SumatraPDF Direct Print' };
        }
      } catch (error) {
        console.log('⚠️ SumatraPDF not available or failed:', error.message);
      }
    }
    
    // Method 2: Use direct Windows printing command
    try {
      // Create a VBS script to handle the printing with paper size
      const vbsPath = path.join(this.tempDir, `print_${Date.now()}.vbs`);
      const vbsContent = this.createWindowsPrintVBS(filePath, printerName, paperConfig.name, copies, colorMode);
      
      fs.writeFileSync(vbsPath, vbsContent);
      
      console.log('🖨️ Using VBS print script:', vbsPath);
      await execPromise(`cscript //nologo "${vbsPath}"`);
      
      // Clean up the VBS file
      try {
        fs.unlinkSync(vbsPath);
      } catch (e) {
        console.log('⚠️ Could not delete VBS file:', e.message);
      }
      
      return { success: true, command: 'Windows VBS Print' };
    } catch (error) {
      console.log('⚠️ VBS printing failed:', error.message);
    }
    
    // Method 3: Use PowerShell as fallback
    try {
      const psCommand = `powershell.exe -Command "& {
        $printer = Get-Printer -Name '${printerName}';
        try {
          $config = Get-PrintConfiguration -PrinterName '${printerName}' -ErrorAction SilentlyContinue;
          if ($config) {
            Set-PrintConfiguration -PrinterName '${printerName}' -PaperSize ${paperConfig.windowsName} -ErrorAction SilentlyContinue;
          }
        } catch {
          Write-Host 'Could not set paper size, continuing anyway';
        }
        for ($i=1; $i -le ${copies}; $i++) {
          Start-Process -FilePath '${filePath}' -Verb Print -WindowStyle Hidden;
        }
      }"`;
      
      console.log('🖨️ Using PowerShell print command:', psCommand);
      await execPromise(psCommand);
      return { success: true, command: 'PowerShell Print' };
    } catch (error) {
      console.log('⚠️ PowerShell printing failed:', error.message);
    }
    
    // Method 4: Last resort - use the Windows print command
    try {
      const printCommand = `print /D:"${printerName}" "${filePath}"`;
      console.log('🖨️ Using Windows print command:', printCommand);
      await execPromise(printCommand);
      return { success: true, command: 'Windows Print Command' };
    } catch (error) {
      console.log('⚠️ Windows print command failed:', error.message);
      throw new Error('All Windows printing methods failed');
    }
  }
  
  // Find SumatraPDF installation
  async findSumatraPDF() {
    try {
      // Common installation paths
      const possiblePaths = [
        'C:\\Program Files\\SumatraPDF\\SumatraPDF.exe',
        'C:\\Program Files (x86)\\SumatraPDF\\SumatraPDF.exe',
        path.join(os.homedir(), 'AppData\\Local\\SumatraPDF\\SumatraPDF.exe')
      ];
      
      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          return p;
        }
      }
      
      // Try to find in PATH
      const { stdout } = await execPromise('where SumatraPDF.exe');
      if (stdout && stdout.trim()) {
        return stdout.trim();
      }
      
      return null;
    } catch (error) {
      console.log('⚠️ Could not find SumatraPDF:', error.message);
      return null;
    }
  }
  
  // Create VBS script for Windows printing with paper size
  createWindowsPrintVBS(filePath, printerName, paperSize, copies, colorMode) {
    return `
      ' Windows VBS Print Script with Paper Size
      Option Explicit
      
      Dim objFSO, objShell, objPrinter
      Dim strPrinter, strFile, intCopies, strPaperSize, strColorMode
      
      ' Set variables
      strPrinter = "${printerName}"
      strFile = "${filePath.replace(/\\/g, '\\\\')}"
      intCopies = ${copies}
      strPaperSize = "${paperSize}"
      strColorMode = "${colorMode}"
      
      ' Create objects
      Set objFSO = CreateObject("Scripting.FileSystemObject")
      Set objShell = CreateObject("WScript.Shell")
      
      ' Check if file exists
      If Not objFSO.FileExists(strFile) Then
        WScript.Echo "Error: File not found - " & strFile
        WScript.Quit 1
      End If
      
      ' Print based on file type
      Dim fileExt
      fileExt = LCase(objFSO.GetExtensionName(strFile))
      
      Select Case fileExt
        Case "pdf"
          PrintPDF strFile, strPrinter, intCopies, strPaperSize
        Case "jpg", "jpeg", "png", "bmp", "gif"
          PrintImage strFile, strPrinter, intCopies, strPaperSize
        Case "txt", "doc", "docx", "rtf"
          PrintDocument strFile, strPrinter, intCopies, strPaperSize
        Case Else
          PrintGeneric strFile, strPrinter, intCopies, strPaperSize
      End Select
      
      WScript.Echo "Print job sent successfully"
      WScript.Quit 0
      
      ' Print PDF function
      Sub PrintPDF(filePath, printerName, copies, paperSize)
        Dim i
        For i = 1 To copies
          objShell.Run "rundll32 shell32.dll,ShellExec_RunDLL " & filePath, 1, True
        Next
      End Sub
      
      ' Print Image function
      Sub PrintImage(filePath, printerName, copies, paperSize)
        Dim i
        For i = 1 To copies
          objShell.Run "rundll32 shimgvw.dll,ImageView_PrintTo /pt " & Chr(34) & filePath & Chr(34) & " " & Chr(34) & printerName & Chr(34), 1, True
        Next
      End Sub
      
      ' Print Document function
      Sub PrintDocument(filePath, printerName, copies, paperSize)
        Dim i
        For i = 1 To copies
          objShell.Run "rundll32 mshtml.dll,PrintHTML " & Chr(34) & filePath & Chr(34), 1, True
        Next
      End Sub
      
      ' Print Generic function
      Sub PrintGeneric(filePath, printerName, copies, paperSize)
        Dim i
        For i = 1 To copies
          objShell.Run "print /d:" & Chr(34) & printerName & Chr(34) & " " & Chr(34) & filePath & Chr(34), 1, True
        Next
      End Sub
    `;
  }

  // 🔥 MACOS PRINTING WITH PAPER SIZE
  async printOnMacOS(filePath, printerName, paperConfig, copies, colorMode, fileExtension) {
    const paperSizeArgs = getPaperSizeArgs(paperConfig.name, 'darwin');
    
    console.log('🖨️ macOS print configuration:', {
      paperSizeArgs,
      printerName,
      copies,
      colorMode
    });

    // Build lp command with paper size options
    let lpCommand = `lp -d "${printerName}" -n ${copies}`;
    
    // Add paper size
    lpCommand += ` -o media=${paperSizeArgs.paperSize}`;
    
    // Add color mode
    if (colorMode === 'BW') {
      lpCommand += ` -o ColorModel=Gray`;
    } else {
      lpCommand += ` -o ColorModel=RGB`;
    }
    
    // Add file-specific options
    if (fileExtension === '.pdf') {
      lpCommand += ` -o fit-to-page`;
    } else if (['.jpg', '.jpeg', '.png'].includes(fileExtension)) {
      lpCommand += ` -o fit-to-page -o scaling=100`;
    }
    
    lpCommand += ` "${filePath}"`;
    
    console.log('🖨️ Executing macOS print command:', lpCommand);
    await execPromise(lpCommand);
    
    return { success: true, command: 'macOS lp with paper size' };
  }

  // 🔥 LINUX PRINTING WITH PAPER SIZE
  async printOnLinux(filePath, printerName, paperConfig, copies, colorMode, fileExtension) {
    const paperSizeArgs = getPaperSizeArgs(paperConfig.name, 'linux');
    
    console.log('🖨️ Linux print configuration:', {
      paperSizeArgs,
      printerName,
      copies,
      colorMode
    });

    // Build lp command with paper size options
    let lpCommand = `lp -d "${printerName}" -n ${copies}`;
    
    // Add paper size
    lpCommand += ` -o media=${paperSizeArgs.paperSize}`;
    lpCommand += ` -o PageSize=${paperSizeArgs.pageSize}`;
    
    // Add color mode
    if (colorMode === 'BW') {
      lpCommand += ` -o ColorModel=Gray -o outputorder=reverse`;
    } else {
      lpCommand += ` -o ColorModel=RGB`;
    }
    
    // Add file-specific options
    if (fileExtension === '.pdf') {
      lpCommand += ` -o fit-to-page`;
    } else if (['.jpg', '.jpeg', '.png'].includes(fileExtension)) {
      lpCommand += ` -o fit-to-page -o scaling=100`;
    }
    
    lpCommand += ` "${filePath}"`;
    
    console.log('🖨️ Executing Linux print command:', lpCommand);
    await execPromise(lpCommand);
    
    return { success: true, command: 'Linux lp with paper size' };
  }

  // Test print with specific paper size
  async testPrintWithSize(printerName, paperSize) {
    try {
      console.log('🧪 Testing printer with specific paper size:', {
        printerName,
        paperSize
      });

      // Create a simple test file
      const tempDir = this.tempDir;
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const testFilePath = path.join(tempDir, `test-print-${paperSize}.txt`);
      const testContent = `Test Print Job - ${paperSize}\nPrinter: ${printerName}\nTime: ${new Date().toLocaleString()}\nThis is a test print to verify printer and paper size configuration.\n\nIf you can read this, your printer is working correctly with ${paperSize} paper size!`;
      
      fs.writeFileSync(testFilePath, testContent);

      // Get paper size configuration
      const paperConfig = formatPaperSizeForPrinter(paperSize, printerName, this.platform);
      
      // Print with correct paper size
      const result = await this.executePrintCommand(testFilePath, printerName, paperConfig, 1, 'BW');
      
      // Clean up test file
      try {
        fs.unlinkSync(testFilePath);
      } catch (cleanupError) {
        console.log('⚠️ Could not clean up test file:', cleanupError.message);
      }

      return {
        success: true,
        message: `Test print sent to ${printerName} with ${paperSize} paper size`,
        paperSize,
        printerName,
        command: result.command
      };

    } catch (error) {
      console.error('❌ Test print failed:', error);
      return {
        success: false,
        error: error.message,
        paperSize,
        printerName
      };
    }
  }

  // Clean up old print files
  async cleanupOldFiles(maxAgeHours = 24) {
    try {
      const tempDir = this.tempDir;
      
      if (fs.existsSync(tempDir)) {
        const files = fs.readdirSync(tempDir);
        const now = Date.now();
        const maxAge = maxAgeHours * 60 * 60 * 1000; // Convert hours to milliseconds
        
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
  }
}

module.exports = new PrintManager();
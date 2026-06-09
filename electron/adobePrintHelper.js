/**
 * Adobe Acrobat GUI Print Automation
 * 
 * This module automates Adobe Acrobat to print PDFs while preserving vector graphics.
 * Adobe's GUI printing preserves vectors unlike CLI /t command which rasterizes.
 * 
 * Requirements:
 * - Adobe Acrobat DC installed
 * - Printer must be set as default in Adobe (first time manual setup required)
 */

const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Configuration - possible Adobe installation paths
const ADOBE_PATHS = [
  'C:\\Program Files\\Adobe\\Acrobat DC\\Acrobat\\Acrobat.exe',
  'C:\\Program Files (x86)\\Adobe\\Acrobat DC\\Acrobat\\Acrobat.exe',
  'C:\\Program Files\\Adobe\\Acrobat Reader DC\\Reader\\AcroRd32.exe',
  'C:\\Program Files (x86)\\Adobe\\Acrobat Reader DC\\Reader\\AcroRd32.exe'
];

/**
 * Find Adobe Acrobat executable
 */
function findAdobePath() {
  for (const adobePath of ADOBE_PATHS) {
    if (fs.existsSync(adobePath)) {
      console.log('[Adobe] Found at:', adobePath);
      return adobePath;
    }
  }
  return null;
}

/**
 * Build PowerShell script for printing via Adobe GUI
 * Uses a simple approach: open Adobe, wait, send Ctrl+P, wait, send Enter, wait, close
 */
function buildPrintScript(pdfPath, printerName, adobePath) {
  // Escape paths for PowerShell (single quotes)
  const escapedPdfPath = pdfPath.replace(/'/g, "''").replace(/\\/g, '\\\\');
  const escapedPrinterName = printerName.replace(/'/g, "''");
  const escapedAdobePath = adobePath.replace(/'/g, "''").replace(/\\/g, '\\\\');

  // Simple, robust PowerShell script
  const script = [
    'Add-Type -AssemblyName System.Windows.Forms',
    'Add-Type -AssemblyName Microsoft.VisualBasic',
    '',
    '# Configuration',
    "$adobePath = '" + escapedAdobePath + "'",
    "$pdfPath = '" + escapedPdfPath + "'",
    "$printerName = '" + escapedPrinterName + "'",
    '',
    'Write-Host "[Adobe Print] Starting automation..."',
    '',
    '# Set the target printer as default',
    'try {',
    '    $printers = Get-CimInstance -ClassName Win32_Printer',
    '    $targetPrinter = $printers | Where-Object { $_.Name -eq $printerName }',
    '    if ($targetPrinter) {',
    '        Invoke-CimMethod -InputObject $targetPrinter -MethodName SetDefaultPrinter | Out-Null',
    '        Write-Host "[Adobe Print] Set $printerName as default printer"',
    '    } else {',
    '        Write-Host "[Adobe Print] Printer $printerName not found, using current default"',
    '    }',
    '} catch {',
    '    Write-Host "[Adobe Print] Warning: Could not set default printer - $($_.Exception.Message)"',
    '}',
    '',
    '# Start Adobe with the PDF',
    'Write-Host "[Adobe Print] Opening PDF in Adobe..."',
    '$proc = Start-Process -FilePath $adobePath -ArgumentList "`"$pdfPath`"" -PassThru',
    '',
    '# Wait for Adobe to fully load (generous timeout for large PDFs)',
    'Write-Host "[Adobe Print] Waiting for Adobe to load..."',
    'Start-Sleep -Seconds 8',
    '',
    '# Try to bring Adobe window to foreground',
    'Write-Host "[Adobe Print] Bringing Adobe to foreground..."',
    'try {',
    '    [Microsoft.VisualBasic.Interaction]::AppActivate($proc.Id)',
    '} catch {',
    '    Write-Host "[Adobe Print] Warning: Could not activate window"',
    '}',
    'Start-Sleep -Seconds 1',
    '',
    '# Send Ctrl+P to open print dialog',
    'Write-Host "[Adobe Print] Opening print dialog (Ctrl+P)..."',
    "[System.Windows.Forms.SendKeys]::SendWait('^p')",
    'Start-Sleep -Seconds 3',
    '',
    '# Send Enter to confirm print with current settings',
    'Write-Host "[Adobe Print] Confirming print (Enter)..."',
    "[System.Windows.Forms.SendKeys]::SendWait('{ENTER}')",
    '',
    '# Wait for print job to be submitted',
    'Write-Host "[Adobe Print] Waiting for print job..."',
    'Start-Sleep -Seconds 5',
    '',
    '# Close Adobe: Ctrl+W (close doc) then Alt+F4 (close app)',
    'Write-Host "[Adobe Print] Closing Adobe..."',
    'try {',
    '    [Microsoft.VisualBasic.Interaction]::AppActivate($proc.Id)',
    '} catch {}',
    'Start-Sleep -Milliseconds 500',
    "[System.Windows.Forms.SendKeys]::SendWait('^w')",
    'Start-Sleep -Seconds 1',
    "[System.Windows.Forms.SendKeys]::SendWait('%{F4}')",
    'Start-Sleep -Seconds 2',
    '',
    '# If still running, force close',
    'if (-not $proc.HasExited) {',
    '    try {',
    '        $proc.Kill()',
    '        Write-Host "[Adobe Print] Force closed Adobe"',
    '    } catch {}',
    '} else {',
    '    Write-Host "[Adobe Print] Adobe closed"',
    '}',
    '',
    'Write-Host "[Adobe Print] Complete!"',
    'exit 0'
  ].join('\r\n');

  return script;
}

/**
 * Print a PDF using Adobe Acrobat GUI automation
 */
async function printWithAdobeGUI(pdfPath, printerName) {
  return new Promise((resolve) => {
    console.log('[Adobe] Starting GUI Print...');
    console.log('[Adobe] PDF:', pdfPath);
    console.log('[Adobe] Printer:', printerName);

    // Find Adobe
    const adobePath = findAdobePath();
    if (!adobePath) {
      return resolve({
        success: false,
        message: 'Adobe Acrobat/Reader not found. Please install Adobe Acrobat DC.'
      });
    }

    // Validate PDF exists
    if (!fs.existsSync(pdfPath)) {
      return resolve({
        success: false,
        message: 'PDF file not found: ' + pdfPath
      });
    }

    // Build PowerShell script
    const script = buildPrintScript(pdfPath, printerName, adobePath);

    // Write script to temp file
    const tempScriptPath = path.join(
      process.env.TEMP || 'C:\\Temp',
      'adobe_print_' + Date.now() + '.ps1'
    );

    try {
      fs.writeFileSync(tempScriptPath, script, 'utf8');
      console.log('[Adobe] Script written to:', tempScriptPath);
    } catch (err) {
      return resolve({
        success: false,
        message: 'Failed to create temp script: ' + err.message
      });
    }

    // Execute PowerShell script (not hidden - needs GUI access)
    const psProcess = spawn('powershell.exe', [
      '-ExecutionPolicy', 'Bypass',
      '-NoProfile',
      '-File', tempScriptPath
    ], {
      windowsHide: false,  // Must be visible for SendKeys to work
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let output = '';
    let errorOutput = '';

    psProcess.stdout.on('data', (data) => {
      const text = data.toString();
      output += text;
      console.log(text.trim());
    });

    psProcess.stderr.on('data', (data) => {
      const text = data.toString();
      errorOutput += text;
      console.error('[PS Error]', text.trim());
    });

    psProcess.on('close', (code) => {
      // Cleanup temp script
      try {
        fs.unlinkSync(tempScriptPath);
      } catch (e) { }

      if (code === 0) {
        resolve({
          success: true,
          message: 'Print job sent successfully via Adobe GUI'
        });
      } else {
        resolve({
          success: false,
          message: 'Adobe print failed with code ' + code + ': ' + (errorOutput || output)
        });
      }
    });

    psProcess.on('error', (err) => {
      try {
        fs.unlinkSync(tempScriptPath);
      } catch (e) { }

      resolve({
        success: false,
        message: 'Failed to start PowerShell: ' + err.message
      });
    });
  });
}

/**
 * Check if Adobe is available
 */
function isAdobeAvailable() {
  return findAdobePath() !== null;
}

module.exports = {
  printWithAdobeGUI,
  isAdobeAvailable,
  findAdobePath
};

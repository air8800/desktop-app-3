// PDF Print Manager
// Handles PDF printing with paper size detection and external PDF viewers

const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// Paths to common PDF readers
const ADOBE_PATHS = {
  win32: [
    'C:\\Program Files (x86)\\Adobe\\Acrobat Reader DC\\Reader\\AcroRd32.exe',
    'C:\\Program Files\\Adobe\\Acrobat Reader DC\\Reader\\AcroRd32.exe',
    'C:\\Program Files (x86)\\Adobe\\Acrobat DC\\Acrobat\\Acrobat.exe',
    'C:\\Program Files\\Adobe\\Acrobat DC\\Acrobat\\Acrobat.exe'
  ],
  darwin: [
    '/Applications/Adobe Acrobat Reader DC.app/Contents/MacOS/AdobeReader',
    '/Applications/Adobe Acrobat DC.app/Contents/MacOS/Acrobat'
  ],
  linux: [
    '/usr/bin/acroread',
    '/opt/Adobe/Reader/bin/acroread'
  ]
};

const SUMATRA_PATHS = {
  win32: [
    'C:\\Program Files\\SumatraPDF\\SumatraPDF.exe',
    'C:\\Program Files (x86)\\SumatraPDF\\SumatraPDF.exe',
    path.join(os.homedir(), 'AppData\\Local\\SumatraPDF\\SumatraPDF.exe')
  ]
};

// Temporary directory for extracted SumatraPDF
const TEMP_DIR = path.join(os.tmpdir(), 'xerox-print-manager');

// Ensure temp directory exists
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// Find installed PDF readers
const findPdfReaders = async () => {
  const readers = {
    adobe: null,
    sumatra: null,
    bundledSumatra: null
  };
  
  // Check for Adobe Reader/Acrobat
  const adobePaths = ADOBE_PATHS[process.platform] || [];
  for (const adobePath of adobePaths) {
    if (fs.existsSync(adobePath)) {
      readers.adobe = adobePath;
      break;
    }
  }
  
  // Check for SumatraPDF (Windows only)
  if (process.platform === 'win32') {
    const sumatraPaths = SUMATRA_PATHS.win32 || [];
    for (const sumatraPath of sumatraPaths) {
      if (fs.existsSync(sumatraPath)) {
        readers.sumatra = sumatraPath;
        break;
      }
    }
    
    // Check for bundled SumatraPDF
    const bundledPath = path.join(TEMP_DIR, 'SumatraPDF.exe');
    if (fs.existsSync(bundledPath)) {
      readers.bundledSumatra = bundledPath;
    }
  }
  
  return readers;
};

// Extract bundled SumatraPDF if needed
const ensureBundledSumatra = async () => {
  if (process.platform !== 'win32') {
    return null; // SumatraPDF is Windows-only
  }
  
  const bundledPath = path.join(TEMP_DIR, 'SumatraPDF.exe');
  
  // If already extracted, return the path
  if (fs.existsSync(bundledPath)) {
    return bundledPath;
  }
  
  try {
    // In a real implementation, you would extract the bundled SumatraPDF.exe
    // from your app's resources to the temp directory
    console.log('Would extract bundled SumatraPDF.exe to:', bundledPath);
    
    // For now, we'll just check if it's installed and use that
    const readers = await findPdfReaders();
    if (readers.sumatra) {
      // Copy the installed SumatraPDF to our temp directory
      fs.copyFileSync(readers.sumatra, bundledPath);
      console.log('Copied installed SumatraPDF to temp directory');
      return bundledPath;
    }
    
    console.log('SumatraPDF not found and no bundled version available');
    return null;
  } catch (error) {
    console.error('Error ensuring bundled SumatraPDF:', error);
    return null;
  }
};

// Print PDF with Adobe Reader
const printWithAdobe = async (filePath, printerName, paperSize, copies = 1) => {
  try {
    const readers = await findPdfReaders();
    
    if (!readers.adobe) {
      throw new Error('Adobe Reader/Acrobat not found');
    }
    
    let command;
    
    if (process.platform === 'win32') {
      // Windows command
      command = `"${readers.adobe}" /t "${filePath}" "${printerName}" "" ${paperSize}`;
      
      if (copies > 1) {
        // For multiple copies, we need to run the command multiple times
        // as Adobe Reader doesn't support copies parameter
        for (let i = 1; i < copies; i++) {
          await execPromise(command);
        }
      }
    } else if (process.platform === 'darwin') {
      // macOS command (limited options)
      command = `"${readers.adobe}" -print-to "${printerName}" "${filePath}"`;
      // macOS doesn't support paper size via command line
    } else {
      // Linux command
      command = `"${readers.adobe}" -print -printer "${printerName}" "${filePath}"`;
      // Linux doesn't support paper size via command line
    }
    
    console.log('Executing Adobe print command:', command);
    await execPromise(command);
    
    return {
      success: true,
      method: 'Adobe Reader/Acrobat',
      command
    };
  } catch (error) {
    console.error('Error printing with Adobe:', error);
    throw error;
  }
};

// Print PDF with SumatraPDF
const printWithSumatra = async (filePath, printerName, paperSize, copies = 1, colorMode = 'BW', printType = 'Single') => {
  try {
    if (process.platform !== 'win32') {
      throw new Error('SumatraPDF is only available on Windows');
    }

    const readers = await findPdfReaders();
    let sumatraPath = readers.sumatra || readers.bundledSumatra;

    // If SumatraPDF is not found, try to use bundled version
    if (!sumatraPath) {
      sumatraPath = await ensureBundledSumatra();
    }

    if (!sumatraPath) {
      throw new Error('SumatraPDF not found and bundled version not available');
    }

    // SumatraPDF command with full print settings including duplex
    const printSettings = `${copies}x,${paperSize},${colorMode === 'Color' ? 'color' : 'monochrome'},${printType === 'Double' ? 'duplex' : 'simplex'}`;
    const command = `"${sumatraPath}" -print-to "${printerName}" -print-settings "${printSettings}" -silent "${filePath}"`;

    console.log('Executing SumatraPDF print command:', command);
    await execPromise(command);

    return {
      success: true,
      method: 'SumatraPDF',
      command
    };
  } catch (error) {
    console.error('Error printing with SumatraPDF:', error);
    throw error;
  }
};

// Print PDF using the best available method
const printPdf = async (filePath, printerName, paperSize, copies = 1) => {
  try {
    console.log('🖨️ Printing PDF with paper size detection:', {
      filePath,
      printerName,
      paperSize,
      copies
    });
    
    // Find available PDF readers
    const readers = await findPdfReaders();
    console.log('Available PDF readers:', readers);
    
    // Try SumatraPDF first (Windows only)
    if (process.platform === 'win32' && (readers.sumatra || readers.bundledSumatra)) {
      try {
        return await printWithSumatra(filePath, printerName, paperSize, copies);
      } catch (error) {
        console.error('SumatraPDF printing failed, falling back to Adobe:', error);
      }
    }
    
    // Try Adobe Reader/Acrobat
    if (readers.adobe) {
      try {
        return await printWithAdobe(filePath, printerName, paperSize, copies);
      } catch (error) {
        console.error('Adobe printing failed:', error);
      }
    }
    
    // Fallback to system print command
    if (process.platform === 'win32') {
      // Windows print command
      const command = `print /d:"${printerName}" "${filePath}"`;
      console.log('Using Windows print command:', command);
      await execPromise(command);
      return {
        success: true,
        method: 'Windows Print Command',
        command
      };
    } else if (process.platform === 'darwin') {
      // macOS print command
      const command = `lp -d "${printerName}" -n ${copies} -o media=${paperSize} "${filePath}"`;
      console.log('Using macOS print command:', command);
      await execPromise(command);
      return {
        success: true,
        method: 'macOS lp Command',
        command
      };
    } else {
      // Linux print command
      const command = `lp -d "${printerName}" -n ${copies} -o media=${paperSize} "${filePath}"`;
      console.log('Using Linux print command:', command);
      await execPromise(command);
      return {
        success: true,
        method: 'Linux lp Command',
        command
      };
    }
  } catch (error) {
    console.error('All PDF printing methods failed:', error);
    throw new Error(`Failed to print PDF: ${error.message}`);
  }
};

// Create a test PDF file for testing
const createTestPdf = async () => {
  try {
    const testFilePath = path.join(TEMP_DIR, `test-print-${Date.now()}.txt`);
    const testContent = `
=======================================================
                TEST PRINT - ${new Date().toLocaleString()}
=======================================================

This is a test print to verify that your printer is working correctly.
If you can read this message, your printer is properly configured!

=======================================================
`;
    
    fs.writeFileSync(testFilePath, testContent);
    console.log('📝 Created test print file:', testFilePath);
    
    return testFilePath;
  } catch (error) {
    console.error('❌ Test print creation failed:', error);
    throw error;
  }
};

// Test print with PDF readers
const testPdfPrint = async (printerName, paperSize) => {
  try {
    // Create a test file
    const testFilePath = await createTestPdf();
    
    // Print the test file
    const result = await printPdf(testFilePath, printerName, paperSize, 1);
    
    return {
      ...result,
      testFilePath
    };
  } catch (error) {
    console.error('Test PDF print failed:', error);
    throw error;
  }
};

module.exports = {
  findPdfReaders,
  printPdf,
  testPdfPrint,
  ensureBundledSumatra
};
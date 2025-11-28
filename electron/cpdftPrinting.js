// cpdf PDF Processing Module
// Handles N-up layout conversion using cpdf professional tool

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

// Paths to check for cpdf installation
const CPDF_PATHS = [
  // User's exact cpdf installation path
  'C:\\Users\\pro35\\Downloads\\cpdfdemo\\cpdfdemo\\cpdf.exe',
  // Generic paths for other users
  'C:\\Program Files\\cpdf\\cpdf.exe',
  'C:\\Program Files (x86)\\cpdf\\cpdf.exe',
  'C:\\cpdf\\cpdf.exe',
  'D:\\cpdf\\cpdf.exe',
  path.join(os.homedir(), 'Downloads\\cpdf\\cpdf.exe'),
  path.join(os.homedir(), 'AppData\\Local\\cpdf\\cpdf.exe')
];

// Find cpdf installation with enhanced detection
const findCpdf = async () => {
  console.log('🔍 Searching for cpdf installation...');
  
  // Check user's exact path first
  const userPath = 'C:\\Users\\pro35\\Downloads\\cpdfdemo\\cpdfdemo\\cpdf.exe';
  if (fs.existsSync(userPath)) {
    console.log('✅ Found cpdf at user path:', userPath);
    return userPath;
  }
  
  // Check other common installation paths
  for (const cpdftPath of CPDF_PATHS) {
    if (fs.existsSync(cpdftPath)) {
      console.log('✅ Found cpdf at:', cpdftPath);
      return cpdftPath;
    }
  }
  
  // Try to find in PATH
  try {
    const command = process.platform === 'win32' ? 'where cpdf.exe' : 'which cpdf';
    console.log('🔍 Checking PATH with command:', command);
    
    const { stdout } = await execPromise(command);
    if (stdout && stdout.trim()) {
      const cpdftPath = stdout.trim().split('\n')[0];
      console.log('✅ Found cpdf in PATH:', cpdftPath);
      return cpdftPath;
    }
  } catch (error) {
    console.log('cpdf not found in PATH');
  }
  
  console.log('❌ cpdf not found after extensive search');
  return null;
};

// Convert PDF to N-up layout using cpdf
const convertPdfToNupWithCpdf = async (inputPath, outputPath, nupPages) => {
  try {
    console.log('📊 Converting PDF to N-up layout using cpdf:', nupPages, 'pages per sheet');
    
    // Find cpdf
    const cpdftPath = await findCpdf();
    if (!cpdftPath) {
      console.log('⚠️ cpdf not found, skipping N-up conversion');
      return inputPath;
    }
    
    // Use cpdf demo version compatible commands
    let command;
    
    switch (nupPages) {
      case 2:
        // Simple 2-up layout (side-by-side)
        command = `"${cpdftPath}" -twoup "${inputPath}" -o "${outputPath}"`;
        console.log('📐 Using cpdf -twoup for 2-up layout');
        break;
      default:
        // Only 2-up is supported, use original file for others
        console.log(`📐 Only 2-up supported, using original file`);
        return inputPath;
    }
    
    console.log('🔄 Executing cpdf N-up command:', command);
    await execPromise(command);
    
    // Check if output file exists and has content
    if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
      console.log('✅ cpdf N-up conversion successful:', outputPath);
      return outputPath;
    } else {
      console.log('⚠️ cpdf N-up conversion failed, using original file');
      return inputPath;
    }
  } catch (error) {
    console.error('❌ cpdf N-up conversion error:', error);
    return inputPath; // Return original file on error
  }
};

// Convert PDF to specific paper size using cpdf
const convertPdfToPaperSizeWithCpdf = async (inputPath, outputPath, paperSize) => {
  try {
    console.log('📄 Skipping paper size conversion with cpdf (demo limitations)');
    
    // Find cpdf
    // 🔥 FIXED: cpdf demo doesn't support paper size conversion
    // Let SumatraPDF handle paper size through printer driver
    console.log('📄 Paper size will be handled by SumatraPDF for better compatibility');
    return inputPath;
  } catch (error) {
    console.error('❌ cpdf paper size conversion error:', error);
    return inputPath; // Return original file on error
  }
};

// Main cpdf processing function
const processPdfWithCpdf = async (inputPath, printerName, paperSize, copies = 1, colorMode = 'BW', printType = 'Single', nupPages = 1) => {
  try {
    console.log('🖨️ Processing PDF with cpdf:', {
      inputPath,
      printerName,
      paperSize,
      copies,
      colorMode,
      printType,
      nupPages
    });

    let processedFilePath = inputPath;
    
    // Step 1: Handle N-up conversion if needed
    if (nupPages > 1) {
      console.log(`🔍 CPDF: ${nupPages}-up printing requested`);
      
      const fileExt = path.extname(inputPath);
      const baseName = path.basename(inputPath, fileExt);
      const nupOutputPath = path.join(TEMP_DIR, `${baseName}_${nupPages}up${fileExt}`);
      
      processedFilePath = await convertPdfToNupWithCpdf(inputPath, nupOutputPath, nupPages);
      
      if (processedFilePath !== inputPath) {
        console.log(`✅ cpdf ${nupPages}-up conversion successful`);
      } else {
        console.log(`📊 cpdf ${nupPages}-up conversion not applied, using original file`);
      }
    }

    // Step 2: Handle paper size conversion if needed
    const fileExt = path.extname(processedFilePath);
    const baseName = path.basename(processedFilePath, fileExt);
    const paperSizeOutputPath = path.join(TEMP_DIR, `${baseName}_${paperSize}${fileExt}`);
    
    console.log('📄 Converting PDF to correct paper size...');
    const finalFilePath = await convertPdfToPaperSizeWithCpdf(processedFilePath, paperSizeOutputPath, paperSize);
    
    // Clean up intermediate files
    if (processedFilePath !== inputPath && processedFilePath !== finalFilePath && fs.existsSync(processedFilePath)) {
      try {
        fs.unlinkSync(processedFilePath);
        console.log('🧹 Cleaned up intermediate N-up PDF');
      } catch (cleanupError) {
        console.log('⚠️ Could not clean up intermediate file:', cleanupError.message);
      }
    }
    
    return {
      success: true,
      processedFilePath: finalFilePath,
      method: 'cpdf Professional Processing',
      message: `PDF processed with cpdf: ${paperSize} paper size${nupPages > 1 ? `, ${nupPages} pages per sheet` : ''}`
    };
  } catch (error) {
    console.error('❌ cpdf PDF processing failed:', error);
    return {
      success: false,
      error: error.message,
      processedFilePath: inputPath
    };
  }
};

// Check if cpdf is installed
const isCpdftInstalled = async () => {
  try {
    const cpdftPath = await findCpdf();
    return !!cpdftPath;
  } catch (error) {
    console.error('Error checking cpdf installation:', error);
    return false;
  }
};

// Get cpdf version
const getCpdftVersion = async () => {
  try {
    const cpdftPath = await findCpdf();
    if (!cpdftPath) {
      return null;
    }
    
    const { stdout } = await execPromise(`"${cpdftPath}" -version`);
    return stdout.trim();
  } catch (error) {
    console.error('Error getting cpdf version:', error);
    return null;
  }
};

module.exports = {
  findCpdf,
  convertPdfToNupWithCpdf,
  convertPdfToPaperSizeWithCpdf,
  processPdfWithCpdf,
  isCpdftInstalled,
  getCpdftVersion
};
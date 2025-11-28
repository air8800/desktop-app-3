// Paper Size Configuration and Detection System
// This file contains all paper size definitions and printer configurations

const PAPER_SIZES = {
  // ISO A Series (Most common worldwide)
  'A3': {
    name: 'A3',
    width: 297,
    height: 420,
    unit: 'mm',
    windowsName: 'A3',
    macosName: 'iso-a3',
    linuxName: 'A3',
    printerCode: 'DMPAPER_A3',
    description: '297 × 420 mm',
    orientation: 'portrait'
  },
  'A4': {
    name: 'A4',
    width: 210,
    height: 297,
    unit: 'mm',
    windowsName: 'A4',
    macosName: 'iso-a4',
    linuxName: 'A4',
    printerCode: 'DMPAPER_A4',
    description: '210 × 297 mm',
    orientation: 'portrait'
  },
  'A5': {
    name: 'A5',
    width: 148,
    height: 210,
    unit: 'mm',
    windowsName: 'A5',
    macosName: 'iso-a5',
    linuxName: 'A5',
    printerCode: 'DMPAPER_A5',
    description: '148 × 210 mm',
    orientation: 'portrait'
  },
  
  // North American Sizes
  'Letter': {
    name: 'Letter',
    width: 8.5,
    height: 11,
    unit: 'in',
    windowsName: 'Letter',
    macosName: 'na-letter',
    linuxName: 'Letter',
    printerCode: 'DMPAPER_LETTER',
    description: '8.5 × 11 inches',
    orientation: 'portrait'
  },
  'Legal': {
    name: 'Legal',
    width: 8.5,
    height: 14,
    unit: 'in',
    windowsName: 'Legal',
    macosName: 'na-legal',
    linuxName: 'Legal',
    printerCode: 'DMPAPER_LEGAL',
    description: '8.5 × 14 inches',
    orientation: 'portrait'
  },
  'Executive': {
    name: 'Executive',
    width: 7.25,
    height: 10.5,
    unit: 'in',
    windowsName: 'Executive',
    macosName: 'na-executive',
    linuxName: 'Executive',
    printerCode: 'DMPAPER_EXECUTIVE',
    description: '7.25 × 10.5 inches',
    orientation: 'portrait'
  },
  'Tabloid': {
    name: 'Tabloid',
    width: 11,
    height: 17,
    unit: 'in',
    windowsName: 'Tabloid',
    macosName: 'na-ledger',
    linuxName: 'Tabloid',
    printerCode: 'DMPAPER_TABLOID',
    description: '11 × 17 inches',
    orientation: 'portrait'
  }
};

// Get paper size configuration for specific platform
const getPaperSizeForPlatform = (paperSize, platform = process.platform) => {
  const config = PAPER_SIZES[paperSize];
  if (!config) {
    console.warn(`Unknown paper size: ${paperSize}, defaulting to A4`);
    return PAPER_SIZES['A4'];
  }

  return {
    ...config,
    platformName: platform === 'win32' ? config.windowsName :
                  platform === 'darwin' ? config.macosName :
                  config.linuxName
  };
};

// Generate printer-specific paper size arguments
const getPaperSizeArgs = (paperSize, platform = process.platform) => {
  const config = getPaperSizeForPlatform(paperSize, platform);
  
  switch (platform) {
    case 'win32':
      return {
        paperSize: config.windowsName,
        width: config.width,
        height: config.height,
        unit: config.unit,
        printerCode: config.printerCode
      };
    
    case 'darwin':
      return {
        paperSize: config.macosName,
        mediaSize: `${config.width}x${config.height}${config.unit}`,
        width: config.width,
        height: config.height,
        unit: config.unit
      };
    
    default: // Linux
      return {
        paperSize: config.linuxName,
        pageSize: `${config.width}x${config.height}${config.unit}`,
        width: config.width,
        height: config.height,
        unit: config.unit
      };
  }
};

// Validate if paper size is supported
const isSupportedPaperSize = (paperSize) => {
  return Object.keys(PAPER_SIZES).includes(paperSize);
};

// Get all available paper sizes
const getAvailablePaperSizes = () => {
  return Object.keys(PAPER_SIZES).map(key => ({
    key,
    ...PAPER_SIZES[key]
  }));
};

// Convert paper size to printer-friendly format
const formatPaperSizeForPrinter = (paperSize, printerName, platform = process.platform) => {
  const config = getPaperSizeForPlatform(paperSize, platform);
  
  console.log(`📏 Formatting paper size for printer:`, {
    paperSize,
    printerName,
    platform,
    config
  });

  return config;
};

module.exports = {
  PAPER_SIZES,
  getPaperSizeForPlatform,
  getPaperSizeArgs,
  isSupportedPaperSize,
  getAvailablePaperSizes,
  formatPaperSizeForPrinter
};
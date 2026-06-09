const path = require('path');
const fs = require('fs');
const { is2PrinterAvailable, get2PrinterPath } = require('./nativePrintEngine');

console.log('--- 2Printer Detection Test ---');
console.log('__dirname:', __dirname);

// Test isDev = true
console.log('\nChecking isDev = true:');
const pathDev = get2PrinterPath(true);
const existsDev = is2PrinterAvailable(true);
console.log('Path:', pathDev);
console.log('Exists:', existsDev);

// Test isDev = false (Mocking resourcesPath)
console.log('\nChecking isDev = false:');
process.resourcesPath = path.join(__dirname, '..'); // Mock to root
try {
    const pathProd = get2PrinterPath(false);
    const existsProd = is2PrinterAvailable(false);
    console.log('Path:', pathProd);
    console.log('Exists:', existsProd);
} catch (e) {
    console.log('Error testing prod:', e.message);
}

console.log('--- End Test ---');

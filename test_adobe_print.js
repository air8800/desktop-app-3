/**
 * Test Adobe GUI Print Automation
 * 
 * Run with: node test_adobe_print.js
 */

const path = require('path');
const { printWithAdobeGUI, isAdobeAvailable, findAdobePath } = require(path.join(__dirname, 'electron', 'adobePrintHelper'));

async function test() {
    console.log('========================================');
    console.log('  Adobe GUI Print Automation Test');
    console.log('========================================\n');

    // Check Adobe availability
    console.log('Checking Adobe installation...');
    if (isAdobeAvailable()) {
        console.log(`✅ Adobe found at: ${findAdobePath()}\n`);
    } else {
        console.log('❌ Adobe not found!\n');
        process.exit(1);
    }

    // Test print
    const pdfPath = path.join(__dirname, 'final year ent optha(1).pdf');
    const printerName = 'asim';  // Your virtual printer

    console.log('Starting print test...');
    console.log(`PDF: ${pdfPath}`);
    console.log(`Printer: ${printerName}\n`);

    const result = await printWithAdobeGUI(pdfPath, printerName);

    console.log('\n========================================');
    console.log('  Test Result');
    console.log('========================================');
    console.log(`Success: ${result.success}`);
    console.log(`Message: ${result.message}`);

    if (result.success) {
        console.log('\n✅ Check your "asim" printer output folder!');
        console.log('   If file size is small (~1-3 MB), it worked!');
        console.log('   If file size is large (30+ MB), it still bloated.');
    }
}

test().catch(console.error);

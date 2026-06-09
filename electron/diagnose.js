const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// Mock isDev for path resolution
const isDev = true;

// Manually define detection logic to verify it matches nativePrintEngine.js
const get2PrinterPath = () => {
    const potentialDirs = [
        path.join(__dirname, '..', 'extraResources'),
        path.join(process.cwd(), 'extraResources'),
        'C:\\Users\\pro35\\Downloads\\desktop-app-3 3\\desktop-app-3\\extraResources'
    ];

    for (const dir of potentialDirs) {
        const fullPath = path.join(dir, '2Printer', '2Printer.exe');
        if (fs.existsSync(fullPath)) return fullPath;
    }
    return null;
};

const runTest = async () => {
    console.log('🔍 [DIAGNOSTIC] Starting Print Engine Check...');

    // 1. Check 2Printer Path
    const twoPrinterPath = get2PrinterPath();
    if (!twoPrinterPath) {
        console.error('❌ [DIAGNOSTIC] 2Printer NOT FOUND in expected paths.');
        return;
    }
    console.log(`✅ [DIAGNOSTIC] Found 2Printer at: ${twoPrinterPath}`);

    // 2. Check Permissions (Access Check)
    try {
        fs.accessSync(twoPrinterPath, fs.constants.X_OK);
        console.log('✅ [DIAGNOSTIC] 2Printer has execution permissions.');
        fs.accessSync(twoPrinterPath, fs.constants.R_OK);
        console.log('✅ [DIAGNOSTIC] 2Printer is readable.');
    } catch (e) {
        console.error('❌ [DIAGNOSTIC] Permission issue:', e.message);
    }

    // 3. Test Execution (Help Command)
    console.log('⏳ [DIAGNOSTIC] Attempting to run 2Printer -help...');
    try {
        const cmd = `"${twoPrinterPath}" -help`;
        console.log(`  > Command: ${cmd}`);
        const { stdout, stderr } = await execPromise(cmd, { timeout: 10000 });
        console.log('✅ [DIAGNOSTIC] 2Printer -help executed successfully.');
        console.log('  > stdout length:', stdout.length);
        if (stderr) console.log('  > stderr:', stderr);
    } catch (e) {
        console.error('❌ [DIAGNOSTIC] 2Printer -help FAILED.');
        console.error('  > Error:', e.message);
        if (e.stdout) console.log('  > stdout:', e.stdout);
        if (e.stderr) console.log('  > stderr:', e.stderr);
    }

    // 4. Test Dummy Print Command (Dry Run if possible, or just syntax check)
    // 2Printer doesn't have a verify-only mode, but we can try a command with missing file to see how it reacts
    console.log('⏳ [DIAGNOSTIC] Testing command handling (expecting "Source file not found")...');
    try {
        const dummyPdf = path.join(__dirname, 'non_existent.pdf');
        const cmd = `"${twoPrinterPath}" -src "${dummyPdf}" -prn "Microsoft Print to PDF" -options silent:yes`;
        await execPromise(cmd, { timeout: 10000 });
    } catch (e) {
        // We expect failure, but we want to see if it's "File not found" (good) or "Access Denied" (bad) or "Popup hang" (bad)
        console.log('ℹ️ [DIAGNOSTIC] Command output check:');
        console.log('  > Message:', e.message);
        const output = e.stdout || e.stderr || '';
        if (output.includes('Source file') || output.includes('not found')) {
            console.log('✅ [DIAGNOSTIC] 2Printer correctly reported missing file. Engine is working.');
        } else {
            console.log('⚠️ [DIAGNOSTIC] Unexpected error (might be okay if file missing):', output);
        }
    }

    console.log('🏁 [DIAGNOSTIC] Check complete.');
};

runTest();

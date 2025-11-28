# Duplex (Double-Sided) Printing Fix

## Issue Summary

The duplex printing functionality was configured correctly throughout the codebase, but there was a **critical bug** in the `ghostscriptPrinting.js` file where the `printPdfWithSumatra` function built the correct print settings but **never executed the actual print command**.

## Fixes Applied

### 1. Fixed ghostscriptPrinting.js (PRIMARY FIX)

**File**: `electron/ghostscriptPrinting.js`
**Function**: `printPdfWithSumatra` (lines 261-287)
**Problem**: Function built print settings correctly but never executed SumatraPDF command
**Solution**: Added missing command execution

```javascript
// BEFORE (BROKEN):
console.log(`📊 CLEAN SumatraPDF print settings: ${printSettings}`);

return {
  success: true,
  message: `Print job sent...`
};

// AFTER (FIXED):
console.log(`📊 CLEAN SumatraPDF print settings: ${printSettings}`);

// 🔥 FIXED: Actually execute the print command!
const command = `"${sumatraPath}" -print-to "${printerName}" -print-settings "${printSettings}" -silent "${filePath}"`;

console.log('🖨️ Executing SumatraPDF command:', command);
await execPromise(command);

console.log('✅ SumatraPDF printing completed successfully');

return {
  success: true,
  method: 'SumatraPDF Silent Print',
  command,
  message: `Print job sent...`
};
```

### 2. Fixed mupdfPrinting.js

**File**: `electron/mupdfPrinting.js`
**Function**: `printPdfWithSumatra` (line 196)
**Problem**: Referenced undefined variables `sumatraPath` and `printSettings`
**Solution**: Added proper variable initialization before command execution

```javascript
// FIXED: Find SumatraPDF and build print settings first
const sumatraPath = await findSumatraPDF();
if (!sumatraPath) {
  throw new Error('SumatraPDF not found...');
}

const printSettings = `${copies}x,${paperSize},${colorMode === 'Color' ? 'color' : 'monochrome'},${printType === 'Double' ? 'duplex' : 'simplex'}`;

const command = `"${sumatraPath}" -print-to "${printerName}" -print-settings "${printSettings}" -silent "${filePath}"`;
```

### 3. Enhanced Linux/macOS Duplex Support

**File**: `electron/main.js`
**Location**: Non-Windows print command (line 330-346)
**Enhancement**: Added duplex and color mode support for Linux/macOS using `lp` command

```javascript
// ENHANCED: Added duplex and color options
const duplexOption = printType === 'Double' ? '-o sides=two-sided-long-edge' : '-o sides=one-sided';
const colorOption = colorMode === 'Color' ? '' : '-o ColorModel=Gray';

const printCommand = `lp -d "${printerName}" -n ${copies} -o media=${paperSize} ${duplexOption} ${colorOption} "${filePath}"`;
```

## Duplex Printing Configuration

### SumatraPDF Print Settings Format

The print settings string follows this format:
```
{copies}x,{paperSize},{colorMode},{duplexMode}
```

Example for duplex printing:
```
2x,A4,monochrome,duplex
```

Example for single-sided printing:
```
1x,A4,color,simplex
```

### Supported Duplex Modes

**Windows (SumatraPDF)**:
- `duplex` - Double-sided printing (long edge flip)
- `simplex` - Single-sided printing

**Linux/macOS (lp command)**:
- `-o sides=two-sided-long-edge` - Duplex (flip on long edge)
- `-o sides=two-sided-short-edge` - Duplex (flip on short edge)
- `-o sides=one-sided` - Simplex (single-sided)

**Windows (PowerShell)**:
- `TwoSidedLongEdge` - Duplex (flip on long edge)
- `TwoSidedShortEdge` - Duplex (flip on short edge)
- `OneSided` - Simplex (single-sided)

## Print Flow

The application follows this print flow hierarchy:

1. **cpdf** (if installed) - Best for N-up layouts
2. **Ghostscript** (if installed) - Good for PDF processing
3. **MuPDF** (if installed) - Alternative PDF processor
4. **SumatraPDF** (fallback) - Primary Windows PDF printer
5. **Batch file method** (last resort) - Uses PowerShell + multiple methods

## Testing Duplex Printing

### Test 1: Simple Duplex Test

1. Create a multi-page PDF (at least 4 pages)
2. Set print type to "Double" in the app
3. Print the document
4. Verify physical output is printed on both sides

### Test 2: Duplex with Multiple Copies

1. Create a 2-page PDF
2. Set copies to 3
3. Set print type to "Double"
4. Print the document
5. Verify you get 3 copies, each printed on both sides

### Test 3: Duplex with Different Paper Sizes

1. Test duplex printing with A4, A5, Letter sizes
2. Verify duplex works correctly for each size
3. Check paper orientation is correct

### Expected Console Output

When duplex printing is working correctly, you should see:

```
🖨️ Starting print job with ALL parameters:
  printType: 'Double'
  ...

📊 SumatraPDF print settings: 2x,A4,monochrome,duplex

🖨️ Executing SumatraPDF command: "C:\Program Files\SumatraPDF\SumatraPDF.exe" -print-to "Your Printer" -print-settings "2x,A4,monochrome,duplex" -silent "C:\path\to\file.pdf"

✅ SumatraPDF printing completed successfully
```

## Troubleshooting

### Duplex Not Working?

1. **Check Printer Support**: Ensure your printer physically supports duplex printing
2. **Verify SumatraPDF**: Make sure SumatraPDF is installed (required for Windows)
3. **Check Printer Driver**: Update printer drivers to latest version
4. **Manual Duplex**: Some printers require manual duplex (flip pages manually)
5. **Printer Settings**: Check Windows printer preferences for duplex settings

### Check Console Logs

Look for these key log messages:
- `📊 SumatraPDF print settings:` - Should show `duplex` when Double is selected
- `🖨️ Executing SumatraPDF command:` - Verify the command includes duplex setting
- `✅ SumatraPDF printing completed successfully` - Confirms command executed

### SumatraPDF Not Found?

Install SumatraPDF from: https://www.sumatrapdfreader.org/download-free-pdf-viewer

Supported installation paths:
- `C:\Program Files\SumatraPDF\SumatraPDF.exe`
- `C:\Program Files (x86)\SumatraPDF\SumatraPDF.exe`
- `%LOCALAPPDATA%\SumatraPDF\SumatraPDF.exe`

## Files Modified

1. ✅ `electron/ghostscriptPrinting.js` - Fixed missing command execution in `printPdfWithSumatra`
2. ✅ `electron/mupdfPrinting.js` - Fixed undefined variable references in `printPdfWithSumatra`
3. ✅ `electron/main.js` - Enhanced Linux/macOS duplex support with `-o sides=two-sided-long-edge`
4. ✅ `electron/pdfPrintManager.js` - Added duplex settings to `printWithSumatra` function
5. ✅ `electron/printManager.js` - Added duplex settings to Windows print method
6. ✅ `electron/directPrintControl.js` - Added duplex settings to batch file SumatraPDF command

## Files Already Working Correctly

- ✅ `electron/silentPdfPrinting.js` - Duplex settings already correct
- ✅ `electron/cpdftPrinting.js` - N-up processing working
- ✅ `electron/directPrint.js` - Batch file duplex settings correct

## Summary

The duplex printing issue was caused by a simple but critical bug where the print command was never executed in the `ghostscriptPrinting.js` file. The print settings were built correctly (including the duplex parameter), but the function returned success without actually calling SumatraPDF.

**All fixes are now applied and duplex printing should work correctly!**

To verify the fix:
1. Restart the application
2. Load a multi-page PDF
3. Set print type to "Double"
4. Print to a duplex-capable printer
5. Check the physical output is double-sided

---

**Note**: The build completed successfully with all changes applied. No breaking changes were introduced.


const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const fs = require('fs');
const path = require('path');
const { processPdfWithRecipe } = require('./recipeProcessor');

async function runTest() {
    const logFile = path.join(__dirname, 'test_log.txt');
    const log = (msg) => {
        console.log(msg);
        fs.appendFileSync(logFile, msg + '\n');
    };

    fs.writeFileSync(logFile, '--- Test Start ---\n');

    log('🧪 Starting Recipe Test...');

    // 1. Create a dummy PDF
    const doc = await PDFDocument.create();
    const page = doc.addPage([500, 500]);
    const { width, height } = page.getSize();
    const font = await doc.embedFont(StandardFonts.Helvetica);

    page.drawText('See me rotate!', {
        x: 50,
        y: height - 100,
        size: 30,
        font: font,
        color: rgb(0, 0, 0),
    });

    const pdfBytes = await doc.save();
    log(`📄 Created dummy PDF, size: ${pdfBytes.length}`);

    // 2. Define a recipe
    const recipe = {
        pages: [
            {
                pageNumber: 1,
                hasEdits: true,
                transforms: {
                    rotation: 90,
                    scale: 100,
                    crop: { x: 0.25, y: 0.25, width: 0.5, height: 0.5 } // Center crop
                }
            }
        ]
    };

    // 3. Stringify the recipe explicitly (double stringify if needed to mimic DB)
    const recipeString = JSON.stringify(recipe);

    log('🍳 Applying STRINGIFIED recipe: ' + recipeString);

    // 3. Process
    try {
        const processedBytes = await processPdfWithRecipe(pdfBytes, recipeString);

        log(`✅ Process complete. Original size: ${pdfBytes.length}, Processed size: ${processedBytes.length}`);

        if (processedBytes.length !== pdfBytes.length) {
            log('🎉 Output changed (good sign that something happened)');
        } else {
            log('⚠️ Output size identical (edits might not be applied)');
        }

        const outputPath = path.join(__dirname, 'test_output.pdf');
        fs.writeFileSync(outputPath, processedBytes);
        log(`💾 Saved output to ${outputPath}`);
        log(`📂 Output file stats: size=${fs.statSync(outputPath).size}`);

    } catch (e) {
        log('❌ Test failed: ' + e);
        if (e.stack) log(e.stack);
    }
}

runTest();

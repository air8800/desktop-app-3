/**
 * Recipe-based PDF Processor
 * Applies crop, rotation, and scale transformations from recipe using pdf-lib
 * Uses direct CTM injection (Metadata) to avoid embedding/re-rasterization.
 * NO NORMALIZATION - Original page sizes are preserved.
 */

const {
    PDFDocument,
    degrees,
    PDFName,
    PDFNumber,
    PDFArray,
    PDFOperator,
    PDFContentStream,
    asPDFNumber
} = require('pdf-lib');
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const http = require('http');

const TEMP_DIR = path.join(os.tmpdir(), 'xerox-processed-pdfs');

if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// Paper sizes (Reference only, not used for normalization)
const PAPER_SIZES = {
    'A3': { width: 841.89, height: 1190.55 },
    'A4': { width: 595.28, height: 841.89 },
    'Letter': { width: 612, height: 792 },
    'Legal': { width: 612, height: 1008 }
};

function getPaperSize(size) {
    return PAPER_SIZES[size] || PAPER_SIZES['A4'];
}

/**
 * Calculate transformation matrix for rotation/scale/centering
 */
function calculateTransformMatrix(rotation, scale, crop, origW, origH, pageW, pageH, pageX = 0, pageY = 0) {
    // 1. Center of content (User Crop or Full Image)
    let cx = origW / 2;
    let cy = origH / 2;

    if (crop) {
        cx = crop.x * origW + (crop.width * origW) / 2;
        cy = (1 - crop.y - crop.height) * origH + (crop.height * origH) / 2;
    }

    // 2. Determine scale factor
    const rad = -rotation * (Math.PI / 180);
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    // Bounding box of rotated content
    const contentW = crop ? crop.width * origW : origW;
    const contentH = crop ? crop.height * origH : origH;

    const isSwapped = (rotation === 90 || rotation === 270);
    const rotatedW = isSwapped ? contentH : contentW;
    const rotatedH = isSwapped ? contentW : contentH;

    // Auto-scale to fit page (if needed) - in this mode, pageW/H = origW/H usually
    let fitScale = 1.0;
    if (rotatedW > pageW || rotatedH > pageH) {
        fitScale = Math.min(pageW / rotatedW, pageH / rotatedH);
    }

    // Total Scale
    const finalScale = fitScale * scale;

    // 3. Matrix
    const a = finalScale * cos;
    const b = finalScale * sin;
    const c = finalScale * -sin;
    const d = finalScale * cos;

    // Target Center
    const tx = pageX + pageW / 2;
    const ty = pageY + pageH / 2;

    const e = tx - (a * cx + c * cy);
    const f = ty - (b * cx + d * cy);

    const fmt = (n) => Number(n.toFixed(4));
    return [fmt(a), fmt(b), fmt(c), fmt(d), fmt(e), fmt(f)];
}

/**
 * Apply transformations directly to the page using CTM (Current Transformation Matrix)
 * This modifies the existing content stream.
 */
function applyPageTransforms(page, recipePage, doc) {
    const transforms = recipePage.transforms || {};
    const mediaBox = page.getMediaBox();
    const origW = mediaBox.width;
    const origH = mediaBox.height;
    const pageX = mediaBox.x;
    const pageY = mediaBox.y;

    const rotation = transforms.rotation || 0;
    const scale = (transforms.scale || 100) / 100;
    const crop = transforms.crop;

    console.log(`📄 Applying Transforms (In-Place) to Page ${recipePage.pageNumber}:`, {
        rotation, scale, crop
    });

    // Calculate Matrix
    // We pass origW/H as pageW/H because we are transforming WITHIN the original page boundaries.
    const matrix = calculateTransformMatrix(rotation, scale, crop, origW, origH, origW, origH, pageX, pageY);

    const ops = [];

    // 1. CTM Injection (cm)
    console.log(`  🔄 Injecting Matrix: [${matrix.join(', ')}]`);
    ops.push(PDFOperator.of('cm', matrix.map(n => PDFNumber.of(n))));

    // 2. Clipping Path (for Crop)
    if (crop) {
        // Crop Rect in ORIGINAL coordinates
        const cropX = crop.x * origW;
        const cropY = (1 - crop.y - crop.height) * origH; // Flip Y? Usually yes.
        const cropW = crop.width * origW;
        const cropH = crop.height * origH;

        console.log(`  ✂️ Injecting Clip: x=${cropX.toFixed(1)}, y=${cropY.toFixed(1)}, w=${cropW.toFixed(1)}, h=${cropH.toFixed(1)}`);

        ops.push(PDFOperator.of('re', [
            asPDFNumber(cropX), asPDFNumber(cropY), asPDFNumber(cropW), asPDFNumber(cropH)
        ]));
        ops.push(PDFOperator.of('W')); // Clip
        ops.push(PDFOperator.of('n')); // End path (no stroke/fill)
    }

    // Prepend operators to the page content stream
    const contentStream = PDFContentStream.of(doc.context.obj({}), ops);
    const streamRef = doc.context.register(contentStream);
    const pageNode = page.node;
    const contents = pageNode.Contents();

    if (!contents) {
        pageNode.set(PDFName.of('Contents'), streamRef);
    } else if (contents instanceof PDFArray) {
        contents.insert(0, streamRef);
    } else {
        const newContents = doc.context.obj([streamRef, contents]);
        pageNode.set(PDFName.of('Contents'), newContents);
    }
}

async function processPdfWithRecipe(pdfBytes, recipe) {
    try {
        console.log('🔄 Processing PDF (Direct Mode - No Normalization)...');

        if (typeof recipe === 'string') {
            try { recipe = JSON.parse(recipe); } catch (e) { }
        }

        const doc = await PDFDocument.load(pdfBytes);
        const pageCount = doc.getPageCount();

        // Process only pages with edits
        if (recipe && recipe.pages) {
            for (const recipePage of recipe.pages) {
                if (!recipePage.hasEdits) continue;

                const idx = recipePage.pageNumber - 1;
                if (idx >= 0 && idx < pageCount) {
                    const page = doc.getPage(idx);
                    applyPageTransforms(page, recipePage, doc);
                }
            }
        }

        const resultBytes = await doc.save();
        console.log(`✅ Processed PDF size: ${(resultBytes.length / 1024).toFixed(1)}KB`);
        return resultBytes;

    } catch (e) {
        console.error('❌ Processing failed:', e);
        return pdfBytes;
    }
}

async function processRemotePdfWithRecipe(pdfSource, recipe) {
    try {
        let pdfBytes;
        const isLocalFile = pdfSource.match(/^[A-Za-z]:[\\/]/) || pdfSource.startsWith('/');

        if (!isLocalFile) throw new Error('Recipe processor only accepts local file paths.');
        if (!fs.existsSync(pdfSource)) throw new Error(`Local file not found: ${pdfSource}`);

        console.log('📁 [RECIPE] Processing local file:', pdfSource);
        pdfBytes = fs.readFileSync(pdfSource);

        if (typeof recipe === 'string') {
            try { recipe = JSON.parse(recipe); } catch (e) { }
        }

        const processedBytes = await processPdfWithRecipe(pdfBytes, recipe);

        const timestamp = Date.now();
        const outputPath = path.join(TEMP_DIR, `processed_${timestamp}.pdf`);
        fs.writeFileSync(outputPath, processedBytes);

        return { success: true, processedPath: outputPath, processed: true };

    } catch (error) {
        console.error('❌ Remote PDF processing failed:', error);
        return { success: false, error: error.message };
    }
}

function cleanupProcessedPdfs() {
    try {
        if (!fs.existsSync(TEMP_DIR)) return;
        const files = fs.readdirSync(TEMP_DIR);
        const now = Date.now();
        const maxAge = 60 * 60 * 1000;
        for (const file of files) {
            const filePath = path.join(TEMP_DIR, file);
            if (now - fs.statSync(filePath).mtime.getTime() > maxAge) fs.unlinkSync(filePath);
        }
    } catch (error) { console.error('⚠️ Cleanup error:', error); }
}

module.exports = {
    processPdfWithRecipe,
    processRemotePdfWithRecipe,
    cleanupProcessedPdfs,
    getPaperSize,
    PAPER_SIZES
};

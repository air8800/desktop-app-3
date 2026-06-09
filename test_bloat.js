
const { PDFDocument, degrees, StandardFonts, rgb } = require('pdf-lib');
const fs = require('fs');

// Current implementation: Embedding inside loop
const resizePdfLoop = async (pdfBytes) => {
    const sourcePdf = await PDFDocument.load(pdfBytes);
    const newPdf = await PDFDocument.create();
    const sourcePages = sourcePdf.getPages();

    for (let i = 0; i < sourcePages.length; i++) {
        const sourcePage = sourcePages[i];
        const [embeddedPage] = await newPdf.embedPages([sourcePage]);
        const newPage = newPdf.addPage([595.28, 841.89]);
        newPage.drawPage(embeddedPage, { x: 0, y: 0, width: 595.28, height: 841.89 });
    }
    return await newPdf.save();
};

// Optimized implementation: Batch embedding
const resizePdfBatch = async (pdfBytes) => {
    const sourcePdf = await PDFDocument.load(pdfBytes);
    const newPdf = await PDFDocument.create();
    const sourcePages = sourcePdf.getPages();

    const embeddedPages = await newPdf.embedPages(sourcePages);

    for (let i = 0; i < sourcePages.length; i++) {
        const embeddedPage = embeddedPages[i];
        const newPage = newPdf.addPage([595.28, 841.89]);
        newPage.drawPage(embeddedPage, { x: 0, y: 0, width: 595.28, height: 841.89 });
    }
    return await newPdf.save();
};

// Compressed implementation: Batch embedding + Object Streams
const resizePdfCompressed = async (pdfBytes) => {
    const sourcePdf = await PDFDocument.load(pdfBytes);
    const newPdf = await PDFDocument.create();
    const sourcePages = sourcePdf.getPages();

    const embeddedPages = await newPdf.embedPages(sourcePages);

    for (let i = 0; i < sourcePages.length; i++) {
        const embeddedPage = embeddedPages[i];
        const newPage = newPdf.addPage([595.28, 841.89]);
        newPage.drawPage(embeddedPage, { x: 0, y: 0, width: 595.28, height: 841.89 });
    }
    return await newPdf.save({ useObjectStreams: false }); // Wait, default IS false? Let's try false explicit.
};

const resizePdfCompressedTrue = async (pdfBytes) => {
    const sourcePdf = await PDFDocument.load(pdfBytes);
    const newPdf = await PDFDocument.create();
    const sourcePages = sourcePdf.getPages();

    const embeddedPages = await newPdf.embedPages(sourcePages);

    for (let i = 0; i < sourcePages.length; i++) {
        const embeddedPage = embeddedPages[i];
        const newPage = newPdf.addPage([595.28, 841.89]);
        newPage.drawPage(embeddedPage, { x: 0, y: 0, width: 595.28, height: 841.89 });
    }
    return await newPdf.save({ useObjectStreams: true });
};

const runTest = async () => {
    console.log('🧪 Generating Multi-page PDF with shared resources...');
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);

    for (let i = 0; i < 5; i++) {
        const page = doc.addPage();
        page.drawText(`Page ${i + 1}`, { x: 50, y: 700, size: 50, font });
    }

    const inputBytes = await doc.save();
    fs.writeFileSync('test_input.pdf', inputBytes);
    console.log(`📦 Input size: ${inputBytes.length} bytes`);

    console.log('\n🔴 Loop Embedding:');
    const loopBytes = await resizePdfLoop(inputBytes);
    console.log(`   Size: ${loopBytes.length} bytes`);

    console.log('\n🟢 Batch Embedding:');
    const batchBytes = await resizePdfBatch(inputBytes);
    console.log(`   Size: ${batchBytes.length} bytes`);

    console.log('\n🔵 Batch + ObjectStreams=TRUE:');
    const compressedBytes = await resizePdfCompressedTrue(inputBytes);
    console.log(`   Size: ${compressedBytes.length} bytes`);
};

runTest();

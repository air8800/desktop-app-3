const fs = require('fs');
const { PDFDocument, StandardFonts, rgb, degrees } = require('pdf-lib');
const QRCode = require('qrcode');

function getDisplayId(mark = {}) {
  if (mark.shopOrderNumber != null && mark.shopOrderNumber > 0) {
    return 'ID - ' + mark.shopOrderNumber;
  }
  const shortId = mark.orderUuid ? String(mark.orderUuid).slice(0, 8) : '??';
  return 'ID - ' + shortId;
}

function getMode(mark = {}) {
  return mark.orderIdentification === 'SEPARATE_SLIP' ? 'SEPARATE_SLIP' : 'ON_PAGE';
}

const K = (v) => rgb(v, v, v);

async function fetchImageBytes(url) {
  if (!url || typeof url !== 'string') return null;
  try {
    const res = await fetch(url, { redirect: 'follow' });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    return new Uint8Array(buf);
  } catch (e) {
    return null;
  }
}

function truncateToWidth(text, font, size, maxWidth) {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && font.widthOfTextAtSize(t + '...', size) > maxWidth) {
    t = t.slice(0, -1);
  }
  return t + '...';
}

function wrapLines(text, font, size, maxWidth) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (font.widthOfTextAtSize(test, size) <= maxWidth) {
      line = test;
    } else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

/**
 * Customer-facing slip.
 * Thanks the customer, shows their order ID, teaches them how to
 * scan the QR and order again. Pure ASCII text only (Helvetica safe).
 * White background only - no fills that cost extra ink.
 */
async function drawBrandedSlipPage(pdfDoc, slip, w, h, label, branding) {
  branding = branding || {};

  const font     = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const scale   = Math.min(1.12, Math.max(0.82, h / 842));
  const margin  = 32 * scale;
  const centerX = w / 2;

  // Grayscale palette - white bg only (no gray fills = saves ink)
  const inkBlack = K(0.06);
  const inkDark  = K(0.20);
  const inkMid   = K(0.38);
  const inkLight = K(0.56);
  const inkRule  = K(0.80);

  // White page
  slip.drawRectangle({ x: 0, y: 0, width: w, height: h, color: K(1), borderWidth: 0 });

  const shopName   = ((branding.shopName   || 'Shop').trim()) || 'Shop';
  const shopWebUrl = (branding.shopWebUrl  || '').trim();
  const qrImageUrl = (branding.qrImageUrl  || '').trim();

  // Generate QR code - ASCII-safe URL
  let qrBytes = null;
  if (qrImageUrl) {
    try { qrBytes = await fetchImageBytes(qrImageUrl); } catch (e) {}
  }
  if (!qrBytes && shopWebUrl) {
    try {
      qrBytes = await QRCode.toBuffer(shopWebUrl, {
        type: 'png', errorCorrectionLevel: 'M', margin: 1, width: 400,
        color: { dark: '#000000', light: '#FFFFFF' },
      });
    } catch (e) {}
  }

  // ---- TOP-DOWN LAYOUT (y starts at top, decreases) ----------------------
  let y = h - margin;

  // == HEADER: PrintGet first (brand), then shop name below ==================
  slip.drawText('PrintGet', { x: margin, y, size: 20 * scale, font: fontBold, color: inkBlack });
  y -= 20 * scale;
  const shopDisplay = truncateToWidth(`Printing Partner: ${shopName}`, fontBold, 12 * scale, w - 2 * margin);
  slip.drawText(shopDisplay, { x: margin, y, size: 12 * scale, font: fontBold, color: inkDark });
  y -= 15 * scale;
  slip.drawText('printget.in', { x: margin, y, size: 8 * scale, font, color: inkLight });
  y -= 11 * scale;
  slip.drawRectangle({ x: margin, y, width: w - 2 * margin, height: 0.8 * scale, color: inkRule, borderWidth: 0 });
  y -= 24 * scale;

  // == ORDER ID BOX ==========================================================
  const tagText = 'YOUR ORDER';
  const tagSize = 7.5 * scale;
  slip.drawText(tagText, {
    x: centerX - fontBold.widthOfTextAtSize(tagText, tagSize) / 2,
    y, size: tagSize, font: fontBold, color: inkLight,
  });
  y -= 10 * scale;

  // Border-only box: white fill = zero extra ink
  const idSize = 34 * scale;
  const idW    = fontBold.widthOfTextAtSize(label, idSize);
  const bpx    = 24 * scale;
  const bpy    = 11 * scale;
  const boxW   = Math.max(idW + bpx * 2, 190 * scale);
  const boxH   = idSize + bpy * 2;
  const boxX   = centerX - boxW / 2;
  const boxY   = y - boxH;

  slip.drawRectangle({ x: boxX, y: boxY, width: boxW, height: boxH, color: K(1), borderWidth: 1.2, borderColor: K(0.65) });
  slip.drawText(label, {
    x: centerX - idW / 2,
    y: boxY + bpy + idSize * 0.22,
    size: idSize, font: fontBold, color: inkBlack,
  });
  y = boxY - 16 * scale;

  // Shop name below box
  const sLine = truncateToWidth(shopName, fontBold, 11 * scale, w - 2 * margin);
  slip.drawText(sLine, {
    x: centerX - fontBold.widthOfTextAtSize(sLine, 11 * scale) / 2,
    y, size: 11 * scale, font: fontBold, color: inkMid,
  });
  y -= 22 * scale;

  slip.drawRectangle({ x: margin, y, width: w - 2 * margin, height: 0.8 * scale, color: inkRule, borderWidth: 0 });
  y -= 24 * scale;

  // == THANK YOU =============================================================
  const thankText = 'Thank you for choosing us!';
  slip.drawText(thankText, {
    x: centerX - fontBold.widthOfTextAtSize(thankText, 12 * scale) / 2,
    y, size: 12 * scale, font: fontBold, color: inkBlack,
  });
  y -= 16 * scale;

  const subText = 'Print without waiting in line - order online, collect here.';
  const subSize = 9 * scale;
  slip.drawText(subText, {
    x: centerX - font.widthOfTextAtSize(subText, subSize) / 2,
    y, size: subSize, font, color: inkMid,
  });
  y -= 26 * scale;

  // == HOW TO ORDER AGAIN ====================================================
  slip.drawText('How to order next time - it\'s simple:', { x: margin, y, size: 10 * scale, font: fontBold, color: inkDark });
  y -= 17 * scale;

  const steps = [
    '1.  Open your phone camera and scan the QR code on this slip.',
    '2.  Upload your file - PDF, photo, Word doc, anything works.',
    '3.  Choose paper size, colour mode and number of copies.',
    '4.  Pay and come collect. No queues, no waiting around!',
  ];
  const stepSize = 9 * scale;
  const stepLead = 14 * scale;
  for (const step of steps) {
    const lines = wrapLines(step, font, stepSize, w - 2 * margin);
    for (let i = 0; i < lines.length; i++) {
      slip.drawText(lines[i], {
        x: margin + (i === 0 ? 0 : 18 * scale),
        y, size: stepSize, font, color: inkMid,
      });
      y -= stepLead;
    }
    y -= 2 * scale;
  }

  y -= 8 * scale;

  // == WHY PRINTGET ==========================================================
  slip.drawText('Why print through PrintGet?', { x: margin, y, size: 10 * scale, font: fontBold, color: inkDark });
  y -= 16 * scale;

  const reasons = [
    '* No WhatsApp back-and-forth - upload directly, pay online.',
    '* Order from anywhere - home, office, on the go.',
    '* Your file is saved safely - reprint anytime you need.',
    '* Track your order status live from your phone.',
  ];
  const rSize = 9 * scale;
  const rLead = 13 * scale;
  for (const r of reasons) {
    const lines = wrapLines(r, font, rSize, w - 2 * margin);
    for (const ln of lines) {
      slip.drawText(ln, { x: margin, y, size: rSize, font, color: inkMid });
      y -= rLead;
    }
    y -= 2 * scale;
  }

  y -= 12 * scale;
  slip.drawRectangle({ x: margin, y, width: w - 2 * margin, height: 0.8 * scale, color: inkRule, borderWidth: 0 });
  y -= 22 * scale;

  // == SCAN QR SECTION =======================================================
  const qrSize  = 115 * scale;
  const qrX     = w - margin - qrSize;
  const qrBot   = y - qrSize;
  const ctaColW = qrX - margin - 12 * scale;
  const ctaMidY = qrBot + qrSize / 2;

  let fy = ctaMidY + 18 * scale;
  slip.drawText('Scan to order again >', { x: margin, y: fy, size: 11 * scale, font: fontBold, color: inkBlack });
  fy -= 15 * scale;
  slip.drawText('Point your phone camera', { x: margin, y: fy, size: 8.5 * scale, font, color: inkMid });
  fy -= 12 * scale;
  slip.drawText('at the QR code to begin.', { x: margin, y: fy, size: 8.5 * scale, font, color: inkMid });
  fy -= 16 * scale;

  if (shopWebUrl) {
    const cleaned = shopWebUrl.replace(/^https?:\/\//, '');
    const urlLines = wrapLines(cleaned, font, 7.5 * scale, ctaColW);
    for (const ln of urlLines.slice(0, 2)) {
      slip.drawText(ln, { x: margin, y: fy, size: 7.5 * scale, font, color: inkLight });
      fy -= 11 * scale;
    }
  }

  // QR code image (border-only frame, white fill)
  if (qrBytes) {
    slip.drawRectangle({
      x: qrX - 3, y: qrBot - 3,
      width: qrSize + 6, height: qrSize + 6,
      borderWidth: 0.8, borderColor: K(0.78), color: K(1),
    });
    try {
      const png = await pdfDoc.embedPng(qrBytes);
      slip.drawImage(png, { x: qrX, y: qrBot, width: qrSize, height: qrSize });
    } catch (e) {
      try {
        const jpg = await pdfDoc.embedJpg(qrBytes);
        slip.drawImage(jpg, { x: qrX, y: qrBot, width: qrSize, height: qrSize });
      } catch (e2) {
        console.warn('Could not embed QR image:', e2.message);
      }
    }
  }
}

/**
 * Stamp pickup order ID on PDF before printing.
 * ON_PAGE:      small label at bottom-right of every page.
 * SEPARATE_SLIP: insert customer-facing slip as page 1.
 */
async function applyOrderIdentificationToPdfBytes(pdfBytes, mark, paperSize) {
  mark = mark || {};
  paperSize = paperSize || 'A4';

  const mode  = getMode(mark);
  const label = getDisplayId(mark);

  if (!label || label === 'ID - ??') {
    return pdfBytes;
  }

  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const font   = await pdfDoc.embedFont(StandardFonts.Helvetica);

  if (mode === 'SEPARATE_SLIP') {
    const sizes = {
      A3:     [841.89, 1190.55],
      A4:     [595.28, 841.89],
      Letter: [612, 792],
      Legal:  [612, 1008],
    };
    const [w, h] = sizes[paperSize] || sizes.A4;
    const slip = pdfDoc.insertPage(0, [w, h]);
    await drawBrandedSlipPage(pdfDoc, slip, w, h, label, mark.slipBranding || {});
  } else {
    const pages    = pdfDoc.getPages();
    const fontSize = 8;
    const inkCorner = K(0.42);
    for (const page of pages) {
      const { width } = page.getSize();
      const textWidth = font.widthOfTextAtSize(label, fontSize);
      const inset = 2;
      const x = Math.max(inset, width - textWidth - inset);
      const y = inset;
      page.drawText(label, { x, y, size: fontSize, font, color: inkCorner, rotate: degrees(0) });
    }
  }

  return pdfDoc.save({ useObjectStreams: true });
}

async function applyOrderIdentificationToFile(filePath, mark, paperSize) {
  mark = mark || {};
  paperSize = paperSize || 'A4';

  if (!filePath || !fs.existsSync(filePath)) {
    return { success: false, error: 'File not found', outputPath: filePath };
  }

  try {
    const inputBytes  = fs.readFileSync(filePath);
    const outputBytes = await applyOrderIdentificationToPdfBytes(inputBytes, mark, paperSize);
    fs.writeFileSync(filePath, outputBytes);
    return { success: true, outputPath: filePath, mode: getMode(mark), label: getDisplayId(mark) };
  } catch (error) {
    console.error('Order identification mark failed:', error);
    return { success: false, error: error.message, outputPath: filePath };
  }
}

module.exports = {
  applyOrderIdentificationToFile,
  applyOrderIdentificationToPdfBytes,
  getDisplayId,
};

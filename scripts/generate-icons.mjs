/**
 * Generates Windows/macOS/Linux icons from public/favicon.svg
 * Run: node scripts/generate-icons.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const svgPath = path.join(root, "public", "favicon.svg");
const outDir = path.join(root, "build", "icons");
const electronAssets = path.join(root, "electron", "assets");

/** NSIS requires uncompressed 24-bit BMP at exact dimensions. */
async function writeBmp24(sharp, pngBuffer, filePath, width, height) {
  const { data, info } = await sharp(pngBuffer)
    .resize(width, height, { fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const rowSize = Math.ceil((info.width * 3) / 4) * 4;
  const pixelDataSize = rowSize * info.height;
  const fileSize = 54 + pixelDataSize;
  const buf = Buffer.alloc(fileSize);

  buf.write("BM", 0);
  buf.writeUInt32LE(fileSize, 2);
  buf.writeUInt32LE(54, 10);
  buf.writeUInt32LE(40, 14);
  buf.writeInt32LE(info.width, 18);
  buf.writeInt32LE(info.height, 22);
  buf.writeUInt16LE(1, 26);
  buf.writeUInt16LE(24, 28);
  buf.writeUInt32LE(pixelDataSize, 34);

  let offset = 54;
  for (let y = info.height - 1; y >= 0; y--) {
    let written = 0;
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * 3;
      buf[offset++] = data[i + 2];
      buf[offset++] = data[i + 1];
      buf[offset++] = data[i];
      written += 3;
    }
    while (written < rowSize) {
      buf[offset++] = 0;
      written++;
    }
  }

  fs.writeFileSync(filePath, buf);
}

async function main() {
  let sharp;
  try {
    sharp = (await import("sharp")).default;
  } catch {
    console.error("Install sharp first: npm install --save-dev sharp png-to-ico");
    process.exit(1);
  }

  const svg = fs.readFileSync(svgPath);
  fs.mkdirSync(outDir, { recursive: true });
  fs.mkdirSync(electronAssets, { recursive: true });

  const sizes = [16, 24, 32, 48, 64, 128, 256, 512];
  const pngBuffers = {};

  for (const size of sizes) {
    const buf = await sharp(svg).resize(size, size).png().toBuffer();
    pngBuffers[size] = buf;
    if (size === 512) {
      const png512 = path.join(outDir, "icon.png");
      fs.writeFileSync(png512, buf);
      fs.writeFileSync(path.join(electronAssets, "icon.png"), buf);
    }
  }

  try {
    const pngToIco = (await import("png-to-ico")).default;
    const icoSizes = [16, 24, 32, 48, 64, 128, 256].map((s) => pngBuffers[s]);
    const ico = await pngToIco(icoSizes);
    fs.writeFileSync(path.join(outDir, "icon.ico"), ico);
    fs.writeFileSync(path.join(electronAssets, "icon.ico"), ico);
    fs.writeFileSync(path.join(root, "build", "icon.ico"), ico);
  } catch (err) {
    console.warn("png-to-ico failed, copying 256px PNG as fallback:", err.message);
    fs.writeFileSync(path.join(outDir, "icon.ico"), pngBuffers[256]);
  }

  // App bundle + notifications (must live in public/ → dist/)
  fs.writeFileSync(path.join(root, "public", "icon.png"), pngBuffers[256]);

  // NSIS installer wizard art (exact sizes — avoids blurry stretched defaults)
  // 2x resolution for HiDPI + ManifestDPIAware (NSIS stretches to logical 164x314 / 150x57)
  const sidebarW = 328;
  const sidebarH = 628;
  const headerW = 300;
  const headerH = 114;

  const logo192 = await sharp(svg).resize(192, 192).png().toBuffer();
  const logo80 = await sharp(svg).resize(80, 80).png().toBuffer();

  const sidebarPng = await sharp({
    create: { width: sidebarW, height: sidebarH, channels: 3, background: { r: 37, g: 99, b: 235 } },
  })
    .composite([{ input: logo192, gravity: "center" }])
    .png()
    .toBuffer();

  const headerPng = await sharp({
    create: { width: headerW, height: headerH, channels: 3, background: { r: 255, g: 255, b: 255 } },
  })
    .composite([{ input: logo80, left: 20, top: 16 }])
    .png()
    .toBuffer();

  await writeBmp24(sharp, sidebarPng, path.join(root, "build", "installerSidebar.bmp"), sidebarW, sidebarH);
  await writeBmp24(sharp, headerPng, path.join(root, "build", "installerHeader.bmp"), headerW, headerH);

  console.log("Icons + NSIS installer graphics written (build/, electron/assets/, public/icon.png)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

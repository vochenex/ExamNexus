/**
 * Generate PWA + apple-touch icons from the ExamNexus website logo SVG.
 * Run: node scripts/gen-pwa-icons.mjs
 * Optional: node scripts/gen-pwa-icons.mjs <customSourcePath>
 */
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const outDir = resolve(root, "public", "icons");

const source = process.argv[2]
  ? resolve(process.argv[2])
  : resolve(outDir, "logo.svg");

// Brand background — matches the website shell (#031d1f).
const BG = { r: 3, g: 29, b: 31, alpha: 1 };

async function main() {
  await mkdir(outDir, { recursive: true });

  // Standard "any" icons — logo.svg already includes the brand background.
  for (const size of [192, 512]) {
    await sharp(source, { density: 300 })
      .resize(size, size, { fit: "cover" })
      .png()
      .toFile(resolve(outDir, `pwa-${size}.png`));
  }

  // Maskable icon: same logo, slightly more padding (re-render at 88% scale).
  const maskSize = 512;
  const inner = Math.round(maskSize * 0.88);
  const maskable = await sharp(source, { density: 300 })
    .resize(inner, inner, { fit: "cover" })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: maskSize,
      height: maskSize,
      channels: 4,
      background: BG,
    },
  })
    .composite([{ input: maskable, gravity: "centre" }])
    .png()
    .toFile(resolve(outDir, "pwa-maskable-512.png"));

  // Apple touch icon (180x180).
  await sharp(source, { density: 300 })
    .resize(180, 180, { fit: "cover" })
    .png()
    .toFile(resolve(outDir, "apple-touch-icon.png"));

  // Small favicons.
  for (const size of [32, 16]) {
    await sharp(source, { density: 300 })
      .resize(size, size, { fit: "cover" })
      .png()
      .toFile(resolve(outDir, `favicon-${size}.png`));
  }

  console.log(`PWA icons generated from ${source}`);
  console.log(`Written to ${outDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

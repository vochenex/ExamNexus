/**
 * Generate Android launcher + splash assets from public/icons/logo.svg
 * Run: node scripts/generate-android-icons.mjs
 */
import sharp from "sharp";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { mkdir } from "fs/promises";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const source = join(root, "public/icons/logo.svg");
const resDir = join(root, "android/app/src/main/res");

const launcherSizes = {
  "mipmap-mdpi": 48,
  "mipmap-hdpi": 72,
  "mipmap-xhdpi": 96,
  "mipmap-xxhdpi": 144,
  "mipmap-xxxhdpi": 192,
};

const foregroundSizes = {
  "mipmap-mdpi": 108,
  "mipmap-hdpi": 162,
  "mipmap-xhdpi": 216,
  "mipmap-xxhdpi": 324,
  "mipmap-xxxhdpi": 432,
};

const splashPortrait = {
  "drawable-port-mdpi": { w: 320, h: 480 },
  "drawable-port-hdpi": { w: 480, h: 800 },
  "drawable-port-xhdpi": { w: 720, h: 1280 },
  "drawable-port-xxhdpi": { w: 960, h: 1600 },
  "drawable-port-xxxhdpi": { w: 1280, h: 1920 },
};

async function writePng(path, buffer) {
  await mkdir(dirname(path), { recursive: true });
  await sharp(buffer).png().toFile(path);
}

async function renderLogo(size) {
  return sharp(source).resize(size, size, { fit: "contain" }).png().toBuffer();
}

async function renderForeground(canvasSize) {
  const logoSize = Math.round(canvasSize * 0.62);
  const logo = await renderLogo(logoSize);
  return sharp({
    create: {
      width: canvasSize,
      height: canvasSize,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: logo, gravity: "center" }])
    .png()
    .toBuffer();
}

async function renderSplash(width, height) {
  const logoSize = Math.round(Math.min(width, height) * 0.34);
  const logo = await renderLogo(logoSize);
  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 3, g: 29, b: 31, alpha: 1 },
    },
  })
    .composite([{ input: logo, gravity: "center" }])
    .png()
    .toBuffer();
}

async function main() {
  for (const [folder, size] of Object.entries(launcherSizes)) {
    const png = await renderLogo(size);
    const base = join(resDir, folder);
    await writePng(join(base, "ic_launcher.png"), png);
    await writePng(join(base, "ic_launcher_round.png"), png);
  }

  for (const [folder, size] of Object.entries(foregroundSizes)) {
    const png = await renderForeground(size);
    await writePng(join(resDir, folder, "ic_launcher_foreground.png"), png);
  }

  const defaultSplash = await renderSplash(1080, 1080);
  await writePng(join(resDir, "drawable/splash.png"), defaultSplash);

  for (const [folder, { w, h }] of Object.entries(splashPortrait)) {
    const png = await renderSplash(w, h);
    await writePng(join(resDir, folder, "splash.png"), png);
  }

  console.log("ExamNexus Android icons generated from public/icons/logo.svg");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

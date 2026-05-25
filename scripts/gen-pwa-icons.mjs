import sharp from "sharp";
import { writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const svgPath = resolve(root, "public/favicon.svg");

async function run() {
  // pwa-192x192.png
  const p192 = await sharp(svgPath, { density: 300 }).resize(192, 192).png().toBuffer();
  writeFileSync(resolve(root, "public/pwa-192x192.png"), p192);
  console.log("✓ public/pwa-192x192.png");

  // pwa-512x512.png
  const p512 = await sharp(svgPath, { density: 300 }).resize(512, 512).png().toBuffer();
  writeFileSync(resolve(root, "public/pwa-512x512.png"), p512);
  console.log("✓ public/pwa-512x512.png");

  // pwa-maskable-512x512.png
  // 안드로이드 크롭 대비: 512×512 #D3224E 배경(풀블리드) + 로고 410px(~80%) 중앙 배치
  const logoSize = 410;
  const canvasSize = 512;
  const offset = Math.floor((canvasSize - logoSize) / 2);

  const logo = await sharp(svgPath, { density: 300 }).resize(logoSize, logoSize).png().toBuffer();

  const maskable = await sharp({
    create: {
      width: canvasSize,
      height: canvasSize,
      channels: 4,
      background: { r: 211, g: 34, b: 78, alpha: 1 }, // #D3224E
    },
  })
    .composite([{ input: logo, top: offset, left: offset }])
    .png()
    .toBuffer();

  writeFileSync(resolve(root, "public/pwa-maskable-512x512.png"), maskable);
  console.log("✓ public/pwa-maskable-512x512.png");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

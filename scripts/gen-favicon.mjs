import sharp from "sharp";
import pngToIco from "png-to-ico";
import { writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const svgPath = resolve(root, "public/favicon.svg");

async function run() {
  let png16, png32;
  try {
    png16 = await sharp(svgPath, { density: 300 }).resize(16, 16).png().toBuffer();
    png32 = await sharp(svgPath, { density: 300 }).resize(32, 32).png().toBuffer();
  } catch (err) {
    console.error("SVG 렌더 실패:", err.message);
    process.exit(1);
  }

  // favicon.ico (16+32px multi-size → compact ICO)
  const icoBuffer = await pngToIco([png16, png32]);
  writeFileSync(resolve(root, "public/favicon.ico"), icoBuffer);
  console.log("✓ public/favicon.ico");

  // apple-touch-icon.png (180px)
  const apple = await sharp(svgPath, { density: 300 }).resize(180, 180).png().toBuffer();
  writeFileSync(resolve(root, "public/apple-touch-icon.png"), apple);
  console.log("✓ public/apple-touch-icon.png");

  // favicon-32x32.png
  const fav32 = await sharp(svgPath, { density: 300 }).resize(32, 32).png().toBuffer();
  writeFileSync(resolve(root, "public/favicon-32x32.png"), fav32);
  console.log("✓ public/favicon-32x32.png");
}

run();

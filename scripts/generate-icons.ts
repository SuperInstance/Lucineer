// scripts/generate-icons.ts
// Run with: bun run scripts/generate-icons.ts
import sharp from "sharp";
import { readFileSync, mkdirSync } from "fs";
import { join } from "path";

const svgContent = readFileSync(join(process.cwd(), "public/logo.svg"));
const outDir = join(process.cwd(), "public/icons");
mkdirSync(outDir, { recursive: true });

const sizes = [72, 96, 128, 144, 152, 180, 192, 384, 512];

for (const size of sizes) {
  // Render SVG at 2x density for crispness then scale down
  await sharp(svgContent, { density: Math.ceil((size / 30) * 96) })
    .resize(size, size, { fit: "contain", background: { r: 10, g: 10, b: 15, alpha: 1 } })
    .png()
    .toFile(join(outDir, `icon-${size}x${size}.png`));
  console.log(`✓ icon-${size}x${size}.png`);
}

// Maskable icon: add safe-zone padding (80% content area, 10% padding each side)
const maskableSize = 512;
const innerSize = Math.floor(maskableSize * 0.8);
const padding = Math.floor(maskableSize * 0.1);
const innerPng = await sharp(svgContent, { density: Math.ceil((innerSize / 30) * 96) })
  .resize(innerSize, innerSize, { fit: "contain", background: { r: 10, g: 10, b: 15, alpha: 1 } })
  .png()
  .toBuffer();

await sharp({
  create: {
    width: maskableSize,
    height: maskableSize,
    channels: 4,
    background: { r: 10, g: 10, b: 15, alpha: 1 },
  },
})
  .composite([{ input: innerPng, left: padding, top: padding }])
  .png()
  .toFile(join(outDir, "maskable-512x512.png"));
console.log("✓ maskable-512x512.png");

// apple-touch-icon = 180x180 copy
await sharp(svgContent, { density: Math.ceil((180 / 30) * 96) })
  .resize(180, 180, { fit: "contain", background: { r: 10, g: 10, b: 15, alpha: 1 } })
  .png()
  .toFile(join(outDir, "apple-touch-icon.png"));
console.log("✓ apple-touch-icon.png");

console.log("\nAll icons generated in public/icons/");

/**
 * Generates PWA icons (192x192 and 512x512) from public/favicon.svg.
 * Run: npm run generate-icons
 * Requires: npm install sharp --save-dev
 */
import sharp from "sharp";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const publicDir = join(root, "public");
const svgPath = join(publicDir, "favicon.svg");

const sizes = [192, 512];

async function main() {
  const svg = readFileSync(svgPath);
  for (const size of sizes) {
    const out = join(publicDir, `icon-${size}.png`);
    await sharp(svg).resize(size, size).png().toFile(out);
    console.log(`Generated ${out}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

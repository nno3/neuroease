/**
 * Rasterises public/caregiver-icon.svg for crisp PWA / iOS home-screen icons (SVG is often blurry when masked).
 * Run: npm run generate-icons  (requires devDependency `sharp`)
 */
import sharp from "sharp";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const publicDir = join(root, "public");
const svgPath = join(publicDir, "caregiver-icon.svg");

async function main() {
  const svg = readFileSync(svgPath);
  const opts = { density: 320 };

  for (const size of [192, 512]) {
    const out = join(publicDir, `icon-${size}.png`);
    await sharp(svg, opts).resize(size, size).png().toFile(out);
    console.log(`Wrote ${out}`);
  }
  const appleOut = join(publicDir, "apple-touch-icon.png");
  await sharp(svg, opts).resize(180, 180).png().toFile(appleOut);
  console.log(`Wrote ${appleOut}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

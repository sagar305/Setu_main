// Copies the ZXing wasm decoder out of node_modules and into public/, so the
// POS camera scanner loads it from our own origin instead of the jsDelivr CDN
// the library defaults to (see lib/pos/scan.ts).
//
// The copy is generated, not committed: it runs on postinstall and again at the
// start of `npm run build`. The version in the filename has to match the
// installed package — the bundled glue code only loads the binary it was built
// against — so this fails loudly when the two drift apart.

import { copyFileSync, mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const packageJsonPath = join(root, "node_modules", "zxing-wasm", "package.json");
const outputDirectory = join(root, "public", "vendor", "zxing");

// postinstall can run before the dependency is on disk (or with it pruned).
// The build passes --strict, so a real build still fails rather than shipping
// a scanner with no decoder behind it.
const strict = process.argv.includes("--strict");

function bail(message) {
  if (strict) {
    console.error(`vendor-zxing: ${message}`);
    process.exit(1);
  }
  console.warn(`vendor-zxing: ${message} — skipping.`);
  process.exit(0);
}

if (!existsSync(packageJsonPath)) bail("zxing-wasm is not installed");

const installedVersion = JSON.parse(readFileSync(packageJsonPath, "utf8")).version;
const scanSource = readFileSync(join(root, "lib", "pos", "scan.ts"), "utf8");
const declared = scanSource.match(/ZXING_WASM_VERSION\s*=\s*"([^"]+)"/)?.[1];

if (!declared) bail("could not read ZXING_WASM_VERSION from lib/pos/scan.ts");

if (declared !== installedVersion) {
  console.error(
    `vendor-zxing: zxing-wasm ${installedVersion} is installed but lib/pos/scan.ts ` +
      `declares ${declared}. Update ZXING_WASM_VERSION to ${installedVersion}.`
  );
  process.exit(1);
}

const source = join(root, "node_modules", "zxing-wasm", "dist", "reader", "zxing_reader.wasm");
if (!existsSync(source)) bail("zxing_reader.wasm is missing from the installed package");

const target = join(outputDirectory, `zxing_reader-${installedVersion}.wasm`);

mkdirSync(outputDirectory, { recursive: true });
for (const entry of readdirSync(outputDirectory)) {
  // Drop binaries left behind by an older version so the folder never lies.
  if (entry.endsWith(".wasm") && entry !== `zxing_reader-${installedVersion}.wasm`) {
    rmSync(join(outputDirectory, entry));
  }
}
copyFileSync(source, target);

console.log(`vendor-zxing: public/vendor/zxing/zxing_reader-${installedVersion}.wasm`);

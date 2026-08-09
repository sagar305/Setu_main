#!/usr/bin/env node
/**
 * Free Dine's arithmetic checks.
 *
 * The money and recipe maths are the parts of this product that can be wrong
 * without anything looking wrong: a bill still prints, a report still renders,
 * and the number is simply not the right one. The repo has no test runner, so
 * these compile the pure modules with the TypeScript already installed and run
 * them under node.
 *
 * Run: npm run check:dine
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const CHECK_DIR = "scripts/dine-checks";
const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "dine-checks-"));

const checks = fs
  .readdirSync(CHECK_DIR)
  .filter((name) => name.endsWith(".check.ts"))
  .map((name) => path.join(CHECK_DIR, name));

if (checks.length === 0) {
  console.error("check-dine: no *.check.ts files found in " + CHECK_DIR);
  process.exit(1);
}

try {
  execFileSync(
    "npx",
    [
      "tsc",
      "--module", "commonjs",
      "--target", "es2020",
      "--moduleResolution", "node",
      "--esModuleInterop",
      "--skipLibCheck",
      "--outDir", outDir,
      ...checks,
    ],
    { stdio: ["ignore", "ignore", "pipe"] }
  );
} catch (error) {
  // tsc warns about the repo tsconfig being ignored and about deprecated
  // options; neither stops it emitting. Only give up if nothing came out.
  const emitted = fs.existsSync(path.join(outDir, CHECK_DIR));
  if (!emitted) {
    console.error("check-dine: could not compile the checks.");
    console.error(String(error.stderr ?? error));
    process.exit(1);
  }
}

let failed = 0;
for (const check of checks) {
  const compiled = path.join(outDir, check.replace(/\.ts$/, ".js"));
  try {
    const output = execFileSync("node", [compiled], { encoding: "utf8" });
    process.stdout.write(output);
  } catch (error) {
    process.stdout.write(String(error.stdout ?? ""));
    failed += 1;
  }
}

fs.rmSync(outDir, { recursive: true, force: true });
if (failed > 0) {
  console.error(`check-dine: ${failed} check file(s) failed.`);
  process.exit(1);
}
console.log("check-dine: all checks passed.");

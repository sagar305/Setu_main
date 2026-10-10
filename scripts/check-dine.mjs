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

// The checked modules import their siblings relatively but reach the shared
// i18n dictionary through the repo's "@/*" alias, so the compile needs the
// same path mapping the app build uses. tsc takes that from a config file
// only — there is no --paths flag — hence this throwaway tsconfig.
const tsconfigPath = path.join(outDir, "tsconfig.check.json");
fs.writeFileSync(
  tsconfigPath,
  JSON.stringify(
    {
      compilerOptions: {
        module: "commonjs",
        target: "es2020",
        moduleResolution: "node",
        esModuleInterop: true,
        skipLibCheck: true,
        baseUrl: path.resolve("."),
        paths: { "@/*": ["./*"] },
        outDir,
      },
      files: checks.map((check) => path.resolve(check)),
    },
    null,
    2
  )
);

try {
  execFileSync("npx", ["tsc", "--project", tsconfigPath], {
    stdio: ["ignore", "ignore", "pipe"],
  });
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

// tsc resolves "@/*" at compile time but leaves the specifier untouched in
// the emitted require(), so node needs the same mapping. The compiled tree
// keeps the repo's layout under outDir, which makes the mapping a prefix swap.
const aliasHook = path.join(outDir, "alias-hook.cjs");
fs.writeFileSync(
  aliasHook,
  `const Module = require("node:module");
const path = require("node:path");
const root = ${JSON.stringify(outDir)};
const resolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (request.startsWith("@/")) request = path.join(root, request.slice(2));
  return resolve.call(this, request, ...rest);
};
`
);

let failed = 0;
for (const check of checks) {
  const compiled = path.join(outDir, check.replace(/\.ts$/, ".js"));
  try {
    const output = execFileSync("node", ["--require", aliasHook, compiled], {
      encoding: "utf8",
    });
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

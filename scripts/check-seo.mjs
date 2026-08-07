#!/usr/bin/env node
/**
 * Build-time SEO guardrail.
 *
 * Walks the prerendered HTML that `next build` writes to .next/server/app and
 * fails if any indexable page has a title or meta description outside the
 * length Google will render, or more than one <h1>.
 *
 * Checking the built HTML rather than the source means it covers every route no
 * matter where its metadata comes from — page JSON, per-post content files, or
 * a hardcoded `export const metadata` — so new blog posts are caught too.
 *
 * Run: node scripts/check-seo.mjs   (wired into `npm run build`)
 */
import fs from "node:fs";
import path from "node:path";

const APP_DIR = ".next/server/app";

const LIMITS = {
  title: { min: 30, max: 60 },
  description: { min: 120, max: 160 },
};

// Routes with no indexable content of their own. /menu and /view render data
// carried in the URL fragment and /search is an internal result page — all three
// are marked noindex, and Next's 404 page is not a real route.
const SKIP = new Set(["/_not-found", "/menu", "/view", "/search"]);

/** Decode the handful of entities Next emits so we measure what Google sees. */
function decode(value) {
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith(".html")) out.push(full);
  }
  return out;
}

function routeFor(file) {
  const rel = path.relative(APP_DIR, file).replace(/\.html$/, "");
  return rel === "index" ? "/" : `/${rel}`;
}

const files = walk(APP_DIR);
if (files.length === 0) {
  console.error("check-seo: no prerendered HTML found in .next/server/app — run `next build` first.");
  process.exit(1);
}

const problems = [];
let checked = 0;

for (const file of files.sort()) {
  const route = routeFor(file);
  if (SKIP.has(route)) continue;

  const html = fs.readFileSync(file, "utf8");

  // Respect a page's own opt-out as well as the hardcoded skip list.
  if (/<meta name="robots" content="[^"]*noindex/i.test(html)) continue;

  checked += 1;
  const fail = (message) => problems.push({ route, message });

  const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/);
  if (!titleMatch) {
    fail("missing <title>");
  } else {
    const title = decode(titleMatch[1]);
    const { min, max } = LIMITS.title;
    if (title.length < min || title.length > max) {
      fail(`title is ${title.length} chars, expected ${min}-${max}: "${title}"`);
    }
  }

  const descMatch = html.match(/<meta name="description" content="([^"]*)"/);
  if (!descMatch) {
    fail("missing meta description");
  } else {
    const description = decode(descMatch[1]);
    const { min, max } = LIMITS.description;
    if (description.length < min || description.length > max) {
      fail(`description is ${description.length} chars, expected ${min}-${max}: "${description}"`);
    }
  }

  const h1Count = (html.match(/<h1[\s>]/g) ?? []).length;
  if (h1Count !== 1) fail(`found ${h1Count} <h1> elements, expected exactly 1`);
}

if (problems.length > 0) {
  console.error(`\ncheck-seo: ${problems.length} problem(s) across ${checked} pages:\n`);
  for (const { route, message } of problems) console.error(`  ${route}\n    ${message}`);
  console.error("\nAdjust the copy, or mark the page noindex if it is not meant to be indexed.\n");
  process.exit(1);
}

console.log(`check-seo: ${checked} indexable pages passed title, description and h1 checks.`);

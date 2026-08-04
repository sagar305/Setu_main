#!/usr/bin/env node
/**
 * Keeps each blog post's `updated` field in sync with its real last-edit time,
 * which feeds `dateModified` in the Article schema and `article:modified_time`.
 *
 * Why a content hash rather than git or file mtime: a fresh clone rewrites
 * every mtime, shallow CI clones lose history, and both treat an SEO metadata
 * tweak as a content edit. Hashing only the reader-visible fields means
 * `updated` moves when the post actually changes and stays put otherwise —
 * so we never claim freshness the content hasn't earned.
 *
 * Run: npm run sync:post-dates        (writes)
 *      npm run sync:post-dates -- --check   (fails if anything is stale)
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const POSTS_DIR = path.join("content", "blog", "posts");
const HASH_FILE = path.join("content", "blog", "post-content-hashes.json");

// Fields a reader actually sees. Deliberately excludes seoTitle,
// metaDescription and keywords — tuning those is not a content update.
const CONTENT_FIELDS = ["title", "excerpt", "bodyHtml", "faq", "thumbnail", "connectedTools"];

const check = process.argv.includes("--check");
const today = new Date().toISOString().slice(0, 10);

function contentHash(post) {
  const subset = Object.fromEntries(
    CONTENT_FIELDS.filter((f) => post[f] !== undefined).map((f) => [f, post[f]]),
  );
  return crypto.createHash("sha256").update(JSON.stringify(subset)).digest("hex").slice(0, 16);
}

/** Insert or replace a top-level string field, preserving the file's layout. */
function setStringField(text, key, value, afterKey) {
  const existing = new RegExp(`("${key}"\\s*:\\s*)"(?:[^"\\\\]|\\\\.)*"`);
  if (existing.test(text)) return text.replace(existing, `$1${JSON.stringify(value)}`);

  const anchor = new RegExp(`(\\n(\\s*)"${afterKey}"\\s*:\\s*(?:"(?:[^"\\\\]|\\\\.)*"|[^,\\n]+),)`);
  const match = text.match(anchor);
  if (!match) throw new Error(`could not find "${afterKey}" to insert "${key}" after`);
  return text.replace(anchor, `$1\n${match[2]}${JSON.stringify(key)}: ${JSON.stringify(value)},`);
}

const hashes = fs.existsSync(HASH_FILE) ? JSON.parse(fs.readFileSync(HASH_FILE, "utf8")) : {};
const nextHashes = {};
const changed = [];

for (const file of fs.readdirSync(POSTS_DIR).sort()) {
  if (!file.endsWith(".json")) continue;
  const full = path.join(POSTS_DIR, file);
  let text = fs.readFileSync(full, "utf8");
  const post = JSON.parse(text);
  const slug = post.slug ?? file.replace(/\.json$/, "");

  const hash = contentHash(post);
  nextHashes[slug] = hash;

  const known = hashes[slug];
  let updated = post.updated;

  if (updated === undefined) {
    // First run for this post: dateModified starts equal to datePublished.
    updated = post.date;
  } else if (known !== undefined && known !== hash) {
    // Content genuinely changed since the last sync.
    updated = today;
  }

  // A post whose publish date moved forward (drafted early, published later)
  // would otherwise report dateModified before datePublished.
  if (updated < post.date) updated = post.date;

  if (updated === post.updated && known === hash) continue;

  changed.push(`${slug}: updated=${updated}${post.updated ? ` (was ${post.updated})` : " (new)"}`);
  if (!check) {
    text = setStringField(text, "updated", updated, "date");
    fs.writeFileSync(full, text);
  }
}

if (check) {
  if (changed.length > 0) {
    console.error("\nsync-post-dates: post dates are stale:\n");
    for (const line of changed) console.error(`  ${line}`);
    console.error("\nRun `npm run sync:post-dates` and commit the result.\n");
    process.exit(1);
  }
  console.log("sync-post-dates: all post dates are current.");
} else {
  fs.writeFileSync(HASH_FILE, JSON.stringify(nextHashes, null, 2) + "\n");
  console.log(
    changed.length === 0
      ? "sync-post-dates: nothing to update."
      : `sync-post-dates: updated ${changed.length} post(s):\n  ${changed.join("\n  ")}`,
  );
}

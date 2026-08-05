# Publishing a blog post

You can do all of this in the GitHub web UI. A GitHub Action
(`.github/workflows/blog-content.yml`) fills in the dates and runs the checks
after you commit, so there are no commands to run.

## 1. Add the post file

Create `content/blog/posts/<slug>.json`:

```json
{
  "slug": "your-new-post",
  "title": "Full headline, shown as the page H1",
  "seoTitle": "Shorter title for Google — 30 to 60 characters",
  "metaDescription": "The snippet Google shows — 120 to 160 characters.",
  "excerpt": "One or two sentences, shown on the blog listing card.",
  "keywords": ["keyword one", "keyword two"],
  "date": "2026-08-05",
  "category": "Menu Ops",
  "thumbnail": "/blog/thumbnails/your-new-post.jpeg",
  "connectedTools": [{ "type": "calculator", "slug": "gst-calculator" }],
  "faq": [{ "question": "…", "answer": "…" }],
  "bodyHtml": "<p>…</p>"
}
```

Leave `updated` out — the Action adds it.

## 2. List it on the blog

Add an entry to the **top** of the `posts` array in `content/blog/index.json`
(newest first):

```json
{
  "slug": "your-new-post",
  "title": "Full headline, shown as the page H1",
  "excerpt": "One or two sentences, shown on the blog listing card.",
  "date": "2026-08-05",
  "category": "Menu Ops",
  "thumbnail": "/blog/thumbnails/your-new-post.jpeg"
}
```

Skip this and the post has no page and appears nowhere — the file alone is not
enough.

## 3. Add the thumbnail

Upload to `public/blog/thumbnails/<slug>.jpeg`, sized **1536×1024 (3:2)**.

Anything wider gets its left and right edges cropped on the listing cards, so
keep text inside the middle of the frame. Set `"thumbnail": null` if you have
no image; a coloured placeholder is shown instead.

## What the Action does after you commit

1. Sets `updated` to the publish date on a new post, and to today when an
   existing post's content changes. This feeds `dateModified`, which search
   engines and AI tools read as a freshness signal.
2. Commits that back to `main` for you.
3. Runs the site checks.

## What will fail the checks

- `seoTitle` outside **30–60** characters
- `metaDescription` outside **120–160** characters
- more than one `<h1>` on the page
- a **new category** without a text block (see below)

## Using a new category

If no existing post uses the category, add it to the `categories` block in
`content/blog/index.json` as well. The key is the category name in lower case
with hyphens for spaces — `"Payroll Ops"` becomes `"payroll-ops"`:

```json
"payroll-ops": {
  "title": "Title for the category page — 50 to 60 characters",
  "description": "Description for the category page — 140 to 160 characters.",
  "intro": "One line shown under the category name on the page."
}
```

Without it the category page falls back to generated text that is too short,
and the checks fail.

## Running it yourself instead

If you have the repo cloned:

```bash
npm run sync:post-dates   # fill in dates and fingerprints
npm run build             # run every check
```

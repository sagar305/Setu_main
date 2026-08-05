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
  "thumbnail": "/blog/thumbnails/listing/your-new-post.jpeg"
}
```

Skip this and the post has no page and appears nowhere — the file alone is not
enough.

## 3. Add the two images

The listing card and the article read **different** files, so each can be sized
for its own job:

| Image | Set in | Upload to | Size |
| --- | --- | --- | --- |
| Listing card | `index.json` | `public/blog/thumbnails/listing/<slug>.jpeg` | **1536×1024 (3:2)** |
| Article + social share | `posts/<slug>.json` | `public/blog/thumbnails/<slug>.jpeg` | **1200×630 (1.91:1)** |

Why two: the listing card crops to 3:2, while Facebook, LinkedIn and X crop
shared links to roughly 1.91:1. One file cannot suit both — a 3:2 image loses
its top and bottom when shared, and a 1.91:1 image loses its left and right
edges on the cards. Keep any text near the middle of each frame.

The article hero shows its image at whatever shape it is, so nothing is cropped
there.

Set either to `null` if you have no image. If `index.json` has no thumbnail, the
listing falls back to the article image.

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

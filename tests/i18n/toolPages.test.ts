import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

import { itemRoutesFor } from "@/lib/i18n/pages";

const PAGES_DIR = path.join(process.cwd(), "app", "tools");
const CONTENT = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "content", "en", "tools.json"), "utf8"),
) as Record<string, any>;

/** Every slug under app/tools that has a page of its own. */
const SLUGS = fs
  .readdirSync(PAGES_DIR, { withFileTypes: true })
  .filter(
    (entry) => entry.isDirectory() && fs.existsSync(path.join(PAGES_DIR, entry.name, "page.tsx")),
  )
  .map((entry) => entry.name)
  .sort();

const sourceFor = (slug: string) =>
  fs.readFileSync(path.join(PAGES_DIR, slug, "page.tsx"), "utf8");

const itemFor = (slug: string) =>
  CONTENT.items.find((item: Record<string, any>) => item.slug === slug) as Record<string, any>;

describe("tool pages keep their copy in content", () => {
  it("finds the thirty-five tool pages", () => {
    expect(SLUGS.length).toBe(35);
  });

  /**
   * The whole point of the shell: a page that writes its own hero or its own
   * FAQ is publishing English on sixteen translated routes, which is the state
   * this replaced. Catching it here is cheaper than noticing it in search.
   */
  it("renders the shared shell and holds no copy of its own", () => {
    for (const slug of SLUGS) {
      const src = sourceFor(slug);
      expect(src, `${slug} should render ToolPageShell`).toContain("<ToolPageShell");

      for (const smell of ["<h1", "faqSchema", '"@type": "Question"', "Free Tool"]) {
        expect(src.includes(smell), `${slug}/page.tsx still carries ${smell}`).toBe(false);
      }
    }
  });

  it("gives every tool page an FAQ in content", () => {
    for (const slug of SLUGS) {
      const item = itemFor(slug);
      expect(item, `${slug} has no entry in tools.json`).toBeTruthy();
      expect(item.faq?.items?.length, `${slug} has no FAQ in content`).toBeGreaterThan(0);

      for (const entry of item.faq.items) {
        expect(entry.question?.trim(), `${slug} FAQ question is empty`).toBeTruthy();
        expect(entry.answer?.trim(), `${slug} FAQ answer is empty`).toBeTruthy();
      }
    }
  });

  it("gives every tool page a hero headline and subheadline in content", () => {
    for (const slug of SLUGS) {
      const { hero } = itemFor(slug);
      expect(hero?.headline?.trim(), `${slug} has no hero headline`).toBeTruthy();
      expect(hero?.subheadline?.trim(), `${slug} has no hero subheadline`).toBeTruthy();
    }
  });

  /**
   * The pill above the h1 reads the shared "Free Tool" label, not a per-item
   * eyebrow — a tool that carried one would be sixteen translations of a string
   * no page renders, which is what this replaced.
   */
  it("carries no per-item eyebrow, in English or in any translation", () => {
    const files = ["content/en/tools.json"];
    const dir = path.join(process.cwd(), "content", "i18n", "tools");
    for (const file of fs.readdirSync(dir)) files.push(path.join("content", "i18n", "tools", file));

    for (const file of files) {
      const content = JSON.parse(fs.readFileSync(path.join(process.cwd(), file), "utf8"));
      for (const item of content.items) {
        expect(item.hero?.eyebrow, `${file}: ${item.slug ?? "an item"} has an eyebrow`).toBe(
          undefined,
        );
      }
    }
  });
});

describe("the body blocks a few tool pages carry", () => {
  const withBody = SLUGS.filter((slug) => itemFor(slug).body);

  it("finds the five pages that have them", () => {
    expect(withBody).toEqual([
      "barcode-generator",
      "invoice-generator",
      "qr-menu-generator",
      "upi-qr-generator",
      "upi-qr-split",
    ]);
  });

  /** ToolBody switches on `kind`, so an unknown one renders nothing at all. */
  it("uses only the kinds ToolBody knows how to render", () => {
    const kinds = new Set(["features", "steps", "checklist", "prose", "note", "links"]);
    for (const slug of withBody) {
      for (const block of itemFor(slug).body) {
        expect(kinds.has(block.kind), `${slug}: unknown block kind "${block.kind}"`).toBe(true);
        expect(block.headline?.trim(), `${slug}: a ${block.kind} block has no headline`).toBeTruthy();
      }
    }
  });

  /**
   * ToolBody keys the blocks by headline, and React drops the second of two
   * children sharing a key — so a duplicate would silently lose a section.
   */
  it("gives each page's blocks distinct headlines", () => {
    for (const slug of withBody) {
      const headlines = itemFor(slug).body.map((block: Record<string, any>) => block.headline);
      expect(new Set(headlines).size, `${slug} has two blocks with one headline`).toBe(
        headlines.length,
      );
    }
  });

  /**
   * RichText splits on this pattern and renders anything it does not match as
   * literal text, so an unclosed `**` or a malformed link would reach the page
   * as asterisks and brackets.
   */
  it("keeps the inline markup in a shape RichText recognises", () => {
    for (const slug of withBody) {
      for (const text of prose(itemFor(slug).body)) {
        const stars = (text.match(/\*\*/g) ?? []).length;
        expect(stars % 2, `${slug}: unbalanced ** in "${text.slice(0, 50)}"`).toBe(0);

        // An opening `[` always has to reach `](...)`, or it renders raw.
        const brackets = (text.match(/\[/g) ?? []).length;
        const links = (text.match(/\[[^\]]+\]\([^)]+\)/g) ?? []).length;
        expect(links, `${slug}: a bracket in "${text.slice(0, 50)}" is not a link`).toBe(brackets);
      }
    }
  });

  /** A link written in content has to point at a page that exists. */
  it("points every link at a path the site serves", () => {
    const paths = knownPaths();
    for (const slug of withBody) {
      for (const href of hrefs(itemFor(slug).body)) {
        expect(paths.has(href), `${slug}: nothing serves ${href}`).toBe(true);
      }
    }
  });
});

describe("the localized tool route", () => {
  /**
   * A route is prerendered per (language, slug), and the tool it renders comes
   * from the registry — a slug missing from it would build a page with no tool
   * on it.
   */
  it("has an entry in the registry for every route it will build", async () => {
    const { TOOL_PAGES } = await import("@/components/tools/registry");
    for (const { slug } of itemRoutesFor("tools")) {
      expect(Object.keys(TOOL_PAGES), `registry is missing ${slug}`).toContain(slug);
    }
  });

  /**
   * The registry is generated off the English pages so that both routes show
   * the same blocks. Checking it here as well means a hand-edited registry is
   * caught by the tests, not only by the build's --check.
   */
  it("agrees with each English page about which blocks it carries", async () => {
    const { TOOL_PAGES } = await import("@/components/tools/registry");
    for (const slug of SLUGS) {
      const src = sourceFor(slug);
      const shell = /<ToolPageShell[\s\S]*?>/.exec(src)?.[0] ?? "";
      const entry = TOOL_PAGES[slug];
      expect(entry, `registry is missing ${slug}`).toBeTruthy();
      expect(entry.schema, `${slug}: schema`).toBe(/\bschema\b/.test(shell));
      expect(entry.suggested, `${slug}: suggested`).toBe(/\bsuggested\b/.test(shell));
      expect(entry.suspense, `${slug}: suspense`).toBe(src.includes("<Suspense"));
    }
  });
});

/** Every string in a body that may carry inline markup. */
function prose(blocks: Record<string, any>[]): string[] {
  const out: string[] = [];
  for (const block of blocks) {
    if (block.intro) out.push(block.intro);
    if (block.text) out.push(block.text);
    for (const paragraph of block.paragraphs ?? []) out.push(paragraph);
  }
  return out;
}

/** Every link target in a body, whether an href field or inline in prose. */
function hrefs(blocks: Record<string, any>[]): string[] {
  const out: string[] = [];
  for (const block of blocks) {
    if (block.cta?.href) out.push(block.cta.href);
    for (const link of block.links ?? []) out.push(link.href);
  }
  for (const text of prose(blocks)) {
    for (const match of text.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) out.push(match[1]);
  }
  return out;
}

/** The in-site paths a tool page may link to: a tool, a calculator, a product. */
function knownPaths(): Set<string> {
  const paths = new Set<string>();
  for (const dir of ["tools", "calculators", "products"] as const) {
    const base = path.join(process.cwd(), "app", dir);
    if (!fs.existsSync(base)) continue;
    paths.add(`/${dir}`);
    for (const entry of fs.readdirSync(base, { withFileTypes: true })) {
      if (entry.isDirectory() && fs.existsSync(path.join(base, entry.name, "page.tsx"))) {
        paths.add(`/${dir}/${entry.name}`);
      }
    }
  }
  return paths;
}

import Link from "next/link";
import type { ToolBodyBlock } from "@/lib/content";
import { RichText } from "@/components/RichText";

/**
 * The extra prose under a tool, rendered from content.
 *
 * Four pages carry this. Each used to render its own markup, which is why the
 * cards, the numbered steps and the tick lists were worded identically but
 * styled three slightly different ways; one renderer for all of them settles
 * that, and the copy now lives in content where a translation can reach it.
 *
 * `features` and `prose` sit in full-width bands of their own because that is
 * how they read today; everything else stacks inside one column.
 *
 * The hrefs here are written as English paths and already point at the reader's
 * language by the time they arrive — localizeLinks rewrites them as the copy is
 * loaded, so nothing in this file has to know which language it is rendering.
 */
export function ToolBody({ blocks }: { blocks: ToolBodyBlock[] }) {
  const bands = blocks.filter((block) => block.kind === "features" || block.kind === "prose");
  const stacked = blocks.filter((block) => block.kind !== "features" && block.kind !== "prose");

  return (
    <>
      {bands.map((block) => (
        <section
          key={block.headline}
          className="border-t border-muted-line/20 bg-cream-paper py-16"
        >
          <div className={block.kind === "features" ? "mx-auto max-w-6xl px-6" : "mx-auto max-w-4xl px-6"}>
            <Block block={block} />
          </div>
        </section>
      ))}

      {stacked.length > 0 && (
        <section className="mx-auto max-w-4xl px-6 py-16">
          <div className="space-y-8">
            {stacked.map((block) => (
              <Block key={block.headline} block={block} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function Block({ block }: { block: ToolBodyBlock }) {
  switch (block.kind) {
    case "features":
      return (
        <>
          <h2 className="mb-12 text-center text-3xl font-bold text-ink">{block.headline}</h2>
          <div className="grid gap-8 sm:grid-cols-3">
            {block.items.map((item) => (
              <div
                key={item.title}
                className="rounded-xl border border-muted-line/20 bg-white p-6 shadow-sm"
              >
                <div className="mb-4 text-3xl" aria-hidden="true">
                  {item.icon}
                </div>
                <h3 className="mb-2 font-bold text-ink">{item.title}</h3>
                <p className="text-sm text-muted">{item.text}</p>
              </div>
            ))}
          </div>
        </>
      );

    case "prose":
      return (
        <>
          <h2 className="mb-4 text-2xl font-bold text-ink">{block.headline}</h2>
          {block.paragraphs.map((paragraph, index) => (
            <p
              key={paragraph}
              className={index === block.paragraphs.length - 1 ? "text-muted" : "mb-4 text-muted"}
            >
              <RichText text={paragraph} />
            </p>
          ))}
        </>
      );

    case "steps":
      return (
        <div>
          <h2 className="mb-4 text-2xl font-bold text-ink">{block.headline}</h2>
          {block.intro && (
            <p className="mb-4 text-muted">
              <RichText text={block.intro} />
            </p>
          )}
          <ol className="space-y-3 text-muted">
            {block.steps.map((step, index) => (
              <li key={step} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo text-sm font-semibold text-white">
                  {index + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>
      );

    case "checklist":
      return (
        <div>
          <h2 className="mb-4 text-2xl font-bold text-ink">{block.headline}</h2>
          {block.intro && (
            <p className="mb-4 text-muted">
              <RichText text={block.intro} />
            </p>
          )}
          <ul className={block.cta ? "mb-4 space-y-2 text-muted" : "space-y-2 text-muted"}>
            {block.items.map((item) => (
              <li key={item} className="flex gap-3">
                <span className="text-indigo" aria-hidden="true">
                  ✓
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
          {block.cta && (
            <Link
              href={block.cta.href}
              className="inline-block rounded-lg border border-indigo bg-indigo px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700"
            >
              {block.cta.label}
            </Link>
          )}
        </div>
      );

    case "note":
      return (
        <div>
          <h2 className="mb-4 text-2xl font-bold text-ink">{block.headline}</h2>
          <div className="rounded-lg border-l-4 border-saffron bg-saffron/10 p-4">
            <p className="text-sm leading-relaxed text-muted">
              <RichText text={block.text} />
            </p>
          </div>
        </div>
      );

    case "links":
      return (
        <div>
          <h2 className="mb-4 text-2xl font-bold text-ink">{block.headline}</h2>
          {block.intro && <p className="mb-4 text-muted">{block.intro}</p>}
          <div className="flex flex-wrap gap-3">
            {block.links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="inline-block rounded-lg border border-indigo/30 px-4 py-2 text-sm font-semibold text-indigo transition hover:bg-indigo/5"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      );
  }
}

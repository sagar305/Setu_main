import Link from "next/link";
import { Fragment, type ReactNode } from "react";

/**
 * The two pieces of inline markup the legal copy needs: **bold** and
 * [label](href).
 *
 * The privacy policy and terms used to be JSX, which meant none of their copy
 * could be translated. Moving them into content/en/*.json needs some way to
 * keep a bolded clause or a link to /terms inside a sentence — and a translator
 * has to be able to move it, because word order differs. Markdown's two
 * simplest forms do that without pulling in a parser, and without letting
 * content inject arbitrary HTML.
 */
const PATTERN = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g;

export function RichText({ text }: { text: string }) {
  const parts = text.split(PATTERN).filter((part) => part !== "");

  return (
    <>
      {parts.map((part, index) => {
        const bold = /^\*\*([^*]+)\*\*$/.exec(part);
        if (bold) return <strong key={index}>{bold[1]}</strong>;

        const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
        if (link) {
          const [, label, href] = link;
          // Only mail and in-site links appear here; next/link handles the
          // latter, and an external href would need target/rel handling that
          // the legal pages have never needed.
          if (href.startsWith("mailto:")) {
            return (
              <a key={index} className="font-semibold text-indigo hover:underline" href={href}>
                {label}
              </a>
            );
          }
          return (
            <Link key={index} className="font-semibold text-indigo hover:underline" href={href}>
              {label}
            </Link>
          );
        }

        return <Fragment key={index}>{part}</Fragment>;
      })}
    </>
  );
}

/** Convenience for a list of paragraphs, each of which may carry inline markup. */
export function RichParagraphs({ items }: { items: string[] }): ReactNode {
  return items.map((text, index) => (
    <p key={index}>
      <RichText text={text} />
    </p>
  ));
}

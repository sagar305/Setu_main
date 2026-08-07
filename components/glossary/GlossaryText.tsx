import Link from "next/link";
import { getGlossaryTermUrl, type GlossarySegment } from "@/lib/glossary";

/**
 * Renders a plain-text paragraph with glossary terms turned into links.
 *
 * The segmenting happens on the server (see `createGlossaryLinker` in
 * lib/content), so pages that hold their copy as strings rather than HTML —
 * calculator "about" paragraphs, for instance — get the same in-body glossary
 * links the blog gets.
 */
export function GlossaryText({ segments }: { segments: GlossarySegment[] }) {
  return (
    <>
      {segments.map((segment, index) =>
        segment.type === "link" ? (
          <Link
            key={`${segment.slug}-${index}`}
            href={getGlossaryTermUrl(segment.slug)}
            className="glossary-link"
          >
            {segment.value}
          </Link>
        ) : (
          <span key={index}>{segment.value}</span>
        ),
      )}
    </>
  );
}

import Link from "next/link";
import { Sparkles } from "lucide-react";
import { productNotes } from "@/lib/whatsNew";

/**
 * The "What's new" strip under a product page's hero. Renders nothing once
 * every note is past its window, so a page never advertises stale news.
 */
export function WhatsNewStrip({ productId }: { productId: string }) {
  const notes = productNotes(productId);
  if (notes.length === 0) return null;

  const month = new Date(`${notes[0].addedOn}T00:00:00Z`).toLocaleDateString("en-IN", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

  return (
    <div className="mx-auto mt-10 max-w-4xl rounded-2xl border border-saffron/50 bg-saffron/10 p-5 text-left sm:p-6">
      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-ink">
        <Sparkles className="h-4 w-4 text-indigo" aria-hidden="true" />
        What&apos;s new · {month}
      </p>
      <ul className={`mt-4 grid gap-4 ${notes.length > 1 ? "sm:grid-cols-2" : ""}`}>
        {notes.map((note) => (
          <li key={note.title} className="rounded-xl bg-white p-4 shadow-sm">
            <p className="font-bold text-ink">{note.title}</p>
            <p className="mt-1 text-sm leading-relaxed text-muted">{note.body}</p>
            <Link
              prefetch={false}
              href={note.href}
              className="mt-3 inline-block text-sm font-semibold text-indigo hover:underline"
            >
              {note.cta} →
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

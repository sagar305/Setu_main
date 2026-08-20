import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PosterLanding } from "@/components/tools/Token/PosterLanding";

/**
 * Where the waiting-area poster's QR code lands.
 *
 * It issues nothing. Two devices cannot share one browser's IndexedDB, so a
 * phone that scans the poster has no way to reach the counter's queue — and a
 * page that pretended otherwise would show somebody a position in a queue that
 * does not exist on their phone. So it says the true thing instead: show this
 * to the counter. A live version — a customer's own phone taking a number and
 * watching it move — would need a server both devices share, which is outside
 * what an offline app can do.
 *
 * Noindex: the business and service names arrive in the query string, so every
 * scan is a different URL with nothing worth indexing behind it.
 */
export const metadata: Metadata = {
  title: "Join the queue | Setu",
  description:
    "Show this screen at the counter to collect your token number. Part of the Setu Free Token System.",
  robots: { index: false, follow: true },
  alternates: { canonical: "/products/free-token-system/view" },
};

export default function TokenViewPage() {
  return (
    <section className="mx-auto max-w-lg px-4 py-12 sm:px-6 sm:py-16">
      <Suspense fallback={<p className="text-center text-muted">Loading…</p>}>
        <PosterLanding />
      </Suspense>
      <p className="mt-10 text-center text-xs text-muted">
        Running a queue yourself?{" "}
        <Link
          href="/products/free-token-system"
          className="font-semibold text-indigo hover:underline"
        >
          The token system behind this is free.
        </Link>
      </p>
    </section>
  );
}

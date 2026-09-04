import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isValidShortCode } from "@/lib/toolkit/shortenerServer";
import { RepairTracker } from "@/components/tools/Repair/RepairTracker";

export const metadata: Metadata = {
  title: "Track your repair | Setu Technology",
  description:
    "Follow the progress of a device left for repair — its current status, when it was promised, and the amount to pay on collection.",
  // One customer's repair, reachable by anyone holding the link. Nothing here
  // belongs in a search index.
  robots: { index: false, follow: false },
};

/**
 * A repair's tracking page.
 *
 * Deliberately NOT behind REPAIR_SOFTWARE_ENABLED, unlike the product page. A
 * link minted while the flag was on — on a preview deployment, or before it was
 * ever turned off again — is in a customer's WhatsApp, and 404ing it would
 * strand them. The page is noindex and says nothing at all unless it is handed
 * a code that resolves, so there is nothing here for a flag to hide.
 *
 * The code is resolved in the browser through this site's own proxy, so the
 * shortener's address and key stay on the server — the same arrangement as
 * /view/[code]. The difference is that this code is *mutable*: the shop
 * repoints it at every status change, so the customer's bookmark is never
 * stale. See lib/repair/tracking.ts.
 */
export default async function TrackRepairPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  // Anything that is not a ten-character code was never a link we issued.
  if (!isValidShortCode(code)) notFound();

  return (
    <section className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
      <RepairTracker code={code} />
    </section>
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShareViewer } from "@/components/toolkit/ShareViewer";
import { isValidShortCode } from "@/lib/toolkit/shortenerServer";

export const metadata: Metadata = {
  title: "Shared document | Setu Technology",
  description:
    "View a shared invoice, quotation, appointment, prescription, fee receipt, report or payment reminder created with a free Setu tool.",
  // One person's document, reachable by anyone holding the link. Nothing here
  // belongs in a search index.
  robots: { index: false, follow: false },
};

/**
 * A shortened document link. The code is resolved in the browser through this
 * site's own proxy, so the shortener's address and key stay on the server.
 */
export default async function SharedCodePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  // Anything that is not a ten-character code was never a link we issued.
  if (!isValidShortCode(code)) notFound();

  return (
    <section className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
      <ShareViewer code={code} />
    </section>
  );
}

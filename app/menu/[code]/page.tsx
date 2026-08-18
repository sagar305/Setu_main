import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MenuViewer } from "@/components/tools/QrMenuGenerator/MenuViewer";
import { isValidShortCode } from "@/lib/toolkit/shortenerServer";

export const metadata: Metadata = {
  title: "Digital Menu | Setu Technology",
  description:
    "View a restaurant's digital menu. Created with the free Setu QR Menu Generator — no app needed.",
  // A single restaurant's menu behind a printed code. Not something to index.
  robots: { index: false, follow: false },
};

/**
 * A published menu. The printed QR points here, and the restaurant can change
 * what this code resolves to without reprinting anything.
 */
export default async function PublishedMenuPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  if (!isValidShortCode(code)) notFound();

  return (
    <section className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
      <MenuViewer code={code} />
    </section>
  );
}

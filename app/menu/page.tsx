import type { Metadata } from "next";
import { MenuViewer } from "@/components/tools/QrMenuGenerator/MenuViewer";

export const metadata: Metadata = {
  title: "Digital Menu | Setu Technology",
  description:
    "View a restaurant's digital menu. Created with the free Setu QR Menu Generator — the whole menu lives inside the QR code, no app needed.",
  // Every scanned menu renders on this one route with data in the URL
  // fragment, so there is nothing meaningful for crawlers to index here.
  robots: { index: false, follow: true },
  alternates: { canonical: "/menu" },
};

export default function MenuPage() {
  return (
    <section className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
      <MenuViewer />
    </section>
  );
}

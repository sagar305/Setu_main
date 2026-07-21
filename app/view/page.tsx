import type { Metadata } from "next";
import { ShareViewer } from "@/components/toolkit/ShareViewer";

export const metadata: Metadata = {
  title: "Shared document | Setu Technology",
  description:
    "View a shared invoice, quotation, appointment or payment reminder created with a free Setu tool.",
  // Every shared document renders on this one route with its data in the URL
  // fragment, so there is nothing meaningful (or private) to index here.
  robots: { index: false, follow: true },
  alternates: { canonical: "/view" },
};

export default function ViewPage() {
  return (
    <section className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
      <ShareViewer />
    </section>
  );
}

import type { Metadata } from "next";
import { PageHero } from "@/components/PageHero";
import { ChangelogList } from "@/components/changelog/ChangelogList";
import { CHANGELOG } from "@/lib/changelog";

// Re-render once a day so "the last month" moves with the calendar even when
// nothing is deployed. English only.
export const revalidate = 86400;

const title = "Changelog — new features, fixes and launches | Setu Technology";
const description =
  "Every feature added, bug fixed and product launched across Setu Technology's products and free tools, newest first.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/changelog" },
  openGraph: { title, description, url: "/changelog" },
};

export default function ChangelogPage() {
  const entries = [...CHANGELOG].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <>
      <PageHero
        eyebrow="Changelog"
        headline="What's changed at Setu"
        subheadline="New features, bug fixes and product launches, as they go live."
      />
      <div className="mx-auto max-w-3xl px-4 pb-20 sm:px-6">
        <ChangelogList entries={entries} now={Date.now()} />
      </div>
    </>
  );
}

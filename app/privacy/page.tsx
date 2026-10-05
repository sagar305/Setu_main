import type { Metadata } from "next";
import { getPrivacyContent } from "@/lib/content";
import { languageAlternates } from "@/lib/i18n/pages";
import { LegalPage } from "@/components/legal/LegalPage";
import { AnalyticsOptOut } from "@/components/analytics/AnalyticsOptOut";

const content = getPrivacyContent();

export const metadata: Metadata = {
  title: content.seo.title,
  description: content.seo.description,
  alternates: { canonical: "/privacy", languages: languageAlternates("privacy") },
  openGraph: {
    title: content.seo.title,
    description: content.seo.description,
    url: "/privacy",
  },
};

export default function PrivacyPage() {
  return <LegalPage content={content} optOut={<AnalyticsOptOut />} />;
}

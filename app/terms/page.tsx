import type { Metadata } from "next";
import { getTermsContent } from "@/lib/content";
import { languageAlternates } from "@/lib/i18n/pages";
import { LegalPage } from "@/components/legal/LegalPage";

const content = getTermsContent();

export const metadata: Metadata = {
  title: content.seo.title,
  description: content.seo.description,
  alternates: { canonical: "/terms", languages: languageAlternates("terms") },
  openGraph: {
    title: content.seo.title,
    description: content.seo.description,
    url: "/terms",
  },
};

export default function TermsPage() {
  return <LegalPage content={content} />;
}

import type { Metadata } from "next";
import { getConsultancyContent } from "@/lib/content";
import { languageAlternates } from "@/lib/i18n/pages";
import { ConsultancySections } from "@/components/consultancy/ConsultancySections";

const content = getConsultancyContent();

export const metadata: Metadata = {
  title: content.seo.title,
  description: content.seo.description,
  keywords: content.seo.keywords,
  alternates: { canonical: "/consultancy", languages: languageAlternates("consultancy") },
  openGraph: {
    title: content.seo.title,
    description: content.seo.description,
    url: "/consultancy",
    images: [
      {
        url: "/og/setu-og-image-1200x627.png",
        width: 1200,
        height: 627,
        alt: "Setu Technology - Setu for your business",
      },
      {
        url: "/og/setu-og-image-800x418.png",
        width: 800,
        height: 418,
        alt: "Setu Technology - Setu for your business",
      },
      {
        url: "/og/setu-og-image-500x261.png",
        width: 500,
        height: 261,
        alt: "Setu Technology - Setu for your business",
      },
    ],
  },
};

const serviceSchema = {
  "@context": "https://schema.org",
  "@type": "Service",
  serviceType: "Accounting, Bookkeeping & Payroll Services",
  name: "Setu Technology Accounting & Bookkeeping Consultancy",
  provider: {
    "@type": "Organization",
    name: "Setu Technology",
    url: "https://setutechnology.com",
  },
  areaServed: "Global",
  description: content.seo.description,
};

export default function ConsultancyPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceSchema) }}
      />
      <ConsultancySections content={content} lang="en" />
    </>
  );
}

import type { Metadata } from "next";
import { getToolsContent } from "@/lib/content";
import { languageAlternates } from "@/lib/i18n/pages";
import { ToolsSections } from "@/components/tools/ToolsSections";

const content = getToolsContent();

export const metadata: Metadata = {
  title: content.seo.title,
  description: content.seo.description,
  keywords: content.seo.keywords,
  alternates: { canonical: "/tools", languages: languageAlternates("tools") },
  openGraph: {
    title: content.seo.title,
    description: content.seo.description,
    url: "/tools",
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

export default function ToolsPage() {
  return <ToolsSections content={content} lang="en" />;
}

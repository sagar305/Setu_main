import type { Metadata } from "next";
import { getRefundPolicyContent } from "@/lib/content";
import { LegalPage } from "@/components/legal/LegalPage";

// English only: it governs payments, and there is no translated version yet.
const content = getRefundPolicyContent();

export const metadata: Metadata = {
  title: content.seo.title,
  description: content.seo.description,
  alternates: { canonical: "/refund-policy" },
  openGraph: {
    title: content.seo.title,
    description: content.seo.description,
    url: "/refund-policy",
  },
};

export default function RefundPolicyPage() {
  return <LegalPage content={content} />;
}

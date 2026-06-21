import type { Metadata } from "next";
import { getHomeContent } from "@/lib/content";
import { Hero } from "@/components/home/Hero";
import { Products } from "@/components/home/Products";
import { WhySetu } from "@/components/home/WhySetu";
import { SocialProof } from "@/components/home/SocialProof";
import { CtaBanner } from "@/components/CtaBanner";

const content = getHomeContent();

export const metadata: Metadata = {
  title: content.seo.title,
  description: content.seo.description,
  keywords: content.seo.keywords,
  alternates: { canonical: "/" },
  openGraph: {
    title: content.seo.title,
    description: content.seo.description,
    url: "/",
  },
};

export default function HomePage() {
  return (
    <>
      <Hero hero={content.hero} />
      <Products products={content.products} />
      <WhySetu whySetu={content.whySetu} />
      <SocialProof socialProof={content.socialProof} />
      <CtaBanner {...content.ctaBanner} />
    </>
  );
}

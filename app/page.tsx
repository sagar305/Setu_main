import type { Metadata } from "next";
import { getHomeContent } from "@/lib/content";
import { Hero } from "@/components/home/Hero";
import { ShowcaseGrid } from "@/components/home/ShowcaseGrid";
import { Services } from "@/components/home/Services";
import { WhySetu } from "@/components/home/WhySetu";
import { SocialProof } from "@/components/home/SocialProof";
import { LatestBlogs } from "@/components/home/LatestBlogs";
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

export default function HomePage() {
  return (
    <>
      <Hero hero={content.hero} />
      <ShowcaseGrid id="tools" section={content.tools} className="bg-white" />
      <ShowcaseGrid id="calculators" section={content.calculators} className="bg-cream" />
      <Services services={content.services} />
      <WhySetu whySetu={content.whySetu} />
      <SocialProof socialProof={content.socialProof} />
      <LatestBlogs />
      <CtaBanner {...content.ctaBanner} />
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { getTuitionContent } from "@/lib/content";
import { quoteOffer } from "@/lib/schema";
import { PageHero } from "@/components/PageHero";
import { FadeIn } from "@/components/motion/FadeIn";

const content = getTuitionContent();

export const metadata: Metadata = {
  title: content.seo.title,
  description: content.seo.description,
  keywords: content.seo.keywords,
  alternates: { canonical: "/products/tuition" },
  openGraph: {
    title: content.seo.title,
    description: content.seo.description,
    url: "/products/tuition",
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

const softwareApplicationSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Setu Tuition",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description: content.seo.description,
  offers: quoteOffer({
    url: "/contact",
    description: "Setu Tuition has not launched yet. Pricing will be announced at launch.",
    availability: "PreOrder",
  }),
  provider: {
    "@type": "Organization",
    name: "Setu Technology",
    url: "https://setutechnology.com",
  },
};

/** What the paid product adds on top of the free browser app. */
const PAID_ADDITIONS = [
  {
    title: "Reminders that send themselves",
    description:
      "The free tool prepares each WhatsApp message and you tap send. Setu Tuition sends fee reminders and absence alerts automatically on a schedule you set.",
  },
  {
    title: "A live view for parents",
    description:
      "Shared links are a snapshot of the moment they were made. Parents get a page that always shows the current fee position, attendance and results.",
  },
  {
    title: "More than one teacher",
    description:
      "Separate logins for the teachers who take your batches, with what each of them can see and change under your control.",
  },
  {
    title: "Online fee collection",
    description:
      "Parents pay from the reminder itself and the payment reconciles against the right month on its own — no manual entry, no receipt to type.",
  },
  {
    title: "Every branch in one place",
    description:
      "Run more than one centre from a single account, with batch, attendance and collection numbers rolled up across all of them.",
  },
  {
    title: "Your data, everywhere",
    description:
      "Cloud sync across every device you and your staff use, instead of one browser holding the only copy.",
  },
];

export default function TuitionPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationSchema) }}
      />

      <PageHero
        eyebrow={content.hero.eyebrow}
        headline={content.hero.headline}
        subheadline={content.hero.subheadline}
      />

      <section className="mx-auto max-w-3xl px-6 pb-12">
        <FadeIn>
          <h2 className="text-2xl font-bold tracking-tight text-ink">{content.body.headline}</h2>
          {content.body.paragraphs.map((paragraph) => (
            <p key={paragraph} className="mt-4 text-lg leading-relaxed text-muted">
              {paragraph}
            </p>
          ))}
        </FadeIn>

        <FadeIn className="mt-8">
          <p className="text-sm text-muted">
            {content.crossSell.text}{" "}
            <Link
              href={content.crossSell.cta.href}
              className="font-semibold text-indigo hover:underline"
            >
              {content.crossSell.cta.label} →
            </Link>
          </p>
        </FadeIn>
      </section>

      <section className="border-t border-muted-line/20 bg-cream-paper py-16">
        <div className="mx-auto max-w-5xl px-6">
          <FadeIn>
            <h2 className="text-center text-3xl font-bold tracking-tight text-ink">
              What the paid product adds
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-center text-muted">
              The free Tuition Class Manager is free forever for one teacher. Setu Tuition is for
              the things a browser on its own genuinely cannot do.
            </p>
          </FadeIn>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {PAID_ADDITIONS.map((item) => (
              <div
                key={item.title}
                className="h-full rounded-xl border border-muted-line/20 bg-white p-6 shadow-sm"
              >
                <h3 className="mb-2 font-bold text-ink">{item.title}</h3>
                <p className="text-sm leading-relaxed text-muted">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-indigo py-16 text-center text-cream-paper">
        <div className="mx-auto max-w-2xl px-6">
          <h2 className="text-3xl font-bold tracking-tight">{content.cta.headline}</h2>
          <p className="mt-4 text-lg text-cream-paper/85">{content.cta.subtext}</p>
          <Link
            href={content.cta.cta.href}
            className="mt-8 inline-block rounded-full bg-saffron px-7 py-3 text-sm font-semibold text-ink transition hover:brightness-95"
          >
            {content.cta.cta.label} →
          </Link>
        </div>
      </section>
    </>
  );
}

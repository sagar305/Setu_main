import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getTeamContent } from "@/lib/content";
import { personSchema } from "@/lib/schema";
import { PageHero } from "@/components/PageHero";
import { FadeIn } from "@/components/motion/FadeIn";

const content = getTeamContent();

export const metadata: Metadata = {
  title: content.seo.title,
  description: content.seo.description,
  keywords: content.seo.keywords,
  alternates: { canonical: "/team" },
  openGraph: {
    title: content.seo.title,
    description: content.seo.description,
    url: "/team",
    images: [
      {
        url: "/og/setu-og-image-1200x627.png",
        width: 1200,
        height: 627,
        alt: "Setu Technology - Setu for your business",
      },
    ],
  },
};

// Each member is also the target of the author URL used in blog Article schema,
// so the anchor ids here must stay in step with the slugs in team.json.
const teamSchema = {
  "@context": "https://schema.org",
  "@type": "ProfilePage",
  mainEntity: {
    "@type": "Organization",
    name: "Setu Technology",
    url: "https://setutechnology.com",
    employee: content.members.map(personSchema),
  },
};

export default function TeamPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(teamSchema) }}
      />

      <PageHero
        eyebrow={content.hero.eyebrow}
        headline={content.hero.headline}
        subheadline={content.hero.subheadline}
      />

      <section className="mx-auto max-w-4xl px-6 pb-16">
        <div className="grid gap-6 sm:grid-cols-2">
          {content.members.map((member) => (
            <FadeIn key={member.slug}>
              <article
                id={member.slug}
                className="h-full scroll-mt-24 rounded-2xl border border-muted-line/30 bg-white p-6"
              >
                {member.image && (
                  <Image
                    src={member.image}
                    alt={member.name}
                    width={96}
                    height={96}
                    className="mb-4 h-24 w-24 rounded-full object-cover"
                  />
                )}

                <h2 className="text-xl font-bold tracking-tight text-ink">{member.name}</h2>
                <p className="mt-1 text-sm font-semibold text-indigo">{member.role}</p>

                {/* No `uppercase` on the line below — it would render "PhD" as "PHD". */}
                {member.education.length > 0 && (
                  <p className="mt-1 text-xs font-medium tracking-wide text-muted-warm">
                    {member.education.join(" · ")}
                  </p>
                )}

                {member.bio && (
                  <p className="mt-4 text-sm leading-relaxed text-muted">{member.bio}</p>
                )}

                {member.social.length > 0 && (
                  <ul className="mt-4 flex flex-wrap gap-4">
                    {member.social.map((link) => (
                      <li key={link.href}>
                        <Link
                          href={link.href}
                          className="text-sm font-semibold text-indigo hover:underline"
                        >
                          {link.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            </FadeIn>
          ))}
        </div>
      </section>
    </>
  );
}

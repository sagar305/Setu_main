import Link from "next/link";
import { ArrowRight, BadgeCheck, Check, Landmark, Scale } from "lucide-react";
import { FadeIn, FadeInStagger, FadeInStaggerItem } from "@/components/motion/FadeIn";
import { LanguageLinks } from "@/components/home/LanguageLinks";
import { ToolCard } from "@/components/tools/ToolCard";
import { CalculatorCard } from "@/components/calculators/CalculatorCard";
import { ContactForm } from "@/components/ContactForm";
import { ContactFab } from "@/components/consultancy/ContactFab";
import {
  getBlogContent,
  getBlogPostUrl,
  getCalculatorsContent,
  getToolsContent,
  slugifyCategory,
  type ConsultancyContent,
} from "@/lib/content";
import { getLocalizedContent } from "@/lib/i18n/page-content";
import type { LanguageCode } from "@/lib/i18n/config";

/**
 * The consultancy page body, shared by /consultancy and its translations.
 *
 * The tool and calculator cards are looked up by slug from their own
 * directories, so they carry the same name, description and translation as
 * everywhere else on the site rather than a second copy kept here.
 */

const CONTACT_ID = "consultancy-contact";

const PRODUCT_ICONS: Record<string, typeof Scale> = { scale: Scale, landmark: Landmark };

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function pick<T extends { slug: string }>(items: T[], slugs: string[]): T[] {
  return slugs.flatMap((slug) => items.find((item) => item.slug === slug) ?? []);
}

function SectionHeader({
  headline,
  subtext,
  seeMore,
}: {
  headline: string;
  subtext: string;
  seeMore?: { label: string; href: string };
}) {
  return (
    <FadeIn className="flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        <h2 className="text-3xl font-bold tracking-tight text-ink">{headline}</h2>
        <p className="mt-4 text-lg text-muted">{subtext}</p>
      </div>
      {seeMore && (
        <Link
          prefetch={false}
          href={seeMore.href}
          className="inline-flex items-center gap-1 text-sm font-semibold text-indigo hover:underline"
        >
          {seeMore.label}
          <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
        </Link>
      )}
    </FadeIn>
  );
}
function CheckItem({ children }: { children: React.ReactNode }) {
  return (
    <FadeInStaggerItem className="flex items-start gap-3">
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo/10 text-indigo">
        <Check className="h-3 w-3" strokeWidth={3} />
      </span>
      <span className="text-base leading-relaxed text-muted">{children}</span>
    </FadeInStaggerItem>
  );
}

export function ConsultancySections({
  content,
  lang,
}: {
  content: ConsultancyContent;
  lang: LanguageCode;
}) {
  const posts = getBlogContent()
    .posts.filter((post) => slugifyCategory(post.category) === content.blog.category)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3);
  const tools = pick(getLocalizedContent("tools", lang, getToolsContent()).items, content.tools.slugs);
  const calculators = pick(
    getLocalizedContent("calculators", lang, getCalculatorsContent()).items,
    content.calculators.slugs,
  );

  return (
    <>
      <section className="mx-auto max-w-4xl px-6 pb-12 pt-20 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-warm">
          {content.hero.eyebrow}
        </p>
        <h1 className="mt-4 text-4xl font-bold tracking-tight text-ink md:text-5xl">
          {content.hero.headline}
        </h1>
        <p className="mx-auto mt-5 inline-flex max-w-2xl items-start gap-2 rounded-2xl bg-indigo/10 px-4 py-2 text-start text-sm font-semibold text-indigo sm:items-center sm:rounded-full sm:text-base">
          <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 sm:mt-0" aria-hidden="true" />
          {content.hero.teamNote}
        </p>
        <p className="mx-auto mt-5 max-w-2xl whitespace-pre-line text-lg leading-relaxed text-muted">
          {content.hero.subheadline}
        </p>
      </section>

      {/* Frequency options */}
      <section className="mx-auto max-w-5xl px-6 pb-12">
        <FadeIn>
          <div className="rounded-2xl border border-indigo/15 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-lg font-semibold text-ink">{content.frequency.headline}</h2>
            <p className="mt-2 text-sm text-muted">{content.frequency.subtext}</p>
            <FadeInStagger className="mt-5 flex flex-wrap gap-2">
              {content.frequency.options.map((option) => (
                <FadeInStaggerItem key={option}>
                  <span className="inline-block rounded-full bg-cream px-4 py-2 text-sm font-medium text-ink transition hover:bg-indigo/10 hover:text-indigo">
                    {option}
                  </span>
                </FadeInStaggerItem>
              ))}
            </FadeInStagger>
          </div>
        </FadeIn>
      </section>

      {/* Overview — full scope of book maintenance */}
      <section className="mx-auto max-w-5xl px-6 py-12">
        <FadeIn className="max-w-2xl">
          <h2 className="text-3xl font-bold tracking-tight text-ink">{content.overview.headline}</h2>
          <p className="mt-4 text-lg text-muted">{content.overview.intro}</p>
        </FadeIn>
        <FadeInStagger className="mt-8 grid gap-4 sm:grid-cols-2">
          {content.overview.items.map((item) => (
            <CheckItem key={item}>{item}</CheckItem>
          ))}
        </FadeInStagger>
      </section>

      {/* Services included */}
      <section className="bg-cream py-16">
        <div className="mx-auto max-w-5xl px-6">
          <FadeIn className="max-w-2xl">
            <h2 className="text-3xl font-bold tracking-tight text-ink">
              {content.servicesIncluded.headline}
            </h2>
            <p className="mt-4 text-lg text-muted">{content.servicesIncluded.subtext}</p>
          </FadeIn>
          <FadeInStagger className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {content.servicesIncluded.items.map((item) => (
              <FadeInStaggerItem
                key={item.title}
                className="flex flex-col rounded-2xl border border-transparent bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo/15 hover:shadow-md"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo/10 text-indigo">
                  <Check className="h-4 w-4" strokeWidth={3} aria-hidden="true" />
                </span>
                <h3 className="mt-4 text-lg font-semibold text-ink">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{item.description}</p>
              </FadeInStaggerItem>
            ))}
          </FadeInStagger>
        </div>
      </section>

      {/* Products */}
      <section className="mx-auto max-w-5xl px-6 py-16">
        <SectionHeader headline={content.products.headline} subtext={content.products.subtext} />
        <FadeInStagger className="mt-8 grid gap-6 md:grid-cols-2">
          {content.products.items.map((product) => {
            const Icon = PRODUCT_ICONS[product.icon] ?? Scale;
            return (
              <FadeInStaggerItem
                key={product.id}
                className="flex flex-col rounded-2xl border border-indigo/15 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:p-8"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo text-cream-paper">
                    <Icon className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <span className="rounded-full bg-saffron/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-ink">
                    {content.products.freeLabel}
                  </span>
                </div>
                <h3 className="mt-5 text-xl font-bold text-ink">{product.name}</h3>
                <p className="mt-2 text-base leading-relaxed text-muted">{product.description}</p>
                <ul className="mt-5 flex flex-1 flex-col gap-2.5">
                  {product.highlights.map((highlight) => (
                    <li key={highlight} className="flex items-start gap-2.5 text-sm text-muted">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-indigo" strokeWidth={3} aria-hidden="true" />
                      {highlight}
                    </li>
                  ))}
                </ul>
                <Link
                  prefetch={false}
                  href={product.cta.href}
                  className="mt-6 inline-flex items-center justify-center gap-1.5 self-start rounded-full bg-indigo px-6 py-3 text-sm font-semibold text-cream-paper transition hover:bg-ink"
                >
                  {product.cta.label}
                  <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
                </Link>
              </FadeInStaggerItem>
            );
          })}
        </FadeInStagger>
      </section>

      {/* Software expertise */}
      <section className="bg-cream py-16">
        <div className="mx-auto max-w-5xl px-6">
        <FadeIn className="max-w-2xl">
          <h2 className="text-3xl font-bold tracking-tight text-ink">{content.software.headline}</h2>
          <p className="mt-4 text-lg text-muted">{content.software.subtext}</p>
        </FadeIn>
        <FadeInStagger className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {content.software.items.map((item) => (
            <FadeInStaggerItem
              key={item.name}
              className="flex items-center gap-4 rounded-2xl border border-muted-line/30 bg-white p-5 transition hover:-translate-y-1 hover:border-indigo/20 hover:shadow-md"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-cream">
                {item.logo ? (
                  <span
                    role="img"
                    aria-label={`${item.name} logo`}
                    className="h-7 w-7"
                    style={{
                      backgroundColor: item.color,
                      WebkitMaskImage: `url(${item.logo})`,
                      maskImage: `url(${item.logo})`,
                      WebkitMaskRepeat: "no-repeat",
                      maskRepeat: "no-repeat",
                      WebkitMaskPosition: "center",
                      maskPosition: "center",
                      WebkitMaskSize: "contain",
                      maskSize: "contain",
                    }}
                  />
                ) : (
                  <span
                    className="text-base font-bold uppercase"
                    style={{ color: item.color }}
                    aria-hidden="true"
                  >
                    {item.mark}
                  </span>
                )}
              </span>
              <span>
                <span className="block text-lg font-semibold text-ink">{item.name}</span>
                <span className="mt-0.5 block text-sm text-muted">{item.detail}</span>
              </span>
            </FadeInStaggerItem>
          ))}
        </FadeInStagger>
        </div>
      </section>

      {/* Ideal for */}
      <section className="py-16">
        <div className="mx-auto max-w-5xl px-6">
          <FadeIn className="max-w-2xl">
            <h2 className="text-3xl font-bold tracking-tight text-ink">{content.idealFor.headline}</h2>
            <p className="mt-4 text-lg text-muted">{content.idealFor.subtext}</p>
          </FadeIn>
          <FadeInStagger className="mt-8 grid gap-4 sm:grid-cols-3">
            {content.idealFor.items.map((item) => (
              <FadeInStaggerItem
                key={item}
                className="rounded-2xl border border-indigo/15 bg-white p-5 text-base leading-relaxed text-muted transition hover:-translate-y-1 hover:shadow-md"
              >
                {item}
              </FadeInStaggerItem>
            ))}
          </FadeInStagger>
        </div>
      </section>

      {/* Latest accounting posts */}
      {posts.length > 0 && (
        <section className="bg-cream py-16">
          <div className="mx-auto max-w-5xl px-6">
            <SectionHeader
              headline={content.blog.headline}
              subtext={content.blog.subtext}
              seeMore={content.blog.seeMore}
            />
            <FadeInStagger className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {posts.map((post) => (
                <FadeInStaggerItem
                  key={post.slug}
                  className="flex flex-col rounded-2xl border border-muted-line/20 bg-white p-6 shadow-sm"
                >
                  <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-muted-warm">
                    <span>{post.category}</span>
                    <span aria-hidden="true">·</span>
                    <time dateTime={post.date}>{formatDate(post.date)}</time>
                  </div>
                  <Link prefetch={false} href={getBlogPostUrl(post)}>
                    <h3 className="mt-3 text-lg font-bold text-ink transition hover:text-indigo">
                      {post.title}
                    </h3>
                  </Link>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{post.excerpt}</p>
                  <Link
                    prefetch={false}
                    href={getBlogPostUrl(post)}
                    className="mt-4 text-sm font-semibold text-indigo hover:underline"
                  >
                    {content.blog.readMore} →
                  </Link>
                </FadeInStaggerItem>
              ))}
            </FadeInStagger>
          </div>
        </section>
      )}

      {/* Free tools */}
      {tools.length > 0 && (
        <section className="mx-auto max-w-5xl px-6 py-16">
          <SectionHeader
            headline={content.tools.headline}
            subtext={content.tools.subtext}
            seeMore={content.tools.seeMore}
          />
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {tools.map((item) => (
              <ToolCard key={item.slug} item={item} lang={lang} />
            ))}
          </div>
        </section>
      )}

      {/* Free calculators */}
      {calculators.length > 0 && (
        <section className="bg-cream py-16">
          <div className="mx-auto max-w-5xl px-6">
            <SectionHeader
              headline={content.calculators.headline}
              subtext={content.calculators.subtext}
              seeMore={content.calculators.seeMore}
            />
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {calculators.map((item) => (
                <CalculatorCard key={item.slug} item={item} lang={lang} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Enquiry form — replaces the old "Talk to us" link to /contact */}
      <section id={CONTACT_ID} className="scroll-mt-20 bg-indigo py-16 text-cream-paper">
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-10 px-6 lg:grid-cols-[1fr_1.2fr] lg:items-start">
          <div className="min-w-0 lg:pt-6">
            <h2 className="text-3xl font-bold tracking-tight">{content.contact.headline}</h2>
            <p className="mt-4 text-lg text-cream-paper/85">{content.contact.subtext}</p>
            <p className="mt-6 inline-flex items-start gap-2 text-sm font-semibold text-cream-paper/90">
              <BadgeCheck className="h-5 w-5 shrink-0 text-saffron" aria-hidden="true" />
              {content.hero.teamNote}
            </p>
          </div>
          <div className="min-w-0 text-ink">
            <ContactForm form={content.contact.form} topic="consultancy" markRequired />
          </div>
        </div>
      </section>

      <LanguageLinks page="consultancy" current={lang} />

      <ContactFab label={content.contact.floatingLabel} targetId={CONTACT_ID} />
    </>
  );
}

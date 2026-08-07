import Link from "next/link";
import { Logo } from "@/components/Logo";
import type { SiteContent } from "@/lib/content";

export function Footer({ site }: { site: SiteContent }) {
  return (
    <footer className="border-t border-muted-line/30 bg-ink text-cream-paper">
      <div className="mx-auto max-w-6xl px-6 py-16">
        {/* Brand block, then one track per link column. The column count has to
            match the number of link columns, or the last one wraps underneath
            the brand and leaves a hole in the grid. */}
        <div className="grid grid-cols-2 gap-x-8 gap-y-10 lg:grid-cols-[1.5fr_repeat(4,minmax(0,1fr))]">
          <div className="col-span-2 flex flex-col gap-4 lg:col-span-1">
            <Logo variant="dark" size={32} />
            <p className="max-w-xs text-sm leading-relaxed text-muted-line">
              {site.footer.description}
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-2 pt-2">
              {site.footer.social.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-semibold uppercase tracking-wide text-muted-line transition hover:text-saffron"
                >
                  {s.label}
                </a>
              ))}
            </div>
          </div>

          {site.footer.columns.map((col) => (
            <nav key={col.heading} aria-label={col.heading} className="flex flex-col gap-3">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-saffron/80">
                {col.heading}
              </span>
              {col.links.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className="text-sm text-cream-paper/80 transition hover:text-saffron"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          ))}
        </div>

        <div className="mt-14 flex flex-col gap-4 border-t border-muted-line/20 pt-6 text-xs text-muted-line sm:flex-row sm:items-center sm:justify-between">
          <span>{site.footer.copyright}</span>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <Link href="/pricing" className="transition hover:text-saffron">
              Pricing
            </Link>
            <Link href="/team" className="transition hover:text-saffron">
              Team
            </Link>
            <Link href="/sitemap" className="transition hover:text-saffron">
              Sitemap
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

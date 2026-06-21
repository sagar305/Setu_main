import Link from "next/link";
import { Logo } from "@/components/Logo";
import type { SiteContent } from "@/lib/content";

export function Footer({ site }: { site: SiteContent }) {
  return (
    <footer className="border-t border-muted-line/30 bg-ink text-cream-paper">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-12 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="flex flex-col gap-4">
            <Logo variant="dark" size={32} />
            <p className="max-w-xs text-sm text-muted-line">{site.footer.description}</p>
            <div className="flex gap-4 pt-2">
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
            <div key={col.heading} className="flex flex-col gap-3">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-line">
                {col.heading}
              </span>
              {col.links.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className="text-sm text-cream-paper/90 transition hover:text-saffron"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          ))}
        </div>

        <div className="mt-12 border-t border-muted-line/20 pt-6 text-xs text-muted-line">
          {site.footer.copyright}
        </div>
      </div>
    </footer>
  );
}

import Link from "next/link";
import { Logo } from "@/components/Logo";
import type { SiteContent } from "@/lib/content";

export function Nav({ site }: { site: SiteContent }) {
  return (
    <header className="sticky top-0 z-50 border-b border-transparent bg-cream/95 backdrop-blur supports-[backdrop-filter]:bg-cream/80">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" aria-label={site.brand.name}>
          <Logo size={32} />
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {site.nav.links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-ink/80 transition hover:text-indigo"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <Link
          href={site.nav.cta.href}
          className="rounded-full bg-indigo px-5 py-2.5 text-sm font-semibold text-cream-paper transition hover:bg-ink"
        >
          {site.nav.cta.label}
        </Link>
      </div>
    </header>
  );
}

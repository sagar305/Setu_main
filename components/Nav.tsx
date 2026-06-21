"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/Logo";
import type { SiteContent } from "@/lib/content";

export function Nav({ site }: { site: SiteContent }) {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-transparent bg-cream/95 backdrop-blur supports-[backdrop-filter]:bg-cream/80">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" aria-label={site.brand.name} onClick={() => setOpen(false)}>
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
          className="hidden rounded-full bg-indigo px-5 py-2.5 text-sm font-semibold text-cream-paper transition hover:bg-ink md:inline-block"
        >
          {site.nav.cta.label}
        </Link>

        <button
          type="button"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="flex h-10 w-10 items-center justify-center rounded-full text-ink md:hidden"
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {open && (
        <nav className="flex flex-col gap-1 border-t border-muted-line/20 bg-cream px-6 py-4 md:hidden">
          {site.nav.links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-3 text-sm font-medium text-ink/80 transition hover:bg-white hover:text-indigo"
            >
              {link.label}
            </Link>
          ))}
          <Link
            href={site.nav.cta.href}
            onClick={() => setOpen(false)}
            className="mt-2 rounded-full bg-indigo px-5 py-3 text-center text-sm font-semibold text-cream-paper transition hover:bg-ink"
          >
            {site.nav.cta.label}
          </Link>
        </nav>
      )}
    </header>
  );
}

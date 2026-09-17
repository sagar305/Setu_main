"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { pageFromPath } from "@/lib/i18n/pages";

/**
 * The header/main/footer frame around every page.
 *
 * The root layout cannot know which language is being served — it has no
 * dynamic segment — so the translated pages lay out their own chrome, in their
 * own language, from app/[lang]/layout.tsx. This renders the English frame
 * everywhere else, and steps aside on those routes so the page is not wrapped
 * in two headers.
 *
 * `nav` and `footer` arrive as rendered elements rather than being imported
 * here, so this stays a few lines of client code instead of pulling the whole
 * chrome — and every language's copy of it — into the shared bundle.
 */
export function SiteFrame({
  nav,
  footer,
  children,
}: {
  nav: ReactNode;
  footer: ReactNode;
  children: ReactNode;
}) {
  const page = pageFromPath(usePathname());
  const localized = page !== null && page.lang !== "en";

  if (localized) return <>{children}</>;

  return (
    <>
      {nav}
      <main>{children}</main>
      {footer}
    </>
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { tokenSystemEnabled } from "@/lib/featureFlags";
import { DisplayApp } from "@/components/tools/Token/DisplayApp";

/**
 * The waiting-room screen, on its own route so it can be opened in a second
 * tab and left running on a TV.
 *
 * Deliberately noindex: this renders one device's live queue, not a page
 * anyone should reach from a search result. It is kept out of app/sitemap.ts
 * for the same reason.
 */
/**
 * Metadata is generated rather than exported flat, because a flat export is
 * evaluated even when the component below calls notFound(). The rendered
 * <head> was already correct, but the RSC payload embedded in the 404 still
 * carried this page's title, description and OG tags — view-source on a page
 * that does not exist yet was showing an unreleased product's marketing copy.
 */
export function generateMetadata(): Metadata {
  if (!tokenSystemEnabled()) return {};
  return {
  title: "Waiting Room Display — Free Token System | Setu",
  description:
    "Live token display for the Setu Free Token System. Shows the number being called, on the same device as the counter, with no server in between.",
  robots: { index: false, follow: false },
  alternates: { canonical: "/products/free-token-system/display" },
};
}

export default function TokenDisplayPage() {
  if (!tokenSystemEnabled()) notFound();

  return <DisplayApp />;
}

import type { Metadata } from "next";
import { DisplayApp } from "@/components/tools/Token/DisplayApp";

/**
 * The waiting-room screen, on its own route so it can be opened in a second
 * tab and left running on a TV.
 *
 * Deliberately noindex: this renders one device's live queue, not a page
 * anyone should reach from a search result. It is kept out of app/sitemap.ts
 * for the same reason.
 */
export const metadata: Metadata = {
  title: "Waiting Room Display — Free Token System | Setu",
  description:
    "Live token display for the Setu Free Token System. Shows the number being called, on the same device as the counter, with no server in between.",
  robots: { index: false, follow: false },
  alternates: { canonical: "/products/free-token-system/display" },
};

export default function TokenDisplayPage() {
  return <DisplayApp />;
}

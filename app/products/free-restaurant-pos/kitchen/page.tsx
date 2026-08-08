import type { Metadata } from "next";
import { KitchenApp } from "@/components/tools/FreeDine/KitchenApp";

/**
 * The kitchen display, on its own route so it can be opened in a second tab
 * and left on the pass.
 *
 * Deliberately noindex: this is an app screen that renders one device's live
 * orders, not a page anyone should reach from a search result. It is also kept
 * out of app/sitemap.ts for the same reason.
 */
export const metadata: Metadata = {
  title: "Kitchen Screen — Free Dine | Setu",
  description:
    "Live kitchen order screen for Free Dine. Shows every round the counter sends, on the same device, with no server in between.",
  robots: { index: false, follow: false },
  alternates: { canonical: "/products/free-restaurant-pos/kitchen" },
};

export default function FreeDineKitchenPage() {
  return <KitchenApp />;
}

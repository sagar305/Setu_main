"use client";

import { usePathname } from "next/navigation";
import { localizedHref, pageFromPath } from "./pages";

/**
 * `localizedHref` for a client component, with the language read off the URL.
 *
 * The tools are rendered from a registry that passes no props, so a tool cannot
 * be handed the language the way a server component is. The links a tool writes
 * were therefore always English paths, and a reader on /hi/tools/credit-note
 * who tapped "Business Profile" was dropped onto the English tool — out of the
 * language mid-task. Reading the language from the pathname keeps the registry
 * free of per-request state.
 *
 * Only the href moves. The copy around these links is still English on every
 * route, which is a separate piece of work.
 */
export function useLocalizedHref(): (href: string) => string {
  const lang = pageFromPath(usePathname())?.lang ?? "en";
  return (href: string) => localizedHref(href, lang);
}

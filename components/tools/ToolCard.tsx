import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CalculatorIcon } from "@/components/calculators/CalculatorIcon";
import type { LanguageCode } from "@/lib/i18n/config";
import { itemLocalesFor, itemPathFor, localizedHref } from "@/lib/i18n/pages";
import { translate } from "@/lib/i18n/translate";

/** Just the fields a card shows, so a localized item can be passed straight in. */
type CardItem = {
  slug: string;
  href?: string;
  name: string;
  icon: string;
  shortDescription: string;
};

export function ToolCard({
  item,
  lang = "en",
}: {
  item: CardItem;
  /**
   * The language of the page this card sits on, as CalculatorCard already takes
   * it. Without it every card on /hi/tools pointed at the English tool, so the
   * reader left the language on their first click. An item whose own copy is
   * not translated yet still links to English, which is the honest answer.
   */
  lang?: LanguageCode;
}) {
  // A few items point somewhere other than their own page — a product page, say
  // — so those go through localizedHref rather than being rebuilt from the slug.
  const href = item.href
    ? localizedHref(item.href, lang)
    : itemPathFor("tools", item.slug, itemLocalesFor("tools", item.slug).includes(lang) ? lang : "en");
  return (
    <Link
      href={href}
      className="group flex flex-col rounded-2xl border border-muted-line/30 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo/30 hover:shadow-md"
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-cream text-indigo">
        <CalculatorIcon name={item.icon} className="h-5 w-5" />
      </span>
      <h3 className="mt-4 text-lg font-bold text-ink">{item.name}</h3>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{item.shortDescription}</p>
      <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-indigo">
        {translate(lang, "toolTryIt")}
        <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden="true" />
      </span>
    </Link>
  );
}

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CalculatorIcon } from "@/components/calculators/CalculatorIcon";
import type { CalculatorItem } from "@/lib/content";
import type { LanguageCode } from "@/lib/i18n/config";
import { itemLocalesFor, itemPathFor } from "@/lib/i18n/pages";

export function CalculatorCard({
  item,
  lang = "en",
}: {
  item: CalculatorItem;
  /**
   * The language of the page this card sits on. The card links to that
   * calculator's page in the same language when it has one, and to the English
   * page when it does not — which is the honest answer while the translations
   * are still landing, and better than a link to a route that is not built.
   */
  lang?: LanguageCode;
}) {
  const href = itemLocalesFor("calculators", item.slug).includes(lang)
    ? itemPathFor("calculators", item.slug, lang)
    : itemPathFor("calculators", item.slug, "en");

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
        Try it
        <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden="true" />
      </span>
    </Link>
  );
}

"use client";

import { useSearchParams } from "next/navigation";
import { ArrowRight, Ticket } from "lucide-react";
import { useI18n } from "@/lib/i18n";

/**
 * What a customer sees after scanning the poster.
 *
 * The business and service names travel in the query string, because that is
 * all the poster can carry — this page has no access to the counter's queue.
 * Both are rendered as plain text, never as markup.
 */
export function PosterLanding() {
  const { t } = useI18n();
  const params = useSearchParams();
  const business = (params.get("b") ?? "").slice(0, 80);
  const service = (params.get("s") ?? "").slice(0, 80);

  return (
    <div className="rounded-3xl border border-muted-line/30 bg-white p-8 text-center">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo text-white">
        <Ticket className="h-7 w-7" aria-hidden="true" />
      </span>

      <h1 className="mt-5 text-2xl font-bold tracking-tight text-ink">
        {business || t("tkPlTitle")}
      </h1>
      {service && <p className="mt-1 text-sm font-semibold text-muted">{service}</p>}

      <p className="mt-6 rounded-2xl bg-cream-paper px-5 py-4 text-lg font-semibold text-ink">
        {t("tkPlLead")}
      </p>

      <ol className="mx-auto mt-6 grid max-w-sm gap-2 text-left text-sm text-muted">
        <li className="flex items-start gap-2">
          <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-indigo" aria-hidden="true" />
          {t("tkPlStep1")}
        </li>
        <li className="flex items-start gap-2">
          <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-indigo" aria-hidden="true" />
          {t("tkPlStep2")}
        </li>
        <li className="flex items-start gap-2">
          <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-indigo" aria-hidden="true" />
          {t("tkPlStep3")}
        </li>
      </ol>
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import {
  formatPrice,
  yearlySavingPercent,
  type PricingContent,
  type PricingRegionId,
} from "@/lib/pricing";

type Billing = "monthly" | "yearly";

export function PricingTable({ content }: { content: PricingContent }) {
  const [regionId, setRegionId] = useState<PricingRegionId>("IN");
  const [billing, setBilling] = useState<Billing>("monthly");

  const region = content.regions.find((r) => r.id === regionId) ?? content.regions[0];

  return (
    <div className="mx-auto max-w-6xl px-6 pb-16">
      {/* Toggles */}
      <div className="flex flex-col items-center gap-4">
        <div className="flex flex-wrap items-center justify-center gap-3">
          <div
            role="group"
            aria-label="Region"
            className="flex rounded-full border border-muted-line/40 bg-white p-1"
          >
            {content.regions.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setRegionId(r.id)}
                aria-pressed={r.id === regionId}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                  r.id === regionId ? "bg-indigo text-cream-paper" : "text-muted hover:text-ink"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          <div
            role="group"
            aria-label="Billing period"
            className="flex rounded-full border border-muted-line/40 bg-white p-1"
          >
            {(["monthly", "yearly"] as const).map((period) => (
              <button
                key={period}
                type="button"
                onClick={() => setBilling(period)}
                aria-pressed={period === billing}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold capitalize transition ${
                  period === billing ? "bg-indigo text-cream-paper" : "text-muted hover:text-ink"
                }`}
              >
                {period}
              </button>
            ))}
          </div>
        </div>

        <p className="max-w-2xl text-center text-sm text-muted">{content.billingNote}</p>
      </div>

      {/* Plans */}
      <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {content.plans.map((plan) => {
          const amounts = plan.price?.[regionId] ?? null;
          const saving = amounts ? yearlySavingPercent(amounts) : null;
          const isPaid = plan.status === "paid";
          const unavailable = plan.status === "in-development";

          return (
            <article
              key={plan.slug}
              className={`flex flex-col rounded-2xl border bg-white p-6 ${
                unavailable ? "border-muted-line/25 opacity-90" : "border-muted-line/30"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-lg font-bold tracking-tight text-ink">{plan.name}</h2>
                <span className="whitespace-nowrap rounded-full bg-saffron/20 px-3 py-1 text-xs font-semibold text-ink">
                  {plan.freeNote}
                </span>
              </div>

              <p className="mt-3 text-sm leading-relaxed text-muted">{plan.summary}</p>

              <div className="mt-5 min-h-[64px]">
                {unavailable || !amounts ? (
                  <p className="text-2xl font-bold text-muted-warm">Coming soon</p>
                ) : (
                  <>
                    <p className="text-3xl font-bold tracking-tight text-ink">
                      {formatPrice(amounts[billing], region)}
                      {isPaid && (
                        <span className="ml-1 text-sm font-semibold text-muted">
                          /{billing === "monthly" ? "month" : "year"}
                        </span>
                      )}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {isPaid ? (
                        <>
                          per business, incl. GST
                          {billing === "yearly" && saving !== null && ` · save ${saving}%`}
                        </>
                      ) : (
                        "Free forever, no signup"
                      )}
                    </p>
                  </>
                )}
              </div>

              <ul className="mt-5 flex-1 space-y-2.5">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-2.5 text-sm text-muted">
                    <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-indigo" aria-hidden="true" />
                    {feature}
                  </li>
                ))}
              </ul>

              <Link
                href={plan.cta.href}
                className={`mt-6 rounded-full px-5 py-2.5 text-center text-sm font-semibold transition ${
                  unavailable
                    ? "border border-muted-line/40 text-ink hover:border-indigo"
                    : "bg-indigo text-cream-paper hover:bg-ink"
                }`}
              >
                {plan.cta.label}
              </Link>
            </article>
          );
        })}
      </div>
    </div>
  );
}

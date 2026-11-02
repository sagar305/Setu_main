"use client";

import { createContext, useContext, type ReactNode } from "react";
import { Sparkles, X } from "lucide-react";
import type { WhatsNew } from "@/lib/hooks/useWhatsNew";
import type { AppUpdate } from "@/lib/whatsNew";
import type { TKey } from "@/lib/i18n/translate";

/**
 * One app's What's new state, shared by its nav, home screen and settings.
 * The app shell computes it once (it knows the business and its settings) and
 * every marker reads the same value, so acting on one clears the others.
 */
const WhatsNewContext = createContext<WhatsNew | null>(null);

export function WhatsNewProvider({ value, children }: { value: WhatsNew; children: ReactNode }) {
  return <WhatsNewContext.Provider value={value}>{children}</WhatsNewContext.Provider>;
}

/** Null outside a provider, so a screen rendered on its own simply shows no markers. */
export function useWhatsNewContext(): WhatsNew | null {
  return useContext(WhatsNewContext);
}

/**
 * The home-screen cards: one per update the owner has not dismissed or taken
 * up. "Show me" both dismisses the card and takes them to the feature.
 */
export function WhatsNewCards({
  t,
  onOpen,
}: {
  t: (key: TKey) => string;
  onOpen: (update: AppUpdate) => void;
}) {
  const whatsNew = useWhatsNewContext();
  if (!whatsNew || whatsNew.cards.length === 0) return null;

  return (
    <section aria-label={t("wnWhatsNew")} className="space-y-3">
      {whatsNew.cards.map((update) => (
        <div
          key={update.id}
          className="relative flex flex-col gap-3 rounded-2xl border border-saffron/50 bg-saffron/10 p-4 pr-11 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-saffron text-ink">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold text-ink">{t(update.title)}</p>
              <p className="mt-0.5 text-sm text-ink/75">{t(update.body)}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              whatsNew.dismiss(update.id);
              onOpen(update);
            }}
            className="inline-flex shrink-0 items-center justify-center rounded-full bg-indigo px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo/90 sm:ml-3"
          >
            {t(update.cta)}
          </button>
          <button
            type="button"
            onClick={() => whatsNew.dismiss(update.id)}
            aria-label={t("wnDismiss")}
            title={t("wnDismiss")}
            className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full text-ink/50 transition hover:bg-white hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </section>
  );
}

"use client";

import { useI18n } from "@/lib/i18n";
import type { TKey } from "@/lib/i18n/translate";

interface NotesAndTermsSectionProps {
  notes: string;
  terms: string;
  onNotesChange: (notes: string) => void;
  onTermsChange: (terms: string) => void;
}

// The chosen wording goes into the invoice the customer reads, so the
// templates are offered in the language the invoice is being written in.
const TERMS_TEMPLATES: TKey[] = ["igTerm1", "igTerm2", "igTerm3", "igTerm4"];

export function NotesAndTermsSection({
  notes,
  terms,
  onNotesChange,
  onTermsChange,
}: NotesAndTermsSectionProps) {
  const { t } = useI18n();
  return (
    <div>
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-ink">
        {t("igNotesTerms")}
      </h3>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-ink">{t("notes")}</label>
          <textarea
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            rows={3}
            className="mt-2 w-full rounded-xl border border-muted-line/40 bg-white px-4 py-3 text-base text-ink outline-none transition placeholder:text-muted-line focus-within:border-indigo"
            placeholder={t("igNotesPlaceholder")}
          />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="block text-sm font-semibold text-ink">
              {t("igTermsConditions")}
            </label>
          </div>
          <textarea
            value={terms}
            onChange={(e) => onTermsChange(e.target.value)}
            rows={3}
            className="mt-2 w-full rounded-xl border border-muted-line/40 bg-white px-4 py-3 text-base text-ink outline-none transition placeholder:text-muted-line focus-within:border-indigo"
            placeholder={t("igTermsPlaceholder")}
          />

          <div className="mt-3">
            <p className="mb-2 text-xs font-semibold text-muted-warm">{t("igQuickTemplates")}</p>
            <div className="flex flex-wrap gap-2">
              {TERMS_TEMPLATES.map((key) => {
                const text = t(key);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => onTermsChange(text)}
                    title={text}
                    className="rounded-full border border-muted-line/40 bg-cream px-3 py-1 text-xs text-muted transition hover:border-indigo hover:bg-indigo/5"
                  >
                    {text.length > 25 ? `${text.slice(0, 25)}…` : text}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

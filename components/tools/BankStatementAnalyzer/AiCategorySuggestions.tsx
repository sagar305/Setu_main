"use client";

// The categories the list is missing.
// ---------------------------------------------------------------------------
// The model cannot invent a category — it is an embedding model, it has no
// decoder, and nothing here asks it to write anything. What it can do is notice
// that several *different* merchants were all declined and all mean something
// similar, which is the shape of a category the CA does not yet have.
//
// So the proposal is honest about its two halves: the grouping is the model's,
// the name is not. Where the merchants share a word we offer it; where they do
// not, the field is left empty rather than filled with "Category 2". Either way
// the merchants are listed underneath, so the proposal can be checked before
// it is accepted.

import { useI18n } from "@/lib/i18n";
import { useEffect, useState } from "react";
import { FolderPlus, Sparkles } from "lucide-react";
import { Card, Field, PrimaryButton, SecondaryButton, Select, TextInput } from "@/components/toolkit/ui";
import { useAnalyzer } from "@/components/tools/BankStatementAnalyzer/AnalyzerProvider";
import { groupLabel, GROUP_ORDER } from "@/lib/bankStatement/classification/categories";
import { fill } from "@/lib/i18n/translate";
import { intlLocaleFor } from "@/lib/i18n/pages";
import type { CategorySuggestion } from "@/lib/bankStatement/ai/categorySuggestion";
import type { CategoryGroup } from "@/lib/bankStatement/types";

export function AiCategorySuggestions({
  suggestions,
  onDismiss,
  onAccepted,
}: {
  suggestions: CategorySuggestion[];
  onDismiss: (key: string) => void;
  onAccepted: (key: string) => void;
}) {
  const { lang, t } = useI18n();
  const { actions } = useAnalyzer();
  const [created, setCreated] = useState<{ name: string; rows: number } | null>(null);

  if (suggestions.length === 0 && !created) return null;

  const rows = suggestions.reduce((total, suggestion) => total + suggestion.transactions.length, 0);

  return (
    <Card className="border-indigo/20">
      <h3 className="flex items-center gap-2 text-lg font-bold text-ink">
        <Sparkles className="h-4 w-4 text-indigo" aria-hidden="true" />
        {suggestions.length > 0
          ? fill(t(rows === 1 ? "bsSgDontFit1" : "bsSgDontFitN"), {
              n: rows.toLocaleString(intlLocaleFor(lang)),
            })
          : t("bsSgCategoryAdded")}
      </h3>

      <p className="mt-1 text-sm text-muted">
        {suggestions.length > 0
          ? fill(t(suggestions.length === 1 ? "bsSgFellInto1" : "bsSgFellIntoN"), {
              n: suggestions.length,
            })
          : t("bsSgMovedAcross")}
      </p>

      {created ? (
        <p className="mt-3 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {fill(t(created.rows === 1 ? "bsSgCreated1" : "bsSgCreatedN"), {
            name: created.name,
            n: created.rows.toLocaleString(intlLocaleFor(lang)),
          })}
        </p>
      ) : null}

      <ul className="mt-4 space-y-3">
        {suggestions.map((suggestion) => (
          <SuggestionRow
            key={suggestion.key}
            suggestion={suggestion}
            onDismiss={() => onDismiss(suggestion.key)}
            onCreate={async (name, description, group) => {
              const result = await actions.createCategoryFromSuggestion({
                name,
                description,
                group,
                examples: suggestion.examples,
                transactions: suggestion.transactions,
              });
              if (result.created) {
                setCreated({ name, rows: result.rows });
                onAccepted(suggestion.key);
              }
              return result.reason;
            }}
          />
        ))}
      </ul>
    </Card>
  );
}

function SuggestionRow({
  suggestion,
  onDismiss,
  onCreate,
}: {
  suggestion: CategorySuggestion;
  onDismiss: () => void;
  onCreate: (
    name: string,
    description: string,
    group: CategoryGroup
  ) => Promise<string | undefined>;
}) {
  const { lang, t } = useI18n();
  const [name, setName] = useState(suggestion.name);
  const [description, setDescription] = useState(suggestion.description);
  const [group, setGroup] = useState<CategoryGroup>(suggestion.group);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // A fresh run replaces the proposals, so the fields have to follow rather
  // than keep whatever was typed against a group that no longer exists.
  useEffect(() => {
    setName(suggestion.name);
    setDescription(suggestion.description);
    setGroup(suggestion.group);
  }, [suggestion.key, suggestion.name, suggestion.description, suggestion.group]);

  return (
    <li className="rounded-xl border border-muted-line/30 p-4">
      <p className="text-sm text-muted">
        {fill(t(suggestion.merchantCount === 1 ? "bsSgMerchants1" : "bsSgMerchantsN"), {
          n: suggestion.merchantCount,
        })}{" "}
        ·{" "}
        {fill(
          t(suggestion.transactions.length === 1 ? "bsAudTxnCount1" : "bsAudTxnCountN"),
          { n: suggestion.transactions.length }
        )}
      </p>
      <p className="mt-1 text-xs text-muted">{suggestion.examples.join(" · ")}</p>

      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_10rem]">
        <Field label={t("bsSgCategoryName")}>
          <TextInput
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={
              suggestion.name === ""
                ? t("bsSgNoWord")
                : t("bsSgNameThis")
            }
          />
        </Field>
        <Field label={t("bsCmGroup")}>
          <Select value={group} onChange={(event) => setGroup(event.target.value as CategoryGroup)}>
            {GROUP_ORDER.map((option) => (
              <option key={option} value={option}>
                {groupLabel(option, lang)}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="mt-3">
        <Field label={t("bsSgWhatBelongs")}>
          <TextInput
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder={t("bsSgDescPlaceholder")}
          />
        </Field>
        <p className="mt-1 text-xs text-muted">{t("bsSgDescNote")}</p>
        <p className="mt-1 text-xs text-muted">{t("bsCmDescEnglish")}</p>
      </div>

      {problem ? (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{problem}</p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <PrimaryButton
          className="!px-3 !py-1.5 !text-xs"
          disabled={name.trim() === "" || busy}
          onClick={() => {
            setBusy(true);
            setProblem(null);
            void onCreate(name, description, group)
              .then((reason) => setProblem(reason ?? null))
              .finally(() => setBusy(false));
          }}
        >
          <span className="flex items-center gap-1">
            <FolderPlus className="h-3.5 w-3.5" aria-hidden="true" />
            {busy ? t("bsSgCreating") : t("bsSgCreateMove")}
          </span>
        </PrimaryButton>
        <SecondaryButton className="!px-3 !py-1.5 !text-xs" onClick={onDismiss}>
          {t("bsSgNotACategory")}
        </SecondaryButton>
      </div>
    </li>
  );
}

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

import { useEffect, useState } from "react";
import { FolderPlus, Sparkles } from "lucide-react";
import { Card, Field, PrimaryButton, SecondaryButton, Select, TextInput } from "@/components/toolkit/ui";
import { useAnalyzer } from "@/components/tools/BankStatementAnalyzer/AnalyzerProvider";
import { GROUP_LABELS } from "@/lib/bankStatement/classification/categories";
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
  const { actions } = useAnalyzer();
  const [created, setCreated] = useState<{ name: string; rows: number } | null>(null);

  if (suggestions.length === 0 && !created) return null;

  const rows = suggestions.reduce((total, suggestion) => total + suggestion.transactions.length, 0);

  return (
    <Card className="border-indigo/20">
      <h3 className="flex items-center gap-2 text-lg font-bold text-ink">
        <Sparkles className="h-4 w-4 text-indigo" aria-hidden="true" />
        {suggestions.length > 0
          ? `${rows.toLocaleString("en-IN")} transaction${rows === 1 ? "" : "s"} do not fit any category you have`
          : "Category added"}
      </h3>

      <p className="mt-1 text-sm text-muted">
        {suggestions.length > 0 ? (
          <>
            They fell into {suggestions.length === 1 ? "a group" : `${suggestions.length} groups`} that
            look related to each other but not to anything on your list. Adding a category is
            optional — you can also leave them uncategorised or place them by hand.
          </>
        ) : (
          <>Everything in that group has been moved across.</>
        )}
      </p>

      {created ? (
        <p className="mt-3 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <strong>{created.name}</strong> created, and {created.rows.toLocaleString("en-IN")}{" "}
          transaction{created.rows === 1 ? "" : "s"} moved into it. Rules were saved for those
          merchants, so the next statement will place them without the model.
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
        <strong className="text-ink">{suggestion.merchantCount}</strong> merchant
        {suggestion.merchantCount === 1 ? "" : "s"} ·{" "}
        <strong className="text-ink">{suggestion.transactions.length}</strong> transaction
        {suggestion.transactions.length === 1 ? "" : "s"}
      </p>
      <p className="mt-1 text-xs text-muted">{suggestion.examples.join(" · ")}</p>

      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_10rem]">
        <Field label="Category name">
          <TextInput
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={
              suggestion.name === ""
                ? "These merchants share no obvious word — you name it"
                : "Name this category"
            }
          />
        </Field>
        <Field label="Group">
          <Select value={group} onChange={(event) => setGroup(event.target.value as CategoryGroup)}>
            {(["INCOME", "EXPENSE", "TRANSFER", "CASH"] as const).map((option) => (
              <option key={option} value={option}>
                {GROUP_LABELS[option]}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="mt-3">
        <Field label="What belongs here">
          <TextInput
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Describe it in a line — this is what future transactions are matched against"
          />
        </Field>
        <p className="mt-1 text-xs text-muted">
          This sentence is what the model compares transactions to, so it matters more than the
          name. It has been filled in from the merchants above — edit it to suit.
        </p>
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
            {busy ? "Creating…" : "Create and move them"}
          </span>
        </PrimaryButton>
        <SecondaryButton className="!px-3 !py-1.5 !text-xs" onClick={onDismiss}>
          Not a category
        </SecondaryButton>
      </div>
    </li>
  );
}

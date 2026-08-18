"use client";

// Where the CA has the last word.
// ---------------------------------------------------------------------------
// Nothing the model proposes is treated as settled. Every suggestion lands here
// first, one row per merchant rather than one per transaction, and the CA either
// confirms it or supplies the right category.
//
// Both answers are worth the same to the tool: each one writes a rule for that
// merchant, so the next statement — and the next fifty rows of the same shop —
// are answered deterministically and the model is never consulted about them
// again. That is what makes the second pass faster than the first, and it is
// why correcting a wrong suggestion is worth doing rather than working around.

import { useState } from "react";
import { Check, GraduationCap, Pencil } from "lucide-react";
import { Card, PrimaryButton, SecondaryButton, Select } from "@/components/toolkit/ui";
import { useAnalyzer } from "@/components/tools/BankStatementAnalyzer/AnalyzerProvider";
import { activeCategories, categoryName, GROUP_LABELS } from "@/lib/bankStatement/classification/categories";
import { ruleAnchor, type AiSuggestionGroup } from "@/lib/bankStatement/ai/approval";
import { confidenceBand } from "@/lib/bankStatement/classification/classifier";

export function AiReviewQueue({ groups }: { groups: AiSuggestionGroup[] }) {
  const { categories, settings, rules, actions } = useAnalyzer();
  const [correcting, setCorrecting] = useState<string | null>(null);
  const [choice, setChoice] = useState("");
  const [taught, setTaught] = useState<{ label: string; category: string; rows: number; rule: boolean } | null>(null);

  // The card outlives the queue on purpose. Settling the last suggestion is
  // exactly when the CA should be told what it bought them, and unmounting the
  // moment the list empties would take that message with it.
  const taughtRules = rules.filter((rule) => rule.origin === "AI_APPROVED").length;
  if (groups.length === 0 && !taught) return null;

  const options = activeCategories(categories);
  const rows = groups.reduce((total, group) => total + group.transactions.length, 0);

  const settle = async (group: AiSuggestionGroup, categoryId: string, approved: boolean) => {
    const result = await actions.resolveAiSuggestion(group.transactions, categoryId, approved);
    setCorrecting(null);
    setChoice("");
    setTaught({
      label: group.label,
      category: categoryName(categories, categoryId),
      rows: result.rows,
      rule: result.ruleSaved,
    });
  };

  return (
    <Card className={groups.length > 0 ? "border-amber-200" : "border-emerald-200"}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-ink">
            {groups.length > 0
              ? `${groups.length.toLocaleString("en-IN")} suggestion${groups.length === 1 ? "" : "s"} waiting for you`
              : "All suggestions reviewed"}
          </h3>
          <p className="mt-1 text-sm text-muted">
            {groups.length > 0 ? (
              <>
                Covering {rows.toLocaleString("en-IN")} transaction{rows === 1 ? "" : "s"}. Approve
                what is right, correct what is not — either way the answer is saved as a rule for
                that merchant, so this never has to be asked again and the next statement is faster.
              </>
            ) : (
              <>
                Nothing is left for the model to ask about. Everything you settled is now a rule on
                this device.
              </>
            )}
          </p>
        </div>
      </div>

      {taughtRules > 0 ? (
        <p className="mt-3 text-xs text-muted">
          <strong className="text-ink">{taughtRules.toLocaleString("en-IN")}</strong> merchant
          {taughtRules === 1 ? "" : "s"} taught so far. Each one is matched instantly from now on —
          the model is never asked about them again, which is what makes the next statement quicker
          than this one.
        </p>
      ) : null}

      {taught ? (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <GraduationCap className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            <strong>{taught.label}</strong> → {taught.category}, applied to{" "}
            {taught.rows.toLocaleString("en-IN")} transaction{taught.rows === 1 ? "" : "s"}.{" "}
            {taught.rule
              ? "Saved as a rule on this device — the next statement will categorise it instantly, without the model."
              : "Remembered on this device. This narration has no merchant text to write a rule on, so it will be matched from memory instead."}
          </span>
          <button
            type="button"
            onClick={() => setTaught(null)}
            className="ml-auto shrink-0 text-xs font-semibold text-emerald-700 underline"
          >
            Dismiss
          </button>
        </p>
      ) : null}

      <ul className="mt-4 space-y-2">
        {groups.map((group) => {
          const band = confidenceBand(group.score);
          const strong = group.score >= settings.aiAutoThreshold;
          const anchor = ruleAnchor(group.transactions[0]);

          return (
            <li key={group.key} className="rounded-xl border border-muted-line/30 px-4 py-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-[160px] flex-1">
                  <p className="truncate text-sm font-semibold text-ink" title={group.transactions[0].narration}>
                    {group.label}
                  </p>
                  <p className="truncate text-xs text-muted">
                    {group.transactions.length.toLocaleString("en-IN")} transaction
                    {group.transactions.length === 1 ? "" : "s"} ·{" "}
                    {group.transactions[0].transactionType === "DEBIT" ? "paid out" : "received"}
                    {group.similarity !== undefined
                      ? ` · model similarity ${group.similarity.toFixed(2)}`
                      : ""}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted">suggests</span>
                  <span className="rounded-lg bg-cream-paper/70 px-2.5 py-1 text-sm font-semibold text-ink">
                    {categoryName(categories, group.suggestedCategory)}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      band === "high"
                        ? "bg-emerald-100 text-emerald-700"
                        : band === "medium"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-cream text-muted"
                    }`}
                    title={`Model confidence score ${group.score}%${strong ? "" : " — a close call, worth a look"}`}
                  >
                    {group.score}%
                  </span>
                </div>

                <div className="flex gap-2">
                  <PrimaryButton
                    className="!px-3 !py-1.5 !text-xs"
                    disabled={!group.suggestedCategory}
                    onClick={() =>
                      group.suggestedCategory && void settle(group, group.suggestedCategory, true)
                    }
                  >
                    <span className="flex items-center gap-1">
                      <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      Approve
                    </span>
                  </PrimaryButton>
                  <SecondaryButton
                    className="!px-3 !py-1.5 !text-xs"
                    onClick={() => {
                      setCorrecting(correcting === group.key ? null : group.key);
                      setChoice(group.suggestedCategory ?? "");
                    }}
                  >
                    <span className="flex items-center gap-1">
                      <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                      {correcting === group.key ? "Cancel" : "Not right"}
                    </span>
                  </SecondaryButton>
                </div>
              </div>

              {correcting === group.key ? (
                <div className="mt-3 rounded-lg bg-cream-paper/50 px-3 py-3">
                  <p className="text-xs text-muted">
                    What should {group.label} be? Your answer is worth more than the model&apos;s
                    guess — it is saved on this device and used first from now on.
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <div className="min-w-[200px] flex-1">
                      <Select
                        value={choice}
                        onChange={(event) => setChoice(event.target.value)}
                        aria-label={`Correct category for ${group.label}`}
                      >
                        <option value="">Choose the right category…</option>
                        {(["INCOME", "EXPENSE", "TRANSFER", "CASH"] as const).map((option) => (
                          <optgroup key={option} label={GROUP_LABELS[option]}>
                            {options
                              .filter((category) => category.group === option)
                              .map((category) => (
                                <option key={category.id} value={category.id}>
                                  {category.name}
                                </option>
                              ))}
                          </optgroup>
                        ))}
                      </Select>
                    </div>
                    <PrimaryButton
                      className="!px-3 !py-1.5 !text-xs"
                      disabled={choice === "" || choice === group.suggestedCategory}
                      onClick={() => void settle(group, choice, false)}
                    >
                      Save and teach
                    </PrimaryButton>
                  </div>
                  <p className="mt-2 text-xs text-muted">
                    {anchor
                      ? `This will save a rule matching “${anchor}”, so every future transaction from this merchant is categorised without the model.`
                      : "This narration has no merchant text to build a rule on, so it will be remembered by merchant instead."}
                  </p>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

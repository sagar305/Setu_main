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

import { useI18n } from "@/lib/i18n";
import { useState } from "react";
import { Check, GraduationCap, Pencil } from "lucide-react";
import { Card, PrimaryButton, SecondaryButton, Select } from "@/components/toolkit/ui";
import { useAnalyzer } from "@/components/tools/BankStatementAnalyzer/AnalyzerProvider";
import {
  activeCategories,
  categoryLabel,
  categoryName,
  groupLabel,
  GROUP_ORDER,
} from "@/lib/bankStatement/classification/categories";
import { fill } from "@/lib/i18n/translate";
import { intlLocaleFor } from "@/lib/i18n/pages";
import { ruleAnchor, type AiSuggestionGroup } from "@/lib/bankStatement/ai/approval";
import { confidenceBand } from "@/lib/bankStatement/classification/classifier";

export function AiReviewQueue({ groups }: { groups: AiSuggestionGroup[] }) {
  const { t, lang } = useI18n();
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
      category: categoryName(categories, categoryId, lang),
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
              ? fill(t(groups.length === 1 ? "bsQWaiting1" : "bsQWaitingN"), {
                  n: groups.length.toLocaleString(intlLocaleFor(lang)),
                })
              : t("bsQAllReviewed")}
          </h3>
          <p className="mt-1 text-sm text-muted">
            {groups.length > 0
              ? fill(t(rows === 1 ? "bsQCovering1" : "bsQCoveringN"), {
                  n: rows.toLocaleString(intlLocaleFor(lang)),
                })
              : t("bsQNothingLeft")}
          </p>
        </div>
      </div>

      {taughtRules > 0 ? (
        <p className="mt-3 text-xs text-muted">
          {fill(t(taughtRules === 1 ? "bsQTaught1" : "bsQTaughtN"), {
            n: taughtRules.toLocaleString(intlLocaleFor(lang)),
          })}
        </p>
      ) : null}

      {taught ? (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <GraduationCap className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            {fill(t(taught.rows === 1 ? "bsQTaughtLine1" : "bsQTaughtLineN"), {
              label: taught.label,
              category: taught.category,
              n: taught.rows.toLocaleString(intlLocaleFor(lang)),
            })}{" "}
            {taught.rule ? t("bsQSavedRule") : t("bsQRemembered")}
          </span>
          <button
            type="button"
            onClick={() => setTaught(null)}
            className="ml-auto shrink-0 text-xs font-semibold text-emerald-700 underline"
          >
            {t("bsQDismiss")}
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
                    {fill(
                      t(
                        group.transactions[0].transactionType === "DEBIT"
                          ? group.transactions.length === 1
                            ? "bsQRowsPaid1"
                            : "bsQRowsPaidN"
                          : group.transactions.length === 1
                            ? "bsQRowsRecv1"
                            : "bsQRowsRecvN"
                      ),
                      { n: group.transactions.length.toLocaleString(intlLocaleFor(lang)) }
                    )}
                    {group.similarity !== undefined
                      ? ` · ${fill(t("bsQSimilarity"), { score: group.similarity.toFixed(2) })}`
                      : ""}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted">{t("bsQSuggests")}</span>
                  <span className="rounded-lg bg-cream-paper/70 px-2.5 py-1 text-sm font-semibold text-ink">
                    {categoryName(categories, group.suggestedCategory, lang)}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      band === "high"
                        ? "bg-emerald-100 text-emerald-700"
                        : band === "medium"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-cream text-muted"
                    }`}
                    title={`${fill(t("bsQScoreTitle"), { score: group.score })}${
                      strong ? "" : t("bsQCloseCall")
                    }`}
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
                      {t("bsQApprove")}
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
                      {correcting === group.key ? t("cancel") : t("bsQNotRight")}
                    </span>
                  </SecondaryButton>
                </div>
              </div>

              {correcting === group.key ? (
                <div className="mt-3 rounded-lg bg-cream-paper/50 px-3 py-3">
                  <p className="text-xs text-muted">
                    {fill(t("bsQWhatShould"), { label: group.label })}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <div className="min-w-[200px] flex-1">
                      <Select
                        value={choice}
                        onChange={(event) => setChoice(event.target.value)}
                        aria-label={fill(t("bsQCorrectAria"), { label: group.label })}
                      >
                        <option value="">{t("bsQChoose")}</option>
                        {GROUP_ORDER.map((option) => (
                          <optgroup key={option} label={groupLabel(option, lang)}>
                            {options
                              .filter((category) => category.group === option)
                              .map((category) => (
                                <option key={category.id} value={category.id}>
                                  {categoryLabel(category, lang)}
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
                      {t("bsQSaveTeach")}
                    </PrimaryButton>
                  </div>
                  <p className="mt-2 text-xs text-muted">
                    {anchor
                      ? fill(t("bsQWillSaveRule"), { anchor })
                      : t("bsQNoAnchor")}
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

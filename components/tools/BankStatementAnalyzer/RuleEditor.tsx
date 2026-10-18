"use client";

// Create and edit classification rules (spec §12). A rule drafted from a
// transaction opens here pre-filled so the CA can adjust it before saving —
// never saved behind their back.

import { useI18n } from "@/lib/i18n";
import { useMemo, useState } from "react";
import type {
  ClassificationRule,
  ClassificationType,
  GstFlag,
  RuleCondition,
  RuleField,
  RuleOperator,
  Transaction,
  Category,
} from "@/lib/bankStatement/types";
import {
  Card,
  Field,
  NumberInput,
  PrimaryButton,
  SecondaryButton,
  Select,
  TextInput,
} from "@/components/toolkit/ui";
import { conditionValues, countMatches } from "@/lib/bankStatement/classification/rulesEngine";
import {
  GROUP_ORDER,
  activeCategories,
  categoryLabel,
  groupLabel,
} from "@/lib/bankStatement/classification/categories";
import { intlLocaleFor } from "@/lib/i18n/pages";
import { fill, type TKey } from "@/lib/i18n/translate";
import { KeywordInput } from "@/components/tools/BankStatementAnalyzer/KeywordInput";

const FIELD_KEYS: Record<RuleField, TKey> = {
  narration: "bkNarration",
  reference: "stReference",
  amount: "amount",
  direction: "bsRuDebitCredit",
  date: "date",
};

const OPERATORS: Record<RuleField, RuleOperator[]> = {
  narration: ["contains", "startsWith", "endsWith", "equals"],
  reference: ["contains", "startsWith", "endsWith", "equals"],
  amount: ["greaterThan", "lessThan", "between", "equals"],
  direction: ["equals"],
  date: ["between", "greaterThan", "lessThan"],
};

const OPERATOR_KEYS: Record<RuleOperator, TKey> = {
  contains: "bsOpContains",
  startsWith: "bsOpStartsWith",
  endsWith: "bsOpEndsWith",
  equals: "bsOpEquals",
  greaterThan: "bsOpGreaterThan",
  lessThan: "bsOpLessThan",
  between: "bsOpBetween",
};

export function RuleEditor({
  rule,
  categories,
  transactions,
  onSave,
  onCancel,
}: {
  rule: ClassificationRule;
  categories: Category[];
  transactions: Transaction[];
  onSave: (rule: ClassificationRule) => void;
  onCancel: () => void;
}) {
  const { t, lang } = useI18n();
  const [draft, setDraft] = useState<ClassificationRule>(rule);

  const matches = useMemo(
    () => countMatches(transactions, draft),
    [draft, transactions]
  );

  const setCondition = (index: number, patch: Partial<RuleCondition>) =>
    setDraft((current) => ({
      ...current,
      conditions: current.conditions.map((condition, i) =>
        i === index ? { ...condition, ...patch } : condition
      ),
    }));

  const options = activeCategories(categories);
  const valid =
    draft.name.trim() !== "" &&
    draft.conditions.every((condition) => conditionValues(condition).length > 0);

  return (
    <Card>
      <h3 className="text-lg font-bold text-ink">
        {rule.name === draft.name && draft.conditions.length > 0
          ? t("bsRuRule")
          : t("bsRuNewRule")}
      </h3>
      <p className="mt-1 text-sm text-muted">{t("bsRuBlurb")}</p>

      <div className="mt-4 space-y-4">
        <Field label={t("bsRuRuleName")}>
          <TextInput
            value={draft.name}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            placeholder={t("bsRuNamePlaceholder")}
          />
        </Field>

        <div>
          <span className="mb-1.5 block text-sm font-semibold text-ink">
            {t("bsRuConditions")}
          </span>
          <p className="mb-3 text-xs text-muted">
            {/* The bold phrase is a placeholder so each language puts it where its
                own sentence wants it, rather than mid-way through an English one. */}
            {(() => {
              const [before, after] = fill(t("bsRuConditionsNote"), {
                strong: "\u0000",
              }).split("\u0000");
              return (
                <>
                  {before}
                  <strong>{t("bsRuAnyOne")}</strong>
                  {after}
                </>
              );
            })()}
          </p>
          <div className="space-y-3">
            {draft.conditions.map((condition, index) => (
              <div key={index} className="grid gap-2 sm:grid-cols-[130px_140px_1fr_auto]">
                <Select
                  value={condition.field}
                  onChange={(event) => {
                    const field = event.target.value as RuleField;
                    setCondition(index, { field, operator: OPERATORS[field][0] });
                  }}
                  aria-label={t("bsRuField")}
                >
                  {(Object.keys(FIELD_KEYS) as RuleField[]).map((field) => (
                    <option key={field} value={field}>
                      {t(FIELD_KEYS[field])}
                    </option>
                  ))}
                </Select>

                <Select
                  value={condition.operator}
                  onChange={(event) =>
                    setCondition(index, { operator: event.target.value as RuleOperator })
                  }
                  aria-label={t("bsRuOperator")}
                >
                  {OPERATORS[condition.field].map((operator) => (
                    <option key={operator} value={operator}>
                      {t(OPERATOR_KEYS[operator])}
                    </option>
                  ))}
                </Select>

                <div className="flex gap-2">
                  {condition.field === "direction" ? (
                    <Select
                      value={conditionValues(condition)[0] ?? "DEBIT"}
                      onChange={(event) =>
                        setCondition(index, { value: event.target.value, values: [event.target.value] })
                      }
                      aria-label={t("bsRuValue")}
                    >
                      <option value="DEBIT">{t("bkDebit")}</option>
                      <option value="CREDIT">{t("bkCredit")}</option>
                    </Select>
                  ) : condition.field === "amount" && condition.operator !== "equals" ? (
                    <NumberInput
                      value={conditionValues(condition)[0] ?? ""}
                      onChange={(event) =>
                        setCondition(index, { value: event.target.value, values: [event.target.value] })
                      }
                      placeholder="0.00"
                      aria-label={t("bsRuValue")}
                    />
                  ) : condition.field === "date" ? (
                    <TextInput
                      type="date"
                      value={conditionValues(condition)[0] ?? ""}
                      onChange={(event) =>
                        setCondition(index, { value: event.target.value, values: [event.target.value] })
                      }
                      aria-label={t("bsRuValue")}
                    />
                  ) : (
                    // Narration, reference and "amount is" accept a list —
                    // any one of them satisfies the condition.
                    <KeywordInput
                      values={conditionValues(condition)}
                      onChange={(values) =>
                        setCondition(index, { values, value: values[0] ?? "" })
                      }
                      placeholder={
                        condition.field === "amount"
                          ? t("bsRuAmountPlaceholder")
                          : t("bsRuTextPlaceholder")
                      }
                      ariaLabel={t("bsRuKeywordsAria")}
                    />
                  )}

                  {condition.operator === "between" ? (
                    condition.field === "date" ? (
                      <TextInput
                        type="date"
                        value={condition.value2 ?? ""}
                        onChange={(event) => setCondition(index, { value2: event.target.value })}
                        aria-label={t("bsRuUpperBound")}
                      />
                    ) : (
                      <NumberInput
                        value={condition.value2 ?? ""}
                        onChange={(event) => setCondition(index, { value2: event.target.value })}
                        placeholder={t("bsRuAnd")}
                        aria-label={t("bsRuUpperBound")}
                      />
                    )
                  ) : null}
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setDraft({
                      ...draft,
                      conditions: draft.conditions.filter((_, i) => i !== index),
                    })
                  }
                  disabled={draft.conditions.length === 1}
                  className="rounded-lg px-2 text-sm font-semibold text-red-500 disabled:opacity-40"
                >
                  {t("remove")}
                </button>
              </div>
            ))}
          </div>

          <SecondaryButton
            className="mt-3"
            onClick={() =>
              setDraft({
                ...draft,
                conditions: [
                  ...draft.conditions,
                  { field: "narration", operator: "contains", value: "", values: [] },
                ],
              })
            }
          >
            {t("bsRuAddCondition")}
          </SecondaryButton>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("bsRuThenCategory")}>
            <Select
              value={draft.result.category ?? ""}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  result: { ...draft.result, category: event.target.value || undefined },
                })
              }
            >
              <option value="">{t("bsRuLeaveUnchanged")}</option>
              {GROUP_ORDER.map((group) => (
                <optgroup key={group} label={groupLabel(group, lang)}>
                  {options
                    .filter((category) => category.group === group)
                    .map((category) => (
                      <option key={category.id} value={category.id}>
                        {categoryLabel(category, lang)}
                      </option>
                    ))}
                </optgroup>
              ))}
            </Select>
          </Field>

          <Field label={t("bsRuAndMarkAs")}>
            <Select
              value={draft.result.classificationType ?? ""}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  result: {
                    ...draft.result,
                    classificationType: (event.target.value || undefined) as ClassificationType | undefined,
                  },
                })
              }
            >
              <option value="">{t("bsRuLeaveUnchanged")}</option>
              <option value="BUSINESS">{t("appBusiness")}</option>
              <option value="PERSONAL">{t("bsTypePersonal")}</option>
              <option value="TRANSFER">{t("tkCoTransfer")}</option>
            </Select>
          </Field>

          <Field label={t("bsRuPartyName")}>
            <TextInput
              value={draft.result.partyName ?? ""}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  result: { ...draft.result, partyName: event.target.value || undefined },
                })
              }
              placeholder={t("bsRuPartyPlaceholder")}
            />
          </Field>

          <Field label={t("bsCatGst")}>
            <Select
              value={draft.result.gstRelevant ?? "NOT_MARKED"}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  result: { ...draft.result, gstRelevant: event.target.value as GstFlag },
                })
              }
            >
              <option value="NOT_MARKED">{t("bsRuNotMarked")}</option>
              <option value="POTENTIAL">{t("bsRuPotentialGst")}</option>
              <option value="RELEVANT">{t("bsDashGstRelevant")}</option>
            </Select>
          </Field>

          <Field label={t("bsRuPriority")}>
            <NumberInput
              value={draft.priority}
              onChange={(event) => setDraft({ ...draft, priority: Number(event.target.value) || 0 })}
            />
          </Field>
        </div>

        <p className="rounded-xl bg-cream-paper/70 px-4 py-3 text-sm text-muted">
          {/* The count is emphasised wherever the sentence puts it, so the
              placeholder splits the line rather than the English word order. */}
          {(() => {
            const [before, after] = fill(t("bsRuMatchCount"), {
              matches: "\u0000",
              total: transactions.length.toLocaleString(intlLocaleFor(lang)),
            }).split("\u0000");
            return (
              <>
                {before}
                <strong className="text-ink">
                  {matches.toLocaleString(intlLocaleFor(lang))}
                </strong>
                {after}
              </>
            );
          })()}
        </p>

        <div className="flex flex-wrap gap-3">
          <PrimaryButton onClick={() => onSave(draft)} disabled={!valid}>
            {t("bsRuSaveRule")}
          </PrimaryButton>
          <SecondaryButton onClick={onCancel}>{t("cancel")}</SecondaryButton>
        </div>
      </div>
    </Card>
  );
}

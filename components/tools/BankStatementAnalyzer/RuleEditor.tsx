"use client";

// Create and edit classification rules (spec §12). A rule drafted from a
// transaction opens here pre-filled so the CA can adjust it before saving —
// never saved behind their back.

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
import { activeCategories, GROUP_LABELS } from "@/lib/bankStatement/classification/categories";
import { KeywordInput } from "@/components/tools/BankStatementAnalyzer/KeywordInput";

const FIELD_LABELS: Record<RuleField, string> = {
  narration: "Narration",
  reference: "Reference",
  amount: "Amount",
  direction: "Debit / credit",
  date: "Date",
};

const OPERATORS: Record<RuleField, RuleOperator[]> = {
  narration: ["contains", "startsWith", "endsWith", "equals"],
  reference: ["contains", "startsWith", "endsWith", "equals"],
  amount: ["greaterThan", "lessThan", "between", "equals"],
  direction: ["equals"],
  date: ["between", "greaterThan", "lessThan"],
};

const OPERATOR_LABELS: Record<RuleOperator, string> = {
  contains: "contains",
  startsWith: "starts with",
  endsWith: "ends with",
  equals: "is",
  greaterThan: "is more than",
  lessThan: "is less than",
  between: "is between",
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
        {rule.name === draft.name && draft.conditions.length > 0 ? "Rule" : "New rule"}
      </h3>
      <p className="mt-1 text-sm text-muted">
        Rules run before any pattern matching, and the highest priority wins. They stay on this
        device.
      </p>

      <div className="mt-4 space-y-4">
        <Field label="Rule name">
          <TextInput
            value={draft.name}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            placeholder="e.g. Swiggy → Business Meals"
          />
        </Field>

        <div>
          <span className="mb-1.5 block text-sm font-semibold text-ink">Conditions (all must match)</span>
          <p className="mb-3 text-xs text-muted">
            Give one condition several keywords and <strong>any one of them</strong> satisfies it —
            so a whole category is one rule, not one rule per merchant. Press Enter or comma to add
            each keyword.
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
                  aria-label="Field"
                >
                  {(Object.keys(FIELD_LABELS) as RuleField[]).map((field) => (
                    <option key={field} value={field}>
                      {FIELD_LABELS[field]}
                    </option>
                  ))}
                </Select>

                <Select
                  value={condition.operator}
                  onChange={(event) =>
                    setCondition(index, { operator: event.target.value as RuleOperator })
                  }
                  aria-label="Operator"
                >
                  {OPERATORS[condition.field].map((operator) => (
                    <option key={operator} value={operator}>
                      {OPERATOR_LABELS[operator]}
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
                      aria-label="Value"
                    >
                      <option value="DEBIT">Debit</option>
                      <option value="CREDIT">Credit</option>
                    </Select>
                  ) : condition.field === "amount" && condition.operator !== "equals" ? (
                    <NumberInput
                      value={conditionValues(condition)[0] ?? ""}
                      onChange={(event) =>
                        setCondition(index, { value: event.target.value, values: [event.target.value] })
                      }
                      placeholder="0.00"
                      aria-label="Value"
                    />
                  ) : condition.field === "date" ? (
                    <TextInput
                      type="date"
                      value={conditionValues(condition)[0] ?? ""}
                      onChange={(event) =>
                        setCondition(index, { value: event.target.value, values: [event.target.value] })
                      }
                      aria-label="Value"
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
                        condition.field === "amount" ? "e.g. 199 — Enter to add" : "e.g. SWIGGY — Enter to add"
                      }
                      ariaLabel="Keywords, any of which matches"
                    />
                  )}

                  {condition.operator === "between" ? (
                    condition.field === "date" ? (
                      <TextInput
                        type="date"
                        value={condition.value2 ?? ""}
                        onChange={(event) => setCondition(index, { value2: event.target.value })}
                        aria-label="Upper bound"
                      />
                    ) : (
                      <NumberInput
                        value={condition.value2 ?? ""}
                        onChange={(event) => setCondition(index, { value2: event.target.value })}
                        placeholder="and"
                        aria-label="Upper bound"
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
                  Remove
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
            Add condition
          </SecondaryButton>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Then set category">
            <Select
              value={draft.result.category ?? ""}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  result: { ...draft.result, category: event.target.value || undefined },
                })
              }
            >
              <option value="">Leave unchanged</option>
              {(["INCOME", "EXPENSE", "TRANSFER", "CASH"] as const).map((group) => (
                <optgroup key={group} label={GROUP_LABELS[group]}>
                  {options
                    .filter((category) => category.group === group)
                    .map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                </optgroup>
              ))}
            </Select>
          </Field>

          <Field label="And mark as">
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
              <option value="">Leave unchanged</option>
              <option value="BUSINESS">Business</option>
              <option value="PERSONAL">Personal</option>
              <option value="TRANSFER">Transfer</option>
            </Select>
          </Field>

          <Field label="Party name">
            <TextInput
              value={draft.result.partyName ?? ""}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  result: { ...draft.result, partyName: event.target.value || undefined },
                })
              }
              placeholder="e.g. ABC Enterprise"
            />
          </Field>

          <Field label="GST">
            <Select
              value={draft.result.gstRelevant ?? "NOT_MARKED"}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  result: { ...draft.result, gstRelevant: event.target.value as GstFlag },
                })
              }
            >
              <option value="NOT_MARKED">Not marked</option>
              <option value="POTENTIAL">Potentially GST relevant</option>
              <option value="RELEVANT">GST relevant</option>
            </Select>
          </Field>

          <Field label="Priority">
            <NumberInput
              value={draft.priority}
              onChange={(event) => setDraft({ ...draft, priority: Number(event.target.value) || 0 })}
            />
          </Field>
        </div>

        <p className="rounded-xl bg-cream-paper/70 px-4 py-3 text-sm text-muted">
          This rule matches <strong className="text-ink">{matches}</strong> of the{" "}
          {transactions.length.toLocaleString("en-IN")} transactions loaded.
        </p>

        <div className="flex flex-wrap gap-3">
          <PrimaryButton onClick={() => onSave(draft)} disabled={!valid}>
            Save rule
          </PrimaryButton>
          <SecondaryButton onClick={onCancel}>Cancel</SecondaryButton>
        </div>
      </div>
    </Card>
  );
}

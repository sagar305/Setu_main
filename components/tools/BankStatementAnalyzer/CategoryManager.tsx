"use client";

// Category management (decision 22): add, rename, reorder, archive. Deleting is
// refused while transactions still use a category — the CA is told how many and
// asked to move them first.

import { useState } from "react";
import type { Category, CategoryGroup } from "@/lib/bankStatement/types";
import {
  Card,
  Field,
  PrimaryButton,
  SecondaryButton,
  Select,
  TextInput,
} from "@/components/toolkit/ui";
import { GROUP_LABELS, slugifyCategory } from "@/lib/bankStatement/classification/categories";
import { useAnalyzer } from "@/components/tools/BankStatementAnalyzer/AnalyzerProvider";

export function CategoryManager() {
  const { categories, transactions, actions } = useAnalyzer();
  const [name, setName] = useState("");
  const [group, setGroup] = useState<CategoryGroup>("EXPENSE");
  const [message, setMessage] = useState<string | null>(null);

  const usage = (categoryId: string) =>
    transactions.filter((transaction) => transaction.category === categoryId).length;

  const add = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const id = slugifyCategory(trimmed);
    if (categories.some((category) => category.id === id)) {
      setMessage("A category with that name already exists.");
      return;
    }
    actions.saveCategory({
      id,
      name: trimmed,
      group,
      builtIn: false,
      archived: false,
      order: categories.length,
    });
    setName("");
    setMessage(null);
  };

  const rename = (category: Category, nextName: string) => {
    const trimmed = nextName.trim();
    if (!trimmed || trimmed === category.name) return;
    actions.saveCategory({ ...category, name: trimmed });
  };

  const describe = (category: Category, next: string) => {
    const trimmed = next.trim();
    if (trimmed === (category.description ?? "")) return;
    actions.saveCategory({ ...category, description: trimmed || undefined });
  };

  const move = (category: Category, direction: -1 | 1) => {
    const sorted = [...categories].sort((a, b) => a.order - b.order);
    const index = sorted.findIndex((item) => item.id === category.id);
    const swapWith = sorted[index + direction];
    if (!swapWith) return;
    actions.saveCategory({ ...category, order: swapWith.order });
    actions.saveCategory({ ...swapWith, order: category.order });
  };

  const remove = (category: Category) => {
    const result = actions.deleteCategory(category.id);
    if (!result.ok) {
      setMessage(
        result.inUse > 0
          ? `${result.inUse} transaction${result.inUse === 1 ? "" : "s"} currently use this category. Move them to another category first.`
          : "Built-in categories can be archived, but not deleted."
      );
      return;
    }
    setMessage(null);
  };

  const groups: CategoryGroup[] = ["INCOME", "EXPENSE", "TRANSFER", "CASH"];

  return (
    <Card>
      <h3 className="text-lg font-bold text-ink">Categories</h3>
      <p className="mt-1 text-sm text-muted">
        Rename, reorder or archive to match how you write up a set of books. The description under
        each one is what automatic categorisation matches a transaction against — the more plainly it
        says what belongs here, the better it places things.
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div className="min-w-[200px] flex-1">
          <Field label="New category">
            <TextInput
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Freight Inward"
            />
          </Field>
        </div>
        <div className="w-40">
          <Field label="Group">
            <Select value={group} onChange={(event) => setGroup(event.target.value as CategoryGroup)}>
              {groups.map((option) => (
                <option key={option} value={option}>
                  {GROUP_LABELS[option]}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <PrimaryButton onClick={add} disabled={name.trim() === ""}>
          Add
        </PrimaryButton>
      </div>

      {message ? (
        <p className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">{message}</p>
      ) : null}

      <div className="mt-5 space-y-5">
        {groups.map((option) => {
          const rows = categories
            .filter((category) => category.group === option)
            .sort((a, b) => a.order - b.order);
          if (rows.length === 0) return null;

          return (
            <div key={option}>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                {GROUP_LABELS[option]}
              </h4>
              <ul className="space-y-1.5">
                {rows.map((category) => {
                  const inUse = usage(category.id);
                  return (
                    <li
                      key={category.id}
                      className={`rounded-lg border border-muted-line/30 px-3 py-2 ${
                        category.archived ? "opacity-60" : ""
                      }`}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                      <input
                        defaultValue={category.name}
                        onBlur={(event) => rename(category, event.target.value)}
                        className="min-w-[140px] flex-1 rounded border-0 bg-transparent px-1 py-0.5 text-sm font-medium text-ink outline-none focus:bg-cream-paper/60"
                        aria-label={`Rename ${category.name}`}
                      />
                      <span className="text-xs text-muted">{inUse} in use</span>
                      <button
                        type="button"
                        onClick={() => move(category, -1)}
                        className="rounded px-1.5 text-sm text-muted hover:text-ink"
                        aria-label={`Move ${category.name} up`}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => move(category, 1)}
                        className="rounded px-1.5 text-sm text-muted hover:text-ink"
                        aria-label={`Move ${category.name} down`}
                      >
                        ↓
                      </button>
                      <SecondaryButton
                        className="!px-2.5 !py-1 !text-xs"
                        onClick={() => actions.archiveCategory(category.id, !category.archived)}
                      >
                        {category.archived ? "Restore" : "Archive"}
                      </SecondaryButton>
                      {!category.builtIn ? (
                        <button
                          type="button"
                          onClick={() => remove(category)}
                          className="text-xs font-semibold text-red-500 hover:text-red-600"
                        >
                          Delete
                        </button>
                      ) : null}
                      </div>
                      <input
                        defaultValue={category.description ?? ""}
                        onBlur={(event) => describe(category, event.target.value)}
                        placeholder="Describe what belongs here, for automatic categorisation"
                        className="mt-1 w-full rounded border-0 bg-transparent px-1 py-0.5 text-xs text-muted outline-none focus:bg-cream-paper/60"
                        aria-label={`Description for ${category.name}`}
                      />
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

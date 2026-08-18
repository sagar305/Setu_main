"use client";

// The file as it actually came out, with the controls to fix it.
// ---------------------------------------------------------------------------
// When detection fails, the useful thing is not a better guess — it is showing
// the CA every row the extractor found and letting them say what it is. They
// can see the file; we cannot.
//
// Four corrections, which between them account for most broken statements:
//
//   • which column is which        — the mapping, per column, in the header
//   • where the table starts/ends  — kills letterhead and footer rows
//   • which rows are not rows      — subtotals, page furniture, carried forward
//   • which rows are continuations — a narration that wrapped onto a second line
//
// Virtualised, because a year of transactions is a few thousand rows and this
// has to stay usable on a phone. Nothing here re-parses on its own: the CA
// presses "Re-read" when they are ready, so a large file is not re-parsed on
// every keystroke.

import { useMemo, useRef, useState } from "react";
import { ArrowUpToLine, CornerLeftUp, EyeOff, Wand2 } from "lucide-react";
import { PrimaryButton, SecondaryButton, Select } from "@/components/toolkit/ui";
import type { ColumnMapping, RawRow } from "@/lib/bankStatement/types";
import {
  describeRowPlan,
  suggestMergeUp,
  type RowPlan,
} from "@/lib/bankStatement/parser/rowPlan";

const ROW_HEIGHT = 30;
const OVERSCAN = 10;
const CELL_WIDTH = 160;

/** The fields a column can be assigned to, in the order they read in a table. */
const ROLES: { key: keyof ColumnMapping; label: string; short: string }[] = [
  { key: "date", label: "Date", short: "Date" },
  { key: "valueDate", label: "Value date", short: "Value dt" },
  { key: "narration", label: "Narration / description", short: "Narration" },
  { key: "reference", label: "Reference / cheque no.", short: "Reference" },
  { key: "debit", label: "Debit / withdrawal", short: "Debit" },
  { key: "credit", label: "Credit / deposit", short: "Credit" },
  { key: "amount", label: "Single amount column", short: "Amount" },
  { key: "direction", label: "Dr/Cr indicator", short: "Dr/Cr" },
  { key: "balance", label: "Balance", short: "Balance" },
];

export function StatementGrid({
  grid,
  mapping,
  plan,
  onMappingChange,
  onPlanChange,
  onApply,
  busy,
}: {
  grid: RawRow[];
  mapping: ColumnMapping;
  plan: RowPlan;
  onMappingChange: (mapping: ColumnMapping) => void;
  onPlanChange: (plan: RowPlan) => void;
  onApply: () => void;
  busy?: boolean;
}) {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const columnCount = useMemo(
    () => grid.reduce((max, row) => Math.max(max, row.cells.length), 0),
    [grid]
  );

  const skip = useMemo(() => new Set(plan.skipRows ?? []), [plan.skipRows]);
  const merge = useMemo(() => new Set(plan.mergeUp ?? []), [plan.mergeUp]);

  const start = plan.startRow ?? 0;
  const end = plan.endRow ?? grid.length - 1;

  // Which role, if any, each column currently carries.
  const roleByColumn = useMemo(() => {
    const byColumn = new Map<number, keyof ColumnMapping>();
    for (const role of ROLES) {
      const index = mapping[role.key];
      if (typeof index === "number") byColumn.set(index, role.key);
    }
    return byColumn;
  }, [mapping]);

  const viewportHeight = Math.min(18, Math.max(grid.length, 1)) * ROW_HEIGHT;
  const first = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const last = Math.min(grid.length, Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT) + OVERSCAN);

  const assign = (column: number, role: keyof ColumnMapping | "") => {
    const next: ColumnMapping = { ...mapping };
    // A column holds one role, and a role lives in one column: clear both sides
    // so the mapping can never claim column 3 is both Debit and Credit.
    for (const entry of ROLES) {
      if (next[entry.key] === column) delete next[entry.key];
    }
    if (role !== "") next[role] = column;
    onMappingChange(next);
  };

  const toggleRow = (index: number, set: "skipRows" | "mergeUp") => {
    const current = new Set(plan[set] ?? []);
    if (current.has(index)) current.delete(index);
    else current.add(index);
    // Skipping and merging are mutually exclusive — a row is either not a row
    // or the tail of one.
    const other = set === "skipRows" ? "mergeUp" : "skipRows";
    const otherSet = new Set(plan[other] ?? []);
    otherSet.delete(index);

    onPlanChange({
      ...plan,
      [set]: [...current].sort((a, b) => a - b),
      [other]: [...otherSet].sort((a, b) => a - b),
    });
  };

  const suggestions = useMemo(() => suggestMergeUp(grid, plan), [grid, plan]);
  const unapplied = suggestions.filter((index) => !merge.has(index));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-bold text-ink">The file as we read it</h4>
          <p className="mt-0.5 text-xs text-muted">
            {grid.length.toLocaleString("en-IN")} rows · {columnCount} column
            {columnCount === 1 ? "" : "s"} · {describeRowPlan(plan)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {unapplied.length > 0 ? (
            <SecondaryButton
              className="!px-3 !py-1.5 !text-xs"
              onClick={() =>
                onPlanChange({
                  ...plan,
                  mergeUp: [...new Set([...(plan.mergeUp ?? []), ...unapplied])].sort((a, b) => a - b),
                })
              }
            >
              <span className="flex items-center gap-1">
                <Wand2 className="h-3.5 w-3.5" aria-hidden="true" />
                Join {unapplied.length} wrapped line{unapplied.length === 1 ? "" : "s"}
              </span>
            </SecondaryButton>
          ) : null}
          <SecondaryButton className="!px-3 !py-1.5 !text-xs" onClick={() => onPlanChange({})}>
            Reset
          </SecondaryButton>
          <PrimaryButton className="!px-3 !py-1.5 !text-xs" onClick={onApply} disabled={busy}>
            {busy ? "Re-reading…" : "Re-read with these settings"}
          </PrimaryButton>
        </div>
      </div>

      <p className="text-xs text-muted">
        Set what each column is in the row of dropdowns. Use the buttons on a row to mark where the
        table starts and ends, hide a row that is not a transaction, or join a wrapped line to the
        row above it.
      </p>

      <div className="overflow-x-auto rounded-xl border border-muted-line/30">
        <div style={{ minWidth: 120 + columnCount * CELL_WIDTH }}>
          {/* Column roles. Sticky so they stay visible while scrolling rows. */}
          <div className="flex border-b border-muted-line/30 bg-cream-paper/60">
            <div className="w-[120px] shrink-0 px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
              Row
            </div>
            {Array.from({ length: columnCount }, (_, column) => (
              <div key={column} style={{ width: CELL_WIDTH }} className="shrink-0 px-1 py-1">
                <Select
                  className="!py-1 !text-xs"
                  value={roleByColumn.get(column) ?? ""}
                  onChange={(event) =>
                    assign(column, event.target.value as keyof ColumnMapping | "")
                  }
                  aria-label={`What is in column ${column + 1}`}
                >
                  <option value="">Column {column + 1} — ignore</option>
                  {ROLES.map((role) => (
                    <option key={role.key} value={role.key}>
                      {role.label}
                    </option>
                  ))}
                </Select>
              </div>
            ))}
          </div>

          <div
            ref={containerRef}
            onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
            style={{ height: viewportHeight }}
            className="overflow-y-auto"
            role="region"
            aria-label={`${grid.length} extracted rows`}
          >
            <div style={{ height: grid.length * ROW_HEIGHT, position: "relative" }}>
              <div style={{ transform: `translateY(${first * ROW_HEIGHT}px)` }}>
                {grid.slice(first, last).map((row, offset) => {
                  const index = first + offset;
                  const outside = index < start || index > end;
                  const skipped = skip.has(index);
                  const merged = merge.has(index);
                  const isHeader = plan.headerRow === index;

                  return (
                    <div
                      key={index}
                      style={{ height: ROW_HEIGHT }}
                      className={`flex items-center border-b border-muted-line/15 text-xs ${
                        outside || skipped
                          ? "bg-cream/60 text-muted line-through decoration-muted/50"
                          : merged
                            ? "bg-amber-50/70 text-ink"
                            : isHeader
                              ? "bg-indigo/5 font-semibold text-ink"
                              : "text-ink"
                      }`}
                    >
                      <div className="flex w-[120px] shrink-0 items-center gap-0.5 px-1">
                        <span className="w-8 shrink-0 tabular-nums text-[11px] text-muted">
                          {index + 1}
                        </span>
                        <RowButton
                          title="Table starts on this row"
                          active={plan.startRow === index}
                          onClick={() =>
                            onPlanChange({
                              ...plan,
                              startRow: plan.startRow === index ? undefined : index,
                            })
                          }
                        >
                          <ArrowUpToLine className="h-3 w-3" aria-hidden="true" />
                        </RowButton>
                        <RowButton
                          title="This row is the column header"
                          active={isHeader}
                          onClick={() =>
                            onPlanChange({
                              ...plan,
                              headerRow: isHeader ? undefined : index,
                            })
                          }
                        >
                          <span className="text-[10px] font-bold">H</span>
                        </RowButton>
                        <RowButton
                          title="Not a transaction — hide this row"
                          active={skipped}
                          onClick={() => toggleRow(index, "skipRows")}
                        >
                          <EyeOff className="h-3 w-3" aria-hidden="true" />
                        </RowButton>
                        <RowButton
                          title="Join this row to the one above"
                          active={merged}
                          onClick={() => toggleRow(index, "mergeUp")}
                        >
                          <CornerLeftUp className="h-3 w-3" aria-hidden="true" />
                        </RowButton>
                      </div>

                      {Array.from({ length: columnCount }, (_, column) => (
                        <div
                          key={column}
                          style={{ width: CELL_WIDTH }}
                          className={`shrink-0 truncate px-2 ${
                            roleByColumn.has(column) ? "bg-emerald-50/40" : ""
                          }`}
                          title={row.cells[column] ?? ""}
                        >
                          {row.cells[column] ?? ""}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-[11px] text-muted">
        <Legend className="bg-emerald-50/70">assigned column</Legend>
        <Legend className="bg-indigo/10">header row</Legend>
        <Legend className="bg-amber-50">joined to the row above</Legend>
        <Legend className="bg-cream">hidden or outside the table</Legend>
        <button
          type="button"
          className="font-semibold text-indigo hover:underline"
          onClick={() => onPlanChange({ ...plan, endRow: plan.endRow === undefined ? grid.length - 1 : undefined })}
        >
          {plan.endRow === undefined ? "Set the last row to the end of the file" : "Clear the end marker"}
        </button>
      </div>
    </div>
  );
}

function RowButton({
  title,
  active,
  onClick,
  children,
}: {
  title: string;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      onClick={onClick}
      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded ${
        active ? "bg-indigo text-white" : "text-muted hover:bg-muted-line/20 hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function Legend({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block h-3 w-3 rounded border border-muted-line/40 ${className}`} />
      {children}
    </span>
  );
}

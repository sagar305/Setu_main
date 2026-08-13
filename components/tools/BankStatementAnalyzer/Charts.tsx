"use client";

// Charts, hand-rolled in SVG to match the repo's existing dashboard idiom
// (decision 4). Same palette as ProfitDashboardTool — #4F46E5 for money in,
// #D97706 for money out — chosen for colour-vision-deficiency safety, and every
// chart has a table view so the data is readable without relying on colour.

import { useState } from "react";
import type { CategoryRow, MonthlyRow, PartyRow } from "@/lib/bankStatement/types";
import { Card, SecondaryButton } from "@/components/toolkit/ui";
import { formatMoney } from "@/lib/pos/types";

const IN = "#4F46E5";
const OUT = "#D97706";

export function MonthlyFlowChart({
  rows,
  currency,
}: {
  rows: MonthlyRow[];
  currency: string;
}) {
  const [showTable, setShowTable] = useState(false);
  const [hover, setHover] = useState<number | null>(null);

  const max = Math.max(1, ...rows.flatMap((row) => [row.credits, row.debits]));
  const columnWidth = 40;

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-bold text-ink">Money in and out by month</h3>
        <SecondaryButton onClick={() => setShowTable((value) => !value)}>
          {showTable ? "View chart" : "View table"}
        </SecondaryButton>
      </div>

      <div className="mb-3 flex gap-4 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: IN }} aria-hidden="true" />
          Credits
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: OUT }} aria-hidden="true" />
          Debits
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">No transactions to chart yet.</p>
      ) : showTable ? (
        <div className="max-h-72 overflow-y-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-muted-line/30 text-left text-muted">
                <th className="py-1.5 pr-4 font-semibold">Month</th>
                <th className="py-1.5 pr-4 text-right font-semibold">Credits</th>
                <th className="py-1.5 pr-4 text-right font-semibold">Debits</th>
                <th className="py-1.5 text-right font-semibold">Net</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.month} className="border-b border-muted-line/20">
                  <td className="py-1.5 pr-4 text-muted">{row.label}</td>
                  <td className="py-1.5 pr-4 text-right text-ink">{formatMoney(row.credits, currency)}</td>
                  <td className="py-1.5 pr-4 text-right text-ink">{formatMoney(row.debits, currency)}</td>
                  <td
                    className={`py-1.5 text-right font-medium ${row.net < 0 ? "text-red-600" : "text-ink"}`}
                  >
                    {formatMoney(row.net, currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative">
          {hover !== null && rows[hover] ? (
            <div
              className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 rounded-lg bg-ink px-3 py-1.5 text-xs text-white shadow"
              style={{ left: `${((hover + 0.5) / rows.length) * 100}%` }}
            >
              <span className="font-semibold">{rows[hover].label}</span>: in{" "}
              {formatMoney(rows[hover].credits, currency)} · out {formatMoney(rows[hover].debits, currency)}
            </div>
          ) : (
            <div className="h-6" aria-hidden="true" />
          )}
          <svg
            viewBox={`0 0 ${rows.length * columnWidth} 120`}
            className="h-48 w-full"
            role="img"
            aria-label={`Grouped bar chart of credits and debits across ${rows.length} months`}
            preserveAspectRatio="none"
            onMouseLeave={() => setHover(null)}
          >
            {rows.map((row, index) => {
              const creditHeight = Math.max((row.credits / max) * 108, row.credits > 0 ? 2 : 0);
              const debitHeight = Math.max((row.debits / max) * 108, row.debits > 0 ? 2 : 0);
              const dim = hover !== null && hover !== index ? 0.45 : 1;
              return (
                <g key={row.month} onMouseEnter={() => setHover(index)}>
                  <rect x={index * columnWidth} y={0} width={columnWidth} height={120} fill="transparent" />
                  <rect
                    x={index * columnWidth + 6}
                    y={120 - creditHeight}
                    width={13}
                    height={creditHeight}
                    rx={creditHeight > 4 ? 3 : 0}
                    fill={IN}
                    opacity={dim}
                  />
                  <rect
                    x={index * columnWidth + 21}
                    y={120 - debitHeight}
                    width={13}
                    height={debitHeight}
                    rx={debitHeight > 4 ? 3 : 0}
                    fill={OUT}
                    opacity={dim}
                  />
                </g>
              );
            })}
            <line x1="0" y1="119.5" x2={rows.length * columnWidth} y2="119.5" stroke="#E5E3DC" />
          </svg>
          <div className="mt-1 flex justify-between text-xs text-muted">
            <span>{rows[0]?.label}</span>
            <span>{rows[rows.length - 1]?.label}</span>
          </div>
        </div>
      )}
    </Card>
  );
}

export function CategoryBars({
  title,
  rows,
  currency,
  direction,
  emptyMessage,
}: {
  title: string;
  rows: CategoryRow[];
  currency: string;
  direction: "DEBIT" | "CREDIT";
  emptyMessage: string;
}) {
  const value = (row: CategoryRow) => (direction === "DEBIT" ? row.debit : row.credit);
  const max = Math.max(1, ...rows.map(value));
  const colour = direction === "DEBIT" ? OUT : IN;

  return (
    <Card>
      <h3 className="mb-4 text-base font-bold text-ink">{title}</h3>
      {rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">{emptyMessage}</p>
      ) : (
        <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
          {rows.slice(0, 14).map((row) => (
            <div key={row.category}>
              <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                <span className="truncate font-medium text-ink">{row.category}</span>
                <span className="shrink-0 text-muted">
                  {formatMoney(value(row), currency)} · {row.share.toFixed(1)}%
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-cream">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${(value(row) / max) * 100}%`, background: colour }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export function PartyTable({ rows, currency }: { rows: PartyRow[]; currency: string }) {
  return (
    <Card>
      <h3 className="mb-4 text-base font-bold text-ink">Top counterparties</h3>
      {rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">
          No counterparties were identified in these narrations.
        </p>
      ) : (
        <div className="max-h-80 overflow-y-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-muted-line/30 text-left text-muted">
                <th className="py-1.5 pr-4 font-semibold">Party</th>
                <th className="py-1.5 pr-4 text-right font-semibold">Paid out</th>
                <th className="py-1.5 pr-4 text-right font-semibold">Received</th>
                <th className="py-1.5 text-right font-semibold">Count</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.party} className="border-b border-muted-line/20">
                  <td className="max-w-[220px] truncate py-1.5 pr-4 text-ink">{row.party}</td>
                  <td className="py-1.5 pr-4 text-right text-ink">{formatMoney(row.debit, currency)}</td>
                  <td className="py-1.5 pr-4 text-right text-ink">{formatMoney(row.credit, currency)}</td>
                  <td className="py-1.5 text-right text-muted">{row.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

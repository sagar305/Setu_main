"use client";

// Shared building blocks for the financial statement tools (P&L, Balance
// Sheet, Cash Flow, Customer Statement): an editable list of labelled amounts,
// and a generic print pipeline that renders a clean A4 statement.

import { Field, NumberInput, SecondaryButton, TextInput } from "@/components/toolkit/ui";
import { generateLocalId } from "@/lib/hooks/useLocalStore";

export type StatementLine = { id: string; label: string; amount: number };

export const blankLine = (label = ""): StatementLine => ({
  id: generateLocalId(),
  label,
  amount: 0,
});

export const sumLines = (lines: StatementLine[]) =>
  lines.reduce((acc, l) => acc + (l.amount || 0), 0);

export function LineSectionEditor({
  title,
  lines,
  onChange,
  addLabel = "+ Add line",
}: {
  title: string;
  lines: StatementLine[];
  onChange: (lines: StatementLine[]) => void;
  addLabel?: string;
}) {
  const update = (id: string, patch: Partial<StatementLine>) =>
    onChange(lines.map((l) => (l.id === id ? { ...l, ...patch } : l)));

  return (
    <div>
      <h3 className="mb-2 text-sm font-bold text-ink">{title}</h3>
      <div className="space-y-2">
        {lines.map((line) => (
          <div key={line.id} className="grid grid-cols-[1fr_130px_auto] items-end gap-2">
            <Field label="">
              <TextInput
                value={line.label}
                onChange={(e) => update(line.id, { label: e.target.value })}
                placeholder="Item name"
              />
            </Field>
            <Field label="">
              <NumberInput
                step="0.01"
                value={line.amount || ""}
                onChange={(e) => update(line.id, { amount: Number(e.target.value) || 0 })}
                placeholder="0.00"
              />
            </Field>
            <button
              type="button"
              onClick={() => onChange(lines.filter((l) => l.id !== line.id))}
              disabled={lines.length === 1}
              className="mb-2.5 text-sm font-semibold text-red-500 hover:text-red-600 disabled:opacity-40"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <SecondaryButton className="mt-2" onClick={() => onChange([...lines, blankLine()])}>
        {addLabel}
      </SecondaryButton>
    </div>
  );
}

export type PrintRow = {
  label: string;
  value: string;
  kind?: "normal" | "subtotal" | "total" | "heading";
};

/** Open a print window with a simple single-column financial statement. */
export function printStatement({
  docTitle,
  businessName,
  periodLabel,
  rows,
  footNote,
}: {
  docTitle: string;
  businessName: string;
  periodLabel: string;
  rows: PrintRow[];
  footNote?: string;
}) {
  const body = rows
    .map((r) => {
      if (r.kind === "heading")
        return `<tr class="heading"><td colspan="2">${esc(r.label)}</td></tr>`;
      const cls = r.kind === "total" ? "total" : r.kind === "subtotal" ? "subtotal" : "";
      return `<tr class="${cls}"><td>${esc(r.label)}</td><td class="r">${esc(r.value)}</td></tr>`;
    })
    .join("");

  const html = `<!doctype html><html><head><title>${esc(docTitle)}</title><style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Georgia, "Times New Roman", serif; color: #1a1a2e; padding: 48px 56px; }
    @page { size: A4; margin: 0; }
    .head { text-align: center; margin-bottom: 32px; }
    .head .biz { font-size: 20px; font-weight: bold; }
    .head .doc { font-size: 13px; text-transform: uppercase; letter-spacing: 3px; color: #26306B; margin-top: 6px; }
    .head .period { font-size: 12px; color: #8a8a9a; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    td { padding: 7px 6px; border-bottom: 1px solid #f0f0f4; }
    .r { text-align: right; white-space: nowrap; }
    tr.heading td { font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px; color: #8a8a9a; border-bottom: 2px solid #26306B; padding-top: 18px; }
    tr.subtotal td { font-weight: bold; border-top: 1px solid #c9c9d6; }
    tr.total td { font-weight: bold; font-size: 15px; color: #26306B; border-top: 2px solid #26306B; border-bottom: 3px double #26306B; }
    .foot { margin-top: 36px; font-size: 11px; color: #8a8a9a; display: flex; justify-content: space-between; }
  </style></head><body>
    <div class="head">
      <p class="biz">${esc(businessName || "Your Business")}</p>
      <p class="doc">${esc(docTitle)}</p>
      <p class="period">${esc(periodLabel)}</p>
    </div>
    <table><tbody>${body}</tbody></table>
    <div class="foot">
      <span>${footNote ? esc(footNote) : "Prepared with Setu Technology's free tools"}</span>
      <span>Generated ${new Date().toLocaleDateString("en-IN")}</span>
    </div>
    <script>window.onload = () => window.print();</script>
  </body></html>`;

  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(html);
  win.document.close();
}

export function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

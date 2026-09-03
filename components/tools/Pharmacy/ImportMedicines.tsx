"use client";

import { useRef, useState } from "react";
import { Download, FileUp } from "lucide-react";
import { usePharmacy } from "@/lib/pharmacy/store";
import {
  downloadCsv,
  medicineTemplateCsv,
  parseMedicineImport,
  type ParsedMedicineRow,
} from "@/lib/pharmacy/csv";
import { FORM_LABELS, SCHEDULE_LABELS } from "@/lib/pharmacy/types";
import { Modal, inputClass, primaryBtnClass, secondaryBtnClass } from "./ui";

/**
 * The medicine-master importer.
 *
 * We ship no drug dataset on purpose — a wrong strength or a wrong schedule in
 * a seeded list is not like a wrong price in a product list — so this is how a
 * shop gets its shelf into the app. It takes a pasted block as readily as a
 * file, because a great many owners will copy columns straight out of the
 * spreadsheet their old software exported.
 *
 * Nothing is written until the preview has been seen. An import that silently
 * created four hundred half-right medicines would be worse than no import.
 */
export function ImportMedicines({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { importMedicines } = usePharmacy();
  const [text, setText] = useState("");
  const [rows, setRows] = useState<ParsedMedicineRow[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [done, setDone] = useState(0);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const preview = (raw: string) => {
    setText(raw);
    setDone(0);
    if (!raw.trim()) {
      setRows([]);
      setErrors([]);
      return;
    }
    const result = parseMedicineImport(raw);
    setRows(result.rows);
    setErrors(result.errors);
  };

  const commit = async () => {
    if (rows.length === 0) return;
    setSaving(true);
    try {
      const count = await importMedicines(rows);
      setDone(count);
      setRows([]);
      setText("");
      setErrors([]);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Import your medicine master" wide>
      <div className="grid gap-4">
        <p className="text-sm text-muted">
          Paste columns from a spreadsheet, or pick a CSV. A header row is used when there is
          one — <strong>Name</strong>, <strong>Composition</strong>, <strong>Manufacturer</strong>,{" "}
          <strong>Pack size</strong>, <strong>GST</strong>, <strong>Schedule</strong> and their
          usual aliases are all understood. Without a header, columns are read as Name,
          Composition, Manufacturer, Strength, Pack size.
        </p>

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => fileRef.current?.click()} className={secondaryBtnClass}>
            <FileUp className="h-4 w-4" aria-hidden="true" />
            Choose a CSV
          </button>
          <button
            type="button"
            onClick={() => downloadCsv("medicine-master-template.csv", medicineTemplateCsv())}
            className={secondaryBtnClass}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Download a template
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv,text/plain"
            className="hidden"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) preview(await file.text());
            }}
          />
        </div>

        <textarea
          className={`${inputClass} min-h-[120px] font-mono text-xs`}
          value={text}
          onChange={(event) => preview(event.target.value)}
          placeholder={"Name,Composition,Manufacturer,Pack size\nCrocin Advance,Paracetamol 500mg,GSK,15"}
        />

        {done > 0 && (
          <p className="rounded-lg border border-green-300 bg-green-50 p-3 text-sm font-semibold text-green-800">
            {done} medicine{done === 1 ? "" : "s"} imported. Rows matching an existing barcode, or
            an existing name and strength, updated it rather than adding a duplicate.
          </p>
        )}

        {rows.length > 0 && (
          <>
            <p className="text-sm font-semibold text-ink">
              {rows.length} medicine{rows.length === 1 ? "" : "s"} ready
            </p>
            <div className="max-h-56 overflow-auto rounded-lg border border-muted-line/30">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-cream-paper">
                  <tr>
                    <th className="p-2 font-semibold text-muted">Name</th>
                    <th className="p-2 font-semibold text-muted">Composition</th>
                    <th className="p-2 font-semibold text-muted">Form</th>
                    <th className="p-2 font-semibold text-muted">Pack</th>
                    <th className="p-2 font-semibold text-muted">GST</th>
                    <th className="p-2 font-semibold text-muted">Schedule</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 100).map((row, index) => (
                    <tr key={`${row.name}-${index}`} className="border-t border-muted-line/20">
                      <td className="p-2 font-semibold text-ink">{row.name}</td>
                      <td className="p-2 text-muted">{row.composition || "—"}</td>
                      <td className="p-2 text-muted">{FORM_LABELS[row.form]}</td>
                      <td className="p-2 text-muted">{row.packSize}</td>
                      <td className="p-2 text-muted">{row.taxRate}%</td>
                      <td className="p-2 text-muted">{SCHEDULE_LABELS[row.schedule]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rows.length > 100 && (
              <p className="text-xs text-muted">Showing the first 100 of {rows.length}.</p>
            )}
          </>
        )}

        {errors.length > 0 && (
          <div className="rounded-lg border border-saffron/50 bg-saffron/10 p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-ink">
              {errors.length} row{errors.length === 1 ? "" : "s"} skipped
            </p>
            <ul className="mt-1 grid gap-0.5 text-xs text-muted">
              {errors.slice(0, 8).map((message) => (
                <li key={message}>{message}</li>
              ))}
              {errors.length > 8 && <li>…and {errors.length - 8} more.</li>}
            </ul>
          </div>
        )}

        <p className="text-xs text-muted">
          Check the schedule column before importing. Anything this app cannot recognise is left
          unscheduled rather than guessed — an incorrect schedule either forces a prescription
          that does not exist, or fails to ask for one that does.
        </p>

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => void commit()}
            className={`${primaryBtnClass} sm:flex-1`}
            disabled={rows.length === 0 || saving}
          >
            {saving ? "Importing…" : `Import ${rows.length || ""} medicines`}
          </button>
          <button type="button" onClick={onClose} className={secondaryBtnClass}>
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}

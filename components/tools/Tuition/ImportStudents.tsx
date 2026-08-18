"use client";

// Bulk student import. A running coaching class already has its list in a
// notebook, a WhatsApp message or a spreadsheet — this accepts a pasted block
// or a CSV file so onboarding is not 80 forms.

import { useMemo, useRef, useState } from "react";
import { FileUp, Upload } from "lucide-react";
import { useTuition } from "@/lib/tuition/store";
import { parseStudentImport, type ImportResult } from "@/lib/tuition/csv";
import {
  Field,
  inputClass,
  Modal,
  primaryBtnClass,
  secondaryBtnClass,
} from "@/components/tools/FreePos/ui";

const SAMPLE = `Name, Class, Parent, Parent Phone, Batches
Aarav Sharma, Class 10, Rakesh Sharma, 9876543210, Maths Evening
Diya Patel, Class 9, Nisha Patel, 9876500011, Science Morning | Maths Evening`;

export function ImportStudents({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { batches, importStudents } = useTuition();
  const [text, setText] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [fallbackBatch, setFallbackBatch] = useState("");
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const activeBatches = useMemo(() => batches.filter((b) => b.active), [batches]);

  const preview = () => {
    setResult(parseStudentImport(text, batches));
    setDone(0);
  };

  const handleFile = async (file: File) => {
    const content = await file.text();
    setText(content);
    setResult(parseStudentImport(content, batches));
    setDone(0);
  };

  const runImport = async () => {
    if (!result || result.rows.length === 0) return;
    setImporting(true);
    try {
      const rows = result.rows.map((row) => ({
        ...row,
        batchIds:
          row.batchIds.length > 0 ? row.batchIds : fallbackBatch ? [fallbackBatch] : [],
      }));
      const count = await importStudents(rows);
      setDone(count);
      setText("");
      setResult(null);
    } finally {
      setImporting(false);
    }
  };

  const close = () => {
    setText("");
    setResult(null);
    setDone(0);
    onClose();
  };

  return (
    <Modal open={open} onClose={close} title="Import students" wide>
      <p className="text-sm text-muted">
        Paste rows straight from a spreadsheet or WhatsApp, or upload a CSV. A header row is
        used when present; otherwise columns are read as{" "}
        <span className="font-semibold text-ink">Name, Class, Parent, Parent Phone, Batches</span>.
      </p>

      <div className="mt-4">
        <Field label="Paste your list">
          <textarea
            value={text}
            onChange={(event) => {
              setText(event.target.value);
              setResult(null);
            }}
            rows={7}
            placeholder={SAMPLE}
            className={`${inputClass} font-mono text-xs`}
          />
        </Field>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => fileRef.current?.click()} className={secondaryBtnClass}>
          <FileUp className="h-4 w-4" />
          Upload CSV
        </button>
        <button
          type="button"
          onClick={preview}
          disabled={!text.trim()}
          className={secondaryBtnClass}
        >
          Preview
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv,text/plain"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleFile(file);
            event.target.value = "";
          }}
        />
      </div>

      {done > 0 && (
        <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {done} student{done > 1 ? "s" : ""} imported.
        </p>
      )}

      {result && (
        <div className="mt-4 rounded-xl border border-muted-line/30 bg-white p-4">
          <p className="text-sm font-semibold text-ink">
            {result.rows.length} student{result.rows.length === 1 ? "" : "s"} ready to import
          </p>

          {result.unknownBatches.length > 0 && (
            <p className="mt-2 rounded-lg bg-saffron/10 px-3 py-2 text-xs text-ink">
              These batch names are not in your list yet:{" "}
              <span className="font-semibold">{result.unknownBatches.join(", ")}</span>. Create
              them first, or pick a batch below for everyone.
            </p>
          )}

          {activeBatches.length > 0 && (
            <div className="mt-3">
              <Field label="Batch for students with no batch matched">
                <select
                  value={fallbackBatch}
                  onChange={(event) => setFallbackBatch(event.target.value)}
                  className={inputClass}
                >
                  <option value="">No batch</option>
                  {activeBatches.map((batch) => (
                    <option key={batch.id} value={batch.id}>
                      {batch.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          )}

          {result.errors.length > 0 && (
            <ul className="mt-3 space-y-1 text-xs text-red-700">
              {result.errors.slice(0, 5).map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          )}

          <div className="mt-3 max-h-48 overflow-y-auto rounded-lg border border-muted-line/20">
            <table className="w-full text-left text-xs">
              <thead className="bg-cream-paper text-muted">
                <tr>
                  <th className="px-3 py-1.5 font-semibold">Name</th>
                  <th className="px-3 py-1.5 font-semibold">Class</th>
                  <th className="px-3 py-1.5 font-semibold">Parent phone</th>
                  <th className="px-3 py-1.5 font-semibold">Batches</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.slice(0, 50).map((row, index) => (
                  <tr key={`${row.name}-${index}`} className="border-t border-muted-line/20">
                    <td className="px-3 py-1.5 text-ink">{row.name}</td>
                    <td className="px-3 py-1.5 text-muted">{row.classLevel}</td>
                    <td className="px-3 py-1.5 text-muted">{row.parentPhone}</td>
                    <td className="px-3 py-1.5 text-muted">{row.batchNames.join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex justify-end gap-3">
            <button type="button" onClick={close} className={secondaryBtnClass}>
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void runImport()}
              disabled={importing || result.rows.length === 0}
              className={primaryBtnClass}
            >
              <Upload className="h-4 w-4" />
              {importing ? "Importing…" : `Import ${result.rows.length}`}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

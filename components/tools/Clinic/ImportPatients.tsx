"use client";

import { useRef, useState } from "react";
import { FileSpreadsheet, Upload } from "lucide-react";
import {
  describeImport,
  downloadCsv,
  parsePatientImport,
  patientImportTemplate,
  type ParsedPatientRow,
} from "@/lib/clinic/csv";
import { useClinic } from "@/lib/clinic/store";
import { inputClass, primaryBtnClass, secondaryBtnClass } from "@/components/tools/FreePos/ui";

/**
 * Bulk import for the clinic that already keeps a register in Excel. Accepts a
 * pasted block as well as a file, because "select all, copy" is what people
 * actually do with a spreadsheet.
 */
export function ImportPatients({ onDone }: { onDone: (count: number) => void }) {
  const { importPatients } = useClinic();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [rows, setRows] = useState<ParsedPatientRow[] | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);

  const analyse = (value: string) => {
    setText(value);
    if (!value.trim()) {
      setRows(null);
      setErrors([]);
      return;
    }
    const result = parsePatientImport(value);
    setRows(result.rows);
    setErrors(result.errors);
  };

  const runImport = async () => {
    if (!rows || rows.length === 0) return;
    setImporting(true);
    try {
      const count = await importPatients(rows);
      onDone(count);
      setText("");
      setRows(null);
      setErrors([]);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Paste your register below, or upload a CSV. The first row can be a header — Name, Phone,
        Age, Sex, Address, Blood Group, Allergies, Chronic Conditions are all recognised. Without
        a header, columns are read as Name, Phone, Age, Sex, Address.
      </p>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className={secondaryBtnClass}
        >
          <Upload className="h-4 w-4" />
          Upload CSV
        </button>
        <button
          type="button"
          onClick={() => downloadCsv("patient-import-template.csv", patientImportTemplate())}
          className={secondaryBtnClass}
        >
          <FileSpreadsheet className="h-4 w-4" />
          Download template
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv,text/plain"
        className="hidden"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) analyse(await file.text());
        }}
      />

      <textarea
        value={text}
        onChange={(event) => analyse(event.target.value)}
        rows={7}
        placeholder={"Ramesh Kumar, 9876543210, 42, M, 12 MG Road"}
        className={`${inputClass} font-mono text-xs`}
      />

      {rows && (
        <div className="rounded-xl border border-muted-line/30 bg-cream/50 p-3">
          <p className="text-sm font-semibold text-ink">{describeImport(rows)}</p>
          {errors.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-xs text-red-600">
              {errors.slice(0, 6).map((error) => (
                <li key={error}>{error}</li>
              ))}
              {errors.length > 6 && <li>…and {errors.length - 6} more.</li>}
            </ul>
          )}
          {rows.length > 0 && (
            <div className="mt-3 max-h-48 overflow-auto rounded-lg border border-muted-line/30 bg-white">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-cream">
                  <tr>
                    <th className="px-2 py-1.5 text-left font-semibold text-muted">Name</th>
                    <th className="px-2 py-1.5 text-left font-semibold text-muted">Phone</th>
                    <th className="px-2 py-1.5 text-left font-semibold text-muted">Age</th>
                    <th className="px-2 py-1.5 text-left font-semibold text-muted">Sex</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 50).map((row, index) => (
                    <tr key={`${row.name}-${index}`} className="border-t border-muted-line/20">
                      <td className="px-2 py-1.5 text-ink">{row.name}</td>
                      <td className="px-2 py-1.5 text-muted">{row.phone}</td>
                      <td className="px-2 py-1.5 text-muted">
                        {row.dob || (row.ageYears !== null ? `${row.ageYears} y` : "")}
                      </td>
                      <td className="px-2 py-1.5 text-muted">{row.sex}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={runImport}
        disabled={!rows || rows.length === 0 || importing}
        className={primaryBtnClass}
      >
        {importing ? "Importing…" : `Import ${rows?.length ?? 0} patients`}
      </button>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Plus, Upload, Users } from "lucide-react";
import { useTuition } from "@/lib/tuition/store";
import { studentBalance, studentMonthlyFee } from "@/lib/tuition/calc";
import { downloadCsv, studentsCsv } from "@/lib/tuition/csv";
import { formatMoney } from "@/lib/pos/types";
import type { Student } from "@/lib/tuition/types";
import {
  EmptyState,
  inputClass,
  primaryBtnClass,
  SearchInput,
  secondaryBtnClass,
} from "@/components/tools/FreePos/ui";
import { StudentForm } from "./StudentForm";
import { StudentDetail } from "./StudentDetail";
import { ImportStudents } from "./ImportStudents";

export function StudentsScreen({
  externalQuery,
}: {
  externalQuery?: { value: string; nonce: number } | null;
}) {
  const { students, batches, dues, payments, business } = useTuition();
  const [query, setQuery] = useState("");
  const [batchFilter, setBatchFilter] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [selected, setSelected] = useState<Student | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const currency = business?.currency ?? "INR";

  useEffect(() => {
    if (externalQuery) setQuery(externalQuery.value);
  }, [externalQuery]);

  // Keep the open detail sheet in step with edits made inside it.
  useEffect(() => {
    if (!selected) return;
    const fresh = students.find((s) => s.id === selected.id) ?? null;
    if (fresh !== selected) setSelected(fresh);
  }, [students, selected]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return students.filter((student) => {
      if (!showInactive && student.status !== "active") return false;
      if (batchFilter && !student.batchIds.includes(batchFilter)) return false;
      if (!needle) return true;
      return (
        student.name.toLowerCase().includes(needle) ||
        student.parentName.toLowerCase().includes(needle) ||
        student.parentPhone.includes(needle) ||
        student.rollNo.toLowerCase().includes(needle) ||
        student.classLevel.toLowerCase().includes(needle)
      );
    });
  }, [students, query, batchFilter, showInactive]);

  const openAdd = () => {
    setEditing(null);
    setFormOpen(true);
  };

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="w-full sm:max-w-xs">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Search name, parent or phone…"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setImportOpen(true)} className={secondaryBtnClass}>
            <Upload className="h-4 w-4" />
            Import
          </button>
          <button
            type="button"
            onClick={() => downloadCsv("students.csv", studentsCsv(students, batches))}
            disabled={students.length === 0}
            className={secondaryBtnClass}
          >
            <Download className="h-4 w-4" />
            Export
          </button>
          <button type="button" onClick={openAdd} className={primaryBtnClass}>
            <Plus className="h-4 w-4" />
            Add student
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <select
          value={batchFilter}
          onChange={(event) => setBatchFilter(event.target.value)}
          className={`${inputClass} w-auto`}
        >
          <option value="">All batches</option>
          {batches.map((batch) => (
            <option key={batch.id} value={batch.id}>
              {batch.name}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-muted">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(event) => setShowInactive(event.target.checked)}
            className="h-4 w-4 rounded border-muted-line/40 text-indigo focus:ring-indigo"
          />
          Show students who left
        </label>
        <span className="text-sm text-muted">
          {visible.length} student{visible.length === 1 ? "" : "s"}
        </span>
      </div>

      {students.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={<Users className="h-6 w-6" />}
            title="No students yet"
            message="Add your first student, or paste your whole list at once with Import."
            action={
              <div className="flex gap-2">
                <button type="button" onClick={openAdd} className={primaryBtnClass}>
                  <Plus className="h-4 w-4" />
                  Add student
                </button>
                <button
                  type="button"
                  onClick={() => setImportOpen(true)}
                  className={secondaryBtnClass}
                >
                  <Upload className="h-4 w-4" />
                  Import a list
                </button>
              </div>
            }
          />
        </div>
      ) : visible.length === 0 ? (
        <p className="mt-8 text-center text-sm text-muted">No students match this search.</p>
      ) : (
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {visible.map((student) => {
            const balance = studentBalance(student.id, dues, payments);
            const fee = studentMonthlyFee(student, batches);
            const enrolled = batches.filter((b) => student.batchIds.includes(b.id));
            return (
              <li key={student.id} className="min-w-0">
                <button
                  type="button"
                  onClick={() => setSelected(student)}
                  className="flex w-full items-center justify-between gap-3 rounded-xl border border-muted-line/30 bg-white p-3 text-left transition hover:border-indigo/40"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-ink">
                      {student.name}
                      {student.status !== "active" && (
                        <span className="ml-2 rounded-full bg-cream-paper px-2 py-0.5 text-[10px] font-semibold uppercase text-muted">
                          Left
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-muted">
                      {[student.classLevel, enrolled.map((b) => b.name).join(", ")]
                        .filter(Boolean)
                        .join(" · ") || "No batch"}
                    </p>
                    <p className="truncate text-xs text-muted">
                      {student.parentPhone || "No parent number"}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold text-ink">
                      {formatMoney(fee.total, currency)}
                      <span className="text-xs font-normal text-muted">/mo</span>
                    </p>
                    {balance.outstanding > 0 ? (
                      <p className="text-xs font-bold text-red-600">
                        {formatMoney(balance.outstanding, currency)} due
                      </p>
                    ) : (
                      <p className="text-xs font-semibold text-emerald-600">No dues</p>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <StudentForm
        open={formOpen}
        student={editing}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
      />

      <StudentDetail
        student={formOpen ? null : selected}
        onClose={() => setSelected(null)}
        onEdit={(student) => {
          setEditing(student);
          setFormOpen(true);
        }}
      />

      <ImportStudents open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  );
}

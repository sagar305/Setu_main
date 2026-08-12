"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useTuition, type StudentInput } from "@/lib/tuition/store";
import { studentMonthlyFee } from "@/lib/tuition/calc";
import { formatMoney } from "@/lib/pos/types";
import {
  COMMON_CUSTOM_FIELDS,
  generateId,
  todayIso,
  type Student,
} from "@/lib/tuition/types";
import { Field, inputClass, Modal, primaryBtnClass, secondaryBtnClass } from "@/components/tools/FreePos/ui";

const EMPTY: StudentInput = {
  name: "",
  rollNo: "",
  classLevel: "",
  school: "",
  batchIds: [],
  parentName: "",
  parentPhone: "",
  altPhone: "",
  studentPhone: "",
  email: "",
  address: "",
  dob: "",
  joinDate: "",
  concessionType: "flat",
  concessionValue: 0,
  customMonthlyFee: null,
  status: "active",
  leftOn: "",
  leaveReason: "",
  rejoinedOn: "",
  custom: [],
  notes: "",
};

export function StudentForm({
  open,
  student,
  onClose,
}: {
  open: boolean;
  /** null = adding a new student. */
  student: Student | null;
  onClose: () => void;
}) {
  const { batches, business, createStudent, updateStudent } = useTuition();
  const [form, setForm] = useState<StudentInput>(EMPTY);
  const [customFee, setCustomFee] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const currency = business?.currency ?? "INR";

  useEffect(() => {
    if (!open) return;
    if (student) {
      const { id, createdAt, updatedAt, ...rest } = student;
      void id;
      void createdAt;
      void updatedAt;
      // Records saved before custom fields existed have no array to spread.
      setForm({ ...rest, custom: Array.isArray(rest.custom) ? rest.custom : [] });
      setCustomFee(student.customMonthlyFee !== null ? String(student.customMonthlyFee) : "");
    } else {
      setForm({ ...EMPTY, joinDate: todayIso() });
      setCustomFee("");
    }
    setError("");
  }, [open, student]);

  const activeBatches = useMemo(() => batches.filter((b) => b.active || form.batchIds.includes(b.id)), [batches, form.batchIds]);

  const preview = useMemo(
    () =>
      studentMonthlyFee(
        {
          ...(student ?? ({} as Student)),
          ...form,
          customMonthlyFee: customFee.trim() === "" ? null : Number(customFee),
        } as Student,
        batches
      ),
    [form, customFee, batches, student]
  );

  const toggleBatch = (batchId: string) => {
    setForm((prev) => ({
      ...prev,
      batchIds: prev.batchIds.includes(batchId)
        ? prev.batchIds.filter((id) => id !== batchId)
        : [...prev.batchIds, batchId],
    }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) {
      setError("Student name is required.");
      return;
    }
    setSaving(true);
    setError("");
    const payload: StudentInput = {
      ...form,
      name: form.name.trim(),
      parentPhone: form.parentPhone.trim(),
      joinDate: form.joinDate || todayIso(),
      customMonthlyFee:
        customFee.trim() === "" || Number.isNaN(Number(customFee)) ? null : Number(customFee),
      concessionValue: Number(form.concessionValue) || 0,
      // Drop rows the teacher started and left blank.
      custom: form.custom
        .map((field) => ({ ...field, label: field.label.trim(), value: field.value.trim() }))
        .filter((field) => field.label || field.value),
    };
    try {
      if (student) await updateStudent(student.id, payload);
      else await createStudent(payload);
      onClose();
    } catch {
      setError("Could not save this student. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={student ? "Edit student" : "Add student"} wide>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Student name" required>
            <input
              type="text"
              value={form.name}
              onChange={(event) => setForm((p) => ({ ...p, name: event.target.value }))}
              className={inputClass}
              autoFocus
            />
          </Field>
          <Field label="Class / grade">
            <input
              type="text"
              value={form.classLevel}
              onChange={(event) => setForm((p) => ({ ...p, classLevel: event.target.value }))}
              placeholder="e.g. Class 10"
              className={inputClass}
            />
          </Field>
          <Field label="Roll number">
            <input
              type="text"
              value={form.rollNo}
              onChange={(event) => setForm((p) => ({ ...p, rollNo: event.target.value }))}
              className={inputClass}
            />
          </Field>
          <Field label="School">
            <input
              type="text"
              value={form.school}
              onChange={(event) => setForm((p) => ({ ...p, school: event.target.value }))}
              className={inputClass}
            />
          </Field>
        </div>

        <div>
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
            Batches
          </span>
          {activeBatches.length === 0 ? (
            <p className="rounded-lg bg-cream-paper px-3 py-2 text-sm text-muted">
              No batches yet — add one in Settings → Batches. Fees come from the batches a
              student is enrolled in.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {activeBatches.map((batch) => {
                const on = form.batchIds.includes(batch.id);
                return (
                  <button
                    key={batch.id}
                    type="button"
                    onClick={() => toggleBatch(batch.id)}
                    aria-pressed={on}
                    className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
                      on
                        ? "border-indigo bg-indigo text-white"
                        : "border-muted-line/40 bg-white text-muted hover:text-indigo"
                    }`}
                  >
                    {batch.name}
                    <span className={`ml-1.5 text-xs ${on ? "text-white/75" : "text-muted/70"}`}>
                      {formatMoney(batch.monthlyFee, currency)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Parent / guardian name">
            <input
              type="text"
              value={form.parentName}
              onChange={(event) => setForm((p) => ({ ...p, parentName: event.target.value }))}
              className={inputClass}
            />
          </Field>
          <Field label="Parent WhatsApp number" hint="Reminders are sent to this number">
            <input
              type="tel"
              value={form.parentPhone}
              onChange={(event) => setForm((p) => ({ ...p, parentPhone: event.target.value }))}
              placeholder="98765 43210"
              className={inputClass}
            />
          </Field>
          <Field label="Alternate number">
            <input
              type="tel"
              value={form.altPhone}
              onChange={(event) => setForm((p) => ({ ...p, altPhone: event.target.value }))}
              className={inputClass}
            />
          </Field>
          <Field label="Student's own number">
            <input
              type="tel"
              value={form.studentPhone}
              onChange={(event) => setForm((p) => ({ ...p, studentPhone: event.target.value }))}
              className={inputClass}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Joining date" hint="Fees start from this month">
            <input
              type="date"
              value={form.joinDate}
              onChange={(event) => setForm((p) => ({ ...p, joinDate: event.target.value }))}
              className={inputClass}
            />
          </Field>
          <Field label="Date of birth" hint="For birthday reminders">
            <input
              type="date"
              value={form.dob}
              onChange={(event) => setForm((p) => ({ ...p, dob: event.target.value }))}
              className={inputClass}
            />
          </Field>
          <Field label="Status">
            <select
              value={form.status}
              onChange={(event) => {
                const status = event.target.value as Student["status"];
                setForm((p) => ({
                  ...p,
                  status,
                  // Leaving without a date would leave fees running forever.
                  leftOn: status === "inactive" ? p.leftOn || todayIso() : "",
                  leaveReason: status === "inactive" ? p.leaveReason : "",
                }));
              }}
              className={inputClass}
            >
              <option value="active">Currently attending</option>
              <option value="inactive">Left</option>
            </select>
          </Field>
        </div>

        {form.status === "inactive" && (
          <div className="grid gap-4 rounded-xl border border-muted-line/30 bg-cream-paper p-4 sm:grid-cols-2">
            <Field label="Left on" hint="Fees stop after this month">
              <input
                type="date"
                value={form.leftOn}
                onChange={(event) => setForm((p) => ({ ...p, leftOn: event.target.value }))}
                className={inputClass}
              />
            </Field>
            <Field label="Reason (optional)">
              <input
                type="text"
                value={form.leaveReason}
                onChange={(event) => setForm((p) => ({ ...p, leaveReason: event.target.value }))}
                placeholder="e.g. shifted city, board exams over"
                className={inputClass}
              />
            </Field>
          </div>
        )}

        <div className="rounded-xl border border-muted-line/30 bg-cream-paper p-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Concession" hint="Sibling / scholarship discount">
              <div className="flex gap-2">
                <input
                  type="number"
                  min={0}
                  value={form.concessionValue || ""}
                  onChange={(event) =>
                    setForm((p) => ({ ...p, concessionValue: Number(event.target.value) || 0 }))
                  }
                  placeholder="0"
                  className={inputClass}
                />
                <select
                  value={form.concessionType}
                  onChange={(event) =>
                    setForm((p) => ({
                      ...p,
                      concessionType: event.target.value as "flat" | "percent",
                    }))
                  }
                  className={`${inputClass} w-24`}
                >
                  <option value="flat">Flat</option>
                  <option value="percent">%</option>
                </select>
              </div>
            </Field>
            <Field label="Custom fee" hint="Overrides the batch total">
              <input
                type="number"
                min={0}
                value={customFee}
                onChange={(event) => setCustomFee(event.target.value)}
                placeholder="Leave blank"
                className={inputClass}
              />
            </Field>
            <div className="flex flex-col justify-end">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                Fee per month
              </span>
              <span className="mt-1 text-xl font-bold text-ink">
                {formatMoney(preview.total, currency)}
              </span>
              {preview.concession > 0 && (
                <span className="text-xs text-muted">
                  {formatMoney(preview.gross, currency)} less{" "}
                  {formatMoney(preview.concession, currency)} concession
                </span>
              )}
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted">
              Your own fields
            </span>
            <button
              type="button"
              onClick={() =>
                setForm((p) => ({
                  ...p,
                  custom: [...p.custom, { id: generateId(), label: "", value: "" }],
                }))
              }
              className="inline-flex items-center gap-1 text-xs font-semibold text-indigo hover:underline"
            >
              <Plus className="h-3.5 w-3.5" />
              Add a field
            </button>
          </div>
          <p className="mt-1 text-xs text-muted/80">
            Anything you want to remember — school test marks, a board roll number, weak topics.
          </p>

          {form.custom.length > 0 && (
            <ul className="mt-2 space-y-2">
              {form.custom.map((field, index) => (
                <li key={field.id} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={field.label}
                    onChange={(event) => {
                      const label = event.target.value;
                      setForm((p) => ({
                        ...p,
                        custom: p.custom.map((f, i) => (i === index ? { ...f, label } : f)),
                      }));
                    }}
                    placeholder="Field name"
                    list="tuition-custom-field-names"
                    className={`${inputClass} sm:w-56`}
                    aria-label={`Field name ${index + 1}`}
                  />
                  <input
                    type="text"
                    value={field.value}
                    onChange={(event) => {
                      const value = event.target.value;
                      setForm((p) => ({
                        ...p,
                        custom: p.custom.map((f, i) => (i === index ? { ...f, value } : f)),
                      }));
                    }}
                    placeholder="Value — e.g. Maths 78/100"
                    className={`${inputClass} flex-1`}
                    aria-label={`Field value ${index + 1}`}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setForm((p) => ({ ...p, custom: p.custom.filter((_, i) => i !== index) }))
                    }
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-muted-line/40 text-muted transition hover:border-red-300 hover:text-red-600"
                    aria-label={`Remove field ${index + 1}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <datalist id="tuition-custom-field-names">
            {COMMON_CUSTOM_FIELDS.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </div>

        <Field label="Notes">
          <textarea
            value={form.notes}
            onChange={(event) => setForm((p) => ({ ...p, notes: event.target.value }))}
            rows={2}
            className={inputClass}
          />
        </Field>

        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className={secondaryBtnClass}>
            Cancel
          </button>
          <button type="submit" disabled={saving} className={primaryBtnClass}>
            {saving ? "Saving…" : student ? "Save changes" : "Add student"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

"use client";

// Tests: create a test for a batch, enter the whole batch's marks in one pass,
// then send each parent their own child's result.

import { useEffect, useMemo, useState } from "react";
import { ClipboardList, Download, MessageCircle, Plus, Share2, Trash2 } from "lucide-react";
import { useTuition, type MarkEntry } from "@/lib/tuition/store";
import { percentOf, studentsInBatch, testStats } from "@/lib/tuition/calc";
import { downloadCsv, marksCsv } from "@/lib/tuition/csv";
import { fillTemplate, type OutboundMessage } from "@/lib/tuition/messages";
import { formatDate, markId, todayIso, type TestRecord } from "@/lib/tuition/types";
import type { SharedDoc } from "@/lib/toolkit/shareLink";
import { ShareDialog } from "@/components/toolkit/ShareDialog";
import {
  ConfirmDialog,
  EmptyState,
  Field,
  inputClass,
  Modal,
  primaryBtnClass,
  secondaryBtnClass,
} from "@/components/tools/FreePos/ui";
import { marksDoc, shareUrlFor } from "./share";
import { SendQueue } from "./SendQueue";

export function TestsScreen() {
  const {
    tests,
    marks,
    batches,
    students,
    business,
    settings,
    createTest,
    deleteTest,
    saveMarks,
    markResultSent,
  } = useTuition();

  const [formOpen, setFormOpen] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [entries, setEntries] = useState<Record<string, MarkEntry>>({});
  const [saved, setSaved] = useState(false);
  const [queue, setQueue] = useState<OutboundMessage[] | null>(null);
  const [shareDoc, setShareDoc] = useState<SharedDoc | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<TestRecord | null>(null);

  const test = tests.find((t) => t.id === selectedId) ?? null;
  const batch = test ? batches.find((b) => b.id === test.batchId) ?? null : null;
  const roll = useMemo(
    () => (test ? studentsInBatch(students, test.batchId) : []),
    [students, test]
  );

  useEffect(() => {
    if (!selectedId && tests.length > 0) setSelectedId(tests[0].id);
  }, [tests, selectedId]);

  // Load the saved marks for whichever test is open.
  useEffect(() => {
    if (!test) return;
    const next: Record<string, MarkEntry> = {};
    for (const student of roll) {
      const existing = marks.find((m) => m.id === markId(test.id, student.id));
      next[student.id] = {
        studentId: student.id,
        marks: existing ? existing.marks : null,
        remark: existing?.remark ?? "",
      };
    }
    setEntries(next);
    setSaved(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, roll.length]);

  const currentMarks = useMemo(
    () => (test ? marks.filter((m) => m.testId === test.id) : []),
    [marks, test]
  );
  const stats = useMemo(() => testStats(currentMarks), [currentMarks]);

  const handleSave = async () => {
    if (!test) return;
    await saveMarks(test.id, Object.values(entries));
    setSaved(true);
  };

  const buildMessages = (studentIds: string[]): OutboundMessage[] => {
    if (!test) return [];
    return studentIds
      .map((studentId) => {
        const student = students.find((s) => s.id === studentId);
        const mark = marks.find((m) => m.id === markId(test.id, studentId));
        if (!student || !mark) return null;
        const doc = marksDoc(
          business,
          student,
          test,
          mark,
          { average: stats.average, rank: stats.ranks[studentId], appeared: stats.appeared },
          settings
        );
        return {
          id: student.id,
          name: student.name,
          phone: student.parentPhone,
          message: fillTemplate(settings.templates.marks, {
            parent: student.parentName || "Sir/Ma'am",
            student: student.name,
            test: test.name,
            subject: test.subject,
            marks: mark.marks === null ? "absent" : mark.marks,
            max: test.maxMarks,
            percent: mark.marks === null ? "—" : percentOf(mark.marks, test.maxMarks),
            average: stats.average,
            date: formatDate(test.date),
            link: shareUrlFor(doc),
            teacher: business?.name ?? "",
          }),
        };
      })
      .filter((m): m is OutboundMessage => m !== null);
  };

  const sendAll = () => {
    const withMarks = currentMarks.map((m) => m.studentId);
    setQueue(buildMessages(withMarks));
  };

  if (batches.length === 0) {
    return (
      <EmptyState
        icon={<ClipboardList className="h-6 w-6" />}
        title="Create a batch first"
        message="Tests belong to a batch, so the whole class's marks can be entered together."
      />
    );
  }

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-sm font-bold text-ink">Tests</h3>
        <button type="button" onClick={() => setFormOpen(true)} className={primaryBtnClass}>
          <Plus className="h-4 w-4" />
          New test
        </button>
      </div>

      {tests.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            icon={<ClipboardList className="h-6 w-6" />}
            title="No tests yet"
            message="Create a test, enter the batch's marks in one go, then send every parent their child's result."
            action={
              <button type="button" onClick={() => setFormOpen(true)} className={primaryBtnClass}>
                <Plus className="h-4 w-4" />
                New test
              </button>
            }
          />
        </div>
      ) : (
        <>
          <div className="-mx-1 mt-4 flex gap-2 overflow-x-auto pb-1">
            {tests.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedId(item.id)}
                aria-current={selectedId === item.id ? "true" : undefined}
                className={`inline-flex shrink-0 flex-col items-start rounded-xl border px-3 py-2 text-left transition ${
                  selectedId === item.id
                    ? "border-indigo bg-indigo text-white"
                    : "border-muted-line/30 bg-white text-ink hover:border-indigo/40"
                }`}
              >
                <span className="text-sm font-semibold">{item.name}</span>
                <span
                  className={`text-xs ${selectedId === item.id ? "text-white/70" : "text-muted"}`}
                >
                  {formatDate(item.date)}
                </span>
              </button>
            ))}
          </div>

          {test && (
            <div className="mt-5 rounded-2xl border border-muted-line/30 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h4 className="text-base font-bold text-ink">{test.name}</h4>
                  <p className="text-xs text-muted">
                    {[batch?.name, test.subject, `Max ${test.maxMarks}`, formatDate(test.date)]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => downloadCsv(`${test.name}-marks.csv`, marksCsv(test, currentMarks, students))}
                    disabled={currentMarks.length === 0}
                    className={secondaryBtnClass}
                  >
                    <Download className="h-4 w-4" />
                    CSV
                  </button>
                  <button
                    type="button"
                    onClick={sendAll}
                    disabled={currentMarks.length === 0}
                    className={secondaryBtnClass}
                  >
                    <MessageCircle className="h-4 w-4" />
                    Send results
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(test)}
                    className={`${secondaryBtnClass} px-3`}
                    aria-label="Delete this test"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {stats.appeared > 0 && (
                <p className="mt-3 rounded-lg bg-cream-paper px-3 py-2 text-xs text-muted">
                  {stats.appeared} appeared · average {stats.average}/{test.maxMarks} · highest{" "}
                  {stats.highest} · lowest {stats.lowest}
                </p>
              )}

              {roll.length === 0 ? (
                <p className="mt-4 text-sm text-muted">
                  No students in this batch yet.
                </p>
              ) : (
                <>
                  <ul className="mt-4 space-y-2">
                    {roll.map((student) => {
                      const entry = entries[student.id];
                      const mark = marks.find((m) => m.id === markId(test.id, student.id));
                      return (
                        <li
                          key={student.id}
                          className="flex flex-col gap-2 rounded-xl border border-muted-line/20 p-3 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-ink">
                              {student.name}
                            </p>
                            {mark?.sentAt && (
                              <p className="text-xs text-emerald-600">Result sent</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min={0}
                              max={test.maxMarks}
                              value={entry?.marks === null || entry === undefined ? "" : entry.marks}
                              onChange={(event) => {
                                const raw = event.target.value;
                                setEntries((prev) => ({
                                  ...prev,
                                  [student.id]: {
                                    studentId: student.id,
                                    marks: raw === "" ? null : Number(raw),
                                    remark: prev[student.id]?.remark ?? "",
                                  },
                                }));
                                setSaved(false);
                              }}
                              placeholder="Absent"
                              className={`${inputClass} w-24 text-center`}
                              aria-label={`Marks for ${student.name}`}
                            />
                            <span className="text-xs text-muted">/ {test.maxMarks}</span>
                            <input
                              type="text"
                              value={entry?.remark ?? ""}
                              onChange={(event) => {
                                const value = event.target.value;
                                setEntries((prev) => ({
                                  ...prev,
                                  [student.id]: {
                                    studentId: student.id,
                                    marks: prev[student.id]?.marks ?? null,
                                    remark: value,
                                  },
                                }));
                                setSaved(false);
                              }}
                              placeholder="Remark"
                              className={`${inputClass} flex-1 sm:w-40 sm:flex-none`}
                              aria-label={`Remark for ${student.name}`}
                            />
                            {mark && (
                              <button
                                type="button"
                                onClick={() =>
                                  setShareDoc(
                                    marksDoc(
                                      business,
                                      student,
                                      test,
                                      mark,
                                      {
                                        average: stats.average,
                                        rank: stats.ranks[student.id],
                                        appeared: stats.appeared,
                                      },
                                      settings
                                    )
                                  )
                                }
                                className={`${secondaryBtnClass} px-3 py-1.5`}
                                aria-label={`Share ${student.name}'s result`}
                              >
                                <Share2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>

                  <div className="mt-4 flex justify-end">
                    <button type="button" onClick={() => void handleSave()} className={primaryBtnClass}>
                      {saved ? "Saved" : "Save marks"}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}

      <TestForm open={formOpen} onClose={() => setFormOpen(false)} onCreate={createTest} />

      <ShareDialog
        open={Boolean(shareDoc)}
        doc={shareDoc}
        onClose={() => setShareDoc(null)}
        recipientLabel="parent"
        title="Share this result"
      />

      <SendQueue
        open={Boolean(queue)}
        title="Send results to parents"
        messages={queue ?? []}
        onClose={() => setQueue(null)}
        onSent={(ids) => {
          if (test) void markResultSent(test.id, ids);
        }}
      />

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title={`Delete ${confirmDelete?.name ?? "this test"}?`}
        message="The marks entered for this test will be deleted too."
        confirmLabel="Delete test"
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => {
          if (confirmDelete) {
            void deleteTest(confirmDelete.id);
            if (selectedId === confirmDelete.id) setSelectedId("");
          }
          setConfirmDelete(null);
        }}
      />
    </div>
  );
}

function TestForm({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (input: Omit<TestRecord, "id" | "createdAt">) => Promise<TestRecord>;
}) {
  const { batches } = useTuition();
  const activeBatches = batches.filter((b) => b.active);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [batchId, setBatchId] = useState("");
  const [date, setDate] = useState(todayIso());
  const [maxMarks, setMaxMarks] = useState("100");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && !batchId) setBatchId(activeBatches[0]?.id ?? "");
  }, [open, batchId, activeBatches]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !batchId) return;
    setSaving(true);
    try {
      await onCreate({
        name: name.trim(),
        subject: subject.trim(),
        batchId,
        date,
        maxMarks: Number(maxMarks) || 100,
      });
      setName("");
      setSubject("");
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="New test">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Test name" required>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Unit Test 2"
            className={inputClass}
            autoFocus
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Subject">
            <input
              type="text"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="e.g. Mathematics"
              className={inputClass}
            />
          </Field>
          <Field label="Batch" required>
            <select
              value={batchId}
              onChange={(event) => setBatchId(event.target.value)}
              className={inputClass}
            >
              {activeBatches.map((batch) => (
                <option key={batch.id} value={batch.id}>
                  {batch.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Date">
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value || todayIso())}
              className={inputClass}
            />
          </Field>
          <Field label="Maximum marks">
            <input
              type="number"
              min={1}
              value={maxMarks}
              onChange={(event) => setMaxMarks(event.target.value)}
              className={inputClass}
            />
          </Field>
        </div>
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className={secondaryBtnClass}>
            Cancel
          </button>
          <button type="submit" disabled={saving || !batchId} className={primaryBtnClass}>
            {saving ? "Creating…" : "Create test"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

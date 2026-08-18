"use client";

// The diary: a note pinned to a date, optionally to one student. "Ask about
// the missing homework on Friday", "call Aarav's mother", "bring the geometry
// box". Overdue notes keep showing until they are ticked off.

import { useMemo, useState } from "react";
import { Cake, Check, MessageCircle, NotebookPen, Plus, Trash2 } from "lucide-react";
import { useTuition } from "@/lib/tuition/store";
import { fillTemplate, type OutboundMessage } from "@/lib/tuition/messages";
import { formatDate, todayIso } from "@/lib/tuition/types";
import {
  EmptyState,
  Field,
  inputClass,
  Modal,
  primaryBtnClass,
  secondaryBtnClass,
} from "@/components/tools/FreePos/ui";
import { SendQueue } from "./SendQueue";

export function DiaryScreen() {
  const { notes, students, business, settings, createNote, toggleNote, deleteNote, markNoteSent } =
    useTuition();
  const [date, setDate] = useState(todayIso());
  const [formOpen, setFormOpen] = useState(false);
  const [queue, setQueue] = useState<OutboundMessage[] | null>(null);
  const [sentFor, setSentFor] = useState("");

  const forDate = useMemo(
    () => notes.filter((note) => note.date === date),
    [notes, date]
  );
  const overdue = useMemo(
    () => notes.filter((note) => !note.done && note.date < date),
    [notes, date]
  );

  const birthdays = useMemo(
    () => students.filter((s) => s.dob && s.dob.slice(5) === date.slice(5) && s.status === "active"),
    [students, date]
  );

  const studentName = (id: string) => students.find((s) => s.id === id)?.name ?? "";

  const sendNote = (noteId: string) => {
    const note = notes.find((n) => n.id === noteId);
    if (!note) return;
    const student = students.find((s) => s.id === note.studentId);
    if (!student) return;
    setSentFor(noteId);
    setQueue([
      {
        id: student.id,
        name: student.name,
        phone: student.parentPhone,
        message: fillTemplate(settings.templates.diary, {
          parent: student.parentName || "Sir/Ma'am",
          student: student.name,
          note: note.text,
          date: formatDate(note.date),
          teacher: business?.name ?? "",
        }),
      },
    ]);
  };

  const wishBirthday = (studentId: string) => {
    const student = students.find((s) => s.id === studentId);
    if (!student) return;
    setSentFor("");
    setQueue([
      {
        id: student.id,
        name: student.name,
        phone: student.parentPhone,
        message: fillTemplate(settings.templates.birthday, {
          parent: student.parentName || "Sir/Ma'am",
          student: student.name,
          teacher: business?.name ?? "",
        }),
      },
    ]);
  };

  const renderNote = (noteId: string, muted: boolean) => {
    const note = notes.find((n) => n.id === noteId);
    if (!note) return null;
    return (
      <li
        key={note.id}
        className={`flex items-start gap-3 rounded-xl border p-3 ${
          note.done ? "border-muted-line/20 bg-cream-paper" : "border-muted-line/30 bg-white"
        }`}
      >
        <button
          type="button"
          onClick={() => void toggleNote(note.id)}
          aria-label={note.done ? "Mark as not done" : "Mark as done"}
          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition ${
            note.done
              ? "border-emerald-600 bg-emerald-600 text-white"
              : "border-muted-line/50 bg-white text-transparent hover:border-indigo"
          }`}
        >
          <Check className="h-3.5 w-3.5" />
        </button>
        <div className="min-w-0 flex-1">
          <p className={`text-sm ${note.done ? "text-muted line-through" : "text-ink"}`}>
            {note.text}
          </p>
          <p className="text-xs text-muted">
            {[
              note.studentId ? studentName(note.studentId) : "General",
              muted ? formatDate(note.date) : "",
              note.sentAt ? "sent to parent" : "",
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          {note.studentId && (
            <button
              type="button"
              onClick={() => sendNote(note.id)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-muted-line/40 bg-white text-muted transition hover:border-indigo/40 hover:text-indigo"
              aria-label="Send this note to the parent"
            >
              <MessageCircle className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => void deleteNote(note.id)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-muted-line/40 bg-white text-muted transition hover:border-red-300 hover:text-red-600"
            aria-label="Delete this note"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </li>
    );
  };

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-end gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
              Date
            </span>
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value || todayIso())}
              className={`${inputClass} w-auto`}
            />
          </label>
          <button
            type="button"
            onClick={() => setDate(todayIso())}
            className={`${secondaryBtnClass} h-[38px]`}
          >
            Today
          </button>
        </div>
        <button type="button" onClick={() => setFormOpen(true)} className={primaryBtnClass}>
          <Plus className="h-4 w-4" />
          Add reminder
        </button>
      </div>

      {birthdays.length > 0 && (
        <div className="mt-4 rounded-xl border border-saffron/40 bg-saffron/10 p-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Cake className="h-4 w-4 text-saffron" />
            Birthday today
          </p>
          <ul className="mt-2 space-y-1">
            {birthdays.map((student) => (
              <li key={student.id} className="flex items-center justify-between gap-3">
                <span className="text-sm text-ink">{student.name}</span>
                <button
                  type="button"
                  onClick={() => wishBirthday(student.id)}
                  className={`${secondaryBtnClass} px-3 py-1.5`}
                >
                  <MessageCircle className="h-4 w-4" />
                  Wish
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {overdue.length > 0 && (
        <section className="mt-5">
          <h3 className="text-xs font-bold uppercase tracking-wide text-red-600">
            Still pending ({overdue.length})
          </h3>
          <ul className="mt-2 space-y-2">{overdue.map((note) => renderNote(note.id, true))}</ul>
        </section>
      )}

      <section className="mt-5">
        <h3 className="text-xs font-bold uppercase tracking-wide text-muted">
          {formatDate(date)}
        </h3>
        {forDate.length === 0 ? (
          <div className="mt-2">
            <EmptyState
              icon={<NotebookPen className="h-6 w-6" />}
              title="Nothing noted for this day"
              message="Add a reminder for a student or for yourself — it shows up on the Today screen when the date arrives."
              action={
                <button type="button" onClick={() => setFormOpen(true)} className={primaryBtnClass}>
                  <Plus className="h-4 w-4" />
                  Add reminder
                </button>
              }
            />
          </div>
        ) : (
          <ul className="mt-2 space-y-2">{forDate.map((note) => renderNote(note.id, false))}</ul>
        )}
      </section>

      <NoteForm
        open={formOpen}
        defaultDate={date}
        onClose={() => setFormOpen(false)}
        onCreate={createNote}
      />

      <SendQueue
        open={Boolean(queue)}
        title="Send to the parent"
        messages={queue ?? []}
        onClose={() => setQueue(null)}
        onSent={(ids) => {
          if (sentFor && ids.length > 0) void markNoteSent(sentFor);
          setSentFor("");
        }}
      />
    </div>
  );
}

function NoteForm({
  open,
  defaultDate,
  onClose,
  onCreate,
}: {
  open: boolean;
  defaultDate: string;
  onClose: () => void;
  onCreate: (input: {
    studentId: string;
    date: string;
    text: string;
    done: boolean;
    notifyParent: boolean;
  }) => Promise<void>;
}) {
  const { students } = useTuition();
  const [studentId, setStudentId] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [text, setText] = useState("");
  const [notifyParent, setNotifyParent] = useState(false);
  const [saving, setSaving] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!text.trim()) return;
    setSaving(true);
    try {
      await onCreate({
        studentId,
        date: date || defaultDate,
        text: text.trim(),
        done: false,
        notifyParent,
      });
      setText("");
      setNotifyParent(false);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Add a reminder">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Reminder" required>
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={2}
            placeholder="e.g. Ask for the pending assignment"
            className={inputClass}
            autoFocus
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="For student (optional)">
            <select
              value={studentId}
              onChange={(event) => setStudentId(event.target.value)}
              className={inputClass}
            >
              <option value="">General reminder</option>
              {students
                .filter((s) => s.status === "active")
                .map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.name}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Remind me on">
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className={inputClass}
            />
          </Field>
        </div>
        {studentId && (
          <label className="flex items-center gap-2 text-sm text-muted">
            <input
              type="checkbox"
              checked={notifyParent}
              onChange={(event) => setNotifyParent(event.target.checked)}
              className="h-4 w-4 rounded border-muted-line/40 text-indigo focus:ring-indigo"
            />
            This is meant for the parent
          </label>
        )}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className={secondaryBtnClass}>
            Cancel
          </button>
          <button type="submit" disabled={saving} className={primaryBtnClass}>
            {saving ? "Saving…" : "Add reminder"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

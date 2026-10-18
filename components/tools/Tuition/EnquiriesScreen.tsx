"use client";

// Admission enquiries. Every coaching class loses students here: a parent
// calls, nobody writes it down, nobody follows up. This is a small pipeline
// with a follow-up date and a one-tap WhatsApp.

import { useI18n } from "@/lib/i18n";
import { fill, type TKey } from "@/lib/i18n/translate";
import { useMemo, useState } from "react";
import { MessageCircle, Phone, Plus, Trash2, UserPlus } from "lucide-react";
import { useTuition, type EnquiryInput } from "@/lib/tuition/store";
import { whatsAppLink } from "@/lib/tuition/messages";
import {
  enquiryLabel,
  formatDate,
  todayIso,
  type Enquiry,
  type EnquiryStatus,
} from "@/lib/tuition/types";
import {
  EmptyState,
  Field,
  inputClass,
  Modal,
  primaryBtnClass,
  secondaryBtnClass,
} from "@/components/tools/FreePos/ui";

const STATUS_TONES: Record<EnquiryStatus, string> = {
  new: "bg-indigo/10 text-indigo",
  followup: "bg-saffron/15 text-ink",
  demo: "bg-cream-paper text-muted",
  joined: "bg-emerald-50 text-emerald-700",
  lost: "bg-red-50 text-red-600",
};

const SOURCE_KEYS: TKey[] = [
  "tuEnSrcWalkIn",
  "tuEnSrcPhone",
  "tuEnSrcReference",
  "tuEnSrcOnline",
  "tuEnSrcPoster",
];

const STATUS_ORDER: EnquiryStatus[] = ["new", "followup", "demo", "joined", "lost"];

export function EnquiriesScreen() {
  const { t, lang } = useI18n();
  const { enquiries, createEnquiry, updateEnquiry, deleteEnquiry } = useTuition();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Enquiry | null>(null);
  const [filter, setFilter] = useState<EnquiryStatus | "">("");

  const visible = useMemo(
    () => (filter ? enquiries.filter((e) => e.status === filter) : enquiries),
    [enquiries, filter]
  );

  const dueToday = useMemo(
    () =>
      enquiries.filter(
        (e) =>
          e.followUpDate &&
          e.followUpDate <= todayIso() &&
          e.status !== "joined" &&
          e.status !== "lost"
      ),
    [enquiries]
  );

  const openEdit = (enquiry: Enquiry) => {
    setEditing(enquiry);
    setFormOpen(true);
  };

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setFilter("")}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${
              filter === "" ? "bg-indigo text-white" : "bg-white text-muted hover:text-indigo"
            }`}
          >
            {fill(t("tuEnAllN"), { count: enquiries.length })}
          </button>
          {STATUS_ORDER.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setFilter(status)}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                filter === status ? "bg-indigo text-white" : "bg-white text-muted hover:text-indigo"
              }`}
            >
              {enquiryLabel(status, lang)}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
          className={primaryBtnClass}
        >
          <Plus className="h-4 w-4" />
          {t("tuEnNewEnquiry")}
        </button>
      </div>

      {dueToday.length > 0 && (
        <p className="mt-4 rounded-xl border border-saffron/40 bg-saffron/10 px-4 py-3 text-sm text-ink">
          {fill(t(dueToday.length === 1 ? "tuEnFollowUpsOne" : "tuEnFollowUpsMany"), {
            count: dueToday.length,
          })}
        </p>
      )}

      {enquiries.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={<UserPlus className="h-6 w-6" />}
            title={t("tuEnNoneTitle")}
            message={t("tuEnNoneBody")}
            action={
              <button
                type="button"
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
                className={primaryBtnClass}
              >
                <Plus className="h-4 w-4" />
                {t("tuEnNewEnquiry")}
              </button>
            }
          />
        </div>
      ) : (
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {visible.map((enquiry) => (
            <li
              key={enquiry.id}
              className="min-w-0 rounded-xl border border-muted-line/30 bg-white p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <button
                  type="button"
                  onClick={() => openEdit(enquiry)}
                  className="min-w-0 flex-1 text-left"
                >
                  <p className="truncate text-sm font-bold text-ink">{enquiry.name}</p>
                  <p className="truncate text-xs text-muted">
                    {[enquiry.classLevel, enquiry.subjects].filter(Boolean).join(" · ") ||
                      t("tuEnNoDetails")}
                  </p>
                  <p className="truncate text-xs text-muted">
                    {enquiry.parentName}
                    {enquiry.followUpDate
                      ? fill(t("tuEnFollowUpOnDate"), {
                          date: formatDate(enquiry.followUpDate, lang),
                        })
                      : ""}
                  </p>
                </button>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
                    STATUS_TONES[enquiry.status]
                  }`}
                >
                  {enquiryLabel(enquiry.status, lang)}
                </span>
              </div>
              <div className="mt-3 flex items-center gap-2">
                {enquiry.phone && (
                  <>
                    <a
                      href={`tel:${enquiry.phone}`}
                      className={`${secondaryBtnClass} px-3 py-1.5`}
                      aria-label={fill(t("tuEnCallNamed"), { name: enquiry.name })}
                    >
                      <Phone className="h-4 w-4" />
                      {t("tuEnCall")}
                    </a>
                    <a
                      href={whatsAppLink(enquiry.phone, "")}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`${secondaryBtnClass} px-3 py-1.5`}
                      aria-label={fill(t("tuEnWhatsAppNamed"), { name: enquiry.name })}
                    >
                      <MessageCircle className="h-4 w-4" />
                    </a>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => void deleteEnquiry(enquiry.id)}
                  className={`${secondaryBtnClass} ml-auto px-3 py-1.5`}
                  aria-label={fill(t("tuEnDeleteNamed"), { name: enquiry.name })}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <EnquiryForm
        open={formOpen}
        enquiry={editing}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        onCreate={createEnquiry}
        onUpdate={updateEnquiry}
      />
    </div>
  );
}

const EMPTY: EnquiryInput = {
  name: "",
  parentName: "",
  phone: "",
  classLevel: "",
  subjects: "",
  source: "",
  status: "new",
  followUpDate: "",
  note: "",
};

function EnquiryForm({
  open,
  enquiry,
  onClose,
  onCreate,
  onUpdate,
}: {
  open: boolean;
  enquiry: Enquiry | null;
  onClose: () => void;
  onCreate: (input: EnquiryInput) => Promise<void>;
  onUpdate: (id: string, input: EnquiryInput) => Promise<void>;
}) {
  const { t, lang } = useI18n();
  const [form, setForm] = useState<EnquiryInput>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  // Load the record being edited once per open.
  const key = enquiry?.id ?? (open ? "new" : null);
  if (open && key !== loadedFor) {
    setLoadedFor(key);
    if (enquiry) {
      const { id, createdAt, updatedAt, ...rest } = enquiry;
      void id;
      void createdAt;
      void updatedAt;
      setForm(rest);
    } else {
      setForm(EMPTY);
    }
  }
  if (!open && loadedFor !== null) setLoadedFor(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (enquiry) await onUpdate(enquiry.id, form);
      else await onCreate(form);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={t(enquiry ? "tuEnEditEnquiry" : "tuEnNewEnquiry")}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("tuEnStudentName")} required>
            <input
              type="text"
              value={form.name}
              onChange={(event) => setForm((p) => ({ ...p, name: event.target.value }))}
              className={inputClass}
              autoFocus
            />
          </Field>
          <Field label={t("tuEnParentName")}>
            <input
              type="text"
              value={form.parentName}
              onChange={(event) => setForm((p) => ({ ...p, parentName: event.target.value }))}
              className={inputClass}
            />
          </Field>
          <Field label={t("phone")}>
            <input
              type="tel"
              value={form.phone}
              onChange={(event) => setForm((p) => ({ ...p, phone: event.target.value }))}
              className={inputClass}
            />
          </Field>
          <Field label={t("tuEnClass")}>
            <input
              type="text"
              value={form.classLevel}
              onChange={(event) => setForm((p) => ({ ...p, classLevel: event.target.value }))}
              placeholder={t("tuEnClassPh")}
              className={inputClass}
            />
          </Field>
          <Field label={t("tuEnSubjectsWanted")}>
            <input
              type="text"
              value={form.subjects}
              onChange={(event) => setForm((p) => ({ ...p, subjects: event.target.value }))}
              placeholder={t("tuEnSubjectsPh")}
              className={inputClass}
            />
          </Field>
          <Field label={t("tuEnHowHeard")}>
            <select
              value={form.source}
              onChange={(event) => setForm((p) => ({ ...p, source: event.target.value }))}
              className={inputClass}
            >
              {SOURCE_KEYS.map((key) => (
                <option key={key} value={t(key)}>
                  {t(key)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("tkHiColStatus")}>
            <select
              value={form.status}
              onChange={(event) =>
                setForm((p) => ({ ...p, status: event.target.value as EnquiryStatus }))
              }
              className={inputClass}
            >
              {STATUS_ORDER.map((status) => (
                <option key={status} value={status}>
                  {enquiryLabel(status, lang)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("tuEnFollowUpOn")}>
            <input
              type="date"
              value={form.followUpDate}
              onChange={(event) => setForm((p) => ({ ...p, followUpDate: event.target.value }))}
              className={inputClass}
            />
          </Field>
        </div>
        <Field label={t("note")}>
          <textarea
            value={form.note}
            onChange={(event) => setForm((p) => ({ ...p, note: event.target.value }))}
            rows={2}
            className={inputClass}
          />
        </Field>
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className={secondaryBtnClass}>
            {t("cancel")}
          </button>
          <button type="submit" disabled={saving} className={primaryBtnClass}>
            {saving ? t("clPfSaving") : t(enquiry ? "saveChanges" : "tuEnAddEnquiry")}
          </button>
        </div>
      </form>
    </Modal>
  );
}

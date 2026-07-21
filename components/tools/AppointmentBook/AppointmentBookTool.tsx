"use client";

import { useMemo, useState } from "react";
import {
  Card,
  ConfirmDialog,
  EmptyState,
  Field,
  NumberInput,
  PrimaryButton,
  SecondaryButton,
  Select,
  TextInput,
} from "@/components/toolkit/ui";
import { WorkspaceBanner } from "@/components/toolkit/WorkspaceBanner";
import { useWorkspaceConnection } from "@/lib/hooks/useWorkspaceConnection";
import { useEntityList } from "@/lib/hooks/useEntityList";
import type { Appointment, AppointmentStatus } from "@/lib/toolkit/types";
import { generateId, nowIso, type Business } from "@/lib/pos/types";
import { dbPut } from "@/lib/pos/db";
import { toCsv, downloadCsv } from "@/lib/pos/csv";
import { ShareDialog } from "@/components/toolkit/ShareDialog";
import { businessToShare, type SharedDoc } from "@/lib/toolkit/shareLink";
import { useI18n } from "@/lib/i18n";

const todayIso = () => new Date().toISOString().split("T")[0];

const STATUS_STYLES: Record<AppointmentStatus, string> = {
  scheduled: "bg-indigo/10 text-indigo",
  completed: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-gray-200 text-gray-600",
  "no-show": "bg-red-100 text-red-600",
};

export function AppointmentBookTool() {
  const workspace = useWorkspaceConnection("appointment-book");
  const { t } = useI18n();
  const { items: appointments, save, remove } = useEntityList<Appointment>("appointments");

  const [customerId, setCustomerId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [service, setService] = useState("");
  const [date, setDate] = useState(todayIso());
  const [time, setTime] = useState("10:00");
  const [duration, setDuration] = useState("30");
  const [notes, setNotes] = useState("");

  const [viewDate, setViewDate] = useState(todayIso());
  const [deleting, setDeleting] = useState<Appointment | null>(null);
  const [sharing, setSharing] = useState<SharedDoc | null>(null);
  const currency = workspace.business?.currency ?? "INR";

  const shareAppointment = (a: Appointment) => {
    setSharing({
      t: "apt",
      b: businessToShare(workspace.business, currency),
      cn: a.customerName,
      cp: a.phone || undefined,
      svc: a.service,
      dt: a.date,
      tm: a.time,
      dur: a.durationMins || undefined,
      note: a.notes || undefined,
    });
  };

  const saveUpiDefault = async (upiId: string) => {
    if (!workspace.business) return;
    await dbPut<Business>("business", { ...workspace.business, upiId });
    await workspace.reload();
  };

  const pickCustomer = (id: string) => {
    setCustomerId(id);
    const c = workspace.customers.find((x) => x.id === id);
    if (c) {
      setCustomerName(c.name);
      setPhone(c.phone);
    }
  };

  const canAdd = customerName.trim() && service.trim() && date && time;

  const submit = async () => {
    if (!canAdd) return;
    await save({
      id: generateId(),
      customerId: customerId || null,
      customerName: customerName.trim(),
      phone: phone.trim(),
      service: service.trim(),
      date,
      time,
      durationMins: Number(duration) || 30,
      status: "scheduled",
      notes: notes.trim(),
      createdByTool: "appointment-book",
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    setCustomerId("");
    setCustomerName("");
    setPhone("");
    setService("");
    setNotes("");
  };

  const setStatus = async (a: Appointment, status: AppointmentStatus) => {
    await save({ ...a, status, updatedAt: nowIso() });
  };

  const dayAppointments = useMemo(
    () =>
      appointments
        .filter((a) => a.date === viewDate)
        .sort((a, b) => a.time.localeCompare(b.time)),
    [appointments, viewDate]
  );

  const upcoming = useMemo(
    () =>
      appointments.filter((a) => a.status === "scheduled" && a.date >= todayIso()).length,
    [appointments]
  );

  const exportCsv = () =>
    downloadCsv(
      "appointments.csv",
      toCsv(
        ["Date", "Time", "Customer", "Phone", "Service", "Duration (mins)", "Status", "Notes"],
        [...appointments]
          .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
          .map((a) => [a.date, a.time, a.customerName, a.phone, a.service, a.durationMins, a.status, a.notes])
      )
    );

  return (
    <div>
      <WorkspaceBanner
        connection={workspace}
        message="Book appointments for the customers you already have — one shared customer book."
      />

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <Card className="h-fit">
          <h2 className="mb-4 text-lg font-bold text-ink">New appointment</h2>
          <div className="space-y-4">
            {workspace.connected && workspace.customers.length > 0 ? (
              <Field label="Pick a saved customer">
                <Select value={customerId} onChange={(e) => pickCustomer(e.target.value)}>
                  <option value="">Type details below…</option>
                  {workspace.customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}
            <Field label="Customer name *">
              <TextInput
                value={customerName}
                onChange={(e) => {
                  setCustomerName(e.target.value);
                  setCustomerId("");
                }}
                placeholder="Customer name"
              />
            </Field>
            <Field label={t("phone")}>
              <TextInput value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="98765 43210" />
            </Field>
            <Field label={`${t("service")} *`}>
              <TextInput
                value={service}
                onChange={(e) => setService(e.target.value)}
                placeholder="e.g. Haircut, Consultation, Repair"
              />
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <Field label={t("date")}>
                  <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </Field>
              </div>
              <Field label="Time">
                <TextInput type="time" value={time} onChange={(e) => setTime(e.target.value)} />
              </Field>
            </div>
            <Field label={t("durationMins")}>
              <NumberInput min={5} step={5} value={duration} onChange={(e) => setDuration(e.target.value)} />
            </Field>
            <Field label={t("notes")}>
              <TextInput value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
            </Field>
            <PrimaryButton className="w-full" onClick={submit} disabled={!canAdd}>
              Book appointment
            </PrimaryButton>
          </div>
        </Card>

        <Card className="h-fit">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <TextInput
                type="date"
                value={viewDate}
                onChange={(e) => setViewDate(e.target.value)}
                className="w-auto"
              />
              <p className="text-sm text-muted">
                <span className="font-bold text-ink">{upcoming}</span> upcoming
              </p>
            </div>
            <SecondaryButton onClick={exportCsv} disabled={appointments.length === 0}>
              {t("exportCsv")}
            </SecondaryButton>
          </div>

          {dayAppointments.length === 0 ? (
            <EmptyState
              title="No appointments on this day"
              subtitle="Booked appointments appear here in time order. Use the date picker to move between days."
            />
          ) : (
            <div className="space-y-3">
              {dayAppointments.map((a) => (
                <div key={a.id} className="rounded-lg border border-muted-line/30 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-ink">
                        {a.time} — {a.customerName}
                      </p>
                      <p className="text-sm text-muted">
                        {a.service} · {a.durationMins} min
                        {a.phone ? ` · ${a.phone}` : ""}
                      </p>
                      {a.notes ? <p className="mt-1 text-xs text-muted">{a.notes}</p> : null}
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLES[a.status]}`}
                    >
                      {a.status}
                    </span>
                  </div>
                  {a.status === "scheduled" ? (
                    <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                      <button
                        type="button"
                        className="rounded-md bg-emerald-100 px-3 py-1.5 text-emerald-700 hover:bg-emerald-200"
                        onClick={() => setStatus(a, "completed")}
                      >
                        {t("markCompleted")}
                      </button>
                      <button
                        type="button"
                        className="rounded-md bg-red-100 px-3 py-1.5 text-red-600 hover:bg-red-200"
                        onClick={() => setStatus(a, "no-show")}
                      >
                        No-show
                      </button>
                      <button
                        type="button"
                        className="rounded-md bg-gray-100 px-3 py-1.5 text-gray-600 hover:bg-gray-200"
                        onClick={() => setStatus(a, "cancelled")}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="rounded-md bg-indigo/10 px-3 py-1.5 text-indigo hover:bg-indigo/20"
                        onClick={() => shareAppointment(a)}
                      >
                        Share
                      </button>
                    </div>
                  ) : (
                    <div className="mt-3 flex gap-2 text-xs font-semibold">
                      <button
                        type="button"
                        className="text-indigo"
                        onClick={() => setStatus(a, "scheduled")}
                      >
                        {t("reopen")}
                      </button>
                      <button type="button" className="text-indigo" onClick={() => shareAppointment(a)}>
                        Share
                      </button>
                      <button type="button" className="text-red-500" onClick={() => setDeleting(a)}>
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <ConfirmDialog
        open={deleting !== null}
        title="Delete appointment?"
        message={
          deleting
            ? `Delete ${deleting.customerName}'s ${deleting.service} appointment on ${deleting.date} at ${deleting.time}?`
            : ""
        }
        confirmLabel="Delete"
        onConfirm={async () => {
          if (deleting) await remove(deleting.id);
          setDeleting(null);
        }}
        onCancel={() => setDeleting(null)}
      />

      <ShareDialog
        open={sharing !== null}
        onClose={() => setSharing(null)}
        doc={sharing}
        title="Share appointment"
        allowFee
        onSaveUpiDefault={saveUpiDefault}
      />
    </div>
  );
}

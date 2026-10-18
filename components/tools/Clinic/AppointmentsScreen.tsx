"use client";

import { useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  Move,
  Plus,
  Share2,
  X,
} from "lucide-react";
import { useClinic } from "@/lib/clinic/store";
import {
  buildSlots,
  formatAgeSex,
  isClinicClosed,
  isWithinBreak,
  timeToMinutes,
} from "@/lib/clinic/calc";
import { fillTemplate, whatsAppLink, type OutboundMessage } from "@/lib/clinic/messages";
import { ShareDialog } from "@/components/toolkit/ShareDialog";
import { appointmentDoc } from "./share";
import type { SharedDoc } from "@/lib/toolkit/shareLink";
import {
  statusLabel,
  addDays,
  formatDate,
  formatDayMonth,
  formatTime,
  todayIso,
  type Appointment,
  type Patient,
} from "@/lib/clinic/types";
import {
  Modal,
  dangerBtnClass,
  inputClass,
  primaryBtnClass,
  secondaryBtnClass,
} from "@/components/tools/FreePos/ui";
import { SendQueue } from "@/components/tools/Tuition/SendQueue";
import type { NavigateFn } from "./nav";
import { PatientPicker } from "./PatientPicker";
import { useI18n } from "@/lib/i18n";
import { fill, translate, type TKey } from "@/lib/i18n/translate";

type View = "day" | "week";

const VIEW_LABELS: Record<View, TKey> = { day: "clApViewDay", week: "clApViewWeek" };

export function AppointmentsScreen({ onNavigate }: { onNavigate: NavigateFn }) {
  const { t, lang } = useI18n();
  const {
    appointments,
    patients,
    doctors,
    business,
    settings,
    activeDoctor,
    bookAppointment,
    rescheduleAppointment,
    cancelAppointment,
    markReminded,
  } = useClinic();

  const [date, setDate] = useState(todayIso());
  const [view, setView] = useState<View>("day");
  const [booking, setBooking] = useState<{ time: string; doctorId: string } | null>(null);
  const [moving, setMoving] = useState<Appointment | null>(null);
  const [cancelling, setCancelling] = useState<Appointment | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [queueOpen, setQueueOpen] = useState(false);
  const [sharing, setSharing] = useState<SharedDoc | null>(null);

  const activeDoctors = useMemo(() => doctors.filter((d) => d.active), [doctors]);
  const columns = activeDoctors.length > 0 ? activeDoctors : doctors.slice(0, 1);

  const slots = useMemo(
    () => buildSlots(settings.openTime, settings.closeTime, settings.slotMinutes),
    [settings.openTime, settings.closeTime, settings.slotMinutes]
  );

  const closed = isClinicClosed(date, settings.weeklyOffDays, settings.holidays);
  const patientOf = (id: string) => patients.find((p) => p.id === id) ?? null;

  const forDate = useMemo(
    () =>
      appointments.filter(
        (a) => a.date === date && a.status !== "cancelled" && a.status !== "no-show"
      ),
    [appointments, date]
  );

  /** Everything booked in a slot — double booking is allowed, only warned about. */
  const inSlot = (time: string, doctorId: string) =>
    forDate.filter((a) => a.doctorId === doctorId && a.startTime === time);

  const tomorrow = addDays(todayIso(), 1);
  const tomorrowsUnreminded = useMemo(
    () =>
      appointments.filter(
        (a) => a.date === tomorrow && a.status === "booked" && !a.remindedAt
      ),
    [appointments, tomorrow]
  );

  const reminderMessages: OutboundMessage[] = tomorrowsUnreminded.map((appointment) => {
    const patient = patientOf(appointment.patientId);
    return {
      id: appointment.id,
      name: patient?.name ?? translate(lang, "clDocPatient"),
      phone: patient?.phone ?? "",
      message: fillTemplate(settings.messageTemplates.appointmentReminder, {
        patientName: patient?.name ?? "",
        patientCode: patient?.code ?? "",
        doctorName: doctors.find((d) => d.id === appointment.doctorId)?.name ?? "",
        clinicName: business?.name ?? "",
        clinicPhone: business?.phone ?? "",
        date: formatDate(appointment.date, lang),
        time: formatTime(appointment.startTime, lang),
      }),
    };
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setDate(addDays(date, view === "week" ? -7 : -1))}
            aria-label={t("appPrevious")}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-muted-line/40 bg-white text-muted transition hover:text-indigo"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value || todayIso())}
            className={`${inputClass} w-auto`}
          />
          <button
            type="button"
            onClick={() => setDate(addDays(date, view === "week" ? 7 : 1))}
            aria-label={t("appNext")}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-muted-line/40 bg-white text-muted transition hover:text-indigo"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setDate(todayIso())}
            className={secondaryBtnClass}
          >
            {t("today")}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="hidden gap-1 sm:flex">
            {(["day", "week"] as View[]).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setView(option)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  view === option
                    ? "bg-indigo text-white"
                    : "border border-muted-line/40 bg-white text-muted hover:text-indigo"
                }`}
              >
                {t(VIEW_LABELS[option])}
              </button>
            ))}
          </div>
          {tomorrowsUnreminded.length > 0 && (
            <button type="button" onClick={() => setQueueOpen(true)} className={secondaryBtnClass}>
              <MessageCircle className="h-4 w-4" />
              {fill(t("clApRemindersCount"), { count: tomorrowsUnreminded.length })}
            </button>
          )}
          <button
            type="button"
            onClick={() => setBooking({ time: settings.openTime, doctorId: columns[0]?.id ?? "" })}
            className={primaryBtnClass}
          >
            <Plus className="h-4 w-4" />
            {t("clApBook")}
          </button>
        </div>
      </div>

      {closed && (
        <p className="rounded-lg border border-saffron/40 bg-saffron/10 px-3 py-2 text-sm font-semibold text-ink">
          {fill(t("clApClosedNote"), { date: formatDate(date, lang) })}
        </p>
      )}

      {view === "week" ? (
        <WeekView
          startDate={date}
          appointments={appointments}
          patients={patients}
          settings={settings}
          onPickDay={(day) => {
            setDate(day);
            setView("day");
          }}
        />
      ) : slots.length === 0 ? (
        <p className="text-sm text-muted">{t("clApSetHours")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[32rem] border-collapse">
            <thead>
              <tr>
                <th className="w-20 border-b border-muted-line/30 px-2 py-2 text-left text-xs font-semibold uppercase text-muted">
                  {t("clApTime")}
                </th>
                {columns.map((doctor) => (
                  <th
                    key={doctor.id}
                    className="border-b border-muted-line/30 px-2 py-2 text-left text-xs font-semibold uppercase text-muted"
                  >
                    {columns.length > 1 ? doctor.name : t("clNavAppointments")}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {slots.map((slot) => {
                const onBreak = isWithinBreak(slot, settings.breaks);
                return (
                  <tr key={slot}>
                    <td className="border-b border-muted-line/20 px-2 py-1.5 align-top text-xs text-muted">
                      {formatTime(slot, lang)}
                    </td>
                    {columns.map((doctor) => {
                      const booked = inSlot(slot, doctor.id);
                      if (onBreak || closed) {
                        return (
                          <td
                            key={doctor.id}
                            className="border-b border-muted-line/20 bg-[repeating-linear-gradient(45deg,transparent,transparent_5px,rgba(0,0,0,0.045)_5px,rgba(0,0,0,0.045)_10px)] px-2 py-1.5 text-xs text-muted"
                          >
                            {onBreak
                              ? settings.breaks.find(
                                  (b) =>
                                    timeToMinutes(slot) >= timeToMinutes(b.start) &&
                                    timeToMinutes(slot) < timeToMinutes(b.end)
                                )?.label ?? t("clApBreak")
                              : t("clApClosed")}
                          </td>
                        );
                      }
                      return (
                        <td
                          key={doctor.id}
                          className="border-b border-muted-line/20 px-1 py-1 align-top"
                        >
                          {booked.map((appointment) => {
                            const patient = patientOf(appointment.patientId);
                            return (
                              <div
                                key={appointment.id}
                                className="mb-1 rounded-lg border border-indigo/30 bg-indigo/5 px-2 py-1.5"
                              >
                                <div className="flex items-start justify-between gap-1">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      patient && onNavigate("patients", patient.id)
                                    }
                                    className="min-w-0 flex-1 text-left"
                                  >
                                    <span className="block truncate text-xs font-semibold text-ink">
                                      {patient?.name ?? t("clApUnknown")}
                                    </span>
                                    <span className="block truncate text-[11px] text-muted">
                                      {[
                                        patient ? formatAgeSex(patient, lang) : "",
                                        appointment.reason,
                                        statusLabel(appointment.status, lang),
                                      ]
                                        .filter(Boolean)
                                        .join(" · ")}
                                    </span>
                                  </button>
                                  <div className="flex shrink-0 gap-0.5">
                                    {patient ? (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setSharing(
                                            appointmentDoc(
                                              business,
                                              patient,
                                              appointment,
                                              doctors.find((d) => d.id === appointment.doctorId) ??
                                                null,
                                              lang
                                            )
                                          )
                                        }
                                        aria-label={t("clApShareAppointment")}
                                        title={t("clApShareAppointment")}
                                        className="flex h-6 w-6 items-center justify-center rounded text-muted hover:text-indigo"
                                      >
                                        <Share2 className="h-3.5 w-3.5" />
                                      </button>
                                    ) : null}
                                    <button
                                      type="button"
                                      onClick={() => setMoving(appointment)}
                                      aria-label={t("clApMove")}
                                      title={t("clApMove")}
                                      className="flex h-6 w-6 items-center justify-center rounded text-muted hover:text-indigo"
                                    >
                                      <Move className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setCancelling(appointment);
                                        setCancelReason("");
                                      }}
                                      aria-label={t("cancel")}
                                      title={t("cancel")}
                                      className="flex h-6 w-6 items-center justify-center rounded text-muted hover:text-red-600"
                                    >
                                      <X className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                          <button
                            type="button"
                            onClick={() => setBooking({ time: slot, doctorId: doctor.id })}
                            className="w-full rounded-lg border border-dashed border-muted-line/40 px-2 py-1 text-left text-[11px] text-muted transition hover:border-indigo/40 hover:text-indigo"
                          >
                            {t(booked.length > 0 ? "clApDoubleBook" : "clApBookSlot")}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <BookingModal
        open={Boolean(booking)}
        date={date}
        time={booking?.time ?? settings.openTime}
        doctorId={booking?.doctorId ?? activeDoctor?.id ?? ""}
        existingCount={
          booking ? inSlot(booking.time, booking.doctorId).length : 0
        }
        onClose={() => setBooking(null)}
        onBook={async (patient, reason, duration, time, doctorId) => {
          const created = await bookAppointment({
            patientId: patient.id,
            doctorId,
            date,
            startTime: time,
            durationMinutes: duration,
            reason,
          });
          setBooking(null);
          // Offer the confirmation message straight away — the desk has the
          // patient in front of them at exactly this moment.
          const message = fillTemplate(settings.messageTemplates.appointmentConfirmed, {
            patientName: patient.name,
            patientCode: patient.code,
            doctorName: doctors.find((d) => d.id === doctorId)?.name ?? "",
            clinicName: business?.name ?? "",
            clinicPhone: business?.phone ?? "",
            date: formatDate(date, lang),
            time: formatTime(time, lang),
          });
          if (patient.phone && window.confirm(t("clApSendWhatsApp"))) {
            window.open(whatsAppLink(patient.phone, message), "_blank", "noopener");
            await markReminded([created.id]);
          }
        }}
      />

      <ShareDialog
        open={Boolean(sharing)}
        onClose={() => setSharing(null)}
        doc={sharing}
        title={t("clApShareAppointment")}
        recipientLabel={t("sdRecipientPatient")}
        allowFee
      />

      <Modal open={Boolean(moving)} onClose={() => setMoving(null)} title={t("clApMoveAppointment")}>
        {moving && (
          <MoveForm
            appointment={moving}
            slots={slots}
            onCancel={() => setMoving(null)}
            onMove={async (newDate, newTime) => {
              await rescheduleAppointment(moving.id, newDate, newTime);
              setMoving(null);
            }}
          />
        )}
      </Modal>

      <Modal
        open={Boolean(cancelling)}
        onClose={() => setCancelling(null)}
        title={t("clTdCancelTitle")}
      >
        <p className="text-sm text-muted">{t("clTdCancelBlurbAppt")}</p>
        <label className="mt-4 block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
            {t("clTdReason")}
          </span>
          <input
            type="text"
            value={cancelReason}
            onChange={(event) => setCancelReason(event.target.value)}
            placeholder={t("clTdReasonPh")}
            className={inputClass}
            autoFocus
          />
        </label>
        <div className="mt-5 flex justify-end gap-3">
          <button type="button" onClick={() => setCancelling(null)} className={secondaryBtnClass}>
            {t("clTdKeepIt")}
          </button>
          <button
            type="button"
            onClick={async () => {
              if (cancelling) await cancelAppointment(cancelling.id, cancelReason.trim());
              setCancelling(null);
            }}
            className={dangerBtnClass}
          >
            {t("clTdCancelAppointment")}
          </button>
        </div>
      </Modal>

      <SendQueue
        open={queueOpen}
        title={t("clApRemindersTitle")}
        messages={reminderMessages}
        onClose={() => setQueueOpen(false)}
        onSent={(ids) => {
          markReminded(ids);
          setQueueOpen(false);
        }}
      />
    </div>
  );
}

function BookingModal({
  open,
  date,
  time,
  doctorId,
  existingCount,
  onClose,
  onBook,
}: {
  open: boolean;
  date: string;
  time: string;
  doctorId: string;
  existingCount: number;
  onClose: () => void;
  onBook: (
    patient: Patient,
    reason: string,
    duration: number,
    time: string,
    doctorId: string
  ) => Promise<void>;
}) {
  const { t, lang } = useI18n();
  const { settings, doctors } = useClinic();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [reason, setReason] = useState("");
  const [duration, setDuration] = useState<number>(settings.slotMinutes);
  const [startTime, setStartTime] = useState(time);
  const [doctor, setDoctor] = useState(doctorId);
  const [saving, setSaving] = useState(false);

  // The modal is remounted on each open by keying on the slot it was opened
  // from, so local state starts clean without an effect.
  const key = `${date}-${time}-${doctorId}-${open}`;
  const [lastKey, setLastKey] = useState(key);
  if (key !== lastKey) {
    setLastKey(key);
    setPatient(null);
    setReason("");
    setDuration(settings.slotMinutes);
    setStartTime(time);
    setDoctor(doctorId);
  }

  const activeDoctors = doctors.filter((d) => d.active);

  return (
    <Modal open={open} onClose={onClose} title={t("clApBookTitle")} wide>
      {existingCount > 0 && (
        <p className="mb-3 rounded-lg border border-saffron/40 bg-saffron/10 px-3 py-2 text-sm text-ink">
          {fill(t(existingCount === 1 ? "clApAlreadyBookedOne" : "clApAlreadyBookedMany"), {
            count: existingCount,
            time: formatTime(time, lang),
          })}
        </p>
      )}

      {!patient ? (
        <PatientPicker label={t("clDocPatient")} autoFocus onPick={setPatient} />
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 rounded-lg bg-cream/60 px-3 py-2">
            <span className="text-sm font-semibold text-ink">
              {patient.name} <span className="font-normal text-muted">· {patient.code}</span>
            </span>
            <button
              type="button"
              onClick={() => setPatient(null)}
              className="text-xs font-semibold text-indigo underline"
            >
              {t("clApChange")}
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
                {t("clApTime")}
              </span>
              <input
                type="time"
                value={startTime}
                onChange={(event) => setStartTime(event.target.value)}
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
                {t("clApDuration")}
              </span>
              <input
                type="number"
                inputMode="numeric"
                min={5}
                step={5}
                value={duration}
                onChange={(event) => setDuration(Number(event.target.value) || settings.slotMinutes)}
                className={inputClass}
              />
            </label>
          </div>

          {activeDoctors.length > 1 && (
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
                {t("clDocDoctor")}
              </span>
              <select
                value={doctor}
                onChange={(event) => setDoctor(event.target.value)}
                className={inputClass}
              >
                {activeDoctors.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
              {t("clTdReason")}
            </span>
            <input
              type="text"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder={t("clApReasonPh")}
              className={inputClass}
            />
          </label>

          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className={secondaryBtnClass}>
              {t("cancel")}
            </button>
            <button
              type="button"
              disabled={saving || !doctor}
              onClick={async () => {
                setSaving(true);
                try {
                  await onBook(patient, reason.trim(), duration, startTime, doctor);
                } finally {
                  setSaving(false);
                }
              }}
              className={primaryBtnClass}
            >
              {saving
                ? t("clApBooking")
                : fill(t("clApBookFor"), { date: formatDate(date, lang) })}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function MoveForm({
  appointment,
  slots,
  onCancel,
  onMove,
}: {
  appointment: Appointment;
  slots: string[];
  onCancel: () => void;
  onMove: (date: string, time: string) => Promise<void>;
}) {
  const { t, lang } = useI18n();
  const [date, setDate] = useState(appointment.date);
  const [time, setTime] = useState(appointment.startTime);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
            {t("clApNewDate")}
          </span>
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
            {t("clApNewTime")}
          </span>
          {slots.length > 0 ? (
            <select
              value={time}
              onChange={(event) => setTime(event.target.value)}
              className={inputClass}
            >
              {slots.map((slot) => (
                <option key={slot} value={slot}>
                  {formatTime(slot, lang)}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="time"
              value={time}
              onChange={(event) => setTime(event.target.value)}
              className={inputClass}
            />
          )}
        </label>
      </div>
      <div className="flex justify-end gap-3">
        <button type="button" onClick={onCancel} className={secondaryBtnClass}>
          {t("cancel")}
        </button>
        <button type="button" onClick={() => onMove(date, time)} className={primaryBtnClass}>
          {t("clApMoveAppointment")}
        </button>
      </div>
    </div>
  );
}

/** Seven compressed columns — a glance at how full the week is. */
function WeekView({
  startDate,
  appointments,
  patients,
  settings,
  onPickDay,
}: {
  startDate: string;
  appointments: Appointment[];
  patients: Patient[];
  settings: { weeklyOffDays: number[]; holidays: { date: string }[] };
  onPickDay: (date: string) => void;
}) {
  const { t, lang } = useI18n();
  const days = useMemo(() => {
    const [y, m, d] = startDate.split("-").map(Number);
    const base = new Date(y, m - 1, d);
    const monday = new Date(base);
    monday.setDate(base.getDate() - ((base.getDay() + 6) % 7));
    return Array.from({ length: 7 }, (_, index) => {
      const day = new Date(monday);
      day.setDate(monday.getDate() + index);
      const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(
        day.getDate()
      ).padStart(2, "0")}`;
      return key;
    });
  }, [startDate]);

  const patientName = (id: string) =>
    patients.find((p) => p.id === id)?.name ?? t("clApUnknown");

  return (
    <div className="grid gap-2 sm:grid-cols-7">
      {days.map((day) => {
        const rows = appointments
          .filter((a) => a.date === day && a.status !== "cancelled")
          .sort((a, b) => a.startTime.localeCompare(b.startTime));
        const off = isClinicClosed(day, settings.weeklyOffDays, settings.holidays);
        return (
          <button
            key={day}
            type="button"
            onClick={() => onPickDay(day)}
            className={`min-h-[7rem] rounded-xl border p-2 text-left transition hover:border-indigo/40 ${
              off ? "border-muted-line/20 bg-cream/40" : "border-muted-line/30 bg-white"
            }`}
          >
            <p className="text-xs font-semibold text-ink">{formatDayMonth(day, lang)}</p>
            <p className="mb-1 text-[11px] text-muted">
              {off ? t("clApClosed") : fill(t("clApBookedN"), { count: rows.length })}
            </p>
            {rows.slice(0, 4).map((appointment) => (
              <p key={appointment.id} className="truncate text-[11px] text-muted">
                {formatTime(appointment.startTime, lang)} {patientName(appointment.patientId)}
              </p>
            ))}
            {rows.length > 4 && (
              <p className="text-[11px] text-indigo">
                {fill(t("clApMoreN"), { count: rows.length - 4 })}
              </p>
            )}
          </button>
        );
      })}
    </div>
  );
}

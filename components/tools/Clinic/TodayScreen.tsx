"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpCircle,
  CalendarPlus,
  Clock,
  LogIn,
  Play,
  Stethoscope,
  Undo2,
  X,
} from "lucide-react";
import { useClinic } from "@/lib/clinic/store";
import {
  averageWaitMinutes,
  compareQueue,
  elapsedWaitMinutes,
  formatAgeSex,
} from "@/lib/clinic/calc";
import {
  STATUS_LABELS,
  formatTime,
  todayIso,
  type Appointment,
  type AppointmentStatus,
  type Patient,
} from "@/lib/clinic/types";
import { formatCurrency } from "@/lib/format";
import {
  EmptyState,
  Modal,
  StatCard,
  dangerBtnClass,
  inputClass,
  primaryBtnClass,
  secondaryBtnClass,
} from "@/components/tools/FreePos/ui";
import type { NavigateFn } from "./nav";
import { PatientPicker } from "./PatientPicker";

const STATUS_PILL: Record<AppointmentStatus, string> = {
  booked: "bg-cream text-muted",
  waiting: "bg-saffron/20 text-ink",
  "in-consult": "bg-indigo text-white",
  done: "bg-emerald-100 text-emerald-800",
  "no-show": "bg-red-50 text-red-600",
  cancelled: "bg-muted-line/20 text-muted",
};

export function TodayScreen({ onNavigate }: { onNavigate: NavigateFn }) {
  const {
    appointments,
    patients,
    doctors,
    bills,
    activeDoctor,
    business,
    addWalkIn,
    markArrived,
    startConsult,
    togglePriority,
    cancelAppointment,
    reopenAppointment,
  } = useClinic();

  const today = todayIso();
  const [doctorFilter, setDoctorFilter] = useState("");
  const [cancelling, setCancelling] = useState<Appointment | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  // Live wait timers tick once a minute — often enough to be useful, rare
  // enough not to re-render the queue constantly.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const activeDoctors = useMemo(() => doctors.filter((d) => d.active), [doctors]);

  const todaysRows = useMemo(() => {
    const rows = appointments.filter(
      (a) => a.date === today && (!doctorFilter || a.doctorId === doctorFilter)
    );
    return [...rows].sort(compareQueue);
  }, [appointments, today, doctorFilter]);

  const seen = todaysRows.filter((a) => a.status === "done").length;
  const waiting = todaysRows.filter((a) => a.status === "waiting").length;
  const expected = todaysRows.filter((a) => a.status === "booked").length;
  const averageWait = averageWaitMinutes(todaysRows);

  const collections = useMemo(
    () =>
      bills
        .filter((bill) => bill.date === today)
        .reduce((sum, bill) => sum + (bill.paid || 0), 0),
    [bills, today]
  );

  const currency = business?.currency ?? "INR";
  const patientOf = (id: string) => patients.find((p) => p.id === id);
  const doctorName = (id: string) => doctors.find((d) => d.id === id)?.name ?? "";

  const handleWalkIn = async (patient: Patient) => {
    if (!activeDoctor) {
      setError("Add a doctor in Settings before adding patients to the queue.");
      return;
    }
    setError("");
    await addWalkIn(patient.id, doctorFilter || activeDoctor.id, "");
  };

  const handleStartConsult = async (appointment: Appointment) => {
    setBusyId(appointment.id);
    setError("");
    try {
      const visit = await startConsult(appointment.id);
      onNavigate("consult", visit.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not open the consultation.");
    } finally {
      setBusyId("");
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Seen today" value={String(seen)} sub={`${expected} still expected`} />
        <StatCard label="Waiting now" value={String(waiting)} />
        <StatCard
          label="Average wait"
          value={averageWait === null ? "—" : `${averageWait} min`}
          sub={averageWait === null ? "No completed consults yet" : undefined}
        />
        <StatCard label="Collected today" value={formatCurrency(collections, currency)} />
      </div>

      <div className="rounded-2xl border border-muted-line/30 bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex-1">
            <PatientPicker
              label="Add a walk-in"
              placeholder="Search by phone, name or file no."
              autoFocus={todaysRows.length === 0}
              onPick={handleWalkIn}
            />
          </div>
          {activeDoctors.length > 1 && (
            <label className="sm:w-56">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
                Doctor
              </span>
              <select
                value={doctorFilter}
                onChange={(event) => setDoctorFilter(event.target.value)}
                className={inputClass}
              >
                <option value="">All doctors</option>
                {activeDoctors.map((doctor) => (
                  <option key={doctor.id} value={doctor.id}>
                    {doctor.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </div>

      {todaysRows.length === 0 ? (
        <EmptyState
          icon={<Stethoscope className="h-6 w-6" />}
          title="No patients yet today"
          message="Search for a patient above to add the first walk-in, or book an appointment."
          action={
            <button
              type="button"
              onClick={() => onNavigate("appointments")}
              className={secondaryBtnClass}
            >
              <CalendarPlus className="h-4 w-4" />
              Open appointments
            </button>
          }
        />
      ) : (
        <ul className="space-y-2">
          {todaysRows.map((appointment) => {
            const patient = patientOf(appointment.patientId);
            const waitingFor = elapsedWaitMinutes(appointment, now);
            const settled =
              appointment.status === "no-show" || appointment.status === "cancelled";
            return (
              <li
                key={appointment.id}
                className={`rounded-xl border bg-white p-3 sm:p-4 ${
                  settled ? "border-muted-line/20 opacity-70" : "border-muted-line/30"
                }`}
              >
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${
                      appointment.priority
                        ? "bg-saffron text-ink"
                        : "bg-cream text-ink"
                    }`}
                    title={appointment.priority ? "Priority" : "Token"}
                  >
                    {appointment.tokenNo ?? "—"}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-semibold text-ink">
                        {patient?.name ?? "Unknown patient"}
                      </span>
                      {patient && (
                        <span className="text-xs text-muted">{formatAgeSex(patient)}</span>
                      )}
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          STATUS_PILL[appointment.status]
                        }`}
                      >
                        {STATUS_LABELS[appointment.status]}
                      </span>
                      {waitingFor !== null && appointment.status === "waiting" && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-saffron">
                          <Clock className="h-3 w-3" />
                          {waitingFor} min
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 truncate text-xs text-muted">
                      {[
                        patient?.code,
                        formatTime(appointment.startTime),
                        activeDoctors.length > 1 ? doctorName(appointment.doctorId) : "",
                        appointment.reason,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {appointment.status === "booked" && (
                      <button
                        type="button"
                        onClick={() => markArrived(appointment.id)}
                        className={secondaryBtnClass}
                      >
                        <LogIn className="h-4 w-4" />
                        Arrived
                      </button>
                    )}
                    {(appointment.status === "waiting" ||
                      appointment.status === "in-consult") && (
                      <button
                        type="button"
                        onClick={() => handleStartConsult(appointment)}
                        disabled={busyId === appointment.id}
                        className={primaryBtnClass}
                      >
                        <Play className="h-4 w-4" />
                        {appointment.status === "in-consult" ? "Resume" : "Start consult"}
                      </button>
                    )}
                    {appointment.status === "done" && (
                      <button
                        type="button"
                        onClick={() => handleStartConsult(appointment)}
                        className={secondaryBtnClass}
                      >
                        Open record
                      </button>
                    )}
                    {settled ? (
                      <button
                        type="button"
                        onClick={() => reopenAppointment(appointment.id)}
                        aria-label="Undo"
                        title="Put back in the queue"
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-muted transition hover:bg-cream hover:text-indigo"
                      >
                        <Undo2 className="h-4 w-4" />
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => togglePriority(appointment.id)}
                          aria-label="Toggle priority"
                          title={appointment.priority ? "Remove priority" : "Mark priority"}
                          className={`flex h-9 w-9 items-center justify-center rounded-lg transition hover:bg-cream ${
                            appointment.priority ? "text-saffron" : "text-muted hover:text-indigo"
                          }`}
                        >
                          <ArrowUpCircle className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setCancelling(appointment);
                            setCancelReason("");
                          }}
                          aria-label="Cancel"
                          title="Cancel"
                          className="flex h-9 w-9 items-center justify-center rounded-lg text-muted transition hover:bg-red-50 hover:text-red-600"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Modal
        open={Boolean(cancelling)}
        onClose={() => setCancelling(null)}
        title="Cancel this appointment?"
      >
        <p className="text-sm text-muted">
          Cancellations show up in the no-show report, so a short reason helps.
        </p>
        <label className="mt-4 block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
            Reason
          </span>
          <input
            type="text"
            value={cancelReason}
            onChange={(event) => setCancelReason(event.target.value)}
            placeholder="e.g. Patient rescheduled"
            className={inputClass}
            autoFocus
          />
        </label>
        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => setCancelling(null)}
            className={secondaryBtnClass}
          >
            Keep it
          </button>
          <button
            type="button"
            onClick={async () => {
              if (cancelling) await cancelAppointment(cancelling.id, cancelReason.trim());
              setCancelling(null);
            }}
            className={dangerBtnClass}
          >
            Cancel appointment
          </button>
        </div>
      </Modal>
    </div>
  );
}

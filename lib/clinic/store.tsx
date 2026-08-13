"use client";

// Client-side store for the Free Clinic Manager.
//
// Everything lives in the shared workspace database (IndexedDB). The clinic's
// profile is the workspace `business` record, so a doctor who already used
// another Setu tool on this device lands straight in the app with their name,
// phone, logo and UPI ID already filled in.
//
// Two rules shape this file:
//
//   1. A consult must never lose work. The visit row is created the moment the
//      consult opens and rewritten on every field blur, so closing the tab
//      mid-consultation leaves a resumable draft rather than nothing.
//   2. Serial numbers are never reused. Patient codes and receipt numbers are
//      allocated by bumping a counter in settings inside the same transaction
//      that writes the record.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { dbBatch, dbClearStores, dbGetAll, type StoreName } from "@/lib/pos/db";
import { generateId, nowIso, type Business, type Customer } from "@/lib/pos/types";
import {
  buildTabPayloads,
  isValidSyncUrl,
  pullFromSheet,
  pushToSheet,
  settingsFromPull,
  testSheetConnection,
  type ClinicSnapshot,
} from "./sheetSync";
import {
  consultationFeeFor,
  findLapsedBookings,
  nextTokenNo,
  withDerivedVitals,
} from "./calc";
import {
  CLINIC_BACKUP_STORES,
  createBackup,
  downloadBackupFile,
  restoreBackup,
  type ClinicBackup,
} from "./backup";
import { buildSeedMedicines, medicineKey } from "./medicines";
import type { ParsedPatientRow } from "./csv";
import {
  DEFAULT_CLINIC_SETTINGS,
  EMPTY_VITALS,
  SYNC_SLICES,
  formatPatientCode,
  formatReceiptNumber,
  phoneKey,
  todayIso,
  type Appointment,
  type Bill,
  type BillLine,
  type ClinicCharge,
  type ClinicSettings,
  type Doctor,
  type Medicine,
  type Patient,
  type Protocol,
  type RxLine,
  type SyncDirtyRow,
  type SyncSlice,
  type Visit,
  type Vitals,
} from "./types";

export type ClinicStatus = "loading" | "welcome" | "setup" | "ready" | "error";

export type DoctorInput = Omit<Doctor, "id" | "createdAt" | "updatedAt">;
export type PatientInput = Omit<
  Patient,
  "id" | "code" | "createdAt" | "updatedAt" | "registeredOn"
> & { registeredOn?: string };
export type ProtocolInput = Omit<Protocol, "id" | "createdAt" | "updatedAt" | "timesUsed">;

export type BookingInput = {
  patientId: string;
  doctorId: string;
  date: string;
  startTime: string;
  durationMinutes: number;
  reason: string;
};

export type BillInput = {
  patientId: string;
  doctorId: string;
  visitId: string | null;
  date: string;
  lines: BillLine[];
  discount: number;
  paid: number;
  paymentMode: string;
};

type ClinicContextValue = {
  status: ClinicStatus;
  errorMessage: string;
  business: Business | null;
  settings: ClinicSettings;
  doctors: Doctor[];
  patients: Patient[];
  appointments: Appointment[];
  visits: Visit[];
  medicines: Medicine[];
  protocols: Protocol[];
  charges: ClinicCharge[];
  bills: Bill[];
  /** Workspace customers, read once so registration can match on phone. */
  workspaceCustomers: Customer[];

  /** The single active doctor in the free tier; the default for every record. */
  activeDoctor: Doctor | null;

  startSetup: () => void;
  backToWelcome: () => void;
  createClinic: (
    profile: Omit<Business, "id" | "createdAt">,
    doctor: DoctorInput
  ) => Promise<void>;
  updateBusiness: (updates: Partial<Omit<Business, "id" | "createdAt">>) => Promise<void>;
  updateSettings: (updates: Partial<Omit<ClinicSettings, "id">>) => Promise<void>;
  acceptDisclaimer: () => Promise<void>;

  createDoctor: (input: DoctorInput) => Promise<Doctor>;
  updateDoctor: (id: string, input: DoctorInput) => Promise<void>;
  deleteDoctor: (id: string) => Promise<void>;

  createPatient: (input: PatientInput) => Promise<Patient>;
  updatePatient: (id: string, input: PatientInput) => Promise<void>;
  deletePatient: (id: string) => Promise<void>;
  importPatients: (rows: ParsedPatientRow[]) => Promise<number>;
  /** Existing patient with this phone, if any — drives "already registered". */
  findPatientByPhone: (phone: string) => Patient | null;
  /** Workspace customer with this phone, so we never ask for a name twice. */
  findCustomerByPhone: (phone: string) => Customer | null;

  bookAppointment: (input: BookingInput) => Promise<Appointment>;
  rescheduleAppointment: (id: string, date: string, startTime: string) => Promise<void>;
  cancelAppointment: (id: string, reason: string) => Promise<void>;
  markArrived: (id: string) => Promise<void>;
  togglePriority: (id: string) => Promise<void>;
  markReminded: (ids: string[]) => Promise<void>;
  reopenAppointment: (id: string) => Promise<void>;
  /** Walk-in: registers nothing, just queues an already-known patient. */
  addWalkIn: (patientId: string, doctorId: string, reason: string) => Promise<Appointment>;

  /** Opens (or resumes) the consult for an appointment and returns the visit. */
  startConsult: (appointmentId: string) => Promise<Visit>;
  /** Consult with no appointment behind it, from a patient chart. */
  startConsultForPatient: (patientId: string, doctorId: string) => Promise<Visit>;
  saveVisit: (id: string, updates: Partial<Visit>) => Promise<void>;
  saveVitals: (id: string, vitals: Vitals) => Promise<void>;
  finaliseVisit: (id: string) => Promise<void>;
  deleteVisit: (id: string) => Promise<void>;

  saveMedicine: (medicine: Medicine) => Promise<void>;
  addMedicine: (input: Omit<Medicine, "id" | "createdAt" | "timesUsed">) => Promise<Medicine>;
  deleteMedicine: (id: string) => Promise<void>;
  seedMedicines: () => Promise<number>;

  saveProtocol: (input: ProtocolInput) => Promise<Protocol>;
  updateProtocol: (id: string, input: ProtocolInput) => Promise<void>;
  deleteProtocol: (id: string) => Promise<void>;
  useProtocol: (id: string) => Promise<Protocol | null>;

  saveCharge: (charge: ClinicCharge) => Promise<void>;
  deleteCharge: (id: string) => Promise<void>;

  createBill: (input: BillInput) => Promise<Bill>;
  updateBill: (id: string, input: BillInput) => Promise<void>;
  recordBillPayment: (id: string, amount: number, mode: string) => Promise<void>;
  deleteBill: (id: string) => Promise<void>;
  /** The consultation fee that applies, with the follow-up rule applied. */
  feeFor: (patientId: string, doctorId: string, date?: string) => {
    amount: number;
    isFollowUp: boolean;
    withinDays: number | null;
  };

  sheetSync: {
    url: string;
    dirtyCount: number;
    syncing: boolean;
    lastSyncAt: string | null;
    lastError: string;
  };
  connectSheet: (url: string) => Promise<void>;
  disconnectSheet: () => Promise<void>;
  syncSheetNow: () => Promise<void>;
  resyncSheetAll: () => Promise<void>;
  restoreFromSheet: (url: string) => Promise<void>;

  exportBackup: () => Promise<void>;
  applyRestoredBackup: (backup: ClinicBackup) => Promise<void>;
  resetAll: () => Promise<void>;
};

const ClinicContext = createContext<ClinicContextValue | null>(null);

const LAST_SYNC_KEY = "clinic_sheet_sync_last";

export function ClinicProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<ClinicStatus>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [business, setBusiness] = useState<Business | null>(null);
  const [settings, setSettings] = useState<ClinicSettings>(DEFAULT_CLINIC_SETTINGS);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [protocols, setProtocols] = useState<Protocol[]>([]);
  const [charges, setCharges] = useState<ClinicCharge[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [workspaceCustomers, setWorkspaceCustomers] = useState<Customer[]>([]);
  const [dirtySlices, setDirtySlices] = useState<SyncSlice[]>([]);
  const [sheetSyncing, setSheetSyncing] = useState(false);
  const [sheetLastSyncAt, setSheetLastSyncAt] = useState<string | null>(null);
  const [sheetLastError, setSheetLastError] = useState("");
  const flushingRef = useRef(false);
  const sweptRef = useRef(false);

  // Latest snapshot for the sync engine (avoids stale closures).
  const snapshotRef = useRef<ClinicSnapshot | null>(null);
  useEffect(() => {
    snapshotRef.current = {
      business,
      settings,
      doctors,
      medicines,
      protocols,
      charges,
      patients,
      appointments,
      visits,
      bills,
    };
  });

  useEffect(() => {
    try {
      setSheetLastSyncAt(localStorage.getItem(LAST_SYNC_KEY));
    } catch {
      // Status display only.
    }
  }, []);

  const markDirtyState = useCallback((slices: SyncSlice[]) => {
    if (slices.length === 0) return;
    setDirtySlices((prev) => Array.from(new Set([...prev, ...slices])));
  }, []);

  /** Run a DB write and flag the given sync slices in the same transaction. */
  const batchWithSync = useCallback(
    async (
      writes: Partial<Record<StoreName, unknown[]>>,
      deletes: Partial<Record<StoreName, string[]>> = {},
      slices: SyncSlice[] = []
    ) => {
      const dirtyRows: SyncDirtyRow[] = slices.map((id) => ({ id, dirtyAt: nowIso() }));
      await dbBatch(slices.length ? { ...writes, sync_queue: dirtyRows } : writes, deletes);
      markDirtyState(slices);
    },
    [markDirtyState]
  );

  const loadAll = useCallback(async () => {
    const [
      businessRows,
      settingsRows,
      doctorRows,
      patientRows,
      appointmentRows,
      visitRows,
      medicineRows,
      protocolRows,
      chargeRows,
      billRows,
      customerRows,
      dirtyRows,
    ] = await Promise.all([
      dbGetAll<Business>("business"),
      dbGetAll<ClinicSettings>("clinic_settings"),
      dbGetAll<Doctor>("clinic_doctors"),
      dbGetAll<Patient>("clinic_patients"),
      dbGetAll<Appointment>("clinic_appointments"),
      dbGetAll<Visit>("clinic_visits"),
      dbGetAll<Medicine>("clinic_medicines"),
      dbGetAll<Protocol>("clinic_protocols"),
      dbGetAll<ClinicCharge>("clinic_charges"),
      dbGetAll<Bill>("clinic_bills"),
      dbGetAll<Customer>("customers"),
      dbGetAll<SyncDirtyRow>("sync_queue"),
    ]);

    const loadedBusiness = businessRows.find((b) => b.id === "main") ?? null;
    setBusiness(loadedBusiness);
    setDoctors(doctorRows.sort((a, b) => a.name.localeCompare(b.name)));
    setPatients(patientRows.sort((a, b) => a.name.localeCompare(b.name)));
    setAppointments(appointmentRows);
    setVisits(visitRows.sort((a, b) => b.date.localeCompare(a.date)));
    setMedicines(medicineRows.sort((a, b) => a.name.localeCompare(b.name)));
    setProtocols(protocolRows.sort((a, b) => b.timesUsed - a.timesUsed));
    setCharges(chargeRows);
    setBills(billRows.sort((a, b) => b.date.localeCompare(a.date)));
    setWorkspaceCustomers(customerRows);
    // Only clinic rows — the POS and tuition keep their own flags in the same store.
    setDirtySlices(dirtyRows.filter((row) => SYNC_SLICES.includes(row.id)).map((row) => row.id));

    // Merge with defaults so records written by older versions gain new fields.
    const stored = settingsRows.find((s) => s.id === "main");
    const loadedSettings: ClinicSettings = stored
      ? {
          ...DEFAULT_CLINIC_SETTINGS,
          ...stored,
          messageTemplates: {
            ...DEFAULT_CLINIC_SETTINGS.messageTemplates,
            ...stored.messageTemplates,
          },
        }
      : DEFAULT_CLINIC_SETTINGS;
    setSettings(loadedSettings);

    return {
      business: loadedBusiness,
      settings: loadedSettings,
      hasSetup: Boolean(stored),
      doctors: doctorRows,
    };
  }, []);

  useEffect(() => {
    let active = true;
    loadAll()
      .then((loaded) => {
        if (!active) return;
        // The clinic is "set up" once it has both a business profile and a
        // doctor — a profile alone may have come from another Setu tool, and
        // a prescription cannot print without a doctor to sign it.
        const ready = Boolean(loaded.hasSetup && loaded.doctors.length > 0);
        setStatus(ready ? "ready" : loaded.business ? "setup" : "welcome");
      })
      .catch((error: unknown) => {
        if (!active) return;
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Could not open local storage. Please use a modern browser outside private mode."
        );
        setStatus("error");
      });
    return () => {
      active = false;
    };
  }, [loadAll]);

  const startSetup = useCallback(() => setStatus("setup"), []);
  const backToWelcome = useCallback(() => setStatus("welcome"), []);

  // ---- Profile & settings --------------------------------------------------

  const persistSettings = useCallback(
    async (next: ClinicSettings) => {
      await batchWithSync({ clinic_settings: [next] }, {}, ["c_meta"]);
      setSettings(next);
    },
    [batchWithSync]
  );

  const updateSettings = useCallback(
    async (updates: Partial<Omit<ClinicSettings, "id">>) => {
      await persistSettings({ ...settings, ...updates, id: "main" });
    },
    [persistSettings, settings]
  );

  const acceptDisclaimer = useCallback(async () => {
    await updateSettings({ disclaimerAcceptedAt: nowIso() });
  }, [updateSettings]);

  const createClinic = useCallback(
    async (profile: Omit<Business, "id" | "createdAt">, doctorInput: DoctorInput) => {
      const newBusiness: Business = { ...profile, id: "main", createdAt: nowIso() };
      const doctor: Doctor = {
        ...doctorInput,
        id: generateId(),
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      const newSettings: ClinicSettings = { ...DEFAULT_CLINIC_SETTINGS };
      await batchWithSync(
        {
          business: [newBusiness],
          clinic_settings: [newSettings],
          clinic_doctors: [doctor],
        },
        {},
        ["c_meta"]
      );
      setBusiness(newBusiness);
      setSettings(newSettings);
      setDoctors([doctor]);
      setStatus("ready");
    },
    [batchWithSync]
  );

  const updateBusiness = useCallback(
    async (updates: Partial<Omit<Business, "id" | "createdAt">>) => {
      if (!business) return;
      const next: Business = { ...business, ...updates };
      await batchWithSync({ business: [next] }, {}, ["c_meta"]);
      setBusiness(next);
    },
    [business, batchWithSync]
  );

  // ---- Doctors -------------------------------------------------------------

  const createDoctor = useCallback(
    async (input: DoctorInput) => {
      const doctor: Doctor = {
        ...input,
        id: generateId(),
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      await batchWithSync({ clinic_doctors: [doctor] }, {}, ["c_meta"]);
      setDoctors((prev) => [...prev, doctor].sort((a, b) => a.name.localeCompare(b.name)));
      return doctor;
    },
    [batchWithSync]
  );

  const updateDoctor = useCallback(
    async (id: string, input: DoctorInput) => {
      const existing = doctors.find((d) => d.id === id);
      if (!existing) return;
      const next: Doctor = { ...existing, ...input, updatedAt: nowIso() };
      await batchWithSync({ clinic_doctors: [next] }, {}, ["c_meta"]);
      setDoctors((prev) =>
        prev.map((d) => (d.id === id ? next : d)).sort((a, b) => a.name.localeCompare(b.name))
      );
    },
    [doctors, batchWithSync]
  );

  const deleteDoctor = useCallback(
    async (id: string) => {
      await batchWithSync({}, { clinic_doctors: [id] }, ["c_meta"]);
      setDoctors((prev) => prev.filter((d) => d.id !== id));
    },
    [batchWithSync]
  );

  const activeDoctor = useMemo(
    () => doctors.find((d) => d.active) ?? doctors[0] ?? null,
    [doctors]
  );

  // ---- Patients ------------------------------------------------------------

  const findPatientByPhone = useCallback(
    (phone: string) => {
      const key = phoneKey(phone);
      if (!key) return null;
      return patients.find((p) => phoneKey(p.phone) === key) ?? null;
    },
    [patients]
  );

  const findCustomerByPhone = useCallback(
    (phone: string) => {
      const key = phoneKey(phone);
      if (!key) return null;
      return workspaceCustomers.find((c) => phoneKey(c.phone) === key) ?? null;
    },
    [workspaceCustomers]
  );

  const createPatient = useCallback(
    async (input: PatientInput) => {
      const serial = settings.nextPatientSerial;
      const patient: Patient = {
        ...input,
        id: generateId(),
        code: formatPatientCode(settings.patientCodePrefix, serial),
        registeredOn: input.registeredOn || todayIso(),
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      // Bumping the serial in the same transaction is what makes codes unique:
      // two tabs registering at once cannot both take 0143.
      const nextSettings: ClinicSettings = { ...settings, nextPatientSerial: serial + 1 };
      await batchWithSync(
        { clinic_patients: [patient], clinic_settings: [nextSettings] },
        {},
        ["c_patients", "c_meta"]
      );
      setPatients((prev) => [...prev, patient].sort((a, b) => a.name.localeCompare(b.name)));
      setSettings(nextSettings);
      return patient;
    },
    [settings, batchWithSync]
  );

  const updatePatient = useCallback(
    async (id: string, input: PatientInput) => {
      const existing = patients.find((p) => p.id === id);
      if (!existing) return;
      const next: Patient = { ...existing, ...input, updatedAt: nowIso() };
      await batchWithSync({ clinic_patients: [next] }, {}, ["c_patients"]);
      setPatients((prev) =>
        prev.map((p) => (p.id === id ? next : p)).sort((a, b) => a.name.localeCompare(b.name))
      );
    },
    [patients, batchWithSync]
  );

  /** Removing a patient takes their visits, appointments and bills with them. */
  const deletePatient = useCallback(
    async (id: string) => {
      const visitIds = visits.filter((v) => v.patientId === id).map((v) => v.id);
      const appointmentIds = appointments.filter((a) => a.patientId === id).map((a) => a.id);
      const billIds = bills.filter((b) => b.patientId === id).map((b) => b.id);
      await batchWithSync(
        {},
        {
          clinic_patients: [id],
          clinic_visits: visitIds,
          clinic_appointments: appointmentIds,
          clinic_bills: billIds,
        },
        ["c_patients", "c_visits", "c_appointments", "c_bills"]
      );
      setPatients((prev) => prev.filter((p) => p.id !== id));
      setVisits((prev) => prev.filter((v) => v.patientId !== id));
      setAppointments((prev) => prev.filter((a) => a.patientId !== id));
      setBills((prev) => prev.filter((b) => b.patientId !== id));
    },
    [visits, appointments, bills, batchWithSync]
  );

  const importPatients = useCallback(
    async (rows: ParsedPatientRow[]) => {
      if (rows.length === 0) return 0;
      let serial = settings.nextPatientSerial;
      const created: Patient[] = rows.map((row) => {
        const code = formatPatientCode(settings.patientCodePrefix, serial);
        serial += 1;
        const customer = findCustomerByPhone(row.phone);
        return {
          id: generateId(),
          code,
          name: row.name,
          dob: row.dob || null,
          ageYearsAtRegistration: row.dob ? null : row.ageYears,
          registeredOn: todayIso(),
          sex: row.sex || "other",
          phone: row.phone,
          altPhone: row.altPhone,
          address: row.address,
          bloodGroup: row.bloodGroup,
          allergies: row.allergies,
          chronicConditions: row.chronicConditions,
          familyId: null,
          photoDataUrl: "",
          customFields: [],
          notes: row.notes,
          customerId: customer?.id ?? null,
          createdAt: nowIso(),
          updatedAt: nowIso(),
        };
      });
      const nextSettings: ClinicSettings = { ...settings, nextPatientSerial: serial };
      await batchWithSync(
        { clinic_patients: created, clinic_settings: [nextSettings] },
        {},
        ["c_patients", "c_meta"]
      );
      setPatients((prev) =>
        [...prev, ...created].sort((a, b) => a.name.localeCompare(b.name))
      );
      setSettings(nextSettings);
      return created.length;
    },
    [settings, batchWithSync, findCustomerByPhone]
  );

  // ---- Appointments --------------------------------------------------------

  const bookAppointment = useCallback(
    async (input: BookingInput) => {
      const appointment: Appointment = {
        ...input,
        id: generateId(),
        status: "booked",
        tokenNo: null,
        priority: false,
        arrivedAt: null,
        consultStartedAt: null,
        consultEndedAt: null,
        cancelReason: "",
        createdFromVisitId: null,
        remindedAt: null,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      await batchWithSync({ clinic_appointments: [appointment] }, {}, ["c_appointments"]);
      setAppointments((prev) => [...prev, appointment]);
      return appointment;
    },
    [batchWithSync]
  );

  const patchAppointment = useCallback(
    async (id: string, updates: Partial<Appointment>) => {
      const existing = appointments.find((a) => a.id === id);
      if (!existing) return null;
      const next: Appointment = { ...existing, ...updates, updatedAt: nowIso() };
      await batchWithSync({ clinic_appointments: [next] }, {}, ["c_appointments"]);
      setAppointments((prev) => prev.map((a) => (a.id === id ? next : a)));
      return next;
    },
    [appointments, batchWithSync]
  );

  /**
   * Arrival is where the token is issued — a patient who booked for 10am but
   * turned up at 6pm is seen in the order they actually arrived.
   */
  const markArrived = useCallback(
    async (id: string) => {
      const existing = appointments.find((a) => a.id === id);
      if (!existing) return;
      const token =
        existing.tokenNo ?? nextTokenNo(appointments, existing.doctorId, existing.date);
      await patchAppointment(id, {
        status: "waiting",
        tokenNo: token,
        arrivedAt: existing.arrivedAt ?? nowIso(),
      });
    },
    [appointments, patchAppointment]
  );

  const addWalkIn = useCallback(
    async (patientId: string, doctorId: string, reason: string) => {
      const date = todayIso();
      const now = new Date();
      const startTime = `${String(now.getHours()).padStart(2, "0")}:${String(
        now.getMinutes()
      ).padStart(2, "0")}`;
      const appointment: Appointment = {
        id: generateId(),
        patientId,
        doctorId,
        date,
        startTime,
        durationMinutes: settings.slotMinutes,
        status: "waiting",
        tokenNo: nextTokenNo(appointments, doctorId, date),
        priority: false,
        arrivedAt: nowIso(),
        consultStartedAt: null,
        consultEndedAt: null,
        reason,
        cancelReason: "",
        createdFromVisitId: null,
        remindedAt: null,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      await batchWithSync({ clinic_appointments: [appointment] }, {}, ["c_appointments"]);
      setAppointments((prev) => [...prev, appointment]);
      return appointment;
    },
    [appointments, settings.slotMinutes, batchWithSync]
  );

  const rescheduleAppointment = useCallback(
    async (id: string, date: string, startTime: string) => {
      await patchAppointment(id, { date, startTime, status: "booked", remindedAt: null });
    },
    [patchAppointment]
  );

  const cancelAppointment = useCallback(
    async (id: string, reason: string) => {
      await patchAppointment(id, { status: "cancelled", cancelReason: reason });
    },
    [patchAppointment]
  );

  const reopenAppointment = useCallback(
    async (id: string) => {
      await patchAppointment(id, { status: "booked", cancelReason: "" });
    },
    [patchAppointment]
  );

  const togglePriority = useCallback(
    async (id: string) => {
      const existing = appointments.find((a) => a.id === id);
      if (!existing) return;
      await patchAppointment(id, { priority: !existing.priority });
    },
    [appointments, patchAppointment]
  );

  const markReminded = useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) return;
      const stamp = nowIso();
      const updated = appointments
        .filter((a) => ids.includes(a.id))
        .map((a) => ({ ...a, remindedAt: stamp, updatedAt: stamp }));
      if (updated.length === 0) return;
      await batchWithSync({ clinic_appointments: updated }, {}, ["c_appointments"]);
      setAppointments((prev) => prev.map((a) => updated.find((u) => u.id === a.id) ?? a));
    },
    [appointments, batchWithSync]
  );

  /**
   * Anything still `booked` on a day that has passed was a no-show. With no
   * server to run this at midnight it is swept once per session on open, which
   * also catches the clinic that was closed for three days.
   */
  useEffect(() => {
    if (status !== "ready" || sweptRef.current) return;
    const lapsed = findLapsedBookings(appointments);
    if (lapsed.length === 0) {
      sweptRef.current = true;
      return;
    }
    sweptRef.current = true;
    const stamp = nowIso();
    const updated = lapsed.map((a) => ({ ...a, status: "no-show" as const, updatedAt: stamp }));
    batchWithSync({ clinic_appointments: updated }, {}, ["c_appointments"])
      .then(() => {
        setAppointments((prev) => prev.map((a) => updated.find((u) => u.id === a.id) ?? a));
      })
      .catch(() => {
        // A failed sweep is not worth interrupting the clinic's day for; it
        // will be retried on the next open.
        sweptRef.current = false;
      });
  }, [status, appointments, batchWithSync]);

  // ---- Visits --------------------------------------------------------------

  const blankVisit = useCallback(
    (patientId: string, doctorId: string, appointmentId: string | null): Visit => ({
      id: generateId(),
      patientId,
      doctorId,
      appointmentId,
      date: todayIso(),
      vitals: { ...EMPTY_VITALS },
      complaints: "",
      findings: "",
      diagnosis: "",
      advice: "",
      investigations: [],
      medicines: [],
      followUpDays: null,
      internalNotes: "",
      finalisedAt: null,
      editedAfterFinaliseAt: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    }),
    []
  );

  const startConsult = useCallback(
    async (appointmentId: string) => {
      const appointment = appointments.find((a) => a.id === appointmentId);
      if (!appointment) throw new Error("That appointment no longer exists.");

      // Resume rather than duplicate — this is what makes closing the tab safe.
      const existing = visits.find((v) => v.appointmentId === appointmentId);
      if (existing) {
        if (appointment.status !== "in-consult") {
          await patchAppointment(appointmentId, {
            status: "in-consult",
            consultStartedAt: appointment.consultStartedAt ?? nowIso(),
          });
        }
        return existing;
      }

      const visit = blankVisit(appointment.patientId, appointment.doctorId, appointmentId);
      const nextAppointment: Appointment = {
        ...appointment,
        status: "in-consult",
        tokenNo:
          appointment.tokenNo ??
          nextTokenNo(appointments, appointment.doctorId, appointment.date),
        arrivedAt: appointment.arrivedAt ?? nowIso(),
        consultStartedAt: appointment.consultStartedAt ?? nowIso(),
        updatedAt: nowIso(),
      };
      await batchWithSync(
        { clinic_visits: [visit], clinic_appointments: [nextAppointment] },
        {},
        ["c_visits", "c_appointments"]
      );
      setVisits((prev) => [visit, ...prev]);
      setAppointments((prev) => prev.map((a) => (a.id === appointmentId ? nextAppointment : a)));
      return visit;
    },
    [appointments, visits, blankVisit, batchWithSync, patchAppointment]
  );

  const startConsultForPatient = useCallback(
    async (patientId: string, doctorId: string) => {
      const visit = blankVisit(patientId, doctorId, null);
      await batchWithSync({ clinic_visits: [visit] }, {}, ["c_visits"]);
      setVisits((prev) => [visit, ...prev]);
      return visit;
    },
    [blankVisit, batchWithSync]
  );

  const saveVisit = useCallback(
    async (id: string, updates: Partial<Visit>) => {
      const existing = visits.find((v) => v.id === id);
      if (!existing) return;
      const next: Visit = {
        ...existing,
        ...updates,
        // Editing a finalised visit is allowed, but it is marked on the chart.
        editedAfterFinaliseAt: existing.finalisedAt
          ? nowIso()
          : existing.editedAfterFinaliseAt,
        updatedAt: nowIso(),
      };
      await batchWithSync({ clinic_visits: [next] }, {}, ["c_visits"]);
      setVisits((prev) => prev.map((v) => (v.id === id ? next : v)));
    },
    [visits, batchWithSync]
  );

  const saveVitals = useCallback(
    async (id: string, vitals: Vitals) => {
      await saveVisit(id, { vitals: withDerivedVitals(vitals) });
    },
    [saveVisit]
  );

  /**
   * Finalising stamps the visit, closes the appointment, and bumps the usage
   * counters that make the medicine picker and protocol list reorder themselves
   * around what this doctor actually prescribes.
   */
  const finaliseVisit = useCallback(
    async (id: string) => {
      const visit = visits.find((v) => v.id === id);
      if (!visit) return;
      const stamp = nowIso();
      const next: Visit = { ...visit, finalisedAt: visit.finalisedAt ?? stamp, updatedAt: stamp };

      const usedIds = new Set(
        (visit.medicines ?? []).map((line) => line.medicineId).filter(Boolean) as string[]
      );
      const touchedMedicines = medicines
        .filter((m) => usedIds.has(m.id))
        .map((m) => ({ ...m, timesUsed: (m.timesUsed ?? 0) + 1 }));

      const writes: Partial<Record<StoreName, unknown[]>> = { clinic_visits: [next] };
      const slices: SyncSlice[] = ["c_visits"];
      if (touchedMedicines.length) {
        writes.clinic_medicines = touchedMedicines;
        slices.push("c_meta");
      }

      let nextAppointment: Appointment | null = null;
      if (visit.appointmentId) {
        const appointment = appointments.find((a) => a.id === visit.appointmentId);
        if (appointment) {
          nextAppointment = {
            ...appointment,
            status: "done",
            consultEndedAt: nowIso(),
            updatedAt: stamp,
          };
          writes.clinic_appointments = [nextAppointment];
          slices.push("c_appointments");
        }
      }

      await batchWithSync(writes, {}, slices);
      setVisits((prev) => prev.map((v) => (v.id === id ? next : v)));
      if (touchedMedicines.length) {
        setMedicines((prev) =>
          prev.map((m) => touchedMedicines.find((t) => t.id === m.id) ?? m)
        );
      }
      if (nextAppointment) {
        const settled = nextAppointment;
        setAppointments((prev) => prev.map((a) => (a.id === settled.id ? settled : a)));
      }
    },
    [visits, medicines, appointments, batchWithSync]
  );

  const deleteVisit = useCallback(
    async (id: string) => {
      await batchWithSync({}, { clinic_visits: [id] }, ["c_visits"]);
      setVisits((prev) => prev.filter((v) => v.id !== id));
    },
    [batchWithSync]
  );

  // ---- Medicines -----------------------------------------------------------

  const saveMedicine = useCallback(
    async (medicine: Medicine) => {
      await batchWithSync({ clinic_medicines: [medicine] }, {}, ["c_meta"]);
      setMedicines((prev) => {
        const exists = prev.some((m) => m.id === medicine.id);
        const next = exists
          ? prev.map((m) => (m.id === medicine.id ? medicine : m))
          : [...prev, medicine];
        return next.sort((a, b) => a.name.localeCompare(b.name));
      });
    },
    [batchWithSync]
  );

  const addMedicine = useCallback(
    async (input: Omit<Medicine, "id" | "createdAt" | "timesUsed">) => {
      const medicine: Medicine = {
        ...input,
        id: generateId(),
        timesUsed: 0,
        createdAt: nowIso(),
      };
      await saveMedicine(medicine);
      return medicine;
    },
    [saveMedicine]
  );

  const deleteMedicine = useCallback(
    async (id: string) => {
      await batchWithSync({}, { clinic_medicines: [id] }, ["c_meta"]);
      setMedicines((prev) => prev.filter((m) => m.id !== id));
    },
    [batchWithSync]
  );

  /** Opt-in starter list. Rows the clinic already has are skipped. */
  const seedMedicines = useCallback(async () => {
    const existing = new Set(medicines.map(medicineKey));
    const fresh = buildSeedMedicines().filter((m) => !existing.has(medicineKey(m)));
    if (fresh.length === 0) return 0;
    await batchWithSync({ clinic_medicines: fresh }, {}, ["c_meta"]);
    setMedicines((prev) => [...prev, ...fresh].sort((a, b) => a.name.localeCompare(b.name)));
    return fresh.length;
  }, [medicines, batchWithSync]);

  // ---- Protocols -----------------------------------------------------------

  const saveProtocol = useCallback(
    async (input: ProtocolInput) => {
      const protocol: Protocol = {
        ...input,
        id: generateId(),
        timesUsed: 0,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      await batchWithSync({ clinic_protocols: [protocol] }, {}, ["c_meta"]);
      setProtocols((prev) => [...prev, protocol].sort((a, b) => b.timesUsed - a.timesUsed));
      return protocol;
    },
    [batchWithSync]
  );

  const updateProtocol = useCallback(
    async (id: string, input: ProtocolInput) => {
      const existing = protocols.find((p) => p.id === id);
      if (!existing) return;
      const next: Protocol = { ...existing, ...input, updatedAt: nowIso() };
      await batchWithSync({ clinic_protocols: [next] }, {}, ["c_meta"]);
      setProtocols((prev) => prev.map((p) => (p.id === id ? next : p)));
    },
    [protocols, batchWithSync]
  );

  const deleteProtocol = useCallback(
    async (id: string) => {
      await batchWithSync({}, { clinic_protocols: [id] }, ["c_meta"]);
      setProtocols((prev) => prev.filter((p) => p.id !== id));
    },
    [batchWithSync]
  );

  /** Loading a protocol counts as using it, which is what reorders the list. */
  const useProtocolById = useCallback(
    async (id: string) => {
      const existing = protocols.find((p) => p.id === id);
      if (!existing) return null;
      const next: Protocol = { ...existing, timesUsed: (existing.timesUsed ?? 0) + 1 };
      await batchWithSync({ clinic_protocols: [next] }, {}, ["c_meta"]);
      setProtocols((prev) =>
        prev.map((p) => (p.id === id ? next : p)).sort((a, b) => b.timesUsed - a.timesUsed)
      );
      return next;
    },
    [protocols, batchWithSync]
  );

  // ---- Charges -------------------------------------------------------------

  const saveCharge = useCallback(
    async (charge: ClinicCharge) => {
      await batchWithSync({ clinic_charges: [charge] }, {}, ["c_meta"]);
      setCharges((prev) => {
        const exists = prev.some((c) => c.id === charge.id);
        return exists ? prev.map((c) => (c.id === charge.id ? charge : c)) : [...prev, charge];
      });
    },
    [batchWithSync]
  );

  const deleteCharge = useCallback(
    async (id: string) => {
      await batchWithSync({}, { clinic_charges: [id] }, ["c_meta"]);
      setCharges((prev) => prev.filter((c) => c.id !== id));
    },
    [batchWithSync]
  );

  // ---- Bills ---------------------------------------------------------------

  const feeFor = useCallback(
    (patientId: string, doctorId: string, date: string = todayIso()) => {
      const doctor = doctors.find((d) => d.id === doctorId);
      if (!doctor) return { amount: 0, isFollowUp: false, withinDays: null };
      return consultationFeeFor(doctor, patientId, visits, date);
    },
    [doctors, visits]
  );

  const createBill = useCallback(
    async (input: BillInput) => {
      const number = settings.nextReceiptNumber;
      const total = Math.max(
        0,
        input.lines.reduce((sum, line) => sum + (line.amount || 0), 0) - (input.discount || 0)
      );
      const bill: Bill = {
        ...input,
        id: generateId(),
        receiptNo: formatReceiptNumber(settings.receiptPrefix, number),
        total: Math.round((total + Number.EPSILON) * 100) / 100,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      const nextSettings: ClinicSettings = { ...settings, nextReceiptNumber: number + 1 };
      await batchWithSync(
        { clinic_bills: [bill], clinic_settings: [nextSettings] },
        {},
        ["c_bills", "c_meta"]
      );
      setBills((prev) => [bill, ...prev]);
      setSettings(nextSettings);
      return bill;
    },
    [settings, batchWithSync]
  );

  const updateBill = useCallback(
    async (id: string, input: BillInput) => {
      const existing = bills.find((b) => b.id === id);
      if (!existing) return;
      const total = Math.max(
        0,
        input.lines.reduce((sum, line) => sum + (line.amount || 0), 0) - (input.discount || 0)
      );
      const next: Bill = {
        ...existing,
        ...input,
        total: Math.round((total + Number.EPSILON) * 100) / 100,
        updatedAt: nowIso(),
      };
      await batchWithSync({ clinic_bills: [next] }, {}, ["c_bills"]);
      setBills((prev) => prev.map((b) => (b.id === id ? next : b)));
    },
    [bills, batchWithSync]
  );

  /** Settle part or all of an old due without rewriting the original bill. */
  const recordBillPayment = useCallback(
    async (id: string, amount: number, mode: string) => {
      const existing = bills.find((b) => b.id === id);
      if (!existing) return;
      const next: Bill = {
        ...existing,
        paid: Math.min(existing.total, (existing.paid || 0) + amount),
        paymentMode: mode || existing.paymentMode,
        updatedAt: nowIso(),
      };
      await batchWithSync({ clinic_bills: [next] }, {}, ["c_bills"]);
      setBills((prev) => prev.map((b) => (b.id === id ? next : b)));
    },
    [bills, batchWithSync]
  );

  const deleteBill = useCallback(
    async (id: string) => {
      await batchWithSync({}, { clinic_bills: [id] }, ["c_bills"]);
      setBills((prev) => prev.filter((b) => b.id !== id));
    },
    [batchWithSync]
  );

  // ---- Google Sheet sync ---------------------------------------------------

  const flushSync = useCallback(
    async (slices: SyncSlice[]) => {
      const url = settings.sheetSyncUrl;
      const snapshot = snapshotRef.current;
      if (!url || !snapshot || slices.length === 0) return;
      if (flushingRef.current) return;
      flushingRef.current = true;
      setSheetSyncing(true);
      try {
        await pushToSheet(url, buildTabPayloads(slices, snapshot));
        const stamp = nowIso();
        setSheetLastSyncAt(stamp);
        setSheetLastError("");
        try {
          localStorage.setItem(LAST_SYNC_KEY, stamp);
        } catch {
          // Status display only.
        }
        await dbBatch({}, { sync_queue: slices });
        setDirtySlices((prev) => prev.filter((slice) => !slices.includes(slice)));
      } catch (error: unknown) {
        setSheetLastError(
          error instanceof Error ? error.message : "Could not reach the sheet."
        );
      } finally {
        flushingRef.current = false;
        setSheetSyncing(false);
      }
    },
    [settings.sheetSyncUrl]
  );

  const syncSheetNow = useCallback(async () => {
    await flushSync(dirtySlices);
  }, [flushSync, dirtySlices]);

  const resyncSheetAll = useCallback(async () => {
    await flushSync([...SYNC_SLICES]);
  }, [flushSync]);

  const connectSheet = useCallback(
    async (url: string) => {
      const trimmed = url.trim();
      if (!isValidSyncUrl(trimmed)) {
        throw new Error("That does not look like an Apps Script web-app URL.");
      }
      const test = await testSheetConnection(trimmed);
      if (!test.ok) throw new Error(test.error ?? "Could not reach the script.");
      await updateSettings({ sheetSyncUrl: trimmed });
      setDirtySlices([...SYNC_SLICES]);
    },
    [updateSettings]
  );

  const disconnectSheet = useCallback(async () => {
    await updateSettings({ sheetSyncUrl: "" });
    setSheetLastError("");
  }, [updateSettings]);

  const restoreFromSheet = useCallback(
    async (url: string) => {
      const trimmed = url.trim();
      if (!isValidSyncUrl(trimmed)) {
        throw new Error("That does not look like an Apps Script web-app URL.");
      }
      const pulled = await pullFromSheet(trimmed);
      const restoredSettings = settingsFromPull(pulled.meta.settings);
      restoredSettings.sheetSyncUrl = trimmed;

      await dbClearStores([
        "clinic_patients",
        "clinic_appointments",
        "clinic_visits",
        "clinic_bills",
        "clinic_doctors",
        "clinic_medicines",
        "clinic_protocols",
        "clinic_charges",
      ]);
      await dbBatch({
        clinic_patients: pulled.patients,
        clinic_appointments: pulled.appointments,
        clinic_visits: pulled.visits,
        clinic_bills: pulled.bills,
        clinic_doctors: pulled.meta.doctors ?? [],
        clinic_medicines: pulled.meta.medicines ?? [],
        clinic_protocols: pulled.meta.protocols ?? [],
        clinic_charges: pulled.meta.charges ?? [],
        clinic_settings: [restoredSettings],
        ...(pulled.meta.business ? { business: [pulled.meta.business] } : {}),
      });
      await loadAll();
      setStatus("ready");
    },
    [loadAll]
  );

  // ---- Backup & reset ------------------------------------------------------

  const exportBackup = useCallback(async () => {
    const backup = await createBackup();
    downloadBackupFile(backup);
    await updateSettings({ lastBackupAt: nowIso() });
  }, [updateSettings]);

  const applyRestoredBackup = useCallback(
    async (backup: ClinicBackup) => {
      await restoreBackup(backup);
      const loaded = await loadAll();
      setStatus(loaded.hasSetup && loaded.doctors.length > 0 ? "ready" : "welcome");
    },
    [loadAll]
  );

  const resetAll = useCallback(async () => {
    await dbClearStores(CLINIC_BACKUP_STORES.filter((store) => store !== "business"));
    setDoctors([]);
    setPatients([]);
    setAppointments([]);
    setVisits([]);
    setMedicines([]);
    setProtocols([]);
    setCharges([]);
    setBills([]);
    setSettings(DEFAULT_CLINIC_SETTINGS);
    setDirtySlices([]);
    sweptRef.current = false;
    setStatus("welcome");
  }, []);

  const value = useMemo<ClinicContextValue>(
    () => ({
      status,
      errorMessage,
      business,
      settings,
      doctors,
      patients,
      appointments,
      visits,
      medicines,
      protocols,
      charges,
      bills,
      workspaceCustomers,
      activeDoctor,
      startSetup,
      backToWelcome,
      createClinic,
      updateBusiness,
      updateSettings,
      acceptDisclaimer,
      createDoctor,
      updateDoctor,
      deleteDoctor,
      createPatient,
      updatePatient,
      deletePatient,
      importPatients,
      findPatientByPhone,
      findCustomerByPhone,
      bookAppointment,
      rescheduleAppointment,
      cancelAppointment,
      markArrived,
      togglePriority,
      markReminded,
      reopenAppointment,
      addWalkIn,
      startConsult,
      startConsultForPatient,
      saveVisit,
      saveVitals,
      finaliseVisit,
      deleteVisit,
      saveMedicine,
      addMedicine,
      deleteMedicine,
      seedMedicines,
      saveProtocol,
      updateProtocol,
      deleteProtocol,
      useProtocol: useProtocolById,
      saveCharge,
      deleteCharge,
      createBill,
      updateBill,
      recordBillPayment,
      deleteBill,
      feeFor,
      sheetSync: {
        url: settings.sheetSyncUrl,
        dirtyCount: dirtySlices.length,
        syncing: sheetSyncing,
        lastSyncAt: sheetLastSyncAt,
        lastError: sheetLastError,
      },
      connectSheet,
      disconnectSheet,
      syncSheetNow,
      resyncSheetAll,
      restoreFromSheet,
      exportBackup,
      applyRestoredBackup,
      resetAll,
    }),
    [
      status,
      errorMessage,
      business,
      settings,
      doctors,
      patients,
      appointments,
      visits,
      medicines,
      protocols,
      charges,
      bills,
      workspaceCustomers,
      activeDoctor,
      startSetup,
      backToWelcome,
      createClinic,
      updateBusiness,
      updateSettings,
      acceptDisclaimer,
      createDoctor,
      updateDoctor,
      deleteDoctor,
      createPatient,
      updatePatient,
      deletePatient,
      importPatients,
      findPatientByPhone,
      findCustomerByPhone,
      bookAppointment,
      rescheduleAppointment,
      cancelAppointment,
      markArrived,
      togglePriority,
      markReminded,
      reopenAppointment,
      addWalkIn,
      startConsult,
      startConsultForPatient,
      saveVisit,
      saveVitals,
      finaliseVisit,
      deleteVisit,
      saveMedicine,
      addMedicine,
      deleteMedicine,
      seedMedicines,
      saveProtocol,
      updateProtocol,
      deleteProtocol,
      useProtocolById,
      saveCharge,
      deleteCharge,
      createBill,
      updateBill,
      recordBillPayment,
      deleteBill,
      feeFor,
      dirtySlices,
      sheetSyncing,
      sheetLastSyncAt,
      sheetLastError,
      connectSheet,
      disconnectSheet,
      syncSheetNow,
      resyncSheetAll,
      restoreFromSheet,
      exportBackup,
      applyRestoredBackup,
      resetAll,
    ]
  );

  return <ClinicContext.Provider value={value}>{children}</ClinicContext.Provider>;
}

export function useClinic(): ClinicContextValue {
  const context = useContext(ClinicContext);
  if (!context) throw new Error("useClinic must be used inside a ClinicProvider");
  return context;
}

/** Every visit for a patient, newest first — the chart timeline. */
export function usePatientVisits(patientId: string): Visit[] {
  const { visits } = useClinic();
  return useMemo(
    () =>
      visits
        .filter((v) => v.patientId === patientId)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [visits, patientId]
  );
}

/** Medicines ranked for the picker: frequently prescribed first. */
export function useFrequentMedicines(limit = 12): Medicine[] {
  const { medicines } = useClinic();
  return useMemo(
    () =>
      [...medicines]
        .filter((m) => (m.timesUsed ?? 0) > 0)
        .sort((a, b) => (b.timesUsed ?? 0) - (a.timesUsed ?? 0))
        .slice(0, limit),
    [medicines, limit]
  );
}

/**
 * Values this clinic has typed before, ranked by how often — the autocomplete
 * behind Complaints / Diagnosis / Advice, which is what makes the pad faster
 * the longer it is used.
 */
export function useHistorySuggestions(
  field: "complaints" | "findings" | "diagnosis" | "advice",
  query: string,
  limit = 6
): string[] {
  const { visits } = useClinic();
  return useMemo(() => {
    const counts = new Map<string, number>();
    for (const visit of visits) {
      const value = (visit[field] ?? "").trim();
      if (!value) continue;
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    const needle = query.trim().toLowerCase();
    return [...counts.entries()]
      .filter(([value]) => (needle ? value.toLowerCase().includes(needle) : true))
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([value]) => value);
  }, [visits, field, query, limit]);
}

/** A fresh, empty Rx line for the pad. */
export function newRxLine(): RxLine {
  return {
    id: generateId(),
    medicineId: null,
    name: "",
    strength: "",
    form: "tablet",
    frequency: "",
    durationDays: null,
    timing: "",
    quantity: null,
    instructions: "",
  };
}

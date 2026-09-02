"use client";

// Client-side store for the Free Rental & Hire Book.
//
// Everything lives in one browser's IndexedDB: no login, no server, no sync
// beyond the Google Sheet push the owner sets up themselves. The provider owns
// every write, and every write goes through the same normalisation — a booking
// is never saved with lines that do not add up to its total, because half the
// app reads those figures back and none of it re-derives them.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { dbBatch, dbGetAll } from "@/lib/pos/db";
import { nowIso as posNowIso, type Business } from "@/lib/pos/types";
import {
  allocateNumber,
  rentalBatch,
  rentalClearAll,
  rentalGetAll,
  type RentalStoreName,
} from "./db";
import { restoreBackup, type RentalBackup } from "./backup";
import { ALL_SYNC_SLICES, buildTabPayloads, isValidSyncUrl, pushToSheet } from "./sheetSync";
import { bookingTotals, lateDaysFor, lateFeeFor, recalcLine, round2 } from "./calc";
import { buildIndex, type AvailabilityIndex } from "./availability";
import {
  DEFAULT_SETTINGS,
  bookingNumberFrom,
  generateId,
  invoiceNumberFrom,
  nowIso,
  todayKey,
  type Booking,
  type BookingLine,
  type BookingPayment,
  type Customer,
  type ItemCategory,
  type ItemUnit,
  type MaintenanceLog,
  type RentalItem,
  type RentalSettings,
} from "./types";

export type AppStatus = "loading" | "welcome" | "setup" | "ready" | "error";

export type CategoryInput = Omit<ItemCategory, "id" | "createdAt">;
export type ItemInput = Omit<RentalItem, "id" | "createdAt" | "updatedAt">;
export type CustomerInput = Omit<Customer, "id" | "createdAt" | "updatedAt">;
export type MaintenanceInput = Omit<MaintenanceLog, "id" | "createdAt">;

/** Everything a booking needs that is not derived from the items and settings. */
export type BookingInput = Pick<
  Booking,
  | "customerId"
  | "fromDate"
  | "toDate"
  | "fromTime"
  | "toTime"
  | "eventName"
  | "venue"
  | "venueContact"
  | "lines"
  | "transportCharge"
  | "labourCharge"
  | "discount"
  | "taxRate"
  | "overCommitted"
  | "note"
> & { status?: Booking["status"] };

export type PaymentInput = {
  amount: number;
  mode: string;
  kind: BookingPayment["kind"];
  note?: string;
  date?: string;
};

/** What the return screen collects, per line. */
export type ReturnLineInput = {
  lineId: string;
  returnedQuantity: number;
  damagedQuantity: number;
  lostQuantity: number;
  damageCharge: number;
  lossCharge: number;
  returnNote: string;
};

export type ReturnInput = {
  actualReturnedOn: string;
  lines: ReturnLineInput[];
  returnSignature: string;
  /** Collected now, if anything is. */
  payment?: PaymentInput | null;
  /** Refunded now, if the deposit came back. */
  refund?: PaymentInput | null;
  raiseInvoice: boolean;
};

type RentalContextValue = {
  status: AppStatus;
  errorMessage: string;
  business: Business | null;
  settings: RentalSettings;
  categories: ItemCategory[];
  items: RentalItem[];
  units: ItemUnit[];
  customers: Customer[];
  bookings: Booking[];
  maintenanceLogs: MaintenanceLog[];
  today: string;

  /** The availability index over every live booking. Rebuilt when they change. */
  index: AvailabilityIndex;

  startSetup: () => void;
  backToWelcome: () => void;
  createBook: (
    profile: Omit<Business, "id" | "createdAt">,
    categoryName: string,
    firstItem: { name: string; totalQuantity: number; rate: number } | null
  ) => Promise<void>;
  updateBusiness: (updates: Partial<Omit<Business, "id" | "createdAt">>) => Promise<void>;
  updateSettings: (updates: Partial<Omit<RentalSettings, "id">>) => Promise<void>;

  saveCategory: (input: CategoryInput, id?: string) => Promise<ItemCategory>;
  deleteCategory: (id: string) => Promise<void>;

  saveItem: (input: ItemInput, id?: string) => Promise<RentalItem>;
  deleteItem: (id: string) => Promise<void>;
  /** Create serial-numbered units for an item, continuing from what exists. */
  addUnits: (itemId: string, serials: string[]) => Promise<void>;
  saveUnit: (unit: ItemUnit) => Promise<void>;
  deleteUnit: (id: string) => Promise<void>;

  saveCustomer: (input: CustomerInput, id?: string) => Promise<Customer>;
  deleteCustomer: (id: string) => Promise<void>;

  saveBooking: (input: BookingInput, id?: string) => Promise<Booking>;
  setBookingStatus: (id: string, status: Booking["status"]) => Promise<void>;
  /** Confirm an enquiry — this is the moment the stock is actually committed. */
  confirmBooking: (id: string, advance?: PaymentInput | null) => Promise<void>;
  dispatchBooking: (
    id: string,
    allocations: Record<string, string[]>,
    signature: string,
    dispatchedOn?: string
  ) => Promise<void>;
  returnBooking: (id: string, input: ReturnInput) => Promise<void>;
  closeBooking: (id: string) => Promise<void>;
  cancelBooking: (id: string) => Promise<void>;
  deleteBooking: (id: string) => Promise<void>;
  recordPayment: (bookingId: string, payment: PaymentInput) => Promise<void>;

  saveMaintenance: (input: MaintenanceInput, id?: string) => Promise<MaintenanceLog>;
  deleteMaintenance: (id: string) => Promise<void>;

  clearAllData: () => Promise<void>;
  applyRestoredBackup: (backup: RentalBackup) => Promise<void>;
  syncToSheet: () => Promise<void>;
  reloadAll: () => Promise<void>;

  itemById: (id: string) => RentalItem | undefined;
  customerById: (id: string) => Customer | undefined;
  categoryById: (id: string) => ItemCategory | undefined;
  bookingById: (id: string) => Booking | undefined;
};

const RentalContext = createContext<RentalContextValue | null>(null);

export function useRental(): RentalContextValue {
  const context = useContext(RentalContext);
  if (!context) throw new Error("useRental must be used inside a RentalProvider.");
  return context;
}

/**
 * Bring a booking's derived figures back in line with its lines and window.
 *
 * Called on every write. Chargeable units follow the window, amounts follow the
 * units, the totals follow the amounts, and the payment totals follow the
 * movements — so nothing in the app has to wonder whether the number in front
 * of it is stale.
 */
function normalizeBooking(
  booking: Booking,
  settings: RentalSettings,
  itemById: Map<string, RentalItem>,
  today: string
): Booking {
  const window = {
    fromDate: booking.fromDate,
    toDate: booking.toDate,
    fromTime: booking.fromTime,
    toTime: booking.toTime,
  };
  const lines = booking.lines.map((line) => recalcLine(line, window, settings));
  const totals = bookingTotals({ ...booking, lines }, settings);

  const advancePaid = round2(
    booking.payments
      .filter((payment) => payment.kind === "advance")
      .reduce((sum, payment) => sum + payment.amount, 0)
  );
  const paid = round2(
    booking.payments
      .filter((payment) => payment.kind === "advance" || payment.kind === "settlement")
      .reduce((sum, payment) => sum + payment.amount, 0)
  );
  const depositRefunded = round2(
    booking.payments
      .filter((payment) => payment.kind === "refund")
      .reduce((sum, payment) => sum + payment.amount, 0)
  );

  const lateDays = lateDaysFor({ ...booking, lines }, today);
  const lateFee = lateFeeFor({ ...booking, lines }, lateDays, settings, itemById);
  const damageTotal = round2(lines.reduce((sum, line) => sum + line.damageCharge, 0));
  const lossTotal = round2(lines.reduce((sum, line) => sum + line.lossCharge, 0));
  const charges = round2(totals.total + lateFee + damageTotal + lossTotal);

  return {
    ...booking,
    lines,
    taxAmount: totals.taxAmount,
    total: totals.total,
    depositTotal: totals.depositTotal,
    advancePaid,
    paid,
    depositRefunded,
    lateDays,
    lateFee,
    damageTotal,
    lossTotal,
    finalPayable: round2(Math.max(0, charges - paid - totals.depositTotal)),
    paymentMode: booking.payments.at(-1)?.mode ?? booking.paymentMode,
    updatedAt: nowIso(),
  };
}

function emptyBooking(): Omit<Booking, "id" | "bookingNo" | "createdAt"> {
  return {
    customerId: "",
    status: "enquiry",
    fromDate: todayKey(),
    toDate: todayKey(),
    fromTime: "",
    toTime: "",
    eventName: "",
    venue: "",
    venueContact: "",
    lines: [],
    transportCharge: 0,
    labourCharge: 0,
    discount: 0,
    taxRate: 0,
    taxAmount: 0,
    total: 0,
    depositTotal: 0,
    advancePaid: 0,
    overCommitted: false,
    actualReturnedOn: null,
    lateDays: 0,
    lateFee: 0,
    damageTotal: 0,
    lossTotal: 0,
    depositRefunded: 0,
    finalPayable: 0,
    paid: 0,
    paymentMode: "",
    payments: [],
    dispatchedOn: null,
    dispatchSignature: "",
    returnSignature: "",
    invoiceNo: null,
    invoicedOn: null,
    note: "",
    updatedAt: nowIso(),
  };
}

export function RentalProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AppStatus>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [business, setBusiness] = useState<Business | null>(null);
  const [settings, setSettings] = useState<RentalSettings>(DEFAULT_SETTINGS);
  const [categories, setCategories] = useState<ItemCategory[]>([]);
  const [items, setItems] = useState<RentalItem[]>([]);
  const [units, setUnits] = useState<ItemUnit[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [maintenanceLogs, setMaintenanceLogs] = useState<MaintenanceLog[]>([]);
  const [today, setToday] = useState<string>(() => todayKey());

  const itemMap = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);

  const index = useMemo(
    () =>
      buildIndex(bookings, maintenanceLogs, {
        bufferDays: settings.bufferDays,
        today,
      }),
    [bookings, maintenanceLogs, settings.bufferDays, today]
  );

  /* ---------------------------------------------------------------------
   * Loading
   * ------------------------------------------------------------------ */

  const load = useCallback(async () => {
    try {
      const [
        storedSettings,
        storedCategories,
        storedItems,
        storedUnits,
        storedCustomers,
        storedBookings,
        storedLogs,
        workspace,
      ] = await Promise.all([
        rentalGetAll<RentalSettings>("rentalSettings"),
        rentalGetAll<ItemCategory>("itemCategories"),
        rentalGetAll<RentalItem>("items"),
        rentalGetAll<ItemUnit>("itemUnits"),
        rentalGetAll<Customer>("customers"),
        rentalGetAll<Booking>("bookings"),
        rentalGetAll<MaintenanceLog>("maintenanceLogs"),
        dbGetAll<Business>("business"),
      ]);

      const merged: RentalSettings = {
        ...DEFAULT_SETTINGS,
        ...(storedSettings.find((row) => row.id === "main") ?? {}),
      };

      setSettings(merged);
      setCategories(storedCategories.slice().sort((a, b) => a.sortOrder - b.sortOrder));
      setItems(storedItems);
      setUnits(storedUnits);
      setCustomers(storedCustomers);
      setBookings(storedBookings);
      setMaintenanceLogs(storedLogs);
      setToday(todayKey());
      setBusiness(workspace.find((row) => row.id === "main") ?? null);

      // A hire book exists once it has something to hire out. A workspace alone
      // is not enough — someone who used the invoice tool last month has a
      // business record and no stock.
      setStatus(storedItems.length > 0 ? "ready" : "welcome");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not open the rental database."
      );
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * Roll the day over under a tab left open overnight.
   *
   * Overdue counts and accruing late fees are read off `today`; a tab opened on
   * Friday and still showing Friday on Sunday morning under-reports both.
   */
  useEffect(() => {
    if (status !== "ready") return;
    const timer = window.setInterval(() => {
      const current = todayKey();
      setToday((previous) => (previous === current ? previous : current));
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [status]);

  const reloadAll = useCallback(async () => {
    const [
      storedSettings,
      storedCategories,
      storedItems,
      storedUnits,
      storedCustomers,
      storedBookings,
      storedLogs,
    ] = await Promise.all([
      rentalGetAll<RentalSettings>("rentalSettings"),
      rentalGetAll<ItemCategory>("itemCategories"),
      rentalGetAll<RentalItem>("items"),
      rentalGetAll<ItemUnit>("itemUnits"),
      rentalGetAll<Customer>("customers"),
      rentalGetAll<Booking>("bookings"),
      rentalGetAll<MaintenanceLog>("maintenanceLogs"),
    ]);
    setSettings({ ...DEFAULT_SETTINGS, ...(storedSettings.find((r) => r.id === "main") ?? {}) });
    setCategories(storedCategories.slice().sort((a, b) => a.sortOrder - b.sortOrder));
    setItems(storedItems);
    setUnits(storedUnits);
    setCustomers(storedCustomers);
    setBookings(storedBookings);
    setMaintenanceLogs(storedLogs);
  }, []);

  /* ---------------------------------------------------------------------
   * Setup and settings
   * ------------------------------------------------------------------ */

  const startSetup = useCallback(() => setStatus("setup"), []);
  const backToWelcome = useCallback(() => setStatus("welcome"), []);

  const persistSettings = useCallback(async (next: RentalSettings) => {
    await rentalBatch({ rentalSettings: [next] });
    setSettings(next);
  }, []);

  const createBook = useCallback(
    async (
      profile: Omit<Business, "id" | "createdAt">,
      categoryName: string,
      firstItem: { name: string; totalQuantity: number; rate: number } | null
    ) => {
      const existing = (await dbGetAll<Business>("business")).find((row) => row.id === "main");
      // The workspace is shared. If this device already has a business — from
      // the POS, the invoice tool, anything — take it as it is rather than
      // overwriting saved details with a half-filled setup form.
      const nextBusiness: Business =
        existing ?? { ...profile, id: "main", createdAt: posNowIso() };
      if (!existing) await dbBatch({ business: [nextBusiness] });

      const timestamp = nowIso();
      const category: ItemCategory = {
        id: generateId(),
        name: categoryName.trim() || "General",
        sortOrder: 0,
        createdAt: timestamp,
      };
      const nextSettings: RentalSettings = { ...DEFAULT_SETTINGS };
      const newItems: RentalItem[] = [];

      if (firstItem && firstItem.name.trim()) {
        newItems.push({
          id: generateId(),
          name: firstItem.name.trim(),
          categoryId: category.id,
          tracking: "bulk",
          totalQuantity: Math.max(0, firstItem.totalQuantity),
          rateBasis: "per-day",
          rate: Math.max(0, firstItem.rate),
          depositPerUnit: 0,
          lateFeePerUnitPerDay: 0,
          replacementValue: 0,
          purchaseCost: 0,
          purchasedOn: "",
          imageDataUrl: "",
          active: true,
          notes: "",
          createdAt: timestamp,
          updatedAt: timestamp,
        });
      }

      await rentalBatch({
        itemCategories: [category],
        items: newItems,
        rentalSettings: [nextSettings],
      });

      setBusiness(nextBusiness);
      setSettings(nextSettings);
      setCategories([category]);
      setItems(newItems);
      setStatus(newItems.length > 0 ? "ready" : "welcome");
    },
    []
  );

  const updateBusiness = useCallback(
    async (updates: Partial<Omit<Business, "id" | "createdAt">>) => {
      const existing = (await dbGetAll<Business>("business")).find((row) => row.id === "main");
      const next: Business = existing
        ? { ...existing, ...updates }
        : {
            id: "main",
            name: "",
            phone: "",
            address: "",
            currency: "INR",
            email: "",
            taxNumber: "",
            logoDataUrl: "",
            createdAt: posNowIso(),
            ...updates,
          };
      await dbBatch({ business: [next] });
      setBusiness(next);
    },
    []
  );

  const updateSettings = useCallback(
    async (updates: Partial<Omit<RentalSettings, "id">>) => {
      await persistSettings({ ...settings, ...updates, id: "main" });
    },
    [persistSettings, settings]
  );

  /* ---------------------------------------------------------------------
   * Catalogue
   * ------------------------------------------------------------------ */

  const saveCategory = useCallback(
    async (input: CategoryInput, id?: string) => {
      const existing = id ? categories.find((row) => row.id === id) : undefined;
      const next: ItemCategory = existing
        ? { ...existing, ...input }
        : { ...input, id: generateId(), createdAt: nowIso() };
      await rentalBatch({ itemCategories: [next] });
      setCategories((rows) => {
        const others = rows.filter((row) => row.id !== next.id);
        return [...others, next].sort((a, b) => a.sortOrder - b.sortOrder);
      });
      return next;
    },
    [categories]
  );

  const deleteCategory = useCallback(
    async (id: string) => {
      if (items.some((item) => item.categoryId === id)) {
        throw new Error("Move or delete this category's items first.");
      }
      await rentalBatch({}, { itemCategories: [id] });
      setCategories((rows) => rows.filter((row) => row.id !== id));
    },
    [items]
  );

  const saveItem = useCallback(
    async (input: ItemInput, id?: string) => {
      const existing = id ? items.find((row) => row.id === id) : undefined;
      const timestamp = nowIso();
      const next: RentalItem = existing
        ? { ...existing, ...input, updatedAt: timestamp }
        : { ...input, id: generateId(), createdAt: timestamp, updatedAt: timestamp };
      await rentalBatch({ items: [next] });
      setItems((rows) => [...rows.filter((row) => row.id !== next.id), next]);
      return next;
    },
    [items]
  );

  const deleteItem = useCallback(
    async (id: string) => {
      const onLiveBooking = bookings.some(
        (booking) =>
          (booking.status === "confirmed" || booking.status === "dispatched") &&
          booking.lines.some((line) => line.itemId === id)
      );
      if (onLiveBooking) {
        throw new Error("This item is on a live booking. Close or cancel that booking first.");
      }
      const unitIds = units.filter((unit) => unit.itemId === id).map((unit) => unit.id);
      await rentalBatch({}, { items: [id], itemUnits: unitIds });
      setItems((rows) => rows.filter((row) => row.id !== id));
      setUnits((rows) => rows.filter((row) => row.itemId !== id));
    },
    [bookings, units]
  );

  const addUnits = useCallback(async (itemId: string, serials: string[]) => {
    const timestamp = nowIso();
    const created: ItemUnit[] = serials
      .map((serial) => serial.trim())
      .filter(Boolean)
      .map((serialNo) => ({
        id: generateId(),
        itemId,
        serialNo,
        condition: "good" as const,
        currentBookingId: null,
        createdAt: timestamp,
      }));
    if (created.length === 0) return;
    await rentalBatch({ itemUnits: created });
    setUnits((rows) => [...rows, ...created]);
  }, []);

  const saveUnit = useCallback(async (unit: ItemUnit) => {
    await rentalBatch({ itemUnits: [unit] });
    setUnits((rows) => [...rows.filter((row) => row.id !== unit.id), unit]);
  }, []);

  const deleteUnit = useCallback(async (id: string) => {
    await rentalBatch({}, { itemUnits: [id] });
    setUnits((rows) => rows.filter((row) => row.id !== id));
  }, []);

  /* ---------------------------------------------------------------------
   * Customers
   * ------------------------------------------------------------------ */

  const saveCustomer = useCallback(
    async (input: CustomerInput, id?: string) => {
      const existing = id ? customers.find((row) => row.id === id) : undefined;
      const timestamp = nowIso();
      const next: Customer = existing
        ? { ...existing, ...input, updatedAt: timestamp }
        : { ...input, id: generateId(), createdAt: timestamp, updatedAt: timestamp };
      await rentalBatch({ customers: [next] });
      setCustomers((rows) => [...rows.filter((row) => row.id !== next.id), next]);
      return next;
    },
    [customers]
  );

  const deleteCustomer = useCallback(
    async (id: string) => {
      if (bookings.some((booking) => booking.customerId === id)) {
        throw new Error("This customer has bookings. Delete those first.");
      }
      await rentalBatch({}, { customers: [id] });
      setCustomers((rows) => rows.filter((row) => row.id !== id));
    },
    [bookings]
  );

  /* ---------------------------------------------------------------------
   * Bookings
   * ------------------------------------------------------------------ */

  const writeBooking = useCallback(
    async (booking: Booking, extra: Partial<Record<RentalStoreName, unknown[]>> = {}) => {
      const normalized = normalizeBooking(booking, settings, itemMap, today);
      await rentalBatch({ bookings: [normalized], ...extra });
      setBookings((rows) => [...rows.filter((row) => row.id !== normalized.id), normalized]);
      return normalized;
    },
    [itemMap, settings, today]
  );

  const saveBooking = useCallback(
    async (input: BookingInput, id?: string) => {
      const existing = id ? bookings.find((row) => row.id === id) : undefined;

      if (existing) {
        const next: Booking = { ...existing, ...input, status: input.status ?? existing.status };
        return writeBooking(next);
      }

      const timestamp = nowIso();
      const draft = {
        ...emptyBooking(),
        ...input,
        status: input.status ?? "enquiry",
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      // The number and the row land in one transaction — see db.allocateNumber.
      const created = await allocateNumber<Booking>("nextBookingNumber", "bookings", (next) =>
        normalizeBooking(
          {
            ...draft,
            id: generateId(),
            bookingNo: bookingNumberFrom(settings.bookingPrefix, next),
          } as Booking,
          settings,
          itemMap,
          today
        )
      );

      setBookings((rows) => [...rows, created]);
      setSettings((current) => ({
        ...current,
        nextBookingNumber: Math.max(current.nextBookingNumber + 1, 1),
      }));
      return created;
    },
    [bookings, itemMap, settings, today, writeBooking]
  );

  const bookingOrThrow = useCallback(
    (id: string): Booking => {
      const booking = bookings.find((row) => row.id === id);
      if (!booking) throw new Error("That booking no longer exists.");
      return booking;
    },
    [bookings]
  );

  const buildPayment = useCallback((input: PaymentInput): BookingPayment => {
    return {
      id: generateId(),
      date: input.date ?? todayKey(),
      amount: round2(Math.max(0, input.amount)),
      mode: input.mode,
      kind: input.kind,
      note: input.note ?? "",
      createdAt: nowIso(),
    };
  }, []);

  const recordPayment = useCallback(
    async (bookingId: string, payment: PaymentInput) => {
      const booking = bookingOrThrow(bookingId);
      await writeBooking({
        ...booking,
        payments: [...booking.payments, buildPayment(payment)],
      });
    },
    [bookingOrThrow, buildPayment, writeBooking]
  );

  const setBookingStatus = useCallback(
    async (id: string, status: Booking["status"]) => {
      await writeBooking({ ...bookingOrThrow(id), status });
    },
    [bookingOrThrow, writeBooking]
  );

  const confirmBooking = useCallback(
    async (id: string, advance?: PaymentInput | null) => {
      const booking = bookingOrThrow(id);
      await writeBooking({
        ...booking,
        status: "confirmed",
        payments: advance
          ? [...booking.payments, buildPayment({ ...advance, kind: "advance" })]
          : booking.payments,
      });
    },
    [bookingOrThrow, buildPayment, writeBooking]
  );

  /**
   * Dispatch: the stock physically leaves.
   *
   * Serialised lines are pinned to the exact units the loading crew ticked off,
   * and those units are marked as held by this booking — that pin is what makes
   * "this camera body is on one booking at a time" true rather than aspirational.
   */
  const dispatchBooking = useCallback(
    async (
      id: string,
      allocations: Record<string, string[]>,
      signature: string,
      dispatchedOn?: string
    ) => {
      const booking = bookingOrThrow(id);
      const lines: BookingLine[] = booking.lines.map((line) => ({
        ...line,
        unitIds: allocations[line.id] ?? line.unitIds,
      }));

      const allocatedIds = new Set(lines.flatMap((line) => line.unitIds));
      const touchedUnits = units
        .filter((unit) => allocatedIds.has(unit.id) || unit.currentBookingId === id)
        .map((unit) => ({
          ...unit,
          currentBookingId: allocatedIds.has(unit.id) ? id : null,
        }));

      const saved = await writeBooking(
        {
          ...booking,
          lines,
          status: "dispatched",
          dispatchedOn: dispatchedOn ?? todayKey(),
          dispatchSignature: signature || booking.dispatchSignature,
        },
        touchedUnits.length > 0 ? { itemUnits: touchedUnits } : {}
      );

      if (touchedUnits.length > 0) {
        const byId = new Map(touchedUnits.map((unit) => [unit.id, unit]));
        setUnits((rows) => rows.map((unit) => byId.get(unit.id) ?? unit));
      }
      return void saved;
    },
    [bookingOrThrow, units, writeBooking]
  );

  /**
   * Return and settle.
   *
   * Three things happen beyond the money. Units come back to the shelf, and a
   * damaged serialised unit comes back flagged for repair rather than straight
   * into the next booking. Lost units are written off the item's total — stock
   * that is not coming back is not stock, and leaving the count alone means the
   * availability table promises chairs that are in a customer's garage. And an
   * invoice number is drawn only if the owner is raising one, so enquiries and
   * cash jobs do not burn numbers.
   */
  const returnBooking = useCallback(
    async (id: string, input: ReturnInput) => {
      const booking = bookingOrThrow(id);
      const byLineId = new Map(input.lines.map((line) => [line.lineId, line]));

      const lines: BookingLine[] = booking.lines.map((line) => {
        const filled = byLineId.get(line.id);
        if (!filled) return line;
        return {
          ...line,
          returnedQuantity: Math.max(0, filled.returnedQuantity),
          damagedQuantity: Math.max(0, filled.damagedQuantity),
          lostQuantity: Math.max(0, filled.lostQuantity),
          damageCharge: round2(Math.max(0, filled.damageCharge)),
          lossCharge: round2(Math.max(0, filled.lossCharge)),
          returnNote: filled.returnNote,
        };
      });

      const payments = [...booking.payments];
      if (input.payment && input.payment.amount > 0) {
        payments.push(buildPayment({ ...input.payment, kind: "settlement" }));
      }
      if (input.refund && input.refund.amount > 0) {
        payments.push(buildPayment({ ...input.refund, kind: "refund" }));
      }

      // Lost units come off the item's owned count.
      const lostByItem = new Map<string, number>();
      for (const line of lines) {
        if (line.lostQuantity > 0) {
          lostByItem.set(line.itemId, (lostByItem.get(line.itemId) ?? 0) + line.lostQuantity);
        }
      }
      const touchedItems = [...lostByItem.entries()]
        .map(([itemId, lost]) => {
          const item = itemMap.get(itemId);
          if (!item) return null;
          return {
            ...item,
            totalQuantity: Math.max(0, item.totalQuantity - lost),
            updatedAt: nowIso(),
          };
        })
        .filter((item): item is RentalItem => item !== null);

      // Units go back on the shelf; damaged ones go back flagged.
      const damagedLines = new Set(
        lines.filter((line) => line.damagedQuantity > 0).map((line) => line.id)
      );
      const lineByUnit = new Map<string, BookingLine>();
      for (const line of lines) for (const unitId of line.unitIds) lineByUnit.set(unitId, line);

      const touchedUnits = units
        .filter((unit) => unit.currentBookingId === id)
        .map((unit) => {
          const line = lineByUnit.get(unit.id);
          const lost = (line?.lostQuantity ?? 0) > 0;
          const damaged = line ? damagedLines.has(line.id) : false;
          return {
            ...unit,
            currentBookingId: null,
            condition: lost ? "retired" : damaged ? "needs-repair" : unit.condition,
          } as ItemUnit;
        });

      let invoiceNo = booking.invoiceNo;
      let invoicedOn = booking.invoicedOn;
      if (input.raiseInvoice && !invoiceNo) {
        invoiceNo = invoiceNumberFrom(settings.invoicePrefix, settings.nextInvoiceNumber);
        invoicedOn = todayKey();
        await persistSettings({
          ...settings,
          nextInvoiceNumber: settings.nextInvoiceNumber + 1,
        });
      }

      await writeBooking(
        {
          ...booking,
          lines,
          payments,
          status: "returned",
          actualReturnedOn: input.actualReturnedOn,
          returnSignature: input.returnSignature || booking.returnSignature,
          invoiceNo,
          invoicedOn,
        },
        {
          ...(touchedItems.length > 0 ? { items: touchedItems } : {}),
          ...(touchedUnits.length > 0 ? { itemUnits: touchedUnits } : {}),
        }
      );

      if (touchedItems.length > 0) {
        const byId = new Map(touchedItems.map((item) => [item.id, item]));
        setItems((rows) => rows.map((item) => byId.get(item.id) ?? item));
      }
      if (touchedUnits.length > 0) {
        const byId = new Map(touchedUnits.map((unit) => [unit.id, unit]));
        setUnits((rows) => rows.map((unit) => byId.get(unit.id) ?? unit));
      }
    },
    [bookingOrThrow, buildPayment, itemMap, persistSettings, settings, units, writeBooking]
  );

  const closeBooking = useCallback(
    async (id: string) => {
      await writeBooking({ ...bookingOrThrow(id), status: "closed" });
    },
    [bookingOrThrow, writeBooking]
  );

  /** Cancelling frees the stock immediately — that is the whole point of it. */
  const cancelBooking = useCallback(
    async (id: string) => {
      const booking = bookingOrThrow(id);
      const touchedUnits = units
        .filter((unit) => unit.currentBookingId === id)
        .map((unit) => ({ ...unit, currentBookingId: null }));

      await writeBooking(
        { ...booking, status: "cancelled" },
        touchedUnits.length > 0 ? { itemUnits: touchedUnits } : {}
      );

      if (touchedUnits.length > 0) {
        const byId = new Map(touchedUnits.map((unit) => [unit.id, unit]));
        setUnits((rows) => rows.map((unit) => byId.get(unit.id) ?? unit));
      }
    },
    [bookingOrThrow, units, writeBooking]
  );

  const deleteBooking = useCallback(
    async (id: string) => {
      const booking = bookingOrThrow(id);
      if (booking.status === "dispatched") {
        throw new Error("Stock is still out on this booking. Record the return first.");
      }
      const touchedUnits = units
        .filter((unit) => unit.currentBookingId === id)
        .map((unit) => ({ ...unit, currentBookingId: null }));
      await rentalBatch(
        touchedUnits.length > 0 ? { itemUnits: touchedUnits } : {},
        { bookings: [id] }
      );
      setBookings((rows) => rows.filter((row) => row.id !== id));
      if (touchedUnits.length > 0) {
        const byId = new Map(touchedUnits.map((unit) => [unit.id, unit]));
        setUnits((rows) => rows.map((unit) => byId.get(unit.id) ?? unit));
      }
    },
    [bookingOrThrow, units]
  );

  /* ---------------------------------------------------------------------
   * Maintenance
   * ------------------------------------------------------------------ */

  const saveMaintenance = useCallback(
    async (input: MaintenanceInput, id?: string) => {
      const existing = id ? maintenanceLogs.find((row) => row.id === id) : undefined;
      const next: MaintenanceLog = existing
        ? { ...existing, ...input }
        : { ...input, id: generateId(), createdAt: nowIso() };
      await rentalBatch({ maintenanceLogs: [next] });
      setMaintenanceLogs((rows) => [...rows.filter((row) => row.id !== next.id), next]);
      return next;
    },
    [maintenanceLogs]
  );

  const deleteMaintenance = useCallback(async (id: string) => {
    await rentalBatch({}, { maintenanceLogs: [id] });
    setMaintenanceLogs((rows) => rows.filter((row) => row.id !== id));
  }, []);

  /* ---------------------------------------------------------------------
   * Data management
   * ------------------------------------------------------------------ */

  const clearAllData = useCallback(async () => {
    await rentalClearAll();
    setSettings(DEFAULT_SETTINGS);
    setCategories([]);
    setItems([]);
    setUnits([]);
    setCustomers([]);
    setBookings([]);
    setMaintenanceLogs([]);
    setStatus("welcome");
  }, []);

  const applyRestoredBackup = useCallback(
    async (backup: RentalBackup) => {
      await restoreBackup(backup);
      await load();
    },
    [load]
  );

  const syncToSheet = useCallback(async () => {
    const url = settings.sheetSyncUrl?.trim();
    if (!url || !isValidSyncUrl(url)) {
      throw new Error("Add a valid Google Apps Script URL in Settings first.");
    }
    const tabs = buildTabPayloads(
      { business, settings, categories, items, units, customers, bookings, maintenanceLogs },
      ALL_SYNC_SLICES
    );
    await pushToSheet(url, tabs);
    await persistSettings({ ...settings, lastSyncAt: nowIso() });
  }, [
    bookings,
    business,
    categories,
    customers,
    items,
    maintenanceLogs,
    persistSettings,
    settings,
    units,
  ]);

  const value = useMemo<RentalContextValue>(
    () => ({
      status,
      errorMessage,
      business,
      settings,
      categories,
      items,
      units,
      customers,
      bookings,
      maintenanceLogs,
      today,
      index,
      startSetup,
      backToWelcome,
      createBook,
      updateBusiness,
      updateSettings,
      saveCategory,
      deleteCategory,
      saveItem,
      deleteItem,
      addUnits,
      saveUnit,
      deleteUnit,
      saveCustomer,
      deleteCustomer,
      saveBooking,
      setBookingStatus,
      confirmBooking,
      dispatchBooking,
      returnBooking,
      closeBooking,
      cancelBooking,
      deleteBooking,
      recordPayment,
      saveMaintenance,
      deleteMaintenance,
      clearAllData,
      applyRestoredBackup,
      syncToSheet,
      reloadAll,
      itemById: (id: string) => itemMap.get(id),
      customerById: (id: string) => customers.find((row) => row.id === id),
      categoryById: (id: string) => categories.find((row) => row.id === id),
      bookingById: (id: string) => bookings.find((row) => row.id === id),
    }),
    [
      addUnits,
      applyRestoredBackup,
      backToWelcome,
      bookings,
      business,
      cancelBooking,
      categories,
      clearAllData,
      closeBooking,
      confirmBooking,
      createBook,
      customers,
      deleteBooking,
      deleteCategory,
      deleteCustomer,
      deleteItem,
      deleteMaintenance,
      deleteUnit,
      dispatchBooking,
      errorMessage,
      index,
      itemMap,
      items,
      maintenanceLogs,
      recordPayment,
      reloadAll,
      returnBooking,
      saveBooking,
      saveCategory,
      saveCustomer,
      saveItem,
      saveMaintenance,
      saveUnit,
      setBookingStatus,
      settings,
      startSetup,
      status,
      syncToSheet,
      today,
      units,
      updateBusiness,
      updateSettings,
    ]
  );

  return <RentalContext.Provider value={value}>{children}</RentalContext.Provider>;
}

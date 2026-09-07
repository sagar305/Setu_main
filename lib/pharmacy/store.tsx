"use client";

// Client-side store for the Free Pharmacy POS.
//
// Everything lives in one browser's IndexedDB: no login, no server, no sync
// beyond the Google Sheet push the owner sets up themselves. The provider owns
// every write, and every write that moves stock does three things together —
// changes the batch, records the document that moved it, and appends a movement
// log row — inside one transaction. A chemist's shelf and their records going
// out of step is the failure this app exists to prevent.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { dbGetAll } from "@/lib/pos/db";
import type { Business } from "@/lib/pos/types";
import {
  allocateNumber,
  pharmacyBatch,
  pharmacyClearAll,
  pharmacyDelete,
  pharmacyGetAll,
  pharmacyPut,
  type PharmacyStoreName,
} from "./db";
import {
  billTotals,
  effectiveRate as blendedRate,
  purchaseTotals,
  toSaleLines,
} from "./calc";
import { restoreBackup, type PharmacyBackup } from "./backup";
import { isValidSyncUrl, pushToSheet } from "./sheetSync";
import {
  DEFAULT_PHARMACY_SETTINGS,
  addDays,
  generateId,
  invoiceNumberFrom,
  needsPrescription,
  nowIso,
  returnNoteNumberFrom,
  round2,
  todayKey,
  type Batch,
  type Customer,
  type HeldPharmacyCart,
  type Medicine,
  type PharmacyCartLine,
  type PharmacySettings,
  type PrescriptionRef,
  type Purchase,
  type PurchaseLine,
  type PurchaseReturn,
  type PurchaseReturnReason,
  type RefillReminder,
  type Sale,
  type SaleReturn,
  type StockLog,
  type StockMovementType,
  type Supplier,
} from "./types";

export type AppStatus = "loading" | "welcome" | "setup" | "ready" | "error";

export type MedicineInput = Omit<Medicine, "id" | "createdAt" | "updatedAt">;
export type SupplierInput = Omit<Supplier, "id" | "createdAt">;
export type CustomerInput = Omit<Customer, "id" | "createdAt">;

export type PurchaseInput = {
  invoiceNo: string;
  supplierId: string;
  date: string;
  lines: PurchaseLine[];
  discount: number;
  paid: number;
};

export type SaleInput = {
  lines: PharmacyCartLine[];
  discount: number;
  paymentMode: string;
  /** What was actually collected; less than the total leaves a balance. */
  paid: number;
  customerId: string | null;
  prescription: PrescriptionRef | null;
};

export type SaleReturnInput = {
  saleId: string;
  date: string;
  reason: string;
  lines: { saleLineId: string; batchId: string; quantity: number; amount: number }[];
};

export type PurchaseReturnInput = {
  supplierId: string;
  date: string;
  reason: PurchaseReturnReason;
  lines: { batchId: string; quantity: number; rate: number }[];
};

type PharmacyContextValue = {
  status: AppStatus;
  errorMessage: string;
  business: Business | null;
  settings: PharmacySettings;
  medicines: Medicine[];
  batches: Batch[];
  suppliers: Supplier[];
  purchases: Purchase[];
  sales: Sale[];
  saleReturns: SaleReturn[];
  purchaseReturns: PurchaseReturn[];
  stockLogs: StockLog[];
  refillReminders: RefillReminder[];
  customers: Customer[];
  heldCarts: HeldPharmacyCart[];
  today: string;

  startSetup: () => void;
  backToWelcome: () => void;
  createShop: (
    profile: Omit<Business, "id" | "createdAt">,
    shop: { drugLicenceNo: string; gstin: string },
    firstMedicine: MedicineInput | null
  ) => Promise<void>;
  updateBusiness: (updates: Partial<Omit<Business, "id" | "createdAt">>) => Promise<void>;
  updateSettings: (updates: Partial<Omit<PharmacySettings, "id">>) => Promise<void>;

  saveMedicine: (input: MedicineInput, id?: string) => Promise<Medicine>;
  deleteMedicine: (id: string) => Promise<void>;
  importMedicines: (rows: MedicineInput[]) => Promise<number>;

  saveSupplier: (input: SupplierInput, id?: string) => Promise<Supplier>;
  deleteSupplier: (id: string) => Promise<void>;

  saveCustomer: (input: CustomerInput, id?: string) => Promise<Customer>;
  deleteCustomer: (id: string) => Promise<void>;

  savePurchase: (input: PurchaseInput) => Promise<Purchase>;
  updatePurchasePaid: (id: string, paid: number) => Promise<void>;
  deletePurchase: (id: string) => Promise<void>;

  /** Correct a batch's quantity by hand — a count, a breakage, a data fix. */
  adjustBatch: (batchId: string, newQuantity: number, note: string) => Promise<void>;
  updateBatch: (batchId: string, updates: Partial<Batch>) => Promise<void>;

  completeSale: (input: SaleInput) => Promise<Sale>;
  recordSalePayment: (saleId: string, amount: number) => Promise<void>;
  saveSaleReturn: (input: SaleReturnInput) => Promise<SaleReturn>;
  savePurchaseReturn: (input: PurchaseReturnInput) => Promise<PurchaseReturn>;

  holdCart: (label: string, lines: PharmacyCartLine[], discount: number, customerId: string | null) => Promise<void>;
  removeHeldCart: (id: string) => Promise<void>;

  dismissReminder: (id: string) => Promise<void>;
  snoozeReminder: (id: string, days: number) => Promise<void>;

  clearAllData: () => Promise<void>;
  applyRestoredBackup: (backup: PharmacyBackup) => Promise<void>;
  syncToSheet: () => Promise<void>;
  reloadAll: () => Promise<void>;

  medicineById: (id: string) => Medicine | undefined;
  batchById: (id: string) => Batch | undefined;
  supplierById: (id: string) => Supplier | undefined;
  customerById: (id: string) => Customer | undefined;
  saleById: (id: string) => Sale | undefined;
};

const PharmacyContext = createContext<PharmacyContextValue | null>(null);

export function usePharmacy(): PharmacyContextValue {
  const context = useContext(PharmacyContext);
  if (!context) throw new Error("usePharmacy must be used inside a PharmacyProvider.");
  return context;
}

/** A movement log row. Every stock change in the app goes through this. */
function movement(
  batch: Batch,
  medicineName: string,
  type: StockMovementType,
  change: number,
  quantityAfter: number,
  referenceId: string,
  note = ""
): StockLog {
  return {
    id: generateId(),
    batchId: batch.id,
    medicineId: batch.medicineId,
    medicineName,
    batchNo: batch.batchNo,
    expiry: batch.expiry,
    type,
    change,
    quantityAfter,
    referenceId,
    note,
    createdAt: nowIso(),
  };
}

export function PharmacyProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AppStatus>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [business, setBusiness] = useState<Business | null>(null);
  const [settings, setSettings] = useState<PharmacySettings>(DEFAULT_PHARMACY_SETTINGS);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [saleReturns, setSaleReturns] = useState<SaleReturn[]>([]);
  const [purchaseReturns, setPurchaseReturns] = useState<PurchaseReturn[]>([]);
  const [stockLogs, setStockLogs] = useState<StockLog[]>([]);
  const [refillReminders, setRefillReminders] = useState<RefillReminder[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [heldCarts, setHeldCarts] = useState<HeldPharmacyCart[]>([]);
  const [today, setToday] = useState<string>(() => todayKey());

  const medicineMap = useMemo(
    () => new Map(medicines.map((medicine) => [medicine.id, medicine])),
    [medicines]
  );
  const batchMap = useMemo(() => new Map(batches.map((batch) => [batch.id, batch])), [batches]);

  /* ---------------------------------------------------------------------
   * Loading
   * ------------------------------------------------------------------ */

  const readAll = useCallback(async () => {
    const [
      storedSettings,
      storedMedicines,
      storedBatches,
      storedSuppliers,
      storedPurchases,
      storedSales,
      storedSaleReturns,
      storedPurchaseReturns,
      storedLogs,
      storedReminders,
      storedCustomers,
      storedHeld,
    ] = await Promise.all([
      pharmacyGetAll<PharmacySettings>("pharmacySettings"),
      pharmacyGetAll<Medicine>("medicines"),
      pharmacyGetAll<Batch>("batches"),
      pharmacyGetAll<Supplier>("suppliers"),
      pharmacyGetAll<Purchase>("purchases"),
      pharmacyGetAll<Sale>("sales"),
      pharmacyGetAll<SaleReturn>("saleReturns"),
      pharmacyGetAll<PurchaseReturn>("purchaseReturns"),
      pharmacyGetAll<StockLog>("stockLogs"),
      pharmacyGetAll<RefillReminder>("refillReminders"),
      pharmacyGetAll<Customer>("customers"),
      pharmacyGetAll<HeldPharmacyCart>("heldCarts"),
    ]);

    setSettings({
      ...DEFAULT_PHARMACY_SETTINGS,
      ...(storedSettings.find((row) => row.id === "main") ?? {}),
    });
    setMedicines(storedMedicines.sort((a, b) => a.name.localeCompare(b.name)));
    setBatches(storedBatches);
    setSuppliers(storedSuppliers.sort((a, b) => a.name.localeCompare(b.name)));
    setPurchases(storedPurchases.sort((a, b) => b.date.localeCompare(a.date)));
    setSales(storedSales.sort((a, b) => b.date.localeCompare(a.date)));
    setSaleReturns(storedSaleReturns.sort((a, b) => b.date.localeCompare(a.date)));
    setPurchaseReturns(storedPurchaseReturns.sort((a, b) => b.date.localeCompare(a.date)));
    // Newest first, and capped: a busy counter writes thousands of these, and
    // nothing in the UI reads past the recent tail.
    setStockLogs(
      storedLogs.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 2000)
    );
    setRefillReminders(storedReminders);
    setCustomers(storedCustomers.sort((a, b) => a.name.localeCompare(b.name)));
    setHeldCarts(storedHeld.sort((a, b) => a.createdAt.localeCompare(b.createdAt)));

    return storedMedicines;
  }, []);

  const load = useCallback(async () => {
    try {
      const [storedMedicines, workspace] = await Promise.all([
        readAll(),
        dbGetAll<Business>("business"),
      ]);
      setToday(todayKey());
      setBusiness(workspace.find((row) => row.id === "main") ?? null);
      // A pharmacy exists once it has a medicine on its master. A workspace
      // alone is not enough — someone who used the GST calculator last month
      // has a business record and no shelf.
      setStatus(storedMedicines.length > 0 ? "ready" : "welcome");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not open the pharmacy database."
      );
      setStatus("error");
    }
  }, [readAll]);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * Roll the day over under a tab left open overnight.
   *
   * Expiry buckets and refill due-dates are read off `today`; a counter machine
   * left on since Friday would still be bucketing against Friday on Monday, and
   * quietly under-reporting what has expired over the weekend.
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
    await readAll();
  }, [readAll]);

  /* ---------------------------------------------------------------------
   * Setup and settings
   * ------------------------------------------------------------------ */

  const startSetup = useCallback(() => setStatus("setup"), []);
  const backToWelcome = useCallback(() => setStatus("welcome"), []);

  const persistSettings = useCallback(async (next: PharmacySettings) => {
    setSettings(next);
    await pharmacyPut("pharmacySettings", next);
  }, []);

  const updateSettings = useCallback(
    async (updates: Partial<Omit<PharmacySettings, "id">>) => {
      const next = { ...settings, ...updates, id: "main" as const };
      await persistSettings(next);
    },
    [persistSettings, settings]
  );

  const updateBusiness = useCallback(
    async (updates: Partial<Omit<Business, "id" | "createdAt">>) => {
      const current = business ?? {
        id: "main" as const,
        name: "",
        phone: "",
        address: "",
        currency: "INR",
        email: "",
        taxNumber: "",
        logoDataUrl: "",
        createdAt: nowIso(),
      };
      const next: Business = { ...current, ...updates, id: "main", createdAt: current.createdAt };
      setBusiness(next);
      const { dbPut } = await import("@/lib/pos/db");
      await dbPut("business", next);
    },
    [business]
  );

  const createShop = useCallback(
    async (
      profile: Omit<Business, "id" | "createdAt">,
      shop: { drugLicenceNo: string; gstin: string },
      firstMedicine: MedicineInput | null
    ) => {
      const record: Business = { ...profile, id: "main", createdAt: nowIso() };
      const { dbPut } = await import("@/lib/pos/db");
      await dbPut("business", record);

      const nextSettings: PharmacySettings = {
        ...DEFAULT_PHARMACY_SETTINGS,
        drugLicenceNo: shop.drugLicenceNo,
        gstin: shop.gstin,
      };
      await pharmacyPut("pharmacySettings", nextSettings);

      const created: Medicine[] = [];
      if (firstMedicine) {
        created.push({
          ...firstMedicine,
          id: generateId(),
          createdAt: nowIso(),
          updatedAt: nowIso(),
        });
        await pharmacyBatch({ medicines: created });
      }

      setBusiness(record);
      setSettings(nextSettings);
      setMedicines(created);
      setStatus(created.length > 0 ? "ready" : "welcome");
    },
    []
  );

  /* ---------------------------------------------------------------------
   * Masters
   * ------------------------------------------------------------------ */

  const saveMedicine = useCallback(
    async (input: MedicineInput, id?: string) => {
      const existing = id ? medicines.find((medicine) => medicine.id === id) : undefined;
      const record: Medicine = {
        ...input,
        id: existing?.id ?? generateId(),
        createdAt: existing?.createdAt ?? nowIso(),
        updatedAt: nowIso(),
      };
      await pharmacyPut("medicines", record);
      setMedicines((previous) => {
        const next = existing
          ? previous.map((medicine) => (medicine.id === record.id ? record : medicine))
          : [...previous, record];
        return next.sort((a, b) => a.name.localeCompare(b.name));
      });
      if (status === "welcome") setStatus("ready");
      return record;
    },
    [medicines, status]
  );

  /**
   * Deleting a medicine takes its batches with it.
   *
   * Leaving them would strand stock against a name that no longer exists —
   * counted in the stock value, invisible on every screen. The movement log
   * rows stay: they carry their own copy of the name, and a ledger that erases
   * itself is not a ledger.
   */
  const deleteMedicine = useCallback(
    async (id: string) => {
      const doomed = batches.filter((batch) => batch.medicineId === id).map((batch) => batch.id);
      await pharmacyBatch({}, { medicines: [id], batches: doomed });
      setMedicines((previous) => previous.filter((medicine) => medicine.id !== id));
      setBatches((previous) => previous.filter((batch) => batch.medicineId !== id));
    },
    [batches]
  );

  /**
   * Bulk import from a CSV.
   *
   * Matched on barcode first, then on name plus strength — a master list
   * imported twice should update the shop's medicines, not double them.
   */
  const importMedicines = useCallback(
    async (rows: MedicineInput[]) => {
      const byBarcode = new Map(
        medicines.filter((medicine) => medicine.barcode).map((m) => [m.barcode, m])
      );
      const byName = new Map(
        medicines.map((m) => [`${m.name.toLowerCase()}|${m.strength.toLowerCase()}`, m])
      );

      const written: Medicine[] = [];
      for (const row of rows) {
        const existing =
          (row.barcode ? byBarcode.get(row.barcode) : undefined) ??
          byName.get(`${row.name.toLowerCase()}|${row.strength.toLowerCase()}`);
        written.push({
          ...row,
          id: existing?.id ?? generateId(),
          createdAt: existing?.createdAt ?? nowIso(),
          updatedAt: nowIso(),
        });
      }
      if (written.length === 0) return 0;

      await pharmacyBatch({ medicines: written });
      setMedicines((previous) => {
        const merged = new Map(previous.map((medicine) => [medicine.id, medicine]));
        for (const medicine of written) merged.set(medicine.id, medicine);
        return [...merged.values()].sort((a, b) => a.name.localeCompare(b.name));
      });
      if (status === "welcome") setStatus("ready");
      return written.length;
    },
    [medicines, status]
  );

  const saveSupplier = useCallback(
    async (input: SupplierInput, id?: string) => {
      const existing = id ? suppliers.find((supplier) => supplier.id === id) : undefined;
      const record: Supplier = {
        ...input,
        id: existing?.id ?? generateId(),
        createdAt: existing?.createdAt ?? nowIso(),
      };
      await pharmacyPut("suppliers", record);
      setSuppliers((previous) =>
        (existing
          ? previous.map((supplier) => (supplier.id === record.id ? record : supplier))
          : [...previous, record]
        ).sort((a, b) => a.name.localeCompare(b.name))
      );
      return record;
    },
    [suppliers]
  );

  const deleteSupplier = useCallback(async (id: string) => {
    await pharmacyDelete("suppliers", id);
    setSuppliers((previous) => previous.filter((supplier) => supplier.id !== id));
  }, []);

  const saveCustomer = useCallback(
    async (input: CustomerInput, id?: string) => {
      const existing = id ? customers.find((customer) => customer.id === id) : undefined;
      const record: Customer = {
        ...input,
        id: existing?.id ?? generateId(),
        createdAt: existing?.createdAt ?? nowIso(),
      };
      await pharmacyPut("customers", record);
      setCustomers((previous) =>
        (existing
          ? previous.map((customer) => (customer.id === record.id ? record : customer))
          : [...previous, record]
        ).sort((a, b) => a.name.localeCompare(b.name))
      );
      return record;
    },
    [customers]
  );

  const deleteCustomer = useCallback(async (id: string) => {
    await pharmacyDelete("customers", id);
    setCustomers((previous) => previous.filter((customer) => customer.id !== id));
  }, []);

  /* ---------------------------------------------------------------------
   * Purchases — where stock comes from
   * ------------------------------------------------------------------ */

  /**
   * Save a distributor invoice, creating or topping up a batch per line.
   *
   * A batch is identified by medicine + batch number + expiry: the same lot
   * arriving on a second invoice is the same physical stock on the shelf and
   * must not become a second row, or FEFO would offer the counter a choice
   * between two halves of one box.
   *
   * On a top-up the rates from the newer invoice win, except the blended cost,
   * which is averaged over old and new units. Overwriting that outright would
   * re-price stock bought last month at this month's rate and quietly move the
   * margin on it.
   */
  const savePurchase = useCallback(
    async (input: PurchaseInput) => {
      const totals = purchaseTotals(input.lines, input.discount);
      const purchase: Purchase = {
        id: generateId(),
        invoiceNo: input.invoiceNo,
        supplierId: input.supplierId,
        date: input.date,
        lines: input.lines,
        discount: totals.discount,
        taxTotal: totals.taxTotal,
        total: totals.total,
        paid: round2(input.paid),
        createdAt: nowIso(),
      };

      const touched = new Map<string, Batch>();
      const logs: StockLog[] = [];

      for (const line of input.lines) {
        const units = (line.quantity || 0) + (line.freeQuantity || 0);
        if (units <= 0) continue;
        const medicine = medicineMap.get(line.medicineId);
        const key = `${line.medicineId}|${line.batchNo.trim().toLowerCase()}|${line.expiry}`;
        const existing =
          [...touched.values()].find(
            (batch) =>
              `${batch.medicineId}|${batch.batchNo.trim().toLowerCase()}|${batch.expiry}` === key
          ) ??
          batches.find(
            (batch) =>
              `${batch.medicineId}|${batch.batchNo.trim().toLowerCase()}|${batch.expiry}` === key
          );

        const lineRate = blendedRate(line);
        let batch: Batch;
        if (existing) {
          const priorUnits = Math.max(0, existing.quantity);
          const blended =
            priorUnits + units > 0
              ? round2((existing.effectiveRate * priorUnits + lineRate * units) / (priorUnits + units))
              : lineRate;
          batch = {
            ...existing,
            mrp: line.mrp,
            purchaseRate: line.purchaseRate,
            sellingRate: line.sellingRate,
            effectiveRate: blended,
            quantity: existing.quantity + units,
            supplierId: input.supplierId || existing.supplierId,
            purchaseId: purchase.id,
            updatedAt: nowIso(),
          };
        } else {
          batch = {
            id: generateId(),
            medicineId: line.medicineId,
            batchNo: line.batchNo,
            expiry: line.expiry,
            mrp: line.mrp,
            purchaseRate: line.purchaseRate,
            effectiveRate: lineRate,
            sellingRate: line.sellingRate,
            quantity: units,
            supplierId: input.supplierId || null,
            purchaseId: purchase.id,
            createdAt: nowIso(),
            updatedAt: nowIso(),
          };
        }
        touched.set(batch.id, batch);
        logs.push(
          movement(
            batch,
            medicine?.name ?? "",
            "purchase",
            units,
            batch.quantity,
            purchase.id,
            line.freeQuantity > 0 ? `${line.quantity}+${line.freeQuantity} scheme` : ""
          )
        );
      }

      const updatedBatches = [...touched.values()];
      await pharmacyBatch({
        purchases: [purchase],
        batches: updatedBatches,
        stockLogs: logs,
      });

      setPurchases((previous) => [purchase, ...previous]);
      setBatches((previous) => {
        const merged = new Map(previous.map((batch) => [batch.id, batch]));
        for (const batch of updatedBatches) merged.set(batch.id, batch);
        return [...merged.values()];
      });
      setStockLogs((previous) => [...logs, ...previous]);
      return purchase;
    },
    [batches, medicineMap]
  );

  const updatePurchasePaid = useCallback(
    async (id: string, paid: number) => {
      const purchase = purchases.find((row) => row.id === id);
      if (!purchase) return;
      const next = { ...purchase, paid: round2(Math.max(0, paid)) };
      await pharmacyPut("purchases", next);
      setPurchases((previous) => previous.map((row) => (row.id === id ? next : row)));
    },
    [purchases]
  );

  /**
   * Delete a purchase and take its units back off the shelf.
   *
   * Clamped at zero, because some of that stock has almost certainly been sold
   * by now. The log row records what was actually reversed rather than what the
   * invoice said, so the ledger stays arithmetically true even when the deletion
   * is a correction made days late.
   */
  const deletePurchase = useCallback(
    async (id: string) => {
      const purchase = purchases.find((row) => row.id === id);
      if (!purchase) return;

      const touched = new Map<string, Batch>();
      const logs: StockLog[] = [];
      for (const line of purchase.lines) {
        const units = (line.quantity || 0) + (line.freeQuantity || 0);
        if (units <= 0) continue;
        const key = `${line.medicineId}|${line.batchNo.trim().toLowerCase()}|${line.expiry}`;
        const current =
          touched.get(
            [...touched.values()].find(
              (b) => `${b.medicineId}|${b.batchNo.trim().toLowerCase()}|${b.expiry}` === key
            )?.id ?? ""
          ) ??
          batches.find(
            (b) => `${b.medicineId}|${b.batchNo.trim().toLowerCase()}|${b.expiry}` === key
          );
        if (!current) continue;
        const removed = Math.min(current.quantity, units);
        const next = {
          ...current,
          quantity: current.quantity - removed,
          updatedAt: nowIso(),
        };
        touched.set(next.id, next);
        logs.push(
          movement(
            next,
            medicineMap.get(line.medicineId)?.name ?? "",
            "adjust",
            -removed,
            next.quantity,
            purchase.id,
            `Purchase ${purchase.invoiceNo} deleted`
          )
        );
      }

      const updatedBatches = [...touched.values()];
      await pharmacyBatch({ batches: updatedBatches, stockLogs: logs }, { purchases: [id] });
      setPurchases((previous) => previous.filter((row) => row.id !== id));
      setBatches((previous) =>
        previous.map((batch) => touched.get(batch.id) ?? batch)
      );
      setStockLogs((previous) => [...logs, ...previous]);
    },
    [batches, medicineMap, purchases]
  );

  /* ---------------------------------------------------------------------
   * Batch corrections
   * ------------------------------------------------------------------ */

  const adjustBatch = useCallback(
    async (batchId: string, newQuantity: number, note: string) => {
      const batch = batchMap.get(batchId);
      if (!batch) return;
      const target = Math.max(0, Math.floor(newQuantity));
      const change = target - batch.quantity;
      if (change === 0) return;
      const next = { ...batch, quantity: target, updatedAt: nowIso() };
      const log = movement(
        next,
        medicineMap.get(batch.medicineId)?.name ?? "",
        "adjust",
        change,
        target,
        "",
        note
      );
      await pharmacyBatch({ batches: [next], stockLogs: [log] });
      setBatches((previous) => previous.map((row) => (row.id === batchId ? next : row)));
      setStockLogs((previous) => [log, ...previous]);
    },
    [batchMap, medicineMap]
  );

  /** Edit a batch's rates or expiry. Quantity only moves through adjustBatch. */
  const updateBatch = useCallback(
    async (batchId: string, updates: Partial<Batch>) => {
      const batch = batchMap.get(batchId);
      if (!batch) return;
      const { quantity: _ignored, ...safe } = updates;
      const next = { ...batch, ...safe, id: batch.id, updatedAt: nowIso() };
      await pharmacyPut("batches", next);
      setBatches((previous) => previous.map((row) => (row.id === batchId ? next : row)));
    },
    [batchMap]
  );

  /* ---------------------------------------------------------------------
   * Selling
   * ------------------------------------------------------------------ */

  /**
   * Complete a bill.
   *
   * The prescription rule is enforced here and nowhere earlier, deliberately: a
   * counter with three people waiting should not be interrupted the moment a
   * Schedule H strip is scanned, only stopped before the bill is closed.
   */
  const completeSale = useCallback(
    async (input: SaleInput) => {
      if (input.lines.length === 0) throw new Error("Add at least one medicine to the bill.");

      const needsRx = input.lines.some((line) =>
        needsPrescription(line.schedule, settings.prescriptionRequiredFor)
      );
      if (needsRx) {
        const rx = input.prescription;
        if (!rx?.doctorName.trim() || !rx?.doctorRegNo.trim() || !rx?.patientName.trim()) {
          throw new Error(
            "This bill has a scheduled medicine. Doctor name, registration number and patient name are required."
          );
        }
      }

      const totals = billTotals(input.lines, input.discount, settings.taxInclusive);
      const saleId = generateId();
      const date = todayKey();

      // Draw the stock down batch by batch. The cart already allocated across
      // batches, so a line never asks a batch for more than it holds — but the
      // clamp stays, because a tab left open while another counter sold the same
      // strip is a real way to arrive here short.
      const touched = new Map<string, Batch>();
      const logs: StockLog[] = [];
      for (const line of input.lines) {
        const batch = touched.get(line.batchId) ?? batchMap.get(line.batchId);
        if (!batch) continue;
        const taken = Math.min(batch.quantity, line.quantity);
        const next = { ...batch, quantity: batch.quantity - taken, updatedAt: nowIso() };
        touched.set(next.id, next);
        logs.push(
          movement(next, line.name, "sale", -taken, next.quantity, saleId)
        );
      }

      const reminders: RefillReminder[] = [];
      if (input.customerId) {
        for (const line of input.lines) {
          if (!line.daysSupply || line.daysSupply <= 0) continue;
          const existing = refillReminders.find(
            (reminder) =>
              reminder.customerId === input.customerId && reminder.medicineId === line.medicineId
          );
          reminders.push({
            id: existing?.id ?? generateId(),
            customerId: input.customerId,
            medicineId: line.medicineId,
            daysSupply: line.daysSupply,
            lastSaleId: saleId,
            // Three days early, so the reminder lands before the patient runs
            // out rather than after.
            nextDueOn: addDays(date, Math.max(1, line.daysSupply - 3)),
            active: true,
            createdAt: existing?.createdAt ?? nowIso(),
          });
        }
      }

      const updatedBatches = [...touched.values()];
      let sale!: Sale;

      const allocated = await allocateNumber(
        "nextInvoiceNumber",
        ["sales", "batches", "stockLogs", "refillReminders"],
        (next) => {
          sale = {
            id: saleId,
            invoiceNo: invoiceNumberFrom(settings.invoicePrefix, next),
            date,
            customerId: input.customerId,
            lines: toSaleLines(input.lines),
            discount: totals.discount,
            taxTotal: totals.taxTotal,
            total: totals.total,
            paid: round2(Math.min(Math.max(input.paid, 0), totals.total)),
            paymentMode: input.paymentMode,
            prescription: input.prescription,
            createdAt: nowIso(),
          };
          return {
            writes: {
              sales: [sale],
              batches: updatedBatches,
              stockLogs: logs,
              refillReminders: reminders,
            },
          };
        }
      );

      setSettings((previous) => ({ ...previous, nextInvoiceNumber: allocated + 1 }));
      setSales((previous) => [sale, ...previous]);
      setBatches((previous) => previous.map((batch) => touched.get(batch.id) ?? batch));
      setStockLogs((previous) => [...logs, ...previous]);
      if (reminders.length > 0) {
        setRefillReminders((previous) => {
          const merged = new Map(previous.map((reminder) => [reminder.id, reminder]));
          for (const reminder of reminders) merged.set(reminder.id, reminder);
          return [...merged.values()];
        });
      }
      return sale;
    },
    [batchMap, refillReminders, settings]
  );

  const recordSalePayment = useCallback(
    async (saleId: string, amount: number) => {
      const sale = sales.find((row) => row.id === saleId);
      if (!sale) return;
      const next = {
        ...sale,
        paid: round2(Math.min(sale.total, (sale.paid || 0) + Math.max(0, amount))),
      };
      await pharmacyPut("sales", next);
      setSales((previous) => previous.map((row) => (row.id === saleId ? next : row)));
    },
    [sales]
  );

  /**
   * Take stock back from a customer.
   *
   * It goes back to the batch it left on, which is why the sale line carries a
   * batch id at all. If that batch has since expired the stock still returns to
   * it — it is physically on the shelf and has to be counted — and the expiry
   * dashboard will pick it up as something to send back to the distributor.
   */
  const saveSaleReturn = useCallback(
    async (input: SaleReturnInput) => {
      const sale = sales.find((row) => row.id === input.saleId);
      if (!sale) throw new Error("That bill could not be found.");
      const lines = input.lines.filter((line) => line.quantity > 0);
      if (lines.length === 0) throw new Error("Nothing to return.");

      const record: SaleReturn = {
        id: generateId(),
        saleId: sale.id,
        saleInvoiceNo: sale.invoiceNo,
        date: input.date || todayKey(),
        lines,
        reason: input.reason,
        total: round2(lines.reduce((sum, line) => sum + line.amount, 0)),
        createdAt: nowIso(),
      };

      const touched = new Map<string, Batch>();
      const logs: StockLog[] = [];
      for (const line of lines) {
        const batch = touched.get(line.batchId) ?? batchMap.get(line.batchId);
        if (!batch) continue;
        const next = { ...batch, quantity: batch.quantity + line.quantity, updatedAt: nowIso() };
        touched.set(next.id, next);
        logs.push(
          movement(
            next,
            medicineMap.get(next.medicineId)?.name ?? "",
            "sale-return",
            line.quantity,
            next.quantity,
            record.id,
            input.reason
          )
        );
      }

      const updatedBatches = [...touched.values()];
      await pharmacyBatch({
        saleReturns: [record],
        batches: updatedBatches,
        stockLogs: logs,
      });

      setSaleReturns((previous) => [record, ...previous]);
      setBatches((previous) => previous.map((batch) => touched.get(batch.id) ?? batch));
      setStockLogs((previous) => [...logs, ...previous]);
      return record;
    },
    [batchMap, medicineMap, sales]
  );

  /** Send expired or damaged stock back to the distributor. */
  const savePurchaseReturn = useCallback(
    async (input: PurchaseReturnInput) => {
      const lines = input.lines
        .filter((line) => line.quantity > 0)
        .map((line) => ({
          batchId: line.batchId,
          quantity: line.quantity,
          rate: line.rate,
          amount: round2(line.quantity * line.rate),
        }));
      if (lines.length === 0) throw new Error("Pick at least one batch to return.");

      const returnId = generateId();
      const touched = new Map<string, Batch>();
      const logs: StockLog[] = [];
      for (const line of lines) {
        const batch = touched.get(line.batchId) ?? batchMap.get(line.batchId);
        if (!batch) continue;
        const taken = Math.min(batch.quantity, line.quantity);
        const next = { ...batch, quantity: batch.quantity - taken, updatedAt: nowIso() };
        touched.set(next.id, next);
        logs.push(
          movement(
            next,
            medicineMap.get(next.medicineId)?.name ?? "",
            "purchase-return",
            -taken,
            next.quantity,
            returnId,
            input.reason
          )
        );
      }

      const updatedBatches = [...touched.values()];
      let record!: PurchaseReturn;
      const allocated = await allocateNumber(
        "nextReturnNoteNumber",
        ["purchaseReturns", "batches", "stockLogs"],
        (next) => {
          record = {
            id: returnId,
            noteNo: returnNoteNumberFrom(settings.returnNotePrefix, next),
            supplierId: input.supplierId,
            date: input.date || todayKey(),
            lines,
            reason: input.reason,
            total: round2(lines.reduce((sum, line) => sum + line.amount, 0)),
            createdAt: nowIso(),
          };
          return {
            writes: {
              purchaseReturns: [record],
              batches: updatedBatches,
              stockLogs: logs,
            },
          };
        }
      );

      setSettings((previous) => ({ ...previous, nextReturnNoteNumber: allocated + 1 }));
      setPurchaseReturns((previous) => [record, ...previous]);
      setBatches((previous) => previous.map((batch) => touched.get(batch.id) ?? batch));
      setStockLogs((previous) => [...logs, ...previous]);
      return record;
    },
    [batchMap, medicineMap, settings.returnNotePrefix]
  );

  /* ---------------------------------------------------------------------
   * Held bills and reminders
   * ------------------------------------------------------------------ */

  const holdCart = useCallback(
    async (
      label: string,
      lines: PharmacyCartLine[],
      discount: number,
      customerId: string | null
    ) => {
      const held: HeldPharmacyCart = {
        id: generateId(),
        label: label.trim() || `Bill ${heldCarts.length + 1}`,
        lines,
        discount,
        customerId,
        createdAt: nowIso(),
      };
      await pharmacyPut("heldCarts", held);
      setHeldCarts((previous) => [...previous, held]);
    },
    [heldCarts.length]
  );

  const removeHeldCart = useCallback(async (id: string) => {
    await pharmacyDelete("heldCarts", id);
    setHeldCarts((previous) => previous.filter((cart) => cart.id !== id));
  }, []);

  const dismissReminder = useCallback(
    async (id: string) => {
      const reminder = refillReminders.find((row) => row.id === id);
      if (!reminder) return;
      const next = { ...reminder, active: false };
      await pharmacyPut("refillReminders", next);
      setRefillReminders((previous) => previous.map((row) => (row.id === id ? next : row)));
    },
    [refillReminders]
  );

  const snoozeReminder = useCallback(
    async (id: string, days: number) => {
      const reminder = refillReminders.find((row) => row.id === id);
      if (!reminder) return;
      const next = { ...reminder, nextDueOn: addDays(todayKey(), Math.max(1, days)) };
      await pharmacyPut("refillReminders", next);
      setRefillReminders((previous) => previous.map((row) => (row.id === id ? next : row)));
    },
    [refillReminders]
  );

  /* ---------------------------------------------------------------------
   * Data management
   * ------------------------------------------------------------------ */

  const clearAllData = useCallback(async () => {
    await pharmacyClearAll();
    setSettings(DEFAULT_PHARMACY_SETTINGS);
    setMedicines([]);
    setBatches([]);
    setSuppliers([]);
    setPurchases([]);
    setSales([]);
    setSaleReturns([]);
    setPurchaseReturns([]);
    setStockLogs([]);
    setRefillReminders([]);
    setCustomers([]);
    setHeldCarts([]);
    setStatus("welcome");
  }, []);

  const applyRestoredBackup = useCallback(
    async (backup: PharmacyBackup) => {
      await restoreBackup(backup);
      await load();
    },
    [load]
  );

  const syncToSheet = useCallback(async () => {
    if (!isValidSyncUrl(settings.sheetSyncUrl)) {
      throw new Error("Add a Google Apps Script web-app URL in Settings first.");
    }
    await pushToSheet(settings.sheetSyncUrl, {
      business,
      settings,
      medicines,
      batches,
      suppliers,
      purchases,
      sales,
      saleReturns,
      purchaseReturns,
      customers,
    });
    const next = { ...settings, lastSyncAt: nowIso() };
    await persistSettings(next);
  }, [
    batches,
    business,
    customers,
    medicines,
    persistSettings,
    purchaseReturns,
    purchases,
    saleReturns,
    sales,
    settings,
    suppliers,
  ]);

  const medicineById = useCallback((id: string) => medicineMap.get(id), [medicineMap]);
  const batchById = useCallback((id: string) => batchMap.get(id), [batchMap]);
  const supplierById = useCallback(
    (id: string) => suppliers.find((supplier) => supplier.id === id),
    [suppliers]
  );
  const customerById = useCallback(
    (id: string) => customers.find((customer) => customer.id === id),
    [customers]
  );
  const saleById = useCallback((id: string) => sales.find((sale) => sale.id === id), [sales]);

  const value = useMemo<PharmacyContextValue>(
    () => ({
      status,
      errorMessage,
      business,
      settings,
      medicines,
      batches,
      suppliers,
      purchases,
      sales,
      saleReturns,
      purchaseReturns,
      stockLogs,
      refillReminders,
      customers,
      heldCarts,
      today,
      startSetup,
      backToWelcome,
      createShop,
      updateBusiness,
      updateSettings,
      saveMedicine,
      deleteMedicine,
      importMedicines,
      saveSupplier,
      deleteSupplier,
      saveCustomer,
      deleteCustomer,
      savePurchase,
      updatePurchasePaid,
      deletePurchase,
      adjustBatch,
      updateBatch,
      completeSale,
      recordSalePayment,
      saveSaleReturn,
      savePurchaseReturn,
      holdCart,
      removeHeldCart,
      dismissReminder,
      snoozeReminder,
      clearAllData,
      applyRestoredBackup,
      syncToSheet,
      reloadAll,
      medicineById,
      batchById,
      supplierById,
      customerById,
      saleById,
    }),
    [
      adjustBatch,
      applyRestoredBackup,
      backToWelcome,
      batchById,
      batchMap,
      batches,
      business,
      clearAllData,
      completeSale,
      createShop,
      customerById,
      customers,
      deleteCustomer,
      deleteMedicine,
      deletePurchase,
      deleteSupplier,
      dismissReminder,
      errorMessage,
      heldCarts,
      holdCart,
      importMedicines,
      medicineById,
      medicineMap,
      medicines,
      purchaseReturns,
      purchases,
      recordSalePayment,
      refillReminders,
      reloadAll,
      removeHeldCart,
      saleReturns,
      sales,
      saveCustomer,
      saveMedicine,
      savePurchase,
      savePurchaseReturn,
      saveSaleReturn,
      saveSupplier,
      settings,
      snoozeReminder,
      startSetup,
      status,
      stockLogs,
      suppliers,
      supplierById,
      syncToSheet,
      today,
      updateBatch,
      updateBusiness,
      updatePurchasePaid,
      updateSettings,
      saleById,
    ]
  );

  return <PharmacyContext.Provider value={value}>{children}</PharmacyContext.Provider>;
}

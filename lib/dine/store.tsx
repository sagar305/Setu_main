"use client";

// State for Free Dine.
//
// The shape follows lib/pos/store.tsx — one provider holding every store in
// memory, writing through to IndexedDB in atomic batches — because the data set
// is a single outlet's and fits comfortably, and because every screen needs to
// react to the same ticket changing.
//
// What differs from the retail POS is the open ticket. A retail cart exists for
// thirty seconds inside one component; a restaurant ticket lives for an hour,
// is edited in rounds, is fired to the kitchen a round at a time, and must
// survive the tab being closed (FR-4.7). So there is no in-memory cart here at
// all: a ticket is a database record from the moment the table is tapped, and
// every mutation is a write.

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

import {
  DINE_STORES,
  dineAllocate,
  dineApplyStock,
  dineBatch,
  dineClearAll,
  dineGetAll,
  type DineStoreName,
} from "./db";
import {
  consumptionForTicketItem,
  indexRecipes,
  mergeConsumption,
  recipeCost,
  type Consumption,
  type RecipeIndex,
} from "./recipe";
import { blendCost, costPerUnitFrom, toQty, type BaseUnit } from "./units";
import { formatSlot } from "./reservation";
import { createDineBroadcast, type DineBroadcast } from "./sync";
import {
  buildBackupFromDineSheetPull,
  buildDineTabPayloads,
  isValidSyncUrl,
  pullFromDineSheet,
  pushToDineSheet,
  testDineSheetConnection,
  type DineWorkspaceSnapshot,
} from "./sheetSync";
import { dbPut as workspacePut } from "@/lib/pos/db";
import type { Customer as WorkspaceCustomer } from "@/lib/pos/types";
import {
  deleteLedgerEntry,
  getCustomers as getWorkspaceCustomers,
  getLedgerEntries,
  saveLedgerEntry,
} from "@/lib/toolkit/workspace";
import type { LedgerEntry } from "@/lib/toolkit/types";
import { billLedgerEntry, depositLedgerEntry } from "./credit";
import {
  createDineBackup,
  downloadDineBackup,
  restoreDineBackup,
  type DineBackup,
} from "./backup";
import { computeTicketTotals, equalShares, splitTotalsByAmounts, type DineTotals } from "./calc";
import { apportion } from "./money";
import { generateSalt, hashPin } from "./pin";
import {
  DEFAULT_AREA_NAME,
  DEFAULT_TABLE_COUNT,
  DEFAULT_TABLE_SEATS,
  SAMPLE_MATERIALS,
  SAMPLE_MENU,
  type SampleRecipeLine,
} from "./sampleMenu";
import {
  ADVANCE_METHOD_NAME,
  CREDIT_METHOD_NAME,
  DEFAULT_DINE_SETTINGS,
  DEFAULT_PAYMENT_METHODS,
  DINE_SYNC_SLICES,
  businessDateOf,
  effectiveTaxRate,
  formatSeriesNumber,
  generateId,
  isBillable,
  kindOf,
  kotStatusOf,
  lineTotal,
  lineUnitPrice,
  nowIso,
  type AppliedModifier,
  type DineArea,
  type DineBill,
  type DineBillItem,
  type DineBillPayment,
  type DineBusiness,
  type DineCategory,
  type DineCustomer,
  type DineKot,
  type DineReservation,
  type DineMenuItem,
  type DineModifier,
  type DineModifierGroup,
  type DinePaymentMethod,
  type DineSettings,
  type DineTable,
  type DineTicket,
  type DineTicketItem,
  type DineVariation,
  type DineMaterial,
  type DineRecipeLine,
  type DineStockMove,
  type DineSyncDirtyRow,
  type PaymentMethodKind,
  type RecipeOwnerType,
  type StockMoveReason,
  type DineSyncSlice,
  type KotStatus,
  type OrderType,
  type SplitMode,
} from "./types";

export type DineStatus = "loading" | "welcome" | "setup" | "ready" | "error";

/** Derived state of a table on the floor (FR-3.2) — never stored, always computed. */
/**
 * How a table reads on the floor.
 *
 * "reserved" is a display state only: it is a free table held by a booking,
 * which depends on the current time, and floorTables is a memo with no clock
 * in it. The floor screen derives it and passes it to the badge.
 */
export type TableState = "free" | "occupied" | "billed" | "reserved";

export type FloorTable = {
  table: DineTable;
  areaName: string;
  state: TableState;
  ticket: DineTicket | null;
  runningTotal: number;
  openedAt: string | null;
  itemCount: number;
  unfiredCount: number;
  /** Rounds the kitchen has marked ready but nobody has carried out yet. */
  readyCount: number;
};

export type SetupInput = {
  profile: Omit<DineBusiness, "id" | "createdAt">;
  seedSampleMenu: boolean;
};

export type MenuItemInput = {
  name: string;
  categoryId: string;
  price: number;
  taxRate: number | null;
  taxInclusive: boolean;
  foodType: DineMenuItem["foodType"];
  available: boolean;
  description: string;
  imageDataUrl: string;
  variations: { id?: string; name: string; price: number }[];
  modifierGroups: {
    id?: string;
    name: string;
    minSelect: number;
    maxSelect: number;
    options: { id?: string; name: string; priceDelta: number }[];
  }[];
};

export type MaterialInput = {
  name: string;
  baseUnit: BaseUnit;
  packLabel: string;
  baseUnitsPerPack: number;
  reorderLevel: number;
  note: string;
};

export type AddItemInput = {
  menuItemId: string;
  variationId: string | null;
  quantity: number;
  modifiers: AppliedModifier[];
  note: string;
};

export type SplitPlan =
  | { mode: "full" }
  | { mode: "items"; groups: string[][] }
  | { mode: "equal"; parts: number }
  | { mode: "amount"; amounts: number[] };

export type TenderInput = { methodId: string; amount: number; note?: string };

/**
 * Editable fields of a diner.
 *
 * creditBalance is absent on purpose — see updateCustomer. What someone owes
 * is the sum of their ledger, and no form gets to overwrite it.
 */
export type CustomerInput = {
  name: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  /** May the counter put their bills on account (udhaar)? */
  creditAllowed?: boolean;
};

export type ReservationInput = {
  customerId?: string | null;
  guestName: string;
  phone: string;
  partySize: number;
  tableId: string | null;
  /** Local ISO timestamp. */
  startsAt: string;
  durationMinutes: number;
  depositRequired: number;
  occasion: string;
  note: string;
};

type DineContextValue = {
  status: DineStatus;
  errorMessage: string;

  business: DineBusiness | null;
  settings: DineSettings;
  categories: DineCategory[];
  areas: DineArea[];
  tables: DineTable[];
  menuItems: DineMenuItem[];
  variations: DineVariation[];
  modifierGroups: DineModifierGroup[];
  modifiers: DineModifier[];
  tickets: DineTicket[];
  ticketItems: DineTicketItem[];
  kots: DineKot[];
  bills: DineBill[];
  billItems: DineBillItem[];
  billPayments: DineBillPayment[];
  paymentMethods: DinePaymentMethod[];
  customers: DineCustomer[];

  startSetup: () => void;
  backToWelcome: () => void;
  completeSetup: (input: SetupInput) => Promise<void>;
  updateBusiness: (updates: Partial<Omit<DineBusiness, "id" | "createdAt">>) => Promise<void>;
  updateSettings: (updates: Partial<Omit<DineSettings, "id">>) => Promise<void>;

  createCategory: (name: string) => Promise<DineCategory>;
  renameCategory: (id: string, name: string) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  reorderCategories: (orderedIds: string[]) => Promise<void>;

  createMenuItem: (input: MenuItemInput) => Promise<DineMenuItem>;
  updateMenuItem: (id: string, input: MenuItemInput) => Promise<void>;
  deleteMenuItem: (id: string) => Promise<void>;
  setItemAvailable: (id: string, available: boolean) => Promise<void>;
  importMenu: (
    rows: {
      categoryName: string;
      name: string;
      price: number;
      taxRate: number | null;
      taxInclusive: boolean;
      foodType: DineMenuItem["foodType"];
      available: boolean;
      description: string;
      variations: { name: string; price: number }[];
      modifierGroups: {
        name: string;
        minSelect: number;
        maxSelect: number;
        options: { name: string; priceDelta: number }[];
      }[];
    }[],
    replaceExisting: boolean
  ) => Promise<number>;

  createArea: (name: string) => Promise<DineArea>;
  renameArea: (id: string, name: string) => Promise<void>;
  deleteArea: (id: string) => Promise<void>;
  createTable: (areaId: string, name: string, seats: number) => Promise<DineTable>;
  updateTable: (id: string, name: string, seats: number) => Promise<void>;
  deleteTable: (id: string) => Promise<void>;
  addTables: (areaId: string, count: number, seats: number) => Promise<void>;

  openTicket: (orderType: OrderType, tableId: string | null) => Promise<DineTicket>;
  addTicketItems: (ticketId: string, items: AddItemInput[]) => Promise<void>;
  updateTicketItemQuantity: (itemId: string, quantity: number) => Promise<void>;
  updateTicketItemNote: (itemId: string, note: string) => Promise<void>;
  removeTicketItem: (itemId: string) => Promise<void>;
  cancelTicketItem: (itemId: string, reason: string) => Promise<DineKot | null>;
  fireRound: (ticketId: string) => Promise<DineKot | null>;
  reprintKot: (kotId: string) => Promise<void>;
  setKotStatus: (kotId: string, status: KotStatus) => Promise<void>;
  setTicketDiscount: (
    ticketId: string,
    discountType: "flat" | "percent",
    discountValue: number,
    reason: string
  ) => Promise<void>;
  setTicketServiceCharge: (ticketId: string, on: boolean) => Promise<void>;
  setTicketCustomer: (
    ticketId: string,
    customerId: string | null,
    name: string,
    address: string
  ) => Promise<void>;
  /** Link a ticket to a customer already saved in the shared book. */
  setTicketCustomerById: (
    ticketId: string,
    customerId: string,
    address: string
  ) => Promise<void>;
  setTicketNote: (ticketId: string, note: string) => Promise<void>;
  moveTicketToTable: (ticketId: string, tableId: string | null) => Promise<void>;
  mergeTickets: (sourceId: string, targetId: string) => Promise<void>;
  cancelTicket: (ticketId: string, reason: string) => Promise<void>;

  billTicket: (ticketId: string, plan: SplitPlan) => Promise<DineBill[]>;
  unbillTicket: (ticketId: string) => Promise<void>;
  payBill: (billId: string, tenders: TenderInput[]) => Promise<void>;
  cancelBill: (billId: string, reason: string) => Promise<void>;

  createCustomer: (input: CustomerInput) => Promise<DineCustomer>;
  updateCustomer: (id: string, input: CustomerInput) => Promise<void>;
  deleteCustomer: (id: string) => Promise<void>;

  /**
   * The shared Customer Ledger. Read-only here: Free Dine adds a charge when a
   * bill goes on account, and everything else — settling, reminders, statements
   * — happens in the Customer Ledger tool, for the whole business at once.
   */
  ledgerEntries: LedgerEntry[];
  refreshLedger: () => Promise<void>;

  reservations: DineReservation[];
  createReservation: (input: ReservationInput) => Promise<DineReservation>;
  updateReservation: (id: string, input: ReservationInput) => Promise<DineReservation | null>;
  takeReservationDeposit: (
    id: string,
    amount: number,
    methodId: string
  ) => Promise<DineReservation | null>;
  seatReservation: (id: string, tableId?: string | null) => Promise<DineTicket | null>;
  cancelReservation: (
    id: string,
    reason: string,
    depositOutcome?: "refunded" | "forfeited"
  ) => Promise<DineReservation | null>;
  markReservationNoShow: (
    id: string,
    depositOutcome?: "refunded" | "forfeited"
  ) => Promise<DineReservation | null>;
  deleteReservation: (id: string) => Promise<void>;

  addPaymentMethod: (name: string) => Promise<void>;
  deletePaymentMethod: (id: string) => Promise<void>;

  setPin: (pin: string) => Promise<void>;
  clearPin: () => Promise<void>;

  materials: DineMaterial[];
  recipeLines: DineRecipeLine[];
  stockMoves: DineStockMove[];
  recipeIndex: RecipeIndex;

  createMaterial: (input: MaterialInput) => Promise<DineMaterial>;
  updateMaterial: (id: string, input: MaterialInput) => Promise<void>;
  deleteMaterial: (id: string) => Promise<void>;
  /** Replace every recipe line for one owner (item, variation or modifier). */
  setRecipe: (
    ownerType: RecipeOwnerType,
    ownerId: string,
    lines: { materialId: string; quantity: number }[]
  ) => Promise<void>;
  addStock: (materialId: string, quantity: number, totalCost: number, note: string) => Promise<void>;
  recordWastage: (materialId: string, quantity: number, note: string) => Promise<void>;
  setStockLevel: (materialId: string, actualQuantity: number, note: string) => Promise<void>;

  sheetSync: {
    url: string;
    dirtyCount: number;
    syncing: boolean;
    lastSyncAt: string | null;
    lastError: string;
    /** Pushes this browser has made to the sheet today, for the quota note. */
    callsToday: number;
  };
  connectSheet: (url: string) => Promise<void>;
  disconnectSheet: () => Promise<void>;
  syncSheetNow: () => Promise<void>;
  resyncSheetAll: () => Promise<void>;
  restoreFromSheet: (url: string) => Promise<void>;

  exportBackup: () => Promise<void>;
  applyRestoredBackup: (backup: DineBackup) => Promise<void>;
  resetAll: () => Promise<void>;

  ticketTotals: (ticketId: string) => DineTotals;
  itemsOfTicket: (ticketId: string) => DineTicketItem[];
  floorTables: FloorTable[];
  openTickets: DineTicket[];
  todayDate: string;
};

/**
 * Fill in the credit flag on a diner saved before credit existed.
 *
 * Applied on every read rather than as a one-off migration, because rows also
 * arrive from a backup file and from a Google Sheet pulled back into a fresh
 * browser — a migration that only ran on upgrade would miss both.
 */
function withCreditDefaults(customer: DineCustomer): DineCustomer {
  return { ...customer, creditAllowed: customer.creditAllowed ?? false };
}

/**
 * Which sync slice each store belongs to.
 *
 * Ticket, KOT and sync-queue stores map to nothing on purpose: they are work
 * in progress that churns every few seconds during service, and pushing them
 * would spend the sheet on data nobody reports on.
 */
const STORE_TO_SLICE: Partial<Record<DineStoreName, DineSyncSlice>> = {
  dine_business: "meta",
  dine_settings: "meta",
  dine_categories: "meta",
  dine_areas: "meta",
  dine_tables: "meta",
  dine_payment_methods: "meta",
  dine_menu_items: "menu",
  dine_variations: "menu",
  dine_modifier_groups: "menu",
  dine_modifiers: "menu",
  dine_customers: "customers",
  dine_reservations: "reservations",
  dine_materials: "inventory",
  dine_recipe_lines: "inventory",
  dine_stock_moves: "inventory",
  dine_bills: "bills",
  dine_bill_items: "bills",
  dine_bill_payments: "bills",
};

const SYNC_CALLS_KEY = "dine_sheet_calls";
const SYNC_LAST_KEY = "dine_sheet_sync_last";

const DineContext = createContext<DineContextValue | null>(null);

export function DineProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<DineStatus>("loading");
  const [errorMessage, setErrorMessage] = useState("");

  const [business, setBusiness] = useState<DineBusiness | null>(null);
  const [settings, setSettings] = useState<DineSettings>(DEFAULT_DINE_SETTINGS);
  const [categories, setCategories] = useState<DineCategory[]>([]);
  const [areas, setAreas] = useState<DineArea[]>([]);
  const [tables, setTables] = useState<DineTable[]>([]);
  const [menuItems, setMenuItems] = useState<DineMenuItem[]>([]);
  const [variations, setVariations] = useState<DineVariation[]>([]);
  const [modifierGroups, setModifierGroups] = useState<DineModifierGroup[]>([]);
  const [modifiers, setModifiers] = useState<DineModifier[]>([]);
  const [tickets, setTickets] = useState<DineTicket[]>([]);
  const [ticketItems, setTicketItems] = useState<DineTicketItem[]>([]);
  const [kots, setKots] = useState<DineKot[]>([]);
  const [bills, setBills] = useState<DineBill[]>([]);
  const [billItems, setBillItems] = useState<DineBillItem[]>([]);
  const [billPayments, setBillPayments] = useState<DineBillPayment[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<DinePaymentMethod[]>([]);
  const [customers, setCustomers] = useState<DineCustomer[]>([]);
  /** The shared Customer Ledger, read from the workspace rather than owned. */
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [reservations, setReservations] = useState<DineReservation[]>([]);
  const [materials, setMaterials] = useState<DineMaterial[]>([]);
  const [recipeLines, setRecipeLines] = useState<DineRecipeLine[]>([]);
  const [stockMoves, setStockMoves] = useState<DineStockMove[]>([]);
  const [dirtySlices, setDirtySlices] = useState<DineSyncSlice[]>([]);
  const [sheetSyncing, setSheetSyncing] = useState(false);
  const [sheetLastSyncAt, setSheetLastSyncAt] = useState<string | null>(null);
  const [sheetLastError, setSheetLastError] = useState("");
  const [sheetCallsToday, setSheetCallsToday] = useState(0);

  // Settings are read inside callbacks that must not go stale between renders
  // (firing a KOT reads the counter, bumps it, and writes it back).
  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  // Same reason: the credit and booking actions read these from inside
  // callbacks that are deliberately stable for the life of the provider.
  const customersRef = useRef(customers);
  useEffect(() => {
    customersRef.current = customers;
  }, [customers]);

  const paymentMethodsRef = useRef(paymentMethods);
  useEffect(() => {
    paymentMethodsRef.current = paymentMethods;
  }, [paymentMethods]);

  const reservationsRef = useRef(reservations);
  useEffect(() => {
    reservationsRef.current = reservations;
  }, [reservations]);

  const tablesRef = useRef(tables);
  useEffect(() => {
    tablesRef.current = tables;
  }, [tables]);

  const areasRef = useRef(areas);
  useEffect(() => {
    areasRef.current = areas;
  }, [areas]);

  // Cross-tab live sync. Created lazily so the provider can render on the
  // server, and torn down with the provider.
  const broadcastRef = useRef<DineBroadcast | null>(null);
  const broadcast = useRef((): DineBroadcast => {
    if (!broadcastRef.current) broadcastRef.current = createDineBroadcast();
    return broadcastRef.current;
  }).current;

  useEffect(() => {
    return () => {
      broadcastRef.current?.close();
      broadcastRef.current = null;
    };
  }, []);

  /** Tell the other tabs which stores moved. */
  const announce = useCallback((stores: DineStoreName[]) => {
    broadcast().post(Array.from(new Set(stores)));
  }, [broadcast]);

  /**
   * Write, then announce.
   *
   * Every mutation goes through here rather than calling dineBatch directly,
   * so there is no way to add a feature that saves correctly but leaves the
   * kitchen screen showing yesterday's orders.
   *
   * Deliberately stable for the life of the provider — it closes over nothing
   * but refs. Dozens of actions capture it, and if it were ever rebuilt on a
   * render those actions would go stale in ways that are miserable to trace.
   */
  const commit = useCallback(
    async (
      writes: Partial<Record<DineStoreName, unknown[]>>,
      deletes: Partial<Record<DineStoreName, string[]>> = {}
    ) => {
      const touched = [...Object.keys(writes), ...Object.keys(deletes)] as DineStoreName[];
      // Mark the sheet slices dirty in the same transaction as the change, so
      // a crash between the two cannot leave a sale that never gets synced.
      const slices = Array.from(
        new Set(touched.map((store) => STORE_TO_SLICE[store]).filter(Boolean) as DineSyncSlice[])
      );
      const dirtyRows: DineSyncDirtyRow[] = slices.map((id) => ({ id, dirtyAt: nowIso() }));
      await dineBatch(slices.length ? { ...writes, dine_sync_queue: dirtyRows } : writes, deletes);
      announce(touched);
      if (slices.length) {
        setDirtySlices((previous) => Array.from(new Set([...previous, ...slices])));
      }
    },
    [announce]
  );

  const loadAll = useCallback(async () => {
    const [
      businessRows,
      settingsRows,
      categoryRows,
      areaRows,
      tableRows,
      menuRows,
      variationRows,
      groupRows,
      modifierRows,
      ticketRows,
      ticketItemRows,
      kotRows,
      billRows,
      billItemRows,
      billPaymentRows,
      paymentRows,
      customerRows,
      dirtyRows,
      materialRows,
      recipeRows,
      stockMoveRows,
      reservationRows,
    ] = await Promise.all([
      dineGetAll<DineBusiness>("dine_business"),
      dineGetAll<DineSettings>("dine_settings"),
      dineGetAll<DineCategory>("dine_categories"),
      dineGetAll<DineArea>("dine_areas"),
      dineGetAll<DineTable>("dine_tables"),
      dineGetAll<DineMenuItem>("dine_menu_items"),
      dineGetAll<DineVariation>("dine_variations"),
      dineGetAll<DineModifierGroup>("dine_modifier_groups"),
      dineGetAll<DineModifier>("dine_modifiers"),
      dineGetAll<DineTicket>("dine_tickets"),
      dineGetAll<DineTicketItem>("dine_ticket_items"),
      dineGetAll<DineKot>("dine_kots"),
      dineGetAll<DineBill>("dine_bills"),
      dineGetAll<DineBillItem>("dine_bill_items"),
      dineGetAll<DineBillPayment>("dine_bill_payments"),
      dineGetAll<DinePaymentMethod>("dine_payment_methods"),
      dineGetAll<DineCustomer>("dine_customers"),
      dineGetAll<DineSyncDirtyRow>("dine_sync_queue"),
      dineGetAll<DineMaterial>("dine_materials"),
      dineGetAll<DineRecipeLine>("dine_recipe_lines"),
      dineGetAll<DineStockMove>("dine_stock_moves"),
      dineGetAll<DineReservation>("dine_reservations"),
    ]);

    setBusiness(businessRows[0] ?? null);
    setSettings({ ...DEFAULT_DINE_SETTINGS, ...(settingsRows[0] ?? {}) });
    setCategories(categoryRows);
    setAreas(areaRows);
    setTables(tableRows);
    setMenuItems(menuRows);
    setVariations(variationRows);
    setModifierGroups(groupRows);
    setModifiers(modifierRows);
    setTickets(ticketRows);
    setTicketItems(ticketItemRows);
    setKots(kotRows);
    setBills(billRows);
    setBillItems(billItemRows);
    setBillPayments(billPaymentRows);
    setPaymentMethods(paymentRows);
    setCustomers(customerRows.map(withCreditDefaults));
    setReservations(reservationRows);
    setMaterials(materialRows);
    setRecipeLines(recipeRows);
    setStockMoves(stockMoveRows);
    setDirtySlices(dirtyRows.map((row) => row.id).filter((id) => DINE_SYNC_SLICES.includes(id)));

    return businessRows[0] ?? null;
  }, []);

  /**
   * Re-read the stores another tab just changed.
   *
   * Only the named stores are read, so the kitchen screen refreshing after a
   * round is fired costs two small reads rather than reloading the menu, the
   * bills and the whole sales history.
   */
  const reloadStores = useCallback(async (stores: DineStoreName[]) => {
    const wanted = new Set(stores);
    await Promise.all(
      Array.from(wanted).map(async (store) => {
        switch (store) {
          case "dine_business":
            setBusiness((await dineGetAll<DineBusiness>(store))[0] ?? null);
            return;
          case "dine_settings": {
            const row = (await dineGetAll<DineSettings>(store))[0];
            const next = { ...DEFAULT_DINE_SETTINGS, ...(row ?? {}) };
            settingsRef.current = next;
            setSettings(next);
            return;
          }
          case "dine_categories":
            setCategories(await dineGetAll<DineCategory>(store));
            return;
          case "dine_areas":
            setAreas(await dineGetAll<DineArea>(store));
            return;
          case "dine_tables":
            setTables(await dineGetAll<DineTable>(store));
            return;
          case "dine_menu_items":
            setMenuItems(await dineGetAll<DineMenuItem>(store));
            return;
          case "dine_variations":
            setVariations(await dineGetAll<DineVariation>(store));
            return;
          case "dine_modifier_groups":
            setModifierGroups(await dineGetAll<DineModifierGroup>(store));
            return;
          case "dine_modifiers":
            setModifiers(await dineGetAll<DineModifier>(store));
            return;
          case "dine_tickets":
            setTickets(await dineGetAll<DineTicket>(store));
            return;
          case "dine_ticket_items":
            setTicketItems(await dineGetAll<DineTicketItem>(store));
            return;
          case "dine_kots":
            setKots(await dineGetAll<DineKot>(store));
            return;
          case "dine_bills":
            setBills(await dineGetAll<DineBill>(store));
            return;
          case "dine_bill_items":
            setBillItems(await dineGetAll<DineBillItem>(store));
            return;
          case "dine_bill_payments":
            setBillPayments(await dineGetAll<DineBillPayment>(store));
            return;
          case "dine_payment_methods":
            setPaymentMethods(await dineGetAll<DinePaymentMethod>(store));
            return;
          case "dine_customers":
            setCustomers((await dineGetAll<DineCustomer>(store)).map(withCreditDefaults));
            return;
          case "dine_reservations":
            setReservations(await dineGetAll<DineReservation>(store));
            return;
          case "dine_materials":
            setMaterials(await dineGetAll<DineMaterial>(store));
            return;
          case "dine_recipe_lines":
            setRecipeLines(await dineGetAll<DineRecipeLine>(store));
            return;
          case "dine_stock_moves":
            setStockMoves(await dineGetAll<DineStockMove>(store));
            return;
        }
      })
    );
  }, []);

  // Latest snapshot for the sync engine, kept in a ref so a sync started from
  // a callback never pushes a stale copy of the workspace.
  const snapshotRef = useRef<DineWorkspaceSnapshot | null>(null);
  useEffect(() => {
    snapshotRef.current = {
      business,
      settings,
      categories,
      areas,
      tables,
      paymentMethods,
      menuItems,
      variations,
      modifierGroups,
      modifiers,
      customers,
      bills,
      billItems,
      billPayments,
      materials,
      recipeLines,
      stockMoves,
      reservations,
    };
  });

  useEffect(() => {
    try {
      setSheetLastSyncAt(window.localStorage.getItem(SYNC_LAST_KEY));
      const raw = window.localStorage.getItem(SYNC_CALLS_KEY);
      const parsed = raw ? (JSON.parse(raw) as { date: string; count: number }) : null;
      const today = new Date().toISOString().slice(0, 10);
      setSheetCallsToday(parsed && parsed.date === today ? parsed.count : 0);
    } catch {
      // localStorage can be blocked; the status just starts empty.
    }
  }, []);

  // Listen for other tabs' writes for as long as this provider is mounted.
  useEffect(() => {
    const unsubscribe = broadcast().subscribe((stores) => {
      void reloadStores(stores);
    });
    return unsubscribe;
  }, [broadcast, reloadStores]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const existing = await loadAll();
        if (cancelled) return;
        setStatus(existing ? "ready" : "welcome");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Free Dine could not open its local database in this browser."
        );
        setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadAll]);

  /** Persist a settings patch and keep the in-memory copy in step. */
  const writeSettings = useCallback(async (updates: Partial<Omit<DineSettings, "id">>) => {
    const next = { ...settingsRef.current, ...updates, id: "main" as const };
    settingsRef.current = next;
    await commit({ dine_settings: [next] });
    setSettings(next);
    return next;
  }, []);

  // ---------------------------------------------------------------------
  // Setup
  // ---------------------------------------------------------------------

  const startSetup = useCallback(() => setStatus("setup"), []);
  const backToWelcome = useCallback(() => setStatus("welcome"), []);

  const completeSetup = useCallback(
    async ({ profile, seedSampleMenu }: SetupInput) => {
      const createdAt = nowIso();
      const record: DineBusiness = { ...profile, id: "main", createdAt };

      const paymentRows: DinePaymentMethod[] = DEFAULT_PAYMENT_METHODS.map((name, index) => ({
        id: generateId(),
        name,
        isDefault: true,
        sortOrder: index,
        createdAt,
      }));

      // A restaurant with no floor cannot take a dine-in order, so seed one.
      const area: DineArea = {
        id: generateId(),
        name: DEFAULT_AREA_NAME,
        sortOrder: 0,
        createdAt,
      };
      const tableRows: DineTable[] = Array.from({ length: DEFAULT_TABLE_COUNT }, (_, index) => ({
        id: generateId(),
        areaId: area.id,
        name: `T${index + 1}`,
        seats: DEFAULT_TABLE_SEATS,
        sortOrder: index,
        createdAt,
      }));

      const categoryRows: DineCategory[] = [];
      const menuRows: DineMenuItem[] = [];
      const variationRows: DineVariation[] = [];
      const groupRows: DineModifierGroup[] = [];
      const modifierRows: DineModifier[] = [];
      const materialRows: DineMaterial[] = [];
      const recipeRows: DineRecipeLine[] = [];

      if (seedSampleMenu) {
        // Materials are seeded whether or not stock tracking is switched on, so
        // that turning it on lands on a menu that is already costed rather than
        // on an empty cupboard. They carry an indicative opening price with no
        // stock behind it, which is what makes the plate costs and food-cost
        // percentages readable on day one; the first real purchase replaces it,
        // since a weighted average over zero stock is just whatever was bought.
        const materialIdByName = new Map<string, string>();
        for (const material of SAMPLE_MATERIALS) {
          const packQty = toQty(material.packSize);
          const record: DineMaterial = {
            id: generateId(),
            name: material.name,
            baseUnit: material.unit,
            packLabel: material.packLabel,
            baseUnitsPerPack: packQty,
            stockQty: 0,
            reorderLevel: toQty(material.reorderLevel),
            costPerUnit: costPerUnitFrom(material.packPrice, packQty),
            note: "",
            createdAt,
            updatedAt: createdAt,
          };
          materialRows.push(record);
          materialIdByName.set(material.name, record.id);
        }

        const addRecipe = (
          ownerType: RecipeOwnerType,
          ownerId: string,
          lines: SampleRecipeLine[] | undefined
        ) => {
          lines?.forEach((line, index) => {
            const materialId = materialIdByName.get(line.material);
            if (!materialId) return;
            recipeRows.push({
              id: generateId(),
              ownerType,
              ownerId,
              materialId,
              quantity: toQty(line.qty),
              sortOrder: index,
            });
          });
        };

        SAMPLE_MENU.forEach((category, categoryIndex) => {
          const categoryRecord: DineCategory = {
            id: generateId(),
            name: category.name,
            sortOrder: categoryIndex,
            createdAt,
          };
          categoryRows.push(categoryRecord);

          category.items.forEach((item, itemIndex) => {
            const menuItem: DineMenuItem = {
              id: generateId(),
              name: item.name,
              categoryId: categoryRecord.id,
              price: item.price,
              taxRate: null,
              taxInclusive: DEFAULT_DINE_SETTINGS.pricesIncludeTaxByDefault,
              foodType: item.foodType,
              available: true,
              description: item.description ?? "",
              imageDataUrl: "",
              sortOrder: itemIndex,
              createdAt,
              updatedAt: createdAt,
            };
            menuRows.push(menuItem);
            addRecipe("item", menuItem.id, item.recipe);

            item.variations?.forEach((variation, variationIndex) => {
              const variationRecord: DineVariation = {
                id: generateId(),
                menuItemId: menuItem.id,
                name: variation.name,
                price: variation.price,
                sortOrder: variationIndex,
              };
              variationRows.push(variationRecord);
              // Only sizes that differ carry their own lines; "Full" inherits
              // the base, which is the behaviour worth demonstrating.
              addRecipe("variation", variationRecord.id, variation.recipe);
            });

            item.modifierGroups?.forEach((group, groupIndex) => {
              const groupRecord: DineModifierGroup = {
                id: generateId(),
                menuItemId: menuItem.id,
                name: group.name,
                minSelect: group.minSelect,
                maxSelect: group.maxSelect,
                sortOrder: groupIndex,
              };
              groupRows.push(groupRecord);
              group.options.forEach((option, optionIndex) => {
                const modifierRecord: DineModifier = {
                  id: generateId(),
                  groupId: groupRecord.id,
                  name: option.name,
                  priceDelta: option.priceDelta,
                  sortOrder: optionIndex,
                };
                modifierRows.push(modifierRecord);
                addRecipe("modifier", modifierRecord.id, option.recipe);
              });
            });
          });
        });
      }

      const settingsRecord: DineSettings = { ...DEFAULT_DINE_SETTINGS };

      await commit({
        dine_business: [record],
        dine_settings: [settingsRecord],
        dine_payment_methods: paymentRows,
        dine_areas: [area],
        dine_tables: tableRows,
        dine_categories: categoryRows,
        dine_menu_items: menuRows,
        dine_variations: variationRows,
        dine_modifier_groups: groupRows,
        dine_modifiers: modifierRows,
        dine_materials: materialRows,
        dine_recipe_lines: recipeRows,
      });

      setBusiness(record);
      setSettings(settingsRecord);
      settingsRef.current = settingsRecord;
      setPaymentMethods(paymentRows);
      setAreas([area]);
      setTables(tableRows);
      setCategories(categoryRows);
      setMenuItems(menuRows);
      setVariations(variationRows);
      setModifierGroups(groupRows);
      setModifiers(modifierRows);
      setMaterials(materialRows);
      setRecipeLines(recipeRows);
      setStatus("ready");
    },
    []
  );

  const updateBusiness = useCallback(
    async (updates: Partial<Omit<DineBusiness, "id" | "createdAt">>) => {
      setBusiness((previous) => {
        if (!previous) return previous;
        const next = { ...previous, ...updates };
        void commit({ dine_business: [next] });
        return next;
      });
    },
    []
  );

  const updateSettings = useCallback(
    async (updates: Partial<Omit<DineSettings, "id">>) => {
      await writeSettings(updates);
    },
    [writeSettings]
  );

  // ---------------------------------------------------------------------
  // Menu
  // ---------------------------------------------------------------------

  const createCategory = useCallback(
    async (name: string) => {
      const record: DineCategory = {
        id: generateId(),
        name: name.trim(),
        sortOrder: categories.length,
        createdAt: nowIso(),
      };
      await commit({ dine_categories: [record] });
      setCategories((previous) => [...previous, record]);
      return record;
    },
    [categories.length]
  );

  const renameCategory = useCallback(async (id: string, name: string) => {
    setCategories((previous) => {
      const next = previous.map((category) =>
        category.id === id ? { ...category, name: name.trim() } : category
      );
      const changed = next.find((category) => category.id === id);
      if (changed) void commit({ dine_categories: [changed] });
      return next;
    });
  }, []);

  const deleteCategory = useCallback(
    async (id: string) => {
      // Items outlive their category — orphaning them would hide dishes that
      // are still on the menu. They fall back to "Uncategorised" instead.
      const orphaned = menuItems.filter((item) => item.categoryId === id);
      let fallback = categories.find((category) => category.id !== id);
      const writes: Partial<Record<DineStoreName, unknown[]>> = {};

      if (orphaned.length > 0 && !fallback) {
        fallback = {
          id: generateId(),
          name: "Uncategorised",
          sortOrder: categories.length,
          createdAt: nowIso(),
        };
        writes.dine_categories = [fallback];
      }

      const moved = orphaned.map((item) => ({ ...item, categoryId: fallback!.id }));
      if (moved.length > 0) writes.dine_menu_items = moved;

      await commit(writes, { dine_categories: [id] });
      setCategories((previous) => {
        const kept = previous.filter((category) => category.id !== id);
        const added = writes.dine_categories as DineCategory[] | undefined;
        return added ? [...kept, ...added] : kept;
      });
      if (moved.length > 0) {
        setMenuItems((previous) =>
          previous.map((item) => moved.find((row) => row.id === item.id) ?? item)
        );
      }
    },
    [categories, menuItems]
  );

  const reorderCategories = useCallback(async (orderedIds: string[]) => {
    setCategories((previous) => {
      const next = previous.map((category) => ({
        ...category,
        sortOrder: orderedIds.indexOf(category.id),
      }));
      void commit({ dine_categories: next });
      return next.sort((a, b) => a.sortOrder - b.sortOrder);
    });
  }, []);

  /** Replace an item's variations and modifier groups wholesale. */
  const writeItemChildren = useCallback(
    (menuItemId: string, input: MenuItemInput) => {
      const variationRows: DineVariation[] = input.variations.map((variation, index) => ({
        id: variation.id ?? generateId(),
        menuItemId,
        name: variation.name.trim(),
        price: variation.price,
        sortOrder: index,
      }));

      const groupRows: DineModifierGroup[] = [];
      const modifierRows: DineModifier[] = [];
      input.modifierGroups.forEach((group, groupIndex) => {
        const groupId = group.id ?? generateId();
        groupRows.push({
          id: groupId,
          menuItemId,
          name: group.name.trim(),
          minSelect: Math.max(group.minSelect, 0),
          maxSelect: Math.max(group.maxSelect, 1),
          sortOrder: groupIndex,
        });
        group.options.forEach((option, optionIndex) => {
          modifierRows.push({
            id: option.id ?? generateId(),
            groupId,
            name: option.name.trim(),
            priceDelta: option.priceDelta,
            sortOrder: optionIndex,
          });
        });
      });

      const staleVariations = variations
        .filter((variation) => variation.menuItemId === menuItemId)
        .map((variation) => variation.id)
        .filter((id) => !variationRows.some((row) => row.id === id));

      const previousGroups = modifierGroups.filter((group) => group.menuItemId === menuItemId);
      const staleGroups = previousGroups
        .map((group) => group.id)
        .filter((id) => !groupRows.some((row) => row.id === id));
      const previousGroupIds = new Set(previousGroups.map((group) => group.id));
      const staleModifiers = modifiers
        .filter((modifier) => previousGroupIds.has(modifier.groupId))
        .map((modifier) => modifier.id)
        .filter((id) => !modifierRows.some((row) => row.id === id));

      return { variationRows, groupRows, modifierRows, staleVariations, staleGroups, staleModifiers };
    },
    [modifierGroups, modifiers, variations]
  );

  const createMenuItem = useCallback(
    async (input: MenuItemInput) => {
      const at = nowIso();
      const record: DineMenuItem = {
        id: generateId(),
        name: input.name.trim(),
        categoryId: input.categoryId,
        price: input.price,
        taxRate: input.taxRate,
        taxInclusive: input.taxInclusive,
        foodType: input.foodType,
        available: input.available,
        description: input.description,
        imageDataUrl: input.imageDataUrl,
        sortOrder: menuItems.filter((item) => item.categoryId === input.categoryId).length,
        createdAt: at,
        updatedAt: at,
      };
      const children = writeItemChildren(record.id, input);

      await commit({
        dine_menu_items: [record],
        dine_variations: children.variationRows,
        dine_modifier_groups: children.groupRows,
        dine_modifiers: children.modifierRows,
      });

      setMenuItems((previous) => [...previous, record]);
      setVariations((previous) => [...previous, ...children.variationRows]);
      setModifierGroups((previous) => [...previous, ...children.groupRows]);
      setModifiers((previous) => [...previous, ...children.modifierRows]);
      return record;
    },
    [menuItems, writeItemChildren]
  );

  const updateMenuItem = useCallback(
    async (id: string, input: MenuItemInput) => {
      const existing = menuItems.find((item) => item.id === id);
      if (!existing) return;
      const record: DineMenuItem = {
        ...existing,
        name: input.name.trim(),
        categoryId: input.categoryId,
        price: input.price,
        taxRate: input.taxRate,
        taxInclusive: input.taxInclusive,
        foodType: input.foodType,
        available: input.available,
        description: input.description,
        imageDataUrl: input.imageDataUrl,
        updatedAt: nowIso(),
      };
      const children = writeItemChildren(id, input);

      await commit(
        {
          dine_menu_items: [record],
          dine_variations: children.variationRows,
          dine_modifier_groups: children.groupRows,
          dine_modifiers: children.modifierRows,
        },
        {
          dine_variations: children.staleVariations,
          dine_modifier_groups: children.staleGroups,
          dine_modifiers: children.staleModifiers,
        }
      );

      setMenuItems((previous) => previous.map((item) => (item.id === id ? record : item)));
      setVariations((previous) => [
        ...previous.filter(
          (variation) =>
            variation.menuItemId !== id && !children.staleVariations.includes(variation.id)
        ),
        ...children.variationRows,
      ]);
      setModifierGroups((previous) => [
        ...previous.filter((group) => group.menuItemId !== id),
        ...children.groupRows,
      ]);
      setModifiers((previous) => [
        ...previous.filter(
          (modifier) =>
            !children.staleModifiers.includes(modifier.id) &&
            !children.groupRows.some((group) => group.id === modifier.groupId)
        ),
        ...children.modifierRows,
      ]);
    },
    [menuItems, writeItemChildren]
  );

  const deleteMenuItem = useCallback(
    async (id: string) => {
      const groupIds = modifierGroups
        .filter((group) => group.menuItemId === id)
        .map((group) => group.id);
      await commit(
        {},
        {
          dine_menu_items: [id],
          dine_variations: variations
            .filter((variation) => variation.menuItemId === id)
            .map((variation) => variation.id),
          dine_modifier_groups: groupIds,
          dine_modifiers: modifiers
            .filter((modifier) => groupIds.includes(modifier.groupId))
            .map((modifier) => modifier.id),
        }
      );
      setMenuItems((previous) => previous.filter((item) => item.id !== id));
      setVariations((previous) => previous.filter((variation) => variation.menuItemId !== id));
      setModifierGroups((previous) => previous.filter((group) => group.menuItemId !== id));
      setModifiers((previous) => previous.filter((modifier) => !groupIds.includes(modifier.groupId)));
    },
    [modifierGroups, modifiers, variations]
  );

  /** FR-2.5: the "sold out at 8pm" toggle — one tap, never a delete. */
  const setItemAvailable = useCallback(async (id: string, available: boolean) => {
    setMenuItems((previous) => {
      const next = previous.map((item) =>
        item.id === id ? { ...item, available, updatedAt: nowIso() } : item
      );
      const changed = next.find((item) => item.id === id);
      if (changed) void commit({ dine_menu_items: [changed] });
      return next;
    });
  }, []);

  const importMenu = useCallback<DineContextValue["importMenu"]>(
    async (rows, replaceExisting) => {
      const at = nowIso();
      const categoryRows = replaceExisting ? [] : [...categories];
      const menuRows: DineMenuItem[] = [];
      const variationRows: DineVariation[] = [];
      const groupRows: DineModifierGroup[] = [];
      const modifierRows: DineModifier[] = [];

      const categoryFor = (name: string) => {
        const trimmed = name.trim() || "Uncategorised";
        const existing = categoryRows.find(
          (category) => category.name.toLowerCase() === trimmed.toLowerCase()
        );
        if (existing) return existing;
        const created: DineCategory = {
          id: generateId(),
          name: trimmed,
          sortOrder: categoryRows.length,
          createdAt: at,
        };
        categoryRows.push(created);
        return created;
      };

      rows.forEach((row, index) => {
        const category = categoryFor(row.categoryName);
        const item: DineMenuItem = {
          id: generateId(),
          name: row.name,
          categoryId: category.id,
          price: row.price,
          taxRate: row.taxRate,
          taxInclusive: row.taxInclusive,
          foodType: row.foodType,
          available: row.available,
          description: row.description,
          imageDataUrl: "",
          sortOrder: index,
          createdAt: at,
          updatedAt: at,
        };
        menuRows.push(item);

        row.variations.forEach((variation, variationIndex) => {
          variationRows.push({
            id: generateId(),
            menuItemId: item.id,
            name: variation.name,
            price: variation.price,
            sortOrder: variationIndex,
          });
        });

        row.modifierGroups.forEach((group, groupIndex) => {
          const groupId = generateId();
          groupRows.push({
            id: groupId,
            menuItemId: item.id,
            name: group.name,
            minSelect: group.minSelect,
            maxSelect: group.maxSelect,
            sortOrder: groupIndex,
          });
          group.options.forEach((option, optionIndex) => {
            modifierRows.push({
              id: generateId(),
              groupId,
              name: option.name,
              priceDelta: option.priceDelta,
              sortOrder: optionIndex,
            });
          });
        });
      });

      const deletes: Partial<Record<DineStoreName, string[]>> = replaceExisting
        ? {
            dine_menu_items: menuItems.map((item) => item.id),
            dine_variations: variations.map((variation) => variation.id),
            dine_modifier_groups: modifierGroups.map((group) => group.id),
            dine_modifiers: modifiers.map((modifier) => modifier.id),
            dine_categories: categories.map((category) => category.id),
          }
        : {};

      await commit(
        {
          dine_categories: categoryRows,
          dine_menu_items: menuRows,
          dine_variations: variationRows,
          dine_modifier_groups: groupRows,
          dine_modifiers: modifierRows,
        },
        deletes
      );

      setCategories(categoryRows);
      setMenuItems((previous) => (replaceExisting ? menuRows : [...previous, ...menuRows]));
      setVariations((previous) =>
        replaceExisting ? variationRows : [...previous, ...variationRows]
      );
      setModifierGroups((previous) => (replaceExisting ? groupRows : [...previous, ...groupRows]));
      setModifiers((previous) => (replaceExisting ? modifierRows : [...previous, ...modifierRows]));
      return menuRows.length;
    },
    [categories, menuItems, modifierGroups, modifiers, variations]
  );

  // ---------------------------------------------------------------------
  // Floor
  // ---------------------------------------------------------------------

  const createArea = useCallback(
    async (name: string) => {
      const record: DineArea = {
        id: generateId(),
        name: name.trim(),
        sortOrder: areas.length,
        createdAt: nowIso(),
      };
      await commit({ dine_areas: [record] });
      setAreas((previous) => [...previous, record]);
      return record;
    },
    [areas.length]
  );

  const renameArea = useCallback(async (id: string, name: string) => {
    setAreas((previous) => {
      const next = previous.map((area) => (area.id === id ? { ...area, name: name.trim() } : area));
      const changed = next.find((area) => area.id === id);
      if (changed) void commit({ dine_areas: [changed] });
      return next;
    });
  }, []);

  const deleteArea = useCallback(
    async (id: string) => {
      const doomed = tables.filter((table) => table.areaId === id).map((table) => table.id);
      await commit({}, { dine_areas: [id], dine_tables: doomed });
      setAreas((previous) => previous.filter((area) => area.id !== id));
      setTables((previous) => previous.filter((table) => table.areaId !== id));
    },
    [tables]
  );

  const createTable = useCallback(
    async (areaId: string, name: string, seats: number) => {
      const record: DineTable = {
        id: generateId(),
        areaId,
        name: name.trim(),
        seats: Math.max(seats, 1),
        sortOrder: tables.filter((table) => table.areaId === areaId).length,
        createdAt: nowIso(),
      };
      await commit({ dine_tables: [record] });
      setTables((previous) => [...previous, record]);
      return record;
    },
    [tables]
  );

  const updateTable = useCallback(async (id: string, name: string, seats: number) => {
    setTables((previous) => {
      const next = previous.map((table) =>
        table.id === id ? { ...table, name: name.trim(), seats: Math.max(seats, 1) } : table
      );
      const changed = next.find((table) => table.id === id);
      if (changed) void commit({ dine_tables: [changed] });
      return next;
    });
  }, []);

  const deleteTable = useCallback(async (id: string) => {
    await commit({}, { dine_tables: [id] });
    setTables((previous) => previous.filter((table) => table.id !== id));
  }, []);

  const addTables = useCallback(
    async (areaId: string, count: number, seats: number) => {
      const at = nowIso();
      const start = tables.filter((table) => table.areaId === areaId).length;
      const rows: DineTable[] = Array.from({ length: Math.max(count, 0) }, (_, index) => ({
        id: generateId(),
        areaId,
        name: `T${start + index + 1}`,
        seats: Math.max(seats, 1),
        sortOrder: start + index,
        createdAt: at,
      }));
      if (rows.length === 0) return;
      await commit({ dine_tables: rows });
      setTables((previous) => [...previous, ...rows]);
    },
    [tables]
  );

  // ---------------------------------------------------------------------
  // Customers
  // ---------------------------------------------------------------------

  /**
   * Copy a diner into the shared Business Workspace, where the Customer Ledger
   * and the rest of the toolkit read their contacts.
   *
   * Best-effort: Free Dine's own dine_customers stays the record it relies on,
   * so if the workspace database is unavailable the restaurant still has its
   * regulars and the next edit republishes. The id is shared, which is what
   * lets a bill put on account here appear against the same person in the
   * Customer Ledger.
   */
  const publishCustomer = useCallback(async (customer: DineCustomer) => {
    if (!settingsRef.current.shareCustomersWithLedger) return;
    const record: WorkspaceCustomer = {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      address: customer.address,
      notes: customer.notes,
      createdAt: customer.createdAt,
    };
    try {
      await workspacePut("customers", record);
    } catch {
      // The ledger link is a convenience, never a reason to fail a sale.
    }
  }, []);

  /**
   * Bring in customers saved by the other tools, so there is one book.
   *
   * The counter should be able to pick a regular who was first saved at the
   * shop till or in the Customer Ledger — otherwise "select a customer" only
   * ever finds the people typed into this one product. Matched by id, so a
   * diner who came from here is never duplicated, and existing rows are left
   * alone: Free Dine's copy stays the one it relies on.
   */
  const importWorkspaceCustomers = useCallback(async () => {
    if (!settingsRef.current.shareCustomersWithLedger) return;
    try {
      const shared = await getWorkspaceCustomers();
      const known = new Set(customersRef.current.map((row) => row.id));
      const missing: DineCustomer[] = shared
        .filter((row) => !known.has(row.id))
        .map((row) => ({
          id: row.id,
          name: row.name,
          phone: row.phone ?? "",
          email: row.email ?? "",
          address: row.address ?? "",
          notes: row.notes ?? "",
          createdAt: row.createdAt ?? nowIso(),
          creditAllowed: false,
        }));
      if (missing.length === 0) return;
      await commit({ dine_customers: missing });
      setCustomers((previous) => [...previous, ...missing]);
    } catch {
      // No workspace yet just means this restaurant's own book, which is fine.
    }
  }, [commit]);

  const createCustomer = useCallback(
    async (input: CustomerInput) => {
      const record: DineCustomer = {
        id: generateId(),
        createdAt: nowIso(),
        name: input.name,
        phone: input.phone,
        email: input.email,
        address: input.address,
        notes: input.notes,
        creditAllowed: input.creditAllowed ?? false,
      };
      await commit({ dine_customers: [record] });
      setCustomers((previous) => [...previous, record]);
      // The ref is normally refreshed by an effect, which has not run yet when
      // a caller creates a diner and immediately attaches them to a ticket —
      // the exact thing "add a new customer" at the table does. Without this
      // the lookup misses and the ticket silently keeps no customer at all.
      customersRef.current = [...customersRef.current, record];
      void publishCustomer(record);
      return record;
    },
    [commit, publishCustomer]
  );

  /**
   * Edit a diner's details and whether they may run a tab.
   *
   * There is no balance to edit. What someone owes is the sum of their entries
   * in the shared Customer Ledger; this form only decides whether the counter
   * is allowed to add to them.
   */
  const updateCustomer = useCallback(
    async (id: string, input: CustomerInput) => {
      setCustomers((previous) => {
        const next = previous.map((customer) =>
          customer.id === id
            ? {
                ...customer,
                name: input.name,
                phone: input.phone,
                email: input.email,
                address: input.address,
                notes: input.notes,
                creditAllowed: input.creditAllowed ?? customer.creditAllowed,
              }
            : customer
        );
        const changed = next.find((customer) => customer.id === id);
        if (changed) {
          void commit({ dine_customers: [changed] });
          void publishCustomer(changed);
        }
        return next;
      });
    },
    [commit, publishCustomer]
  );

  const deleteCustomer = useCallback(
    async (id: string) => {
      await commit({}, { dine_customers: [id] });
      setCustomers((previous) => previous.filter((customer) => customer.id !== id));
    },
    [commit]
  );

  /**
   * Put an amount on a diner's tab, in the shared Customer Ledger.
   *
   * This is the whole of Free Dine's credit feature. The entry goes into the
   * workspace `ledger` store — the same one the Browser Based POS writes udhaar
   * sales to and the Customer Ledger tool is built on — so settling, reminding
   * and reporting all happen in one place for the whole business.
   *
   * It cannot be atomic with the bill: the ledger lives in POS_DATABASE and the
   * bill in DINE_DATABASE, and IndexedDB has no transaction spanning two. So it
   * is written *first* and rolled back if the bill fails. Of the two ways this
   * can go wrong, a charge with no bill behind it is visible in the ledger and
   * can be removed; a meal with no charge behind it is simply given away.
   */
  const postToLedger = useCallback(async (entry: LedgerEntry): Promise<boolean> => {
    try {
      await saveLedgerEntry(entry);
      setLedgerEntries((previous) => [...previous, entry]);
      return true;
    } catch {
      return false;
    }
  }, []);

  const unpostFromLedger = useCallback(async (entryId: string) => {
    try {
      await deleteLedgerEntry(entryId);
    } catch {
      // Best effort: the entry is visible in the Customer Ledger either way.
    }
    setLedgerEntries((previous) => previous.filter((row) => row.id !== entryId));
  }, []);

  /** Re-read the shared ledger, after another tool or tab has written to it. */
  const refreshLedger = useCallback(async () => {
    try {
      setLedgerEntries(await getLedgerEntries());
    } catch {
      // No workspace yet just means nobody owes anything here.
    }
  }, []);

  // ---------------------------------------------------------------------
  // Raw materials, recipes and stock
  // ---------------------------------------------------------------------

  const recipeIndex = useMemo(() => indexRecipes(recipeLines), [recipeLines]);

  const materialsById = useMemo(
    () => new Map(materials.map((material) => [material.id, material])),
    [materials]
  );
  const materialsRef = useRef(materialsById);
  useEffect(() => {
    materialsRef.current = materialsById;
  }, [materialsById]);

  const recipeIndexRef = useRef(recipeIndex);
  useEffect(() => {
    recipeIndexRef.current = recipeIndex;
  }, [recipeIndex]);

  const createMaterial = useCallback(
    async (input: MaterialInput) => {
      const at = nowIso();
      const record: DineMaterial = {
        id: generateId(),
        name: input.name.trim(),
        baseUnit: input.baseUnit,
        packLabel: input.packLabel.trim(),
        baseUnitsPerPack: Math.max(input.baseUnitsPerPack, 0),
        stockQty: 0,
        reorderLevel: Math.max(input.reorderLevel, 0),
        costPerUnit: 0,
        note: input.note,
        createdAt: at,
        updatedAt: at,
      };
      await commit({ dine_materials: [record] });
      setMaterials((previous) => [...previous, record]);
      return record;
    },
    [commit]
  );

  const updateMaterial = useCallback(
    async (id: string, input: MaterialInput) => {
      setMaterials((previous) => {
        const next = previous.map((material) =>
          material.id === id
            ? {
                ...material,
                name: input.name.trim(),
                baseUnit: input.baseUnit,
                packLabel: input.packLabel.trim(),
                baseUnitsPerPack: Math.max(input.baseUnitsPerPack, 0),
                reorderLevel: Math.max(input.reorderLevel, 0),
                note: input.note,
                updatedAt: nowIso(),
              }
            : material
        );
        const changed = next.find((material) => material.id === id);
        if (changed) void commit({ dine_materials: [changed] });
        return next;
      });
    },
    [commit]
  );

  const deleteMaterial = useCallback(
    async (id: string) => {
      // Recipe lines pointing at a deleted material would silently consume
      // nothing, so they go with it. The stock ledger stays: it carries its own
      // copy of the name, and history should not rewrite itself.
      const doomedLines = recipeLines.filter((line) => line.materialId === id);
      await commit(
        {},
        {
          dine_materials: [id],
          dine_recipe_lines: doomedLines.map((line) => line.id),
        }
      );
      setMaterials((previous) => previous.filter((material) => material.id !== id));
      setRecipeLines((previous) => previous.filter((line) => line.materialId !== id));
    },
    [commit, recipeLines]
  );

  const setRecipe = useCallback<DineContextValue["setRecipe"]>(
    async (ownerType, ownerId, lines) => {
      const existing = recipeLines.filter(
        (line) => line.ownerType === ownerType && line.ownerId === ownerId
      );
      const rows: DineRecipeLine[] = lines
        .filter((line) => line.materialId && line.quantity !== 0)
        .map((line, index) => ({
          id: generateId(),
          ownerType,
          ownerId,
          materialId: line.materialId,
          quantity: line.quantity,
          sortOrder: index,
        }));

      await commit(
        { dine_recipe_lines: rows },
        { dine_recipe_lines: existing.map((line) => line.id) }
      );
      setRecipeLines((previous) => [
        ...previous.filter(
          (line) => !(line.ownerType === ownerType && line.ownerId === ownerId)
        ),
        ...rows,
      ]);
    },
    [commit, recipeLines]
  );

  /**
   * Apply a set of stock changes and append their ledger rows.
   *
   * Balances are read inside the write (see dineApplyStock), so two tabs
   * firing rounds at once cannot both subtract from the same starting figure.
   */
  const applyStock = useCallback(
    async (
      entries: {
        materialId: string;
        change: number;
        reason: StockMoveReason;
        note?: string;
        refId?: string;
        refLabel?: string;
        /** Cost per unit of the incoming stock; only used by purchases. */
        incomingCost?: number;
      }[]
    ) => {
      const real = entries.filter((entry) => entry.change !== 0 || entry.reason === "adjust");
      if (real.length === 0) return;

      const at = nowIso();
      const businessDate = businessDateOf(at, settingsRef.current.dayStartHour);

      const result = await dineApplyStock<DineMaterial>(
        real.map((entry) => entry.materialId),
        (current) => {
          const touched = new Map<string, DineMaterial>();
          const moves: DineStockMove[] = [];

          for (const entry of real) {
            const material = touched.get(entry.materialId) ?? current.get(entry.materialId);
            if (!material) continue;

            const costPerUnit =
              entry.reason === "purchase" && entry.incomingCost !== undefined
                ? blendCost(
                    Math.max(material.stockQty, 0),
                    material.costPerUnit,
                    entry.change,
                    entry.incomingCost
                  )
                : material.costPerUnit;

            const next: DineMaterial = {
              ...material,
              stockQty: material.stockQty + entry.change,
              costPerUnit,
              updatedAt: at,
            };
            touched.set(next.id, next);

            moves.push({
              id: generateId(),
              materialId: next.id,
              materialName: next.name,
              reason: entry.reason,
              change: entry.change,
              balanceAfter: next.stockQty,
              costPerUnit,
              refId: entry.refId ?? "",
              refLabel: entry.refLabel ?? "",
              note: entry.note ?? "",
              businessDate,
              createdAt: at,
            });
          }

          return { materials: Array.from(touched.values()), moves };
        }
      );

      const updated = result.materials as DineMaterial[];
      const moves = result.moves as DineStockMove[];
      if (updated.length === 0) return;

      setMaterials((previous) =>
        previous.map((material) => updated.find((row) => row.id === material.id) ?? material)
      );
      setStockMoves((previous) => [...previous, ...moves]);
      announce(["dine_materials", "dine_stock_moves"]);
    },
    [announce]
  );

  /** Deduct what a set of ticket lines consumes, once they reach the kitchen. */
  const consumeForItems = useCallback(
    async (items: DineTicketItem[], refId: string, refLabel: string) => {
      if (!settingsRef.current.inventoryEnabled) return;
      const consumption = mergeConsumption(
        items.map((item) => consumptionForTicketItem(item, recipeIndexRef.current))
      );
      if (consumption.length === 0) return;
      await applyStock(
        consumption.map((entry: Consumption) => ({
          materialId: entry.materialId,
          change: -entry.quantity,
          reason: "consume" as const,
          refId,
          refLabel,
        }))
      );
    },
    [applyStock]
  );

  const addStock = useCallback(
    async (materialId: string, quantity: number, totalCost: number, note: string) => {
      if (quantity <= 0) return;
      await applyStock([
        {
          materialId,
          change: quantity,
          reason: "purchase",
          note,
          incomingCost: totalCost > 0 ? costPerUnitFrom(totalCost, quantity) : undefined,
        },
      ]);
    },
    [applyStock]
  );

  const recordWastage = useCallback(
    async (materialId: string, quantity: number, note: string) => {
      if (quantity <= 0) return;
      await applyStock([{ materialId, change: -quantity, reason: "wastage", note }]);
    },
    [applyStock]
  );

  /** Stock take: set the counted figure, recording the variance as the move. */
  const setStockLevel = useCallback(
    async (materialId: string, actualQuantity: number, note: string) => {
      const material = materialsRef.current.get(materialId);
      if (!material) return;
      const change = actualQuantity - material.stockQty;
      await applyStock([{ materialId, change, reason: "adjust", note }]);
    },
    [applyStock]
  );

  // ---------------------------------------------------------------------
  // Tickets
  // ---------------------------------------------------------------------

  /** Read the live settings inside the transaction that bumps a counter. */
  const settingsFrom = useCallback((stored: DineSettings | undefined): DineSettings => {
    return { ...DEFAULT_DINE_SETTINGS, ...(stored ?? settingsRef.current) };
  }, []);

  const openTicket = useCallback(
    async (orderType: OrderType, tableId: string | null) => {
      const at = nowIso();

      const { record, nextSettings } = await dineAllocate<
        DineSettings,
        { record: DineTicket; nextSettings: DineSettings }
      >("dine_settings", "main", ["dine_tickets"], (stored) => {
        const current = settingsFrom(stored);
        const ticket: DineTicket = {
          id: generateId(),
          ticketNumber: current.nextTicketNumber,
          orderType,
          tableId: orderType === "dine-in" ? tableId : null,
          customerId: null,
          customerName: "",
          deliveryAddress: "",
          status: "open",
          roundsFired: 0,
          discountType: "percent",
          discountValue: 0,
          discountReason: "",
          serviceChargeOn: current.serviceChargeDefaultOn,
          note: "",
          openedAt: at,
          settledAt: null,
          mergedIntoId: null,
          createdAt: at,
        };
        const settingsRow: DineSettings = {
          ...current,
          nextTicketNumber: current.nextTicketNumber + 1,
        };
        return {
          writes: { dine_tickets: [ticket], dine_settings: [settingsRow] },
          result: { record: ticket, nextSettings: settingsRow },
        };
      });

      settingsRef.current = nextSettings;
      announce(["dine_tickets", "dine_settings"]);
      setTickets((previous) => [...previous, record]);
      setSettings(nextSettings);
      return record;
    },
    [announce, settingsFrom]
  );

  const addTicketItems = useCallback(
    async (ticketId: string, inputs: AddItemInput[]) => {
      const ticket = tickets.find((row) => row.id === ticketId);
      if (!ticket || inputs.length === 0) return;
      const current = settingsRef.current;
      const at = nowIso();
      const round = ticket.roundsFired + 1;

      // Tapping the same dish twice should read as "x2", not as two identical
      // lines. Only un-fired lines in the current round can absorb it — a line
      // already sent to the kitchen is history and must not change under it.
      const sameLine = (item: DineTicketItem, input: AddItemInput) =>
        item.menuItemId === input.menuItemId &&
        item.variationId === (input.variationId ?? null) &&
        item.note.trim() === input.note.trim() &&
        item.firedAt === null &&
        item.cancelledAt === null &&
        item.roundNumber === round &&
        item.modifiers.length === input.modifiers.length &&
        item.modifiers.every((modifier) =>
          input.modifiers.some((chosen) => chosen.id === modifier.id)
        );

      const existing = ticketItems.filter((item) => item.ticketId === ticketId);
      const merged: DineTicketItem[] = [];
      const fresh: AddItemInput[] = [];
      for (const input of inputs) {
        const match =
          merged.find((item) => sameLine(item, input)) ??
          existing.find((item) => sameLine(item, input));
        if (match) {
          const bumped = { ...match, quantity: match.quantity + Math.max(input.quantity, 1) };
          const at = merged.findIndex((item) => item.id === match.id);
          if (at === -1) merged.push(bumped);
          else merged[at] = bumped;
        } else {
          fresh.push(input);
        }
      }

      const rows: DineTicketItem[] = fresh.map((input) => {
        const menuItem = menuItems.find((item) => item.id === input.menuItemId);
        const variation = input.variationId
          ? variations.find((row) => row.id === input.variationId) ?? null
          : null;
        const price = variation ? variation.price : (menuItem?.price ?? 0);
        return {
          id: generateId(),
          ticketId,
          menuItemId: input.menuItemId,
          variationId: variation?.id ?? null,
          name: menuItem?.name ?? "Item",
          variationName: variation?.name ?? "",
          price,
          quantity: Math.max(input.quantity, 1),
          modifiers: input.modifiers,
          note: input.note,
          taxRate: effectiveTaxRate(menuItem?.taxRate ?? null, current),
          taxInclusive: menuItem?.taxInclusive ?? current.pricesIncludeTaxByDefault,
          roundNumber: round,
          firedAt: null,
          cancelledAt: null,
          cancelReason: "",
          billId: null,
          createdAt: at,
        };
      });

      if (rows.length === 0 && merged.length === 0) return;
      await commit({ dine_ticket_items: [...merged, ...rows] });
      setTicketItems((previous) => [
        ...previous.map((item) => merged.find((row) => row.id === item.id) ?? item),
        ...rows,
      ]);
    },
    [commit, menuItems, ticketItems, tickets, variations]
  );

  const updateTicketItemQuantity = useCallback(async (itemId: string, quantity: number) => {
    setTicketItems((previous) => {
      const next = previous.map((item) =>
        // FR-4.5: only un-fired lines may be edited freely.
        item.id === itemId && item.firedAt === null
          ? { ...item, quantity: Math.max(quantity, 1) }
          : item
      );
      const changed = next.find((item) => item.id === itemId);
      if (changed) void commit({ dine_ticket_items: [changed] });
      return next;
    });
  }, []);

  const updateTicketItemNote = useCallback(async (itemId: string, note: string) => {
    setTicketItems((previous) => {
      const next = previous.map((item) => (item.id === itemId ? { ...item, note } : item));
      const changed = next.find((item) => item.id === itemId);
      if (changed) void commit({ dine_ticket_items: [changed] });
      return next;
    });
  }, []);

  const removeTicketItem = useCallback(
    async (itemId: string) => {
      const item = ticketItems.find((row) => row.id === itemId);
      // A fired item has already reached the kitchen; pulling it is a cancel,
      // with a record, not a delete (FR-4.4).
      if (!item || item.firedAt !== null) return;
      await commit({}, { dine_ticket_items: [itemId] });
      setTicketItems((previous) => previous.filter((row) => row.id !== itemId));
    },
    [ticketItems]
  );

  /**
   * Allocate a KOT number and write the whole round in one transaction.
   *
   * The number is read from the stored settings *inside* the transaction, not
   * from this tab's copy, so a counter tab and a second till tab firing at the
   * same moment cannot both mint KOT-0007. The series resets on a new business
   * day, which is why the date is decided here too.
   */
  const allocateKot = useCallback(
    async (
      at: string,
      seed: { ticketId: string; roundNumber: number; isCancellation: boolean },
      extraStores: DineStoreName[],
      build: (kot: DineKot) => Partial<Record<DineStoreName, unknown[]>>
    ) => {
      return dineAllocate<DineSettings, { kot: DineKot; nextSettings: DineSettings }>(
        "dine_settings",
        "main",
        ["dine_kots", ...extraStores],
        (stored) => {
          const current = settingsFrom(stored);
          const businessDate = businessDateOf(at, current.dayStartHour);
          const fresh = current.kotSeriesDate !== businessDate;
          const number = fresh ? 1 : current.nextKotNumber;
          const nextSettings: DineSettings = {
            ...current,
            nextKotNumber: number + 1,
            kotSeriesDate: businessDate,
          };
          const kot: DineKot = {
            id: generateId(),
            ticketId: seed.ticketId,
            kotNumber: number,
            kotLabel: formatSeriesNumber(current.kotPrefix, number),
            roundNumber: seed.roundNumber,
            businessDate,
            printedAt: at,
            reprintCount: 0,
            isCancellation: seed.isCancellation,
            status: "new",
            statusAt: at,
            createdAt: at,
          };
          return {
            writes: { ...build(kot), dine_kots: [kot], dine_settings: [nextSettings] },
            result: { kot, nextSettings },
          };
        }
      );
    },
    [settingsFrom]
  );

  const fireRound = useCallback(
    async (ticketId: string) => {
      const ticket = tickets.find((row) => row.id === ticketId);
      if (!ticket) return null;
      const round = ticket.roundsFired + 1;
      const pending = ticketItems.filter(
        (item) => item.ticketId === ticketId && item.roundNumber === round && item.firedAt === null
      );
      if (pending.length === 0) return null;

      const at = nowIso();
      const firedItems = pending.map((item) => ({ ...item, firedAt: at }));
      const nextTicket: DineTicket = { ...ticket, roundsFired: round };

      const { kot, nextSettings } = await allocateKot(
        at,
        { ticketId, roundNumber: round, isCancellation: false },
        ["dine_ticket_items", "dine_tickets"],
        () => ({ dine_ticket_items: firedItems, dine_tickets: [nextTicket] })
      );

      settingsRef.current = nextSettings;
      announce(["dine_ticket_items", "dine_tickets", "dine_kots", "dine_settings"]);

      // Deduct on fire rather than on settle: the moment the round reaches the
      // kitchen the ingredients are committed, whether or not the guest ever
      // pays for them.
      await consumeForItems(firedItems, kot.id, kot.kotLabel);

      setTicketItems((previous) =>
        previous.map((item) => firedItems.find((row) => row.id === item.id) ?? item)
      );
      setKots((previous) => [...previous, kot]);
      setTickets((previous) => previous.map((row) => (row.id === ticketId ? nextTicket : row)));
      setSettings(nextSettings);
      return kot;
    },
    [allocateKot, announce, consumeForItems, ticketItems, tickets]
  );

  /**
   * Pull a fired item. The kitchen is already cooking it, so this writes a
   * cancellation KOT as well as the record on the ticket — that trail is the
   * shrinkage and staff-error evidence an owner actually needs (FR-4.4).
   */
  const cancelTicketItem = useCallback(
    async (itemId: string, reason: string) => {
      const item = ticketItems.find((row) => row.id === itemId);
      if (!item || item.cancelledAt !== null) return null;
      if (item.firedAt === null) {
        await removeTicketItem(itemId);
        return null;
      }

      const at = nowIso();
      const cancelled = { ...item, cancelledAt: at, cancelReason: reason };

      const { kot, nextSettings } = await allocateKot(
        at,
        { ticketId: item.ticketId, roundNumber: item.roundNumber, isCancellation: true },
        ["dine_ticket_items"],
        () => ({ dine_ticket_items: [cancelled] })
      );

      settingsRef.current = nextSettings;
      announce(["dine_ticket_items", "dine_kots", "dine_settings"]);

      // The material was deducted when the round fired and it is not coming
      // back — the dish was cooked. What changes is why it left: this pair of
      // moves takes it out of "used in orders" and puts it into "wastage",
      // leaving stock untouched, so the waste report tells the truth about a
      // dish that was made and thrown away.
      if (settingsRef.current.inventoryEnabled) {
        const wasted = consumptionForTicketItem(cancelled, recipeIndexRef.current);
        if (wasted.length > 0) {
          const reasonNote = reason.trim() || "Cancelled after firing";
          await applyStock([
            ...wasted.map((entry) => ({
              materialId: entry.materialId,
              change: entry.quantity,
              reason: "consume" as const,
              note: "Reclassified as wastage",
              refId: item.ticketId,
              refLabel: kot.kotLabel,
            })),
            ...wasted.map((entry) => ({
              materialId: entry.materialId,
              change: -entry.quantity,
              reason: "wastage" as const,
              note: reasonNote,
              refId: item.ticketId,
              refLabel: kot.kotLabel,
            })),
          ]);
        }
      }

      setTicketItems((previous) => previous.map((row) => (row.id === itemId ? cancelled : row)));
      setKots((previous) => [...previous, kot]);
      setSettings(nextSettings);
      return kot;
    },
    [allocateKot, announce, applyStock, removeTicketItem, ticketItems]
  );

  const reprintKot = useCallback(async (kotId: string) => {
    setKots((previous) => {
      const next = previous.map((kot) =>
        kot.id === kotId ? { ...kot, reprintCount: kot.reprintCount + 1 } : kot
      );
      const changed = next.find((kot) => kot.id === kotId);
      if (changed) void commit({ dine_kots: [changed] });
      return next;
    });
  }, []);

  /**
   * Move a fired round along in the kitchen (FR-5.5, kitchen screen).
   *
   * Purely a kitchen-facing signal — nothing in billing, tax or reporting
   * reads it, so a restaurant that only prints slips is unaffected by it
   * existing.
   */
  const setKotStatus = useCallback(
    async (kotId: string, status: KotStatus) => {
      setKots((previous) => {
        const next = previous.map((kot) =>
          kot.id === kotId ? { ...kot, status, statusAt: nowIso() } : kot
        );
        const changed = next.find((kot) => kot.id === kotId);
        if (changed) void commit({ dine_kots: [changed] });
        return next;
      });
    },
    [commit]
  );

  /** Patch a ticket in place, persisting the change. */
  const patchTicket = useCallback((ticketId: string, updates: Partial<DineTicket>) => {
    setTickets((previous) => {
      const next = previous.map((ticket) =>
        ticket.id === ticketId ? { ...ticket, ...updates } : ticket
      );
      const changed = next.find((ticket) => ticket.id === ticketId);
      if (changed) void commit({ dine_tickets: [changed] });
      return next;
    });
  }, []);

  const setTicketDiscount = useCallback(
    async (
      ticketId: string,
      discountType: "flat" | "percent",
      discountValue: number,
      reason: string
    ) => {
      patchTicket(ticketId, { discountType, discountValue, discountReason: reason });
    },
    [patchTicket]
  );

  const setTicketServiceCharge = useCallback(
    async (ticketId: string, on: boolean) => {
      patchTicket(ticketId, { serviceChargeOn: on });
    },
    [patchTicket]
  );

  /**
   * Attach a diner to a ticket, creating the customer record if this is a new
   * name — which is what puts a regular into the Customer Ledger without
   * anyone having to add them twice.
   */
  const setTicketCustomer = useCallback(
    async (ticketId: string, customerId: string | null, name: string, address: string) => {
      const trimmed = name.trim();
      let linkedId = customerId;

      if (!linkedId && trimmed) {
        const existing = customers.find(
          (customer) => customer.name.trim().toLowerCase() === trimmed.toLowerCase()
        );
        if (existing) {
          linkedId = existing.id;
          if (address.trim() && address.trim() !== existing.address) {
            await updateCustomer(existing.id, { ...existing, address: address.trim() });
          }
        } else {
          const created = await createCustomer({
            name: trimmed,
            phone: "",
            email: "",
            address: address.trim(),
            notes: "",
          });
          linkedId = created.id;
        }
      }

      patchTicket(ticketId, {
        customerId: linkedId,
        customerName: trimmed,
        deliveryAddress: address,
      });
    },
    [createCustomer, customers, patchTicket, updateCustomer]
  );

  /**
   * Link a ticket to a customer already in the book.
   *
   * The name is copied onto the ticket rather than looked up later, so that a
   * bill printed tonight still reads the same after the customer is renamed —
   * and so the kitchen and the bill agree even if the record is deleted.
   */
  const setTicketCustomerById = useCallback(
    async (ticketId: string, customerId: string, address: string) => {
      const customer = customersRef.current.find((row) => row.id === customerId);
      if (!customer) return;
      if (address.trim() && address.trim() !== customer.address) {
        await updateCustomer(customerId, { ...customer, address: address.trim() });
      }
      patchTicket(ticketId, {
        customerId,
        customerName: customer.name,
        deliveryAddress: address,
      });
    },
    [patchTicket, updateCustomer]
  );

  const setTicketNote = useCallback(
    async (ticketId: string, note: string) => {
      patchTicket(ticketId, { note });
    },
    [patchTicket]
  );

  const moveTicketToTable = useCallback(
    async (ticketId: string, tableId: string | null) => {
      patchTicket(ticketId, { tableId });
    },
    [patchTicket]
  );

  /**
   * Fold one ticket into another (FR-6.6).
   *
   * The source's rounds are shifted past the target's so both tickets' fired
   * history stays in order and readable — round 1 of the absorbed table becomes
   * round 3 of the combined one rather than colliding with the target's round 1.
   */
  const mergeTickets = useCallback(
    async (sourceId: string, targetId: string) => {
      const source = tickets.find((ticket) => ticket.id === sourceId);
      const target = tickets.find((ticket) => ticket.id === targetId);
      if (!source || !target || sourceId === targetId) return;
      if (source.status !== "open" || target.status !== "open") return;

      const offset = target.roundsFired;
      const movedItems = ticketItems
        .filter((item) => item.ticketId === sourceId)
        .map((item) => ({ ...item, ticketId: targetId, roundNumber: item.roundNumber + offset }));
      const movedKots = kots
        .filter((kot) => kot.ticketId === sourceId)
        .map((kot) => ({ ...kot, ticketId: targetId, roundNumber: kot.roundNumber + offset }));

      const nextTarget: DineTicket = {
        ...target,
        roundsFired: target.roundsFired + source.roundsFired,
      };
      const nextSource: DineTicket = {
        ...source,
        status: "cancelled",
        mergedIntoId: targetId,
        settledAt: nowIso(),
      };

      await commit({
        dine_ticket_items: movedItems,
        dine_kots: movedKots,
        dine_tickets: [nextTarget, nextSource],
      });

      setTicketItems((previous) =>
        previous.map((item) => movedItems.find((row) => row.id === item.id) ?? item)
      );
      setKots((previous) => previous.map((kot) => movedKots.find((row) => row.id === kot.id) ?? kot));
      setTickets((previous) =>
        previous.map((ticket) => {
          if (ticket.id === targetId) return nextTarget;
          if (ticket.id === sourceId) return nextSource;
          return ticket;
        })
      );
    },
    [kots, ticketItems, tickets]
  );

  const cancelTicket = useCallback(
    async (ticketId: string, reason: string) => {
      patchTicket(ticketId, {
        status: "cancelled",
        settledAt: nowIso(),
        discountReason: reason,
      });
    },
    [patchTicket]
  );

  // ---------------------------------------------------------------------
  // Reservations
  // ---------------------------------------------------------------------

  /**
   * Take a booking.
   *
   * The deposit is only *asked for* here. Money is recorded by
   * takeReservationDeposit when it actually arrives, so a table booked over
   * the phone with "₹500 advance, they'll pay on UPI tonight" never counts
   * cash the restaurant does not hold.
   */
  const createReservation = useCallback(
    async (input: ReservationInput) => {
      const at = nowIso();
      const table = input.tableId ? tablesRef.current.find((row) => row.id === input.tableId) : null;
      const area = table ? areasRef.current.find((row) => row.id === table.areaId) : null;

      let customerId = input.customerId ?? null;
      if (!customerId && input.guestName.trim()) {
        const match = customersRef.current.find(
          (row) =>
            row.phone.replace(/\D/g, "") !== "" &&
            row.phone.replace(/\D/g, "") === input.phone.replace(/\D/g, "")
        );
        if (match) customerId = match.id;
      }

      const record: DineReservation = {
        id: generateId(),
        customerId,
        guestName: input.guestName.trim(),
        phone: input.phone.trim(),
        partySize: Math.max(input.partySize, 1),
        tableId: table?.id ?? null,
        tableName: table?.name ?? "",
        areaName: area?.name ?? "",
        startsAt: input.startsAt,
        durationMinutes: Math.max(input.durationMinutes, 15),
        status: "booked",
        depositRequired: Math.max(input.depositRequired, 0),
        depositPaid: 0,
        depositMethodId: "",
        depositMethodName: "",
        depositPaidAt: null,
        depositOutcome: "",
        ticketId: null,
        occasion: input.occasion.trim(),
        note: input.note.trim(),
        cancelReason: "",
        businessDate: businessDateOf(input.startsAt, settingsRef.current.dayStartHour),
        createdAt: at,
        updatedAt: at,
      };

      await commit({ dine_reservations: [record] });
      setReservations((previous) => [...previous, record]);
      return record;
    },
    [commit]
  );

  const patchReservation = useCallback(
    async (id: string, patch: Partial<DineReservation>) => {
      const current = reservationsRef.current.find((row) => row.id === id);
      if (!current) return null;
      const next: DineReservation = { ...current, ...patch, updatedAt: nowIso() };
      await commit({ dine_reservations: [next] });
      setReservations((previous) => previous.map((row) => (row.id === id ? next : row)));
      return next;
    },
    [commit]
  );

  const updateReservation = useCallback(
    async (id: string, input: ReservationInput) => {
      const table = input.tableId ? tablesRef.current.find((row) => row.id === input.tableId) : null;
      const area = table ? areasRef.current.find((row) => row.id === table.areaId) : null;
      return patchReservation(id, {
        customerId: input.customerId ?? null,
        guestName: input.guestName.trim(),
        phone: input.phone.trim(),
        partySize: Math.max(input.partySize, 1),
        tableId: table?.id ?? null,
        tableName: table?.name ?? "",
        areaName: area?.name ?? "",
        startsAt: input.startsAt,
        durationMinutes: Math.max(input.durationMinutes, 15),
        depositRequired: Math.max(input.depositRequired, 0),
        occasion: input.occasion.trim(),
        note: input.note.trim(),
        businessDate: businessDateOf(input.startsAt, settingsRef.current.dayStartHour),
      });
    },
    [patchReservation]
  );

  /**
   * Record an advance against a booking.
   *
   * Not a sale, and deliberately not a bill: this is money held against a meal
   * that has not happened. It becomes revenue when it comes off the ticket the
   * party eats (see seatReservation), or it is refunded or forfeited when they
   * do not come. Booking a table on a regular's khata is allowed too, which is
   * why a credit tender posts to the ledger instead.
   */
  const takeReservationDeposit = useCallback(
    async (id: string, amount: number, methodId: string) => {
      if (amount <= 0) return null;
      const current = reservationsRef.current.find((row) => row.id === id);
      if (!current) return null;
      const method = paymentMethodsRef.current.find((row) => row.id === methodId);

      if (method && kindOf(method) === "credit") {
        if (!current.customerId) return null;
        const posted = await postToLedger(
          depositLedgerEntry({
            customerId: current.customerId,
            customerName: current.guestName,
            amountPaise: amount,
            when: formatSlot(current.startsAt),
          })
        );
        if (!posted) return null;
      }

      return patchReservation(id, {
        depositPaid: current.depositPaid + amount,
        depositRequired: Math.max(current.depositRequired, current.depositPaid + amount),
        depositMethodId: methodId,
        depositMethodName: method?.name ?? "Cash",
        depositPaidAt: nowIso(),
      });
    },
    [patchReservation, postToLedger]
  );

  /**
   * The party has arrived: open their ticket and carry the advance onto it.
   *
   * The advance travels with the meal rather than staying on the booking so
   * whoever settles the bill sees it without needing to know a reservation
   * existed. A booking with no table gets seated wherever the floor puts them.
   */
  const seatReservation = useCallback(
    async (id: string, tableId?: string | null) => {
      const current = reservationsRef.current.find((row) => row.id === id);
      if (!current || current.status !== "booked") return null;

      const seatAt = tableId ?? current.tableId;
      const ticket = await openTicket("dine-in", seatAt ?? null);

      const patches: Partial<DineTicket> = {
        reservationId: current.id,
        customerId: current.customerId,
        customerName: current.guestName,
      };
      if (current.depositPaid > 0) {
        patches.advanceAmount = current.depositPaid;
        patches.advanceNote = `Booking advance · ${formatSlot(current.startsAt)}`;
      }
      await patchTicket(ticket.id, patches);

      const table = seatAt ? tablesRef.current.find((row) => row.id === seatAt) : null;
      const area = table ? areasRef.current.find((row) => row.id === table.areaId) : null;
      await patchReservation(id, {
        status: "seated",
        ticketId: ticket.id,
        tableId: table?.id ?? current.tableId,
        tableName: table?.name ?? current.tableName,
        areaName: area?.name ?? current.areaName,
        depositOutcome: current.depositPaid > 0 ? "applied" : current.depositOutcome,
      });
      return ticket;
    },
    [openTicket, patchReservation, patchTicket]
  );

  /**
   * Cancel a booking and say what happens to any advance.
   *
   * Refunding and keeping are both real answers, and the guest is told which
   * one in the cancellation message, so the choice is made here rather than
   * left implicit.
   */
  const cancelReservation = useCallback(
    async (id: string, reason: string, depositOutcome: "refunded" | "forfeited" = "refunded") => {
      const current = reservationsRef.current.find((row) => row.id === id);
      if (!current) return null;
      return patchReservation(id, {
        status: "cancelled",
        cancelReason: reason,
        depositOutcome: current.depositPaid > 0 ? depositOutcome : "",
      });
    },
    [patchReservation]
  );

  const markReservationNoShow = useCallback(
    async (id: string, depositOutcome: "refunded" | "forfeited" = "forfeited") => {
      const current = reservationsRef.current.find((row) => row.id === id);
      if (!current) return null;
      return patchReservation(id, {
        status: "no-show",
        depositOutcome: current.depositPaid > 0 ? depositOutcome : "",
      });
    },
    [patchReservation]
  );

  const deleteReservation = useCallback(
    async (id: string) => {
      await commit({}, { dine_reservations: [id] });
      setReservations((previous) => previous.filter((row) => row.id !== id));
    },
    [commit]
  );

  // ---------------------------------------------------------------------
  // Billing
  // ---------------------------------------------------------------------

  const itemsOfTicket = useCallback(
    (ticketId: string) =>
      ticketItems
        .filter((item) => item.ticketId === ticketId)
        .sort((a, b) => a.roundNumber - b.roundNumber || a.createdAt.localeCompare(b.createdAt)),
    [ticketItems]
  );

  const ticketTotals = useCallback(
    (ticketId: string): DineTotals => {
      const ticket = tickets.find((row) => row.id === ticketId);
      const items = ticketItems.filter((item) => item.ticketId === ticketId);
      return computeTicketTotals(items, {
        discountType: ticket?.discountType ?? "percent",
        discountValue: ticket?.discountValue ?? 0,
        serviceChargeOn: ticket?.serviceChargeOn ?? false,
        settings,
      });
    },
    [settings, ticketItems, tickets]
  );

  const billTicket = useCallback(
    async (ticketId: string, plan: SplitPlan) => {
      const ticket = tickets.find((row) => row.id === ticketId);
      if (!ticket) return [];
      const items = ticketItems.filter((item) => item.ticketId === ticketId).filter(isBillable);
      if (items.length === 0) return [];

      const current = settingsRef.current;
      const at = nowIso();
      const businessDate = businessDateOf(at, current.dayStartHour);
      const table = ticket.tableId ? tables.find((row) => row.id === ticket.tableId) : null;
      const area = table ? areas.find((row) => row.id === table.areaId) : null;

      const totalsInput = {
        discountType: ticket.discountType,
        discountValue: ticket.discountValue,
        serviceChargeOn: ticket.serviceChargeOn,
        settings: current,
      };

      // Work out the item grouping and per-part totals for each split shape.
      let parts: { items: DineTicketItem[]; totals: DineTotals }[];

      if (plan.mode === "items") {
        const claimed = new Set(plan.groups.flat());
        const leftovers = items.filter((item) => !claimed.has(item.id));
        const groups = plan.groups.map((ids) => items.filter((item) => ids.includes(item.id)));
        // Anything the user did not assign stays on the first part rather than
        // silently falling off the bill.
        if (leftovers.length > 0) groups[0] = [...(groups[0] ?? []), ...leftovers];
        parts = groups
          .filter((group) => group.length > 0)
          .map((group) => ({
            items: group,
            totals: computeTicketTotals(group, totalsInput),
          }));
      } else if (plan.mode === "equal" || plan.mode === "amount") {
        const whole = computeTicketTotals(items, totalsInput);
        const amounts =
          plan.mode === "equal"
            ? equalShares(whole.total, plan.parts)
            : // Force the shares to add back to the bill exactly, so a typo in
              // the last box cannot leave a table owing five paise forever.
              apportion(whole.total, plan.amounts.map((amount) => Math.max(amount, 0)));
        parts = splitTotalsByAmounts(whole, amounts).map((totals) => ({ items: [], totals }));
      } else {
        parts = [{ items, totals: computeTicketTotals(items, totalsInput) }];
      }

      const splitMode: SplitMode = plan.mode;
      const billRows: DineBill[] = [];
      const billItemRows: DineBillItem[] = [];
      // Placeholder numbers; the real series is allocated in the write below.
      let nextBillNumber = current.nextBillNumber;

      parts.forEach((part, index) => {
        const billId = generateId();
        const number = nextBillNumber;
        nextBillNumber += 1;

        billRows.push({
          id: billId,
          ticketId,
          billNumber: number,
          billLabel: formatSeriesNumber(current.billPrefix, number),
          splitIndex: index + 1,
          splitCount: parts.length,
          splitMode,
          status: "unpaid",
          orderType: ticket.orderType,
          tableName: table?.name ?? "",
          areaName: area?.name ?? "",
          customerId: ticket.customerId,
          customerName: ticket.customerName,
          businessDate,
          subtotal: part.totals.subtotal,
          discountType: ticket.discountType,
          discountValue: ticket.discountValue,
          discountAmount: part.totals.discountAmount,
          serviceChargeRate: ticket.serviceChargeOn ? current.serviceChargeRate : 0,
          serviceCharge: part.totals.serviceCharge,
          serviceChargeTax: part.totals.serviceChargeTax,
          taxBreakup: part.totals.taxBreakup,
          addedTax: part.totals.addedTax,
          includedTax: part.totals.includedTax,
          total: part.totals.total,
          createdAt: at,
          paidAt: null,
          cancelledAt: null,
          cancelReason: "",
        });

        part.items.forEach((item, itemIndex) => {
          const unitCost = current.inventoryEnabled
            ? recipeCost(
                consumptionForTicketItem({ ...item, quantity: 1 }, recipeIndexRef.current),
                materialsRef.current
              )
            : 0;
          billItemRows.push({
            id: generateId(),
            billId,
            ticketItemId: item.id,
            menuItemId: item.menuItemId,
            variationId: item.variationId,
            unitCost,
            name: item.name,
            variationName: item.variationName,
            modifiers: item.modifiers,
            note: item.note,
            unitPrice: lineUnitPrice(item),
            quantity: item.quantity,
            taxRate: item.taxRate,
            taxInclusive: item.taxInclusive,
            lineTotal: lineTotal(item),
            sortOrder: itemIndex,
          });
        });
      });

      // Stamp each line with the bill that claimed it, so an item split cannot
      // put the same dish on two bills.
      const claimedItems: DineTicketItem[] = [];
      parts.forEach((part, index) => {
        const billId = billRows[index].id;
        part.items.forEach((item) => claimedItems.push({ ...item, billId }));
      });

      const nextTicket: DineTicket = { ...ticket, status: "billed" };

      // Re-read the counter inside the write so two tills billing different
      // tables at once cannot hand out the same bill number. The rows were
      // built optimistically above; only their numbers are corrected here.
      const nextSettings = await dineAllocate<DineSettings, DineSettings>(
        "dine_settings",
        "main",
        ["dine_bills", "dine_bill_items", "dine_ticket_items", "dine_tickets"],
        (stored) => {
          const live = settingsFrom(stored);
          let number = live.nextBillNumber;
          for (const bill of billRows) {
            bill.billNumber = number;
            bill.billLabel = formatSeriesNumber(live.billPrefix, number);
            number += 1;
          }
          const settingsRow: DineSettings = { ...live, nextBillNumber: number };
          return {
            writes: {
              dine_bills: billRows,
              dine_bill_items: billItemRows,
              dine_ticket_items: claimedItems,
              dine_tickets: [nextTicket],
              dine_settings: [settingsRow],
            },
            result: settingsRow,
          };
        }
      );
      settingsRef.current = nextSettings;
      announce([
        "dine_bills",
        "dine_bill_items",
        "dine_ticket_items",
        "dine_tickets",
        "dine_settings",
      ]);

      setBills((previous) => [...previous, ...billRows]);
      setBillItems((previous) => [...previous, ...billItemRows]);
      if (claimedItems.length > 0) {
        setTicketItems((previous) =>
          previous.map((item) => claimedItems.find((row) => row.id === item.id) ?? item)
        );
      }
      setTickets((previous) => previous.map((row) => (row.id === ticketId ? nextTicket : row)));
      setSettings(nextSettings);
      return billRows;
    },
    [announce, areas, settingsFrom, tables, ticketItems, tickets]
  );

  /** Undo billing while nothing has been paid, so a table can keep ordering. */
  const unbillTicket = useCallback(
    async (ticketId: string) => {
      const ticket = tickets.find((row) => row.id === ticketId);
      if (!ticket || ticket.status !== "billed") return;
      const ticketBills = bills.filter((bill) => bill.ticketId === ticketId);
      if (ticketBills.some((bill) => bill.status === "paid")) return;

      const billIds = ticketBills.map((bill) => bill.id);
      const releasedItems = ticketItems
        .filter((item) => item.ticketId === ticketId && item.billId !== null)
        .map((item) => ({ ...item, billId: null }));
      const nextTicket: DineTicket = { ...ticket, status: "open" };

      await commit(
        { dine_ticket_items: releasedItems, dine_tickets: [nextTicket] },
        {
          dine_bills: billIds,
          dine_bill_items: billItems
            .filter((item) => billIds.includes(item.billId))
            .map((item) => item.id),
          dine_bill_payments: billPayments
            .filter((payment) => billIds.includes(payment.billId))
            .map((payment) => payment.id),
        }
      );

      setBills((previous) => previous.filter((bill) => !billIds.includes(bill.id)));
      setBillItems((previous) => previous.filter((item) => !billIds.includes(item.billId)));
      setBillPayments((previous) =>
        previous.filter((payment) => !billIds.includes(payment.billId))
      );
      setTicketItems((previous) =>
        previous.map((item) => releasedItems.find((row) => row.id === item.id) ?? item)
      );
      setTickets((previous) => previous.map((row) => (row.id === ticketId ? nextTicket : row)));
    },
    [billItems, billPayments, bills, ticketItems, tickets]
  );

  /**
   * Record tenders against a bill and settle it.
   *
   * Several tenders may land on one bill (₹500 cash + ₹300 UPI, FR-6.7). When
   * the last unpaid bill of a ticket is settled the ticket itself closes, which
   * is what frees the table on the floor (FR-6.8).
   */
  const payBill = useCallback(
    async (billId: string, tenders: TenderInput[]) => {
      const bill = bills.find((row) => row.id === billId);
      if (!bill || bill.status !== "unpaid") return;

      const at = nowIso();
      const paymentRows: DineBillPayment[] = tenders
        .filter((tender) => tender.amount > 0)
        .map((tender) => {
          const method = paymentMethods.find((row) => row.id === tender.methodId);
          return {
            id: generateId(),
            billId,
            methodId: tender.methodId,
            methodName: method?.name ?? "Cash",
            amount: tender.amount,
            note: tender.note ?? "",
            createdAt: at,
            kind: method ? kindOf(method) : "normal",
          };
        });
      if (paymentRows.length === 0) return;

      const nextBill: DineBill = { ...bill, status: "paid", paidAt: at };
      const writes: Partial<Record<DineStoreName, unknown[]>> = {
        dine_bill_payments: paymentRows,
        dine_bills: [nextBill],
      };

      const siblings = bills.filter(
        (row) => row.ticketId === bill.ticketId && row.id !== billId && row.status === "unpaid"
      );
      const ticket = tickets.find((row) => row.id === bill.ticketId);
      let nextTicket: DineTicket | null = null;
      if (ticket && siblings.length === 0) {
        nextTicket = { ...ticket, status: "settled", settledAt: at };
      }

      // An advance is money already taken at booking time; spending it here is
      // what turns it from money held into revenue, so it must not stay on the
      // ticket where a second bill could spend it again.
      //
      // Whatever is left when the ticket closes has to go too. A guest who put
      // down 500 and ate 40 is owed 460 back at the counter — leaving it on a
      // settled ticket would be a number nobody can ever spend, which reads as
      // money the restaurant still holds when it does not.
      const advanceSpent = paymentRows
        .filter((row) => kindOf({ kind: row.kind }) === "advance")
        .reduce((sum, row) => sum + row.amount, 0);
      const held = ticket?.advanceAmount ?? 0;
      if (ticket && (advanceSpent > 0 || (nextTicket && held > 0))) {
        const base = nextTicket ?? ticket;
        // Settling the ticket discharges the rest; a part-bill keeps it for
        // the next split.
        const remaining = nextTicket ? 0 : Math.max(held - advanceSpent, 0);
        nextTicket = { ...base, advanceAmount: remaining };
      }
      if (nextTicket) writes.dine_tickets = [nextTicket];

      // Putting a bill on account moves what the diner owes. That has to land
      // in the same transaction as the bill being marked paid — a bill settled
      // on credit with no charge behind it is a meal given away.
      const onAccount = paymentRows
        .filter((row) => kindOf({ kind: row.kind }) === "credit")
        .reduce((sum, row) => sum + row.amount, 0);

      let ledgerEntry: LedgerEntry | null = null;
      if (onAccount > 0 && bill.customerId) {
        ledgerEntry = billLedgerEntry({
          customerId: bill.customerId,
          customerName: bill.customerName,
          amountPaise: onAccount,
          billLabel: bill.billLabel,
        });
        const posted = await postToLedger(ledgerEntry);
        if (!posted) {
          throw new Error(
            "Could not reach the Customer Ledger, so this bill was not put on account."
          );
        }
      }

      try {
        await commit(writes);
      } catch (error) {
        // The charge went in first; take it back out rather than leave a diner
        // owing for a bill that does not exist.
        if (ledgerEntry) await unpostFromLedger(ledgerEntry.id);
        throw error;
      }

      setBillPayments((previous) => [...previous, ...paymentRows]);
      setBills((previous) => previous.map((row) => (row.id === billId ? nextBill : row)));
      if (nextTicket) {
        const settled = nextTicket;
        setTickets((previous) => previous.map((row) => (row.id === settled.id ? settled : row)));
      }
    },
    [bills, commit, paymentMethods, postToLedger, tickets, unpostFromLedger]
  );

  /** FR-6.9: a settled bill can be voided, but the record always survives. */
  const cancelBill = useCallback(
    async (billId: string, reason: string) => {
      const bill = bills.find((row) => row.id === billId);
      if (!bill || bill.status === "cancelled") return;
      const next: DineBill = {
        ...bill,
        status: "cancelled",
        cancelledAt: nowIso(),
        cancelReason: reason,
      };
      await commit({ dine_bills: [next] });
      setBills((previous) => previous.map((row) => (row.id === billId ? next : row)));
    },
    [bills]
  );

  // ---------------------------------------------------------------------
  // Payment methods and security
  // ---------------------------------------------------------------------

  const addPaymentMethod = useCallback(
    async (name: string) => {
      const record: DinePaymentMethod = {
        id: generateId(),
        name: name.trim(),
        isDefault: false,
        sortOrder: paymentMethods.length,
        createdAt: nowIso(),
        kind: "normal",
      };
      await commit({ dine_payment_methods: [record] });
      setPaymentMethods((previous) => [...previous, record]);
    },
    [paymentMethods.length]
  );

  /** Built-in tenders are wired into billing by kind, so they cannot go. */
  const deletePaymentMethod = useCallback(async (id: string) => {
    const method = paymentMethodsRef.current.find((row) => row.id === id);
    if (method?.builtIn) return;
    await commit({}, { dine_payment_methods: [id] });
    setPaymentMethods((previous) => previous.filter((method) => method.id !== id));
  }, []);

  /**
   * Make sure the reserved tenders exist for whichever features are on.
   *
   * Created on demand rather than seeded at setup so a restaurant that never
   * turns credit on never sees an "On account" option — and so turning it on
   * years later still works, including in a browser restored from a backup
   * written before either feature existed.
   */
  const ensureReservedMethods = useCallback(
    async (want: { credit: boolean; advance: boolean }) => {
      const existing = paymentMethodsRef.current;
      const missing: DinePaymentMethod[] = [];
      const at = nowIso();
      const needs: [PaymentMethodKind, string, boolean][] = [
        ["credit", CREDIT_METHOD_NAME, want.credit],
        ["advance", ADVANCE_METHOD_NAME, want.advance],
      ];

      for (const [kind, name, wanted] of needs) {
        if (!wanted) continue;
        if (existing.some((row) => kindOf(row) === kind)) continue;
        missing.push({
          id: generateId(),
          name,
          isDefault: false,
          sortOrder: existing.length + missing.length,
          createdAt: at,
          kind,
          builtIn: true,
        });
      }
      if (missing.length === 0) return;
      await commit({ dine_payment_methods: missing });
      setPaymentMethods((previous) => [...previous, ...missing]);
    },
    [commit]
  );

  // Keep them in step with the feature switches, including after a restore.
  useEffect(() => {
    if (status !== "ready") return;
    if (!settings.creditEnabled && !settings.reservationsEnabled) return;
    void ensureReservedMethods({
      credit: settings.creditEnabled,
      advance: settings.reservationsEnabled,
    });
  }, [ensureReservedMethods, settings.creditEnabled, settings.reservationsEnabled, status]);

  /**
   * Pull in the shared customer book and the shared ledger once the app is up.
   *
   * Both live in another tool's database, so there is no live channel to
   * listen on the way there is for Free Dine's own stores. Refreshing on focus
   * is what keeps the balance shown at the payment screen honest after someone
   * has settled a tab in the Customer Ledger in another tab.
   */
  useEffect(() => {
    if (status !== "ready") return;
    void importWorkspaceCustomers();
    void refreshLedger();

    const onFocus = () => {
      void importWorkspaceCustomers();
      void refreshLedger();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [importWorkspaceCustomers, refreshLedger, status]);

  const setPin = useCallback(
    async (pin: string) => {
      const salt = generateSalt();
      const pinHash = await hashPin(pin, salt);
      await writeSettings({ pinHash, pinSalt: salt });
    },
    [writeSettings]
  );

  const clearPin = useCallback(async () => {
    await writeSettings({ pinHash: "", pinSalt: "" });
  }, [writeSettings]);

  // ---------------------------------------------------------------------
  // Data safety
  // ---------------------------------------------------------------------

  /** Count a call against today's tally, so the UI can show sheet usage. */
  const countSheetCall = useCallback(() => {
    const today = new Date().toISOString().slice(0, 10);
    setSheetCallsToday((previous) => {
      const next = previous + 1;
      try {
        window.localStorage.setItem(SYNC_CALLS_KEY, JSON.stringify({ date: today, count: next }));
      } catch {
        // Counting is a convenience; losing it changes nothing.
      }
      return next;
    });
  }, []);

  const markSynced = useCallback(async (slices: DineSyncSlice[]) => {
    const at = nowIso();
    setSheetLastSyncAt(at);
    try {
      window.localStorage.setItem(SYNC_LAST_KEY, at);
    } catch {
      // Status only.
    }
    await dineBatch({}, { dine_sync_queue: slices });
    setDirtySlices((previous) => previous.filter((slice) => !slices.includes(slice)));
  }, []);

  /**
   * Push the dirty slices to the sheet.
   *
   * Whole tabs are rewritten rather than appended, which makes a push
   * idempotent and — more usefully — makes deletions propagate. A menu item
   * removed here disappears from the sheet on the next sync instead of
   * lingering as a row nobody can explain.
   */
  const pushSlices = useCallback(
    async (slices: DineSyncSlice[]) => {
      const url = settingsRef.current.sheetSyncUrl;
      const snapshot = snapshotRef.current;
      if (!url || !snapshot || slices.length === 0) return;

      setSheetSyncing(true);
      setSheetLastError("");
      try {
        await pushToDineSheet(url, buildDineTabPayloads(snapshot, slices));
        countSheetCall();
        await markSynced(slices);
      } catch (error) {
        setSheetLastError(
          error instanceof Error ? error.message : "Could not reach the sheet."
        );
      } finally {
        setSheetSyncing(false);
      }
    },
    [countSheetCall, markSynced]
  );

  const connectSheet = useCallback(
    async (url: string) => {
      const trimmed = url.trim();
      if (!isValidSyncUrl(trimmed)) {
        throw new Error("That does not look like an Apps Script web-app URL.");
      }
      const result = await testDineSheetConnection(trimmed);
      countSheetCall();
      if (!result.ok) throw new Error(result.error ?? "Could not reach the sheet.");
      await writeSettings({ sheetSyncUrl: trimmed });
      // A freshly connected sheet is empty, so everything is dirty.
      setDirtySlices([...DINE_SYNC_SLICES]);
      await dineBatch({
        dine_sync_queue: DINE_SYNC_SLICES.map((id) => ({ id, dirtyAt: nowIso() })),
      });
    },
    [countSheetCall, writeSettings]
  );

  const disconnectSheet = useCallback(async () => {
    await writeSettings({ sheetSyncUrl: "" });
    setSheetLastError("");
  }, [writeSettings]);

  const syncSheetNow = useCallback(async () => {
    await pushSlices(dirtySlices.length ? dirtySlices : [...DINE_SYNC_SLICES]);
  }, [dirtySlices, pushSlices]);

  const resyncSheetAll = useCallback(async () => {
    await pushSlices([...DINE_SYNC_SLICES]);
  }, [pushSlices]);

  const restoreFromSheet = useCallback(
    async (url: string) => {
      const trimmed = url.trim();
      if (!isValidSyncUrl(trimmed)) {
        throw new Error("That does not look like an Apps Script web-app URL.");
      }
      setSheetSyncing(true);
      setSheetLastError("");
      try {
        const pull = await pullFromDineSheet(trimmed);
        countSheetCall();
        const backup = buildBackupFromDineSheetPull(pull, trimmed);
        await restoreDineBackup(backup);
        const restored = await loadAll();
        setStatus(restored ? "ready" : "welcome");
      } finally {
        setSheetSyncing(false);
      }
    },
    [countSheetCall, loadAll]
  );

  const exportBackup = useCallback(async () => {
    const backup = await createDineBackup();
    downloadDineBackup(backup);
    await writeSettings({ lastBackupAt: backup.exportedAt });
  }, [writeSettings]);

  const applyRestoredBackup = useCallback(
    async (backup: DineBackup) => {
      await restoreDineBackup(backup);
      const restored = await loadAll();
      setStatus(restored ? "ready" : "welcome");
    },
    [loadAll]
  );

  const resetAll = useCallback(async () => {
    await dineClearAll();
    setBusiness(null);
    setSettings(DEFAULT_DINE_SETTINGS);
    settingsRef.current = DEFAULT_DINE_SETTINGS;
    setCategories([]);
    setAreas([]);
    setTables([]);
    setMenuItems([]);
    setVariations([]);
    setModifierGroups([]);
    setModifiers([]);
    setTickets([]);
    setTicketItems([]);
    setKots([]);
    setBills([]);
    setBillItems([]);
    setBillPayments([]);
    setPaymentMethods([]);
    setCustomers([]);
    setMaterials([]);
    setRecipeLines([]);
    setStockMoves([]);
    setStatus("welcome");
  }, []);

  // ---------------------------------------------------------------------
  // Derived views
  // ---------------------------------------------------------------------

  const openTickets = useMemo(
    () => tickets.filter((ticket) => ticket.status === "open" || ticket.status === "billed"),
    [tickets]
  );

  const floorTables = useMemo<FloorTable[]>(() => {
    const areaById = new Map(areas.map((area) => [area.id, area]));
    const ticketByTable = new Map<string, DineTicket>();
    for (const ticket of openTickets) {
      if (ticket.tableId) ticketByTable.set(ticket.tableId, ticket);
    }

    return tables
      .slice()
      .sort(
        (a, b) =>
          (areaById.get(a.areaId)?.sortOrder ?? 0) - (areaById.get(b.areaId)?.sortOrder ?? 0) ||
          a.sortOrder - b.sortOrder
      )
      .map((table) => {
        const ticket = ticketByTable.get(table.id) ?? null;
        const items = ticket
          ? ticketItems.filter((item) => item.ticketId === ticket.id && isBillable(item))
          : [];
        const totals = ticket
          ? computeTicketTotals(items, {
              discountType: ticket.discountType,
              discountValue: ticket.discountValue,
              serviceChargeOn: ticket.serviceChargeOn,
              settings,
            })
          : null;
        return {
          table,
          areaName: areaById.get(table.areaId)?.name ?? "",
          state: ticket ? (ticket.status === "billed" ? "billed" : "occupied") : "free",
          ticket,
          runningTotal: totals?.total ?? 0,
          openedAt: ticket?.openedAt ?? null,
          itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
          unfiredCount: items.filter((item) => item.firedAt === null).length,
          readyCount: ticket
            ? kots.filter(
                (kot) =>
                  kot.ticketId === ticket.id && !kot.isCancellation && kotStatusOf(kot) === "ready"
              ).length
            : 0,
        };
      });
  }, [areas, kots, openTickets, settings, tables, ticketItems]);

  const todayDate = useMemo(
    () => businessDateOf(nowIso(), settings.dayStartHour),
    [settings.dayStartHour]
  );

  const value: DineContextValue = {
    status,
    errorMessage,
    business,
    settings,
    categories,
    areas,
    tables,
    menuItems,
    variations,
    modifierGroups,
    modifiers,
    tickets,
    ticketItems,
    kots,
    bills,
    billItems,
    billPayments,
    paymentMethods,
    customers,

    startSetup,
    backToWelcome,
    completeSetup,
    updateBusiness,
    updateSettings,

    createCategory,
    renameCategory,
    deleteCategory,
    reorderCategories,

    createMenuItem,
    updateMenuItem,
    deleteMenuItem,
    setItemAvailable,
    importMenu,

    createArea,
    renameArea,
    deleteArea,
    createTable,
    updateTable,
    deleteTable,
    addTables,

    openTicket,
    addTicketItems,
    updateTicketItemQuantity,
    updateTicketItemNote,
    removeTicketItem,
    cancelTicketItem,
    fireRound,
    reprintKot,
    setKotStatus,
    setTicketDiscount,
    setTicketServiceCharge,
    setTicketCustomer,
    setTicketCustomerById,
    setTicketNote,
    moveTicketToTable,
    mergeTickets,
    cancelTicket,

    billTicket,
    unbillTicket,
    payBill,
    cancelBill,

    createCustomer,
    updateCustomer,
    deleteCustomer,

    ledgerEntries,
    refreshLedger,

    reservations,
    createReservation,
    updateReservation,
    takeReservationDeposit,
    seatReservation,
    cancelReservation,
    markReservationNoShow,
    deleteReservation,

    addPaymentMethod,
    deletePaymentMethod,

    setPin,
    clearPin,

    materials,
    recipeLines,
    stockMoves,
    recipeIndex,

    createMaterial,
    updateMaterial,
    deleteMaterial,
    setRecipe,
    addStock,
    recordWastage,
    setStockLevel,

    sheetSync: {
      url: settings.sheetSyncUrl,
      dirtyCount: dirtySlices.length,
      syncing: sheetSyncing,
      lastSyncAt: sheetLastSyncAt,
      lastError: sheetLastError,
      callsToday: sheetCallsToday,
    },
    connectSheet,
    disconnectSheet,
    syncSheetNow,
    resyncSheetAll,
    restoreFromSheet,

    exportBackup,
    applyRestoredBackup,
    resetAll,

    ticketTotals,
    itemsOfTicket,
    floorTables,
    openTickets,
    todayDate,
  };

  return <DineContext.Provider value={value}>{children}</DineContext.Provider>;
}

export function useDine(): DineContextValue {
  const context = useContext(DineContext);
  if (!context) {
    throw new Error("useDine must be used inside a DineProvider.");
  }
  return context;
}

export { DINE_STORES };

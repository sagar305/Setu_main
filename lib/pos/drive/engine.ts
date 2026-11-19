// Google Drive team sync for the Browser Based POS: the part that talks to
// Drive and IndexedDB. Browser only. See hub.ts for the file layout and why
// the owner's main device is the hub.

import {
  dbBatchRaw,
  dbClearAll,
  dbGet,
  dbGetAll,
  setCaptureSink,
  type StoreName,
} from "../db";
import { DEFAULT_SETTINGS, type Order, type PosSettings } from "../types";
import { DriveClient, DriveError } from "./api";
import { currentToken, requestToken } from "./auth";
import { captureOps } from "./capture";
import {
  TEAM_APP,
  TEAM_FILE_VERSION,
  authorsForExisting,
  baseFromLocal,
  baseFromPublished,
  buildBooksFile,
  buildShopFile,
  isShopFile,
  memberStores,
  mergeInto,
  mergedStores,
  planApply,
  type BooksFile,
  type ChangesFileBody,
  type LocalSnapshot,
  type ShopFile,
  type TeamMember,
} from "./hub";
import { DEFAULT_CASHIER_PERMISSIONS, type MemberPermissions, type Op, type Role } from "./ops";
import { checkSale, type SaleCheck } from "./roles";
import { CORE_STORES, syncedStores } from "./scope";

// ---------------------------------------------------------------------------
// State kept on this device (IndexedDB store drive_state, row "main")
// ---------------------------------------------------------------------------

export type RejectedNote = { memberCode: string; reason: string; what: string; at: string };

export type TeamState = {
  id: "main";
  shopName: string;
  /** This device is the owner's hub (turned sync on). */
  isPrimary: boolean;
  memberCode: string;
  role: Role;
  email: string;
  permissions: MemberPermissions;
  shopFileId: string;
  booksFileId: string | null;
  /** This member's changes file; null on the hub. */
  ownFileId: string | null;
  folderId: string | null;
  members: TeamMember[];
  consumed: Record<string, number>;
  orderAuthors: Record<string, string>;
  /** fileId → modifiedTime of the copy last read. */
  remoteSeen: Record<string, string>;
  /** Operations already uploaded from this device (members). */
  uploaded: number;
  lastSyncAt: string | null;
  lastError: string;
  needsSignIn: boolean;
  rejected: RejectedNote[];
  oversold: string[];
  /** The owner removed this member. */
  removed: boolean;
};

type OpRow = { id: string; seq: number; op: Op };

export type InvitePayload = {
  v: 1;
  /** Shop name, for the join screen. */
  n: string;
  /** shop.json, books.json (owners only) and the member's changes file. */
  s: string;
  b: string | null;
  f: string;
  c: string;
  e: string;
};

// ---------------------------------------------------------------------------
// Session: shared with the POS store (checkout limits, invoice series)
// ---------------------------------------------------------------------------

let session: TeamState | null = null;
const dataListeners = new Set<() => void>();

/** Called after sync wrote team data into this device's database. */
export function onTeamDataChanged(listener: () => void): () => void {
  dataListeners.add(listener);
  return () => dataListeners.delete(listener);
}

async function applyPlan(plan: { writes: Record<string, unknown[]>; deletes: Record<string, string[]> }) {
  if (!Object.keys(plan.writes).length && !Object.keys(plan.deletes).length) return;
  await dbBatchRaw(plan.writes as never, plan.deletes as never);
  dataListeners.forEach((l) => l());
}
let connectedTools: readonly string[] = [];
const listeners = new Set<(state: TeamState | null) => void>();

export function getTeamSession(): TeamState | null {
  return session;
}

export function subscribeTeam(listener: (state: TeamState | null) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function publishSession(state: TeamState | null) {
  session = state;
  listeners.forEach((l) => l(state));
}

/** The POS tells sync which tools are switched on (they decide what syncs). */
export function setConnectedTools(tools: readonly string[] | undefined) {
  connectedTools = tools ?? [];
}

/** Checkout limits for this device's member; always ok when not in a team. */
export function checkTeamSale(order: Pick<Order, "subtotal" | "discountAmount" | "paymentMethodId">): SaleCheck {
  const s = session;
  if (!s || s.removed) return { ok: true };
  return checkSale({ email: s.email, role: s.role, code: s.memberCode, addedAt: "", permissions: s.permissions }, order);
}

/** Members other than the hub bill in their own series, e.g. INV-C1-00001. */
export function teamInvoicePrefix(basePrefix: string): string {
  const s = session;
  if (!s || s.isPrimary) return basePrefix;
  return `${basePrefix}${s.memberCode}-`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export class NeedsSignInError extends Error {
  constructor() {
    super("Google sign-in has expired. Tap Reconnect to keep syncing.");
    this.name = "NeedsSignInError";
  }
}

/** Never opens a popup by itself; a popup needs the user's tap. */
const drive = new DriveClient(async () => {
  const token = currentToken();
  if (!token) throw new NeedsSignInError();
  return token;
});

let opCounter = 0;
function newOpId(code: string) {
  opCounter = (opCounter + 1) % 1_000_000;
  return `${code}-${Date.now().toString(36)}-${opCounter.toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

async function saveState(state: TeamState) {
  await dbBatchRaw({ drive_state: [state] });
  publishSession(state);
}

const ALL_DATA_STORES = (synced: ReadonlySet<string>) =>
  Array.from(new Set<string>([...CORE_STORES, ...synced]));

async function readSnapshot(stores: readonly string[]): Promise<LocalSnapshot> {
  const out: LocalSnapshot = {};
  for (const store of stores) out[store] = await dbGetAll(store as StoreName);
  return out;
}

async function readOps(): Promise<Op[]> {
  const rows = await dbGetAll<OpRow>("drive_ops");
  return rows.sort((a, b) => a.seq - b.seq).map((r) => r.op);
}

/** Stop the device keeping batches while it is in a team. */
async function forceBatchTrackingOff() {
  const settings = await dbGet<PosSettings>("settings", "main");
  if (settings?.batchTracking) await dbBatchRaw({ settings: [{ ...settings, batchTracking: false }] });
}

function summarize(op: Op): string {
  switch (op.type) {
    case "order.create":
      return `sale ${op.order.invoiceNumber}`;
    case "product.upsert":
      return `product "${op.product.name}"`;
    case "stock.move":
      return `stock change ${op.move.change > 0 ? "+" : ""}${op.move.change}`;
    default:
      return op.type.replace(".", " ");
  }
}

export function encodeInvite(payload: InvitePayload): string {
  const json = JSON.stringify(payload);
  return btoa(unescape(encodeURIComponent(json))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeInvite(text: string): InvitePayload | null {
  try {
    const b64 = text.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(escape(atob(b64 + "===".slice((b64.length + 3) % 4))));
    const p = JSON.parse(json) as InvitePayload;
    return p && p.v === 1 && p.s && p.f && p.c ? p : null;
  } catch {
    return null;
  }
}

export function inviteLink(payload: InvitePayload): string {
  return `${window.location.origin}/products/browser-based-pos?join=${encodeInvite(payload)}`;
}

// ---------------------------------------------------------------------------
// Capture
// ---------------------------------------------------------------------------

function activateCapture(state: TeamState | null) {
  if (!state || state.removed) {
    setCaptureSink(null);
    return;
  }
  let seq = Date.now() * 1000;
  setCaptureSink((write) => {
    const ops = captureOps(write, {
      role: state.role,
      synced: syncedStores(connectedTools),
      newId: () => newOpId(state.memberCode),
      now: new Date().toISOString(),
    });
    return ops.map((op) => ({ id: op.id, seq: seq++, op }));
  });
}

/** Load this device's team membership (if any) and start capturing writes. */
export async function loadTeam(): Promise<TeamState | null> {
  const state = (await dbGet<TeamState>("drive_state", "main")) ?? null;
  activateCapture(state);
  publishSession(state);
  return state;
}

/** Sign in with Google (must run from a tap). */
export async function signIn(): Promise<void> {
  await requestToken(true);
  if (session?.needsSignIn) await saveState({ ...session, needsSignIn: false, lastError: "" });
}

// ---------------------------------------------------------------------------
// Owner: turn sync on, invite, change, remove
// ---------------------------------------------------------------------------

export async function enableTeam(shopName: string): Promise<TeamState> {
  if (!currentToken()) await requestToken(true);
  const me = await drive.about();
  await forceBatchTrackingOff();
  const synced = syncedStores(connectedTools);
  const local = await readSnapshot(ALL_DATA_STORES(synced));
  const now = new Date().toISOString();
  const code = "O";
  const members: TeamMember[] = [
    { email: me.emailAddress, role: "owner", code, addedAt: now, fileId: "", name: me.displayName },
  ];
  const orderAuthors = authorsForExisting((local.orders ?? []) as unknown as Order[], code, {});

  const folder = await drive.createFolder(`Setu POS – ${shopName}`);
  const shop = await drive.createJson(
    "shop.json",
    folder.id,
    buildShopFile(local, shopName, code, members, {}, now),
  );
  const books = await drive.createJson("books.json", folder.id, buildBooksFile(local, synced, orderAuthors, now));

  const state: TeamState = {
    id: "main",
    shopName,
    isPrimary: true,
    memberCode: code,
    role: "owner",
    email: me.emailAddress,
    permissions: DEFAULT_CASHIER_PERMISSIONS,
    shopFileId: shop.id,
    booksFileId: books.id,
    ownFileId: null,
    folderId: folder.id,
    members,
    consumed: {},
    orderAuthors,
    remoteSeen: {},
    uploaded: 0,
    lastSyncAt: now,
    lastError: "",
    needsSignIn: false,
    rejected: [],
    oversold: [],
    removed: false,
  };
  await dbBatchRaw({ drive_ops: [] });
  await saveState(state);
  activateCapture(state);
  return state;
}

function requirePrimary(): TeamState {
  if (!session?.isPrimary) throw new Error("Only the owner's main device can manage the team.");
  return session;
}

export type InviteInput = {
  email: string;
  name: string;
  role: Role;
  permissions: MemberPermissions;
};

export async function inviteMember(input: InviteInput): Promise<string> {
  const state = requirePrimary();
  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email address.");
  if (state.members.some((m) => m.email.toLowerCase() === email && !m.removedAt)) {
    throw new Error("This person is already in your team.");
  }
  const prefix = input.role === "owner" ? "O" : "C";
  let n = 1;
  while (state.members.some((m) => m.code === `${prefix}${n}`)) n += 1;
  const code = `${prefix}${n}`;

  const body: ChangesFileBody = { app: TEAM_APP, memberCode: code, ops: [] };
  const file = await drive.createJson(`changes-${code}.json`, state.folderId!, body);
  await drive.share(file.id, email, "writer", false);
  const payload: InvitePayload = {
    v: 1,
    n: state.shopName,
    s: state.shopFileId,
    b: input.role === "owner" ? state.booksFileId : null,
    f: file.id,
    c: code,
    e: email,
  };
  const link = inviteLink(payload);
  await drive.share(
    state.shopFileId,
    email,
    "reader",
    true,
    `You're invited to ${state.shopName} on Setu Browser Based POS. Open this link to join: ${link}`,
  );
  if (payload.b) await drive.share(payload.b, email, "reader", false);

  const member: TeamMember = {
    email,
    name: input.name.trim(),
    role: input.role,
    code,
    addedAt: new Date().toISOString(),
    fileId: file.id,
    permissions: input.role === "cashier" ? input.permissions : undefined,
  };
  const next = { ...state, members: [...state.members, member] };
  await saveState(next);
  await publish(next);
  return link;
}

export function memberInviteLink(code: string): string | null {
  const s = session;
  const m = s?.members.find((x) => x.code === code);
  if (!s || !m || !m.fileId) return null;
  return inviteLink({
    v: 1,
    n: s.shopName,
    s: s.shopFileId,
    b: m.role === "owner" ? s.booksFileId : null,
    f: m.fileId,
    c: m.code,
    e: m.email,
  });
}

export async function updateMember(code: string, patch: { permissions?: MemberPermissions; name?: string }) {
  const state = requirePrimary();
  const members = state.members.map((m) => (m.code === code ? { ...m, ...patch } : m));
  const next = { ...state, members };
  await saveState(next);
  await publish(next);
}

export async function removeMember(code: string) {
  const state = requirePrimary();
  const member = state.members.find((m) => m.code === code);
  if (!member || member.code === state.memberCode) return;
  // Apply what they sent before removal, so no sale is lost.
  await syncNow();
  const after = requirePrimary();
  const members = after.members.map((m) =>
    m.code === code ? { ...m, removedAt: new Date().toISOString() } : m,
  );
  for (const fileId of [after.shopFileId, after.booksFileId, member.fileId]) {
    if (fileId) await drive.unshare(fileId, member.email).catch(() => undefined);
  }
  const next = { ...after, members };
  await saveState(next);
  await publish(next);
}

// ---------------------------------------------------------------------------
// Member: join and leave
// ---------------------------------------------------------------------------

/**
 * Join with an invite link. The person signs in, ticks the invited files in
 * Google's picker (that is what gives this app access), and this device's
 * POS data is replaced with the shop's.
 */
export async function joinTeam(payload: InvitePayload, pick: (ids: string[]) => Promise<string[] | null>) {
  if (!currentToken()) await requestToken(true);
  const me = await drive.about();
  if (me.emailAddress.toLowerCase() !== payload.e.toLowerCase()) {
    throw new Error(
      `This invite is for ${payload.e}, but you signed in as ${me.emailAddress}. Sign in with the invited Google account.`,
    );
  }
  const ids = [payload.s, payload.f, ...(payload.b ? [payload.b] : [])];
  const picked = await pick(ids);
  if (!picked) throw new Error("Joining was cancelled.");
  const missing = ids.filter((id) => !picked.includes(id));
  if (missing.length) {
    throw new Error(`${missing.length} of the shop's files still weren't selected. Tap join again and select each file Google shows.`);
  }

  const shop = await drive.readJson<unknown>(payload.s);
  if (!isShopFile(shop)) throw new Error("This doesn't look like a Setu POS shop file.");
  const member = shop.members.find((m) => m.code === payload.c);
  if (!member || member.removedAt) throw new Error("This invite is no longer valid. Ask the owner to invite you again.");

  await dbClearAll();
  await dbBatchRaw({ settings: [{ ...DEFAULT_SETTINGS, batchTracking: false }] });
  const state: TeamState = {
    id: "main",
    shopName: shop.shopName,
    isPrimary: false,
    memberCode: member.code,
    role: member.role,
    email: me.emailAddress,
    permissions: { ...DEFAULT_CASHIER_PERMISSIONS, ...member.permissions },
    shopFileId: payload.s,
    booksFileId: payload.b,
    ownFileId: payload.f,
    folderId: null,
    members: shop.members,
    consumed: shop.consumed,
    orderAuthors: {},
    remoteSeen: {},
    uploaded: 0,
    lastSyncAt: null,
    lastError: "",
    needsSignIn: false,
    rejected: [],
    oversold: [],
    removed: false,
  };
  await saveState(state);
  activateCapture(state);
  await syncNow();
}

/** Stop syncing on this device. Data stays on the device. */
export async function leaveTeam() {
  setCaptureSink(null);
  await dbBatchRaw({}, { drive_state: ["main"] });
  const ops = await dbGetAll<OpRow>("drive_ops");
  if (ops.length) await dbBatchRaw({}, { drive_ops: ops.map((o) => o.id) });
  publishSession(null);
}

// ---------------------------------------------------------------------------
// Sync
// ---------------------------------------------------------------------------

let running: Promise<void> | null = null;

/** One sync pass. Safe to call often; overlapping calls share one pass. */
export function syncNow(): Promise<void> {
  if (!running) {
    running = syncOnce().finally(() => {
      running = null;
    });
  }
  return running;
}

async function syncOnce() {
  const state = session;
  if (!state || state.removed) return;
  if (!currentToken()) {
    if (!state.needsSignIn) await saveState({ ...state, needsSignIn: true });
    return;
  }
  try {
    const next = state.isPrimary ? await syncHub(state) : await syncMember(state);
    await saveState({ ...next, lastSyncAt: new Date().toISOString(), lastError: "", needsSignIn: false });
  } catch (error) {
    const signIn = error instanceof NeedsSignInError || (error instanceof DriveError && error.status === 401);
    await saveState({
      ...(session ?? state),
      needsSignIn: signIn,
      lastError: signIn ? "" : error instanceof Error ? error.message : "Sync failed.",
    });
  }
}

/** Hub: read every member's new operations, merge them in, publish. */
async function syncHub(state: TeamState): Promise<TeamState> {
  const synced = syncedStores(connectedTools);
  const files: { memberCode: string; ops: Op[] }[] = [];
  const consumed = { ...state.consumed };
  const remoteSeen = { ...state.remoteSeen };

  for (const member of state.members) {
    if (!member.fileId) continue;
    const meta = await drive.getFile(member.fileId).catch((e: unknown) => {
      if (e instanceof DriveError && e.status === 404) return null;
      throw e;
    });
    if (!meta || remoteSeen[member.fileId] === meta.modifiedTime) continue;
    const body = await drive.readJson<ChangesFileBody>(member.fileId);
    const fresh = (body.ops ?? []).slice(consumed[member.code] ?? 0);
    if (fresh.length) files.push({ memberCode: member.code, ops: fresh });
    consumed[member.code] = body.ops?.length ?? 0;
    remoteSeen[member.fileId] = meta.modifiedTime;
  }

  let { orderAuthors, rejected, oversold } = state;
  if (files.length) {
    const stores = ALL_DATA_STORES(synced);
    const local = await readSnapshot([...stores]);
    const base = baseFromLocal(local, state.members, synced, orderAuthors);
    const merged = mergeInto(base, files);
    await applyPlan(planApply(local, mergedStores(merged), stores));
    orderAuthors = merged.orderAuthors;
    oversold = merged.oversold;
    const at = new Date().toISOString();
    rejected = [
      ...merged.rejected.map((r) => ({ memberCode: r.memberCode, reason: r.reason, what: summarize(r.op), at })),
      ...rejected,
    ].slice(0, 50);
  }

  const localOps = await dbGetAll<OpRow>("drive_ops");
  if (files.length || localOps.length || JSON.stringify(consumed) !== JSON.stringify(state.consumed)) {
    const next = { ...state, consumed, remoteSeen, orderAuthors, rejected, oversold };
    await publish(next);
    // The hub's own changes are now in the published files.
    if (localOps.length) await dbBatchRaw({}, { drive_ops: localOps.map((o) => o.id) });
    return next;
  }
  return { ...state, consumed, remoteSeen };
}

/** Write shop.json and books.json from the hub's current data. */
async function publish(state: TeamState) {
  const synced = syncedStores(connectedTools);
  const local = await readSnapshot(ALL_DATA_STORES(synced));
  const now = new Date().toISOString();
  await drive.updateJson(
    state.shopFileId,
    buildShopFile(local, state.shopName, state.memberCode, state.members, state.consumed, now),
  );
  if (state.booksFileId) {
    await drive.updateJson(state.booksFileId, buildBooksFile(local, synced, state.orderAuthors, now));
  }
}

/** Member: upload own operations, then take what the hub published. */
async function syncMember(state: TeamState): Promise<TeamState> {
  const ops = await readOps();
  let uploaded = state.uploaded;
  if (ops.length > uploaded && state.ownFileId) {
    const body: ChangesFileBody = { app: TEAM_APP, memberCode: state.memberCode, ops };
    await drive.updateJson(state.ownFileId, body);
    uploaded = ops.length;
  }

  const meta = await drive.getFile(state.shopFileId).catch((e: unknown) => {
    if (e instanceof DriveError && (e.status === 403 || e.status === 404)) return null;
    throw e;
  });
  if (!meta) {
    // Unshared or deleted: the owner removed this device's member.
    setCaptureSink(null);
    return { ...state, uploaded, removed: true };
  }
  const remoteSeen = { ...state.remoteSeen };
  if (remoteSeen[state.shopFileId] === meta.modifiedTime && uploaded === state.uploaded) {
    return { ...state, uploaded };
  }

  const shop = await drive.readJson<ShopFile>(state.shopFileId);
  const books =
    state.role === "owner" && state.booksFileId ? await drive.readJson<BooksFile>(state.booksFileId) : null;
  remoteSeen[state.shopFileId] = meta.modifiedTime;

  const me = shop.members.find((m) => m.code === state.memberCode);
  if (!me || me.removedAt) {
    setCaptureSink(null);
    return { ...state, uploaded, remoteSeen, removed: true, members: shop.members };
  }

  const synced = syncedStores(shop.catalog.settings.connectedTools ?? connectedTools);
  const stores = memberStores(me.role, synced);
  const pending = ops.slice(shop.consumed[state.memberCode] ?? 0);
  const merged = mergeInto(baseFromPublished(shop, books), [{ memberCode: state.memberCode, ops: pending }]);
  const local = await readSnapshot(stores);
  const plan = planApply(local, mergedStores(merged), stores);
  if (!local.settings?.length && plan.writes.settings) {
    plan.writes.settings = plan.writes.settings.map((s) => ({ ...DEFAULT_SETTINGS, ...s, batchTracking: false }));
  }
  await applyPlan(plan);

  return {
    ...state,
    uploaded,
    remoteSeen,
    shopName: shop.shopName,
    members: shop.members,
    consumed: shop.consumed,
    role: me.role,
    permissions: { ...DEFAULT_CASHIER_PERMISSIONS, ...me.permissions },
    oversold: merged.oversold,
  };
}

export { TEAM_FILE_VERSION };

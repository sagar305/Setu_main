// Google Drive team sync for the Browser Based POS: the part that talks to
// Drive and IndexedDB. Browser only. See hub.ts for the file layout and why
// the owner's main device is the hub.
//
// Any device, by signing in: when someone turns sync on or joins, a small
// "my shops" note is saved in this app's hidden folder in THEIR Google Drive
// (drive.appdata). On another device they sign in, the POS reads that note
// and opens the shop with the role the owner gave them. Google's file
// permission belongs to the person, not the device, so no picker is needed
// again. Setu stores nothing.

import { dbBatchRaw, dbClearAll, dbGet, dbGetAll, setCaptureSink, type StoreName } from "../db";
import { DEFAULT_SETTINGS, type Order, type PosSettings } from "../types";
import { DriveClient, DriveError } from "./api";
import { currentToken, requestToken, signOut as googleSignOut, silentToken } from "./auth";
import { captureOps } from "./capture";
import {
  TEAM_APP,
  TEAM_FILE_VERSION,
  authorsForExisting,
  baseFromLocal,
  baseFromPublished,
  buildBooksFile,
  buildShopFile,
  consumedKey,
  deviceSections,
  freshOps,
  isShopFile,
  memberStores,
  mergeInto,
  mergedStores,
  planApply,
  withDeviceSection,
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
  /** This device is the shop's main device (the hub). */
  isPrimary: boolean;
  /** This browser's id; each device has its own section in a changes file. */
  deviceId: string;
  memberCode: string;
  role: Role;
  email: string;
  /** The Google account that owns the shop's files; only it can be the hub. */
  primaryEmail: string;
  permissions: MemberPermissions;
  shopFileId: string;
  booksFileId: string | null;
  /** This member's changes file (the owner's too, for their other devices). */
  ownFileId: string | null;
  folderId: string | null;
  members: TeamMember[];
  consumed: Record<string, number>;
  orderAuthors: Record<string, string>;
  /** fileId → modifiedTime of the copy last read or written. */
  remoteSeen: Record<string, string>;
  /** Operations of this device known to be in its section of the file. */
  uploaded: number;
  /** When the main device last published (members' view). */
  hubSeenAt: string | null;
  lastSyncAt: string | null;
  lastError: string;
  needsSignIn: boolean;
  rejected: RejectedNote[];
  oversold: string[];
  /** The owner removed this member (or deleted the shop's files). */
  removed: boolean;
  /**
   * Times in a row the shop's files couldn't be opened by the right account.
   * Removal is only concluded on the second time, so a network or Google
   * hiccup never wipes a device.
   */
  accessStrikes?: number;
  /** When the shop's files first couldn't be opened in this run of failures. */
  accessFailedSince?: string | null;
};

/** Removal is only concluded after failing this long (and twice in a row). */
const REMOVAL_CONFIRM_MS = 2 * 60_000;

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

/** One entry of the "my shops" note in the user's hidden Drive folder. */
export type ShopPointer = {
  shopFileId: string;
  booksFileId: string | null;
  ownFileId: string | null;
  folderId: string | null;
  shopName: string;
  savedAt: string;
};

type ShopsNote = { app: typeof TEAM_APP; version: 1; shops: ShopPointer[] };

const SHOPS_NOTE = "setu-pos-shops.json";

// ---------------------------------------------------------------------------
// Session: shared with the POS store (checkout limits, invoice series)
// ---------------------------------------------------------------------------

let session: TeamState | null = null;
let connectedTools: readonly string[] = [];
const listeners = new Set<(state: TeamState | null) => void>();
const dataListeners = new Set<() => void>();

export function getTeamSession(): TeamState | null {
  return session;
}

export function subscribeTeam(listener: (state: TeamState | null) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Called after sync wrote team data into this device's database. */
export function onTeamDataChanged(listener: () => void): () => void {
  dataListeners.add(listener);
  return () => dataListeners.delete(listener);
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

/** Short device tag in invoice numbers, so two devices never share a number. */
export function deviceTag(deviceId: string): string {
  return deviceId.replace(/[^a-z0-9]/gi, "").slice(-3).toUpperCase();
}

/**
 * The main device keeps the shop's own series (INV-00042). Every other device
 * bills in its own: member code + device tag, e.g. INV-C1-K7Q-00001.
 */
export function teamInvoicePrefix(basePrefix: string): string {
  const s = session;
  if (!s || s.isPrimary) return basePrefix;
  return `${basePrefix}${s.memberCode}-${deviceTag(s.deviceId)}-`;
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

/**
 * Never opens a popup by itself (that needs the user's tap). It renews
 * silently through the site's stay-signed-in cookie when it can.
 */
const drive = new DriveClient(async () => {
  const token = currentToken() ?? (await silentToken());
  if (!token) throw new NeedsSignInError();
  return token;
});

const DEVICE_KEY = "setu-pos-device-id";

/** A stable id for this browser, kept across leaving and rejoining. */
function thisDeviceId(): string {
  try {
    const existing = window.localStorage.getItem(DEVICE_KEY);
    if (existing) return existing;
    const id = `d${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(DEVICE_KEY, id);
    return id;
  } catch {
    return `d${Math.random().toString(36).slice(2, 10)}`;
  }
}

let opCounter = 0;
function newOpId(code: string, deviceId: string) {
  opCounter = (opCounter + 1) % 1_000_000;
  return `${code}-${deviceId}-${Date.now().toString(36)}-${opCounter.toString(36)}`;
}

async function saveState(state: TeamState) {
  await dbBatchRaw({ drive_state: [state] });
  publishSession(state);
}

async function applyPlan(plan: { writes: Record<string, unknown[]>; deletes: Record<string, string[]> }) {
  if (!Object.keys(plan.writes).length && !Object.keys(plan.deletes).length) return;
  await dbBatchRaw(plan.writes as never, plan.deletes as never);
  dataListeners.forEach((l) => l());
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

const sameEmail = (a: string | undefined, b: string | undefined) =>
  !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

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
// "My shops" note in the signed-in person's hidden Drive folder
// ---------------------------------------------------------------------------

async function readShopsNote(): Promise<{ fileId: string | null; note: ShopsNote }> {
  const file = await drive.findAppDataFile(SHOPS_NOTE);
  if (!file) return { fileId: null, note: { app: TEAM_APP, version: 1, shops: [] } };
  const note = await drive.readJson<ShopsNote>(file.id).catch(() => null);
  return { fileId: file.id, note: note?.shops ? note : { app: TEAM_APP, version: 1, shops: [] } };
}

async function rememberShop(pointer: ShopPointer) {
  const { fileId, note } = await readShopsNote();
  const shops = [pointer, ...note.shops.filter((s) => s.shopFileId !== pointer.shopFileId)];
  const next: ShopsNote = { app: TEAM_APP, version: 1, shops };
  if (fileId) await drive.updateJson(fileId, next);
  else await drive.createAppDataJson(SHOPS_NOTE, next);
}

async function forgetShop(shopFileId: string) {
  const { fileId, note } = await readShopsNote();
  if (!fileId) return;
  await drive.updateJson(fileId, { ...note, shops: note.shops.filter((s) => s.shopFileId !== shopFileId) });
}

export type FoundShop = {
  pointer: ShopPointer;
  shopName: string;
  role: Role | null;
  /** Not in the shop's team any more (removed, or never added). */
  removed: boolean;
  /** Owner of the shop's files: can make a device the main device. */
  isPrimaryAccount: boolean;
  /** Last time the main device published. */
  hubSeenAt: string | null;
  /** The shop's files can't be opened (deleted, or access taken away). */
  unreachable: boolean;
};

/**
 * Sign in (from a tap) and list the shops this Google account belongs to,
 * with the role the owner gave it in each.
 */
export async function findMyShops(): Promise<{ email: string; shops: FoundShop[] }> {
  if (!currentToken()) await requestToken(true);
  const me = await drive.about();
  const { note } = await readShopsNote();
  const shops: FoundShop[] = [];
  for (const pointer of note.shops) {
    const shop = await drive.readJson<unknown>(pointer.shopFileId).catch(() => null);
    if (!isShopFile(shop)) {
      shops.push({ pointer, shopName: pointer.shopName, role: null, removed: false, isPrimaryAccount: false, hubSeenAt: null, unreachable: true });
      continue;
    }
    const member = shop.members.find((m) => sameEmail(m.email, me.emailAddress) && !m.removedAt);
    shops.push({
      pointer,
      shopName: shop.shopName,
      role: member?.role ?? null,
      removed: !member,
      isPrimaryAccount: sameEmail(shop.primaryEmail ?? shop.members[0]?.email, me.emailAddress),
      hubSeenAt: shop.updatedAt ?? null,
      unreachable: false,
    });
  }
  return { email: me.emailAddress, shops };
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
      newId: () => newOpId(state.memberCode, state.deviceId),
      now: new Date().toISOString(),
    });
    return ops.map((op) => ({ id: op.id, seq: seq++, op }));
  });
}

/** Load this device's team membership (if any) and start capturing writes. */
export async function loadTeam(): Promise<TeamState | null> {
  const stored = (await dbGet<TeamState>("drive_state", "main")) ?? null;
  // Devices that joined before per-device sync get an id and the defaults.
  const state = stored
    ? {
        ...stored,
        deviceId: stored.deviceId || thisDeviceId(),
        primaryEmail: stored.primaryEmail || stored.members[0]?.email || "",
        hubSeenAt: stored.hubSeenAt ?? null,
      }
    : null;
  activateCapture(state);
  publishSession(state);
  return state;
}

/** Sign in with Google (must run from a tap). */
export async function signIn(): Promise<void> {
  await requestToken(true);
  if (session?.needsSignIn) await saveState({ ...session, needsSignIn: false, lastError: "" });
}

function baseState(fields: Partial<TeamState> & Pick<TeamState, "shopName" | "memberCode" | "role" | "email" | "shopFileId">): TeamState {
  return {
    id: "main",
    isPrimary: false,
    deviceId: thisDeviceId(),
    primaryEmail: "",
    permissions: DEFAULT_CASHIER_PERMISSIONS,
    booksFileId: null,
    ownFileId: null,
    folderId: null,
    members: [],
    consumed: {},
    orderAuthors: {},
    remoteSeen: {},
    uploaded: 0,
    hubSeenAt: null,
    lastSyncAt: null,
    lastError: "",
    needsSignIn: false,
    rejected: [],
    oversold: [],
    removed: false,
    ...fields,
  };
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
  const deviceId = thisDeviceId();

  const folder = await drive.createFolder(`Setu POS – ${shopName}`);
  // The owner's own changes file, used by their other devices.
  const ownerChanges = await drive.createJson(`changes-${code}.json`, folder.id, {
    app: TEAM_APP,
    memberCode: code,
    devices: {},
  } satisfies ChangesFileBody);
  const members: TeamMember[] = [
    { email: me.emailAddress, role: "owner", code, addedAt: now, fileId: ownerChanges.id, name: me.displayName },
  ];
  const orderAuthors = authorsForExisting((local.orders ?? []) as unknown as Order[], code, {});
  const hub = { deviceId, primaryEmail: me.emailAddress };
  const shop = await drive.createJson("shop.json", folder.id, buildShopFile(local, shopName, code, members, {}, now, hub));
  const books = await drive.createJson("books.json", folder.id, buildBooksFile(local, synced, orderAuthors, now, members));

  const state = baseState({
    shopName,
    isPrimary: true,
    deviceId,
    memberCode: code,
    role: "owner",
    email: me.emailAddress,
    primaryEmail: me.emailAddress,
    shopFileId: shop.id,
    booksFileId: books.id,
    ownFileId: ownerChanges.id,
    folderId: folder.id,
    members,
    orderAuthors,
    remoteSeen: { [shop.id]: shop.modifiedTime },
    lastSyncAt: now,
    hubSeenAt: now,
  });
  const leftover = await dbGetAll<OpRow>("drive_ops");
  if (leftover.length) await dbBatchRaw({}, { drive_ops: leftover.map((o) => o.id) });
  await saveState(state);
  activateCapture(state);
  await rememberShop({
    shopFileId: shop.id,
    booksFileId: books.id,
    ownFileId: ownerChanges.id,
    folderId: folder.id,
    shopName,
    savedAt: now,
  });
  return state;
}

function requirePrimary(): TeamState {
  if (!session?.isPrimary) throw new Error("Only the shop's main device can manage the team.");
  if (!session.folderId) throw new Error("This device doesn't know the shop's Drive folder. Make it the main device again.");
  return session;
}

export type InviteInput = {
  email: string;
  name: string;
  /** Mobile number already normalized (normalizePhone), or "". */
  phone: string;
  role: Role;
  permissions: MemberPermissions;
};

export async function inviteMember(input: InviteInput): Promise<string> {
  const state = requirePrimary();
  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email address.");
  if (state.members.some((m) => sameEmail(m.email, email) && !m.removedAt)) {
    throw new Error("This person is already in your team.");
  }
  const prefix = input.role === "owner" ? "O" : "C";
  let n = 1;
  while (state.members.some((m) => m.code === `${prefix}${n}`)) n += 1;
  const code = `${prefix}${n}`;

  const body: ChangesFileBody = { app: TEAM_APP, memberCode: code, devices: {} };
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
    `You're invited to ${state.shopName} on Setu Browser Based POS. Open this link once to join: ${link} — after that, just sign in with Google on any device.`,
  );
  if (payload.b) await drive.share(payload.b, email, "reader", false);

  const member: TeamMember = {
    email,
    name: input.name.trim(),
    role: input.role,
    code,
    addedAt: new Date().toISOString(),
    fileId: file.id,
    ...(input.phone ? { phone: input.phone } : {}),
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

export async function updateMember(
  code: string,
  patch: { permissions?: MemberPermissions; name?: string; phone?: string },
) {
  const state = requirePrimary();
  const members = state.members.map((m) => {
    if (m.code !== code) return m;
    const updated: TeamMember = { ...m, ...patch };
    if (!updated.phone) delete updated.phone;
    return updated;
  });
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
// Opening a shop on a device: invite link, or plain sign-in
// ---------------------------------------------------------------------------

/** Replace this device's POS with the shop, as `member`, and start syncing. */
async function startOnDevice(
  shop: ShopFile,
  ids: { shopFileId: string; booksFileId: string | null; ownFileId: string | null; folderId: string | null },
  email: string,
  member: TeamMember,
) {
  await dbClearAll();
  await dbBatchRaw({ settings: [{ ...DEFAULT_SETTINGS, batchTracking: false }] });
  const state = baseState({
    shopName: shop.shopName,
    memberCode: member.code,
    role: member.role,
    email,
    primaryEmail: shop.primaryEmail ?? shop.members[0]?.email ?? "",
    permissions: { ...DEFAULT_CASHIER_PERMISSIONS, ...member.permissions },
    shopFileId: ids.shopFileId,
    booksFileId: member.role === "owner" ? ids.booksFileId : null,
    ownFileId: ids.ownFileId ?? member.fileId,
    folderId: ids.folderId,
    members: shop.members,
    consumed: shop.consumed,
    hubSeenAt: shop.updatedAt ?? null,
  });
  await saveState(state);
  activateCapture(state);
  await rememberShop({
    shopFileId: ids.shopFileId,
    booksFileId: state.booksFileId,
    ownFileId: state.ownFileId,
    folderId: ids.folderId,
    shopName: shop.shopName,
    savedAt: new Date().toISOString(),
  }).catch(() => undefined);
  await syncNow();
}

/**
 * Join with an invite link. The person signs in, picks the invited files in
 * Google's picker (that is what gives this app access), and this device's
 * POS data is replaced with the shop's. Their other devices then only need
 * to sign in.
 */
export async function joinTeam(payload: InvitePayload, pick: (ids: string[]) => Promise<string[] | null>) {
  if (!currentToken()) await requestToken(true);
  const me = await drive.about();
  if (!sameEmail(me.emailAddress, payload.e)) {
    throw new Error(
      `This invite is for ${payload.e}, but you signed in as ${me.emailAddress}. Sign in with the invited Google account.`,
    );
  }
  const ids = [payload.s, payload.f, ...(payload.b ? [payload.b] : [])];
  // Already picked on another device? Then this account can open them now.
  let shop = await drive.readJson<unknown>(payload.s).catch(() => null);
  if (!isShopFile(shop)) {
    const picked = await pick(ids);
    if (!picked) throw new Error("Joining was cancelled.");
    const missing = ids.filter((id) => !picked.includes(id));
    if (missing.length) {
      throw new Error(`${missing.length} of the shop's files still weren't selected. Tap join again and select each file Google shows.`);
    }
    shop = await drive.readJson<unknown>(payload.s);
  }
  if (!isShopFile(shop)) throw new Error("This doesn't look like a Setu POS shop file.");
  const member = shop.members.find((m) => m.code === payload.c);
  if (!member || member.removedAt) throw new Error("This invite is no longer valid. Ask the owner to invite you again.");

  await startOnDevice(shop, { shopFileId: payload.s, booksFileId: payload.b, ownFileId: payload.f, folderId: null }, me.emailAddress, member);
}

/**
 * Open a shop found by findMyShops on this device, with the role the owner
 * gave this account. If Google no longer lets this account open a file (rare),
 * `pick` asks them to select it once.
 */
export async function openShop(found: FoundShop, pick: (ids: string[]) => Promise<string[] | null>) {
  if (!currentToken()) await requestToken(true);
  const me = await drive.about();
  const p = found.pointer;
  let shop = await drive.readJson<unknown>(p.shopFileId).catch(() => null);
  if (!isShopFile(shop)) {
    const ids = [p.shopFileId, ...(p.ownFileId ? [p.ownFileId] : []), ...(p.booksFileId ? [p.booksFileId] : [])];
    const picked = await pick(ids);
    if (!picked) throw new Error("Opening the shop was cancelled.");
    shop = await drive.readJson<unknown>(p.shopFileId);
  }
  if (!isShopFile(shop)) throw new Error("This shop's file can't be read. Ask the owner to invite you again.");
  const member = shop.members.find((m) => sameEmail(m.email, me.emailAddress) && !m.removedAt);
  if (!member) {
    await forgetShop(p.shopFileId).catch(() => undefined);
    throw new Error(`${me.emailAddress} is no longer in ${shop.shopName}'s team.`);
  }
  await startOnDevice(shop, p, me.emailAddress, member);
}

/**
 * Make this device the shop's main device (new laptop, broken old one). Only
 * the account that owns the shop's files can. The old main device notices on
 * its next sync and becomes an ordinary owner device.
 */
export async function makeMainDevice() {
  const state = session;
  if (!state || state.isPrimary) return;
  if (state.role !== "owner" || !sameEmail(state.email, state.primaryEmail)) {
    throw new Error(`Only ${state?.primaryEmail || "the shop owner's account"} can make a device the main device.`);
  }
  // Send this device's pending changes and take the latest published data.
  await syncNow();
  const current = session!;
  const shop = await drive.readJson<ShopFile>(current.shopFileId);
  const books = current.booksFileId ? await drive.readJson<BooksFile>(current.booksFileId) : null;
  const folderId = current.folderId ?? (await drive.getFolderOf(current.shopFileId));
  const ops = await readOps();
  // This device's own changes are already in its local data, so the hub
  // must not apply them again from its section of the owner's file.
  const consumed = { ...shop.consumed, [consumedKey(current.memberCode, current.deviceId)]: ops.length };
  const next: TeamState = {
    ...current,
    isPrimary: true,
    folderId,
    // shop.json has no phone numbers; books.json (owners only) keeps them.
    members: shop.members.map((m) => {
      const phone = books?.memberPhones?.[m.code];
      return phone ? { ...m, phone } : m;
    }),
    consumed,
    orderAuthors: books?.orderAuthors ?? {},
    lastError: "",
  };
  await publish(next);
  const rows = await dbGetAll<OpRow>("drive_ops");
  if (rows.length) await dbBatchRaw({}, { drive_ops: rows.map((r) => r.id) });
  await saveState({ ...session!, ...next, remoteSeen: session!.remoteSeen, uploaded: 0 });
  await rememberShop({
    shopFileId: next.shopFileId,
    booksFileId: next.booksFileId,
    ownFileId: next.ownFileId,
    folderId,
    shopName: next.shopName,
    savedAt: new Date().toISOString(),
  }).catch(() => undefined);
}

export type LeaveOptions = {
  /** Delete everything on this device (staff devices: the data is the shop's). */
  wipe: boolean;
  /** Try to send sales not yet uploaded first (skipped when removed). */
  flush?: boolean;
  /** Sign this device out of Google (revoke + delete the stay-signed-in cookie). */
  signOut?: boolean;
};

/**
 * Stop syncing on this device. With `wipe`, every POS record on the device is
 * deleted (the caller then shows the welcome screen); without it the data
 * stays (the owner's main device turning sync off).
 */
export async function leaveTeam(options: LeaveOptions = { wipe: false }) {
  if (options.flush && session && !session.removed && navigator.onLine) {
    await syncNow().catch(() => undefined);
  }
  setCaptureSink(null);
  if (options.wipe) {
    await dbClearAll();
  } else {
    await dbBatchRaw({}, { drive_state: ["main"] });
    const ops = await dbGetAll<OpRow>("drive_ops");
    if (ops.length) await dbBatchRaw({}, { drive_ops: ops.map((o) => o.id) });
  }
  publishSession(null);
  if (options.signOut) await googleSignOut().catch(() => undefined);
}

// A note shown on the welcome screen after this device was wiped because its
// person was removed. Kept in localStorage: the POS database is gone by then.
const NOTICE_KEY = "setu-pos-team-notice";

export type TeamNotice = { kind: "removed"; shopName: string; at: string };

export function saveTeamNotice(notice: TeamNotice) {
  try {
    window.localStorage.setItem(NOTICE_KEY, JSON.stringify(notice));
  } catch {
    // Storage blocked: the wipe still happens, just without the note.
  }
}

export function readTeamNotice(): TeamNotice | null {
  try {
    const raw = window.localStorage.getItem(NOTICE_KEY);
    return raw ? (JSON.parse(raw) as TeamNotice) : null;
  } catch {
    return null;
  }
}

export function clearTeamNotice() {
  try {
    window.localStorage.removeItem(NOTICE_KEY);
  } catch {
    // ignore
  }
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
  if (!(await silentToken())) {
    if (!state.needsSignIn) await saveState({ ...state, needsSignIn: true });
    return;
  }
  try {
    const next = state.isPrimary ? await syncHub(state) : await syncMember(state);
    // A pending "can't open the shop's files" check keeps its message.
    const lastError = next.accessStrikes ? next.lastError : "";
    await saveState({ ...next, lastSyncAt: new Date().toISOString(), lastError, needsSignIn: false });
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
  // Another device may have been made the main device since.
  const shopMeta = await drive.getFile(state.shopFileId);
  if (state.remoteSeen[state.shopFileId] !== shopMeta.modifiedTime) {
    const shop = await drive.readJson<ShopFile>(state.shopFileId);
    if (shop.hubDeviceId && shop.hubDeviceId !== state.deviceId) {
      // Step down: changes made here since the last publish become this
      // device's pending changes, sent like any other owner device's.
      const demoted: TeamState = {
        ...state,
        isPrimary: false,
        members: shop.members,
        consumed: shop.consumed,
        uploaded: 0,
        hubSeenAt: shop.updatedAt ?? null,
        ownFileId: state.ownFileId ?? shop.members.find((m) => m.code === state.memberCode)?.fileId ?? null,
      };
      return syncMember(demoted);
    }
  }

  const synced = syncedStores(connectedTools);
  const files: { memberCode: string; ops: Op[] }[] = [];
  let consumed = { ...state.consumed };
  const remoteSeen = { ...state.remoteSeen };

  for (const member of state.members) {
    if (!member.fileId) continue;
    const meta = await drive.getFile(member.fileId).catch((e: unknown) => {
      if (e instanceof DriveError && e.status === 404) return null;
      throw e;
    });
    if (!meta || remoteSeen[member.fileId] === meta.modifiedTime) continue;
    const body = await drive.readJson<ChangesFileBody>(member.fileId);
    const fresh = freshOps(member.code, body, consumed);
    consumed = fresh.consumed;
    if (fresh.ops.length) files.push({ memberCode: member.code, ops: fresh.ops });
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
    const published = await publish(next);
    // The hub's own changes are now in the published files.
    if (localOps.length) await dbBatchRaw({}, { drive_ops: localOps.map((o) => o.id) });
    return { ...next, remoteSeen: { ...remoteSeen, [state.shopFileId]: published }, hubSeenAt: published ? new Date().toISOString() : next.hubSeenAt };
  }
  return { ...state, consumed, remoteSeen };
}

/** Write shop.json and books.json from the hub's data; returns shop.json's modifiedTime. */
async function publish(state: TeamState): Promise<string> {
  const synced = syncedStores(connectedTools);
  const local = await readSnapshot(ALL_DATA_STORES(synced));
  const now = new Date().toISOString();
  const shop = await drive.updateJson(
    state.shopFileId,
    buildShopFile(local, state.shopName, state.memberCode, state.members, state.consumed, now, {
      deviceId: state.deviceId,
      primaryEmail: state.primaryEmail || state.email,
    }),
  );
  if (state.booksFileId) {
    await drive.updateJson(state.booksFileId, buildBooksFile(local, synced, state.orderAuthors, now, state.members));
  }
  if (session) publishSession({ ...session, remoteSeen: { ...session.remoteSeen, [state.shopFileId]: shop.modifiedTime } });
  return shop.modifiedTime;
}

/** Member device: upload this device's section, then take what the hub published. */
async function syncMember(state: TeamState): Promise<TeamState> {
  const ops = await readOps();
  let uploaded = state.uploaded;
  const remoteSeen = { ...state.remoteSeen };

  if (state.ownFileId) {
    const meta = await drive.getFile(state.ownFileId).catch((e: unknown) => {
      if (e instanceof DriveError && (e.status === 403 || e.status === 404)) return null;
      throw e;
    });
    // Re-read when another device of this person wrote, or we have more to send.
    if (meta && (remoteSeen[state.ownFileId] !== meta.modifiedTime || ops.length > uploaded)) {
      const body = await drive.readJson<ChangesFileBody>(state.ownFileId);
      const mine = deviceSections(body)[state.deviceId] ?? [];
      if (mine.length < ops.length) {
        const written = await drive.updateJson(
          state.ownFileId,
          withDeviceSection(body, state.memberCode, state.deviceId, ops),
        );
        remoteSeen[state.ownFileId] = written.modifiedTime;
      } else {
        remoteSeen[state.ownFileId] = meta.modifiedTime;
      }
      uploaded = ops.length;
    }
  }

  const meta = await drive.getFile(state.shopFileId).catch((e: unknown) => {
    if (e instanceof DriveError && (e.status === 403 || e.status === 404)) return null;
    throw e;
  });
  if (!meta) {
    // Unshared or deleted — most likely the owner removed this member. Make
    // sure it's the right Google account, and only conclude it on the second
    // sync in a row, so a passing glitch never wipes a device.
    const me = await drive.about();
    if (!sameEmail(me.emailAddress, state.email)) {
      throw new Error(
        `Signed in to Google as ${me.emailAddress}, but this device belongs to ${state.email}. Reconnect with ${state.email}.`,
      );
    }
    const strikes = (state.accessStrikes ?? 0) + 1;
    const since = state.accessFailedSince ?? new Date().toISOString();
    const longEnough = Date.now() - new Date(since).getTime() >= REMOVAL_CONFIRM_MS;
    if (strikes < 2 || !longEnough) {
      return {
        ...state,
        uploaded,
        remoteSeen,
        accessStrikes: strikes,
        accessFailedSince: since,
        lastError: "Can't open the shop's files — checking again shortly.",
      };
    }
    setCaptureSink(null);
    return { ...state, uploaded, remoteSeen, accessStrikes: strikes, accessFailedSince: since, removed: true };
  }
  if (remoteSeen[state.shopFileId] === meta.modifiedTime && uploaded === state.uploaded) {
    return { ...state, uploaded, remoteSeen, accessStrikes: 0, accessFailedSince: null };
  }

  const shop = await drive.readJson<ShopFile>(state.shopFileId);
  const books =
    state.role === "owner" && state.booksFileId ? await drive.readJson<BooksFile>(state.booksFileId) : null;
  remoteSeen[state.shopFileId] = meta.modifiedTime;

  const me = shop.members.find((m) => m.code === state.memberCode);
  if (!me || me.removedAt) {
    // The shop file itself says so: certain, no second check needed.
    setCaptureSink(null);
    return { ...state, uploaded, remoteSeen, removed: true, members: shop.members };
  }

  const synced = syncedStores(shop.catalog.settings.connectedTools ?? connectedTools);
  const stores = memberStores(me.role, synced);
  const pending = ops.slice(shop.consumed[consumedKey(state.memberCode, state.deviceId)] ?? 0);
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
    accessStrikes: 0,
    accessFailedSince: null,
    shopName: shop.shopName,
    members: shop.members,
    consumed: shop.consumed,
    role: me.role,
    permissions: { ...DEFAULT_CASHIER_PERMISSIONS, ...me.permissions },
    primaryEmail: shop.primaryEmail ?? state.primaryEmail,
    hubSeenAt: shop.updatedAt ?? state.hubSeenAt,
    oversold: merged.oversold,
  };
}

export { TEAM_FILE_VERSION };

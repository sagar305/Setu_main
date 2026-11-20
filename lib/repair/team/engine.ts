// Google Drive team sync for the Free Repair Job Card: the part that talks to
// Drive and IndexedDB. Browser only.
//
// Built on the POS's team sync (lib/pos/drive): the same Google sign-in, Drive
// client, encryption, file picker and invite scheme, so a shop that uses both
// signs in the same way. What differs is the data — see files.ts for the
// shop's files and why technicians get a bench file of their own, merge.ts for
// how edits from several roles combine, and roles.ts for who may do what.
//
// Any device, by signing in: when someone turns sync on or joins, a small
// "my shops" note — the shop's file ids and its keys — is saved in this app's
// hidden folder in THEIR Google Drive. On another device they sign in and the
// app opens the shop with the role the owner gave them. Setu stores nothing
// and never has a key.

import { dbBatchRaw as posBatchRaw, dbGetAll as posGetAll } from "@/lib/pos/db";
import type { Business } from "@/lib/pos/types";
import { DriveClient, DriveError } from "@/lib/pos/drive/api";
import { currentToken, requestToken, signOut as googleSignOut, silentToken } from "@/lib/pos/drive/auth";
import { readTeamConsent } from "@/lib/pos/drive/consent";
import {
  DecryptError,
  fingerprint,
  keysToFragment,
  newKey,
  openEnvelope,
  recoveryKey,
  seal,
  type KeyName,
  type ShopKeys,
} from "@/lib/pos/drive/crypto";
import {
  REPAIR_DATA_STORES,
  repairBatchRaw,
  repairClearAll,
  repairGet,
  repairGetAll,
  setRepairCaptureSink,
  type RepairStoreName,
} from "../db";
import { DEFAULT_SETTINGS } from "../types";
import { captureOps } from "./capture";
import {
  FILE_LABEL,
  MAX_TEAM_SIZE,
  TEAM_APP,
  TEAM_FILE_VERSION,
  activeMembers,
  baseFromPublished,
  buildBench,
  buildBooksAndArchive,
  buildCatalog,
  buildMedia,
  buildStock,
  consumedKey,
  deviceSections,
  freshOps,
  jobsWithNewStatus,
  pendingOps,
  planApply,
  publicMembers,
  withDeviceSection,
  type ArchiveFile,
  type BenchFile,
  type BooksFile,
  type CatalogFile,
  type ChangesFileBody,
  type LiveFile,
  type MediaFile,
  type ShopFileIds,
  type TeamMember,
} from "./files";
import { mergeTeam, type RejectReason } from "./merge";
import {
  DEFAULT_FRONTDESK_PERMISSIONS,
  SYNC_STORES,
  deviceTag,
  memberSeriesPrefix,
  type MemberPermissions,
  type Op,
  type Role,
  type Snapshot,
  type SyncRecord,
} from "./ops";
import { discountAllowed } from "./roles";
import { shrinkPhotos } from "./thumbs";

// ---------------------------------------------------------------------------
// State kept on this device (store drive_state, row "main")
// ---------------------------------------------------------------------------

export type RejectedNote = { memberCode: string; reason: RejectReason; what: string; at: string };

type PublishedKind = "catalog" | "books" | "archive" | "media";

export type TeamState = {
  id: "main";
  version: typeof TEAM_FILE_VERSION;
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
  /** Technicians: the technician record whose jobs this person sees. */
  technicianId: string | null;
  files: ShopFileIds;
  /** The shop key, and the books key for owners and front desk. */
  keys: ShopKeys;
  /** This member's changes file. */
  ownFileId: string | null;
  /** Technicians: their bench file. */
  benchFileId: string | null;
  folderId: string | null;
  members: TeamMember[];
  consumed: Record<string, number>;
  /** fileId → modifiedTime of the copy last read or written. */
  remoteSeen: Record<string, string>;
  /** How many of this device's earliest operations were trimmed after the hub merged them. */
  opBase: number;
  /** Operations of this device known to be in its section of the file (absolute count). */
  uploaded: number;
  /** Hub: fingerprint of each file's content last uploaded, to skip unchanged ones. */
  published: Partial<Record<PublishedKind, string>> & { bench?: Record<string, string> };
  hubSeenAt: string | null;
  lastSyncAt: string | null;
  lastError: string;
  needsSignIn: boolean;
  rejected: RejectedNote[];
  /** The owner removed this member (or deleted the shop's files). */
  removed: boolean;
  accessStrikes?: number;
  accessFailedSince?: string | null;
  termsVersion?: string | null;
  termsAcceptedAt?: string | null;
};

/** Removal is only concluded after failing this long (and twice in a row). */
const REMOVAL_CONFIRM_MS = 2 * 60_000;

type OpRow = { id: string; seq: number; op: Op };

/** A decrypted copy of a shop file, cached on the device (store drive_cache). */
type CacheRow = { id: string; rev: string; data: unknown };

/**
 * What an invite link carries in `?join=`: file ids only. The keys are after
 * `#`, which browsers never send to any server.
 */
export type InvitePayload = {
  v: 1;
  app: "repair";
  /** Shop name, for the join screen. */
  n: string;
  /** Role, for the join screen. */
  r: Role;
  l: string;
  c: string;
  /** Books, archive and media — owner and front desk only. */
  b: string | null;
  a: string | null;
  d: string | null;
  /** Technicians: their bench file. */
  w: string | null;
  /** The member's own changes file and code, and their Google email. */
  f: string;
  m: string;
  e: string;
};

export type ShopPointer = {
  files: ShopFileIds;
  ownFileId: string | null;
  benchFileId: string | null;
  folderId: string | null;
  shopName: string;
  keys: ShopKeys | null;
  savedAt: string;
};

type ShopsNote = { app: typeof TEAM_APP; version: 1; shops: ShopPointer[] };

const SHOPS_NOTE = "setu-repair-shops.json";

/** The product page the app lives on; invite links open it. */
export const REPAIR_APP_PATH = "/products/free-repair-shop-software";

// ---------------------------------------------------------------------------
// Session: shared with the repair store (permissions, number series)
// ---------------------------------------------------------------------------

let session: TeamState | null = null;
const listeners = new Set<(state: TeamState | null) => void>();
export type TeamDataChange = { jobsWithNewStatus: string[] };
const dataListeners = new Set<(change: TeamDataChange) => void>();

export function getTeamSession(): TeamState | null {
  return session;
}

/** This device's role in a team, or null when it is not in one. */
export function teamRole(): Role | null {
  return session && !session.removed ? session.role : null;
}

export function subscribeTeam(listener: (state: TeamState | null) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Called after sync wrote team data into this device's database. */
export function onTeamDataChanged(listener: (change: TeamDataChange) => void): () => void {
  dataListeners.add(listener);
  return () => dataListeners.delete(listener);
}

function publishSession(state: TeamState | null) {
  session = state;
  listeners.forEach((listener) => listener(state));
}

/**
 * The main device keeps the shop's own series (JC-0412). Every other device
 * numbers in its own: member code + device tag, e.g. JC-F1K7Q-0001, so two
 * counters taking a device in at the same second never share a number.
 */
export function teamNumberPrefix(basePrefix: string): string {
  const s = session;
  if (!s || s.removed || s.isPrimary) return basePrefix;
  return memberSeriesPrefix(basePrefix, s.memberCode, deviceTag(s.deviceId));
}

/** Whether this device's person may give this discount (always, outside a team). */
export function teamDiscountAllowed(bill: Record<string, unknown>): boolean {
  const s = session;
  if (!s || s.removed) return true;
  return discountAllowed({ role: s.role, permissions: s.permissions }, bill);
}

/** The owner's printable recovery key (main device only). */
export function currentRecoveryKey(): string | null {
  const s = session;
  if (!s?.isPrimary || !s.keys.books) return null;
  return recoveryKey(s.keys);
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

const drive = new DriveClient(async () => {
  const token = currentToken() ?? (await silentToken());
  if (!token) throw new NeedsSignInError();
  return token;
});

function newDeviceId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return `d${Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 10)}`;
}

let opCounter = 0;
function newOpId(code: string, deviceId: string) {
  opCounter = (opCounter + 1) % 1_000_000;
  return `${code}-${deviceId}-${Date.now().toString(36)}-${opCounter.toString(36)}`;
}

async function saveState(state: TeamState) {
  await repairBatchRaw({ drive_state: [state] });
  publishSession(state);
}

async function applyPlan(
  plan: { writes: Record<string, unknown[]>; deletes: Record<string, string[]> },
  change: TeamDataChange
) {
  if (!Object.keys(plan.writes).length && !Object.keys(plan.deletes).length) return;
  await repairBatchRaw(plan.writes as never, plan.deletes as never);
  dataListeners.forEach((listener) => listener(change));
}

async function readSnapshot(): Promise<Snapshot> {
  const out: Snapshot = {};
  for (const store of SYNC_STORES) out[store] = await repairGetAll<SyncRecord>(store);
  return out;
}

async function readBusiness(): Promise<SyncRecord | null> {
  const rows = await posGetAll<Business>("business");
  return (rows.find((row) => row.id === "main") as unknown as SyncRecord) ?? null;
}

/** The business profile lives in the shared POS workspace database. */
async function applyBusiness(business: SyncRecord | null) {
  if (!business) return;
  const mine = await readBusiness();
  if (mine && JSON.stringify(mine) === JSON.stringify(business)) return;
  await posBatchRaw({ business: [business] });
  dataListeners.forEach((listener) => listener({ jobsWithNewStatus: [] }));
}

async function readOpRows(): Promise<OpRow[]> {
  return (await repairGetAll<OpRow>("drive_ops")).sort((a, b) => a.seq - b.seq);
}

function summarize(op: Op): string {
  if (op.type === "stock") return `stock change ${op.change > 0 ? "+" : ""}${op.change}`;
  if (op.type === "delete") return `deleted ${op.store.replace(/s$/, "")}`;
  const name = op.store === "jobs" ? "job" : op.store === "repairSettings" ? "settings" : op.store.replace(/s$/, "");
  return op.create ? `new ${name}` : `change to ${name} (${Object.keys(op.fields).join(", ")})`;
}

const sameEmail = (a: string | undefined, b: string | undefined) =>
  !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

const keyFor = (keys: ShopKeys, name: KeyName): string => {
  const key = name === "shop" ? keys.shop : keys.books;
  if (!key) throw new DecryptError("This device doesn't have the key for the shop's books.");
  return key;
};

async function readSealed<T>(fileId: string, keys: ShopKeys, keyName: KeyName, label: string): Promise<T> {
  return openEnvelope<T>(keyFor(keys, keyName), label, await drive.readJson<unknown>(fileId));
}

async function writeSealed(fileId: string, keys: ShopKeys, keyName: KeyName, label: string, value: unknown) {
  return (await drive.updateJson(fileId, await seal(keyName, keyFor(keys, keyName), label, value))).modifiedTime;
}

async function createSealed(name: string, folderId: string, keys: ShopKeys, keyName: KeyName, label: string, value: unknown) {
  const file = await drive.createJson(name, folderId, await seal(keyName, keyFor(keys, keyName), label, value));
  await drive.preventResharing(file.id).catch(() => undefined);
  return file;
}

/** Owners and front desk get both keys; technicians only the shop key. */
function keysForRole(keys: ShopKeys, role: Role): ShopKeys {
  return { shop: keys.shop, books: role === "technician" ? null : keys.books };
}

const readsBooks = (role: Role) => role !== "technician";

// ---------------------------------------------------------------------------
// Invite links
// ---------------------------------------------------------------------------

export function encodeInvite(payload: InvitePayload): string {
  const json = JSON.stringify(payload);
  return btoa(unescape(encodeURIComponent(json))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeInvite(text: string): InvitePayload | null {
  try {
    const b64 = text.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(escape(atob(b64 + "===".slice((b64.length + 3) % 4))));
    const p = JSON.parse(json) as InvitePayload;
    return p && p.v === 1 && p.app === "repair" && p.l && p.c && p.f && p.m ? p : null;
  } catch {
    return null;
  }
}

export function inviteLink(payload: InvitePayload, keys: ShopKeys): string {
  return `${window.location.origin}${REPAIR_APP_PATH}?join=${encodeInvite(payload)}#${keysToFragment(keys)}`;
}

function invitePayloadFor(state: TeamState, member: TeamMember): InvitePayload {
  const books = readsBooks(member.role);
  return {
    v: 1,
    app: "repair",
    n: state.shopName,
    r: member.role,
    l: state.files.live,
    c: state.files.catalog,
    b: books ? state.files.books : null,
    a: books ? state.files.archive : null,
    d: books ? state.files.media : null,
    w: member.role === "technician" ? (member.benchFileId ?? null) : null,
    f: member.fileId,
    m: member.code,
    e: member.email,
  };
}

/** The files a member must pick once when joining. */
export function inviteFileIds(payload: InvitePayload): string[] {
  return [payload.l, payload.c, payload.f, payload.b, payload.a, payload.d, payload.w].filter((id): id is string => Boolean(id));
}

// ---------------------------------------------------------------------------
// "My shops" note in the signed-in person's hidden Drive folder
// ---------------------------------------------------------------------------

async function readShopsNote(): Promise<{ fileId: string | null; note: ShopsNote }> {
  const empty: ShopsNote = { app: TEAM_APP, version: 1, shops: [] };
  const file = await drive.findAppDataFile(SHOPS_NOTE);
  if (!file) return { fileId: null, note: empty };
  const note = await drive.readJson<ShopsNote>(file.id).catch(() => null);
  const shops = (note?.shops ?? []).filter((s) => s && s.files?.live);
  return { fileId: file.id, note: { ...empty, shops } };
}

async function rememberShop(pointer: ShopPointer) {
  const { fileId, note } = await readShopsNote();
  const shops = [pointer, ...note.shops.filter((s) => s.files.live !== pointer.files.live)];
  const next: ShopsNote = { app: TEAM_APP, version: 1, shops };
  if (fileId) await drive.updateJson(fileId, next);
  else await drive.createAppDataJson(SHOPS_NOTE, next);
}

async function forgetShop(liveFileId: string) {
  const { fileId, note } = await readShopsNote();
  if (!fileId) return;
  await drive.updateJson(fileId, { ...note, shops: note.shops.filter((s) => s.files.live !== liveFileId) });
}

export type FoundShop = {
  pointer: ShopPointer;
  shopName: string;
  role: Role | null;
  removed: boolean;
  isPrimaryAccount: boolean;
  hubSeenAt: string | null;
  unreachable: boolean;
  needsKey: boolean;
};

/** Sign in (from a tap) and list the repair shops this Google account belongs to. */
export async function findMyShops(): Promise<{ email: string; shops: FoundShop[] }> {
  if (!currentToken()) await requestToken(true);
  const me = await drive.about();
  const { note } = await readShopsNote();
  const shops: FoundShop[] = [];
  for (const pointer of note.shops) {
    const blank = { pointer, shopName: pointer.shopName, role: null, removed: false, isPrimaryAccount: false, hubSeenAt: null };
    const raw = await drive.readJson<unknown>(pointer.files.live).catch(() => null);
    if (!raw) {
      shops.push({ ...blank, unreachable: true, needsKey: false });
      continue;
    }
    if (!pointer.keys) {
      shops.push({ ...blank, unreachable: false, needsKey: true });
      continue;
    }
    let live: LiveFile;
    try {
      live = await openEnvelope<LiveFile>(pointer.keys.shop, FILE_LABEL.live, raw);
    } catch {
      shops.push({ ...blank, unreachable: false, needsKey: true });
      continue;
    }
    const member = live.members.find((m) => sameEmail(m.email, me.emailAddress) && !m.removedAt);
    shops.push({
      pointer,
      shopName: live.shopName,
      role: member?.role ?? null,
      removed: !member,
      isPrimaryAccount: sameEmail(live.primaryEmail, me.emailAddress),
      hubSeenAt: live.updatedAt ?? null,
      unreachable: false,
      needsKey: false,
    });
  }
  return { email: me.emailAddress, shops };
}

// ---------------------------------------------------------------------------
// Capture
// ---------------------------------------------------------------------------

/** Shrink the pictures a new job carries before it is queued for the team. */
async function shrinkMedia(ops: Op[]): Promise<Op[]> {
  for (const op of ops) {
    if (op.type !== "put" || op.store !== "jobs") continue;
    const photos = op.fields.intakePhotos;
    if (Array.isArray(photos) && photos.length) op.fields.intakePhotos = await shrinkPhotos(photos as string[]);
  }
  return ops;
}

function activateCapture(state: TeamState | null) {
  if (!state || state.removed) {
    setRepairCaptureSink(null);
    return;
  }
  let seq = Date.now() * 1000;
  setRepairCaptureSink(async (write) => {
    const ops = captureOps(write, {
      role: state.role,
      newId: () => newOpId(state.memberCode, state.deviceId),
      now: new Date().toISOString(),
    });
    await shrinkMedia(ops);
    return ops.map((op) => ({ id: op.id, seq: seq++, op }));
  });
}

/** Load this device's team membership (if any) and start capturing writes. */
export async function loadTeam(): Promise<TeamState | null> {
  const stored = (await repairGet<TeamState>("drive_state", "main")) ?? null;
  if (stored && stored.version !== TEAM_FILE_VERSION) {
    await repairBatchRaw({}, { drive_state: ["main"] });
    activateCapture(null);
    publishSession(null);
    return null;
  }
  activateCapture(stored);
  publishSession(stored);
  return stored;
}

/** Sign in with Google (must run from a tap). */
export async function signIn(): Promise<void> {
  await requestToken(true);
  if (session?.needsSignIn) await saveState({ ...session, needsSignIn: false, lastError: "" });
}

function baseState(
  fields: Partial<TeamState> & Pick<TeamState, "shopName" | "memberCode" | "role" | "email" | "files" | "keys">
): TeamState {
  const consent = readTeamConsent();
  return {
    id: "main",
    version: TEAM_FILE_VERSION,
    termsVersion: consent?.version ?? null,
    termsAcceptedAt: consent?.at ?? null,
    isPrimary: false,
    deviceId: newDeviceId(),
    primaryEmail: "",
    permissions: DEFAULT_FRONTDESK_PERMISSIONS,
    technicianId: null,
    ownFileId: null,
    benchFileId: null,
    folderId: null,
    members: [],
    consumed: {},
    remoteSeen: {},
    opBase: 0,
    uploaded: 0,
    published: {},
    hubSeenAt: null,
    lastSyncAt: null,
    lastError: "",
    needsSignIn: false,
    rejected: [],
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
  const now = new Date().toISOString();
  const code = "O";
  const keys: ShopKeys = { shop: newKey(), books: newKey() };

  const folder = await drive.createFolder(`Setu Repair – ${shopName}`);
  const ownerChanges = await createSealed(`changes-${code}.json`, folder.id, keys, "shop", FILE_LABEL.changes(code), {
    memberCode: code,
    devices: {},
  } satisfies ChangesFileBody);
  const catalog = await createSealed("catalog.json", folder.id, keys, "shop", FILE_LABEL.catalog, {});
  const books = await createSealed("books.json", folder.id, keys, "books", FILE_LABEL.books, {});
  const archive = await createSealed("archive.json", folder.id, keys, "books", FILE_LABEL.archive, {});
  const media = await createSealed("media.json", folder.id, keys, "books", FILE_LABEL.media, {});
  const live = await createSealed("live.json", folder.id, keys, "shop", FILE_LABEL.live, {});
  const files: ShopFileIds = { live: live.id, catalog: catalog.id, books: books.id, archive: archive.id, media: media.id };

  const members: TeamMember[] = [
    { email: me.emailAddress, role: "owner", code, addedAt: now, fileId: ownerChanges.id, name: me.displayName },
  ];
  const state = baseState({
    shopName,
    isPrimary: true,
    memberCode: code,
    role: "owner",
    email: me.emailAddress,
    primaryEmail: me.emailAddress,
    files,
    keys,
    ownFileId: ownerChanges.id,
    folderId: folder.id,
    members,
    lastSyncAt: now,
    hubSeenAt: now,
  });
  const leftover = await repairGetAll<OpRow>("drive_ops");
  if (leftover.length) await repairBatchRaw({}, { drive_ops: leftover.map((o) => o.id) });
  const published = await publish(state);
  await rememberShop({ files, ownFileId: ownerChanges.id, benchFileId: null, folderId: folder.id, shopName, keys, savedAt: now });
  await saveState(published);
  activateCapture(published);
  return published;
}

function requirePrimary(): TeamState {
  if (!session?.isPrimary) throw new Error("Only the shop's main device can manage the team.");
  if (!session.folderId) throw new Error("This device doesn't know the shop's Drive folder. Make it the main device again.");
  return session;
}

export type InviteInput = {
  email: string;
  name: string;
  /** Mobile number already normalized, or "". */
  phone: string;
  role: Role;
  permissions: MemberPermissions;
  /** Technicians: whose jobs they get. */
  technicianId: string | null;
};

const CODE_PREFIX: Record<Role, string> = { owner: "O", frontdesk: "F", technician: "T" };

export async function inviteMember(input: InviteInput): Promise<string> {
  const state = requirePrimary();
  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email address.");
  if (state.members.some((m) => sameEmail(m.email, email) && !m.removedAt)) {
    throw new Error("This person is already in your team.");
  }
  if (activeMembers(state.members).length >= MAX_TEAM_SIZE) {
    throw new Error(`Team sync allows up to ${MAX_TEAM_SIZE} people, you included. Remove someone to invite another person.`);
  }
  if (input.role === "technician" && !input.technicianId) {
    throw new Error("Pick which technician this person is, so they see their own jobs.");
  }
  if (
    input.role === "technician" &&
    state.members.some((m) => !m.removedAt && m.role === "technician" && m.technicianId === input.technicianId)
  ) {
    throw new Error("Someone in the team is already signed in as that technician.");
  }
  const prefix = CODE_PREFIX[input.role];
  let n = 1;
  while (state.members.some((m) => m.code === `${prefix}${n}`)) n += 1;
  const code = `${prefix}${n}`;

  const file = await createSealed(`changes-${code}.json`, state.folderId!, state.keys, "shop", FILE_LABEL.changes(code), {
    memberCode: code,
    devices: {},
  } satisfies ChangesFileBody);
  let benchFileId: string | null = null;
  if (input.role === "technician") {
    const bench = await createSealed(`bench-${code}.json`, state.folderId!, state.keys, "shop", FILE_LABEL.bench(code), {
      version: TEAM_FILE_VERSION,
      technicianId: input.technicianId,
      jobs: [],
      customers: [],
    } satisfies BenchFile);
    benchFileId = bench.id;
  }
  const member: TeamMember = {
    email,
    name: input.name.trim(),
    role: input.role,
    code,
    addedAt: new Date().toISOString(),
    fileId: file.id,
    benchFileId,
    technicianId: input.role === "technician" ? input.technicianId : null,
    ...(input.phone ? { phone: input.phone } : {}),
    permissions: input.role === "frontdesk" ? input.permissions : undefined,
  };
  const link = inviteLink(invitePayloadFor(state, member), keysForRole(state.keys, member.role));

  await drive.share(file.id, email, "writer", false);
  await drive.share(
    state.files.live,
    email,
    "reader",
    true,
    `You're invited to ${state.shopName} on Setu's Free Repair Job Card. Open this link once to join (it holds the shop's key, so don't forward it): ${link} — after that, just sign in with Google on any device.`
  );
  await drive.share(state.files.catalog, email, "reader", false);
  if (readsBooks(member.role)) {
    await drive.share(state.files.books, email, "reader", false);
    await drive.share(state.files.archive, email, "reader", false);
    await drive.share(state.files.media, email, "reader", false);
  }
  if (benchFileId) await drive.share(benchFileId, email, "reader", false);

  const next = { ...state, members: [...state.members, member] };
  await saveState(await publish(next));
  return link;
}

export function memberInviteLink(code: string): string | null {
  const s = session;
  const m = s?.members.find((x) => x.code === code);
  if (!s || !m || !m.fileId) return null;
  return inviteLink(invitePayloadFor(s, m), keysForRole(s.keys, m.role));
}

export async function updateMember(
  code: string,
  patch: { permissions?: MemberPermissions; name?: string; phone?: string; technicianId?: string | null }
) {
  const state = requirePrimary();
  const members = state.members.map((m) => {
    if (m.code !== code) return m;
    const updated: TeamMember = { ...m, ...patch };
    if (!updated.phone) delete updated.phone;
    return updated;
  });
  await saveState(await publish({ ...state, members }));
}

export async function removeMember(code: string) {
  const state = requirePrimary();
  const member = state.members.find((m) => m.code === code);
  if (!member || member.code === state.memberCode) return;
  // Apply what they sent before removal, so no job update is lost.
  await syncNow();
  const after = requirePrimary();
  const members = after.members.map((m) => (m.code === code ? { ...m, removedAt: new Date().toISOString() } : m));
  const fileIds = [
    after.files.live,
    after.files.catalog,
    after.files.books,
    after.files.archive,
    after.files.media,
    member.fileId,
    member.benchFileId ?? "",
  ].filter(Boolean);
  for (const fileId of fileIds) await drive.unshare(fileId, member.email).catch(() => undefined);
  await saveState(await publish({ ...after, members }));
}

// ---------------------------------------------------------------------------
// Opening a shop on a device: invite link, or plain sign-in
// ---------------------------------------------------------------------------

async function startOnDevice(live: LiveFile, pointer: ShopPointer & { keys: ShopKeys }, email: string, member: TeamMember) {
  await repairClearAll();
  await repairBatchRaw({ repairSettings: [{ ...DEFAULT_SETTINGS, id: "main" }] });
  const state = baseState({
    shopName: live.shopName,
    memberCode: member.code,
    role: member.role,
    email,
    primaryEmail: live.primaryEmail,
    permissions: { ...DEFAULT_FRONTDESK_PERMISSIONS, ...member.permissions },
    technicianId: member.technicianId ?? null,
    files: live.files,
    keys: keysForRole(pointer.keys, member.role),
    ownFileId: member.fileId,
    benchFileId: member.benchFileId ?? null,
    folderId: pointer.folderId,
    members: live.members,
    consumed: live.consumed,
    hubSeenAt: live.updatedAt ?? null,
  });
  await saveState(state);
  activateCapture(state);
  await rememberShop({
    files: live.files,
    ownFileId: member.fileId,
    benchFileId: member.benchFileId ?? null,
    folderId: pointer.folderId,
    shopName: live.shopName,
    keys: state.keys,
    savedAt: new Date().toISOString(),
  }).catch(() => undefined);
  await syncNow();
}

async function openLive(
  ids: string[],
  liveId: string,
  keys: ShopKeys,
  pick: (ids: string[]) => Promise<string[] | null>
): Promise<LiveFile> {
  const read = () => readSealed<LiveFile>(liveId, keys, "shop", FILE_LABEL.live);
  try {
    return await read();
  } catch (error) {
    if (error instanceof DecryptError) throw error;
  }
  const picked = await pick(ids);
  if (!picked) throw new Error("Cancelled.");
  const missing = ids.filter((id) => !picked.includes(id));
  if (missing.length) {
    throw new Error(`${missing.length} of the shop's files still weren't selected. Tap again and select each file Google shows.`);
  }
  return read();
}

/** Join with an invite link. The keys come from the link's `#` part. */
export async function joinTeam(payload: InvitePayload, keys: ShopKeys, pick: (ids: string[]) => Promise<string[] | null>) {
  if (!currentToken()) await requestToken(true);
  const me = await drive.about();
  if (!sameEmail(me.emailAddress, payload.e)) {
    throw new Error(
      `This invite is for ${payload.e}, but you signed in as ${me.emailAddress}. Sign in with the invited Google account.`
    );
  }
  let live: LiveFile;
  try {
    live = await openLive(inviteFileIds(payload), payload.l, keys, pick);
  } catch (error) {
    if (error instanceof DecryptError) {
      throw new Error("This invite link's key doesn't match the shop. Ask the owner to send the link again, copied in full.");
    }
    throw error;
  }
  const member = live.members.find((m) => m.code === payload.m);
  if (!member || member.removedAt) throw new Error("This invite is no longer valid. Ask the owner to invite you again.");
  await startOnDevice(
    live,
    { files: live.files, ownFileId: payload.f, benchFileId: payload.w, folderId: null, shopName: live.shopName, keys, savedAt: "" },
    me.emailAddress,
    member
  );
}

/** Open a shop found by findMyShops on this device, with this account's role. */
export async function openShop(found: FoundShop, pick: (ids: string[]) => Promise<string[] | null>, recovery?: ShopKeys) {
  if (!currentToken()) await requestToken(true);
  const me = await drive.about();
  const p = found.pointer;
  const keys = recovery ?? p.keys;
  if (!keys) throw new Error("This device needs the shop's recovery key to open it.");
  const ids = [
    p.files.live,
    p.files.catalog,
    ...(p.ownFileId ? [p.ownFileId] : []),
    ...(p.benchFileId ? [p.benchFileId] : []),
    ...(keys.books ? [p.files.books, p.files.archive, p.files.media] : []),
  ];
  let live: LiveFile;
  try {
    live = await openLive(ids, p.files.live, keys, pick);
  } catch (error) {
    if (error instanceof DecryptError) throw new Error("That key doesn't open this shop. Check the recovery key and try again.");
    throw error;
  }
  const member = live.members.find((m) => sameEmail(m.email, me.emailAddress) && !m.removedAt);
  if (!member) {
    await forgetShop(p.files.live).catch(() => undefined);
    throw new Error(`${me.emailAddress} is no longer in ${live.shopName}'s team.`);
  }
  await startOnDevice(live, { ...p, keys }, me.emailAddress, member);
}

/**
 * Make this device the shop's main device (new computer, broken old one).
 * Only the account that owns the shop's files can.
 */
export async function makeMainDevice() {
  const state = session;
  if (!state || state.isPrimary) return;
  if (state.role !== "owner" || !sameEmail(state.email, state.primaryEmail)) {
    throw new Error(`Only ${state?.primaryEmail || "the shop owner's account"} can make a device the main device.`);
  }
  await syncNow();
  const current = session!;
  const live = await readSealed<LiveFile>(current.files.live, current.keys, "shop", FILE_LABEL.live);
  const books = (await cached("books"))?.data as BooksFile | undefined;
  const folderId = current.folderId ?? (await drive.getFolderOf(current.files.live));
  const rows = await readOpRows();
  const consumed = {
    ...live.consumed,
    [consumedKey(current.memberCode, current.deviceId)]: current.opBase + rows.length,
  };
  const next: TeamState = {
    ...current,
    isPrimary: true,
    folderId,
    members: live.members.map((m) => {
      const phone = books?.memberPhones?.[m.code];
      return phone ? { ...m, phone } : m;
    }),
    consumed,
    published: {},
    lastError: "",
  };
  const published = await publish(next);
  if (rows.length) await repairBatchRaw({}, { drive_ops: rows.map((r) => r.id) });
  await saveState({ ...published, opBase: 0, uploaded: 0 });
  await rememberShop({
    files: next.files,
    ownFileId: next.ownFileId,
    benchFileId: null,
    folderId,
    shopName: next.shopName,
    keys: next.keys,
    savedAt: new Date().toISOString(),
  }).catch(() => undefined);
}

export type LeaveOptions = { wipe: boolean; flush?: boolean; signOut?: boolean };

/**
 * Stop syncing on this device. With `wipe`, every repair record on the device
 * is deleted (staff devices: the data is the shop's); without it the data
 * stays (the owner's main device turning sync off).
 */
export async function leaveTeam(options: LeaveOptions = { wipe: false }) {
  if (options.flush && session && !session.removed && navigator.onLine) {
    await syncNow().catch(() => undefined);
  }
  setRepairCaptureSink(null);
  if (options.wipe) {
    await repairClearAll();
  } else {
    await repairBatchRaw({}, { drive_state: ["main"] });
    const ops = await repairGetAll<OpRow>("drive_ops");
    if (ops.length) await repairBatchRaw({}, { drive_ops: ops.map((o) => o.id) });
    const cache = await repairGetAll<CacheRow>("drive_cache");
    if (cache.length) await repairBatchRaw({}, { drive_cache: cache.map((c) => c.id) });
  }
  memoryCache.clear();
  publishSession(null);
  if (options.signOut) await googleSignOut().catch(() => undefined);
}

const NOTICE_KEY = "setu-repair-team-notice";

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
// Cache of the shop files a member device last downloaded
// ---------------------------------------------------------------------------

const memoryCache = new Map<string, CacheRow>();

async function cached(kind: string): Promise<CacheRow | null> {
  const inMemory = memoryCache.get(kind);
  if (inMemory) return inMemory;
  const row = (await repairGet<CacheRow>("drive_cache", kind)) ?? null;
  if (row) memoryCache.set(kind, row);
  return row;
}

async function fetchFile<T>(kind: string, fileId: string, keys: ShopKeys, keyName: KeyName, label: string, rev: string): Promise<T> {
  const have = await cached(kind);
  if (have && have.rev === rev) return have.data as T;
  const data = await readSealed<T>(fileId, keys, keyName, label);
  const row: CacheRow = { id: kind, rev, data };
  memoryCache.set(kind, row);
  await repairBatchRaw({ drive_cache: [row] });
  return data;
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
    const lastError = next.accessStrikes ? next.lastError : "";
    await saveState({ ...next, lastSyncAt: new Date().toISOString(), lastError, needsSignIn: false });
  } catch (error) {
    const needsSignIn = error instanceof NeedsSignInError || (error instanceof DriveError && error.status === 401);
    await saveState({
      ...(session ?? state),
      needsSignIn,
      lastError: needsSignIn ? "" : error instanceof Error ? error.message : "Sync failed.",
    });
  }
}

/** Hub: read every member's new operations, merge them in, publish. */
async function syncHub(state: TeamState): Promise<TeamState> {
  // Another device may have been made the main device since.
  const liveMeta = await drive.getFile(state.files.live);
  if (state.remoteSeen[state.files.live] !== liveMeta.modifiedTime) {
    const live = await readSealed<LiveFile>(state.files.live, state.keys, "shop", FILE_LABEL.live);
    if (live.hubDeviceId && live.hubDeviceId !== state.deviceId) {
      const demoted: TeamState = {
        ...state,
        isPrimary: false,
        members: live.members,
        consumed: live.consumed,
        opBase: live.consumed[consumedKey(state.memberCode, state.deviceId)] ?? 0,
        uploaded: 0,
        published: {},
        hubSeenAt: live.updatedAt ?? null,
        ownFileId: state.ownFileId ?? live.members.find((m) => m.code === state.memberCode)?.fileId ?? null,
      };
      return syncMember(demoted);
    }
  }

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
    const body = await readSealed<ChangesFileBody>(member.fileId, state.keys, "shop", FILE_LABEL.changes(member.code));
    const fresh = freshOps(member.code, body, consumed);
    consumed = fresh.consumed;
    if (fresh.ops.length) files.push({ memberCode: member.code, ops: fresh.ops });
    remoteSeen[member.fileId] = meta.modifiedTime;
  }

  let { rejected } = state;
  if (files.length) {
    const local = await readSnapshot();
    const merged = mergeTeam(local, state.members, files);
    await applyPlan(planApply(local, merged.stores, SYNC_STORES), {
      jobsWithNewStatus: jobsWithNewStatus(local, merged.stores),
    });
    const at = new Date().toISOString();
    rejected = [
      ...merged.rejected.map((r) => ({
        memberCode: r.memberCode,
        reason: r.reason,
        what: summarize(r.op) + (r.fields ? ` — ignored: ${r.fields.join(", ")}` : ""),
        at,
      })),
      ...rejected,
    ].slice(0, 50);
  }

  const localOps = await repairGetAll<OpRow>("drive_ops");
  if (files.length || localOps.length || JSON.stringify(consumed) !== JSON.stringify(state.consumed)) {
    const next = await publish({ ...state, consumed, remoteSeen, rejected });
    if (localOps.length) await repairBatchRaw({}, { drive_ops: localOps.map((o) => o.id) });
    return next;
  }
  return { ...state, consumed, remoteSeen };
}

/**
 * Hub: write the shop's files from its data. catalog, books, archive, media
 * and each bench are uploaded only when their content changed; live.json
 * (stock, team, progress) every time.
 */
async function publish(state: TeamState): Promise<TeamState> {
  const local = await readSnapshot();
  const now = new Date().toISOString();
  const { books, archive } = buildBooksAndArchive(local, state.members);
  const contents: Record<PublishedKind, { keyName: KeyName; value: unknown }> = {
    catalog: { keyName: "shop", value: buildCatalog(local, await readBusiness()) },
    books: { keyName: "books", value: books },
    archive: { keyName: "books", value: archive },
    media: { keyName: "books", value: await buildMedia(local, shrinkPhotos) },
  };
  const published = { ...state.published, bench: { ...(state.published.bench ?? {}) } };
  for (const kind of ["catalog", "books", "archive", "media"] as PublishedKind[]) {
    const rev = await fingerprint(JSON.stringify(contents[kind].value));
    if (published[kind] === rev) continue;
    await writeSealed(state.files[kind], state.keys, contents[kind].keyName, FILE_LABEL[kind], contents[kind].value);
    published[kind] = rev;
  }
  for (const member of activeMembers(state.members)) {
    if (member.role !== "technician" || !member.benchFileId) continue;
    const bench = await buildBench(local, member.technicianId ?? null, shrinkPhotos);
    const rev = await fingerprint(JSON.stringify(bench));
    if (published.bench[member.code] === rev) continue;
    await writeSealed(member.benchFileId, state.keys, "shop", FILE_LABEL.bench(member.code), bench);
    published.bench[member.code] = rev;
  }
  const live: LiveFile = {
    version: TEAM_FILE_VERSION,
    shopName: state.shopName,
    updatedAt: now,
    primaryCode: state.memberCode,
    primaryEmail: state.primaryEmail || state.email,
    hubDeviceId: state.deviceId,
    members: publicMembers(state.members),
    consumed: state.consumed,
    stock: buildStock(local),
    files: state.files,
    revs: {
      catalog: published.catalog ?? "",
      books: published.books ?? "",
      archive: published.archive ?? "",
      media: published.media ?? "",
      bench: published.bench,
    },
  };
  const liveTime = await writeSealed(state.files.live, state.keys, "shop", FILE_LABEL.live, live);
  return { ...state, published, hubSeenAt: now, remoteSeen: { ...state.remoteSeen, [state.files.live]: liveTime } };
}

/** Member device: upload this device's section, then take what the hub published. */
async function syncMember(input: TeamState): Promise<TeamState> {
  let state = input;
  const remoteSeen = { ...state.remoteSeen };

  // Drop operations the hub has already merged, so files stay small.
  const mergedCount = state.consumed[consumedKey(state.memberCode, state.deviceId)] ?? 0;
  let rows = await readOpRows();
  if (mergedCount > state.opBase) {
    const drop = rows.slice(0, mergedCount - state.opBase);
    if (drop.length) await repairBatchRaw({}, { drive_ops: drop.map((r) => r.id) });
    rows = rows.slice(drop.length);
    state = { ...state, opBase: state.opBase + drop.length };
  }
  const ops = rows.map((r) => r.op);
  const total = state.opBase + ops.length;
  let uploaded = state.uploaded;

  if (state.ownFileId) {
    const meta = await drive.getFile(state.ownFileId).catch((e: unknown) => {
      if (e instanceof DriveError && (e.status === 403 || e.status === 404)) return null;
      throw e;
    });
    if (meta && (remoteSeen[state.ownFileId] !== meta.modifiedTime || total > uploaded)) {
      const label = FILE_LABEL.changes(state.memberCode);
      const body = await readSealed<ChangesFileBody>(state.ownFileId, state.keys, "shop", label);
      const mine = deviceSections(body)[state.deviceId];
      const theirs = mine ? mine.base + mine.ops.length : 0;
      if (!mine || theirs < total || mine.base < state.opBase) {
        remoteSeen[state.ownFileId] = await writeSealed(
          state.ownFileId,
          state.keys,
          "shop",
          label,
          withDeviceSection(body, state.memberCode, state.deviceId, { base: state.opBase, ops })
        );
      } else {
        remoteSeen[state.ownFileId] = meta.modifiedTime;
      }
      uploaded = total;
    }
  }

  const meta = await drive.getFile(state.files.live).catch((e: unknown) => {
    if (e instanceof DriveError && (e.status === 403 || e.status === 404)) return null;
    throw e;
  });
  if (!meta) {
    const me = await drive.about();
    if (!sameEmail(me.emailAddress, state.email)) {
      throw new Error(
        `Signed in to Google as ${me.emailAddress}, but this device belongs to ${state.email}. Reconnect with ${state.email}.`
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
    setRepairCaptureSink(null);
    return { ...state, uploaded, remoteSeen, accessStrikes: strikes, accessFailedSince: since, removed: true };
  }
  if (remoteSeen[state.files.live] === meta.modifiedTime && uploaded === state.uploaded) {
    return { ...state, uploaded, remoteSeen, accessStrikes: 0, accessFailedSince: null };
  }

  const live = await readSealed<LiveFile>(state.files.live, state.keys, "shop", FILE_LABEL.live);
  remoteSeen[state.files.live] = meta.modifiedTime;

  const me = live.members.find((m) => m.code === state.memberCode);
  if (!me || me.removedAt) {
    setRepairCaptureSink(null);
    return { ...state, uploaded, remoteSeen, removed: true, members: live.members };
  }

  const books = readsBooks(me.role) && Boolean(state.keys.books);
  const catalog = await fetchFile<CatalogFile>("catalog", state.files.catalog, state.keys, "shop", FILE_LABEL.catalog, live.revs.catalog);
  const published = {
    live,
    catalog,
    books: books ? await fetchFile<BooksFile>("books", state.files.books, state.keys, "books", FILE_LABEL.books, live.revs.books) : null,
    archive: books
      ? await fetchFile<ArchiveFile>("archive", state.files.archive, state.keys, "books", FILE_LABEL.archive, live.revs.archive)
      : null,
    media: books ? await fetchFile<MediaFile>("media", state.files.media, state.keys, "books", FILE_LABEL.media, live.revs.media) : null,
    bench:
      me.role === "technician" && me.benchFileId
        ? await fetchFile<BenchFile>(
            "bench",
            me.benchFileId,
            state.keys,
            "shop",
            FILE_LABEL.bench(me.code),
            live.revs.bench?.[me.code] ?? ""
          )
        : null,
  };

  const pending = pendingOps(ops, state.opBase, live.consumed[consumedKey(state.memberCode, state.deviceId)] ?? 0);
  const merged = mergeTeam(baseFromPublished(published), live.members, [{ memberCode: state.memberCode, ops: pending }]);
  const local = await readSnapshot();
  await applyPlan(planApply(local, merged.stores, SYNC_STORES), { jobsWithNewStatus: [] });
  await applyBusiness(catalog.business);

  return {
    ...state,
    uploaded,
    remoteSeen,
    accessStrikes: 0,
    accessFailedSince: null,
    shopName: live.shopName,
    files: live.files,
    members: live.members,
    consumed: live.consumed,
    role: me.role,
    permissions: { ...DEFAULT_FRONTDESK_PERMISSIONS, ...me.permissions },
    technicianId: me.technicianId ?? null,
    benchFileId: me.benchFileId ?? state.benchFileId,
    primaryEmail: live.primaryEmail || state.primaryEmail,
    hubSeenAt: live.updatedAt ?? state.hubSeenAt,
  };
}

/** Stores a backup or a wipe treats as the shop's data (re-exported for screens). */
export const SHOP_DATA_STORES: readonly RepairStoreName[] = REPAIR_DATA_STORES;

export { MAX_TEAM_SIZE, TEAM_FILE_VERSION };

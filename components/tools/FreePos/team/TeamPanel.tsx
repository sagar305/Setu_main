"use client";

import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Cloud,
  Copy,
  LogOut,
  MessageCircle,
  Pencil,
  RefreshCw,
  ShieldCheck,
  UserMinus,
  UserPlus,
} from "lucide-react";
import {
  enableTeam,
  inviteMember,
  leaveTeam,
  makeMainDevice,
  memberInviteLink,
  removeMember,
  updateMember,
  type TeamState,
} from "@/lib/pos/drive/engine";
import type { TeamMember } from "@/lib/pos/drive/hub";
import { DEFAULT_CASHIER_PERMISSIONS, type MemberPermissions, type Role } from "@/lib/pos/drive/ops";
import { ROLE_LABELS, permissionsOf } from "@/lib/pos/drive/roles";
import { usePos } from "@/lib/pos/store";
import {
  defaultCountryFor,
  formatPhone,
  inviteMessage,
  normalizePhone,
  whatsappUrl,
} from "@/lib/pos/drive/whatsapp";
import { ConfirmDialog, Field, Modal, dangerBtnClass, inputClass, primaryBtnClass, secondaryBtnClass } from "../ui";
import { timeAgo, useTeam } from "./TeamSyncContext";
import { OpenShopButton } from "./OpenShop";

const REJECT_LABELS: Record<string, string> = {
  "unknown-member": "from someone not in the team",
  "member-removed": "sent after the member was removed",
  "not-allowed-for-role": "not allowed for their role",
  "duplicate-invoice-number": "duplicate invoice number",
  "discount-over-limit": "discount above their limit",
  "credit-not-allowed": "credit sale while credit is off for them",
  "unknown-order": "for a sale that doesn't exist",
};

function errorText(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Try again.";
}

/** Sync status line shared by the owner and member views. */
export function SyncStatus({ compact = false }: { compact?: boolean }) {
  const { team, syncing, sync, reconnect } = useTeam();
  const [error, setError] = useState("");
  if (!team) return null;

  let tone = "text-emerald-700 bg-emerald-50 border-emerald-200";
  let text = `Synced ${timeAgo(team.lastSyncAt)}`;
  if (syncing) {
    tone = "text-indigo bg-indigo/5 border-indigo/20";
    text = "Syncing…";
  } else if (team.removed) {
    tone = "text-red-700 bg-red-50 border-red-200";
    text = "You were removed from this shop's team";
  } else if (team.needsSignIn) {
    tone = "text-ink bg-saffron/15 border-saffron/40";
    text = "Google sign-in expired — sales are saved here and will upload after you reconnect";
  } else if (team.lastError) {
    tone = "text-red-700 bg-red-50 border-red-200";
    text = `Sync problem: ${team.lastError}`;
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-sm ${tone}`}>
      <Cloud className="h-4 w-4 shrink-0" />
      <span className="min-w-0 flex-1 font-semibold">{text}</span>
      {!team.removed &&
        (team.needsSignIn ? (
          <button
            type="button"
            onClick={() => {
              setError("");
              reconnect().catch((e) => setError(errorText(e)));
            }}
            className={`${primaryBtnClass} px-3 py-1.5`}
          >
            Reconnect Google
          </button>
        ) : (
          !compact && (
            <button
              type="button"
              disabled={syncing}
              onClick={() => void sync()}
              className={`${secondaryBtnClass} px-3 py-1.5`}
            >
              <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
              Sync now
            </button>
          )
        ))}
      {error && <span className="w-full text-xs text-red-700">{error}</span>}
    </div>
  );
}

export function TeamPanel() {
  const { available, ready, team } = useTeam();
  if (!available || !ready) return null;
  if (!team) return <TurnOnTeam />;
  if (team.isPrimary) return <OwnerTeam team={team} />;
  return <MemberTeam team={team} />;
}

// ---------------------------------------------------------------------------
// Not in a team yet
// ---------------------------------------------------------------------------

function TurnOnTeam() {
  const { business, settings } = usePos();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const batchOn = settings.batchTracking === true;

  const turnOn = async () => {
    setBusy(true);
    setError("");
    try {
      await enableTeam(business?.name || "My shop");
      setConfirming(false);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <ul className="space-y-1.5 text-sm text-muted">
        <li>• Use this POS on more devices and invite staff by email — free, no Setu account.</li>
        <li>• Your data is kept in <strong className="text-ink">your own Google Drive</strong>. Setu never receives it.</li>
        <li>• Cashiers can only bill and add customers, with the discount and credit limits you set.</li>
      </ul>
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={() => setConfirming(true)} className={primaryBtnClass}>
          <Cloud className="h-4 w-4" />
          Turn on team sync
        </button>
        <OpenShopButton label="Sign in to open my shop" />
      </div>
      <p className="text-xs text-muted">
        Already using team sync on another device, or invited by a shop owner? Use <strong>Sign in to open my
        shop</strong> — the first time as staff, open the owner&apos;s invite link instead.
      </p>

      <Modal open={confirming} onClose={() => !busy && setConfirming(false)} title="Turn on Google Drive team sync?">
        <div className="space-y-3 text-sm text-ink">
          <p>
            You&apos;ll sign in with Google. A folder <strong>Setu POS – {business?.name}</strong> is created in your
            Drive to keep the shop&apos;s data.
          </p>
          <div
            className={`rounded-lg border px-3 py-2 ${
              batchOn ? "border-saffron/50 bg-saffron/10" : "border-muted-line/40 bg-cream-paper"
            }`}
          >
            <p className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="h-4 w-4 text-saffron" />
              Batch &amp; expiry tracking will be switched off
            </p>
            <p className="mt-1 text-muted">
              {batchOn
                ? "It is ON now. Team sync turns it off on every device in the team. Your batch records stay on this device but are not used while sync is on."
                : "It stays off on every device while team sync is on."}
            </p>
          </div>
          <ul className="space-y-1 text-muted">
            <li>• This device becomes the shop&apos;s <strong className="text-ink">main device</strong>. Keep it open during working hours — staff see each other&apos;s sales and stock after it syncs (every minute).</li>
            <li>• Restore from backup and Delete all data are turned off while sync is on.</li>
            <li>• Google asks you to reconnect about once an hour of use; sales keep working meanwhile.</li>
          </ul>
          {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700">{error}</p>}
          <div className="flex justify-end gap-3 pt-1">
            <button type="button" disabled={busy} onClick={() => setConfirming(false)} className={secondaryBtnClass}>
              Cancel
            </button>
            <button type="button" disabled={busy} onClick={() => void turnOn()} className={primaryBtnClass}>
              {busy ? "Setting up…" : "Sign in with Google & turn on"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Owner's main device
// ---------------------------------------------------------------------------

function OwnerTeam({ team }: { team: TeamState }) {
  const { products } = usePos();
  const [inviting, setInviting] = useState(false);
  const [editing, setEditing] = useState<TeamMember | null>(null);
  const [removing, setRemoving] = useState<TeamMember | null>(null);
  const [turningOff, setTurningOff] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");

  const active = team.members.filter((m) => !m.removedAt);
  const oversold = team.oversold
    .map((id) => products.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));

  const copy = async (code: string) => {
    const link = memberInviteLink(code);
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(code);
      window.setTimeout(() => setCopied(""), 2000);
    } catch {
      window.prompt("Copy this invite link", link);
    }
  };

  return (
    <div className="space-y-4">
      <SyncStatus />

      {oversold.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <p className="font-semibold">Sold more than you had in stock</p>
          <p className="mt-0.5">
            {oversold.map((p) => `${p.name} (${p.stock})`).join(", ")} — two counters sold the last units at the same
            time. Count these items and correct stock in Products.
          </p>
        </div>
      )}

      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-bold text-ink">Team ({active.length})</h4>
          <button type="button" onClick={() => setInviting(true)} className={`${primaryBtnClass} px-3 py-1.5`}>
            <UserPlus className="h-4 w-4" />
            Invite by email
          </button>
        </div>
        <ul className="mt-2 divide-y divide-muted-line/20 rounded-lg border border-muted-line/30">
          {active.map((m) => {
            const limits = permissionsOf(m);
            const isMe = m.code === team.memberCode;
            return (
              <li key={m.code} className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">
                    {m.name || m.email}
                    {isMe && <span className="ml-1 text-xs font-normal text-muted">(you · this is the main device)</span>}
                  </p>
                  <p className="break-words text-xs text-muted">
                    {m.name ? `${m.email} · ` : ""}
                    {m.phone ? `${formatPhone(m.phone)} · ` : ""}
                    {ROLE_LABELS[m.role]} · code {m.code}
                    {m.role === "cashier" &&
                      ` · discount up to ${limits.maxDiscountPercent}% · credit ${limits.allowCredit ? "allowed" : "off"}`}
                  </p>
                </div>
                {!isMe && (
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => void copy(m.code)} className={`${secondaryBtnClass} px-3 py-1.5`}>
                      {copied === m.code ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      {copied === m.code ? "Copied" : "Invite link"}
                    </button>
                    {m.phone && (
                      <WhatsAppInviteLink member={m} shopName={team.shopName} className={`${secondaryBtnClass} px-3 py-1.5`} />
                    )}
                    <button type="button" onClick={() => setEditing(m)} className={`${secondaryBtnClass} px-3 py-1.5`}>
                      <Pencil className="h-4 w-4" />
                      Edit
                    </button>
                    <button type="button" onClick={() => setRemoving(m)} className={`${dangerBtnClass} px-3 py-1.5`}>
                      <UserMinus className="h-4 w-4" />
                      Remove
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {team.rejected.length > 0 && (
        <details className="rounded-lg border border-muted-line/30 px-3 py-2 text-sm">
          <summary className="cursor-pointer font-semibold text-ink">
            {team.rejected.length === 1
              ? "1 change from staff was not applied"
              : `${team.rejected.length} changes from staff were not applied`}
          </summary>
          <ul className="mt-2 space-y-1 text-xs text-muted">
            {team.rejected.map((r, i) => (
              <li key={i}>
                {new Date(r.at).toLocaleString()} · {r.memberCode}: {r.what} — {REJECT_LABELS[r.reason] ?? r.reason}
              </li>
            ))}
          </ul>
        </details>
      )}

      {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <button type="button" onClick={() => setTurningOff(true)} className={`${secondaryBtnClass} px-3 py-1.5`}>
        <LogOut className="h-4 w-4" />
        Turn off team sync on this device
      </button>

      <InviteModal open={inviting} onClose={() => setInviting(false)} />
      <EditMemberModal member={editing} onClose={() => setEditing(null)} />

      <ConfirmDialog
        open={removing !== null}
        title={`Remove ${removing?.name || removing?.email}?`}
        message="Their sales sent so far are kept. They lose access to the shop's files and can't sync any more. Anything still only on their device stays there."
        confirmLabel="Remove from team"
        onConfirm={() => {
          const m = removing;
          setRemoving(null);
          if (m) removeMember(m.code).catch((e) => setError(errorText(e)));
        }}
        onCancel={() => setRemoving(null)}
      />
      <ConfirmDialog
        open={turningOff}
        title="Turn off team sync?"
        message="This device stops syncing and your staff stop receiving updates. Your data stays on this device, and the files stay in your Google Drive. To sync again you'll turn it on fresh and re-invite your team."
        confirmLabel="Turn off"
        onConfirm={() => {
          setTurningOff(false);
          void leaveTeam();
        }}
        onCancel={() => setTurningOff(false)}
      />
    </div>
  );
}

function PermissionFields({
  value,
  onChange,
}: {
  value: MemberPermissions;
  onChange: (next: MemberPermissions) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Max discount (%)" hint="0 = no discounts">
        <input
          type="number"
          min={0}
          max={100}
          step="0.5"
          value={value.maxDiscountPercent}
          onChange={(e) =>
            onChange({ ...value, maxDiscountPercent: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })
          }
          className={inputClass}
        />
      </Field>
      <label className="flex items-start gap-2 self-end rounded-lg border border-muted-line/40 px-3 py-2 text-sm text-ink">
        <input
          type="checkbox"
          checked={value.allowCredit}
          onChange={(e) => onChange({ ...value, allowCredit: e.target.checked })}
          className="mt-0.5 h-4 w-4 accent-indigo"
        />
        Can sell on credit (udhaar)
      </label>
    </div>
  );
}

/** "Send on WhatsApp" for a member's invite: opens the owner's WhatsApp. */
function WhatsAppInviteLink({
  member,
  shopName,
  className,
  label = "WhatsApp",
}: {
  member: TeamMember;
  shopName: string;
  className: string;
  label?: string;
}) {
  const link = memberInviteLink(member.code);
  if (!member.phone || !link) return null;
  const message = inviteMessage({ name: member.name, shopName, email: member.email, link });
  return (
    <a href={whatsappUrl(member.phone, message)} target="_blank" rel="noopener noreferrer" className={className}>
      <MessageCircle className="h-4 w-4" />
      {label}
    </a>
  );
}

/** Mobile number input with the WhatsApp hint; reports the normalized number. */
function PhoneField({ value, onChange }: { value: string; onChange: (raw: string) => void }) {
  return (
    <Field label="Mobile number (optional)" hint="To send the invite on WhatsApp. Include the country code if not Indian.">
      <input
        type="tel"
        inputMode="tel"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="98765 43210"
        className={inputClass}
      />
    </Field>
  );
}

function InviteModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { business } = usePos();
  const { team } = useTeam();
  const country = defaultCountryFor(business?.currency);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phoneRaw, setPhoneRaw] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<Role>("cashier");
  const [permissions, setPermissions] = useState<MemberPermissions>(DEFAULT_CASHIER_PERMISSIONS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [link, setLink] = useState("");

  const close = () => {
    if (busy) return;
    setEmail("");
    setName("");
    setPhoneRaw("");
    setPhone("");
    setRole("cashier");
    setPermissions(DEFAULT_CASHIER_PERMISSIONS);
    setError("");
    setLink("");
    onClose();
  };

  const submit = async () => {
    const normalized = phoneRaw.trim() ? normalizePhone(phoneRaw, country) : "";
    if (normalized === null) {
      setError(
        country
          ? "Enter a 10-digit mobile number, or include the country code (e.g. +971 50 123 4567)."
          : "Enter the mobile number with its country code, e.g. +44 7700 900123.",
      );
      return;
    }
    setBusy(true);
    setError("");
    try {
      setPhone(normalized);
      setLink(await inviteMember({ email, name, phone: normalized, role, permissions }));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={close} title="Invite to your team">
      {link ? (
        <div className="space-y-3 text-sm">
          <p className="flex items-center gap-2 font-semibold text-emerald-700">
            <CheckCircle2 className="h-4 w-4" /> Invited. Google has emailed them the link.
          </p>
          {phone && (
            <a
              href={whatsappUrl(phone, inviteMessage({ name, shopName: team?.shopName ?? "our shop", email, link }))}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1ebe5b]"
            >
              <MessageCircle className="h-4 w-4" />
              Send invite on WhatsApp to {formatPhone(phone)}
            </a>
          )}
          <p className="text-muted">
            They open it once, sign in with <strong className="text-ink">{email}</strong> and select the shop files
            Google shows. After that they just <strong className="text-ink">sign in with Google</strong> on any device.
            You can also send the link yourself:
          </p>
          <input readOnly value={link} onFocus={(e) => e.target.select()} className={inputClass} />
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => void navigator.clipboard.writeText(link).catch(() => undefined)}
              className={secondaryBtnClass}
            >
              <Copy className="h-4 w-4" /> Copy link
            </button>
            <button type="button" onClick={close} className={primaryBtnClass}>
              Done
            </button>
          </div>
        </div>
      ) : (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <Field label="Google account email" required>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="staff@gmail.com"
              className={inputClass}
            />
          </Field>
          <Field label="Name (optional)">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ramesh" className={inputClass} />
          </Field>
          <PhoneField value={phoneRaw} onChange={setPhoneRaw} />
          <Field label="Role" required>
            <select value={role} onChange={(e) => setRole(e.target.value as Role)} className={inputClass}>
              <option value="cashier">Cashier — billing and adding customers only</option>
              <option value="owner">Owner — full access (e.g. a partner)</option>
            </select>
          </Field>
          {role === "cashier" && <PermissionFields value={permissions} onChange={setPermissions} />}
          {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={close} disabled={busy} className={secondaryBtnClass}>
              Cancel
            </button>
            <button type="submit" disabled={busy} className={primaryBtnClass}>
              {busy ? "Inviting…" : "Send invite"}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function EditMemberModal({ member, onClose }: { member: TeamMember | null; onClose: () => void }) {
  const { business } = usePos();
  const country = defaultCountryFor(business?.currency);
  const [name, setName] = useState<string | null>(null);
  const [phoneRaw, setPhoneRaw] = useState<string | null>(null);
  const [limits, setLimits] = useState<MemberPermissions | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const currentName = name ?? member?.name ?? "";
  const currentPhone = phoneRaw ?? (member?.phone ? formatPhone(member.phone) : "");
  const currentLimits = limits ?? (member ? permissionsOf(member) : DEFAULT_CASHIER_PERMISSIONS);

  const close = () => {
    setName(null);
    setPhoneRaw(null);
    setLimits(null);
    setError("");
    onClose();
  };

  const save = async () => {
    if (!member) return;
    const phone = currentPhone.trim() ? normalizePhone(currentPhone, country) : "";
    if (phone === null) {
      setError("That mobile number doesn't look right. Include the country code if it isn't Indian.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await updateMember(member.code, {
        name: currentName.trim(),
        phone,
        ...(member.role === "cashier" ? { permissions: currentLimits } : {}),
      });
      close();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={member !== null} onClose={close} title={`Edit ${member?.name || member?.email}`}>
      <div className="space-y-3">
        <p className="text-xs text-muted">{member?.email} · {member ? ROLE_LABELS[member.role] : ""}</p>
        <Field label="Name">
          <input value={currentName} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </Field>
        <PhoneField value={currentPhone} onChange={setPhoneRaw} />
        {member?.role === "cashier" && (
          <>
            <PermissionFields value={currentLimits} onChange={setLimits} />
            <p className="text-xs text-muted">Limits apply on their device after their next sync (about a minute).</p>
          </>
        )}
        {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={close} className={secondaryBtnClass}>
            Cancel
          </button>
          <button type="button" disabled={busy} className={primaryBtnClass} onClick={() => void save()}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Invited member's device
// ---------------------------------------------------------------------------

function MemberTeam({ team }: { team: TeamState }) {
  const [leaving, setLeaving] = useState(false);
  const [promoting, setPromoting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const limits = team.permissions;
  const isShopOwnerAccount =
    team.role === "owner" && team.email.trim().toLowerCase() === team.primaryEmail.trim().toLowerCase();

  const promote = async () => {
    setPromoting(false);
    setBusy(true);
    setError("");
    try {
      await makeMainDevice();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 text-sm">
      <SyncStatus />
      <p className="text-ink">
        You&apos;re in <strong>{team.shopName}</strong> as <strong>{ROLE_LABELS[team.role]}</strong> ({team.email}).
        Bills made on this device are numbered with <strong>{team.memberCode}</strong>.
      </p>
      <p className="text-muted">
        The shop&apos;s main device last synced <strong className="text-ink">{timeAgo(team.hubSeenAt)}</strong>.
        Changes from other devices reach you after it syncs.
      </p>
      {isShopOwnerAccount && (
        <div className="rounded-lg border border-muted-line/40 bg-cream-paper px-3 py-2">
          <p className="text-ink">
            <strong>Main device</strong> merges everyone&apos;s sales and is where you manage the team. Switching to a
            new or replacement computer? Make this device the main device.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => setPromoting(true)}
            className={`${primaryBtnClass} mt-2 px-3 py-1.5`}
          >
            <ShieldCheck className="h-4 w-4" />
            {busy ? "Switching…" : "Make this the main device"}
          </button>
        </div>
      )}
      {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700">{error}</p>}
      {team.role === "cashier" && (
        <p className="text-muted">
          You can give up to <strong className="text-ink">{limits.maxDiscountPercent}%</strong> discount, and credit
          (udhaar) sales are <strong className="text-ink">{limits.allowCredit ? "allowed" : "turned off"}</strong> for
          you. The owner sets these.
        </p>
      )}
      <button type="button" onClick={() => setLeaving(true)} className={`${secondaryBtnClass} px-3 py-1.5`}>
        <LogOut className="h-4 w-4" />
        Leave team on this device
      </button>
      <ConfirmDialog
        open={promoting}
        title="Make this the main device?"
        message="This device will merge everyone's sales and manage the team. The current main device steps down on its next sync and keeps working as one of your devices. Keep this device open during working hours."
        confirmLabel="Make main device"
        danger={false}
        onConfirm={() => void promote()}
        onCancel={() => setPromoting(false)}
      />
      <ConfirmDialog
        open={leaving}
        title="Leave this team?"
        message="This device stops syncing. Sales not yet uploaded will not reach the owner — sync first if you are online. The data already on this device stays here. You can sign in again later to rejoin."
        confirmLabel="Leave team"
        onConfirm={() => {
          setLeaving(false);
          void leaveTeam();
        }}
        onCancel={() => setLeaving(false)}
      />
    </div>
  );
}

"use client";

// Settings → Team: turn Google Drive team sync on, invite up to four more
// people as Front desk, Technician or Owner, and manage them. Same flow as the
// Browser Based POS, with the repair shop's roles.

import { useState } from "react";
import {
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
  MAX_TEAM_SIZE,
  currentRecoveryKey,
  enableTeam,
  inviteMember,
  leaveTeam,
  makeMainDevice,
  memberInviteLink,
  removeMember,
  updateMember,
  type TeamState,
} from "@/lib/repair/team/engine";
import type { TeamMember } from "@/lib/repair/team/files";
import { DEFAULT_FRONTDESK_PERMISSIONS, type MemberPermissions, type Role } from "@/lib/repair/team/ops";
import { ROLE_HELP, ROLE_LABELS, permissionsOf } from "@/lib/repair/team/roles";
import { useRepair } from "@/lib/repair/store";
import { defaultCountryFor, formatPhone, normalizePhone, whatsappUrl } from "@/lib/pos/drive/whatsapp";
import { recordTeamConsent } from "@/lib/pos/drive/consent";
import { TeamConsent } from "@/components/tools/FreePos/team/TeamConsent";
import { ConfirmDialog, Field, Modal, dangerBtnClass, inputClass, primaryBtnClass, secondaryBtnClass } from "../ui";
import { timeAgo, useRepairTeam } from "./TeamSyncContext";
import { OpenShopButton } from "./OpenShop";

const REJECT_LABELS: Record<string, string> = {
  "unknown-member": "from someone not in the team",
  "member-removed": "sent after the member was removed",
  "not-allowed-for-role": "not allowed for their role",
  "not-assigned": "on a job not assigned to them",
  "fields-not-allowed": "partly not allowed for their role",
  "discount-over-limit": "discount above their limit",
  "unknown-record": "for something that no longer exists",
};

function errorText(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Try again.";
}

function repairInviteMessage(input: { name?: string; shopName: string; email: string; link: string; role: Role }): string {
  const hello = input.name?.trim() ? `Hi ${input.name.trim()},` : "Hi,";
  return [
    `${hello} you're invited to ${input.shopName} on Setu's Free Repair Job Card as ${ROLE_LABELS[input.role]}.`,
    ``,
    `1. Open this link once and sign in with Google as ${input.email}:`,
    input.link,
    `2. Select the shop files Google shows you.`,
    ``,
    `After that, just open the Repair Job Card and tap "Sign in with Google" on any phone or computer.`,
  ].join("\n");
}

/** Sync status line shared by the owner and member views. */
export function SyncStatus({ compact = false }: { compact?: boolean }) {
  const { team, syncing, sync, reconnect } = useRepairTeam();
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
    text = "Google sign-in expired — your work is saved here and will upload after you reconnect";
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
            <button type="button" disabled={syncing} onClick={() => void sync()} className={`${secondaryBtnClass} px-3 py-1.5`}>
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
  const { available, ready, team } = useRepairTeam();
  if (!available) {
    return <p className="text-sm text-muted">Team sync isn&apos;t set up on this site yet.</p>;
  }
  if (!ready) return null;
  if (!team) return <TurnOnTeam />;
  if (team.isPrimary) return <OwnerTeam team={team} />;
  return <MemberTeam team={team} />;
}

// ---------------------------------------------------------------------------
// Not in a team yet
// ---------------------------------------------------------------------------

function TurnOnTeam() {
  const { business } = useRepair();
  const [confirming, setConfirming] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const turnOn = async () => {
    if (!agreed) return;
    recordTeamConsent();
    setBusy(true);
    setError("");
    try {
      await enableTeam(business?.name || "My repair shop");
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
        <li>
          • Use the job card on more devices and invite up to {MAX_TEAM_SIZE - 1} more people by email — free, no Setu
          account.
        </li>
        <li>
          • <strong className="text-ink">Front desk</strong>: intake, delivery, billing.{" "}
          <strong className="text-ink">Technician</strong>: only their own jobs — status, diagnosis, parts used; no
          prices or bills.
        </li>
        <li>
          • Your data is kept <strong className="text-ink">encrypted in your own Google Drive</strong>. Setu never
          receives it or its keys.
        </li>
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
            You&apos;ll sign in with Google. A folder <strong>Setu Repair – {business?.name}</strong> is created in your
            Drive to keep the shop&apos;s data.
          </p>
          <ul className="space-y-1 text-muted">
            <li>
              • This device becomes the shop&apos;s <strong className="text-ink">main device</strong>. Keep it open during
              working hours — staff see each other&apos;s changes after it syncs (every minute).
            </li>
            <li>
              • Intake photos stay full size on the device that took them; other devices get smaller copies.
            </li>
            <li>
              • The shop&apos;s files are encrypted with keys only your team has. Save the recovery key from Settings
              afterwards — it&apos;s the only way back in if every device is lost.
            </li>
            <li>• Restoring a backup is turned off while sync is on.</li>
          </ul>
          <TeamConsent checked={agreed} onChange={setAgreed} />
          {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700">{error}</p>}
          <div className="flex justify-end gap-3 pt-1">
            <button type="button" disabled={busy} onClick={() => setConfirming(false)} className={secondaryBtnClass}>
              Cancel
            </button>
            <button type="button" disabled={busy || !agreed} onClick={() => void turnOn()} className={primaryBtnClass}>
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

function memberLine(member: TeamMember, technicianName: (id: string | null | undefined) => string): string {
  const parts = [ROLE_LABELS[member.role]];
  if (member.role === "technician") parts.push(`works as ${technicianName(member.technicianId)}`);
  if (member.role === "frontdesk") parts.push(`discount up to ${permissionsOf(member).maxDiscountPercent}%`);
  parts.push(`code ${member.code}`);
  return parts.join(" · ");
}

function OwnerTeam({ team }: { team: TeamState }) {
  const { technicians } = useRepair();
  const [inviting, setInviting] = useState(false);
  const [editing, setEditing] = useState<TeamMember | null>(null);
  const [removing, setRemoving] = useState<TeamMember | null>(null);
  const [turningOff, setTurningOff] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");

  const active = team.members.filter((m) => !m.removedAt);
  const technicianName = (id: string | null | undefined) => technicians.find((t) => t.id === id)?.name ?? "—";

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

      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-bold text-ink">
            Team ({active.length} of {MAX_TEAM_SIZE})
          </h4>
          <button
            type="button"
            onClick={() => setInviting(true)}
            disabled={active.length >= MAX_TEAM_SIZE}
            title={active.length >= MAX_TEAM_SIZE ? `Up to ${MAX_TEAM_SIZE} people, you included` : undefined}
            className={`${primaryBtnClass} px-3 py-1.5`}
          >
            <UserPlus className="h-4 w-4" />
            Invite by email
          </button>
        </div>
        {active.length >= MAX_TEAM_SIZE && (
          <p className="mt-1 text-xs text-muted">
            Your team is full — up to {MAX_TEAM_SIZE} people, you included. Remove someone to invite another person.
          </p>
        )}
        <ul className="mt-2 divide-y divide-muted-line/20 rounded-lg border border-muted-line/30">
          {active.map((m) => {
            const isMe = m.code === team.memberCode;
            const link = !isMe && m.phone ? memberInviteLink(m.code) : null;
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
                    {memberLine(m, technicianName)}
                  </p>
                </div>
                {!isMe && (
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => void copy(m.code)} className={`${secondaryBtnClass} px-3 py-1.5`}>
                      {copied === m.code ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      {copied === m.code ? "Copied" : "Invite link"}
                    </button>
                    {link && m.phone && (
                      <a
                        href={whatsappUrl(
                          m.phone,
                          repairInviteMessage({ name: m.name, shopName: team.shopName, email: m.email, link, role: m.role })
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`${secondaryBtnClass} px-3 py-1.5`}
                      >
                        <MessageCircle className="h-4 w-4" />
                        WhatsApp
                      </a>
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

      <RecoveryKeyBox />

      <button type="button" onClick={() => setTurningOff(true)} className={`${secondaryBtnClass} px-3 py-1.5`}>
        <LogOut className="h-4 w-4" />
        Turn off team sync on this device
      </button>

      <InviteModal open={inviting} onClose={() => setInviting(false)} />
      <EditMemberModal member={editing} onClose={() => setEditing(null)} />

      <ConfirmDialog
        open={removing !== null}
        title={`Remove ${removing?.name || removing?.email}?`}
        message="Their work sent so far is kept. They lose access to the shop's files and can't sync any more; their device deletes its copy of the shop the next time it opens."
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
          void leaveTeam({ wipe: false });
        }}
        onCancel={() => setTurningOff(false)}
      />
    </div>
  );
}

function RecoveryKeyBox() {
  const [shown, setShown] = useState(false);
  const [copied, setCopied] = useState(false);
  const key = currentRecoveryKey();
  if (!key) return null;
  return (
    <div className="rounded-lg border border-muted-line/40 bg-cream-paper px-3 py-2 text-sm">
      <p className="flex items-center gap-2 font-semibold text-ink">
        <ShieldCheck className="h-4 w-4 text-indigo" />
        Encrypted · Recovery key
      </p>
      <p className="mt-1 text-xs text-muted">
        Your shop&apos;s files in Google Drive are encrypted; only your team&apos;s devices have the key. Save this
        recovery key somewhere safe. It&apos;s the only way to open the shop if every device is lost. Anyone with it
        can read your shop&apos;s data — never share it.
      </p>
      {shown ? (
        <>
          <textarea
            readOnly
            value={key}
            rows={3}
            onFocus={(e) => e.target.select()}
            className="mt-2 w-full rounded-lg border border-muted-line/40 bg-white px-3 py-2 font-mono text-xs text-ink"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard
                  .writeText(key)
                  .then(() => {
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 2000);
                  })
                  .catch(() => undefined);
              }}
              className={`${secondaryBtnClass} px-3 py-1.5`}
            >
              {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied" : "Copy"}
            </button>
            <a
              href={`data:text/plain;charset=utf-8,${encodeURIComponent(
                `Setu Repair Job Card recovery key\n\n${key}\n\nKeep this private. Anyone with it can read your shop's data.\n`
              )}`}
              download="setu-repair-recovery-key.txt"
              className={`${secondaryBtnClass} px-3 py-1.5`}
            >
              Download
            </a>
            <button type="button" onClick={() => setShown(false)} className={`${secondaryBtnClass} px-3 py-1.5`}>
              Hide
            </button>
          </div>
        </>
      ) : (
        <button type="button" onClick={() => setShown(true)} className={`${secondaryBtnClass} mt-2 px-3 py-1.5`}>
          Show recovery key
        </button>
      )}
    </div>
  );
}

function DiscountField({ value, onChange }: { value: MemberPermissions; onChange: (next: MemberPermissions) => void }) {
  return (
    <Field label="Max discount on a bill (%)" hint="0 = no discounts. Bills above this are blocked on their device.">
      <input
        type="number"
        min={0}
        max={100}
        step="0.5"
        value={value.maxDiscountPercent}
        onChange={(e) => onChange({ maxDiscountPercent: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })}
        className={inputClass}
      />
    </Field>
  );
}

function TechnicianPicker({ value, onChange, takenBy }: { value: string; onChange: (id: string) => void; takenBy: Set<string> }) {
  const { technicians } = useRepair();
  const options = technicians.filter((t) => t.active);
  return (
    <Field label="Which technician is this?" hint="They see only the jobs assigned to this name.">
      <select value={value} onChange={(e) => onChange(e.target.value)} className={inputClass}>
        <option value="">Pick a technician…</option>
        {options.map((tech) => (
          <option key={tech.id} value={tech.id} disabled={takenBy.has(tech.id)}>
            {tech.name}
            {takenBy.has(tech.id) ? " (already in the team)" : ""}
          </option>
        ))}
      </select>
      {options.length === 0 && (
        <span className="mt-1 block text-xs text-red-700">Add the technician in Settings → Technicians first.</span>
      )}
    </Field>
  );
}

function InviteModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { business } = useRepair();
  const { team } = useRepairTeam();
  const country = defaultCountryFor(business?.currency);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phoneRaw, setPhoneRaw] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<Role>("frontdesk");
  const [technicianId, setTechnicianId] = useState("");
  const [permissions, setPermissions] = useState<MemberPermissions>(DEFAULT_FRONTDESK_PERMISSIONS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [link, setLink] = useState("");

  const takenBy = new Set(
    (team?.members ?? []).filter((m) => !m.removedAt && m.role === "technician" && m.technicianId).map((m) => m.technicianId!)
  );

  const close = () => {
    if (busy) return;
    setEmail("");
    setName("");
    setPhoneRaw("");
    setPhone("");
    setRole("frontdesk");
    setTechnicianId("");
    setPermissions(DEFAULT_FRONTDESK_PERMISSIONS);
    setError("");
    setLink("");
    onClose();
  };

  const submit = async () => {
    const normalized = phoneRaw.trim() ? normalizePhone(phoneRaw, country) : "";
    if (normalized === null) {
      setError("Enter a 10-digit mobile number, or include the country code.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      setPhone(normalized);
      setLink(
        await inviteMember({
          email,
          name,
          phone: normalized,
          role,
          permissions,
          technicianId: role === "technician" ? technicianId || null : null,
        })
      );
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
              href={whatsappUrl(phone, repairInviteMessage({ name, shopName: team?.shopName ?? "our shop", email, link, role }))}
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
          <Field label="Mobile number (optional)" hint="To send the invite on WhatsApp.">
            <input
              type="tel"
              inputMode="tel"
              autoComplete="off"
              value={phoneRaw}
              onChange={(e) => setPhoneRaw(e.target.value)}
              placeholder="98765 43210"
              className={inputClass}
            />
          </Field>
          <Field label="Role" required>
            <select value={role} onChange={(e) => setRole(e.target.value as Role)} className={inputClass}>
              <option value="frontdesk">Front desk — intake, delivery, billing</option>
              <option value="technician">Technician — only their own jobs</option>
              <option value="owner">Owner — full access (e.g. a partner)</option>
            </select>
            <span className="mt-1 block text-xs text-muted">{ROLE_HELP[role]}</span>
          </Field>
          {role === "frontdesk" && <DiscountField value={permissions} onChange={setPermissions} />}
          {role === "technician" && <TechnicianPicker value={technicianId} onChange={setTechnicianId} takenBy={takenBy} />}
          {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={close} disabled={busy} className={secondaryBtnClass}>
              Cancel
            </button>
            <button type="submit" disabled={busy || (role === "technician" && !technicianId)} className={primaryBtnClass}>
              {busy ? "Inviting…" : "Send invite"}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function EditMemberModal({ member, onClose }: { member: TeamMember | null; onClose: () => void }) {
  const { business } = useRepair();
  const { team } = useRepairTeam();
  const country = defaultCountryFor(business?.currency);
  const [name, setName] = useState<string | null>(null);
  const [phoneRaw, setPhoneRaw] = useState<string | null>(null);
  const [limits, setLimits] = useState<MemberPermissions | null>(null);
  const [technicianId, setTechnicianId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const currentName = name ?? member?.name ?? "";
  const currentPhone = phoneRaw ?? (member?.phone ? formatPhone(member.phone) : "");
  const currentLimits = limits ?? (member ? permissionsOf(member) : DEFAULT_FRONTDESK_PERMISSIONS);
  const currentTech = technicianId ?? member?.technicianId ?? "";
  const takenBy = new Set(
    (team?.members ?? [])
      .filter((m) => !m.removedAt && m.role === "technician" && m.technicianId && m.code !== member?.code)
      .map((m) => m.technicianId!)
  );

  const close = () => {
    setName(null);
    setPhoneRaw(null);
    setLimits(null);
    setTechnicianId(null);
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
        ...(member.role === "frontdesk" ? { permissions: currentLimits } : {}),
        ...(member.role === "technician" ? { technicianId: currentTech || null } : {}),
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
        <p className="text-xs text-muted">
          {member?.email} · {member ? ROLE_LABELS[member.role] : ""}
        </p>
        <Field label="Name">
          <input value={currentName} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Mobile number (optional)">
          <input type="tel" value={currentPhone} onChange={(e) => setPhoneRaw(e.target.value)} className={inputClass} />
        </Field>
        {member?.role === "frontdesk" && <DiscountField value={currentLimits} onChange={setLimits} />}
        {member?.role === "technician" && (
          <TechnicianPicker value={currentTech} onChange={setTechnicianId} takenBy={takenBy} />
        )}
        <p className="text-xs text-muted">Changes reach their device after its next sync (about a minute).</p>
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

export function MemberTeam({ team }: { team: TeamState }) {
  const { reload, technicians } = useRepair();
  const [leaving, setLeaving] = useState(false);
  const [promoting, setPromoting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const isShopOwnerAccount =
    team.role === "owner" && team.email.trim().toLowerCase() === team.primaryEmail.trim().toLowerCase();
  const techName = technicians.find((t) => t.id === team.technicianId)?.name;

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
        You&apos;re in <strong>{team.shopName}</strong> as <strong>{ROLE_LABELS[team.role]}</strong> ({team.email})
        {team.role === "technician" && techName ? `, working as ${techName}` : ""}.
      </p>
      <p className="text-muted">
        The shop&apos;s main device last synced <strong className="text-ink">{timeAgo(team.hubSeenAt)}</strong>. Changes
        from other devices reach you after it syncs.
      </p>
      {team.role === "frontdesk" && (
        <p className="text-muted">
          You can give up to <strong className="text-ink">{team.permissions.maxDiscountPercent}%</strong> discount on a
          bill. The owner sets this.
        </p>
      )}
      {isShopOwnerAccount && (
        <div className="rounded-lg border border-muted-line/40 bg-cream-paper px-3 py-2">
          <p className="text-ink">
            <strong>Main device</strong> merges everyone&apos;s changes and is where you manage the team. Switching to a
            new computer? Make this device the main device.
          </p>
          <button type="button" disabled={busy} onClick={() => setPromoting(true)} className={`${primaryBtnClass} mt-2 px-3 py-1.5`}>
            <ShieldCheck className="h-4 w-4" />
            {busy ? "Switching…" : "Make this the main device"}
          </button>
        </div>
      )}
      {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700">{error}</p>}
      <button type="button" onClick={() => setLeaving(true)} className={`${secondaryBtnClass} px-3 py-1.5`}>
        <LogOut className="h-4 w-4" />
        Leave team on this device
      </button>
      <ConfirmDialog
        open={promoting}
        title="Make this the main device?"
        message="This device will merge everyone's changes and manage the team. The current main device steps down on its next sync and keeps working as one of your devices."
        confirmLabel="Make main device"
        danger={false}
        onConfirm={() => void promote()}
        onCancel={() => setPromoting(false)}
      />
      <ConfirmDialog
        open={leaving}
        title="Leave this team?"
        message="Changes not yet sent are uploaded first if you're online. Then everything from this shop is deleted from this device and it's signed out of Google. You can sign in again later to rejoin."
        confirmLabel="Leave & delete from this device"
        onConfirm={() => {
          setLeaving(false);
          setBusy(true);
          void (async () => {
            try {
              await leaveTeam({ wipe: true, flush: true, signOut: true });
              await reload();
            } catch (e) {
              setError(errorText(e));
              setBusy(false);
            }
          })();
        }}
        onCancel={() => setLeaving(false)}
      />
    </div>
  );
}

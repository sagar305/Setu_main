"use client";

// "Sign in with Google" on any device: finds the repair shops this Google
// account belongs to (from the note in its own Drive) and opens one with the
// role the owner gave it. Nothing is stored at Setu.

import { useState } from "react";
import { AlertTriangle, Cloud, LogIn, Wrench } from "lucide-react";
import { findMyShops, openShop, type FoundShop } from "@/lib/repair/team/engine";
import { signOut } from "@/lib/pos/drive/auth";
import { recordTeamConsent } from "@/lib/pos/drive/consent";
import { parseRecoveryKey } from "@/lib/pos/drive/crypto";
import { pickInvitedFiles } from "@/lib/pos/drive/picker";
import { ROLE_LABELS } from "@/lib/repair/team/roles";
import { useRepair } from "@/lib/repair/store";
import { TeamConsent } from "@/components/tools/FreePos/team/TeamConsent";
import { Modal, primaryBtnClass, secondaryBtnClass } from "../ui";
import { timeAgo, useRepairTeam } from "./TeamSyncContext";

export function OpenShopButton({
  className = secondaryBtnClass,
  label = "Sign in with Google",
  hint,
}: {
  className?: string;
  label?: string;
  hint?: string;
}) {
  const { available, team } = useRepairTeam();
  const [open, setOpen] = useState(false);
  if (!available || team) return null;
  return (
    <>
      {hint && <p className="mb-2 text-sm text-muted">{hint}</p>}
      <button type="button" onClick={() => setOpen(true)} className={className}>
        <LogIn className="h-4 w-4" />
        {label}
      </button>
      <OpenShopModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function OpenShopModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { business, jobs, reload } = useRepair();
  const [busy, setBusy] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [recoveryText, setRecoveryText] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ email: string; shops: FoundShop[] } | null>(null);
  const [chosen, setChosen] = useState<FoundShop | null>(null);

  const close = () => {
    if (busy) return;
    setError("");
    setResult(null);
    setChosen(null);
    setAgreed(false);
    onClose();
  };

  const signIn = async () => {
    if (!agreed) return;
    recordTeamConsent();
    setBusy(true);
    setError("");
    try {
      const found = await findMyShops();
      setResult(found);
      const usable = found.shops.filter((s) => (s.role && !s.unreachable) || s.needsKey);
      if (usable.length === 1) setChosen(usable[0]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Google sign-in failed.");
    } finally {
      setBusy(false);
    }
  };

  const openChosen = async () => {
    if (!chosen) return;
    setBusy(true);
    setError("");
    try {
      let recovery;
      if (chosen.needsKey) {
        recovery = parseRecoveryKey(recoveryText);
        if (!recovery) throw new Error("That doesn't look like a recovery key.");
      }
      await openShop(chosen, pickInvitedFiles, recovery ?? undefined);
      await reload();
      setBusy(false);
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't open the shop.");
      setBusy(false);
    }
  };

  const hasData = Boolean(business) && jobs.length > 0;

  return (
    <Modal open={open} onClose={close} title="Open your repair shop">
      <div className="space-y-4 text-sm">
        {!result ? (
          <>
            <p className="text-muted">
              Sign in with the Google account you use for the shop — as the owner, or the email the owner invited.
              The shop opens with the access the owner gave you.
            </p>
            <TeamConsent checked={agreed} onChange={setAgreed} />
            <button type="button" disabled={busy || !agreed} onClick={() => void signIn()} className={primaryBtnClass}>
              <Cloud className="h-4 w-4" />
              {busy ? "Signing in…" : "Sign in with Google"}
            </button>
          </>
        ) : result.shops.length === 0 ? (
          <div className="space-y-2">
            <p className="font-semibold text-ink">No repair shop found for {result.email}</p>
            <p className="text-muted">
              If you were invited, open the invite link from the owner once on any device — after that, signing in is
              enough. If you&apos;re the owner, turn on team sync in Settings first.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-muted">Signed in as {result.email}. Choose a shop:</p>
            <ul className="space-y-2">
              {result.shops.map((shop) => {
                const usable = (Boolean(shop.role) && !shop.unreachable) || shop.needsKey;
                const selected = chosen?.pointer.files.live === shop.pointer.files.live;
                return (
                  <li key={shop.pointer.files.live}>
                    <button
                      type="button"
                      disabled={!usable}
                      onClick={() => setChosen(shop)}
                      className={`flex w-full items-start gap-3 rounded-lg border px-3 py-2 text-left transition ${
                        selected ? "border-indigo bg-indigo/5" : "border-muted-line/40 bg-white"
                      } disabled:cursor-not-allowed disabled:opacity-60`}
                    >
                      <Wrench className="mt-0.5 h-4 w-4 shrink-0 text-indigo" />
                      <span className="min-w-0">
                        <span className="block font-semibold text-ink">{shop.shopName}</span>
                        <span className="block text-xs text-muted">
                          {shop.unreachable
                            ? "Can't be opened — the owner may have deleted it or removed you"
                            : shop.needsKey
                              ? "This account's copy of the shop key is missing — enter the owner's recovery key"
                              : shop.removed
                                ? "You're no longer in this shop's team"
                                : `${ROLE_LABELS[shop.role!]}${shop.isPrimaryAccount ? " (shop owner)" : ""} · main device synced ${timeAgo(shop.hubSeenAt)}`}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {chosen?.needsKey && (
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Recovery key</span>
            <textarea
              value={recoveryText}
              onChange={(e) => setRecoveryText(e.target.value)}
              rows={3}
              spellCheck={false}
              className="w-full rounded-lg border border-muted-line/40 bg-white px-3 py-2 font-mono text-xs text-ink focus:border-indigo focus:outline-none"
            />
          </label>
        )}

        {chosen && hasData && (
          <div className="rounded-lg border border-saffron/50 bg-saffron/10 px-3 py-2 text-ink">
            <p className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="h-4 w-4 text-saffron" />
              This device already has a repair shop ({business?.name}, {jobs.length} jobs)
            </p>
            <p className="mt-1 text-muted">
              Opening {chosen.shopName} replaces it. Export a backup from Settings first if you need it.
            </p>
          </div>
        )}

        {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700">{error}</p>}

        {result && (
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              await signOut();
              setResult(null);
              setChosen(null);
              setError("");
            }}
            className="text-xs font-semibold text-indigo underline"
          >
            Not {result.email}? Use a different Google account
          </button>
        )}

        {result && (
          <div className="flex justify-end gap-3">
            <button type="button" disabled={busy} onClick={close} className={secondaryBtnClass}>
              Cancel
            </button>
            {chosen && (
              <button type="button" disabled={busy} onClick={() => void openChosen()} className={primaryBtnClass}>
                {busy ? "Opening…" : hasData ? `Replace & open ${chosen.shopName}` : `Open ${chosen.shopName}`}
              </button>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

"use client";

import { useState } from "react";
import { AlertTriangle, Cloud, LogIn, Store } from "lucide-react";
import { findMyShops, openShop, type FoundShop } from "@/lib/pos/drive/engine";
import { pickInvitedFiles } from "@/lib/pos/drive/picker";
import { ROLE_LABELS } from "@/lib/pos/drive/roles";
import { usePos } from "@/lib/pos/store";
import { Modal, primaryBtnClass, secondaryBtnClass } from "../ui";
import { timeAgo, useTeam } from "./TeamSyncContext";

/**
 * "Sign in with Google" on any device: finds the shops this Google account
 * belongs to (from the note in its own Drive) and opens one with the role the
 * owner gave it. Nothing is stored at Setu.
 */
export function OpenShopButton({
  className = secondaryBtnClass,
  label = "Sign in with Google",
  hint,
}: {
  className?: string;
  label?: string;
  /** Short line shown above the button. */
  hint?: string;
}) {
  const { available, team } = useTeam();
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
  const { business, orders, reload } = usePos();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ email: string; shops: FoundShop[] } | null>(null);
  const [chosen, setChosen] = useState<FoundShop | null>(null);

  const close = () => {
    if (busy) return;
    setError("");
    setResult(null);
    setChosen(null);
    onClose();
  };

  const signIn = async () => {
    setBusy(true);
    setError("");
    try {
      const found = await findMyShops();
      setResult(found);
      const usable = found.shops.filter((s) => s.role && !s.unreachable);
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
      await openShop(chosen, pickInvitedFiles);
      await reload();
      setBusy(false);
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't open the shop.");
      setBusy(false);
    }
  };

  const hasData = Boolean(business);

  return (
    <Modal open={open} onClose={close} title="Open your shop">
      <div className="space-y-4 text-sm">
        {!result ? (
          <>
            <p className="text-muted">
              Sign in with the Google account you use for your shop — as the owner, or the email the owner invited.
              Your shop opens with the access the owner gave you.
            </p>
            <button type="button" disabled={busy} onClick={() => void signIn()} className={primaryBtnClass}>
              <Cloud className="h-4 w-4" />
              {busy ? "Signing in…" : "Sign in with Google"}
            </button>
          </>
        ) : result.shops.length === 0 ? (
          <div className="space-y-2">
            <p className="font-semibold text-ink">No shop found for {result.email}</p>
            <p className="text-muted">
              If you were invited, open the invite link from the owner&apos;s email once on any device — after that,
              signing in is enough. If you&apos;re an owner, turn on team sync in Settings first.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-muted">Signed in as {result.email}. Choose a shop:</p>
            <ul className="space-y-2">
              {result.shops.map((shop) => {
                const usable = Boolean(shop.role) && !shop.unreachable;
                const selected = chosen?.pointer.shopFileId === shop.pointer.shopFileId;
                return (
                  <li key={shop.pointer.shopFileId}>
                    <button
                      type="button"
                      disabled={!usable}
                      onClick={() => setChosen(shop)}
                      className={`flex w-full items-start gap-3 rounded-lg border px-3 py-2 text-left transition ${
                        selected ? "border-indigo bg-indigo/5" : "border-muted-line/40 bg-white"
                      } disabled:cursor-not-allowed disabled:opacity-60`}
                    >
                      <Store className="mt-0.5 h-4 w-4 shrink-0 text-indigo" />
                      <span className="min-w-0">
                        <span className="block font-semibold text-ink">{shop.shopName}</span>
                        <span className="block text-xs text-muted">
                          {shop.unreachable
                            ? "Can't be opened — the owner may have deleted it or removed you"
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

        {chosen && hasData && (
          <div className="rounded-lg border border-saffron/50 bg-saffron/10 px-3 py-2 text-ink">
            <p className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="h-4 w-4 text-saffron" />
              This device already has a POS ({business?.name}
              {orders.length ? `, ${orders.length} sales` : ""})
            </p>
            <p className="mt-1 text-muted">
              Opening {chosen.shopName} replaces it. Export a backup from Settings first if you need it.
            </p>
          </div>
        )}

        {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700">{error}</p>}

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

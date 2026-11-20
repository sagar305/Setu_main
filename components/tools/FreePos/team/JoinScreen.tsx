"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Cloud, Users } from "lucide-react";
import { joinTeam, type InvitePayload } from "@/lib/pos/drive/engine";
import { pickInvitedFiles } from "@/lib/pos/drive/picker";
import { signOut } from "@/lib/pos/drive/auth";
import { recordTeamConsent } from "@/lib/pos/drive/consent";
import { TeamConsent } from "./TeamConsent";
import { usePos } from "@/lib/pos/store";
import { primaryBtnClass, secondaryBtnClass } from "../ui";
import { useTeam } from "./TeamSyncContext";

/** Shown when the POS opens with ?join=<invite>. */
export function JoinScreen({ invite, onDone }: { invite: InvitePayload | null; onDone: () => void }) {
  const { business, orders, reload } = usePos();
  const { available, team } = useTeam();
  const [busy, setBusy] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState("");
  const topRef = useRef<HTMLDivElement>(null);
  // The POS sits below the product page's intro; bring the invite into view.
  useEffect(() => {
    topRef.current?.scrollIntoView({ block: "start" });
  }, []);
  const fileCount = invite?.b ? 3 : 2;

  if (!invite || !available) {
    return (
      <div ref={topRef} className="mx-auto max-w-md scroll-mt-24 py-12 text-center">
        <h2 className="text-lg font-bold text-ink">This invite link doesn&apos;t work</h2>
        <p className="mt-2 text-sm text-muted">
          {invite ? "Team sync isn't available on this site right now." : "The link is incomplete. Ask the shop owner to send it again."}
        </p>
        <button type="button" onClick={onDone} className={`${secondaryBtnClass} mt-5`}>
          Open the POS
        </button>
      </div>
    );
  }

  const join = async () => {
    if (!agreed) return;
    recordTeamConsent();
    setBusy(true);
    setError("");
    try {
      await joinTeam(invite, pickInvitedFiles);
      await reload();
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not join. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const hasData = Boolean(business) && !team;

  return (
    <div ref={topRef} className="mx-auto max-w-lg scroll-mt-24 py-8">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo/10 text-indigo">
        <Users className="h-6 w-6" />
      </div>
      <h2 className="mt-4 text-xl font-bold text-ink">Join {invite.n}</h2>
      <p className="mt-2 text-sm text-muted">
        You&apos;ve been invited to bill for <strong className="text-ink">{invite.n}</strong> on this device. The
        shop&apos;s products, prices and customers will sync here through the owner&apos;s Google Drive.
      </p>

      <ol className="mt-5 space-y-2 text-sm text-ink">
        <li>
          <strong>1.</strong> Sign in with Google as <strong>{invite.e}</strong>.
        </li>
        <li>
          <strong>2.</strong> Google shows the shop&apos;s files. Select one and press <strong>Select</strong> — it
          opens again for the next one, {fileCount} files in all. This is what lets the POS open them; it can&apos;t
          see anything else in your Drive.
        </li>
      </ol>

      {hasData && (
        <div className="mt-5 rounded-lg border border-saffron/50 bg-saffron/10 px-3 py-2 text-sm text-ink">
          <p className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4 text-saffron" />
            This device already has a POS ({business?.name}
            {orders.length ? `, ${orders.length} sales` : ""})
          </p>
          <p className="mt-1 text-muted">
            Joining replaces it with {invite.n}&apos;s data. Export a backup from Settings first if you need it.
          </p>
        </div>
      )}
      {team && (
        <p className="mt-5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          This device is already in the team for {team.shopName}. Leave that team in Settings before joining another.
        </p>
      )}
      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <p>{error}</p>
          {error.includes("but you signed in as") && (
            <button
              type="button"
              onClick={async () => {
                await signOut();
                setError("");
              }}
              className="mt-1 text-xs font-semibold underline"
            >
              Sign out and use {invite.e}
            </button>
          )}
        </div>
      )}

      <div className="mt-5">
        <TeamConsent checked={agreed} onChange={setAgreed} />
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={busy || Boolean(team) || !agreed}
          onClick={() => void join()}
          className={primaryBtnClass}
        >
          <Cloud className="h-4 w-4" />
          {busy ? "Joining…" : hasData ? "Replace & join" : "Sign in with Google & join"}
        </button>
        <button type="button" disabled={busy} onClick={onDone} className={secondaryBtnClass}>
          Not now
        </button>
      </div>
    </div>
  );
}

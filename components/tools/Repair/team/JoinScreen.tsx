"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Cloud, Users } from "lucide-react";
import { inviteFileIds, joinTeam, type InvitePayload } from "@/lib/repair/team/engine";
import { pickInvitedFiles } from "@/lib/pos/drive/picker";
import { RETURN_HASH_KEY, signOut } from "@/lib/pos/drive/auth";
import { keysFromFragment, type ShopKeys } from "@/lib/pos/drive/crypto";
import { recordTeamConsent } from "@/lib/pos/drive/consent";
import { ROLE_HELP, ROLE_LABELS } from "@/lib/repair/team/roles";
import { useRepair } from "@/lib/repair/store";
import { TeamConsent } from "@/components/tools/FreePos/team/TeamConsent";
import { primaryBtnClass, secondaryBtnClass } from "../ui";
import { useRepairTeam } from "./TeamSyncContext";

/** Shown when the repair app opens with ?join=<invite>. */
export function JoinScreen({ invite, onDone }: { invite: InvitePayload | null; onDone: () => void }) {
  const { business, jobs, reload } = useRepair();
  const { available, team } = useRepairTeam();
  const [busy, setBusy] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState("");
  const topRef = useRef<HTMLDivElement>(null);
  const [keys, setKeys] = useState<ShopKeys | null>(null);
  const [keysChecked, setKeysChecked] = useState(false);

  useEffect(() => {
    topRef.current?.scrollIntoView({ block: "start" });
    let hash = window.location.hash;
    try {
      hash ||= window.sessionStorage.getItem(RETURN_HASH_KEY) ?? "";
      if (hash) window.sessionStorage.setItem(RETURN_HASH_KEY, hash);
    } catch {
      // ignore
    }
    setKeys(keysFromFragment(hash));
    setKeysChecked(true);
    if (window.location.hash) {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  }, []);

  const needsBooks = Boolean(invite?.b);
  const keysMissing = keysChecked && (!keys || (needsBooks && !keys.books));

  if (!invite || !available) {
    return (
      <div ref={topRef} className="mx-auto max-w-md scroll-mt-24 py-12 text-center">
        <h2 className="text-lg font-bold text-ink">This invite link doesn&apos;t work</h2>
        <p className="mt-2 text-sm text-muted">
          {invite ? "Team sync isn't available on this site right now." : "The link is incomplete. Ask the shop owner to send it again."}
        </p>
        <button type="button" onClick={onDone} className={`${secondaryBtnClass} mt-5`}>
          Open the job card app
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
      if (!keys) throw new Error("This invite link is missing the shop's key.");
      await joinTeam(invite, keys, pickInvitedFiles);
      try {
        window.sessionStorage.removeItem(RETURN_HASH_KEY);
      } catch {
        // ignore
      }
      await reload();
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not join. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const hasData = Boolean(business) && jobs.length > 0 && !team;
  const fileCount = inviteFileIds(invite).length;

  return (
    <div ref={topRef} className="mx-auto max-w-lg scroll-mt-24 py-8">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo/10 text-indigo">
        <Users className="h-6 w-6" />
      </div>
      <h2 className="mt-4 text-xl font-bold text-ink">Join {invite.n}</h2>
      <p className="mt-2 text-sm text-muted">
        You&apos;ve been invited as <strong className="text-ink">{ROLE_LABELS[invite.r]}</strong>: {ROLE_HELP[invite.r]}{" "}
        The shop&apos;s jobs sync here through the owner&apos;s Google Drive, encrypted with a key only your team has.
      </p>

      {keysMissing && (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          This link is missing the shop&apos;s key — the part after “#” got cut off. Ask the owner to send the invite
          again, and open it exactly as it is.
        </p>
      )}

      <ol className="mt-5 space-y-2 text-sm text-ink">
        <li>
          <strong>1.</strong> Sign in with Google as <strong>{invite.e}</strong>.
        </li>
        <li>
          <strong>2.</strong> Google shows the shop&apos;s files. Select one and press <strong>Select</strong> — it opens
          again for the next one, {fileCount} files in all. This is what lets the app open them; it can&apos;t see
          anything else in your Drive.
        </li>
      </ol>

      {hasData && (
        <div className="mt-5 rounded-lg border border-saffron/50 bg-saffron/10 px-3 py-2 text-sm text-ink">
          <p className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4 text-saffron" />
            This device already has a repair shop ({business?.name}, {jobs.length} jobs)
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
          disabled={busy || Boolean(team) || !agreed || keysMissing || !keysChecked}
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

"use client";

import { TEAM_PRIVACY_URL, TEAM_TERMS_URL } from "@/lib/pos/drive/consent";

/**
 * "I agree" checkbox shown before turning on, joining or signing in to Google
 * Drive team sync. The continue button stays disabled until it is ticked.
 * Links open in a new tab so the POS (and a half-done form) stays put.
 */
export function TeamConsent({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex items-start gap-3 rounded-lg border border-muted-line/40 bg-white px-3 py-3 text-left text-sm text-ink">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-indigo"
        aria-describedby="team-consent-note"
      />
      <span>
        I have read and agree to the{" "}
        <a href={TEAM_TERMS_URL} target="_blank" rel="noopener" className="font-semibold text-indigo underline">
          Terms of Use
        </a>{" "}
        and{" "}
        <a href={TEAM_PRIVACY_URL} target="_blank" rel="noopener" className="font-semibold text-indigo underline">
          Privacy Policy
        </a>{" "}
        for Google Drive team sync.
        <span id="team-consent-note" className="mt-1 block text-xs text-muted">
          The shop&apos;s data is kept encrypted in the shop owner&apos;s Google Drive and synced to the team&apos;s
          devices. Setu never receives it or its keys.
        </span>
      </span>
    </label>
  );
}

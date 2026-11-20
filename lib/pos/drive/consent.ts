// Agreement to the Terms of Use and Privacy Policy for Google Drive team sync.
//
// Nobody can turn team sync on, join a shop or sign in to one without ticking
// that they agree. When they do, the version they agreed to and when are kept
// on the device, and copied into its team membership.

/** Bump when the team sync sections of /terms or /privacy change materially. */
export const TEAM_TERMS_VERSION = "2026-11-20";

export const TEAM_TERMS_URL = "/terms#google-drive-team-sync";
export const TEAM_PRIVACY_URL = "/privacy#google-drive-team-sync";

export type TeamConsent = { version: string; at: string };

const KEY = "setu-pos-team-consent";

/** Record that the person on this device agreed (call when they tick and continue). */
export function recordTeamConsent(now = new Date()): TeamConsent {
  const consent = { version: TEAM_TERMS_VERSION, at: now.toISOString() };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(consent));
  } catch {
    // Storage blocked: the agreement still applied to this action.
  }
  return consent;
}

export function readTeamConsent(): TeamConsent | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    const value = raw ? (JSON.parse(raw) as TeamConsent) : null;
    return value?.version && value.at ? value : null;
  } catch {
    return null;
  }
}

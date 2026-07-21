// Shared user preferences (Chapter 3 §Shared Preferences): language, currency,
// timezone. Stored once, read by every tool and calculator — no tool asks
// twice. Defaults are auto-detected from the browser (timezone via Intl,
// language via navigator) with India-focused fallbacks.

export type Preferences = {
  language: string; // BCP-47 code, e.g. "en", "hi"
  currency: string; // ISO 4217 code, e.g. "INR"
  timezone: string; // IANA zone, e.g. "Asia/Kolkata"
};

const KEY = "setu:preferences";
export const PREFS_CHANGED_EVENT = "setu:prefs-changed";

export function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata";
  } catch {
    return "Asia/Kolkata";
  }
}

function detectLanguage(): string {
  if (typeof navigator === "undefined") return "en";
  return (navigator.language || "en").split("-")[0];
}

export function defaultPreferences(): Preferences {
  return { language: detectLanguage(), currency: "INR", timezone: detectTimezone() };
}

export function getPreferences(): Preferences {
  const defaults = defaultPreferences();
  if (typeof window === "undefined") return { language: "en", currency: "INR", timezone: "Asia/Kolkata" };
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? { ...defaults, ...(JSON.parse(raw) as Partial<Preferences>) } : defaults;
  } catch {
    return defaults;
  }
}

export function setPreferences(patch: Partial<Preferences>): void {
  if (typeof window === "undefined") return;
  try {
    const next = { ...getPreferences(), ...patch };
    window.localStorage.setItem(KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(PREFS_CHANGED_EVENT, { detail: next }));
  } catch {
    // Storage unavailable — preferences just don't persist.
  }
}

// The active currency for non-workspace formatters (lib/format). It defaults
// to INR so server render and the first client render agree (hydration), then
// client code sets it to the user's preference after mount via the
// usePreferredCurrency hook / markHydrated. Never mutated on the server.
let activeCurrency = "INR";

export function setActiveCurrency(code: string): void {
  activeCurrency = code;
}

/** Called after mount (LanguageProvider) so preference formatting takes effect. */
export function markHydrated(): void {
  if (typeof window !== "undefined") activeCurrency = getPreferences().currency;
}

/** Currency the calculators should use when no workspace business overrides it. */
export function getPreferredCurrency(): string {
  return activeCurrency;
}

/** Every IANA timezone the browser knows, with the detected one first. */
export function allTimezones(): string[] {
  try {
    const zones = Intl.supportedValuesOf("timeZone");
    const detected = detectTimezone();
    return [detected, ...zones.filter((z) => z !== detected)];
  } catch {
    return ["Asia/Kolkata", "UTC"];
  }
}

export type CurrencyInfo = { code: string; name: string; symbol: string };

/**
 * Every ISO 4217 currency the browser knows, named and symbolled via Intl —
 * no hand-maintained list to go stale. INR pinned first for the home market.
 */
export function allCurrencies(): CurrencyInfo[] {
  try {
    const codes = Intl.supportedValuesOf("currency");
    const names = new Intl.DisplayNames(["en"], { type: "currency" });
    const list = codes.map((code) => ({
      code,
      name: names.of(code) ?? code,
      symbol: currencySymbolIntl(code),
    }));
    const inr = list.filter((c) => c.code === "INR");
    return [...inr, ...list.filter((c) => c.code !== "INR")];
  } catch {
    return [
      { code: "INR", name: "Indian Rupee", symbol: "₹" },
      { code: "USD", name: "US Dollar", symbol: "$" },
      { code: "EUR", name: "Euro", symbol: "€" },
      { code: "GBP", name: "British Pound", symbol: "£" },
      { code: "AED", name: "UAE Dirham", symbol: "د.إ" },
    ];
  }
}

export function currencySymbolIntl(code: string): string {
  try {
    const parts = new Intl.NumberFormat("en", {
      style: "currency",
      currency: code,
      currencyDisplay: "narrowSymbol",
    }).formatToParts(1);
    return parts.find((p) => p.type === "currency")?.value ?? code;
  } catch {
    return code;
  }
}

/**
 * Format money in any ISO currency. Indian-numbering (lakh/crore grouping)
 * for INR, the currency's own convention otherwise.
 */
export function formatMoneyIntl(value: number, currency: string): string {
  const safe = Number.isFinite(value) ? value : 0;
  try {
    return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en", {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
    }).format(safe);
  } catch {
    return `${currency} ${safe.toFixed(2)}`;
  }
}

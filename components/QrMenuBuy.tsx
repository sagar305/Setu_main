"use client";

import { useEffect, useState, type FormEvent } from "react";
import { KeyRound, Loader2, ShoppingCart } from "lucide-react";
import { formatPrice, yearlySavingPercent, type PricingRegionId } from "@/lib/pricing";
import {
  BILLING_DAYS,
  BILLINGS,
  qrMenuAmounts,
  qrMenuRegion,
  regionFor,
  type Billing,
} from "@/lib/qrMenuCheckout";

type CashfreeCheckout = {
  checkout: (options: { paymentSessionId: string; redirectTarget?: "_self" }) => Promise<unknown>;
};

declare global {
  interface Window {
    Cashfree?: (options: { mode: "sandbox" | "production" }) => CashfreeCheckout;
  }
}

const SDK_URL = "https://sdk.cashfree.com/js/v3/cashfree.js";

function loadCashfree(): Promise<NonNullable<Window["Cashfree"]>> {
  if (window.Cashfree) return Promise.resolve(window.Cashfree);
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SDK_URL;
    script.async = true;
    script.onload = () =>
      window.Cashfree ? resolve(window.Cashfree) : reject(new Error("Cashfree did not load"));
    script.onerror = () => reject(new Error("Cashfree did not load"));
    document.head.appendChild(script);
  });
}

function browserTimezone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
  } catch {
    return null;
  }
}

/**
 * Buys QR Menu time. The region is detected rather than chosen, the buyer only
 * picks monthly or yearly, and Cashfree checkout opens in this tab. Afterwards
 * Cashfree returns to /products/qr-menu/payment, which shows the license key.
 */
export function QrMenuBuy() {
  // The price list, and separately where the buyer is: someone abroad pays in
  // rupees while USD charging is off, but still has a foreign phone number.
  const [regionId, setRegionId] = useState<PricingRegionId | null>(null);
  const [buyerRegion, setBuyerRegion] = useState<PricingRegionId>("IN");
  const [billing, setBilling] = useState<Billing>("yearly");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const timezone = browserTimezone();
    let cancelled = false;
    fetch(`/api/qr-menu/region${timezone ? `?tz=${encodeURIComponent(timezone)}` : ""}`)
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data: { region?: PricingRegionId; buyerRegion?: PricingRegionId }) => {
        if (cancelled) return;
        setRegionId(data.region === "INTL" ? "INTL" : "IN");
        setBuyerRegion(data.buyerRegion === "INTL" ? "INTL" : "IN");
      })
      .catch(() => {
        if (cancelled) return;
        // Rupees are the one price list that always works; the server
        // decides the real one at checkout either way.
        setRegionId("IN");
        setBuyerRegion(regionFor(null, timezone));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const response = await fetch("/api/qr-menu/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ billing, email, phone, timezone: browserTimezone() }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not start the payment.");

      const Cashfree = await loadCashfree();
      await Cashfree({ mode: data.mode }).checkout({
        paymentSessionId: data.paymentSessionId,
        redirectTarget: "_self",
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not start the payment.");
      setSubmitting(false);
    }
  }

  if (!regionId) {
    return (
      <div className="flex h-40 items-center justify-center rounded-2xl border border-indigo/15 bg-white">
        <Loader2 className="h-5 w-5 animate-spin text-indigo" aria-label="Loading prices" />
      </div>
    );
  }

  const region = qrMenuRegion(regionId);
  const amounts = qrMenuAmounts(regionId);
  const saving = yearlySavingPercent(amounts);

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-indigo/15 bg-white p-6 shadow-sm sm:p-8"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="flex items-center gap-2 text-xl font-bold text-ink">
          <KeyRound className="h-5 w-5 text-indigo" />
          Buy a license key
        </h3>
        <p className="text-xs text-muted">
          Prices in {region.currency}, incl. GST
        </p>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Pay once and get a key. Paste it in Settings in the QR Menu app: the days are added
        after your current premium ends, or start the day you redeem it if it already has.
      </p>

      <div role="radiogroup" aria-label="Billing period" className="mt-6 grid gap-3 sm:grid-cols-2">
        {BILLINGS.map((period) => {
          const selected = period === billing;
          return (
            <button
              key={period}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setBilling(period)}
              className={`rounded-xl border p-4 text-left transition ${
                selected
                  ? "border-indigo bg-indigo/5 ring-1 ring-indigo"
                  : "border-muted-line/40 hover:border-indigo/40"
              }`}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold capitalize text-ink">{period}</span>
                {period === "yearly" && saving !== null && (
                  <span className="rounded-full bg-saffron/20 px-2 py-0.5 text-[11px] font-semibold text-ink">
                    Save {saving}%
                  </span>
                )}
              </span>
              <span className="mt-1 block text-2xl font-bold text-ink">
                {formatPrice(amounts[period], region)}
              </span>
              <span className="text-xs text-muted">Adds {BILLING_DAYS[period]} days of premium</span>
            </button>
          );
        })}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium text-ink">Email</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-1 w-full rounded-lg border border-muted-line/40 px-3 py-2.5 text-ink outline-none focus:border-indigo"
          />
          <span className="mt-1 block text-xs text-muted">We email the key here too.</span>
        </label>
        <label className="block text-sm">
          <span className="font-medium text-ink">Mobile number</span>
          <input
            type="tel"
            required
            autoComplete="tel"
            inputMode="tel"
            placeholder={buyerRegion === "IN" ? "98765 43210" : "+1 555 123 4567"}
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            className="mt-1 w-full rounded-lg border border-muted-line/40 px-3 py-2.5 text-ink outline-none focus:border-indigo"
          />
          <span className="mt-1 block text-xs text-muted">Required by the payment gateway.</span>
        </label>
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60 sm:w-auto"
      >
        {submitting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ShoppingCart className="h-4 w-4" />
        )}
        Buy {billing} · {formatPrice(amounts[billing], region)}
      </button>
      <p className="mt-3 text-xs text-muted">Secure payment by Cashfree.</p>
    </form>
  );
}

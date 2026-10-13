"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Copy, Loader2, XCircle } from "lucide-react";
import { QR_MENU_APP_URL } from "@/lib/premiumLinks";

type OrderState =
  | { status: "loading" }
  | { status: "pending" }
  | { status: "paid"; key: string; days: number; billing: "monthly" | "yearly" }
  | { status: "failed" }
  | { status: "not_found" }
  | { status: "error"; message: string };

/** Cashfree can take a few seconds to mark an order paid after redirecting. */
const POLL_MS = 3000;
const MAX_POLLS = 20;

const SETTINGS_URL = `${QR_MENU_APP_URL.replace(/\/+$/, "")}/app/settings`;

export function QrMenuPaymentStatus() {
  const orderId = useSearchParams().get("order_id") ?? "";
  const [state, setState] = useState<OrderState>({ status: "loading" });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!orderId) {
      setState({ status: "not_found" });
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let polls = 0;

    async function check() {
      polls += 1;
      try {
        const response = await fetch(`/api/qr-menu/orders/${encodeURIComponent(orderId)}`, {
          cache: "no-store",
        });
        const data = await response.json().catch(() => ({}));
        if (cancelled) return;
        if (response.status === 404) return setState({ status: "not_found" });
        if (!response.ok) throw new Error(data.error || "Could not check the payment.");
        if (data.status === "pending" && polls < MAX_POLLS) {
          setState({ status: "pending" });
          timer = setTimeout(check, POLL_MS);
          return;
        }
        setState(data.status === "paid" ? data : { status: data.status === "pending" ? "pending" : "failed" });
      } catch (error) {
        if (!cancelled) {
          setState({
            status: "error",
            message: error instanceof Error ? error.message : "Could not check the payment.",
          });
        }
      }
    }

    void check();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [orderId]);

  async function copyKey(key: string) {
    try {
      await navigator.clipboard.writeText(key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // The key is selectable on screen, so a blocked clipboard is not a dead end.
    }
  }

  if (state.status === "loading" || state.status === "pending") {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo" />
        <h1 className="text-2xl font-bold text-ink">Confirming your payment…</h1>
        <p className="text-sm text-muted">
          {state.status === "pending"
            ? "Cashfree has not confirmed it yet. If you paid, this page will update by itself, and your key is emailed to you as well."
            : "This takes a few seconds."}
        </p>
      </div>
    );
  }

  if (state.status === "paid") {
    return (
      <div className="rounded-2xl border border-indigo/15 bg-white p-8 shadow-sm">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="h-7 w-7 flex-shrink-0 text-green-600" />
          <h1 className="text-2xl font-bold text-ink">Payment received</h1>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Here is your license key for {state.days} days of Setu QR Menu premium. We have
          emailed it to you too.
        </p>

        <div className="mt-6 rounded-xl border border-muted-line/40 bg-cream-paper p-4">
          <code className="block select-all break-all font-mono text-sm font-semibold text-ink">
            {state.key}
          </code>
          <button
            type="button"
            onClick={() => copyKey(state.key)}
            className="mt-3 inline-flex items-center gap-2 rounded-lg border border-indigo/30 px-3 py-1.5 text-xs font-semibold text-indigo transition hover:bg-indigo/5"
          >
            <Copy className="h-3.5 w-3.5" />
            {copied ? "Copied" : "Copy key"}
          </button>
        </div>

        <h2 className="mt-8 font-bold text-ink">How to use it</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted">
          <li>Sign in to the QR Menu app and open Settings.</li>
          <li>Paste the key under Account and press Redeem.</li>
          <li>
            If your premium is still running, the {state.days} days are added after it ends.
            If it has ended, they start from the day you redeem.
          </li>
        </ol>
        <p className="mt-3 text-xs text-muted">The key works once, on one account.</p>

        <a
          href={SETTINGS_URL}
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-indigo px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700"
        >
          Open QR Menu settings
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <XCircle className="h-8 w-8 text-red-600" />
      <h1 className="text-2xl font-bold text-ink">
        {state.status === "failed"
          ? "The payment did not go through"
          : state.status === "not_found"
            ? "We could not find that order"
            : "Something went wrong"}
      </h1>
      <p className="text-sm text-muted">
        {state.status === "error"
          ? state.message
          : "Nothing was charged for this order. If money left your account, contact us with the time of payment and we will sort it out."}
      </p>
      <div className="mt-2 flex flex-wrap justify-center gap-3">
        <Link
          href="/products/qr-menu#buy"
          className="rounded-lg bg-indigo px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700"
        >
          Try again
        </Link>
        <Link
          href="/contact"
          className="rounded-lg border border-indigo/30 px-5 py-3 text-sm font-semibold text-indigo transition hover:bg-indigo/5"
        >
          Contact us
        </Link>
      </div>
    </div>
  );
}

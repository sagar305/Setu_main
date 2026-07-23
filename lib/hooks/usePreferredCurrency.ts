"use client";

// Live currency for calculators, following the currency chosen in the Business
// Profile (a shared preference). Returns "₹"/"INR" on the server and first
// client render (so hydration matches), then adopts the real preference after
// mount and on later changes — forcing the calculator to re-render so its
// inputs AND results stay consistent.

import { useEffect, useState } from "react";
import { getPreferences, setActiveCurrency, PREFS_CHANGED_EVENT } from "@/lib/toolkit/preferences";
import { currencySymbol } from "@/lib/pos/types";

export function usePreferredCurrency(): { code: string; symbol: string } {
  const [code, setCode] = useState("INR");
  useEffect(() => {
    const apply = () => {
      const c = getPreferences().currency;
      setActiveCurrency(c); // keep lib/format's formatCurrency in sync
      setCode(c);
    };
    apply();
    window.addEventListener(PREFS_CHANGED_EVENT, apply);
    return () => window.removeEventListener(PREFS_CHANGED_EVENT, apply);
  }, []);
  return { code, symbol: currencySymbol(code) };
}

export function usePreferredCurrencySymbol(): string {
  return usePreferredCurrency().symbol;
}

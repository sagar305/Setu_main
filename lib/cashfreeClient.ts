// Loads Cashfree's checkout script in the browser (shared by the QR Menu and Retail buy boxes).

type CashfreeCheckout = {
  checkout: (options: { paymentSessionId: string; redirectTarget?: "_self" }) => Promise<unknown>;
};

declare global {
  interface Window {
    Cashfree?: (options: { mode: "sandbox" | "production" }) => CashfreeCheckout;
  }
}

const SDK_URL = "https://sdk.cashfree.com/js/v3/cashfree.js";

export function loadCashfree(): Promise<NonNullable<Window["Cashfree"]>> {
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

export function browserTimezone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
  } catch {
    return null;
  }
}


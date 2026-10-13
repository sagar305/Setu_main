import type { Metadata } from "next";
import { Suspense } from "react";
import { QrMenuPaymentStatus } from "@/components/QrMenuPaymentStatus";

// Where Cashfree sends the buyer back. It shows one person their own key, so
// it has nothing for a search engine.
export const metadata: Metadata = {
  title: "Your Setu QR Menu license key",
  robots: { index: false, follow: false },
  alternates: { canonical: "/products/qr-menu/payment" },
};

export default function QrMenuPaymentPage() {
  return (
    <section className="mx-auto max-w-2xl px-6 py-16">
      <Suspense fallback={null}>
        <QrMenuPaymentStatus />
      </Suspense>
    </section>
  );
}

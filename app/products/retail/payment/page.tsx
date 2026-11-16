import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { retailPaymentsEnabled } from "@/lib/featureFlags";
import { RetailPaymentStatus } from "@/components/RetailPaymentStatus";

// Where Cashfree or PayPal sends a Setu Retail buyer back. One person's own key: nothing to index.
export const metadata: Metadata = {
  title: "Your Setu Retail license key",
  robots: { index: false, follow: false },
  alternates: { canonical: "/products/retail/payment" },
};

export default function RetailPaymentPage() {
  if (!retailPaymentsEnabled()) notFound();
  return (
    <section className="mx-auto max-w-2xl px-6 py-16">
      <Suspense fallback={null}>
        <RetailPaymentStatus />
      </Suspense>
    </section>
  );
}

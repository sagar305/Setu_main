import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { workflowPaymentsEnabled } from "@/lib/featureFlags";
import { WorkflowPaymentStatus } from "@/components/WorkflowPaymentStatus";

// Where Cashfree or PayPal sends a Setu Workflow buyer back. One person's own key: nothing to index.
export const metadata: Metadata = {
  title: "Your Setu Workflow license key",
  robots: { index: false, follow: false },
  alternates: { canonical: "/products/workflow/payment" },
};

export default function WorkflowPaymentPage() {
  if (!workflowPaymentsEnabled()) notFound();
  return (
    <section className="mx-auto max-w-2xl px-6 py-16">
      <Suspense fallback={null}>
        <WorkflowPaymentStatus />
      </Suspense>
    </section>
  );
}

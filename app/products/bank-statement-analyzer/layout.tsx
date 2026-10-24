import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AnalyzerProvider } from "@/components/tools/BankStatementAnalyzer/AnalyzerProvider";
import { PwaAppLayout } from "@/components/pwa/PwaAppLayout";
import { pwaMetadata } from "@/lib/pwa/apps";

// One provider around every step so the workflow survives navigation between
// the sub-routes and a browser refresh (decision 25). The landing page renders
// inside it too, which costs nothing — the provider only reads storage.

export const metadata: Metadata = pwaMetadata("bank");

export default function BankStatementAnalyzerLayout({ children }: { children: ReactNode }) {
  return (
    <PwaAppLayout appId="bank">
      <AnalyzerProvider>{children}</AnalyzerProvider>
    </PwaAppLayout>
  );
}

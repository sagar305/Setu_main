import type { ReactNode } from "react";
import { AnalyzerProvider } from "@/components/tools/BankStatementAnalyzer/AnalyzerProvider";

// One provider around every step so the workflow survives navigation between
// the sub-routes and a browser refresh (decision 25). The landing page renders
// inside it too, which costs nothing — the provider only reads storage.

export default function BankStatementAnalyzerLayout({ children }: { children: ReactNode }) {
  return <AnalyzerProvider>{children}</AnalyzerProvider>;
}

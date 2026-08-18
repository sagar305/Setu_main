"use client";

// The local audit trail (decision 23). Deliberately modest in v1: it records
// what the CA did, never the statement contents. No account numbers, no PDF
// passwords, no full narrations.

import { useState } from "react";
import { Card, ConfirmDialog, DangerButton, SecondaryButton } from "@/components/toolkit/ui";
import { useAnalyzer } from "@/components/tools/BankStatementAnalyzer/AnalyzerProvider";

export function ActivityLog() {
  const { audit, actions, statements, transactions } = useAnalyzer();
  const [clearing, setClearing] = useState(false);

  return (
    <div className="space-y-4">
      <Card>
        <h3 className="text-lg font-bold text-ink">Activity</h3>
        <p className="mt-1 text-sm text-muted">
          A local record of what you changed. It never contains account numbers, passwords or file
          contents.
        </p>

        {audit.length === 0 ? (
          <p className="mt-4 rounded-xl bg-cream-paper/60 px-4 py-3 text-sm text-muted">
            Nothing logged yet.
          </p>
        ) : (
          <ul className="mt-4 max-h-96 space-y-1.5 overflow-y-auto">
            {audit.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-wrap items-baseline gap-2 border-b border-muted-line/20 pb-1.5 text-sm"
              >
                <span className="font-medium text-ink">{entry.action}</span>
                {entry.detail ? <span className="text-muted">— {entry.detail}</span> : null}
                <span className="ml-auto text-xs text-muted">
                  {new Date(entry.at).toLocaleString("en-IN")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h3 className="text-lg font-bold text-ink">Local data</h3>
        <p className="mt-1 text-sm text-muted">
          🔒 Your statement data is stored locally in this browser —{" "}
          {statements.length} statement{statements.length === 1 ? "" : "s"} and{" "}
          {transactions.length.toLocaleString("en-IN")} transactions. Clearing removes all of it,
          including your rules and categories.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <DangerButton onClick={() => setClearing(true)}>Clear all local data</DangerButton>
          <SecondaryButton
            onClick={() => {
              window.location.href = "/products/bank-statement-analyzer/export";
            }}
          >
            Export first
          </SecondaryButton>
        </div>
      </Card>

      <ConfirmDialog
        open={clearing}
        title="Clear all local data?"
        message="Every imported statement, transaction, rule, category and log entry for this tool will be deleted from this browser. This cannot be undone."
        confirmLabel="Clear everything"
        onConfirm={() => {
          void actions.clearEverything();
          setClearing(false);
        }}
        onCancel={() => setClearing(false)}
      />
    </div>
  );
}

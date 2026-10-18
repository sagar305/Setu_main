"use client";

// The local audit trail (decision 23). Deliberately modest in v1: it records
// what the CA did, never the statement contents. No account numbers, no PDF
// passwords, no full narrations.

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { fill } from "@/lib/i18n/translate";
import { intlLocaleFor } from "@/lib/i18n/pages";
import { auditActionLabel, auditDetailLabel } from "@/lib/bankStatement/messages";
import { Card, ConfirmDialog, DangerButton, SecondaryButton } from "@/components/toolkit/ui";
import { useAnalyzer } from "@/components/tools/BankStatementAnalyzer/AnalyzerProvider";

export function ActivityLog() {
  const { t, lang } = useI18n();
  const { audit, actions, statements, transactions } = useAnalyzer();
  const [clearing, setClearing] = useState(false);

  return (
    <div className="space-y-4">
      <Card>
        <h3 className="text-lg font-bold text-ink">{t("bsActTitle")}</h3>
        <p className="mt-1 text-sm text-muted">{t("bsActBlurb")}</p>

        {audit.length === 0 ? (
          <p className="mt-4 rounded-xl bg-cream-paper/60 px-4 py-3 text-sm text-muted">
            {t("bsActEmpty")}
          </p>
        ) : (
          <ul className="mt-4 max-h-96 space-y-1.5 overflow-y-auto">
            {audit.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-wrap items-baseline gap-2 border-b border-muted-line/20 pb-1.5 text-sm"
              >
                <span className="font-medium text-ink">{auditActionLabel(entry, lang)}</span>
                {auditDetailLabel(entry, lang) ? (
                  <span className="text-muted">— {auditDetailLabel(entry, lang)}</span>
                ) : null}
                <span className="ml-auto text-xs text-muted">
                  {new Date(entry.at).toLocaleString(intlLocaleFor(lang))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h3 className="text-lg font-bold text-ink">{t("bsActLocalData")}</h3>
        <p className="mt-1 text-sm text-muted">
          {fill(t(statements.length === 1 ? "bsActStored1" : "bsActStoredN"), {
            statements: statements.length,
            rows: transactions.length.toLocaleString(intlLocaleFor(lang)),
          })}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <DangerButton onClick={() => setClearing(true)}>{t("bsActClearAll")}</DangerButton>
          <SecondaryButton
            onClick={() => {
              window.location.href = "/products/bank-statement-analyzer/export";
            }}
          >
            {t("bsActExportFirst")}
          </SecondaryButton>
        </div>
      </Card>

      <ConfirmDialog
        open={clearing}
        title={t("bsActClearQ")}
        message={t("bsActClearBody")}
        confirmLabel={t("bsActClearConfirm")}
        onConfirm={() => {
          void actions.clearEverything();
          setClearing(false);
        }}
        onCancel={() => setClearing(false)}
      />
    </div>
  );
}

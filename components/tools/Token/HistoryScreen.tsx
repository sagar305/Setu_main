"use client";

import { useMemo, useState } from "react";
import { Ban, Download, MessageCircle, Undo2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { fill } from "@/lib/i18n/translate";
import { useToken } from "@/lib/token/store";
import { formatClock, formatMinutes, tokenRows } from "@/lib/token/reports";
import { downloadCsv, tokensCsv } from "@/lib/token/csv";
import { whatsAppLinkFor } from "@/lib/token/messages";
import {
  statusLabel,
  type MessageTemplateKey,
  type Token,
  type TokenStatus,
} from "@/lib/token/types";
import { ConfirmDialog, SectionCard, StatusChip, chipBtnClass, secondaryBtnClass } from "./ui";

const STATUSES: TokenStatus[] = [
  "waiting",
  "called",
  "serving",
  "served",
  "skipped",
  "cancelled",
];

/**
 * Where a supervisor answers "what happened to token A-17".
 *
 * Today only, deliberately — the question is always about someone standing in
 * the room right now. Anything older is a reporting question, and Reports has
 * the whole ninety days.
 */
export function HistoryScreen() {
  const { t, lang } = useI18n();
  const {
    todayTokens,
    services,
    counters,
    today,
    settings,
    business,
    markCameBack,
    cancelToken,
  } = useToken();
  const [serviceFilter, setServiceFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | TokenStatus>("all");
  const [cancelId, setCancelId] = useState<string | null>(null);

  const messageLink = (token: Token, key: MessageTemplateKey) =>
    whatsAppLinkFor(key, settings, {
      token,
      service: services.find((row) => row.id === token.serviceId),
      counter: counters.find((row) => row.id === token.counterId) ?? null,
      businessName: business?.name ?? "",
      tokens: todayTokens,
      counters,
      minutes: settings.autoSkipMinutes,
      lang,
    });

  const rows = useMemo(() => {
    const filtered = todayTokens.filter((token) => {
      if (serviceFilter !== "all" && token.serviceId !== serviceFilter) return false;
      if (statusFilter !== "all" && token.status !== statusFilter) return false;
      return true;
    });
    return tokenRows(filtered, services, counters, lang).sort((a, b) =>
      a.token.issuedAt < b.token.issuedAt ? 1 : -1
    );
  }, [todayTokens, services, counters, serviceFilter, statusFilter, lang]);

  return (
    <div className="grid gap-4">
      <SectionCard
        title={fill(t("tkHiToday"), { date: today })}
        action={
          <button
            type="button"
            className={secondaryBtnClass}
            disabled={rows.length === 0}
            onClick={() => downloadCsv(`token-${today}.csv`, tokensCsv(rows))}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            CSV
          </button>
        }
      >
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setServiceFilter("all")}
            className={`${chipBtnClass} ${serviceFilter === "all" ? "border-indigo bg-indigo/10 text-indigo" : ""}`}
          >
            {t("tkHiAllServices")}
          </button>
          {services.map((service) => (
            <button
              key={service.id}
              type="button"
              onClick={() => setServiceFilter(service.id)}
              className={`${chipBtnClass} ${serviceFilter === service.id ? "border-indigo bg-indigo/10 text-indigo" : ""}`}
            >
              {service.name}
            </button>
          ))}
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className={`${chipBtnClass} ${statusFilter === "all" ? "border-indigo bg-indigo/10 text-indigo" : ""}`}
          >
            {t("tkHiAnyStatus")}
          </button>
          {STATUSES.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={`${chipBtnClass} ${statusFilter === status ? "border-indigo bg-indigo/10 text-indigo" : ""}`}
            >
              {statusLabel(status, lang)}
            </button>
          ))}
        </div>

        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">
            {t("tkHiNoMatch")}
          </p>
        ) : (
          <div className="-mx-4 overflow-x-auto sm:mx-0">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-muted-line/30 text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-3 py-2 font-semibold">{t("tkHiColToken")}</th>
                  <th className="px-3 py-2 font-semibold">{t("tkHiColService")}</th>
                  <th className="px-3 py-2 font-semibold">{t("tkHiColStatus")}</th>
                  <th className="px-3 py-2 font-semibold">{t("tkHiColCounter")}</th>
                  <th className="px-3 py-2 font-semibold">{t("tkHiColIssued")}</th>
                  <th className="px-3 py-2 font-semibold">{t("tkHiColCalled")}</th>
                  <th className="px-3 py-2 text-right font-semibold">{t("tkHiColWaited")}</th>
                  <th className="px-3 py-2 text-right font-semibold">{t("tkHiColService")}</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.token.id} className="border-b border-muted-line/15">
                    <td className="px-3 py-2.5">
                      <span className="text-base font-extrabold text-ink">{row.label}</span>
                      {row.token.priority && (
                        <span className="ml-2 text-xs font-bold text-saffron">{t("tkPriority")}</span>
                      )}
                      {row.token.customerName && (
                        <div className="text-xs text-muted">{row.token.customerName}</div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-ink">{row.serviceName}</td>
                    <td className="px-3 py-2.5">
                      <StatusChip status={row.token.status} />
                    </td>
                    <td className="px-3 py-2.5 text-muted">{row.counterName}</td>
                    <td className="px-3 py-2.5 tabular-nums text-muted">
                      {formatClock(row.token.issuedAt, lang)}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-muted">
                      {formatClock(row.token.calledAt, lang)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-muted">
                      {formatMinutes(row.waited, lang)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-muted">
                      {formatMinutes(row.serviceTime, lang)}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Sending somebody their number again is the most
                            common thing anyone wants from this table — they
                            lost the slip, or they never got the message. */}
                        {row.token.phone && (
                          <a
                            href={messageLink(row.token, "tokenIssued")}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`${chipBtnClass} min-h-0 px-2 py-1`}
                            title={t("tkHiSendTitle")}
                          >
                            <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
                            {t("tkHiSend")}
                          </a>
                        )}
                        {row.token.status === "skipped" && !row.token.reissuedAsId && (
                          <button
                            type="button"
                            className={`${chipBtnClass} min-h-0 px-2 py-1`}
                            onClick={() => void markCameBack(row.token.id)}
                          >
                            <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
                            {t("tkHiCameBack")}
                          </button>
                        )}
                        {(row.token.status === "waiting" || row.token.status === "called") && (
                          <button
                            type="button"
                            className={`${chipBtnClass} min-h-0 px-2 py-1`}
                            onClick={() => setCancelId(row.token.id)}
                          >
                            <Ban className="h-3.5 w-3.5" aria-hidden="true" />
                            {t("cancel")}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <ConfirmDialog
        open={Boolean(cancelId)}
        title={t("tkCoCancelTitle")}
        message={t("tkHiCancelMessage")}
        confirmLabel={t("tkCoCancelToken")}
        onCancel={() => setCancelId(null)}
        onConfirm={() => {
          const id = cancelId;
          setCancelId(null);
          if (id) void cancelToken(id);
        }}
      />
    </div>
  );
}

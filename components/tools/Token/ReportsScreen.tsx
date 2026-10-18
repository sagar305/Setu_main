"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { fill, type TKey } from "@/lib/i18n/translate";
import { useToken } from "@/lib/token/store";
import { retentionCutoff } from "@/lib/token/calc";
import {
  demandByService,
  formatHourRange,
  formatMinutes,
  loadByHour,
  peakHour,
  performanceByCounter,
  summarise,
  tokenRows,
  totalsByDay,
} from "@/lib/token/reports";
import {
  counterPerformanceCsv,
  dailyTotalsCsv,
  downloadCsv,
  hourLoadCsv,
  serviceDemandCsv,
  tokensCsv,
} from "@/lib/token/csv";
import { TOKEN_RETENTION_DAYS } from "@/lib/token/types";
import { SectionCard, chipBtnClass, secondaryBtnClass } from "./ui";

const RANGES = [
  { id: "7", days: 7 },
  { id: "30", days: 30 },
  { id: "90", days: TOKEN_RETENTION_DAYS },
] as const;

export function ReportsScreen() {
  const { t, lang } = useI18n();
  const { tokens, services, counters, today } = useToken();
  const [rangeId, setRangeId] = useState<(typeof RANGES)[number]["id"]>("7");
  const range = RANGES.find((row) => row.id === rangeId) ?? RANGES[0];

  const scoped = useMemo(() => {
    const from = retentionCutoff(today, range.days);
    return tokens.filter((token) => token.date > from);
  }, [tokens, today, range.days]);

  const summary = useMemo(() => summarise(scoped), [scoped]);
  const days = useMemo(() => totalsByDay(scoped), [scoped]);
  const hours = useMemo(() => loadByHour(scoped), [scoped]);
  const busiest = peakHour(hours);
  const byCounter = useMemo(() => performanceByCounter(scoped, counters), [scoped, counters]);
  const byService = useMemo(() => demandByService(scoped, services), [scoped, services]);
  const maxHour = Math.max(1, ...hours.map((row) => row.issued));

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-2">
        {RANGES.map((row) => (
          <button
            key={row.id}
            type="button"
            onClick={() => setRangeId(row.id)}
            className={`${chipBtnClass} ${row.id === rangeId ? "border-indigo bg-indigo/10 text-indigo" : ""}`}
          >
            {row.id === "7"
              ? t("tkRpLast7")
              : fill(t("tkRpLastN"), { n: row.days })}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="tkRpIssued" value={String(summary.issued)} />
        <Stat label="tkRpServed" value={String(summary.served)} />
        <Stat label="tkRpAvgWait" value={formatMinutes(summary.averageWait, lang)} />
        <Stat label="tkRpAvgService" value={formatMinutes(summary.averageService, lang)} />
      </div>

      {/* The row that earns this screen: when do people actually turn up. */}
      <SectionCard
        title={t("tkRpWhenFills")}
        action={
          <button
            type="button"
            className={secondaryBtnClass}
            onClick={() => downloadCsv(`token-hourly-${today}.csv`, hourLoadCsv(hours))}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            CSV
          </button>
        }
      >
        {summary.issued === 0 ? (
          <p className="py-6 text-center text-sm text-muted">
            {t("tkRpNoTokensPeriod")}
          </p>
        ) : (
          <>
            {busiest && (
              <p className="mb-4 text-sm text-muted">
                {fill(t("tkRpBusiest"), {
                  hours: formatHourRange(busiest.hour),
                  count: busiest.issued,
                })}
              </p>
            )}
            <div className="flex items-end gap-1" role="img" aria-label={t("tkRpByHourAlt")}>
              {hours.map((row) => (
                <div key={row.hour} className="flex flex-1 flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t bg-indigo/80"
                    style={{ height: `${Math.max(2, (row.issued / maxHour) * 96)}px` }}
                    title={`${formatHourRange(row.hour)}: ${row.issued}`}
                  />
                  {row.hour % 3 === 0 && (
                    <span className="text-[10px] text-muted">{row.hour}</span>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </SectionCard>

      <SectionCard
        title={t("tkRpNoShows")}
        action={
          <button
            type="button"
            className={secondaryBtnClass}
            disabled={scoped.length === 0}
            onClick={() =>
              downloadCsv(
                `token-tokens-${today}.csv`,
                // English, like every other column in the file.
                tokensCsv(tokenRows(scoped, services, counters, "en"))
              )
            }
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            {t("tkRpAllTokens")}
          </button>
        }
      >
        <div className="grid grid-cols-3 gap-2">
          <Stat label="tkStSkipped" value={String(summary.skipped)} />
          <Stat label="tkStCancelled" value={String(summary.cancelled)} />
          <Stat
            label="tkRpNoShowRate"
            value={`${Math.round(summary.noShowRate * 100)}%`}
          />
        </div>
        <p className="mt-3 text-xs text-muted">
          {t("tkRpNoShowNote")}
        </p>
      </SectionCard>

      <SectionCard
        title={t("tkRpByCounter")}
        action={
          <button
            type="button"
            className={secondaryBtnClass}
            disabled={byCounter.length === 0}
            onClick={() =>
              downloadCsv(`token-counters-${today}.csv`, counterPerformanceCsv(byCounter))
            }
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            CSV
          </button>
        }
      >
        {byCounter.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">{t("tkRpNoCounters")}</p>
        ) : (
          <div className="-mx-4 overflow-x-auto sm:mx-0">
            <table className="w-full min-w-[520px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-muted-line/30 text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-3 py-2 font-semibold">{t("tkHiColCounter")}</th>
                  <th className="px-3 py-2 font-semibold">{t("tkRpStaff")}</th>
                  <th className="px-3 py-2 text-right font-semibold">{t("tkRpServed")}</th>
                  <th className="px-3 py-2 text-right font-semibold">{t("tkRpAvgWait")}</th>
                  <th className="px-3 py-2 text-right font-semibold">{t("tkRpAvgService")}</th>
                </tr>
              </thead>
              <tbody>
                {byCounter.map((row) => (
                  <tr key={row.counterId} className="border-b border-muted-line/15">
                    <td className="px-3 py-2.5 font-semibold text-ink">{row.name}</td>
                    <td className="px-3 py-2.5 text-muted">{row.staffName || "—"}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-ink">{row.served}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-muted">
                      {formatMinutes(row.averageWait, lang)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-muted">
                      {formatMinutes(row.averageService, lang)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <SectionCard
        title={t("tkRpWhatPeopleComeFor")}
        action={
          <button
            type="button"
            className={secondaryBtnClass}
            disabled={byService.length === 0}
            onClick={() =>
              downloadCsv(`token-services-${today}.csv`, serviceDemandCsv(byService))
            }
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            CSV
          </button>
        }
      >
        {byService.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">{t("tkRpNothingIssued")}</p>
        ) : (
          <ul className="grid gap-3">
            {byService.map((row) => (
              <li key={row.serviceId}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-semibold text-ink">{row.name}</span>
                  <span className="text-muted">
                    {row.issued} · {Math.round(row.share * 100)}%
                  </span>
                </div>
                <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-cream">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${Math.max(2, row.share * 100)}%`, backgroundColor: row.colour }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard
        title={t("tkRpDayByDay")}
        action={
          <button
            type="button"
            className={secondaryBtnClass}
            disabled={days.length === 0}
            onClick={() => downloadCsv(`token-daily-${today}.csv`, dailyTotalsCsv(days))}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            CSV
          </button>
        }
      >
        {days.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">{t("tkRpNothingYet")}</p>
        ) : (
          <div className="-mx-4 overflow-x-auto sm:mx-0">
            <table className="w-full min-w-[480px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-muted-line/30 text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-3 py-2 font-semibold">{t("date")}</th>
                  <th className="px-3 py-2 text-right font-semibold">{t("tkRpIssued")}</th>
                  <th className="px-3 py-2 text-right font-semibold">{t("tkRpServed")}</th>
                  <th className="px-3 py-2 text-right font-semibold">{t("tkStSkipped")}</th>
                  <th className="px-3 py-2 text-right font-semibold">{t("tkStCancelled")}</th>
                </tr>
              </thead>
              <tbody>
                {days.map((day) => (
                  <tr key={day.date} className="border-b border-muted-line/15">
                    <td className="px-3 py-2.5 font-semibold text-ink">{day.date}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{day.issued}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{day.served}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{day.skipped}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{day.cancelled}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <p className="text-center text-xs text-muted">
        {fill(t("tkRpRetention"), { days: TOKEN_RETENTION_DAYS })}
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: TKey; value: string }) {
  const { t } = useI18n();
  return (
    <div className="rounded-xl border border-muted-line/30 bg-white px-3 py-2.5 text-center">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">
        {t(label)}
      </div>
      <div className="mt-0.5 text-lg font-bold text-ink">{value}</div>
    </div>
  );
}

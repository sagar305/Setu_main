"use client";

// The one place a CA meets the on-device categoriser.
// ---------------------------------------------------------------------------
// Deliberately a panel and not a step: automatic categorisation is an offer, not
// a stage of the workflow. Nothing on this screen waits for it, the button is
// the only thing that starts it, and everything the tool did before — rules,
// patterns, categorising by hand — is untouched whether it is used or not.

import { useI18n } from "@/lib/i18n";
import { fill } from "@/lib/i18n/translate";
import { intlLocaleFor } from "@/lib/i18n/pages";
import { aiProgressLabel } from "@/lib/bankStatement/messages";
import { useEffect, useState } from "react";
import { Download, Sparkles, ShieldCheck, WifiOff } from "lucide-react";
import { Card, Field, NumberInput, PrimaryButton, SecondaryButton } from "@/components/toolkit/ui";
import { ProgressPanel } from "@/components/tools/BankStatementAnalyzer/ProgressPanel";
import { useAnalyzer } from "@/components/tools/BankStatementAnalyzer/AnalyzerProvider";
import { useAiCategorisation } from "@/components/tools/BankStatementAnalyzer/useAiCategorisation";
import { AiReviewQueue } from "@/components/tools/BankStatementAnalyzer/AiReviewQueue";
import { AiCategorySuggestions } from "@/components/tools/BankStatementAnalyzer/AiCategorySuggestions";
import { categoryName } from "@/lib/bankStatement/classification/categories";

export function AiCategorisationPanel() {
  const { t, lang } = useI18n();
  const { settings, categories, learned, actions } = useAnalyzer();
  const {
    supported,
    client,
    run,
    summary,
    error,
    pendingCount,
    awaitingApproval,
    newCategories,
    dismissSuggestion,
    clearSuggestion,
    busy,
    ready,
    categorise,
    download,
    cancel,
  } = useAiCategorisation();
  const online = useOnlineStatus();

  const [showSettings, setShowSettings] = useState(false);

  const learnedEntries = [...learned.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return (
    <div className="space-y-4">
    <Card className="border-indigo/20">
      <div className="min-w-[240px] flex-1">
        <h3 className="flex items-center gap-2 text-lg font-bold text-ink">
          <Sparkles className="h-4 w-4 text-indigo" aria-hidden="true" />
          {t("bsApTitle")}
        </h3>
        <p className="mt-1 text-sm text-muted">
          {pendingCount > 0
            ? fill(t(pendingCount === 1 ? "bsApPending1" : "bsApPendingN"), {
                n: pendingCount.toLocaleString(intlLocaleFor(lang)),
              })
            : t("bsApAllPlaced")}
        </p>
      </div>

      {/* Two presses, not one, and deliberately so.
          -----------------------------------------------------------------
          Downloading the model is the only moment this feature touches the
          network. Doing it on its own button — before any transaction is
          involved — means a CA can watch exactly what happens and when, and
          can then disconnect before categorising anything. A single button
          that quietly did both would give them nothing to check. */}
      <ol className="mt-4 space-y-3">
        <li className="rounded-xl border border-muted-line/30 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-[220px] flex-1">
              <p className="text-sm font-bold text-ink">
                {t("bsApStep1")}
                {ready ? t("bsApStepDone") : ""}
              </p>
              <p className="mt-1 text-xs text-muted">
                {ready ? t("bsApLoaded") : t("bsApOneTime")}
              </p>
            </div>
            {ready ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                {t("bsApDownloaded")}
              </span>
            ) : (
              <PrimaryButton
                onClick={() => void download()}
                disabled={!supported || client.phase === "loading"}
              >
                <span className="flex items-center gap-1.5">
                  <Download className="h-4 w-4" aria-hidden="true" />
                  {client.phase === "loading" ? t("bsApDownloading") : t("bsApDownloadModel")}
                </span>
              </PrimaryButton>
            )}
          </div>

          {ready ? (
            <p className="mt-3 flex items-start gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
              <WifiOff className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>
                <strong>{t("bsApTurnOffLabel")}</strong> {t("bsApTurnOffBody")}
              </span>
            </p>
          ) : null}
        </li>

        <li className="rounded-xl border border-muted-line/30 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-[220px] flex-1">
              <p className="text-sm font-bold text-ink">{t("bsApStep2")}</p>
              <p className="mt-1 text-xs text-muted">
                {ready ? t("bsApStep2Ready") : t("bsApStep2NotReady")}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {busy ? (
                <SecondaryButton onClick={cancel}>{t("bsApStop")}</SecondaryButton>
              ) : (
                <PrimaryButton
                  onClick={() => void categorise()}
                  disabled={!supported || !ready || pendingCount === 0}
                >
                  {t("bsApCategoriseWithAi")}
                </PrimaryButton>
              )}
              <SecondaryButton onClick={() => setShowSettings((open) => !open)}>
                {showSettings ? t("bsApHideSettings") : t("dnStSettings")}
              </SecondaryButton>
            </div>
          </div>

          {ready && !online ? (
            <p className="mt-3 flex items-start gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
              <WifiOff className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {t("bsApOfflineWorks")}
            </p>
          ) : null}
        </li>
      </ol>

      {!supported ? (
        <p className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {t("bsApUnsupportedPanel")}
        </p>
      ) : null}

      {client.phase === "loading" || run.stage !== "idle" ? (
        <div className="mt-4">
          <ProgressPanel
            progress={
              run.stage === "classifying"
                ? {
                    label: t("bsApMatching"),
                    current: run.current,
                    total: run.total,
                  }
                : run.stage === "applying"
                  ? { label: t("bsApApplying") }
                  : run.stage === "grouping"
                  ? { label: t("bsApGrouping") }
                  : {
                      label: client.progress
                        ? aiProgressLabel(client.progress, lang)
                        : t("bsApReading"),
                      current: client.percent,
                      total: client.percent === undefined ? undefined : 100,
                    }
            }
          />
          <p className="mt-2 text-xs text-muted">
            {t("bsApKeepWorking")}
          </p>
        </div>
      ) : null}

      {error ? (
        <p className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {fill(t("bsApErrorTail"), { error })}
        </p>
      ) : null}

      {summary ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Tally label={t("bsApTallyConfident")} value={summary.confident} tone="good" />
          <Tally label={t("bsApTallyTentative")} value={summary.tentative} tone="warn" />
          <Tally label={t("bsApTallyNone")} value={summary.unresolved} tone="plain" />
        </div>
      ) : null}

      {client.phase === "ready" && client.backend ? (
        <p className="mt-3 text-xs text-muted">
          {fill(t("bsApBackendLine"), {
            name: client.backend.name,
            device: t(
              client.backend.device === "webgpu" ? "bsApBackendGpu" : "bsApBackendCpu"
            ),
            quantization: client.backend.quantization,
            dimensions: client.backend.dimensions,
          })}
        </p>
      ) : null}

      {showSettings ? (
        <div className="mt-5 space-y-5 border-t border-muted-line/30 pt-5">
          <div>
            <h4 className="text-sm font-bold text-ink">{t("bsApThresholds")}</h4>
            <p className="mt-1 text-xs text-muted">
              {/* The emphasis rides on a placeholder, so each language puts the
                  bold phrase where its own sentence wants it. */}
              {(() => {
                const [before, after] = fill(t("bsApThresholdNote"), { strong: "\u0000" }).split(
                  "\u0000"
                );
                return (
                  <>
                    {before}
                    <strong>{t("bsApSimilarityScore")}</strong>
                    {after}
                  </>
                );
              })()}
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label={t("bsApAutoAt")}>
                <NumberInput
                  value={settings.aiAutoThreshold}
                  min={0}
                  max={100}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    if (Number.isFinite(value)) {
                      void actions.updateSettings({ ...settings, aiAutoThreshold: value });
                    }
                  }}
                />
              </Field>
              <Field label={t("bsApReviewAt")}>
                <NumberInput
                  value={settings.aiReviewThreshold}
                  min={0}
                  max={100}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    if (Number.isFinite(value)) {
                      void actions.updateSettings({ ...settings, aiReviewThreshold: value });
                    }
                  }}
                />
              </Field>
            </div>
            <p className="mt-2 text-xs text-muted">
              {fill(t("bsApBelowNote"), { n: settings.aiReviewThreshold })}
            </p>
          </div>

          <div>
            <h4 className="text-sm font-bold text-ink">
              {fill(t("bsApLearnedTitle"), { n: learnedEntries.length })}
            </h4>
            <p className="mt-1 text-xs text-muted">
              {t("bsApLearnedNote")}
            </p>
            {learnedEntries.length === 0 ? (
              <p className="mt-3 rounded-xl bg-cream-paper/60 px-4 py-3 text-xs text-muted">
                {t("bsApLearnedEmpty")}
              </p>
            ) : (
              <ul className="mt-3 max-h-56 space-y-1.5 overflow-y-auto pr-1">
                {learnedEntries.map((entry) => (
                  <li
                    key={entry.key}
                    className="flex flex-wrap items-center gap-2 rounded-lg border border-muted-line/30 px-3 py-2 text-xs"
                  >
                    <span className="min-w-0 flex-1 truncate font-medium text-ink">{entry.label}</span>
                    <span className="text-muted">→ {categoryName(categories, entry.category, lang)}</span>
                    {entry.count > 1 ? (
                      <span className="text-muted">
                        {fill(t("bsApConfirmedTimes"), { n: entry.count })}
                      </span>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => actions.forgetLearned(entry.key)}
                      className="font-semibold text-red-500 hover:text-red-600"
                    >
                      {t("bsApForget")}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </Card>

    <AiReviewQueue groups={awaitingApproval} />

    <AiCategorySuggestions
      suggestions={newCategories}
      onDismiss={dismissSuggestion}
      onAccepted={clearSuggestion}
    />
    </div>
  );
}

/**
 * Whether the browser thinks it has a connection. Read-only — it inspects a
 * flag the browser already maintains and makes no request of its own. It is
 * here so that a CA who disconnects to check us gets told, on the spot, that
 * the feature carried on working.
 */
function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const update = () => setOnline(window.navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  return online;
}

function Tally({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "good" | "warn" | "plain";
}) {
  const style =
    tone === "good"
      ? "bg-emerald-50 text-emerald-800"
      : tone === "warn"
        ? "bg-amber-50 text-amber-800"
        : "bg-cream-paper/70 text-muted";

  return (
    <div className={`rounded-xl px-4 py-3 ${style}`}>
      <p className="text-xl font-bold">{value.toLocaleString("en-IN")}</p>
      <p className="text-xs font-semibold">{label}</p>
    </div>
  );
}

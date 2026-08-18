"use client";

// The one place a CA meets the on-device categoriser.
// ---------------------------------------------------------------------------
// Deliberately a panel and not a step: automatic categorisation is an offer, not
// a stage of the workflow. Nothing on this screen waits for it, the button is
// the only thing that starts it, and everything the tool did before — rules,
// patterns, categorising by hand — is untouched whether it is used or not.

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
          Categorise the rest automatically
        </h3>
        <p className="mt-1 text-sm text-muted">
          {pendingCount > 0 ? (
            <>
              <strong className="text-ink">{pendingCount.toLocaleString("en-IN")}</strong>{" "}
              transaction{pendingCount === 1 ? "" : "s"} your rules and the keyword patterns could
              not place. A small language model runs inside this browser and matches each one
              against your category descriptions by meaning, not by exact keyword. Nothing it
              suggests is applied for good until you approve it — and once you do, it is saved as a
              rule, so the same merchant never needs the model again.
            </>
          ) : (
            <>Every transaction already has a category from a rule, a pattern or your own edits.</>
          )}
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
                Step 1 · Download the model{ready ? " — done" : ""}
              </p>
              <p className="mt-1 text-xs text-muted">
                {ready ? (
                  <>
                    Loaded and running on this device. Nothing further will be downloaded, and no
                    part of your statement was involved in this step.
                  </>
                ) : (
                  <>
                    A one-time download of the model file itself (about 15–25 MB), from the model
                    host. This is the only time this feature uses the network, and it sends nothing
                    about your statement — it has not been read at this point.
                  </>
                )}
              </p>
            </div>
            {ready ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                Downloaded
              </span>
            ) : (
              <PrimaryButton
                onClick={() => void download()}
                disabled={!supported || client.phase === "loading"}
              >
                <span className="flex items-center gap-1.5">
                  <Download className="h-4 w-4" aria-hidden="true" />
                  {client.phase === "loading" ? "Downloading…" : "Download AI model"}
                </span>
              </PrimaryButton>
            )}
          </div>

          {ready ? (
            <p className="mt-3 flex items-start gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
              <WifiOff className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>
                <strong>If you have any doubt, turn your internet off now.</strong> The model is
                loaded in this browser and categorising below will still work with no connection at
                all — which is the simplest way to see for yourself that nothing is being uploaded.
                Your browser has also cached the file, so a later visit normally skips this step.
              </span>
            </p>
          ) : null}
        </li>

        <li className="rounded-xl border border-muted-line/30 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-[220px] flex-1">
              <p className="text-sm font-bold text-ink">Step 2 · Categorise on this device</p>
              <p className="mt-1 text-xs text-muted">
                {ready
                  ? "Reads the narrations in this browser and suggests a category for each. Works with the network disconnected."
                  : "Available once the model is on this device. No transaction is read before then."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {busy ? (
                <SecondaryButton onClick={cancel}>Stop</SecondaryButton>
              ) : (
                <PrimaryButton
                  onClick={() => void categorise()}
                  disabled={!supported || !ready || pendingCount === 0}
                >
                  Categorise with AI
                </PrimaryButton>
              )}
              <SecondaryButton onClick={() => setShowSettings((open) => !open)}>
                {showSettings ? "Hide settings" : "Settings"}
              </SecondaryButton>
            </div>
          </div>

          {ready && !online ? (
            <p className="mt-3 flex items-start gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
              <WifiOff className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              You are offline, and this still works. Your statement is being read entirely on this
              device.
            </p>
          ) : null}
        </li>
      </ol>

      {!supported ? (
        <p className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          This browser cannot run on-device categorisation — it needs Web Workers and WebAssembly.
          Rules, keyword patterns and categorising by hand all work as usual.
        </p>
      ) : null}

      {client.phase === "loading" || run.stage !== "idle" ? (
        <div className="mt-4">
          <ProgressPanel
            progress={
              run.stage === "classifying"
                ? {
                    label: "Matching transactions to categories",
                    current: run.current,
                    total: run.total,
                  }
                : run.stage === "applying"
                  ? { label: "Applying categories" }
                  : run.stage === "grouping"
                  ? { label: "Looking for categories you do not have" }
                  : {
                      label: client.message ?? "Reading transactions on this device…",
                      current: client.percent,
                      total: client.percent === undefined ? undefined : 100,
                    }
            }
          />
          <p className="mt-2 text-xs text-muted">
            You can keep filtering, editing and categorising while this runs — it happens on a
            background thread.
          </p>
        </div>
      ) : null}

      {error ? (
        <p className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {error} Your rules and manual categorising are unaffected.
        </p>
      ) : null}

      {summary ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Tally label="Suggested, awaiting your approval" value={summary.confident} tone="good" />
          <Tally label="Suggested but a close call" value={summary.tentative} tone="warn" />
          <Tally label="Nothing to suggest" value={summary.unresolved} tone="plain" />
        </div>
      ) : null}

      {client.phase === "ready" && client.backend ? (
        <p className="mt-3 text-xs text-muted">
          {client.backend.name} · running on{" "}
          {client.backend.device === "webgpu" ? "your GPU (WebGPU)" : "the CPU (WebAssembly)"} ·{" "}
          {client.backend.quantization} weights · {client.backend.dimensions} dimensions · loaded
          once for this browser session.
        </p>
      ) : null}

      {showSettings ? (
        <div className="mt-5 space-y-5 border-t border-muted-line/30 pt-5">
          <div>
            <h4 className="text-sm font-bold text-ink">Confidence thresholds</h4>
            <p className="mt-1 text-xs text-muted">
              The number in the confidence column is a <strong>model similarity score</strong>, not a
              statistical probability: it combines how closely a transaction matches a category
              description with how far ahead that category is of the runner-up. Tune these against
              your own statements.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="Categorise automatically at or above">
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
              <Field label="Categorise but flag for review at or above">
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
              Below {settings.aiReviewThreshold}% a transaction is left uncategorised rather than
              guessed at.
            </p>
          </div>

          <div>
            <h4 className="text-sm font-bold text-ink">
              Learned from your corrections ({learnedEntries.length})
            </h4>
            <p className="mt-1 text-xs text-muted">
              When you change a category by hand, that merchant is remembered here and used ahead of
              the model next time. Stored on this device only.
            </p>
            {learnedEntries.length === 0 ? (
              <p className="mt-3 rounded-xl bg-cream-paper/60 px-4 py-3 text-xs text-muted">
                Nothing learned yet. Correct a category in the table and it will appear here.
              </p>
            ) : (
              <ul className="mt-3 max-h-56 space-y-1.5 overflow-y-auto pr-1">
                {learnedEntries.map((entry) => (
                  <li
                    key={entry.key}
                    className="flex flex-wrap items-center gap-2 rounded-lg border border-muted-line/30 px-3 py-2 text-xs"
                  >
                    <span className="min-w-0 flex-1 truncate font-medium text-ink">{entry.label}</span>
                    <span className="text-muted">→ {categoryName(categories, entry.category)}</span>
                    {entry.count > 1 ? (
                      <span className="text-muted">· confirmed {entry.count}×</span>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => actions.forgetLearned(entry.key)}
                      className="font-semibold text-red-500 hover:text-red-600"
                    >
                      Forget
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

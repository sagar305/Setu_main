"use client";

// The one place a CA meets the on-device categoriser.
// ---------------------------------------------------------------------------
// Deliberately a panel and not a step: automatic categorisation is an offer, not
// a stage of the workflow. Nothing on this screen waits for it, the button is
// the only thing that starts it, and everything the tool did before — rules,
// patterns, categorising by hand — is untouched whether it is used or not.

import { useState } from "react";
import { Sparkles, ShieldCheck } from "lucide-react";
import { Card, Field, NumberInput, PrimaryButton, SecondaryButton } from "@/components/toolkit/ui";
import { ProgressPanel } from "@/components/tools/BankStatementAnalyzer/ProgressPanel";
import { useAnalyzer } from "@/components/tools/BankStatementAnalyzer/AnalyzerProvider";
import { useAiCategorisation } from "@/components/tools/BankStatementAnalyzer/useAiCategorisation";
import { AiReviewQueue } from "@/components/tools/BankStatementAnalyzer/AiReviewQueue";
import { categoryName } from "@/lib/bankStatement/classification/categories";

export function AiCategorisationPanel() {
  const { settings, categories, learned, actions } = useAnalyzer();
  const { supported, client, run, summary, error, pendingCount, awaitingApproval, busy, categorise, cancel } =
    useAiCategorisation();

  const [showSettings, setShowSettings] = useState(false);

  const learnedEntries = [...learned.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return (
    <div className="space-y-4">
    <Card className="border-indigo/20">
      <div className="flex flex-wrap items-start justify-between gap-3">
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
                suggests is applied for good until you approve it — and once you do, it is saved as
                a rule, so the same merchant never needs the model again.
              </>
            ) : (
              <>Every transaction already has a category from a rule, a pattern or your own edits.</>
            )}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {busy ? (
            <SecondaryButton onClick={cancel}>Stop</SecondaryButton>
          ) : (
            <PrimaryButton onClick={() => void categorise()} disabled={!supported || pendingCount === 0}>
              Categorise with AI
            </PrimaryButton>
          )}
          <SecondaryButton onClick={() => setShowSettings((open) => !open)}>
            {showSettings ? "Hide settings" : "Settings"}
          </SecondaryButton>
        </div>
      </div>

      {/* The honest version of the privacy claim: the model file is downloaded,
          the statement is not uploaded. Both halves said plainly. */}
      <p className="mt-3 inline-flex items-start gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>
          The model file (about 15–25 MB) is downloaded once from the model host and cached by your
          browser. After that it runs entirely on this device — your transactions are read in this
          browser and are never sent to a model host, a server, or anyone else.
        </span>
      </p>

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
                  : {
                      label: client.message ?? "Preparing AI categorisation…",
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
          Running on {client.backend.device === "webgpu" ? "your GPU (WebGPU)" : "the CPU (WebAssembly)"} ·{" "}
          {client.backend.dtype} weights · loaded once for this browser session.
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
    </div>
  );
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

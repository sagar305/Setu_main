"use client";

// The benchmark's controls. Development only — see app/dev/ai-benchmark.
// ---------------------------------------------------------------------------
// Deliberately plain: this is a measuring instrument, not product UI, and any
// effort spent styling it is effort not spent on the screens a CA actually
// uses. It downloads both models, which is why it is not something a user can
// stumble into.

import { useState } from "react";
import { PrimaryButton } from "@/components/toolkit/ui";
import { benchmarkAll, formatComparison, type BenchmarkResult } from "@/lib/bankStatement/ai/benchmark";
import { parseDataset, STARTER_DATASET } from "@/lib/bankStatement/ai/benchmarkDataset";

const PLACEHOLDER = STARTER_DATASET.slice(0, 3)
  .map((row) => `${row.narration},${row.direction},${row.expected}`)
  .join("\n");

export function AiBenchmarkRunner() {
  const [pasted, setPasted] = useState("");
  const [results, setResults] = useState<BenchmarkResult[] | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dataset = pasted.trim() === "" ? STARTER_DATASET : parseDataset(pasted);

  const run = async () => {
    setRunning(true);
    setError(null);
    setResults(null);
    try {
      setResults(await benchmarkAll(dataset));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="mt-6 space-y-5">
      <div>
        <label htmlFor="dataset" className="text-sm font-semibold text-ink">
          Labelled transactions ({dataset.length} rows)
        </label>
        <p className="mt-1 text-xs text-muted">
          One per line: <code>narration, DEBIT|CREDIT, category-id</code>. Leave empty to use the
          built-in synthetic set. Paste anonymised rows from real statements for a result worth
          acting on — a few hundred, labelled by someone who knows the books.
        </p>
        <textarea
          id="dataset"
          value={pasted}
          onChange={(event) => setPasted(event.target.value)}
          placeholder={PLACEHOLDER}
          rows={8}
          className="mt-2 w-full rounded-lg border border-muted-line/40 p-3 font-mono text-xs"
        />
      </div>

      <PrimaryButton onClick={() => void run()} disabled={running || dataset.length === 0}>
        {running ? "Running — downloading models…" : "Run benchmark"}
      </PrimaryButton>

      {error ? (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</p>
      ) : null}

      {results ? (
        <>
          <pre className="overflow-x-auto rounded-lg bg-cream-paper/70 p-4 text-xs">
            {formatComparison(results)}
          </pre>

          {results.map((result) => (
            <details key={result.model} className="rounded-lg border border-muted-line/30 p-4">
              <summary className="cursor-pointer text-sm font-semibold text-ink">
                {result.model} — {(result.accuracy * 100).toFixed(1)}% correct,{" "}
                {result.mistakes.length} mistake{result.mistakes.length === 1 ? "" : "s"}
              </summary>

              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted sm:grid-cols-3">
                <Stat label="Device" value={`${result.info.device} / ${result.info.quantization}`} />
                <Stat label="Dimensions" value={String(result.info.dimensions)} />
                <Stat label="Initialise" value={`${result.initialiseMs.toFixed(0)} ms`} />
                <Stat label="Category embeddings" value={`${result.categoryEmbeddingMs.toFixed(0)} ms`} />
                <Stat label="Batch" value={`${result.batchEmbeddingMs.toFixed(0)} ms`} />
                <Stat label="Per transaction" value={`${result.perTransactionMs.toFixed(2)} ms`} />
                <Stat
                  label="Downloaded"
                  value={
                    result.downloadedBytes
                      ? `${(result.downloadedBytes / 1024 / 1024).toFixed(1)} MB`
                      : "cached"
                  }
                />
                <Stat
                  label="Heap growth"
                  value={
                    result.heapGrowthBytes
                      ? `${(result.heapGrowthBytes / 1024 / 1024).toFixed(1)} MB`
                      : "not reported"
                  }
                />
                <Stat label="Mean top similarity" value={result.meanTopSimilarity.toFixed(3)} />
                <Stat label="Accuracy when acted" value={result.accuracyWhenActed.toFixed(3)} />
                <Stat label="Abstained" value={result.abstained.toFixed(3)} />
              </dl>

              <p className="mt-3 text-xs font-semibold text-ink">Score distribution</p>
              <pre className="mt-1 text-xs text-muted">
                {result.scoreDistribution.map((band) => `${band.band.padStart(6)}  ${"#".repeat(band.count)} ${band.count}`).join("\n")}
              </pre>

              {result.mistakes.length > 0 ? (
                <>
                  <p className="mt-3 text-xs font-semibold text-ink">Mistakes</p>
                  <pre className="mt-1 max-h-64 overflow-auto text-xs text-muted">
                    {result.mistakes
                      .map((m) => `${m.narration}\n   expected ${m.expected}, got ${m.got ?? "(none)"} at ${m.score}`)
                      .join("\n")}
                  </pre>
                </>
              ) : null}
            </details>
          ))}
        </>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-semibold text-ink">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

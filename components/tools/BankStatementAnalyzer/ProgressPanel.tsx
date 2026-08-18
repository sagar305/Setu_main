"use client";

// Progress that means something (decision 27). A percentage is only drawn when
// we genuinely know the denominator — page 32 of 120, or 824 of 1,248 rows.
// Where we cannot count, we show the stage list instead of inventing a number.

export type ProgressState = {
  label: string;
  current?: number;
  total?: number;
  unit?: string;
};

export type StageState = {
  name: string;
  status: "done" | "active" | "pending";
};

export function ProgressPanel({
  progress,
  stages,
}: {
  progress?: ProgressState | null;
  stages?: StageState[];
}) {
  const measurable =
    progress?.total !== undefined && progress.total > 0 && progress.current !== undefined;
  const percent = measurable
    ? Math.min(100, Math.round(((progress.current as number) / (progress.total as number)) * 100))
    : null;

  return (
    <div className="rounded-2xl border border-muted-line/30 bg-white p-6 shadow-sm">
      {progress ? (
        <>
          <p className="text-sm font-semibold text-ink">{progress.label}</p>
          {measurable ? (
            <>
              <p className="mt-1 text-sm text-muted">
                {progress.unit === "page"
                  ? `Page ${progress.current} of ${progress.total}`
                  : `${(progress.current as number).toLocaleString("en-IN")} / ${(progress.total as number).toLocaleString("en-IN")}`}
              </p>
              <div
                className="mt-3 h-2 w-full overflow-hidden rounded-full bg-cream"
                role="progressbar"
                aria-valuenow={percent ?? 0}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={progress.label}
              >
                <div
                  className="h-full rounded-full bg-indigo transition-all duration-200"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <p className="mt-2 text-xs font-semibold text-indigo">{percent}%</p>
            </>
          ) : (
            <p className="mt-1 text-sm text-muted">Working…</p>
          )}
        </>
      ) : null}

      {stages && stages.length > 0 ? (
        <ul className="mt-4 space-y-1.5 text-sm">
          {stages.map((stage) => (
            <li
              key={stage.name}
              className={
                stage.status === "done"
                  ? "text-emerald-700"
                  : stage.status === "active"
                    ? "font-semibold text-ink"
                    : "text-muted"
              }
            >
              <span aria-hidden="true" className="mr-2">
                {stage.status === "done" ? "✓" : stage.status === "active" ? "●" : "○"}
              </span>
              {stage.name}
              <span className="sr-only">
                {stage.status === "done" ? " — done" : stage.status === "active" ? " — in progress" : " — waiting"}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

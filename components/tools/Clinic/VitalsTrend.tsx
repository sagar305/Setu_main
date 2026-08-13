"use client";

import { useMemo } from "react";
import { formatDate, visitVitals, type Visit } from "@/lib/clinic/types";

type Series = { label: string; colour: string; points: { x: string; y: number }[] };

/**
 * Weight and BP over time. Hand-drawn SVG rather than a charting library: two
 * small line charts do not justify shipping one to a clinic on a 3G connection,
 * and the app has no other chart.
 */
export function VitalsTrend({ visits }: { visits: Visit[] }) {
  const series = useMemo<Series[]>(() => {
    const ordered = [...visits].sort((a, b) => a.date.localeCompare(b.date));
    const weight: Series = { label: "Weight (kg)", colour: "#4f46e5", points: [] };
    const systolic: Series = { label: "Systolic", colour: "#dc2626", points: [] };
    const diastolic: Series = { label: "Diastolic", colour: "#ea580c", points: [] };

    for (const visit of ordered) {
      const vitals = visitVitals(visit);
      if (vitals.weightKg) weight.points.push({ x: visit.date, y: vitals.weightKg });
      if (vitals.bpSystolic) systolic.points.push({ x: visit.date, y: vitals.bpSystolic });
      if (vitals.bpDiastolic) diastolic.points.push({ x: visit.date, y: vitals.bpDiastolic });
    }
    return [weight, systolic, diastolic].filter((s) => s.points.length > 0);
  }, [visits]);

  if (series.length === 0) {
    return (
      <p className="text-sm text-muted">
        Record weight or blood pressure in a consultation and the trend appears here.
      </p>
    );
  }

  const weightSeries = series.filter((s) => s.label.startsWith("Weight"));
  const bpSeries = series.filter((s) => !s.label.startsWith("Weight"));

  return (
    <div className="space-y-5">
      {weightSeries.length > 0 && <Chart title="Weight" series={weightSeries} unit="kg" />}
      {bpSeries.length > 0 && <Chart title="Blood pressure" series={bpSeries} unit="mmHg" />}
    </div>
  );
}

function Chart({ title, series, unit }: { title: string; series: Series[]; unit: string }) {
  const width = 320;
  const height = 120;
  const padding = { top: 8, right: 8, bottom: 18, left: 30 };

  const allPoints = series.flatMap((s) => s.points);
  const values = allPoints.map((p) => p.y);
  const dates = Array.from(new Set(allPoints.map((p) => p.x))).sort();

  // A flat series would collapse to a zero-height band, so pad the range.
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const span = rawMax - rawMin;
  const min = span === 0 ? rawMin - 1 : rawMin - span * 0.1;
  const max = span === 0 ? rawMax + 1 : rawMax + span * 0.1;

  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const xOf = (date: string) => {
    if (dates.length <= 1) return padding.left + plotWidth / 2;
    const index = dates.indexOf(date);
    return padding.left + (index / (dates.length - 1)) * plotWidth;
  };
  const yOf = (value: number) =>
    padding.top + plotHeight - ((value - min) / (max - min)) * plotHeight;

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h5 className="text-xs font-semibold uppercase tracking-wide text-muted">{title}</h5>
        <div className="flex flex-wrap gap-3">
          {series.map((s) => (
            <span key={s.label} className="inline-flex items-center gap-1.5 text-[11px] text-muted">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: s.colour }}
              />
              {s.label}
            </span>
          ))}
        </div>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        role="img"
        aria-label={`${title} over time, ${unit}`}
      >
        <line
          x1={padding.left}
          y1={padding.top + plotHeight}
          x2={width - padding.right}
          y2={padding.top + plotHeight}
          stroke="#e5e7eb"
        />
        <text x={2} y={padding.top + 6} className="fill-current text-[8px] text-muted">
          {Math.round(max)}
        </text>
        <text x={2} y={padding.top + plotHeight} className="fill-current text-[8px] text-muted">
          {Math.round(min)}
        </text>

        {series.map((s) => (
          <g key={s.label}>
            <polyline
              fill="none"
              stroke={s.colour}
              strokeWidth={1.5}
              strokeLinejoin="round"
              points={s.points.map((p) => `${xOf(p.x)},${yOf(p.y)}`).join(" ")}
            />
            {s.points.map((p) => (
              <circle key={`${s.label}-${p.x}`} cx={xOf(p.x)} cy={yOf(p.y)} r={2.5} fill={s.colour}>
                <title>{`${formatDate(p.x)}: ${p.y} ${unit}`}</title>
              </circle>
            ))}
          </g>
        ))}

        {dates.length > 1 && (
          <>
            <text
              x={padding.left}
              y={height - 4}
              className="fill-current text-[8px] text-muted"
            >
              {formatDate(dates[0]).slice(0, 6)}
            </text>
            <text
              x={width - padding.right}
              y={height - 4}
              textAnchor="end"
              className="fill-current text-[8px] text-muted"
            >
              {formatDate(dates[dates.length - 1]).slice(0, 6)}
            </text>
          </>
        )}
      </svg>
    </div>
  );
}

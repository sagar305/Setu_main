export function ResultStat({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className={`rounded-xl p-4 ${emphasis ? "bg-indigo text-cream-paper" : "bg-cream"}`}>
      <p className={`text-xs font-semibold uppercase tracking-wide ${emphasis ? "text-cream-paper/70" : "text-muted-warm"}`}>
        {label}
      </p>
      <p className={`mt-1 text-2xl font-bold tracking-tight ${emphasis ? "text-cream-paper" : "text-ink"}`}>{value}</p>
    </div>
  );
}

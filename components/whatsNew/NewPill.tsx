/**
 * The small "New" / "Updated" tag. Server-safe so the website's card grids can
 * use it; the label is passed in already translated.
 */
export function NewPill({
  label,
  tone = "new",
  className = "",
}: {
  label: string;
  tone?: "new" | "updated";
  className?: string;
}) {
  const colours =
    tone === "new" ? "bg-saffron text-ink" : "border border-indigo/30 bg-indigo/5 text-indigo";
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${colours} ${className}`}
    >
      {label}
    </span>
  );
}

/** A dot for a nav tab with something new behind it. */
export function NewDot({ label }: { label: string }) {
  return (
    <span className="relative flex h-2 w-2" aria-label={label} role="status">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-saffron opacity-60 motion-reduce:animate-none" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-saffron" />
    </span>
  );
}

type LogoProps = {
  variant?: "light" | "dark";
  showWordmark?: boolean;
  size?: number;
  className?: string;
};

export function LogoMark({ size = 40, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M18 98 L18 56 C18 40 28 31 46 31 L74 31 C92 31 102 40 102 56 L102 98"
        fill="none"
        stroke="currentColor"
        strokeWidth="16"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Logo({ variant = "light", showWordmark = true, size = 40, className = "" }: LogoProps) {
  const markColor = variant === "light" ? "text-indigo" : "text-cream-paper";
  const wordmarkColor = variant === "light" ? "text-indigo" : "text-cream-paper";
  const subColor = variant === "light" ? "text-indigo" : "text-muted-line";

  return (
    <span className={`inline-flex items-center gap-3 ${className}`}>
      <LogoMark size={size} className={markColor} />
      {showWordmark && (
        <span className="flex flex-col leading-none">
          <span className={`text-2xl font-bold tracking-tight ${wordmarkColor}`}>
            Setu<span className="text-saffron">.</span>
          </span>
          <span className={`mt-1 text-[10px] font-medium uppercase tracking-[0.42em] ${subColor}`}>
            Technology
          </span>
        </span>
      )}
    </span>
  );
}

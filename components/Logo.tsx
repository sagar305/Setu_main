// TEMPORARY — DIWALI 2026: remove after Diwali.
import { Diya } from "@/components/Diya";

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
        // TEMPORARY — DIWALI 2026: the grid stacks the normal wordmark and the
        // "Happy Diwali!" one in the same cell, so the logo never changes
        // width when they swap. Outside Diwali only the normal one shows.
        // After Diwali, put back the plain <span> with "Setu." and "Technology".
        <span className="grid leading-none">
          <span className="diwali-wordmark-main col-start-1 row-start-1 flex flex-col">
            <span className={`text-2xl font-bold tracking-tight ${wordmarkColor}`}>
              {/* TEMPORARY — DIWALI 2026: "diwali-hide" class and <Diya />. */}
              Setu<span className="diwali-hide text-saffron">.</span>
              <Diya className="ms-0.5 h-[0.62em] w-[0.62em] align-baseline" />
            </span>
            <span className={`mt-1 text-[10px] font-medium uppercase tracking-[0.42em] ${subColor}`}>
              Technology
            </span>
          </span>
          <span
            aria-hidden="true"
            className="diwali-wordmark-greeting col-start-1 row-start-1 flex-col"
          >
            <span className={`whitespace-nowrap text-2xl font-bold tracking-tight ${wordmarkColor}`}>
              Happy Diwali<span className="text-saffron">!</span>
            </span>
            <span className={`mt-1 text-[10px] font-medium uppercase tracking-[0.42em] ${subColor}`}>
              From Setu
            </span>
          </span>
        </span>
      )}
    </span>
  );
}


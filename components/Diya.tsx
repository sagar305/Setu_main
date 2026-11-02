// TEMPORARY — DIWALI 2026. Remove after Diwali (see lib/festive.ts).

/**
 * A small clay diya with a flickering flame. Used after "Setu" in the logo and
 * at both ends of the top banner. Hidden unless <html data-festive="diwali">,
 * so it can sit in pages rendered ahead of time without a flash.
 */
export function Diya({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className={`diwali-diya ${className}`}>
      {/* Glow, flame and its bright core, then the clay bowl in front. */}
      <circle className="diwali-diya-glow" cx="10" cy="7" r="6" fill="#FFC24B" opacity="0.35" />
      <g className="diwali-diya-flame">
        <path d="M10 1.5 C12.6 5 12.4 8.6 10 10 C7.6 8.6 7.4 5 10 1.5 Z" fill="#FF9F2E" />
        <path d="M10 4.5 C11.3 6.4 11.2 8.3 10 9.2 C8.8 8.3 8.7 6.4 10 4.5 Z" fill="#FFF2B3" />
      </g>
      <path d="M1.5 11 H18.5 C18 15.6 14.6 18.5 10 18.5 C5.4 18.5 2 15.6 1.5 11 Z" fill="#F2A03D" />
      <path d="M1.5 11 H18.5" stroke="#C4661F" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

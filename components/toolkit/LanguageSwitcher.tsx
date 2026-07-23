"use client";

import { usePathname } from "next/navigation";
import { Globe } from "lucide-react";
import { LANGUAGES, useI18n, type LanguageCode } from "@/lib/i18n";

// Translations only cover the interactive app surface — the tools and the
// calculators. On every other route (home, products, blog, contact…) the copy
// is English-only, so the switcher is shown disabled and pinned to English with
// a tooltip explaining why, rather than pretending those pages can translate.
function isTranslatablePath(pathname: string | null): boolean {
  if (!pathname) return false;
  return pathname.startsWith("/tools") || pathname.startsWith("/calculators");
}

export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { lang, setLang } = useI18n();
  const pathname = usePathname();
  const enabled = isTranslatablePath(pathname);

  const disabledNote = "Language switching is available on tools & calculators only";

  return (
    <label
      className={`flex items-center gap-1.5 rounded-full border border-muted-line/40 py-1.5 pl-2.5 pr-1 text-sm text-ink ${
        enabled ? "" : "cursor-not-allowed opacity-50"
      } ${className}`}
      title={enabled ? undefined : disabledNote}
    >
      <Globe className="h-4 w-4 text-muted" aria-hidden="true" />
      <select
        aria-label="Language"
        // On non-translatable pages, always display English regardless of the
        // saved preference — the stored language is left untouched so it comes
        // back when the user returns to a tool or calculator.
        value={enabled ? lang : "en"}
        onChange={(e) => setLang(e.target.value as LanguageCode)}
        disabled={!enabled}
        aria-disabled={!enabled}
        title={enabled ? undefined : disabledNote}
        className={`bg-transparent pr-1 text-sm font-medium outline-none ${
          enabled ? "cursor-pointer" : "cursor-not-allowed"
        }`}
      >
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.name}
          </option>
        ))}
      </select>
    </label>
  );
}

"use client";

import { Globe } from "lucide-react";
import { LANGUAGES, useI18n, type LanguageCode } from "@/lib/i18n";

export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { lang, setLang } = useI18n();
  return (
    <label
      className={`flex items-center gap-1.5 rounded-full border border-muted-line/40 py-1.5 pl-2.5 pr-1 text-sm text-ink ${className}`}
    >
      <Globe className="h-4 w-4 text-muted" aria-hidden="true" />
      <select
        aria-label="Language"
        value={lang}
        onChange={(e) => setLang(e.target.value as LanguageCode)}
        className="cursor-pointer bg-transparent pr-1 text-sm font-medium outline-none"
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

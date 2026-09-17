"use client";

import { usePathname, useRouter } from "next/navigation";
import { Globe } from "lucide-react";
import { LANGUAGES, useI18n, type LanguageCode } from "@/lib/i18n";
import { languagesFor, pageFromPath, pathFor } from "@/lib/i18n/pages";

// Two kinds of translated surface, and the switcher has to behave differently
// on each:
//
//   - Tools and calculators translate in the browser, from the saved language
//     preference. Changing the language there is a state change.
//   - Pages published in several languages (see lib/i18n/pages) are translated
//     server-side, one URL per language — `/hi`, `/hi/privacy`, `/es/tools` —
//     because copy that only appears after hydration cannot rank. Changing the
//     language there is a navigation, and the URL decides what is on screen.
//
// Everywhere else the copy is English-only, so the switcher is shown disabled
// and pinned to English rather than pretending those pages can translate.
function isClientTranslatablePath(pathname: string | null): boolean {
  if (!pathname) return false;
  return pathname.startsWith("/tools/") || pathname.startsWith("/calculators/");
}

export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { lang, setLang } = useI18n();
  const router = useRouter();
  const pathname = usePathname();

  const page = pageFromPath(pathname);
  const enabled = page !== null || isClientTranslatablePath(pathname);

  // A translated page only offers the languages it has been translated into;
  // the tools offer all of them, because their UI is translated from the
  // shared dictionary rather than page copy.
  const offered = page ? languagesFor(page.key) : LANGUAGES.map((l) => l.code);

  const disabledNote = "Language switching is available on translated pages, tools & calculators";

  const handleChange = (code: LanguageCode) => {
    setLang(code);
    // On a translated page the other language lives at its own URL, so the
    // choice has to move the reader there.
    if (page) router.push(pathFor(page.key, code));
  };

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
        // On a translated page the URL is the truth. On the tools the saved
        // preference is. Everywhere else, display English regardless of the
        // saved language — which is left untouched so it comes back on the next
        // tool page.
        value={page ? page.lang : enabled ? lang : "en"}
        onChange={(e) => handleChange(e.target.value as LanguageCode)}
        disabled={!enabled}
        aria-disabled={!enabled}
        title={enabled ? undefined : disabledNote}
        className={`bg-transparent pr-1 text-sm font-medium outline-none ${
          enabled ? "cursor-pointer" : "cursor-not-allowed"
        }`}
      >
        {LANGUAGES.filter((l) => offered.includes(l.code)).map((l) => (
          <option key={l.code} value={l.code}>
            {l.name}
          </option>
        ))}
      </select>
    </label>
  );
}

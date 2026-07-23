// Supported UI languages (Chapter 3 §Shared Preferences). Each language shows
// its own name (endonym) in the switcher. `dir` drives document direction.

export type LanguageCode =
  | "en"
  | "hi"
  | "bn"
  | "ta"
  | "te"
  | "mr"
  | "gu"
  | "kn"
  | "ml"
  | "pa"
  | "es"
  | "fr"
  | "ar"
  | "pt"
  | "id"
  | "de"
  | "zh";

export type Language = { code: LanguageCode; name: string; dir: "ltr" | "rtl" };

export const LANGUAGES: Language[] = [
  { code: "en", name: "English", dir: "ltr" },
  // Major Indian languages
  { code: "hi", name: "हिन्दी", dir: "ltr" },
  { code: "bn", name: "বাংলা", dir: "ltr" },
  { code: "ta", name: "தமிழ்", dir: "ltr" },
  { code: "te", name: "తెలుగు", dir: "ltr" },
  { code: "mr", name: "मराठी", dir: "ltr" },
  { code: "gu", name: "ગુજરાતી", dir: "ltr" },
  { code: "kn", name: "ಕನ್ನಡ", dir: "ltr" },
  { code: "ml", name: "മലയാളം", dir: "ltr" },
  { code: "pa", name: "ਪੰਜਾਬੀ", dir: "ltr" },
  // Major international languages
  { code: "es", name: "Español", dir: "ltr" },
  { code: "fr", name: "Français", dir: "ltr" },
  { code: "ar", name: "العربية", dir: "rtl" },
  { code: "pt", name: "Português", dir: "ltr" },
  { code: "id", name: "Bahasa Indonesia", dir: "ltr" },
  { code: "de", name: "Deutsch", dir: "ltr" },
  { code: "zh", name: "中文", dir: "ltr" },
];

export function isLanguageCode(code: string): code is LanguageCode {
  return LANGUAGES.some((l) => l.code === code);
}

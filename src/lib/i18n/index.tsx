import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import sv from "./dictionaries/sv.json";
import en from "./dictionaries/en.json";

export type Dictionary = Record<string, string>;

export type LanguageDef = {
  code: string;
  label: string;
  dict: Dictionary;
};

// Add a new language by dropping in dictionaries/xx.json and appending an entry here.
export const LANGUAGES: LanguageDef[] = [
  { code: "sv", label: "Svenska", dict: sv as Dictionary },
  { code: "en", label: "English", dict: en as Dictionary },
];

const DEFAULT_LANG = "sv";
const STORAGE_KEY = "app_language";
// The UI is authored in Swedish, so Swedish is the source of truth for fallbacks.
const SOURCE_LANG = DEFAULT_LANG;
const FALLBACK_DICT = (LANGUAGES.find((l) => l.code === SOURCE_LANG)?.dict ?? {}) as Dictionary;

const warnedKeys = new Set<string>();

function humanizeKey(key: string): string {
  const words = key.replace(/[_.-]+/g, " ").trim();
  if (!words) return key;
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Fallback chain for a missing key:
 *   1. active language dictionary
 *   2. source language (Swedish) — guarantees a real, human sentence
 *   3. humanized key — last resort, never a raw snake_case token
 * In dev a missing key is logged once so gaps get fixed instead of shipped.
 */
function translate(dict: Dictionary, key: string): string {
  const active = dict[key];
  if (active) return active;

  const source = FALLBACK_DICT[key];
  if (import.meta.env.DEV && !warnedKeys.has(key)) {
    warnedKeys.add(key);
    console.warn(
      `[i18n] Missing translation for "${key}"${source ? ` – using ${SOURCE_LANG} fallback.` : " – no source string either."}`,
    );
  }
  if (source) return source;
  return humanizeKey(key);
}

function detectInitialLanguage(): string {
  if (typeof window === "undefined") return DEFAULT_LANG;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && LANGUAGES.some((l) => l.code === stored)) return stored;
  } catch {
    // ignore
  }
  // No browser-language auto-switch: the UI is authored in Swedish and only
  // partially translated, so English is opt-in via the language switcher.
  return DEFAULT_LANG;
}

type I18nContextValue = {
  t: (key: string) => string;
  language: string;
  setLanguage: (code: string) => void;
  languages: LanguageDef[];
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  // Start with DEFAULT_LANG on both server and first client render to avoid hydration mismatch.
  const [language, setLanguageState] = useState<string>(DEFAULT_LANG);

  useEffect(() => {
    const detected = detectInitialLanguage();
    if (detected !== language) setLanguageState(detected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setLanguage = (code: string) => {
    if (!LANGUAGES.some((l) => l.code === code)) return;
    setLanguageState(code);
    try {
      window.localStorage.setItem(STORAGE_KEY, code);
    } catch {
      // ignore
    }
  };

  const value = useMemo<I18nContextValue>(() => {
    const active = LANGUAGES.find((l) => l.code === language)?.dict ?? FALLBACK_DICT;
    const t = (key: string): string => translate(active, key);
    return { t, language, setLanguage, languages: LANGUAGES };
  }, [language]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useTranslation(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    // Safe fallback: no provider -> source language string, no crash.
    return {
      t: (key: string) => translate(FALLBACK_DICT, key),
      language: DEFAULT_LANG,
      setLanguage: () => {},
      languages: LANGUAGES,
    };
  }
  return ctx;
}
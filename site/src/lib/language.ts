import { prettify } from './text';

const FALLBACK: Record<string, string> = {
  en: 'English',
  es: 'Spanish',
  zh: 'Chinese',
  vi: 'Vietnamese',
  ar: 'Arabic',
  fr: 'French',
  ru: 'Russian',
  pt: 'Portuguese',
  ko: 'Korean',
  ht: 'Haitian Creole',
  km: 'Khmer',
  asl: 'American Sign Language',
};

let names: Intl.DisplayNames | null | undefined;

/** "es" gives "Spanish". Uses the browser or Node language names, with a small fallback list. */
export function languageName(code: string): string {
  const key = code.toLowerCase();
  if (FALLBACK[key]) return FALLBACK[key];
  if (names === undefined) {
    try {
      names = new Intl.DisplayNames(['en'], { type: 'language' });
    } catch {
      names = null;
    }
  }
  try {
    const n = names?.of(code);
    if (n && n !== code) return n;
  } catch {
    // fall through
  }
  return prettify(code);
}

/** The primary part of a language code: "es-MX" gives "es". */
export function languageBase(code: string): string {
  return code.toLowerCase().split(/[-_]/)[0] ?? code.toLowerCase();
}

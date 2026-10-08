// Small text helpers shared by pages and islands.

/** Lowercase, strip accents, collapse spaces. Used for search and for comparing ids. */
export function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** "Lower Northeast" and "lower_northeast" both give "lower-northeast". */
export function slugify(s: string): string {
  return fold(s)
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** "caving_gear" gives "Caving gear". For ids with no label in the vocabulary. */
export function prettify(id: string): string {
  const t = id.replace(/[-_]+/g, ' ').trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Sort key for names: ignore case, accents, and a leading "The". */
export function nameKey(name: string): string {
  return fold(name).replace(/^the /, '');
}

export function compareNames(a: string, b: string): number {
  const ka = nameKey(a);
  const kb = nameKey(b);
  return ka < kb ? -1 : ka > kb ? 1 : 0;
}

/** Cut text to about `max` characters at a word boundary. */
export function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const at = cut.lastIndexOf(' ');
  return (at > max * 0.6 ? cut.slice(0, at) : cut).replace(/[\s,;:.]+$/, '') + '…';
}

/** Host name of a URL without "www.", or the input if it cannot be parsed. */
export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/** Only allow web links from data. Anything else (javascript:, data:) becomes null. */
export function safeHttpUrl(url: string | undefined | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url.trim());
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null;
  } catch {
    return null;
  }
}

/** Digits only, for tel: links. Keeps a leading plus. */
export function telHref(phone: string): string {
  const plus = phone.trim().startsWith('+') ? '+' : '';
  return 'tel:' + plus + phone.replace(/\D+/g, '');
}

/** Escape text for use in HTML. */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const SMALL = new Set(['and', 'of', 'the', 'in', 'on', 'at', 'to']);

/** "mount-airy" gives "Mount Airy". For place ids with no label in the vocabulary. */
export function titleCase(id: string): string {
  return id
    .replace(/[-_]+/g, ' ')
    .trim()
    .split(' ')
    .map((w, i) => (i > 0 && SMALL.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

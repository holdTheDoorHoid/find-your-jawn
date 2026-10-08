import { escapeHtml } from './text';

// Tiny inline markup for strings: [text](url) and **bold**. Output is safe HTML.
// Paths that start with "/" are site paths and get the base added; everything else must be a
// full http(s) link and opens as an ordinary external link.

export function inline(text: string, base = '/'): string {
  let out = escapeHtml(text);
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label: string, url: string) => {
    const raw = url.replace(/&amp;/g, '&');
    if (raw.startsWith('/')) {
      const href = base.replace(/\/*$/, '/') + raw.replace(/^\/+/, '');
      return `<a href="${escapeHtml(href)}">${label}</a>`;
    }
    if (/^https:\/\//.test(raw)) {
      return `<a href="${escapeHtml(raw)}" rel="noopener noreferrer">${label}</a>`;
    }
    return label;
  });
  return out;
}

/** Fill {name} placeholders in a string. */
export function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

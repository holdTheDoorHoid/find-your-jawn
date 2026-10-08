// Site wide constants and URL helpers.

export const REPO = 'holdTheDoorHoid/find-your-jawn';
export const REPO_URL = `https://github.com/${REPO}`;
export const SITE_ORIGIN = 'https://holdthedoorhoid.github.io';

/** Base path with a leading and trailing slash, for example "/find-your-jawn/". */
export function basePath(): string {
  const raw = (import.meta.env?.BASE_URL as string | undefined) ?? '/';
  return (raw.startsWith('/') ? raw : '/' + raw).replace(/\/*$/, '/');
}

/** Turn "browse/" or "/browse/" into "/find-your-jawn/browse/". */
export function withBase(path: string, base: string = basePath()): string {
  const clean = path.replace(/^\/+/, '');
  return base + clean;
}

/** Full public URL for a site path, used for canonical links and sharing. */
export function absoluteUrl(path: string, base: string = basePath()): string {
  return SITE_ORIGIN + withBase(path, base);
}

export function groupPath(id: string): string {
  return `g/${id}/`;
}

export function interestPath(id: string): string {
  return `i/${id}/`;
}

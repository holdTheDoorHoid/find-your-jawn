// Browser side data loading for islands. Fetches the built data files from the same site.

import { basePath, withBase } from './site';
import { normalizeGroupsFile } from './normalize';
import type { Group } from './types';

export function dataUrl(file: string, version?: string): string {
  const url = withBase(`data/${file}`, basePath());
  return version ? `${url}?v=${encodeURIComponent(version)}` : url;
}

export async function fetchGroups(version?: string): Promise<{ built: string; groups: Group[] }> {
  const res = await fetch(dataUrl('groups.json', version));
  if (!res.ok) throw new Error(`groups.json: ${res.status}`);
  return normalizeGroupsFile(await res.json());
}

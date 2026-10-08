// Browser side data loading for islands. Fetches the built data files from the same site.

import { basePath, withBase } from './site';
import { normalizeGroupsFile } from './normalize';
import type { Group } from './types';
import type { QuizConfig } from './quiz-config';

export function dataUrl(file: string, version?: string): string {
  const url = withBase(`data/${file}`, basePath());
  return version ? `${url}?v=${encodeURIComponent(version)}` : url;
}

export async function fetchGroups(version?: string): Promise<{ built: string; groups: Group[] }> {
  const res = await fetch(dataUrl('groups.json', version));
  if (!res.ok) throw new Error(`groups.json: ${res.status}`);
  return normalizeGroupsFile(await res.json());
}

/** The vocabulary the quiz needs, written by the site build next to the group data. */
export async function fetchQuizConfig(version?: string): Promise<QuizConfig> {
  const res = await fetch(dataUrl('quiz-config.json', version));
  if (!res.ok) throw new Error(`quiz-config.json: ${res.status}`);
  return (await res.json()) as QuizConfig;
}

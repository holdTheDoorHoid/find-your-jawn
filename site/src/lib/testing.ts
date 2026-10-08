// Helpers for tests only. Builds a normalized group from a few overrides.

import { normalizeGroup } from './normalize';
import type { Group } from './types';

type Deep = Record<string, unknown>;

function merge(base: Deep, over: Deep): Deep {
  const out: Deep = { ...base };
  for (const [k, v] of Object.entries(over)) {
    const b = out[k];
    out[k] =
      v && typeof v === 'object' && !Array.isArray(v) && b && typeof b === 'object' && !Array.isArray(b)
        ? merge(b as Deep, v as Deep)
        : v;
  }
  return out;
}

export function makeGroup(over: Deep = {}): Group {
  const base: Deep = {
    id: 'example-group',
    name: 'Example Group',
    summary: 'A made up group for tests.',
    kind: 'club',
    categories: ['outdoors'],
    interests: ['hiking'],
    audience: { open_to: 'public' },
    schedule: { days: ['sat'], times: ['morning'], recurring: true },
    locations: [{ neighborhood: 'fishtown', planning_district: 'river-wards', in_city: true }],
    cost: { level: 'free' },
    access: { wheelchair: 'unknown', languages: ['en'] },
    requirements: {},
    first_step: {},
    status: 'active',
    last_sign_of_life: '2026-09',
    research_tier: 1,
  };
  return normalizeGroup(merge(base, over));
}

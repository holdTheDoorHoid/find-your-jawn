// Types for the site data files described in docs/DATA_MODEL.md section 5.
//
// `groups.json` entries and `groups/<slug>.json` files share one normalized shape here. The raw
// files omit null values, empty lists and empty objects, so every reader goes through
// `normalizeGroup` (lib/normalize.ts) and then works with a record where lists are always lists
// and nested objects are always present. Text fields that are unknown are `undefined`, never "".

export type Tri = 'yes' | 'no' | 'unknown';
export type Wheelchair = 'yes' | 'partial' | 'no' | 'unknown';
export type CostLevel = 'free' | 'low' | 'paid' | 'unknown';
export type Status = 'active' | 'probably_active' | 'dormant' | 'defunct' | 'unknown';
export type Day = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export const DAYS: readonly Day[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export interface GroupLocation {
  label?: string;
  address?: string;
  neighborhood?: string;
  zip?: string;
  lat?: number;
  lng?: number;
  in_city: boolean;
  transit?: string;
  planning_district?: string;
}

export interface GroupAudience {
  /** public | students | members | parents | residents | invite */
  open_to: string;
  school?: string;
  min_age?: number;
  max_age?: number;
  community: string[];
  faith?: string;
  partisan: boolean;
  support_group: boolean;
}

export interface GroupSchedule {
  text?: string;
  days: string[];
  times: string[];
  recurring?: boolean;
  season?: string;
}

export interface GroupFirstStep {
  how?: string;
  drop_in?: boolean;
  sign_up_needed?: boolean;
  /** 1 to 5, only when a deep research pass exists */
  newcomer_friendliness?: number;
  /** full record only */
  basis?: string;
  what_to_expect?: string;
  first_visit_tips: string[];
}

export interface GroupContacts {
  website?: string;
  email?: string;
  phone?: string;
  contact_name?: string;
  social: string[];
  calendar_feed?: string;
}

export interface GroupSource {
  url: string;
  seen?: string;
  /** Field paths this source supports, for example "contacts.website" */
  fields: string[];
}

export interface Group {
  id: string;
  name: string;
  aka: string[];
  summary: string;
  what_you_do?: string;
  kind: string;
  categories: string[];
  interests: string[];
  motives: string[];
  formats: string[];
  roles: string[];
  crowd: string[];
  bridging: boolean;
  audience: GroupAudience;
  schedule: GroupSchedule;
  locations: GroupLocation[];
  online_ok: boolean;
  cost: { level: CostLevel; text?: string };
  commitment?: string;
  group_size?: string;
  access: { wheelchair: Wheelchair; languages: string[]; notes?: string };
  requirements: {
    act153_clearances: boolean;
    background_check: boolean;
    court_ordered_ok: Tri;
    service_hours_letter: Tri;
    kids_ok: boolean;
    gear?: string;
  };
  first_step: GroupFirstStep;
  contacts: GroupContacts;
  status: Status;
  last_sign_of_life?: string;
  sign_of_life_url?: string;
  sources: GroupSource[];
  research_tier: number;
  confidence?: string;
  last_checked?: string;
}

export interface GroupsFile {
  built: string;
  count: number;
  groups: Group[];
}

// Vocabulary, normalized from vocab.json (lib/vocab.ts).

export interface InterestTag {
  id: string;
  label: string;
}

export interface InterestFamily {
  id: string;
  label: string;
  /** emoji icon from the vocabulary */
  icon?: string;
  /** a line of examples, "hiking, caving, kayaking" */
  blurb?: string;
  tags: InterestTag[];
}

export interface District {
  id: string;
  label: string;
  region: string;
  regionLabel: string;
}

export interface Vocab {
  families: InterestFamily[];
  familyById: Map<string, InterestFamily>;
  tagLabels: Map<string, string>;
  districts: District[];
  /** id to label for each simple vocabulary: kinds, motives, formats, roles, audiences, ... */
  labels: Record<string, Map<string, string>>;
}

// Manifest

export interface CoverageRow {
  slice: string;
  found?: number;
  estimate?: number;
  low?: number;
  high?: number;
  note?: string;
}

export interface Manifest {
  built?: string;
  /** true when the data is the made up sample set shipped with the site */
  fixture: boolean;
  total?: number;
  byStatus: Record<string, number>;
  byTier: Record<string, number>;
  byCategory: Record<string, number>;
  byDistrict: Record<string, number>;
  tier0Unchecked?: number;
  coverage: CoverageRow[];
}

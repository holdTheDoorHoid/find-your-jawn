// Types for the matching engine. Pure data: no DOM, no network, no storage.
//
// Three kinds of thing live here:
//   Answers   what a visitor told the quiz (saved in their browser by the island, never sent anywhere)
//   Catalog   the vocabulary the engine reads (scenes, interest graph, ways in, places)
//   Results   what the engine hands back (ranked groups with reasons)

import type { Group } from '../lib/types';

// ---------------------------------------------------------------- answers

export type Dial = 'gentle' | 'balanced' | 'bold';
export type PathId = 'explore' | 'hours' | 'court' | 'newcomer' | 'student' | 'kids' | 'support';
export type TravelMode = 'walk' | 'septa' | 'drive' | 'anywhere';
export type Budget = 'free' | 'low' | 'any';
export type Frequency = 'once' | 'monthly' | 'weekly' | 'any';
export type FaithMode = 'include' | 'exclude' | 'only';
export type MeetWith = 'similar' | 'different' | 'mix';
export type GroupSizePref = 'small' | 'medium' | 'large' | 'any';
export type Reaction = 'into' | 'maybe' | 'not';
/** Why a card was not for the person. `already` and `cost` are only offered in some places. */
export type NotWhy = 'far' | 'time' | 'not_my_thing' | 'intense' | 'crowded' | 'cost' | 'already';
export type FollowId = 'setting' | 'competition' | 'online' | 'cadence' | 'kids_along';

export interface Locked<T> {
  value: T;
  /** locked means never show anything that breaks it; unlocked means prefer */
  locked: boolean;
}

export interface Answers {
  v: 1;

  // The start screen and the paths (DESIGN section 6)
  paths: PathId[];
  hours?: { need?: number; form?: boolean };
  court?: { need?: number; noChildren?: boolean };
  kidsAges?: number[];
  /** how long in Philly */
  newSince?: 'weeks' | 'months' | 'year' | 'years';
  school?: string;
  /** Set by anything that asks for support groups. The quiz itself sends that person to /support/. */
  includeSupport?: boolean;

  // Stage 1: picture it
  scenes: string[];
  moments: string[];
  /** words of the visitor's own, matched to interest names */
  words?: string;

  // Stage 2: deal breakers (each with a lock)
  when?: { days: string[]; times: string[]; flexible: boolean; locked: boolean };
  often?: Locked<Frequency>;
  place?: { hood?: string; zip?: string };
  far?: { mode: TravelMode; minutes: number; locked: boolean };
  budget?: Locked<Budget>;
  /** a closed range of ages, for example 18 to 24. The filters use the whole range. */
  age?: { lo: number; hi: number };
  wheelchair?: Locked<boolean>;
  languages?: { codes: string[]; locked: boolean };
  faith?: { mode: FaithMode; tradition?: string };
  /** "I'd rather avoid roles that need a background check" */
  noBackgroundCheck?: Locked<boolean>;

  // Stage 3: what you are into (family ids, then tag ids inside the starred families)
  picked: string[];
  starred: string[];
  tags: string[];

  // Stage 4: why and who
  motives?: { m1?: string; l1?: string; m2?: string; l2?: string };
  meet?: { with: MeetWith; sameAge?: boolean; communities: string[] };
  /** 1 (exciting) to 5 (really hard) */
  strangers?: number;
  bringSomeone?: boolean;
  size?: GroupSizePref;
  /** 1 to 5 agreement with "I like trying things I've never done" */
  newness?: number;
  lastNew?: 'great' | 'ok' | 'hard';

  // Stage 5: future self
  future: string[];

  // Stage 6 and 7
  taste: Record<string, { r: Reaction; why?: NotWhy; probe?: boolean }>;
  follow: Partial<Record<FollowId, string>>;

  // Results
  dial: Dial;
  notForMe: { id: string; why?: NotWhy }[];
  /** Deal breakers the visitor chose to loosen after an honest empty state. They count as wishes, not locks. */
  loose?: BlockerKey[];
}

export function emptyAnswers(): Answers {
  return {
    v: 1,
    paths: [],
    scenes: [],
    moments: [],
    picked: [],
    starred: [],
    tags: [],
    future: [],
    taste: {},
    follow: {},
    dial: 'balanced',
    notForMe: [],
  };
}

// ---------------------------------------------------------------- catalog (vocabulary)

export type EdgeType = 'same_skill' | 'same_crowd' | 'same_place' | 'same_cause' | 'same_topic';
export type WayId = 'do_it' | 'learn_it' | 'teach_it' | 'serve_it' | 'lead_it';

export interface SceneDef {
  id: string;
  text: string;
  icon: string;
  interests: Record<string, number>;
  roles: string[];
  formats: string[];
}

export interface FutureDef {
  id: string;
  text: string;
  icon: string;
  because: string;
  interests: Record<string, number>;
  roles: string[];
  formats: string[];
  ways: string[];
}

export interface LabelDef {
  id: string;
  label: string;
  icon?: string;
  description?: string;
}

export interface FamilyDef {
  id: string;
  label: string;
  icon?: string;
  blurb?: string;
  supportOnly?: boolean;
  tags: { id: string; label: string }[];
}

export interface WayExample {
  tags: string[];
  example: string;
}

export interface PlaceDef {
  id: string;
  label: string;
  district: string;
}

/** The vocabulary the engine reads, in a plain shape that can be serialized into the page. */
export interface CatalogData {
  families: FamilyDef[];
  /** [from, to, type] */
  edges: [string, string, EdgeType][];
  scenes: SceneDef[];
  extraScenes: SceneDef[];
  moments: SceneDef[];
  futureSelves: FutureDef[];
  motives: LabelDef[];
  roles: LabelDef[];
  formats: LabelDef[];
  ways: LabelDef[];
  waysByFamily: Record<string, Partial<Record<WayId, WayExample>>>;
  neighborhoods: PlaceDef[];
  /** communities a visitor may want to find (LGBTQ+, veterans, ...), for the "who to meet" answer */
  communities?: LabelDef[];
}

// ---------------------------------------------------------------- results

export type StretchType = 'topic' | 'way' | 'crowd' | 'depth';
export type ResultKind = 'close' | 'stretch' | 'wildcard';

/** Which of the four things a group changes about what the person told us. */
export interface Axes {
  topic: boolean;
  way: boolean;
  crowd: boolean;
  depth: boolean;
}

/** The parts of the score, each from 0 to 1. */
export interface Parts {
  interest: number;
  motive: number;
  roleFormat: number;
  practical: number;
  taste: number;
  newcomer: number;
  regular: number;
  confidence: number;
}

export type PartName = keyof Parts;

/** Things we could not check, shown on the card so nobody is surprised. */
export type NoteKey =
  | 'cost'
  | 'schedule'
  | 'distance'
  | 'access'
  | 'access_partial'
  | 'school'
  | 'languages'
  | 'background'
  | 'frequency'
  | 'hours_form'
  | 'kids'
  | 'residents'
  | 'faith'
  | 'newcomer';

export interface Result {
  group: Group;
  kind: ResultKind;
  stretch?: StretchType;
  score: number;
  parts: Parts;
  /** two or three short reasons in the person's own terms */
  why: string[];
  /** only for stretches and the wildcard: the sentence that says what changes and what stays */
  stretchLine?: string;
  /** what is not listed or not known, in plain words */
  notes: string[];
  noteKeys: NoteKey[];
  firstStep: string;
  /** estimated minutes from the person's starting point, when both are known */
  minutes?: number;
  travelMode?: TravelMode;
}

export interface Blocker {
  key: BlockerKey;
  /** groups that would come back if this one answer were loosened */
  count: number;
}

export type BlockerKey =
  | 'age'
  | 'budget'
  | 'when'
  | 'often'
  | 'far'
  | 'wheelchair'
  | 'languages'
  | 'faith'
  | 'background'
  | 'path'
  | 'form'
  | 'kids'
  | 'newcomer'
  | 'open_to'
  | 'online';

export interface Diagnosis {
  /** groups considered after the basic checks (alive, public, not support) */
  pool: number;
  /** groups that passed every check */
  passed: number;
  /** the locked answers doing the blocking, biggest first */
  blockers: Blocker[];
}

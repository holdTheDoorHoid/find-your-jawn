// The matching engine's public face. Pure TypeScript: no DOM, no network, no storage.
// See README.md in this folder for how the pieces fit.

export * from './types';
export { buildCatalog, familyLabel, tagName, isKnownZip, neighborhoodCenter, zipCenter, type Catalog } from './catalog';
export { sanitizeAnswers } from './answers';
export { computeResults, moreResults, replacementFor, DIAL, DEFAULT_COUNT, VARIETY_CAP, type Outcome, type ComputeOptions } from './select';
export { pickTasteCards, pickFollowUps, FOLLOW_OPTIONS, type TasteCard, type FollowPick } from './taste';
export { WEIGHTS, NEWCOMER_WEIGHT_HARD, UNKNOWN_PENALTY } from './score';
export { loosen, LOOSENABLE } from './filters';
export { axesOf, onlyAxis } from './stretch';
export { straightLineTravel, type TravelModel } from './travel';

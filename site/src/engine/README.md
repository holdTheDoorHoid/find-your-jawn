# Matching engine (reserved)

This folder is empty on purpose. The quiz agent puts the matching engine here, as pure TypeScript
with its own tests (DESIGN section 3, 4 and 12).

What the site shell already gives it:

- `../lib/types.ts`: the `Group` record, normalized, with lists always present. Feed it the output
  of `normalizeGroupsFile` (`../lib/normalize.ts`). Never read raw JSON in the engine.
- `../lib/vocab.ts`: `normalizeVocab(raw)` turns `vocab.json` into `Vocab` (families with icons,
  tag labels, districts and regions, simple label maps). The shape inside each vocabulary file is the
  vocabulary agent's, so extend `normalizeVocab` there rather than parsing in the engine.
- `../lib/filters.ts`: `isBrowsable` (support groups and partisan groups out), `timesMatch`,
  `languagesInUse`. Reuse them so browse and the quiz agree on what "open to the public" and
  "support group" mean.
- `../lib/paths.ts`: the guide page rules (court ordered needs a sourced yes, service hours, families,
  new to Philly). The quiz path rules in DESIGN section 6 should call these, not copy them.
- `../lib/badges.ts`: `groupBadges` for result cards, and `../components/GroupCard.tsx` for the card.
- `../lib/saved.ts` and `../lib/storage.ts`: "Save" on a result card is `toggleSaved(store, id)`.
  Quiz answers should use `store.setJSON('quiz', ...)` so every key starts with `fyj:` and the
  "Forget everything" button clears them without any new code.
- `../strings/en.ts`: add quiz text as a new named export (`export const quiz = {...}`), and keep the
  no dashes rule. `strings.test.ts` checks it.

Rules this folder must keep: no DOM, no network, no storage access inside the engine. The island
passes it groups, vocab and answers, and it returns ranked results with reasons.

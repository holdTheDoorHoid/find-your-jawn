# Wave w4-tier1-cultural-fund, third and final pass (2026-10-08, nightly runner)

Eight Haiku agents on the 94 Cultural Fund groups still unchecked, in batches of 12 (the last one 10).
Following the note from the second pass, only four ran at a time, and a new one started as each
finished. No rate limiting this time. The `fyj-researcher` agent type was not listed in this session,
so the agents ran as general purpose agents on Haiku, as the runner allows. About 14 searches used in
all, out of 16 allowed.

## Import and checks

- 94 records in, 83 merged into existing Cultural Fund groups, no new groups.
- 11 held because the group's site gave too little to write a record (no summary, interests or
  categories). They stay unchecked and can be retried by w19 or a later pass.
- Verdicts: publish 87, not a group 7 (Junk, Indonesian Lantern Media LLC, Kosoko Performance Studio,
  Lightning Rod Special, Private Theater, Very Good Dance Theatre, Weirdo LLC: businesses, solo
  artists' studios or venues). 29 small slips repaired automatically.
- Statuses: active 23, probably active 33, dormant 4, unknown 30.
- `fyj check`: 1183 groups pass, 0 held back (up from 1107). Pipeline tests 364 passed, site tests
  518 passed, site build 1227 pages.
- Kinds added: mostly theater and dance, visual arts and crafts, music, then cultural heritage
  groups, youth arts programs and history groups.

## Spot check

- Batikh Batikh: a free pop up cinema and gallery for SWANA women and queer artists. The site works
  and shows no dates, so probably active is right under the rules. Summary fair.
- The German Society of Pennsylvania: 611 Spring Garden Street, language classes, library, monthly
  events. Newest dated item is the November 2025 gala, under 12 months old, so active holds. Summary
  fair.
- Theatre in the X: a free West Philadelphia theater company, founded 2013. The site works and shows
  no dates, so probably active is right. Summary fair.

Result: 3 of 3 correct. Wave passes.

## Blocked

Philadelphia Chamber Music Society, SAADA, Art Sphere, Brandywine Workshop and Cliveden (all 403);
Black Music Preservation (404); Cardell Dance Projects (certificate mismatch); Fire Museum Presents,
Public Trust and Bobby Zankel (pages would not load); philly2cents (staff preview page only).

## Leads only

21 names appended to `research/leads_only.jsonl` for w19, among them Solar Myth, PhillyCAM, Philly
Queer Book Club, Colectiva Clara, Asian Americans United, Urban Movement Arts and The Rebellion Circus.

## Surprises and notes

- The batch had a typo in two websites: The Colored Girls Museum (`musem`) and West Park Cultural
  (`westparkcutural.org`). Agents read the corrected domains. The source lead data still has the
  typos.
- Rebel Arts Movement's record came from a search result, not its own site; only name and category.
- The importer wrote this pass's held files over last night's files of the same name (cf-02, cf-03,
  cf-07). The earlier versions are still in git history.
- Wave marked done. The Cultural Fund list is finished apart from the 11 thin records.

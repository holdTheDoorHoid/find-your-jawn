# Evening research push (2026-10-08, from about 5:45 pm)

The owner asked for many Haiku research agents in parallel until told to stop, past the launch week
stop line of 20 percent. The orchestrator (this session) ran 12 to 18 Haiku agents at a time,
imported and published about every half hour, and spot checked three new records per import.

## What ran

- w20a, w20b, w20c: IRS groups that typed a website on their e-postcard. w20a (joinable NTEE codes,
  28 batches) finished. w20b (no NTEE code) paused after batch 15: about 1 usable group per 15, and
  555 Questers chapter filings plus 4 batches of one sorority's chapter filings were removed. w20c
  (other NTEE codes) running batch by batch.
- w21: first visit guides (tier 2) for active public groups with a website, 7 groups per batch.
- w3-interests-e: second sweep of thin interest families (games, food, animals, making, outdoors,
  science). Useful but costly in searches: about 7 to 13 groups per agent.
- Lists (brief lists.md): the best yield. William Way groups, Neighborhood Gardens Trust and
  Philadelphia Orchard Project (66), CultureWorks projects (47), Philadelphia Youth Sports
  Collaborative (74), food access, co-ops, bookstores and yarn shops, bike, run and climb meetups,
  Friends Center and Bok tenants, CDCs, Urban Affairs Coalition.
- w13 congregations (labeled, filterable): Quaker meetings, Catholic parishes, Episcopal and
  Lutheran, Presbyterian, Methodist and UCC, synagogues, mosques and Buddhist centers, historic
  Black churches, plus a leads follow up.
- w18 support groups (shown only when a visitor asks): recovery, grief, caregivers, mental health,
  illness, new parents, LGBTQ.
- w19a, w19c leads follow up: low yield (about 1 in 15), stopped.
- w10 districts: the eight thinnest districts swept; 0 to 2 groups each, because the Northeast
  Times and Free Library branch pages block us and most civic groups there have no site. Waves
  w10-districts-2 and 3 are held; those areas need local tips.

## Quality

Spot checks on every import: two errors found and fixed by the orchestrator (a 2020 date moved to
2026; a land trust placed in Pennypack Park when its preserve is in Huntingdon Valley). 19 IRS records
whose summaries described the research instead of the group were hidden, and the tier 1 brief now
tells agents to leave the summary out in that case. A rule against moving dates to another year was
added to _common.md. Haiku agents sometimes call stray tools (browser, docs, spawn_task); the prompts
now forbid them by name and none caused a side effect.

## For the owner

- Thin areas that need local tips: Northeast Philadelphia districts, Lower Southwest.
- Judgment calls flagged by agents: one school Home and School associations published for parents;
  Federation giving circles published with newcomer rating 2; Reclaim Philadelphia hidden as partisan.
- City registry dates used as a sign of life for RCOs: a fix is suggested as a separate task.

## Later evening (about 8:10 pm to 9:05 pm)

- w23: first visit guides for the 771 groups published earlier in the evening, 111 batches of 7,
  all run and imported. Nearly every group got a guide; a few were marked out of area (an online
  study group with a Vermont address, a children's theatre in Montgomery County, a regatta held in
  New Jersey) or merged as duplicates.
- w24: list pages for the thinnest interest families, 14 agents. About 170 records: 37 new groups,
  the rest confirmations and upgrades of groups we already had. Best: older adult centers and aging
  in place villages (30), running and cycling (29), rowing, paddling and sailing (26), making and
  tech (17). Weakest: games (2), because most club pages blocked us.
- The importer now turns a neighborhood name into its code (Old City becomes old_city) and drops
  names it does not know, instead of holding the whole record. Three records were held for this
  before the fix and were put back in by hand.
- Imports now move only finished files into a staging folder, so agents still writing never see
  their file vanish.
- A scripted website check (fyj liveness, polite, no AI cost) started on the 1599 unpublished IRS
  groups that list a website; results feed the next IRS wave (w25 in the queue).
- Spot checks: 3 of 3 correct on every import in this stretch (about 20 records checked).
- Owner said to pause at about 8:55 pm. No new agents after that; running ones finished and were
  imported.

At the pause: 2,422 groups live (1,201 at the start of the evening), 1,373 of them with a first
visit guide. Weekly usage meter 39 percent (24 at the start of the evening push).

## Next, when the owner wants more

- w26-tier2-deep-d: guides for 367 published groups that still lack one (ids file is ready).
- w25: tier 1 checks for the IRS groups whose websites the liveness pass finds alive and current.
- Follow ups named in the w24 files: games clubs, Chinatown and Italian heritage parades, walking
  groups for older adults, Free Library pages (blocked).

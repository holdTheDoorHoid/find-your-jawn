# Wave log: w1b-tier1-redo and w3-interests-b (2026-10-08)

First run of the nightly scheduled runner. Both waves ran together because they fit the search budget
(1 agent x 5 searches plus 7 agents x 10 searches, 75 at most).

## Budget gate

- Account weekly usage at start: 10 percent (limit to skip: 60). Five hour usage: 36 percent (limit: 50).
- Find Your Jawn spend this week before the run: 5 percent of the 20 percent launch week cap.
- After the run: 11 percent weekly. The meter is account wide and also counted a separate Quizzo
  research session that was working at the same time, so this run cost about 1 percent or less.

## Agents

Eight Haiku agents (general purpose with model haiku; the fyj-researcher type was not listed in this
session). Every agent wrote its file; no retries were needed.

| Agent | Records | Leads only | Blocked | Searches |
|---|---|---|---|---|
| redo-01 (w1b) | 14 | 3 | 2 | 5 of 5 |
| g-arts-crafts | 14 | 6 | 8 | 10 of 10 |
| g-making-tech | 7 | 5 | 0 | 9 of 10 |
| g-outdoors-adventure | 8 | 11 | 2 | 9 of 10 |
| g-water-rowing | 15 | 10 | 10 | 8 of 10 |
| g-food-drink | 3 | 17 | 3 | 9 of 10 |
| g-animals | 11 | 14 | 5 | 9 of 10 |
| g-culture-language-heritage-groups | 4 | 24 | 2 | 10 of 10 |

Searches used: 69 of 75.

## Import

- w1b-tier1-redo: 14 records in, all merged into existing groups (verdict publish 14). Every record
  now has a dated source. 11 of the 14 are still status unknown with low confidence (no group page
  found), which is honest for small park Friends groups.
- w3-interests-b: 62 records in. 31 merged into existing groups, 31 new groups. Verdicts: publish 58,
  not a group 3 (two riding stables that are businesses, one paid supper club), out of area 1
  (Outdoor Club of South Jersey). Nothing held for repair. 14 small slips repaired automatically
  (mostly a missing sign of life link filled from the cited site, one status lowered from active to
  probably active because the date did not support it). Details in `research/held/w3-interests-b/_warnings.json`.

## Checks

- `fyj check`: 940 groups pass, 0 held back.
- Pipeline tests: 282 passed. Site tests: 496 passed. Site build: 983 pages.
- Groups live after this run: 940.

## Spot check (three new records at random)

- Outlaw Arts (clay studio, Mount Airy): group exists, beginner courses and membership confirmed,
  newest dated item on the page is from 2025, so probably active is fair. Summary is in our own words.
- The Friendly Sons and Daughters of St. Patrick: the cited page is the February 2026 quarterly
  meeting; founding year, music and speaker confirmed. Active is supported. Summary fair.
- Philadelphia Trail Club: hiking club since 1931, non members can join public hikes, board roster
  for 2025 to 2026. Probably active is fair. Summary fair.

Result: 3 of 3 correct. Wave passes.

## Blocked sources

32 blocked or unreachable addresses in all. The ones that matter most:
- Free Library calendar and blog pages (HTTP 403), again. This hides library run clubs (photo club,
  English conversation, Deaf gatherings, the South Philadelphia chess club schedule).
- Delaware Valley Ornithological Club (403), the area's largest birding club.
- Pegasus Therapeutic Riding Academy (TLS certificate mismatch), an adaptive riding program.
- Philadelphia City Rowing, Liberty Sailing Club and Philadelphia Sailing Club (403).
- Brandywine Workshop (403), Vetri Community Partnership teaching kitchen (403).

## Leads only

90 names appended to `research/leads_only.jsonl` for wave w19 (3 from w1b, 87 from w3-interests-b).
The culture and languages lane produced 24 leads but only 4 records; it ran out of searches.

## Surprises

- A separate session working in this same checkout committed tonight's raw agent files (in
  `research/done/`) as part of its Quizzo commit before this run committed. Nothing was lost; this
  run's group changes, queue update and logs are committed on top.
- Food and drink and culture and languages were the thinnest families. Both would do better with a
  second pass that starts from the leads list instead of fresh searches.

# Wave w3-interests-d (2026-10-08, nightly runner)

Lane G interest sweep, last of the four. Seven Haiku agents, one per family, 10 searches each.

| Agent | Records | Leads only | Blocked | Searches |
|---|---|---|---|---|
| g-neighborhood-civic | 5 | 18 | 6 | 10 of 10 |
| g-science-learning | 3 | 9 | 2 | 10 of 10 |
| g-careers-skills-professional | 25 | 6 | 2 | 10 of 10 |
| g-emergency-disaster | 3 | 1 | 3 | 9 of 10 |
| g-philly-traditions | 1 | 11 | 7 | 8 of 10 |
| g-faith-community | 7 | 23 | 3 | 10 of 10 |
| g-history-heritage-preservation | 12 | 5 | 1 | 9 of 10 |

Searches used: 66 of 70.

## Import and checks

- 56 records in: 19 merged into existing groups, 37 new. Verdicts: publish 52, hide 1 (the Holy Hot
  Dish meal at St. Michael's Lutheran, Germantown, defunct), not a group 1 (the Citizens Police
  Oversight Commission, a City body), out of area 2. Nothing held for repair; 17 small slips repaired
  automatically.
- `fyj check`: 1039 groups pass, 0 held back. Pipeline tests 364 passed, site tests 518 passed, site
  build 1083 pages.

## Spot check

- WINC Tradeswomen Readiness Program (Philadelphia Works): the page describes the program and links
  to applications; nothing on it is dated after 2024. Probably active (seen online, no date) is fair.
  Summary fair.
- First Unitarian Church of Philadelphia: 2125 Chestnut Street, a service dated October 6, 2026 and
  an upcoming Sunday service listed. Active is supported. Summary fair.
- P.O.W.E.R. Construction Pre-Apprenticeship (Trades for a Difference): seven week free program for
  PHA residents and Section 8 voucher holders, as the summary says. No dated item, so probably active
  (seen online, no date) is fair.

Result: 3 of 3 correct. Wave passes.

## Blocked sources worth a retry

SCORE Greater Philadelphia (403), Red Cross Southeastern Pennsylvania news (403), Free Library event
pages (403 again), Historical Society of Pennsylvania volunteer page (403), ODUNDE (503 on repeated
tries), Greek Independence Day Parade order on The National Herald (403). Several phila.gov service
URLs guessed by the civic agent returned 404. The civic agent reported that committeeof70.org did not
resolve; the correct domain is probably seventy.org, so Committee of Seventy belongs in w19.

## Leads only

73 names appended to `research/leads_only.jsonl`. No record says a group accepts court ordered hours.

## Thin spots

Neighborhood and civic life (mostly old evidence, many civic associations with no site of their own),
Philly traditions (festival sites down or gone) and emergency help came back thin. Careers and
history were strong. A district wave (w10) is the better route to civic associations and town watches.

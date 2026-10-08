# Wave w4-tier1-cultural-fund, second pass (2026-10-08, nightly runner)

Eight Haiku agents on batches 01 to 08 of the regenerated Cultural Fund list (166 groups left, 18 per
batch). Two searches each; 9 searches used in all, since nearly every group has its own website.

## What happened

About four minutes in, the fetch tool's safety check started rate limiting most domains for every
agent at once. Agents retried once and stopped as the brief says. The result was 131 records, of
which 59 came back with status unknown, mostly because the group's own site was never read. Many of
those carried placeholder summaries ("its website could not be checked").

Those 59 were taken out of the inbox before import and saved to
`research/held/w4-tier1-cultural-fund/rate-limited-unread.json`. The groups stay at tier 0, so
`--exclude-done` will pick them up again. Batch 09 was not launched once the rate limiting showed.

## Import and checks

- 72 records in, all merged into existing Cultural Fund groups. Verdicts: publish 68, not a group 4
  (All Around This World and Amber Art and Design, both businesses; East Falls Forward's Fallser
  Club, a venue; one more from batch 04). 20 small slips repaired automatically.
- `fyj check`: 1107 groups pass, 0 held back. Pipeline tests 364 passed, site tests 518 passed, site
  build 1151 pages.

## Spot check

- PRISM Quartet: concert listing for late October and a press post dated September 30, 2026. Active
  is supported. Summary fair.
- FringeArts: venue at 140 N. Columbus Boulevard, events dated October 8, 19 to 21 and 28, 2026.
  Active is supported. Summary fair.
- Cleaver Magazine: quarterly online literary magazine since 2013, Philadelphia based, essay dated
  September 30, 2026. Active is supported. Summary fair.

Result: 3 of 3 correct. Wave passes.

## Blocked

46 blocked or unreachable entries across the eight files, most of them the rate limit rather than a
site's own refusal. Real blocks: Philadelphia Chamber Music Society (403), SAADA (403), Cardell Dance
Projects (certificate mismatch), LensBright (expired certificate), Caribbean Community in
Philadelphia (404).

## Leads only

10 names appended to `research/leads_only.jsonl`.

## For next time

Run this wave with fewer agents at once (four) so the fetch limit is not hit, and retry the held file
first. Jazz Bridge holds its concerts in Cheltenham and Collingswood, outside the city; worth a look.

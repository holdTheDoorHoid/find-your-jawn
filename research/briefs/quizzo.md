# Brief: Quizzo nights guide

Philly calls bar trivia "quizzo". The owner decided (2026-10-08) that quiz nights get ONE guide page,
not group listings. Your job: a list of recurring WEEKLY quizzo nights in Philadelphia, each confirmed
from the venue's own page or the quiz host's own schedule.

Read `research/briefs/_common.md` for the hard rules (facts not text, never get around blocks, no
dashes as punctuation, write your file early, tools). Ignore its record format: this brief has its own.

## Method

1. WebFetch the Billy Penn guide: https://billypenn.com/2026/08/10/philly-quizzo-history-guide/ .
   It is a LEAD SOURCE: use it only to learn which venue hosts quizzo on which night and who hosts.
   Never copy its wording. Work only on the days your prompt assigns you.
2. For each venue night in your slice, confirm it from the venue's own site (events or calendar page)
   or the host company's own schedule page (many hosts publish a weekly schedule listing every bar
   they run; one such page can confirm many nights at once, so look for host schedule pages first).
   Instagram and Facebook cannot be read; a venue known only from social media stays unconfirmed.
3. Record facts only: venue name, street address and ZIP (venue's own page or host page), day, start
   time, host, cost (most are free), team size limits, age rule (most bars are 21 and over; say
   `unknown` unless stated), and one short line of notes in your own words if something is useful to
   a first timer (themed nights, prizes as bar tabs, walk ins welcome). No more than one sentence.
4. `status: "confirmed"` only when a venue or host page you fetched shows the night (dated or a
   standing weekly listing). Otherwise `status: "unconfirmed"` with the Billy Penn guide as the only
   source. Write every entry either way.

## Output

`/home/hoid/Desktop/find-your-jawn/research/inbox/guide-quizzo/<agent>.json`:

```json
{"wave": "guide-quizzo", "agent": "<agent>", "guide": "quizzo", "model": "haiku",
 "searches_used": 2, "fetches_used": 30,
 "entries": [
   {"venue": "Example Tavern", "address": "123 Example St", "zip": "19125", "neighborhood": "Fishtown",
    "day": "tue", "start": "20:00", "host": "Example Quizzo Co", "cost": "free", "cost_text": "Free to play",
    "team_size": "Up to 6 players", "age": "21_plus", "notes": "Themed rounds the first Tuesday of the month.",
    "status": "confirmed",
    "sources": [{"url": "https://examplequizzo.com/schedule", "seen": "2026-10-08", "fields": ["day", "start", "host", "address"]}],
    "last_checked": "2026-10-08"}
 ],
 "blocked": [], "notes": "how many nights in your slice, how many confirmed, which host schedule pages you used"}
```

Finish with three lines: entries written, confirmed count, searches used.

# Brief: University of Pennsylvania student clubs (lane B)

Your batch lists Penn student clubs from the Penn Clubs directory (lead ids start with
`penn_clubs:`; the part after the colon is the club code). For EACH club, in order:

1. WebFetch `https://pennclubs.com/api/clubs/<code>/?format=json` (the club's public directory entry,
   the same open endpoint our harvester uses). Read: description, how to get involved, whether it is
   accepting members, whether an application is required, its events with dates, its links.
   One more fetch of the club's own website is allowed if the entry links one.
2. Write a tier 1 record per `_common.md`:
   - `kind: student_org`, `audience.school: "penn"`.
   - `audience.open_to: "students"` unless the entry or the club's own site clearly says people
     outside Penn may join or attend (then `public`, and say what is open in `what_you_do`).
   - Summary and what_you_do in YOUR OWN WORDS. Never copy the club's description: rewrite it
     plainly, and keep it short.
   - Status: `active` only with a dated event or post within 12 months; a directory listing marked
     active with no dated item is `probably_active` (the listing is not dated activity).
   - `first_step.how`: how a Penn student joins (for example "Apply in the fall recruitment round
     through the Penn Clubs page" or "Come to a general meeting; no application"). Newcomer
     friendliness 2 when an application or audition is required, 3 when open to any student.
   - Categories and interests from the vocabulary that fit the club's activity (a cappella is
     `choir_singing`, consulting clubs are `careers-skills-professional`, cultural associations are
     `culture-language-heritage-groups`).
   - `match.group_id` is the batch `id`; `match.lead_ids` are the batch `lead_ids`.
3. A club whose entry is empty or marked INACTIVE: check its own site if the entry links one. If
   that site shows dated activity within the last 12 months (fall 2026 recruiting, a 2026 event),
   the club is active: write a full record. Only when nothing current is found, write a record with
   `status: "unknown"` and leave out summary, categories and interests, so it is held back. The
   directory's status field (UNDER REVIEW, PRELIMINARY, FULL, INACTIVE) is a registration state,
   not proof either way.

Never record a student's personal name, phone or personal email. A club email on the directory is
fine. Spend about the same effort on each club.

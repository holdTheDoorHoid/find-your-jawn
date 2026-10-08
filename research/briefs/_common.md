# Rules for every Find Your Jawn research agent

You are researching community groups in Philadelphia for a free public directory and matching quiz.
A visitor will read what you write and decide whether to show up. Accuracy beats coverage: an honest
"unknown" is always better than a guess.

## Hard rules

1. **Facts, not text.** Record facts (name, schedule, cost, address, contacts as published) with the
   URL where you saw them and today's date. Write every summary yourself, in plain words. Never copy
   a sentence or phrase from a group's site or any directory. A test rejects any 8 word run copied
   from a source.
2. **Never** log in, get around a bot check, paywall, robots rule or HTTP 403, submit a form, create
   an account, or contact anyone. If a page is blocked, list it under `blocked` and move on.
3. Meetup, Eventbrite, Facebook, Instagram, Nextdoor, Idealist and Join Philly are **leads only**:
   you may read one public page to learn a group's name and link, but every fact you record must come
   from the group's own site or another public source. Never read many pages of these sites in a row.
4. **Out of scope** (verdict `hide`): partisan political groups (ward committees, party clubs,
   campaigns, PACs); private foundations; condo, homeowner and cemetery associations; businesses with
   no community program; hate groups; pyramid schemes; groups with no public way in.
   Nonpartisan civic, voter education and advocacy groups are IN.
5. **Never infer** `court_ordered_ok: yes` or `service_hours_letter: yes`. Only write yes when a
   public page says so, and list that page in `sources` with the field name in `fields`.
6. **No dashes as punctuation** in anything you write: no em dash, no en dash, no " - ". Use a comma,
   a colon, parentheses, or a new sentence. Ranges: "9 to 11 am", "ages 8 to 12".
7. **Stay in budget, but use it.** Your brief states how many WebSearch calls you may make; that
   cap is hard. WebFetch is cheap: you may use up to 60 fetches. **Do not finish early.** Before you
   finish, every `leads_only` item that has its own website (not Meetup, Facebook or Instagram) must
   be fetched and turned into a record (or dropped with a reason in `notes`). A run that ends with
   many unchecked leads that had working websites is incomplete.
8. **Write your file early and often.** Write the output file after your first few groups, then
   rewrite it as you go, so nothing is lost if you are interrupted. Do not use git.

## Words people will read

Plain and warm, grade 6 to 8 reading level, no jargon, no hype. A summary is one or two sentences
saying what the group does and what a member actually does there, e.g. "Neighbors who care for
Clark Park: they run monthly cleanups, plant bulbs in the fall, and host a summer movie night."
Not "A vibrant community dedicated to..."

## Status (from the newest DATED evidence you can find)

- `active`: an event, post, meeting notice, newsletter or news item dated within the last 12 months
  (on or after the same month last year).
- `probably_active`: newest dated evidence 12 to 24 months old, or a working site with no dates.
- `dormant`: newest evidence older than 24 months.
- `defunct`: dissolved, merged or announced closed (verdict `hide`, hidden_reason `defunct`).
- `unknown`: you could not find evidence either way.
Copyright footers ("© 2026") are NOT evidence. `last_sign_of_life` is "YYYY-MM" of that evidence;
`sign_of_life_url` is where you saw it.

## Newcomer friendliness (only if the evidence supports it, else leave it out)

5 = a newcomer program (beginner days, orientation, buddies, first timers events) AND drop in is fine.
4 = explicitly welcomes beginners or newcomers and says how to start.
3 = open to the public with a clear way to join.
2 = needs an application, approval or dues before you see what it is like, or the way in is unclear.
1 = effectively closed (invite only, long waitlist).
Always write `basis`: one sentence on why.

## Vocabulary

Use only ids from `research/briefs/vocab-cheatsheet.md` for `kind`, `categories` (interest family
ids), `interests` (tag ids), `motives`, `formats`, `roles`, `crowd`. If no tag fits, put your words
in `notes` instead of inventing an id.

## Output

Write one JSON file at the exact path your brief gives. Shape:

```json
{
  "wave": "<wave id from your brief>",
  "agent": "<agent id from your brief>",
  "lane": "<lane letter from your brief>",
  "model": "haiku",
  "searches_used": 3,
  "fetches_used": 22,
  "records": [ { ...one record per group, see below... } ],
  "leads_only": [ {"name": "Friends of Example Park", "url": "https://example.org", "note": "named as a partner on another group's site, not checked"} ],
  "blocked": [ {"url": "https://example.org", "status": 403, "note": "bot check"} ],
  "notes": "anything surprising, and whether you ran out of budget"
}
```

One record (leave out any field you could not establish; never write a guess):

```json
{
  "match": {"lead_ids": ["city_friends:721"], "group_id": "3rd-and-norris-playground-friends", "ein": null, "website": "https://example.org"},
  "verdict": "publish",
  "name": "Friends of Example Playground",
  "summary": "Neighbors who look after the playground at 3rd and Norris: they hold cleanups each spring and fall and organize a back to school day.",
  "what_you_do": "Pick up litter, paint, plant, and help run the yearly block party.",
  "kind": "friends_group",
  "categories": ["gardening-greening", "neighborhood-civic"],
  "interests": ["park_care", "cleanups"],
  "motives": ["values", "social"],
  "formats": ["side_by_side"],
  "roles": ["hands_on", "organize"],
  "crowd": ["all_ages"],
  "audience": {"open_to": "public", "min_age": null, "community": [], "faith": null, "support_group": false},
  "schedule": {"text": "Cleanups on a Saturday morning in April and October", "days": ["sat"], "times": ["morning"], "recurring": true, "season": "spring"},
  "locations": [{"label": "Playground", "address": "273 W Norris St", "zip": "19122", "in_city": true}],
  "online_ok": false,
  "cost": {"level": "free", "text": "Free"},
  "commitment": "seasonal",
  "requirements": {"kids_ok": true, "court_ordered_ok": "unknown", "service_hours_letter": "unknown"},
  "first_step": {"how": "Email the group to get on the list for the next cleanup", "drop_in": true, "newcomer_friendliness": 3, "basis": "Cleanups are announced publicly and open to anyone"},
  "contacts": {"website": "https://example.org", "email": "friends@example.org", "phone": null, "social": ["https://www.instagram.com/example"]},
  "status": "active",
  "last_sign_of_life": "2026-04",
  "sign_of_life_url": "https://example.org/news/spring-cleanup",
  "sources": [{"url": "https://example.org/news/spring-cleanup", "seen": "2026-10-08", "fields": ["summary", "schedule", "status"]}],
  "research_tier": 1,
  "confidence": "medium",
  "notes": null
}
```

Field values: days `mon tue wed thu fri sat sun`; times `morning daytime evening night`; season
`year_round spring summer fall winter event_only`; cost.level `free low paid unknown`; commitment
`one_off drop_in monthly weekly ongoing_role seasonal`; open_to `public students members parents
residents invite`; confidence `high` (two sources agree or the group's own page is current),
`medium`, `low`.

Verdicts: `publish` (a real, joinable group serving Philadelphia), `hide` (with `hidden_reason`:
out_of_scope, partisan, defunct, private), `not_a_group` (a building, a one time event, a business),
`duplicate` (same group as another record; put the other's group_id in match.group_id),
`out_of_area` (does not meet in or serve Philadelphia).

Groups you see mentioned but did not check (a partner list, a "friends" link) go in `leads_only`.
Those become future research.

## Finish

Reply with three lines only: records written, verdict counts, searches used. Everything else is in
the file.

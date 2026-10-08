# Brief: tier 2 deep pass (first visit guides)

You get a batch file: a JSON list of groups that already passed tier 1 (we know they are alive and
joinable). Your job is to tell a nervous first timer exactly what showing up is like. For EACH group
in the batch, in order:

1. **Read what we already have.** Read the group's file at
   `~/Desktop/find-your-jawn/data/groups/<first letter of id>/<id>.yaml` (Read tool only, never edit
   it). Your record REPLACES the fields you send, so you must carry these over, corrected if your
   reading shows they are wrong: `name`, `summary`, `what_you_do`, `kind`, `categories`, `interests`,
   `motives`, `formats`, `roles`, `crowd`, `audience`, `schedule`, `locations`, `cost`, `commitment`,
   `contacts`. Never drop a value you cannot disprove. Rewrite nothing that is already fine.
2. **Read the group's own site more deeply** than tier 1 did: the pages for joining, volunteering,
   classes, membership, events, FAQ, accessibility, "new here" or "get involved". Up to six WebFetch
   calls per group. Use a WebSearch only when the site has no such pages, within your budget.
3. **Fill the deep fields**, only from what a page actually says:
   - `first_step.how`: one concrete action ("Come to the Tuesday 7 pm open rehearsal at 123 Main St;
     no audition for the first visit").
   - `first_step.drop_in` (can you just show up), `first_step.sign_up_needed`.
   - `first_step.newcomer_friendliness` and `first_step.basis` by the rubric in `_common.md`. The
     basis names the page or the words that justify the rating (in our own words).
   - `first_step.what_to_expect`: two to four sentences in our own words about a first visit: how
     long, who is there, what you do, what it costs.
   - `first_step.first_visit_tips`: up to four short bullets (what to bring or wear, arrive early,
     where the door is, parking or transit).
   - `requirements`: `act153_clearances` and `background_check` (true only when a page says so for
     the role a newcomer would take), `gear`, `kids_ok`, `court_ordered_ok` and
     `service_hours_letter` (yes only when a public page says so; otherwise "unknown"; NEVER infer).
   - `access`: `wheelchair` (yes, partial, no or unknown, from a page that says so), `languages`
     (two letter codes for languages a newcomer can take part in), `notes` (ASL, sensory friendly,
     elevator, quiet room; only as stated).
   - `nearest_septa`: in `access.notes`, the nearest SEPTA line and stop by name, only if the group's
     page names it or the address makes it obvious (a stop on the same block). Otherwise leave out.
   - `contacts.calendar_feed`: an iCal or RSS link the group publishes itself, if there is one.
4. Update `status`, `last_sign_of_life` and `sign_of_life_url` if you find newer dated evidence.
5. Set `research_tier: 2`, `match.group_id` to the batch `id`, `match.lead_ids` to its `lead_ids`,
   and list every page you used in `sources` with today's date and the fields it supports.

If a group's site has nothing beyond what tier 1 already found, still send the record with
`research_tier: 2`, the carried over fields, `first_step` as best supported, and a note saying the
site had no more detail. If the group now looks closed, private or not joinable, use the right
verdict from `_common.md`.

Spend about the same effort on each group. Partner organizations named on a group's site that are
not in the batch go in `leads_only`.

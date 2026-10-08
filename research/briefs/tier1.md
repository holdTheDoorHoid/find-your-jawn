# Brief: tier 1 check of known groups

You get a batch file: a JSON list of groups we already know about from official lists (City layers,
the Mummers lineup, the Cultural Fund, hand seeds). For EACH group in the batch, in order:

1. Find its own public page. Use `contacts.website` if given (WebFetch it). If there is none, one
   WebSearch for `"<name>" Philadelphia` is allowed, within your search budget. A Facebook or
   Instagram result counts only as a link to record in `contacts.social`; do not try to read it.
2. Find the newest DATED sign of life (events page, news, blog, newsletter, calendar). One or two
   more WebFetch calls on the same site at most.
3. Decide `status` and `verdict` by the rules in `_common.md`.
4. If it is joinable, fill what you can: summary, what_you_do, kind, categories, interests, motives,
   formats, roles, audience, schedule, cost, commitment, first_step.how (one concrete action:
   "Come to the second Saturday cleanup, 9 am, meet at the gate"), contacts as published, sources.
5. Put the group's batch `id` in `match.group_id` and its `lead_ids` in `match.lead_ids`.

Spend about the same effort on each group; do not go deep on one and skip the rest. If you cannot
find anything about a group, still write a record with `status: "unknown"`, `verdict: "publish"`,
`research_tier: 1`, `confidence: "low"` and a note, so we know it was tried.

Arts groups from the Cultural Fund: many are venues or companies whose public way in is attending,
taking a class, or volunteering (ushers, events). Say which in `what_you_do` and `first_step.how`.
A company with no class, membership, volunteer or community program is `not_a_group`.

Mummers clubs: record the division (comic, fancy, wench brigade, fancy brigade, string band) in
`interests` where a tag exists and in `notes`; most recruit members and some hold open rehearsals or
clubhouse events. The clubhouse address is the location.

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

Groups from the IRS lists (lead ids starting `irs_990n:` or `irs_bmf:`): the name is the legal name
in capitals or title case, and the `contacts.website` field was typed by the group on a tax form, so
it is sometimes an email address, a person's name or a dead domain. If it is not a web address,
treat the website as missing (record an email address in `contacts.email` only if it is clearly the
group's own) and use your one search. Many IRS groups are scholarship funds, family charities,
booster clubs for one school, alumni associations, building funds or groups with no public way in:
give those `verdict: "hide"` with `hidden_reason: "private"` (or `not_a_group` for a business or a
building) after one fetch, and move on. Spend your effort on the ones a newcomer could join, attend
or volunteer with. Use the group's everyday name in `name` (for example "Friends of Clark Park", not
"FRIENDS OF CLARK PARK INC"), and put the legal name in `notes` when it differs a lot.

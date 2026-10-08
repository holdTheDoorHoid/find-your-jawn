# Brief: follow up leads (lane K)

Earlier agents noticed these groups (on a partner list, a platform page, a news story) but did not
check them. Your input is a JSON list of leads: `name`, `url` (sometimes a Meetup, Facebook or
Instagram page, sometimes the group's own site, sometimes empty), the `wave` and `agent` that found
it, and sometimes a `note`.

For EACH lead, in order:

1. If `url` is the group's own site, WebFetch it. If it is a Meetup, Facebook, Instagram, Eventbrite
   or Idealist page, or empty, do not read it: use one WebSearch for `"<name>" Philadelphia` (within
   your budget) to find the group's own site or another public page about it. Do not guess domains.
2. Find the newest DATED sign of life (events page, news, newsletter, calendar). One or two more
   fetches on the same site at most.
3. Write a full tier 1 record per `_common.md`: `match.website` set to the group's own site,
   `match.lead_ids` empty, `research_tier: 1`.
4. If no page other than a platform exists, or your search budget is spent, skip the lead and say so
   in `notes` (do not write a record and do not put it back in `leads_only`).

A lead may turn out to be a business, a one time event, a building, a group outside Philadelphia,
or a partisan group: use the right verdict from `_common.md`. Spend about the same effort on each
lead. New partner groups you see along the way go in `leads_only` as usual.

# Brief: neighborhood sweep (lane F)

Your slice names one Philadelphia planning district and its neighborhoods. Find the community groups
that serve those neighborhoods, especially small ones with little online presence. Our directory is
thin here, so every real group you add helps people who live there.

Checklist, in this order (searches are limited, fetches are cheap):
1. **Neighborhood list pages first.** Spend your first searches on pages that list many local groups
   at once: a City Council district office's list of civic groups, a neighborhood newspaper's
   community calendar or "get involved" page (Northeast Times, Mayfair Times, Roxborough Review,
   Kensington Voice, WHYY and Billy Penn neighborhood stories), a CDC or civic association's partner
   list, a parish or library branch bulletin board page. WebFetch each list page you find.
2. Groups to look for: civic and neighborhood associations, town watches, park and playground
   Friends groups, community gardens, library branch Friends groups, rec center advisory councils and
   youth leagues, congregations with programs open to neighbors, cultural and hometown associations,
   senior clubs, mutual aid, block party and festival committees, and youth sports.
3. For each group, fetch its own page (do not guess domains) and write a full tier 1 record per
   `_common.md`, with `match.website` set and `match.lead_ids` empty. Put the neighborhood in
   `locations[].neighborhood` and an address where published.
4. A group seen only on Facebook or in a list, with no page of its own: write a record only if a
   public page (news story, Council list, partner site) shows it is active and how to take part
   (then `confidence: "low"`); otherwise put it in `leads_only`.

Aim for 20 to 40 checked records, spread across the district's neighborhoods. Do not worry about
groups we may already have; the importer merges duplicates by website and name. Partisan ward
committees and campaigns are out of scope.

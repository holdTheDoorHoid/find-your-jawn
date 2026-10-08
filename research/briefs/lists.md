# Brief: member lists, tenant lists and host calendars (lanes M, N, Q)

Networks, coalitions, fiscal sponsors and buildings that host many groups publish who they work
with: a coalition's member list, a fiscal sponsor's project directory, a community center's tenant
list or calendar of groups that meet there, an orchard or garden network's map. One such page names
10 to 100 groups, many of them small. Your slice names the list pages to start from.

Method, in this order (searches are scarce, fetches are cheap):
1. WebFetch each starting page your slice names. If a URL is wrong or moved, use one search to find
   the current page. If a page is blocked (403, login, bot check), record it in `blocked` and move on.
2. Collect every group on the list that a Philadelphia resident could join, attend or volunteer
   with. Skip businesses, funders, government offices, and groups outside Philadelphia that do not
   recruit city residents.
3. For each group, fetch its own site (the list usually links it; do not guess domains). One or two
   fetches per group: home page, then events, volunteer or join page. Write a full tier 1 record per
   `_common.md`, with `match.website` set and `match.lead_ids` empty. Put the list page in `sources`
   too, with `fields: ["lead"]`.
4. A group named on the list with no page of its own: write a record only if the list page itself
   or another public page shows it is active and how to take part (then `confidence: "low"`);
   otherwise put it in `leads_only` with a note.

Aim for 25 to 50 checked records. Work through the list in order and spend about the same effort on
each group, so small groups get the same attention as famous ones. Do not worry about groups we may
already have; the importer merges duplicates by website and name.

**Congregations** (lane R): `kind: congregation`, family `faith-community`, `audience.faith` set
(catholic, protestant, black_church, jewish, muslim, quaker and so on). Put the main worship time in
`schedule`, and in `what_you_do` the ways a newcomer or neighbor can take part: worship, community
meals, food pantries, service days, choirs, young adult or senior groups. A congregation whose site
shows nothing but worship is still a record (tag `worship_community`).

**Support groups** (lane U): `kind: support_group`, family `support-recovery`,
`audience.support_group: true`. These are shown only when a visitor asks, so accuracy matters more
than ever. For fellowships with many meetings (AA, NA, Al-Anon, SMART Recovery), write ONE record
for the local intergroup or service office with a link to its own meeting finder in `contacts`;
never copy meeting lists. Never record a person's name or private contact for a support group.

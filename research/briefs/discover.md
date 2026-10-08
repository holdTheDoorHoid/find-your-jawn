# Brief: interest sweep (lane G)

Your brief names one or two interest families and their tags. Find **every group serving
Philadelphia residents** that does these things: clubs, leagues, teams, classes that form a community,
volunteer programs, meetups, guilds, chapters. Include groups that meet just outside the city but
recruit city residents (say so in `locations[].in_city: false`). Skip one off events and businesses
without a community program.

Method, in this order (searches are scarce, fetches are cheap):
1. **Spend your first 2 or 3 searches on LIST pages**, not single groups: roundup articles ("best
   running clubs in Philadelphia", "where to play pickup soccer in Philly", "Philly book clubs to
   join"), from outlets like Philadelphia Magazine, The Philadelphia Inquirer, Billy Penn, PhillyVoice,
   Visit Philadelphia, Generocity, Philadelphia Citizen, neighborhood papers, plus directory pages
   (a league's list of teams, a shop's list of group rides, a city or nonprofit resource list). One
   good list page names 10 to 30 groups. WebFetch it and collect every group with its link.
2. Fetch the group links the list page gives you (do not guess domains; a domain that does not
   resolve is not worth a second guess). One or two fetches per group: home page, then the events or
   schedule page. Then write a full tier 1 record per `_common.md`. Leave `match.lead_ids` empty;
   set `match.website`.
3. Use remaining searches for gaps: neighborhoods (Fishtown, Germantown, South Philly, Northeast
   Philly, West Philly, Kensington, Manayunk) and communities (LGBTQ, Black, Latino, Asian American,
   seniors, teens, women, adaptive) that your list pages missed.
4. A group you could only see on Meetup, Facebook or a list, without its own page: put it in
   `leads_only` with the link, unless another public page (news, a partner site) confirms it is
   active, in which case write a record with `confidence: "low"`. A list article alone is a lead, not
   proof the group is alive: confirm from the group's own page or a dated post.

Aim for 20 to 40 checked records. Breadth matters: cover different neighborhoods, ages, price
levels and communities, not just the five most famous groups. Do not worry about groups we may
already have; the importer merges duplicates by website and name.

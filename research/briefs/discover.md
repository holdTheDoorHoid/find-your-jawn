# Brief: interest sweep (lane G)

Your brief names one or two interest families and their tags. Find **every group serving
Philadelphia residents** that does these things: clubs, leagues, teams, classes that form a community,
volunteer programs, meetups, guilds, chapters. Include groups that meet just outside the city but
recruit city residents (say so in `locations[].in_city: false`). Skip one off events and businesses
without a community program.

Method, in this order:
1. Start from the known directories and lists in your brief (WebFetch them). These cost no searches.
2. Then WebSearch, within your budget, with varied queries: `Philadelphia <activity> club`,
   `Philly <activity> group beginners`, `<activity> league Philadelphia`, neighborhood names
   (Fishtown, Germantown, South Philly, Northeast Philly, West Philly, Kensington, Manayunk), and
   communities (LGBTQ, Black, Latino, Asian American, seniors, teens, women, adaptive).
3. For each group found, WebFetch its own site once or twice to confirm it is alive and joinable, then
   write a full tier 1 record per `_common.md`. Leave `match.lead_ids` empty; set `match.website`.
4. A group you could only see on Meetup, Facebook or a list, without its own page: put it in
   `leads_only` with the link, unless another public page (news, a partner site) confirms it is
   active, in which case write a record with `confidence: "low"`.

Aim for 20 to 40 checked records. Breadth matters: cover different neighborhoods, ages, price
levels and communities, not just the five most famous groups. Do not worry about groups we may
already have; the importer merges duplicates by website and name.

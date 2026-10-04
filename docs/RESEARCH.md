# The research program

How we find every community group in Philadelphia, keep the list honest, and know how complete it is.
Read `CLAUDE.md` (research rules) and `docs/ETHICS.md` first. Formats are in `docs/DATA_MODEL.md`.

## 1. What counts as a group

A listing is a group or recurring program that a person can **join, attend or volunteer with
alongside other people, and come back to**. It can be big (a citywide nonprofit) or tiny (six
neighbors who clean a pocket park).

In scope: nonprofits that take volunteers; civic associations, town watches, block networks, advisory
councils; clubs and hobby groups; sports leagues and teams; student organizations; cultural, heritage
and hometown associations; parade clubs; faith communities' service programs and faith communities
themselves (labeled); mutual aid networks; support and recovery groups (flagged); paid activities
that are communities (a league, a class series, a running club at a shop), with cost shown.

Out of scope (`hidden: true` with a reason): partisan political groups (ward committees, party clubs,
campaigns, PACs); private foundations and grantmaking trusts; condo, homeowner and cemetery
associations; credit unions, insurance and pension funds; businesses with no community program; hate
groups, groups that promote violence, pyramid schemes; groups that exist only as a private chat with
no public way in.

## 2. Tiers

| Tier | Who does it | What it produces | Target cost |
|---|---|---|---|
| 0 Harvest | Scripts | Leads, merged into groups with name, kind, address, contacts | free |
| 1 Basic | Sonnet, 20 to 25 groups per agent | Alive or not, joinable or not, our summary, tags, cost, schedule if easy | about 5,000 to 8,000 tokens per group |
| 1c Classify | Sonnet, 50 groups per call, no web | Tags, motives and formats for leads that already carry a description (student groups, grantees) | about 1,000 tokens per group |
| 2 Deep | Sonnet, 6 to 8 groups per agent | First visit guide, newcomer rating with basis, requirements, access, languages | about 20,000 to 30,000 tokens per group |
| 3 Confirmed | The group, through a GitHub issue | Corrections and a "confirmed by the group" badge | free |

Scripts always go first. Before any agent touches a group, the sign of life checker has already tried
its website and recorded the result.

## 3. Lanes

Each lane is a different way of finding groups (A to K from the founding plan, L to U added the same
day for small and obscure groups). Independence between lanes matters, because coverage
is estimated from their overlap (section 6). Tested endpoints and gotchas are in
`docs/research/scouting/structured-sources.md` and `long-tail-sources.md`.

**A. Official lists (scripts).** Every City of Philadelphia volunteer program: the City's volunteer
portal (communityschools.galaxydigital.com, the Community Schools program's programs and open
opportunities) and a crawl of every department's volunteer pages on phila.gov (Parks and
Recreation, Power Up Tech Corps, Medical Reserve Corps, emergency volunteering, Philly Reading
Coaches, poll workers, block captains, Town Watch, Foster Grandparents and whatever else the crawl
finds). The old Mayor's Volunteer Portal (serve.volunteermatch.org) and volunteer.phila.gov no longer
resolve. City ArcGIS layers: registered community organizations (240), park
Friends groups (141), neighborhood advisory committees (24), community gardens, libraries, rec
centers, senior centers. IRS master file for Pennsylvania filtered to 191xx ZIPs (9,664 records).
IRS e-Postcard filers (organizations under $50,000; the best paper trail for tiny groups). ProPublica
for enrichment by EIN. The state charity registry only for spot checks.

**B. Campuses (scripts, then agents).** Penn Clubs API (479), Campus Labs Engage for Drexel (548) and
Community College (109). Still to locate: Temple, Jefferson, Saint Joseph's, La Salle, Holy Family,
Chestnut Hill College, Moore, Curtis, University of the Arts successors, Peirce, Villanova,
Swarthmore, Haverford (Bryn Mawr is login gated, skip). Also campus civic engagement centers' partner
lists (Netter, Lindy) and PHENND.

**C. Parades, festivals and days of service (agents, yearly).** Mummers lineup (official page, every
division), St. Patrick's (about 200 units), Puerto Rican Day, Lunar New Year, Odunde, Juneteenth,
Pride, Caribbean festival, Africatown, Pulaski, Columbus, Steuben, the July 4th parade (PDF roster),
Thanksgiving, neighborhood parades (Mayfair, Manayunk, Germantown). Love Your Park Week hosts (spring
and fall), Philly Spring Cleanup, National Night Out. Method: official rosters where they exist,
otherwise the yearly news recaps and photo essays, five years back (2021 to 2026). MLK Day of Service
lists need an account: skip.

**D. Funders (scripts and agents).** Philadelphia Cultural Fund grantee directory (322 now, plus past
years), Bread and Roses Community Fund, Leeway Foundation, PHS community garden network, the City
Council Activities Fund recipients, Philadelphia Foundation grantees, neighborhood foundations. Small
grant lists are the best single source of tiny groups with no web presence.

**E. Platforms, leads only (agents, human pace).** Meetup (group pages and search results read
individually; record name, topic and link; never bulk scrape), Join Philly (leads only, credit them),
Idealist organization pages, Nextdoor's public city page, Eventbrite organizer pages, GivePulse event
pages. Every platform lead is verified from the group's own pages or another source before tier 1.

**F. Neighborhood sweeps (agents).** One agent per planning district (18). Checklist per district:
civic associations and RCOs, town watches, park Friends and garden groups, library branch programs
and Friends groups, rec center advisory councils and leagues, congregations with service programs,
cultural and hometown associations, youth sports, senior centers, CDCs and main street groups,
neighborhood papers and newsletters, mutual aid.

**G. Interest sweeps (agents).** One agent per interest family (about 25, from
`data/vocab/interests.yaml`). Brief: "every group serving Philadelphia residents that does X",
including clubs that meet outside the city but recruit here (the Philly Grotto meets in Media).
Includes fraternal and veterans posts (IRS subsections 08, 10, 19), adaptive sports, deaf and blind
community groups, sober communities, language exchanges.

**H. Community media (agents).** Chestnut Hill Local, Germantown Info Hub (Resolve Philly), Kensington
Voice, Northeast Times, Philadelphia Tribune, Philadelphia Gay News, Al Día, Jewish Exponent, Grid,
Hidden City, Billy Penn, WHYY, Generocity, Philadelphia Citizen ("get involved" boxes). Tag and
archive pages, recent three years. South Philly Review returns 403: skip.

**I. Faith, mutual aid and immigrant groups (agents).** Interfaith Center of Greater Philadelphia,
food pantry networks (Philabundance and SHARE locators need a browser network trace), mutual aid hubs,
the City's commissions on African and Caribbean, Asian, and Latino affairs, Welcoming Center and
Nationalities Service Center partner lists, the Historical Society of Pennsylvania's directory of
African community resources.

**J. Libraries, rec centers, schools (agents with a real browser where needed).** Free Library
program calendar (the library site returns 403 to scripts; use its Eventbrite listings and search
results, or a browser capable agent, never a workaround), rec center program and league listings,
Philadelphia Home and School Council, School District volunteer programs.

**K. People.** GitHub issue forms (suggest a group, I run this group, bulletin board photo), partner
lists (Join Philly, PHENND, Code for Philly), and owner contributed bulletin board photos transcribed
by an agent.

**L. The web of groups (script).** Small groups link to each other: "our partners", "friends",
"resources" and footer links. For every group website we know (thousands from the IRS files and
harvests), fetch the home page and any partners or links page, collect outbound links to other
Philadelphia organizations, and queue the new ones as leads. Repeat on each new batch. This
snowball compounds: every group found points to more.

**M. Fiscal sponsors (scripts and agents).** Many tiny groups have no tax status of their own and
run as a "project" of a fiscal sponsor, so they never appear in IRS data. Sources: CultureTrust
Greater Philadelphia's project list (Blue Stoop is one), Fractured Atlas's sponsored project
directory filtered to Philadelphia, Open Collective collectives located in Philadelphia, and other
local sponsors found along the way.

**N. Host venues (agents).** Places that host many small groups list them on their calendars or
tenant directories: William Way LGBT Community Center (dozens of groups meet there), Friends Center
(a Quaker building full of small nonprofits), the Bok building, settlement houses and community
centers, food co-op newsletters and boards (Weavers Way, Mariposa), bookstores (book clubs), game
stores (game nights), yarn shops (knitting circles), bike and running shops (group rides and runs),
climbing gyms and makerspaces (affinity meetups).

**O. Government paper trails (scripts where possible).** Records that name clubs as a side effect:
Philadelphia polling places (many are in social clubs, legion posts and civic halls; OpenDataPhilly),
Pennsylvania Liquor Control Board club licenses (Mummers clubs, ethnic and rowing clubs, fraternal
lodges and veterans posts hold them; check for a downloadable list), City Council resolutions and
citations honoring community groups (Legistar, phila.legistar.com, which has a public API), small
games of chance licenses (check whether lists are public), Philadelphia Housing Authority resident
councils, Council district office lists of civic groups, and the City's special events permits if
published.

**P. National chapter and club finders (scripts or agents).** Filter each to Philadelphia: Divine
Nine graduate chapters and other service sororities and fraternities, Jack and Jill, The Links,
100 Black Men, Junior League, League of Women Voters, NAACP branches, Rotary, Lions, Kiwanis,
Optimist, Toastmasters, Elks, Moose, Masons and Prince Hall Masons, Knights of Columbus, Sons of
Italy, Ancient Order of Hibernians, VFW, American Legion, AMVETS, Scouting (BeAScout) and Girl
Scouts, 4-H, Sierra Club, Audubon, AMC, Trout Unlimited, Habitat for Humanity, barbershop and Sweet
Adelines choruses, quilting, sewing and weaving guilds, Urban Sketchers, NMRA model railroad
divisions, the Society for Creative Anachronism's local barony, mycological and bird clubs, sports
governing bodies' club finders (youth soccer, Little League, rugby, ultimate, masters swimming,
fencing, table tennis, pickleball, roller derby, cycling, the Road Runners Club of America), and
disability community chapters (National Federation of the Blind, Hearing Loss Association, deaf
clubs, Special Olympics).

**Q. Coalition and network member lists (agents).** Networks publish their members: Philadelphia
Orchard Project's orchard partners, Neighborhood Gardens Trust gardens, PHS Tree Tenders groups,
Philadelphia Youth Sports Collaborative members, Police Athletic League centers, Theatre Philadelphia
and Greater Philadelphia Cultural Alliance members, the Philadelphia Folklore Project's folk arts
groups, Philadelphia Association of CDCs, food access coalitions, mutual aid and community fridge
maps, out of school time provider lists.

**R. Congregations (scripts and agents).** Denominational directories are complete and structured:
the Archdiocese's parish finder, Philadelphia Yearly Meeting (Quaker meetings), the Episcopal Diocese,
the Presbytery, Lutheran and Methodist conferences, the Jewish Federation's synagogue list, Black
clergy associations, mosque and temple lists through the Interfaith Center. Parish bulletins posted
online (many Catholic parishes publish weekly bulletins on parishesonline.com) list ministries,
senior clubs, sports leagues and groups open to the community.

**S. Open data about places (scripts).** OpenStreetMap (Geofabrik extract; places tagged as clubs,
community centers, associations, sports clubs, places of worship) and Wikidata (organizations based
in Philadelphia, good for older clubs and societies).

**T. Events that tiny groups run (agents).** Charity 5Ks and walks on race listing sites (many small
groups run one race a year), giving day participant lists, community fairs and activities fairs
(Join Philly's activities fair exhibitors as leads; campus club fair maps), and newsletter archives
(PHENND's weekly newsletter, Council members' district newsletters, civic association newsletters).

**U. Support groups (agents; shown only on request).** PA 211 (the regional services directory),
hospital support group calendars (Penn Medicine, Jefferson, Temple Health), NAMI Philadelphia, the
southeastern Pennsylvania AA intergroup and other recovery fellowships, grief, caregiver and illness
specific group finders. Link to meeting finders rather than copying meeting lists.

**Campus workaround.** Where a school's robots rules block its club directory API (Drexel, Community
College), use what the school publishes for people: club fair maps and programs, student government
lists of recognized organizations and budget allocations, and individual club pages where robots
rules allow.

**Snowball every contact.** The "I run this group" and "Suggest a group" forms ask which other groups
we should know about, and tier 2 research records partner organizations named on each group's site.

## 4. Waves

A wave is a small batch of agents with one purpose. Rules:

- Eight agents or fewer per wave, each with a stated WebSearch budget (usually 15 to 20). WebSearch is
  capped at about 200 calls per session, shared by everything running, so search heavy waves run one
  after another. Prefer WebFetch on known URLs and scripts for structured pages.
- Model: Sonnet for research. Opus only for engineering.
- Each wave has a brief in `research/briefs/<wave>.md` and ends with a log in
  `research/waves/<date>-<wave>.md`: agents, tokens, searches, candidates found, new versus already
  known, blocked sources, and anything surprising.
- Every wave ends at a pause point. The orchestrator reports to the owner before the next wave.

Planned order: phase 1 (C, D, B remainder, 1c classification, tier 1 on the official list), phase 2
(F in three waves of six districts, G in four waves, then H, I, J, E), gap waves until saturation,
then phase 3 deep research.

## 5. Agent output and import

Discovery agents write JSON to `research/inbox/<wave>/<agent>.json`:

```json
{
  "wave": "f1-districts", "agent": "f1-south", "lane": "F",
  "slice": {"planning_district": "South", "family": null},
  "searches_used": 17,
  "candidates": [
    {
      "name": "Friends of Wharton Square",
      "website": null,
      "other_urls": ["https://example.org/post"],
      "address": null, "zip": "19146", "neighborhood": "Point Breeze",
      "kind_hint": "friends_group",
      "interests_hint": ["gardening", "parks"],
      "evidence": [{"url": "https://example.org/post", "date": "2026-05", "note": "spring cleanup notice"}],
      "last_sign_of_life": "2026-05",
      "open_to_public_hint": true,
      "notes": "Found through the Love Your Park host list"
    }
  ],
  "blocked": [{"url": "https://southphillyreview.com", "status": 403}],
  "leads_for_other_slices": []
}
```

`fyj import-inbox <wave>` turns these into leads with source `lane_<letter>`, then the merge step
matches them to existing groups (by EIN, website domain, normalized name plus ZIP; ambiguous pairs go
to a small judging pass). Tier 1 and tier 2 agents write per group JSON with the fields of
DATA_MODEL section 3 plus a `sources` list; `fyj import-research` merges them into group files under
a file lock.

## 6. How complete are we?

Groups are counted in slices: interest family by region (Center City, North, Northeast, Northwest,
South, West and Southwest), about 150 slices. For two independent lanes that each searched a slice,
with n1 and n2 groups found and m found by both, the estimated total is the Chapman estimator:

    N = (n1 + 1)(n2 + 1) / (m + 1) - 1

With three or more lanes we use all pairs and, once there is enough data, a log linear model. The
estimate is a floor: groups that are hard to find are hard for every lane. `fyj coverage` writes
`research/coverage/<date>.json` and the site's "How complete is this?" page. The next gap wave goes to
the slices with the lowest found over estimated ratio. A slice is saturated when a fresh sweep adds
fewer than 5 percent new groups.

## 7. Tier 1 and tier 2 checklists

**Tier 1 (basic):** find the website or main public page; record the newest dated sign of life and
its URL; decide status by the rules in DATA_MODEL; decide whether the public can join and how; write a
one or two sentence summary in our own words; assign kind, interest families and tags, motives,
formats; cost level; schedule if stated; commitment; minimum age and kids if stated; languages if
stated; contacts as published; sources with dates. Confidence high only when two sources agree or the
group's own page is current.

**Tier 2 (deep):** the first step (one concrete action), whether you can just show up, what a first
visit is like, first visit tips, newcomer friendliness with a basis, requirements (clearances,
background check, court ordered hours, service hour sign off, gear), access (wheelchair, languages,
ASL, sensory), nearest SEPTA stop, calendar feed if the group publishes one.

**Newcomer friendliness rubric:**

| Rating | Meaning |
|---|---|
| 5 | Describes a newcomer program: beginner days, orientation, buddies, "first timers welcome" events, and drop in is fine |
| 4 | Explicitly welcomes beginners or newcomers and says how to start |
| 3 | Open to the public with a clear way to join, nothing newcomer specific |
| 2 | Joining needs an application, approval or dues before you can see what it is like, or the way in is unclear |
| 1 | Effectively closed (invite only, long waitlist); hidden from quiz results |

**Court ordered hours:** `yes` only when a public page from the group, the court, or a referral list
says the group accepts court ordered community service. Otherwise `unknown`. Never infer.

## 8. Keeping it alive

- Weekly GitHub Action: a rolling slice of websites (status, redirects, newest dated content) so every
  group is checked about once a month; problems open a single summary issue.
- Monthly: IRS master file and e-Postcard refresh (new and revoked organizations).
- After each event in the yearly calendar, rerun its lane C source:

| Month | Event to rerun |
|---|---|
| January | Mummers Parade (Jan 1), Lunar New Year (January or February), MLK Day of Service |
| March | St. Patrick's Day Parade |
| April and May | Philly Spring Cleanup, Love Your Park Week (spring) |
| June | Odunde, Juneteenth, Pride |
| July | Welcome America July 4th parade |
| August | National Night Out |
| September | Puerto Rican Day Parade, Cultural Fund grant cycle |
| October | Pulaski and Columbus parades, Love Your Park (fall) |
| November | Thanksgiving parade |

- Groups with no sign of life for 24 months become `dormant` and drop out of quiz results; they stay
  in browse with a label until a recheck finds them gone.

## 9. Known blocked or restricted sources

Dead City portals (nothing to harvest): serve.volunteermatch.org, volunteer.phila.gov. The City's
Idealist profile lists no opportunities.

Do not work around these: Reddit (403), South Philly Review (403), Free Library site (403 to
scripts), Facebook and Instagram (login), MLK Day of Service project list (account), Bryn Mawr Engage
(login), IRS e-Postcard page on irs.gov (bot protection; use the NCCS mirror). Meetup, Eventbrite,
Nextdoor, Idealist and Join Philly are leads only by their terms.

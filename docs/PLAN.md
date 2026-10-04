# Find Your Jawn: the plan

*Find your people in Philly.* Drafted 2026-10-04 from an interview with the owner and four scouting
reports (`docs/research/scouting/`). This file is authoritative. Section 2 holds the owner's decisions;
agents do not reopen them.

## 1. What we are building

A free public website that helps anyone who lives in Philadelphia find community groups worth joining:
nonprofits that take volunteers, civic associations, clubs, sports leagues, student organizations,
cultural and heritage groups, faith communities' service work, support groups, and the small,
word of mouth groups that never show up in a web search (the Mummers brigade, the Friends of a pocket
park, the library knitting circle, the Philly Grotto).

It has two front doors:

- **Browse**: the master list of every group, with search, filters and a map.
- **Match me**: a short quiz (about 12 questions, 3 to 4 minutes) that returns about eight groups,
  ranked, each with what the group does, why it fits you, and your concrete first step. Most results
  are close fits. Two are deliberate **stretches** that change just one thing about what you would
  normally pick, and one is a **wildcard**, because growth happens one small step outside your comfort
  zone, not three.

The difference between this and a list is follow through. Most people who mean to get involved never
go, because nobody asked them, they do not know what the first visit looks like, or they feel they
will not fit in. Every part of the site is designed to get a person through the door the first time
and back a second and third time (section 4).

## 2. Owner decisions (interview, 2026-10-04)

| Topic | Decision |
|---|---|
| Name | **Find Your Jawn** ("jawn" began as a word for a safe gathering place; the site explains it for newcomers) |
| Geography | City of Philadelphia, plus regional groups that meet in or actively serve the city. Data ready for suburbs later |
| In scope | Nonprofits taking volunteers, civic groups, clubs, sports, student groups, cultural and heritage groups, plus faith communities (labeled, filterable), paid activities (cost shown up front), and support and recovery groups (shown only when someone asks, never as a stretch) |
| Out of scope | Partisan political groups (ward committees, party clubs, campaigns). Nonpartisan civic and advocacy groups are in |
| Student groups | All of them, tagged by school. Students see their school's groups; everyone else sees only groups open to the public |
| Special paths | Teens needing service hours; court ordered community service; families with young kids; new to Philly |
| Contact details | Copy whatever the group or a public source publishes, including an organizer's personal phone or email |
| Updates and removals | GitHub only: issue forms for suggestions, corrections, and removal requests (tension noted: organizers without GitHub accounts will struggle to remove details; owner kept GitHub only) |
| Visibility | Public repository and live site from day one, with an "early preview" notice |
| Languages | English first, built translation ready. Every group records which languages are spoken there |
| Join Philly | Build ours; use their list only as leads (verify each group from its own pages, never copy their text); credit and link them; the owner contacts the founder about partnering |
| Research depth | Tiered: free scripts gather everything, a cheap AI pass checks every group is alive and writes a basic listing, deep "first visit" research for active, newcomer friendly groups |
| Stack | Python data pipeline, TypeScript site, static hosting on GitHub Pages |
| Stretch default | Balanced: about 8 results, 5 close fits, 2 one step stretches, 1 wildcard. Everyone gets a dial |
| Events | Groups plus how to show up (when they meet, cost, what a first visit is like). A live events calendar comes later, fed only by calendars groups publish themselves |
| This session | Plan, public repository with placeholder site, free script harvest of official lists. AI research waves start after the owner reviews this plan |

## 3. What already exists, and where we fit

Full details in `docs/research/scouting/prior-art.md`.

- **Join Philly** (joinphilly.com, launched about June 2025, run by Architects of Human Connection) is
  the closest thing: a curated directory of roughly 100 or more social clubs with tag filters and
  in person activities fairs. No quiz, no ranking, no neighborhood filter, little civic, volunteering,
  faith or student coverage. A natural partner, not a rival: they are strong on social clubs and
  events; we are strong on breadth, matching and follow through.
- **Idealist** (which absorbed VolunteerMatch in 2025) lists about 3,000 Philadelphia volunteer
  openings, as keyword search over posted opportunities. National platforms are search engines, not
  matchmakers, and they never carry the Mummers brigade or the town watch.
- **Code for Philly** teams tried "find your third place" tools in 2023; none shipped durably. The
  problem is real locally, and the hard part is keeping the data alive. Our answer: liveness checks
  and a weekly refresh from day one.
- **Confirmed gaps** no directory covers: town watches and block captains (about 6,000 captains, no
  public list), Mummers clubs, Friends of park and rec center groups, library programs, cultural and
  hometown associations, caving grottos and other niche hobby clubs.
- **Meetup and Eventbrite** terms forbid scraping or bulk reuse. They are lead sources only.

## 4. How the site gets people through the door

The design rules come from the evidence base in `docs/research/scouting/evidence.md` (23 rules, each
cited). In plain terms:

1. **Match on why, not just what.** People stay when a group serves their own reason for coming
   (meet people, do good, learn, build a career, feel better, have fun). The quiz asks why first.
2. **Show few, explain each.** About eight results, not fifty. Each one says, in your own answers'
   terms, why it fits. Explanations make people trust and act on suggestions.
3. **Stretch one step at a time.** A stretch keeps everything familiar except one thing: a new topic
   in a format you like, a familiar topic with a new crowd, or a deeper role in something you already
   do. Stretches are labeled as stretches and say why we think you might like them anyway. Practical
   limits (cost, schedule, access, safety) are never stretched.
4. **Make the first step concrete.** Every result ends with one specific action ("Come to the first
   Thursday meeting, 7 pm; no sign up needed"). People who decide when and where they will do
   something are far more likely to do it, so the site helps you pick a date and adds it to your
   calendar.
5. **Lower the first visit fear.** Every group page says what a first visit is like, whether you can
   just show up, what to bring, cost, access, languages, and that feeling unsure the first time is
   normal. That last line is not fluff: brief messages that normalize belonging worries have
   measurable, lasting effects.
6. **Bring someone.** Being asked is one of the strongest reasons people join, so every result has a
   one tap "send this to a friend" message.
7. **Plan for three visits.** Friendships take repeated contact. The site encourages going at least
   three times before deciding, and on your next visit asks how it went, then offers the next rung:
   more like it, a deeper role, or a fix for what got in the way.
8. **Mix bonding and bridging.** Groups of people like you feel good; groups that mix ages,
   neighborhoods and backgrounds build a city. Results include both and say which is which.
9. **Favor regular, nearby, low cost places.** Recurring groups close to home (by transit, not by
   car) build real ties; distance is measured in SEPTA and walking time.
10. **Barriers are filters, not footnotes.** Cost, schedule (including shift work), wheelchair access,
    languages, minimum age, Pennsylvania child clearances and background checks are structured fields
    you can filter on, explained in plain words where they matter.

The full product design (quiz questions, scoring, stretch rules, pages) is in `docs/DESIGN.md`.

## 5. The research program, in brief

Exhaustive means we cannot rely on any one way of finding groups. Full detail, lanes, budgets and
agent briefs are in `docs/RESEARCH.md`.

**Tiers.** Scripts gather candidates for free (tier 0). A cheap AI pass confirms each group is alive
and joinable and writes a basic listing (tier 1). Deep research writes the first visit guide for
active, newcomer friendly groups (tier 2). Groups that confirm their own listing reach tier 3.

**Lanes.** Independent ways of finding groups, run as waves of small Sonnet agents:

| Lane | Finds groups through | Examples |
|---|---|---|
| A. Official lists | Government and IRS data | City ArcGIS layers (240 registered community organizations, 141 park Friends groups), IRS master file (9,664 Philadelphia records), IRS e-Postcard (tiny nonprofits under $50,000) |
| B. Campuses | Student group directories | Penn Clubs (479), Drexel (548), Community College (109), then Temple, Jefferson, Saint Joseph's, La Salle and more |
| C. Parades, festivals, days of service | Who marched, hosted or tabled | Mummers lineup (70 plus clubs), St. Patrick's, Puerto Rican, Lunar New Year, Odunde, Pride, Love Your Park hosts, yearly news recaps |
| D. Funders | Grantee lists | Philadelphia Cultural Fund (322 grantees), Bread and Roses, Leeway, PHS gardens, Council grants |
| E. Platforms (leads only) | Public listing pages | Meetup, Join Philly, Idealist, Nextdoor's public page, read at human pace, verified elsewhere |
| F. Neighborhood sweeps | One agent per planning district (18) | Civic groups, town watches, gardens, rec councils, congregations' service work, block networks |
| G. Interest sweeps | One agent per interest family (about 25) | "Every caving, climbing and hiking group serving Philly" |
| H. Community media | Neighborhood and community papers | Chestnut Hill Local, Germantown Info Hub, Tribune, Philadelphia Gay News, Al Día, Grid, Kensington Voice |
| I. Faith, mutual aid, immigrant groups | Networks and partner pages | Interfaith Center, food pantry networks, hometown associations, the City's immigrant affairs commissions |
| J. Libraries, rec centers, schools | Program calendars and councils | Library branch programs, rec center leagues and advisory councils, Home and School Associations |
| K. People | Suggestions and bulletin boards | GitHub "suggest a group" form, partners, and photos of real bulletin boards (libraries, laundromats, coffee shops) |

**How we know how complete we are.** When two independent lanes (say, the neighborhood sweep and the
interest sweep) each find groups in the same slice (say, sports in South Philly), the overlap tells us
roughly how many exist in total, the way ecologists count fish by tagging and recatching. Each slice
gets a coverage estimate, published on a "How complete is this?" page, and the next wave goes where
coverage is lowest. A slice is done when a fresh sweep finds fewer than 5 percent new groups.

**Keeping it alive.** Every group shows "last seen active" (month and year). A weekly GitHub Action
checks links and signs of life on a rolling slice, and yearly lanes rerun after each parade, festival
and day of service.

## 6. Roadmap

Each milestone becomes a GitHub issue once the owner approves the plan. Site work runs in parallel
with research from phase 1 onward, using early data.

**Phase 0, foundation (this session)**
- M0.1 Plan documents (this file, DESIGN, RESEARCH, DATA_MODEL, ETHICS).
- M0.2 Public repository, placeholder site on GitHub Pages with the early preview notice.
- M0.3 Script harvest of official lists (lanes A and B where open, plus Cultural Fund, Mummers,
  grottos, hand seeds).

**Phase 1, first sweep (after owner review)**
- M1.1 Vocabularies: interest families and tags, the interest neighborhood graph for stretches, the
  five ways in per interest, motives, formats, neighborhoods.
- M1.2 Merge and triage: combine leads that describe the same group, drop what is out of scope
  (private foundations, condo associations, cemetery funds, partisan groups), create tier 0 groups.
- M1.3 Cheap classification of leads that already carry descriptions (student groups, grantees).
- M1.4 Scripted sign of life checker (website alive, newest dated post or event).
- M1.5 Lanes C and D (parades, festivals, days of service, funders), with five years of lookback.
- M1.6 Remaining campus directories.
- M1.7 First coverage estimate.

**Phase 2, the exhaustive sweep**
- M2.1 Neighborhood sweeps, 18 planning districts in three waves of six.
- M2.2 Interest sweeps, about 25 families in four waves.
- M2.3 Community media, M2.4 faith, mutual aid and immigrant groups, M2.5 libraries, rec centers and
  schools, M2.6 platform leads.
- M2.7 Re-estimate coverage and run gap waves until slices saturate.

**Phase 3, deep research**
- M3.1 Tier 2 first visit research, prioritized so every interest family and every part of the city
  has well described, newcomer friendly options.
- M3.2 Path research: which groups accept court ordered hours (only with a source that says so),
  which sign teen service hour forms and their minimum ages, family friendly options, newcomer
  starters.
- M3.3 Support and recovery: intergroups, recovery community organizations, grief and caregiver
  groups, mostly linking to the meeting finders that already exist.

**Phase 4, the site** (Opus agents, details in DESIGN.md)
- M4.1 Site shell: static pages for every group, browse, search, filters.
- M4.2 Map.
- M4.3 Matching engine and stretch rules, tested against fixture people (a teen needing 40 hours, a
  retiree new to Philly, a night shift nurse, a wheelchair user, a grad student who knows nobody, a
  parent of toddlers, someone with court ordered hours, a shy introvert, an extrovert jock).
- M4.4 Quiz, results and explanations. M4.5 Follow through (plan it, bring someone, saved list,
  check in). M4.6 The four paths. M4.7 Neighborhood starter pack: type your address, see your civic
  association, library branch, rec center, park Friends group and police district advisory council.
- M4.8 "How complete is this?" page. M4.9 GitHub issue forms: suggest a group, correct a listing,
  remove my details, I run this group, bulletin board photo.

**Phase 5, launch readiness**
- Persona testers (agents driving a real browser), accessibility pass, then a few real people from
  different backgrounds recruited by the owner. Remove the early preview notice when the owner says so.

**Phase 6, upkeep and growth**
- Weekly refresh, the yearly event calendar of research reruns, Spanish translation, live events from
  groups' own calendar feeds, suburbs.

## 7. Budget and pacing

Rough Sonnet token estimates; actual use is logged per wave in `research/waves/` so we can correct
course early.

| Phase | Work | Estimate |
|---|---|---|
| 0 | Scripts only | under 1 million |
| 1 | Classification, events and funders lanes, campuses | 10 to 15 million |
| 2 | Neighborhood, interest, media, faith and platform sweeps | 25 to 35 million |
| 3 | Deep first visit research for 1,500 to 2,500 groups | 30 to 50 million |
| | **Research total** | **about 65 to 100 million** |
| 4 and 5 | Site engineering (Opus) | 10 to 20 million |

Expected scale: 10,000 to 15,000 candidates in, roughly 4,000 to 7,000 living, joinable groups out.
Waves are small (eight agents or fewer, each with a search budget) and run one after another because
web search is capped at about 200 calls per session. Every wave ends with a short report and a pause
point, so the owner can stop or redirect spending.

## 8. Risks and how we handle them

- **False confidence about coverage.** The hardest groups to find are hard for every lane, so overlap
  estimates undercount what is missing. Lanes are chosen to be truly different (paperwork, campuses,
  streets and parades, topics, people), and the coverage page says the estimate is a floor.
- **Stale listings.** Last seen active on every page, weekly checks, unverified groups labeled.
- **Copying other people's work.** Facts, not text. We never republish another directory's
  descriptions, and platforms with restrictive terms are leads only.
- **Personal contact details.** The owner chose to copy what is public. Every contact shows where it
  came from, and the removal issue form is linked on every group page.
- **Stretch picks that feel pushy or wrong.** One axis at a time, always labeled, a dial, a "not for
  me" button that adjusts results, and never a stretch on support groups or faith.
- **Harmful listings.** Hate groups, groups that promote violence, and pyramid schemes are out.
  Affinity groups for a community (women only, LGBTQ, a heritage) are in.
- **Token overrun.** Tiering, batching many groups per agent, and a pause point after every wave.
- **Search limits and blocked sites.** Scripts first, WebFetch on known pages, and no workarounds
  for blocks (we record them and move on).

## 9. Owner actions

1. Review this plan and the design and research documents; approve phase 1.
2. Contact Join Philly's founder about partnering. A draft note is in `docs/outreach/join-philly.md`
   (not sent).
3. Decide the footer credit line (for example "Made by LSOH", your name, or none).
4. Later: a custom domain (pages under holdthedoorhoid.github.io share browser storage with your
   other sites), and recruiting a few real testers from different backgrounds.
5. Optional and valuable: photograph community bulletin boards you pass (library, laundromat, coffee
   shop, rec center) and drop the photos in a GitHub issue; agents will pull out the groups.

## 10. Document map

- `docs/PLAN.md`: this file (owner decisions, roadmap, budget).
- `docs/DESIGN.md`: the product: quiz, matching, stretches, pages, paths, privacy, stack.
- `docs/RESEARCH.md`: the research program: lanes, waves, agent briefs, coverage, liveness, refresh.
- `docs/DATA_MODEL.md`: file formats (binding).
- `docs/ETHICS.md`: rules about people, privacy, scope and fairness (binding).
- `docs/research/scouting/`: the four founding scouting reports.
- `docs/outreach/`: drafts for the owner to send, never sent by agents.
- `CLAUDE.md`: rules for agents.

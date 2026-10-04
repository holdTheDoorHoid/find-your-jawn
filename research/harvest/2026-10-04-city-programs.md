# City of Philadelphia volunteer programs, October 4, 2026

This report follows up on `research/harvest/2026-10-04-official.md`. That first pass flagged
`city_volunteer_pages` as noisy and incomplete. This pass builds a hand checked inventory of
every City volunteer program we could find, fixes the two real bugs in the crawl harvester, and
records what each fix changed. Every fact below has a source and a date; see
`data/seeds/city_programs.yaml` for the full detail behind each line.

## What we found, by department

**Office of Children and Families, Department of Human Services**
- Philly Reading Coaches: pairs a trained volunteer with a K to 3rd grade student for weekly
  after school reading, October through May. Its real home is ost.phila.gov, not the news post
  that first announced it; that page says it is "now accepting volunteers for the 2026 to 2027
  school year."
- Foster Grandparents, part of the national AmeriCorps Seniors network: a stipend for seniors
  55 and older, limited income, to mentor young children in classrooms 15 to 40 hours a week.

**Office of Innovation and Technology**
- Power Up Tech Corps: digital literacy coaches at library, Parks and Recreation, and Adult
  Education sites. Its application form was temporarily closed for being at capacity on the day
  we checked; the program itself is active.

**Department of Public Health**
- Philadelphia Medical Reserve Corps: over 7,000 registered volunteers who train year round and
  deploy during public health emergencies and large City events.

**Office of Public Safety**
- Town Watch Integrated Services: certifies neighborhood Town Watch groups and runs Citizens
  Emergency Response Training (CERT). This is the answer to the "emergency volunteering and
  CERT" checklist item: the Office of Emergency Management's own "Volunteering" page does not
  run a CERT program itself, it only links out to TWIS and to independent agencies (the
  Pennsylvania Animal Response Team, Second Alarmers, the Salvation Army, SEPA VOAD) that are not
  City programs.

**Philadelphia Police Department**
- Citizens Police Academy: a ten week evening course each fall. We could not find a current
  phila.gov page with sign up instructions; what we have comes from indexed search text, not a
  page we read ourselves, so it carries lower confidence and a 2023 evidence date.
- Police Explorer Cadet Program: a two year program for teens 14 to 20 considering a police
  career. Same caveat: reported in search text and a 2024 summer programs roundup, not confirmed
  on a dedicated page we could fetch.

**Philadelphia Fire Department**
- Fire Explorers: a two year program for teens 14 to 20, Saturdays at the Fire Academy, April
  through November.

**Department of Sanitation**
- Become a block captain: any resident can petition their block and run cleanups.
- Philadelphia More Beautiful Committee Clean Block Program: the organized Saturday cleanups and
  annual contest that go with having a block captain; 2024 reported 25,877 volunteers.

**Office of Clean and Green Initiatives**
- Philly Spring Cleanup: the City's largest single day cleanup, since 2008.

**Philadelphia Parks and Recreation**
- Park Friends groups (over 100 of them), Recreation Advisory Councils (join by attending one
  meeting), general business and individual volunteering (weeding, planting, rec centers, the
  Broad Street Run), Love Your Park (spring week plus a Fall Service Day, run jointly with
  Fairmount Park Conservancy and the Park Friends Network), and TreePhilly's yard tree giveaway
  volunteering. The City's own page points residents who want deeper tree training to the
  Pennsylvania Horticultural Society's Tree Tenders program; that is a PHS program, not the
  City's, so it is not counted as a separate City program here.

**Office of the Chief Integrity Officer**
- The Philadelphia Youth Commission and the general directory of advisory boards and commissions
  (the Civic Design Review Board, the Housing Advisory Board, and dozens more). Most seats are
  mayor appointed; the directory names no public application form beyond a general contact
  address.

**Office of the City Commissioners**
- Election Board Workers (poll workers): a paid civic role, not a pure volunteer shift, but named
  in the task brief by name so it is included.

**Office of Children and Families / Office of Community Empowerment and Opportunity**
- serve.phila.gov, the City's old general volunteer portal address, redirects to OCEO's
  department page rather than to a volunteer program. OCEO's own structured "join and serve"
  program is the Serve Philadelphia VISTA Corps: a full year, paid stipend AmeriCorps VISTA term
  placed inside City offices such as the Office of Immigrant Affairs.

**Mayor's Office of Education**
- Adult Education volunteer tutors, through the myPLACE network of about 20 providers.

**Office of Homeless Services**
- Point in Time Count volunteers: several hundred people canvass overnight each January to count
  and survey Philadelphians experiencing unsheltered homelessness.

**Philadelphia Department of Prisons**
- Volunteer at a prison: educational and spiritual support at one of four facilities, 21 and
  older, 16 hours of training.

**Philadelphia Water Department**
- Soak It Up Adoption: small grants for community organizations that adopt and maintain a rain
  garden or other green stormwater site. This one is not open to an individual resident applying
  alone; the organization must be a 501(c)(3) with at least one paid staff member. A resident
  takes part by joining one of the adopting groups' own cleanup days.

**Free Library of Philadelphia**
- Computer tutors, English conversation group facilitators, and teen after school program
  volunteers. See "Blocked" below: this entry comes only from indexed search text.

**Office of Immigrant Affairs**
- No standing, structured public volunteer sign up beyond the VISTA positions above; OIA has
  recruited ad hoc legal volunteers (for example "Know Your Rights" presenters) in the past, but
  we found no public program page for that.

**Flagged separately, per the task**
- School District of Philadelphia classroom volunteers (Family and Community Engagement office):
  a public agency with its own elected Board of Education, not part of City government, included
  because the task asked for it to be checked.
- Mural Arts Philadelphia volunteering: an independent nonprofit partner, included as a link
  only, with no researched detail and no text copied from its own site.

## What the original crawl had missed

The first `city_volunteer_pages` run (23 City pages, 18 external links) never found: Philly
Reading Coaches' real program site (it only had the 2023 news post), the Philadelphia More
Beautiful Committee's Clean Block contest and schedule, Philly Spring Cleanup, Love Your Park
Week, the Citizens Police Academy, the Police Explorer Cadet Program, Fire Explorers, the
Philadelphia Youth Commission and the boards and commissions directory, Election Board Workers,
the Serve Philadelphia VISTA Corps, Adult Education tutors, the Point in Time Count, Department
of Prisons volunteering, Soak It Up Adoption, and Free Library volunteering. All 25 of these are
now in `data/seeds/city_programs.yaml`, none of them require a network call to reproduce (the
file is hand researched, not crawled), and a new harvester, `city_programs`, turns them into 27
leads (25 active programs plus the Free Library and Mural Arts entries, each flagged with its own
caveat).

The reason the crawl missed almost all of these: it only follows one hop of links from a small
seed list, so a real program with no inbound link from one of those seed pages, or that lives on
a City subdomain the crawl does not follow (ost.phila.gov, water.phila.gov, the SDP's own
philasd.org), was invisible to it no matter how good its keyword list was.

## Fixing `city_volunteer_pages`

The crawl itself carried two real bugs, both now fixed with tests in
`pipeline/tests/test_city_volunteer_pages.py`:

1. **A fetched page became a lead just because a referring link's text or URL matched a
   volunteering keyword, even when the page's own content was not about volunteering.** That
   substring match is deliberately broad, since it only decides what to fetch next; "Philadelphia
   **Join**s Cities Across the Nation in Honoring Second Chance Month" matched on "join" and the
   crawl faithfully recorded that reentry announcement page as a "program," along with the U.S.
   Department of Justice link it happened to contain. A new check, `_is_volunteer_page`, looks at
   the fetched page's own title and body text, not the referring link, and now also drops the
   "Concession opportunities" (a contracting page), "Departments and other agencies," and "All
   events" pages that were showing up as noise. External partner links are no longer mined off a
   page that fails this check, which is what removes the Department of Justice link without
   needing a special rule just for that one domain.
2. **External partner leads were named from the referring link's own anchor text**, which is how
   "apply online," "register online to become a volunteer," "national MRC program.," and a whole
   sentence of CDC body text ended up as lead names. `_resolve_partner_name` now fetches the
   partner page itself and names the lead from its own `<title>` or `<h1>` (with a same site
   domain check to pick the right half of a two part title, since real partner sites are not
   consistent about whether the organization's name comes first or last), falling back to the
   anchor text only if that fetch fails. Any partner host ending in `.gov` or `.mil` is now
   excluded outright, since a federal or state reference page is not a community or volunteer
   organization a resident can join; that one rule is what removes the DOJ, CDC, ASPR, and SERVPA
   links without naming each domain individually.

Re running the fixed harvester against the live site dropped the lead count from 41 to 31 and
removed every piece of noise named in the task brief. One accepted side effect: serve.phila.gov no
longer produces its own lead, because its content (the Office of Community Empowerment and
Opportunity's landing page) never actually describes a way to volunteer; the redirect fact itself
is still recorded in the harvester's module docstring and in `registry/sources.yaml`. A few
partner names are still imperfect (Broad Street Run's `/contact/` page and its homepage both
still resolve to "Independence Blue Cross Broad Street Run," a harmless duplicate; Love Your
Park's own `/volunteer/` subpage is titled just "Volunteer" with no site name in it at all, so the
fix cannot improve on that one), but every name now comes from a real page heading, not
misparsed anchor text or stray body text.

## Discontinued programs

- **Philly Free Streets.** Every phila.gov post about it dates from 2017 to 2019 (newest:
  2019-08-29). Its own event domain, phillyfreestreets.com, no longer belongs to the program: a
  direct fetch on 2026-10-04 loaded an unrelated commercial gambling page. Recommend treating it
  as discontinued and never linking that domain from the public site.
- **The old Mayor's Volunteer Portal** (serve.volunteermatch.org) and **volunteer.phila.gov**:
  already recorded as dead in the original harvest report; confirmed again this pass (DNS failure
  and timeout respectively).

## Blocked, or lower confidence

- **Free Library of Philadelphia.** freelibrary.org returns HTTP 403 to automated fetches, and
  its phila.gov mirror subdomain, libwww.library.phila.gov, timed out on every attempt rather
  than connecting. Per the project's rule never to work around a block, the Free Library entry in
  `city_programs.yaml` is built only from indexed search result text, not a page we read
  ourselves, and is flagged as lower confidence.
- **Citizens Police Academy and the Police Explorer Cadet Program.** We could not find or guess a
  current phila.gov page with sign up instructions for either (several likely URLs returned 404).
  What we recorded comes from indexed search text about a Citizens Police Oversight Commission
  presentation and a City summer programs roundup, not pages we fetched ourselves; both are
  flagged with an older evidence date and lower confidence than the rest of the inventory.
- **Soak It Up Adoption** is a real Water Department program, but it only accepts an organization,
  not an individual resident, so it is included with that caveat rather than as a straightforward
  "sign up and volunteer" entry.
- **Office of Immigrant Affairs** has no standing public volunteer program beyond the Serve
  Philadelphia VISTA positions; its past "Know Your Rights" legal volunteer recruitment appears to
  be ad hoc, not a structured, repeatable sign up, so it is not listed as its own program.

## Research budget

15 WebSearch calls, all `site:phila.gov`, covering CERT and emergency response, the Philadelphia
More Beautiful Committee and Clean Block, the Citizens Police Academy, police and fire Explorer
programs, Police District Advisory Councils, Adult Education and myPLACE, the Point in Time
Count, the Department of Prisons, the Water Department's rain garden and Soak It Up work, the
Office of Immigrant Affairs, boards and commissions, the Free Library, Philly Free Streets,
TreePhilly and Tree Tenders, and Love Your Park and Philly Spring Cleanup. Everything else was
WebFetch or curl on the specific pages those searches turned up, plus a few direct URL guesses
(most of which 404'd and are noted above).

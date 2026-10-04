# Prior Art and Landscape Scan: Philadelphia Community Finder and Quiz

Research pass completed 2026-10-04. Budget used: 15 WebSearch calls plus WebFetch on known URLs. Every claim below is sourced with a URL; anything not independently confirmed is marked "unverified."

## What this means for our plan

- **Join Philly (joinphilly.com) is a near-direct competitor already live.** Founded by Brian Adoff, it launched roughly mid-2025 and was profiled by Billy Penn in April 2026. It organizes clubs into five categories (Move & Explore, Make & Create, Learn & Build, Talk & Share, Act & Impact) and uses curated, submission-based listings. It has no quiz or ranked-matching engine and no stretch-pick concept. Check it closely before building; our clearest differentiators are the matching quiz and explicit stretch recommendations, neither of which it offers.
- **Borrow the mechanics of the better hobby quizzes, not their philosophy.** LikeHobby's quiz uses eight weighted questions scored against a fixed catalog, returns three ranked matches with transparent confidence bands, and ends in a small, bounded first step rather than a label. That structure is worth copying; its deliberate choice to avoid "aspirational" matches is the opposite of what we want, so the stretch-pick feature has to be designed in on purpose.
- **A broken core feature kills trust.** Hobsess's quiz link is down and the site itself apologizes for it. On a static GitHub Pages site we should keep the matching logic simple enough (client-side, no backend dependency) to stay reliably up.
- **Treat Eventbrite and Meetup as display-only, link-back sources at most.** Eventbrite's API terms explicitly ban scraping/crawling and commercial reuse of content; any displayed listing must show the event title and link back to Eventbrite. Meetup's API license is limited to apps "related to Meetup events and groups." Neither supports bulk republishing into our own directory without a fresh terms review.
- **City and university data can legitimately seed our directory.** The city's Registered Community Organization (RCO) PDF list and SERVE Philadelphia's own pages are public data we can cite and reuse, though the RCO list needs reformatting out of PDF and has no phone/address/meeting-time fields.
- **Likely partners and amplifiers:** Code for Philly (whose 2023 Launchpad teams already tried to solve "find your third place" and stalled at hackathon stage, so there is both validation and a cautionary tale there), PHENND and the Netter Center/Lindy Center (deep university-community ties), Generocity (nonprofit-sector press credibility), and Billy Penn/WHYY (both already cover this beat and covered Join Philly directly).
- **The clearest, most confirmed gap is hyperlocal civic infrastructure.** There is no browsable citywide directory of town watches or block captains anywhere, confirmed by multiple sources below, despite roughly 6,000 registered block captains. Mummers clubs, caving grottos, and friends-of-park or rec-center groups were not found in any directory in this pass either, though that absence is not exhaustively proven. This is where we add value that neither Join Philly nor the national volunteer platforms provide.
- **National platforms (Idealist/VolunteerMatch, JustServe, AmeriCorps, Golden, Catchafire) are large search-and-filter engines over big inventories, not quiz-driven matchers.** We should not try to out-list them; we should be a better front door into Philly-specific civic life, including the hyperlocal groups they never carry.
- **Do a dedicated terms-of-service deep read before any scraping or bulk reuse.** This pass flagged the headline restrictions for Eventbrite, Meetup, and VolunteerMatch/Idealist, but did not fully resolve VolunteerMatch's API status after its 2025 merger into Idealist; that needs its own follow-up before we rely on it.

---

## 1. Philadelphia-specific directories and volunteer-matching services

### Join Philly
- URL: https://www.joinphilly.com/ and https://www.joinphilly.com/clubs
- Covered by Billy Penn: https://billypenn.com/2026/04/02/join-philly-clubs-organizations-directory/
- Who runs it: Brian Adoff, an independent founder; framed as civic infrastructure work, not a city or nonprofit program.
- What it covers: clubs and organizations across five categories (Move & Explore, Make & Create, Learn & Build, Talk & Share, Act & Impact), including sports leagues, art/craft groups, book clubs, civic/volunteering groups, and hobby groups. Tag filters include Books & Writing, Business & Careers, Games & Leisure, BIPOC-led, Queer-led, Women Focused, and Sober-friendly.
- Size: not disclosed; the homepage shows roughly 18 clubs in carousels plus six spotlighted clubs, with a "View All Clubs" link to a fuller directory. Billy Penn's founder quote claims "Philly has more than any other city in the country of every affinity" (unverified, founder's own claim).
- Freshness: copyright reads 2025; references upcoming gatherings, so it appears actively maintained, though no explicit "last updated" timestamps were visible.
- Quiz or matching: none found. Browse and tag-filter only.
- Weaknesses observed: no visible neighborhood/geographic filter; no Mummers or cultural-parade category; no town-watch/block-captain category; curated submissions mean coverage depends on who applies, and the site states "we can't include every group (yet)."
- Data access: no API or export mentioned. Submission is via a stated five-minute form, reviewed by the team, not open data.

### Serve Philadelphia / Office of Civic Engagement and Volunteer Service (OCEVS)
- URL: https://serve.phila.gov redirects to https://www.phila.gov/departments/mayors-office-of-civic-engagement-and-volunteer-service/
- Background: https://www.phila.gov/2018-09-17-serve-philadelphia-launches-mayors-volunteer-corps/, https://wikidelphia.org/Office_of_Civic_Engagement_and_Volunteer_Service_(OCEVS)
- Who runs it: City of Philadelphia, Office of Civic Engagement and Volunteer Service, located at 1401 JFK Blvd.
- What it covers: three units, Community Engagement (neighborhood organizing resources), Volunteer Engagement (connects volunteer groups to opportunities, including the Foster Grandparent Program), and Civic Engagement (civic education, Serve Philadelphia VISTA Corps).
- Size and content: the live page did not show a browsable listing of opportunities or organizations when fetched; it mainly describes the office's own programs and links to things like the Civic Engagement Academy and BenePhilly.
- Freshness: moderately current; the page referenced an April 2025 post and 2026 press releases, with events scheduled through December 2026.
- Quiz or matching: none.
- Data access: no API or export found on this page; the broader City of Philadelphia site references an open data program in its footer (not verified as covering this office's data).
- Note: a SERVE Philadelphia "Parks and Rec Volunteer Coordinator" role also appears cross-posted on AmeriCorps's national listing site, confirming the city does feed at least some opportunities into a national platform. https://my.americorps.gov/mp/listing/viewListing.do?fromSearch=true&id=48135

### Global Citizen 365 / Greater Philadelphia MLK Day of Service
- URL: https://globalcitizen365.org/kingday/ and the volunteer portal https://volunteer.globalcitizen365.org
- Coverage: https://generocity.org/philly/2016/02/03/global-citizen-mlk-day-of-service/, https://whyy.org/articles/philadelphia-mlk-day-of-service-2026-volunteer-opportunities/ (not independently fetched, flagged unverified for detail)
- Who runs it: Global Citizen, a Philadelphia nonprofit. Self-described as hosting "the oldest and largest King Day of Service event in the country" with over 150,000 volunteers in roughly 1,800 projects (unverified, organization's own claim).
- What it covers: a year-round volunteer portal (MLK365) plus the single-day MLK Day of Service event.
- Quiz or matching: a basic search with keyword, city/zip, and a 5 to 50 mile radius filter, plus an "Advanced Search" link. Not a quiz or ranked match; a sample search returned "No results found," suggesting the live database may be thin outside the MLK Day run-up.
- Freshness and size: unclear outside the seasonal event; appears mostly active around January.
- Data access: no API or export found.

### United Way of Greater Philadelphia and Southern New Jersey
- URL: https://unitedforimpact.org and https://www.unitedforimpact.org/volunteer/
- Background: this organization absorbed Greater Philadelphia Cares. http://www.gpcares.org.webmatrix-appliedi.net/
- What it covers: a volunteer portal organized by category (Community, Education, Employment, Health, Older Adults) plus initiatives like Project NEXT and Girls Today Leaders Tomorrow.
- Caveat: the specific volunteer URL fetched in this pass resolved to a 2017 news article about a past "Day of Caring" event rather than a live opportunities database, so the current state of the actual portal is **unverified** and should be rechecked directly at unitedforimpact.org before relying on this entry.
- Quiz or matching: not confirmed either way in this pass.

### Philadelphia Foundation
- URL: https://www.philafound.org/engaging-volunteers/individuals/ and https://www.philafound.org/engaging-volunteers/non-profit/
- What it covers: the "Key Skills Hub," a skills-based volunteer marketplace matching professionals (business strategy, marketing, accounting, graphic design, HR, web development) with nonprofits needing that expertise, integrated with Catchafire. Also partners with RSVP for traditional, non-skills-based volunteering aimed at older adults.
- Scope: skills-based professional volunteering only, not a general club or community directory.
- Quiz or matching: a profile-and-interview matching process, not a quiz.
- Freshness: appears active, with current project listings for roles like membership strategy and event management consulting.
- Data access: no API or export found; relies on Catchafire's backend.

### Generocity.org
- URL: https://generocity.org
- What it is: a local social-impact news outlet covering Philadelphia's nonprofit sector (closures, funding announcements, policy, LGBTQ health funding, etc.), not a directory or matching tool. https://generocity.org/philly/2024/07/10/responsible-nonprofit-leadership/, https://www.lenfestinstitute.org/solutions-resources/generocity-org-launching-a-year-long-reporting-project-on-a-more-just-recovery/
- Relevance to us: a potential press/credibility partner for launch coverage and for sourcing which nonprofits are currently stable versus closing, not a competing product.

### Code for Philly
- URL: https://codeforphilly.org/projects
- What it is: a volunteer-driven civic tech community (founded 2011) that maintains a Civic Projects Directory described in search results as containing 268 projects across categories like Transit, Mapping, Elections, Civic Engagement, GIS, Biking, and Data (project count from search snippet, not independently re-verified by direct page read in this pass).
- Directly relevant prior art: in its March 2023 Launchpad hackathon, three teams explicitly tackled "finding your third place" in Philadelphia: a library-resource awareness app, "PhilaVibes" (a map of community spaces with descriptive word clouds, filterable by current location, commute, or destination), and an AI-assisted local-events discovery tool nicknamed the "Billy Events Application." https://technical.ly/software-development/code-for-philly-launchpad-third-place/
- Outcome: Technical.ly classified all three as still in "Bootstrapping" stage as of that coverage, meaning early-phase with no confirmed public launch or maintained outcome. No quiz, ranking, or matching algorithm was mentioned for any of them.
- Takeaway: this validates that Philadelphia's own civic-tech community sees our exact problem as real and unsolved, and that the hard part is sustained execution, not the idea.

### Philadelphia Inquirer's volunteering/giving guide
- URL: https://www.inquirer.com/philly-tips/philadelphia-charities-donate-volunteer.html
- What it is: a static article, published January 14, 2022, with no visible refresh since.
- Coverage: roughly 40+ organizations across 10 categories (housing/homelessness, clothing and furniture donation, gun violence support, youth programs, BIPOC organizations, LGBTQ services, refugee assistance, hunger/food support, community fridges, and other groups like elder care and crime-victim support).
- Quiz or matching: none; it is a plain list with contact info per organization.
- Scope: charities and volunteering only, not clubs, sports, or hobby groups.

### City of Philadelphia Registered Community Organizations (RCO) list
- URL (example snapshot): https://www.phila.gov/media/20260421151810/Report_AcceptedRCOs_04132026.pdf
- What it is: an official PDF list of registered civic associations and neighborhood groups, organized roughly alphabetically by neighborhood, spanning about 25 pages and roughly 150 to 200 organizations, each with a name and hyperlinked website/social links.
- Utility: a legitimate public data source for seeding neighborhood civic-association listings, but it has no phone, address, or meeting-time fields, is PDF-locked rather than structured data, and needs manual freshness checks since links can go stale.

### PHENND (Philadelphia Higher Education Network for Neighborhood Development)
- URL: https://phennd.org
- What it is: a network of more than 25 colleges and universities supporting service-learning and civic engagement in Philadelphia. It runs its own programs (PHENND Fellows AmeriCorps positions, sustainability initiatives) and a curated weekly newsletter of local events, grants, and jobs, rather than a public-facing directory for residents.
- Relevance: a potential partner for reaching university-affiliated community organizations and volunteers, not a competing directory. Site design appeared dated.

### University civic engagement centers
- Penn's Netter Center for Community Partnerships: http://www.nettercenter.upenn.edu/ , focused on Penn-West Philadelphia partnerships since 1992, scoped to Penn students/affiliates and West Philadelphia.
- Drexel's Lindy Center for Civic Engagement: https://drexel.edu/lindycenter/ , supports Drexel students' civic engagement and service opportunities, scoped to Drexel.
- Neither is a general public directory; both are worth approaching as partners given their deep neighborhood ties, but their own listings are not usable as-is for a citywide public tool.

### Billy Penn and WHYY as a beat, not a tool
- Billy Penn covered Join Philly directly (link above) and WHYY publishes seasonal volunteering guides, for example a 2026 MLK Day of Service how-to-get-involved piece: https://whyy.org/articles/philadelphia-mlk-day-of-service-2026-volunteer-opportunities/ (not independently fetched in this pass; flagged unverified for detail, but the existence and framing is confirmed by the search result title and URL).
- Neither outlet appears to run a standing, searchable community directory themselves; both are better framed as press/amplification partners who already cover this exact beat.

---

## 2. National platforms that cover Philadelphia

### Idealist (absorbed VolunteerMatch in 2025)
- URL: https://www.idealist.org/en/volunteer-in-philadelphia-pa
- Scale in Philadelphia: 3,167 volunteer opportunities listed under Philadelphia, PA at the time of this search (October 2026).
- Terms: VolunteerMatch's legacy terms of service applied until October 6, 2025, after which users move to the Idealist Agreement: https://www.idealist.org/en/about/volunteermatch-terms-of-service and https://www.idealist.org/en/terms-of-service. VolunteerMatch previously offered a "Public Use API" / "Open Network Opportunities API" for syndication: https://solutions.volunteermatch.org/product/api. Whether this API survives in its original form post-merger, and exactly what reuse rights it grants today, is **unverified** in this pass and needs a direct, current read of Idealist's terms before any integration.

### VolunteerMatch (legacy brand, now part of Idealist)
- See above. Historically had a documented public API intended for exactly this kind of third-party listing syndication, which is encouraging prior art for a legitimate data-sharing relationship, but current availability is unverified.

### JustServe
- URL: https://www.justserve.org
- Background: broadly associated with service-project listings; the Philadelphia-specific search page did not fully load in this pass (it returned only a loading placeholder), so **the Philadelphia listing count is unverified**. A general search listicle describes it as offering "local search with success stories highlighting impact." https://getzelos.com/volunteer-opportunities
- Recommend a direct follow-up check of justserve.org with JavaScript-rendering if this platform matters to the plan.

### AmeriCorps / AmeriCorps Serve
- URL: https://my.americorps.gov and https://americorps.engage.pointsoflight.org/
- Confirmed: at least one SERVE Philadelphia listing (a Parks and Rec Volunteer Coordinator role) is cross-posted here, confirming the City of Philadelphia already uses this national channel for some of its own listings. https://my.americorps.gov/mp/listing/viewListing.do?fromSearch=true&id=48135
- Primarily focused on longer-term service commitments (AmeriCorps members and AmeriCorps Seniors) plus a general search for local opportunities and organizations.

### Points of Light / HandsOn Network
- Background: HandsOn Network merged into the Points of Light Foundation in 2007 to form Points of Light Institute. https://en.wikipedia.org/wiki/Hands_on_Network
- "Points of Light Engage" is described as the world's largest volunteering opportunities network (organization's own framing, unverified independently). "HandsOn Connect" is a volunteer-management software product Points of Light sells to other organizations, not itself a public directory.

### Golden
- URL: https://goldenvolunteer.com
- What it is: volunteer management software used by 50,000+ client organizations (including AARP, United Way, and the International Rescue Committee per their own marketing), with a consumer-facing app. Philadelphia opportunities appear only where a client organization (for example, the American Cancer Society's Hot Chocolate Run) uses Golden; it is not a comprehensive citywide directory, coverage depends entirely on which local nonprofits are Golden customers.

### Catchafire
- URL referenced via Philadelphia Foundation's Key Skills Hub integration above.
- What it is: a national skills-based micro-volunteering platform matching professionals to nonprofit projects, mostly remote. Used as backend infrastructure by at least one Philadelphia program (Key Skills Hub) rather than operating a Philly-specific front end of its own.

### Meetup
- URL: https://www.meetup.com
- Terms: the Meetup API license is "limited, non-exclusive, non-transferable, non-sublicensable, revocable" and restricted to building applications "related to Meetup events and groups," not general reuse or republishing of listings into an unrelated directory. https://help.meetup.com/hc/en-us/articles/360028705532-Meetup-API-license-terms
- Philadelphia listing volume: not measured in this pass (not in the 15-search budget); recommend a direct, dedicated check if Meetup groups are meant to be a core data source.

### Eventbrite
- URL: https://www.eventbrite.com
- Terms: the Eventbrite API Terms of Use explicitly state "you have no right to use any Site Content for your own commercial purposes" and explicitly prohibit scraping, crawling, or automated extraction. Any displayed event content must show the event title and a direct link back to the Eventbrite page. https://www.eventbrite.com/help/en-us/articles/833731/eventbrite-api-terms-of-use/
- Implication: Eventbrite can at most be a "see this event on Eventbrite" link-out source, never a bulk-imported or republished dataset, under these terms as read.

### Nextdoor and Facebook Groups
- **Not independently verified in this pass** due to search-budget limits. Both are widely understood to require account login to browse and to have restrictive terms against scraping, but that understanding was not freshly confirmed against their current terms here. Flagged for a dedicated follow-up pass if either is being considered as a data source.

### Other platforms noted incidentally
- GozAround: described in a listicle as profile-based matching with gamification, active in 400+ cities. https://getzelos.com/volunteer-opportunities — not independently confirmed; worth a closer look purely as matching-UX prior art, not as a Philadelphia data source.
- Full listicle of 19 US-focused and several international volunteer platforms reviewed at https://getzelos.com/volunteer-opportunities for completeness; none were Philadelphia-specific, and none were confirmed to use a quiz-style matching engine rather than keyword/category/location search.

---

## 3. Matching and quiz prior art (any city)

### LikeHobby hobby quiz
- URL: https://www.likehobby.com/hobby-quiz-for-adults.html
- Method: eight weighted questions covering time availability, location/setting, social comfort, energy level, creative style, screen preference, budget, and goal/motivation, explicitly framed around "your normal week, not an imaginary perfect one."
- Scoring: compares answers against a catalog of 59 possible hobbies with a weighted system (an exact trait match earns full weight, a flexible hobby earns partial weight), returning three ranked matches with relative confidence bands (70%+, 50 to 69%, below 50%) rather than one single answer.
- Stretch picks: explicitly avoided by design. The quiz states it is "built around constraints that shape whether a hobby survives real life," prioritizing practical fit over aspirational growth, the opposite of what our project wants to do.
- Ending: directs the user to a bounded, low-cost first step (a 20-minute, no-purchase trial session) and asks them to judge whether they would repeat it within seven days, rather than stopping at a label.
- Lesson for us: the bounded-first-step idea, the multiple ranked outputs, and the transparent confidence bands are all worth adapting; the no-stretch-picks choice is specifically what we should depart from.

### Hobsess "Hobsessment" quiz
- URL: https://www.hobsess.com/but-first-a-hobby/
- Status: the quiz is reported broken by the site's own text, which apologizes and says it is searching for a replacement quiz tool. Methodology could not be evaluated as a result.
- Lesson for us: a visibly broken core interactive feature undermines the credibility of an entire site; on a static GitHub Pages build we should favor simple, dependency-light client-side logic that is unlikely to silently break.

### Other hobby quizzes noted but not deeply analyzed
- HobbyStack Hobby Finder (hobbystack.net/finder): roughly a 3-minute quiz, noted only from search snippets, not independently fetched in this pass.
- ProProfs "What Hobby Should I Do" and testets.com hobby quiz: generic quiz-platform templates found in search results, not analyzed in depth; likely low-rigor compared to LikeHobby's explicit weighting.

### Code for Philly's "third place" projects
- See Section 1 above (codeforphilly.org entry). Directly relevant as local prior art specifically for "find your community/third place" tools, not generic hobby quizzes. All three 2023 Launchpad projects stayed at hackathon/bootstrap stage per Technical.ly's own framing, with no evidence found in this pass of a public, maintained launch. https://technical.ly/software-development/code-for-philly-launchpad-third-place/

### General pattern across volunteer-matching platforms
- VolunteerMatch/Idealist, JustServe, Golden, and AmeriCorps's search tools all appear to be keyword, category, and location filters over a large inventory of listings, not personality- or interest-driven quizzes with ranked output. None found in this pass explicitly frames results around "stretch" or growth picks outside a user's stated comfort zone.
- This confirms a specific, genuine gap: no Philadelphia tool and no major national volunteer platform identified in this pass does explicit "comfort zone stretch" recommendations as part of its core matching logic. That is a real, differentiating feature for our plan if executed well.

---

## 4. Gaps: Philadelphia groups poorly covered by anything found above

- **Town watches and block captains.** Confirmed via multiple sources that no citywide browsable directory of block captains exists; residents can only look up their own block through the city's CleanPHL litter-index address lookup, not browse a citywide list. Roughly 6,000 block captains are registered citywide with zero centralized public directory. https://thephiladelphiacitizen.org/o-captain-my-block-captain/, https://resolvephilly.org/eip/in-north-philly-and-beyond-block-captains-promote-safety-through-connection/, https://www.phila.gov/services/trash-recycling-city-upkeep/become-a-block-captain/
- **Mummers clubs and parade/cultural marching associations.** Not found as a category in Join Philly (confirmed by direct inspection of its tag list), the city's RCO list, or any volunteer platform reviewed. No dedicated citywide directory of Mummers clubs was found in this pass; this is a likely gap but not exhaustively proven absent, since sources specific to the Mummers organization itself (for example a possible club list on mummers.com) were not checked due to search-budget limits.
- **Caving grottos.** No Philadelphia-specific directory or mention found anywhere in this pass. Likely a gap, but similarly not exhaustively checked against a national caving-club directory that might list a local Philly-area grotto.
- **Friends-of-park groups, rec center leagues and advisory councils, library branch friends groups.** No consolidated citywide list was found; Parks & Recreation and the Free Library likely maintain scattered per-site pages, which were not individually checked in this pass due to budget limits.
- **Cultural and ethnic associations** that run cultural centers or march in parades beyond what is captured in the RCO civic-association list: not found as a consolidated directory anywhere in this research pass.

These gaps line up with the stated goal of the project: a directory and quiz that goes beyond standard nonprofit/volunteer listings (already well served, if imperfectly, by Idealist, AmeriCorps, and Join Philly) into the hyperlocal, cultural, and civic-infrastructure groups that currently have no public, browsable home at all.

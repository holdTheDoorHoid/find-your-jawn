# Product design

How the site works for a visitor. The owner's decisions are in `docs/PLAN.md` section 2; the evidence
behind each rule is in `docs/research/scouting/evidence.md`. Field names refer to
`docs/DATA_MODEL.md`.

## 1. Pages

| Page | Purpose |
|---|---|
| Home | Two big doors: "Match me" and "Browse everything". A one line "What's a jawn?" explainer. Links to the four paths and to support groups |
| Quiz | About 12 short questions, one per screen on a phone, progress bar, every question skippable |
| Results | About 8 ranked groups with why, first step and actions; the adventure dial; "show me more" |
| Group page | One static page per group (good for search engines and sharing) |
| Browse | Search, filters, list and map views |
| Interest pages | One static page per interest family ("Caving, climbing and hiking in Philly") |
| Paths | Service hours (school), court ordered service, families with kids, new to Philly |
| Support groups | A separate, calm entry point with crisis numbers first |
| Your neighborhood | Type an address, see the civic groups that cover it |
| My list | Saved groups, planned visits, check ins (stored only in this browser) |
| How complete is this? | Coverage estimates by interest and part of the city, and what we know we are missing |
| About, privacy, how ranking works | Plain explanations, credits, sources, Join Philly link |

## 2. The quiz

Short, every answer used, nothing leaves the device. Questions in order:

1. **What are you hoping to get out of this?** (pick up to three) Meet people and make friends · Do
   something that matters · Learn something new · Build skills for work · Get out of the house and
   feel better · Have fun · I need service hours (opens the service hours path) · I'm going through
   something and want support (opens the support flow instead). These map to the six volunteer
   motives: social, values, understanding, career, protective, enhancement.
2. **What are you into?** Tiles grouped into about 25 interest families. Tap once for "like", twice
   for "love". "Surprise me" is allowed and leans the results toward stretches.
3. **How do you like to spend time with people?** Side by side doing something · Talking and hanging
   out · On a team · Making or performing together · Quietly behind the scenes · Organizing and
   leading · Learning a skill.
4. **Anything you'd like to get better at or braver about?** (optional) Meeting new people ·
   Speaking up · Getting fit · A language · Leading · Working with my hands · Being outdoors ·
   Helping in a crisis. Stretches favor these, so growth feels chosen, not imposed.
5. **When are you free?** Weekday daytime, weekday evenings, weekends, or "it changes week to week"
   (shift work; favors drop in groups).
6. **How often?** Try something once · About once a month · Every week · I want something big.
7. **Where do you start from, and how far will you go?** Neighborhood, ZIP, or "use my location"
   (stays on the device). Walk up to 20 minutes · Up to 30 minutes on SEPTA · Anywhere in the city ·
   I drive.
8. **Budget?** Free only · A little is fine · Whatever it costs.
9. **Who's coming with you?** Just me · A friend or partner · My kids (ages) · A group (work, school,
   faith).
10. **Walking into a room of strangers feels...** a five step scale from "exciting" to "really hard",
    plus preferred group size.
11. **Want to find people who share any of these?** (optional, never stored off the device) LGBTQ+,
    a cultural heritage (pick), a faith (pick), veterans, parents, people your age, disability
    community, women focused, men focused, sober friendly, a language other than English.
12. **A few practical things.** Age range (for minimum ages), student and which school, access needs,
    languages, faith groups (include, exclude, only my tradition), and "I'd rather avoid roles that
    need a background check" (neutral wording that quietly serves people with records).

## 3. Matching

Everything runs in the browser from `groups.json`. It is plain rules, so every result can be explained.

**Hard filters** (a group that fails is never shown in quiz results):
- hidden, defunct, dormant, partisan, or below tier 1;
- not open to this person (students only groups for other schools, members only, minimum age);
- support groups unless the person asked for support;
- faith groups if the person excluded them, or other traditions if they chose "only mine";
- cost above the stated budget when the person chose "free only" or "a little";
- a must have access need the group cannot meet (unknown is allowed, with a note);
- clearances or background checks when the person asked to avoid them;
- path rules (section 6).

**Score** (each part from 0 to 1, then weighted):

| Part | Weight | What it measures |
|---|---|---|
| Interest | 30% | Loved tags count fully, liked tags 0.6, a neighbor in the interest graph 0.4 |
| Motive | 20% | How well the group serves the person's top reasons for coming |
| Practical | 20% | Schedule overlap, travel time against the person's limit (by SEPTA or walking), commitment, group size, cost preference |
| Format | 10% | Whether the group does things the way the person likes |
| Newcomer welcome | 10% | `newcomer_friendliness`; rises to 20% for people who said strangers are hard |
| Regular place | 5% | Recurring, place based, drop in friendly groups (third places build ties) |
| Confidence | 5% | Research tier and how recent the last sign of life is |

**Variety.** After scoring, results are picked one at a time with a penalty for repeating an interest
family or parent organization already chosen, so eight results are not eight running clubs.

**Explanations.** Built from the two or three parts that contributed most, in the person's own terms:
"You picked hiking and said you want to meet people. They walk the Wissahickon every Saturday
morning, 25 minutes from Fishtown on SEPTA. Beginners are paired with a regular."

## 4. Stretches and the wildcard

A stretch changes exactly **one** thing and keeps everything else familiar and practical:

| Stretch | Label | What changes | Example |
|---|---|---|---|
| Topic | One step sideways | A neighboring interest, same format and crowd | Hiking club to a trail building crew |
| Way in | Same thing, new way in | Same interest, a new way to engage (do it, learn it, teach it, serve it, lead it) | Book club to literacy tutoring or Books Through Bars |
| Crowd | New crowd | Same interest and format, a group that mixes ages, neighborhoods or backgrounds | A neighborhood running club across the city, or an intergenerational garden |
| Depth | Next rung | A bigger role in something the person already does | Regular volunteer to shift lead |

Rules:
- Practical limits are never stretched: cost, schedule, travel, access, age, safety, clearances.
- Support groups are never stretches. Faith groups are stretches only for people who included faith.
- Stretches toward a growth goal from question 4 are preferred.
- Every stretch is labeled and says why: "This is a stretch: it's teaching instead of doing, but it's
  still books, still Tuesday evenings, still close to home."

The **wildcard** is something the person would never pick, chosen from groups that are very welcoming
to newcomers, free or cheap, drop in or one time, and practical for them, preferring uniquely Philly
and bridging groups (a Mummers string band's open rehearsal, a Chinatown lion dance class, a learn to
row day on Boathouse Row). It must connect honestly to something the person said ("You like music and
big crowds").

**The adventure dial** (on the results page):

| Setting | Close fits | Stretches | Wildcard |
|---|---|---|---|
| Gentle | 7 | 1 | 0 |
| Balanced (default) | 5 | 2 | 1 |
| Bold | 4 | 3 | 1 |

"Surprise me" on question 2 starts the dial at Bold.

## 5. Results and group pages

**Each result card:** name; one line on what they do; label (close fit, stretch type, wildcard); two
or three "why it fits" lines; the first step; badges (newcomers welcome, free, kids OK, wheelchair
access, languages, clearances needed); last seen active. Actions: Save · Plan it · Send to a friend ·
Not for me.

**"Not for me"** asks why with one tap (too far, wrong time, not my thing, too intense, already in
it), adjusts the weights for this session, and fills the slot.

**Each group page:** what they do (our words); who it's for; when and where with a small map and the
nearest SEPTA stop; the first visit (can I just show up, what happens, what to bring, a line that says
feeling unsure the first time is normal and most groups were glad someone new came); cost and
commitment; access and languages; requirements, with Pennsylvania child clearances explained in plain
words and linked; contacts as published, each with its source; "one step sideways from here" (three
neighboring groups); sources and last checked; links to correct this listing, say "I run this group",
or ask for removal (GitHub issue forms).

## 6. Paths

- **Service hours for school:** age, hours needed, deadline, whether a signed form is needed, school.
  Only groups whose minimum age fits; groups that sign hour forms first; a short guide to asking for
  sign off.
- **Court ordered community service:** hours, deadline, any restrictions (for example no work with
  children). Only groups with `court_ordered_ok: yes` backed by a source. A plain, judgment free guide
  to how court ordered service works in Philadelphia, and a reminder to confirm with the probation
  officer or program before starting.
- **Families with young kids:** children's ages; only `kids_ok` groups with fitting minimum ages;
  stroller and nap time friendly hints where known.
- **New to Philly:** how long you have been here, then the neighborhood starter pack (section 8) and
  groups that are good at welcoming newcomers (civic associations, walking tours, library programs,
  newcomer meetups).
- **Students:** pick a school once; that school's groups join the pool.
- **Support groups:** topic (grief, recovery, caregiving, mental health, chronic illness, parenting,
  LGBTQ support and more); 988 and other crisis lines shown first; mostly links to the meeting
  finders that already exist rather than copies of meeting lists.

## 7. Follow through

- **Plan it:** pick a date for the first visit; the site writes it as a sentence ("Saturday at 9 I
  will meet the trail crew at Valley Green") and offers a calendar file with reminders the day before
  and two hours before.
- **Send to a friend:** a ready to send message with the link (phone share sheet or a text link).
- **My list:** saved groups and planned visits, kept in this browser only, with export and import.
- **Check in:** on the next visit to the site, "Did you go to the trail crew?" Yes: how was it, then
  the next rung (more like it, a bigger role, or a stretch). Not yet: what got in the way (time,
  nerves, cost, never heard back), then a fix for that reason (a friend invite and the first visit
  guide for nerves, a similar group for no reply). A gentle note that most people need about three
  visits before a group feels like theirs.

## 8. Your neighborhood

Type an address. The site geocodes it with the City's address service and shows, from City data
bundled with the site: the registered community organizations covering it, the nearest library branch
and rec center with their programs and Friends groups, nearby park Friends groups, the police district
advisory council, the council district, and how to become a block captain or join a town watch.
Nothing is sent anywhere except the address lookup to the City.

## 9. Voice and accessibility

- Plain, warm and direct; aimed at a sixth to eighth grade reading level; no guilt, no jargon.
- No dashes as punctuation in any interface text.
- "What's a jawn?" explainer: "Jawn: Philly for almost anything. Here, it means your thing, your
  place, your people."
- Phone first, fast on slow connections, works with screen readers and keyboard, WCAG 2.2 AA, large
  tap targets, never color alone.
- All interface text in one strings module, so Spanish and other languages can be added.

## 10. Privacy

No accounts, no cookies, no tracking or analytics at launch. Quiz answers, saved lists and check ins
live only in this browser (storage keys start with `fyj:`), with a "forget everything" button. Shared
links carry only group ids, never answers.

## 11. Stack and layout

- `pipeline/`: Python. Harvest, merge, triage, research import, liveness checks, coverage estimates,
  and the build that writes `site/public/data/`.
- `site/`: TypeScript with Astro for static pages (every group and interest page is real HTML),
  Preact islands for the quiz, results, browse and map, MapLibre with a self hosted basemap.
  The matching engine is a pure TypeScript module (`site/src/engine/`) with its own tests.
- `data/`: leads, groups, vocabularies, seeds. `registry/`: sources. `research/`: reports, wave logs,
  coverage.
- GitHub Actions: tests on every push, Pages deploy, weekly refresh.
- Hosted at holdthedoorhoid.github.io/find-your-jawn until the owner picks a domain.

## 12. Testing

- Engine tests against fixture people with properties that must always hold: a court ordered person
  sees only groups with a sourced yes; a 15 year old never sees an 18 plus group; "free only" never
  shows a paid group; every stretch differs from the person's answers on exactly one axis; no more
  than two results share an interest family; people who find strangers hard get groups rated 3 or
  higher for newcomers.
- Fixture people: a teen needing 40 hours, a retiree new to Philly, a night shift nurse, a wheelchair
  user, a grad student who knows nobody, a parent of toddlers, someone with court ordered hours, a shy
  introvert, an extrovert who loves team sports, a Spanish speaker with some English.
- Browser tests of the full quiz on a phone sized screen; persona testers before launch.

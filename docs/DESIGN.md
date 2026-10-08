# Product design

How the site works for a visitor. The owner's decisions are in `docs/PLAN.md` section 2; the evidence
behind each rule is in `docs/research/scouting/evidence.md`. Field names refer to
`docs/DATA_MODEL.md`.

## 1. Pages

| Page | Purpose |
|---|---|
| Home | Two big doors: "Match me" and "Browse everything". A one line "What's a jawn?" explainer. Links to the four paths and to support groups |
| Quiz | About eleven short screens (pictures, choices, a taste test of real groups), every question skippable |
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

## 2. The quiz: getting real answers in few taps

The quiz is the heart of the site, so it follows a small set of question rules. The evidence is in
`docs/research/scouting/evidence.md` and `docs/research/scouting/question-design.md` (all 17 claims
checked; corrections applied below).

### 2.1 Question rules

1. **Every question must earn its place.** A question stays only if it changes people's results. We
   measure this with simulated people (section 12) and cut or reorder questions that do not pull
   their weight.
2. **Ask about moments, not adjectives.** What people have actually done predicts what they will do
   better than how they describe themselves. "Pick the Saturday mornings that sound good" beats "Are
   you outdoorsy?"
3. **Show, don't ask.** People recognize what they like far more easily than they can list it, and
   they often discover a preference only when they see a real option. So the quiz uses concrete
   scenes and a round of reacting to real groups. Pictures change how people weigh options and can
   slow some people down, so scenes are piloted both with and without pictures before we commit.
4. **Make people choose.** Asked to rate reasons for joining, nearly everyone gives "helping others"
   top marks. Asking which reason matters MOST and which matters LEAST gets honest, usable answers.
5. **Deal breakers apart from wishes.** People narrow choices by first ruling out what cannot work.
   Each practical answer has a lock: locked means never show anything that breaks it; unlocked means
   "prefer".
6. **The answers that matter most come while attention is fresh.** Answer quality drops the later a
   question sits, so after a quick, fun warm up, the deal breakers come second. Optional personal
   questions come last.
7. **Privacy notes only where they matter.** A short "this never leaves your device" note sits on the
   sensitive questions (communities, background checks, support). Putting it on every question makes
   people more suspicious, not less.
8. **No order effects.** Options, scenes and taste test cards appear in a shuffled order, so the first
   option is not favored just for being first.
9. **Progress that feels quick.** The progress bar moves fast at the start and slows near the end,
   which keeps more people going than a steady bar.
10. **Ask only what matters for you.** After the core questions the quiz picks follow ups by how much
    each could change your results, and stops as soon as no remaining question could.
11. **Reflect it back.** Before results, "Here's what we heard" shows the answers as chips the person
    can fix with one tap. Catching a misread here is cheaper than a wrong result.
12. **No personality labels.** No "You're an Explorer!" types (vague labels feel accurate to everyone
    and mean nothing). Only concrete groups and concrete reasons.
13. **No wrong reasons.** The quiz says plainly that building a resume, needing hours or just getting
    out of the house are all good reasons, so people answer honestly.
14. **Light to answer.** One decision per screen, big tap targets, short words with icons, plain
    gestures (no tap twice tricks), "skip" and "not sure" everywhere, readable for people still
    learning English. Target: under four minutes.

### 2.2 The flow

**Start: "What brings you here?"** (pick any) Just exploring · I need service hours (school or court)
· I'm new to Philly · I'm a student (which school) · I'm bringing my kids · I'm looking for a support
group. These open the paths (section 6). Support groups leave the quiz for their own calm flow.

**Stage 1, warm up: picture it**

1. **"Pick the Saturday mornings that sound good."** Twelve scene cards, each a concrete moment that
   combines an activity with a way of being with people: pulling weeds with neighbors in a community
   garden; learning lion dance moves; coaching eight year olds at basketball; crawling through a cave
   with a headlamp; a pickup soccer game; talking books over coffee; sorting food pantry donations
   with music on; rehearsing a community play; mapping street trees with an app; running a meeting
   about your block; fixing bikes; walking shelter dogs. The twelve cover every activity type and
   social setting; if the picks are few or mixed, a second set of eight follows.
2. **"When did you last lose track of time?"** Pick moments: making something, solving a puzzle,
   moving my body, outdoors, a long talk, helping someone, performing, organizing a plan, learning
   something new, caring for animals or plants. Optional words of your own, matched to tags.

**Stage 2, deal breakers (one or two screens, each answer with a lock)**

3. When you are free (days and parts of the day, or "it changes week to week" for shift workers),
   how often, how far (walking, SEPTA minutes, anywhere, I drive), budget. Then a short "anything
   that rules things out?" screen: age range, access needs, languages, school, faith groups (include,
   exclude, only my tradition), and "I'd rather avoid roles that need a background check" (with the
   privacy note). Everything here is optional.

**Stage 3, what you're into**

4. **"What are you into?"** Interest families as tiles with examples under each ("Outdoors: hiking,
   caving, kayaking, birding"). Pick any. Then **"Star up to three you love"**, and only starred
   families open up to their specific interests, so nobody wades through 150 tags.

Stages 1 and 3 together set three signals: interests (topics), **roles** (what you do: hands on,
figuring things out, creating, helping and teaching, leading, organizing; a compact version of the
Holland interest types, which also predict satisfaction in leisure), and **formats** (side by side,
conversation, team, making or performing together, behind the scenes, learning a skill).

**Stage 4, why and who**

5. **"Which reason is MOST like you, and which is LEAST?"** Six reasons on one screen (meet people,
   do something that matters, learn something, build skills for work, get out of my head and feel
   better, feel good about myself). Then the same for the four that remain. Four taps give a nearly
   complete ranking of the six volunteer motives.
6. **"Who would you like to meet?"** People a lot like me · People different from me · A mix. People
   around my age, or all ages. Optional, with the privacy note: communities you would like to find
   people from (LGBTQ+, a heritage, a faith, veterans, parents, disability community, sober friendly,
   a language).
7. **"Walking into a room of strangers feels..."** five steps from "exciting" to "really hard", with
   "I'd rather bring someone" and preferred group size. Then two quick items on newness: "I like
   trying things I've never done" (agree or not) and "The last time you tried something totally new,
   how did it go?" These tune how big each stretch step is and how much newcomer welcome matters.
   Two short items are rough measures, so they only steer these low stakes settings. They never
   change the default number of stretches (the owner set Balanced as the default); someone who finds
   newness hard sees a gentle note offering the Gentle setting.

**Stage 5, your future self**

8. **"A year from now, what would you love to be able to say?"** (pick up to two) I know my neighbors
   by name · I'm a regular somewhere · I made something with my own hands · I can hold a conversation
   in another language · I helped someone through a hard time · I'm in the best shape in years · I
   spoke up in front of a group · I learned a real skill · I changed something on my block · I have a
   friend I didn't have before. Stretches aim at these, so growth is chosen, not assigned.

**Stage 6, the taste test**

9. **Six to eight real groups, one tap each: Into it · Maybe · Not for me.** The engine picks cards
   that teach it the most: strong candidates (already within the person's deal breakers) that differ
   on whatever it is least sure about, plus one or two probes from further away. "Not for me" asks
   why with one tap (too far, wrong time, not my thing, too intense, too many people, cost). Each
   reaction shifts the weights for this person, the way a good friend learns your taste by watching
   what you light up at.

**Stage 7, quick follow ups (zero to three)**

10. Drawn from a pool (indoors or outdoors in the cold months, competitive or casual, online OK, one
    time events or ongoing, kids along) and asked only when the answer would change the top eight.
    Most people get one or none.

**Stage 8, "Here's what we heard"**

11. A one screen summary as chips ("Meet people · Outdoors and animals · Weekends · Up to 30 minutes
    on SEPTA · Free · Stretch toward: speaking up") that the person can tap to fix. Then results.

About eleven screens in all, most of them a few taps.

## 3. Matching

Everything runs in the browser from `groups.json`. It is plain rules, so every result can be explained.

**Hard filters** (a group that fails is never shown in quiz results):
- hidden, defunct, dormant, partisan, or below tier 1;
- not open to this person (students only groups for other schools, members only, minimum age);
- support groups unless the person asked for support;
- faith groups if the person excluded them, or other traditions if they chose "only mine";
- anything that breaks a locked answer (cost, schedule, distance, access, background checks);
- path rules (section 6).

**Score** (each part from 0 to 1, then weighted):

| Part | Weight | What it measures |
|---|---|---|
| Interest | 25% | Topic tiles (starred counts fully, picked 0.6), scene and moment picks, neighbors in the interest graph (0.4) |
| Motive | 20% | Best and worst ranking of the six reasons against what the group offers |
| Role and format | 15% | What you would do there and how you would be with people, from the scenes and moments |
| Practical | 15% | Unlocked preferences: schedule overlap, travel time, commitment, group size, cost |
| Taste test | 10% | Similarity to groups marked "into it", distance from groups marked "not for me" and their reasons |
| Newcomer welcome | 10% | `newcomer_friendliness`; rises to 20% for people who said strangers are hard |
| Regular place | 3% | Recurring, place based, drop in friendly groups (third places build ties) |
| Confidence | 2% | Research tier and how recent the last sign of life is |

Weights are starting values. The simulation in section 12 tunes them, and every change is recorded
in this table.

**Gaps in the data.** Real records are uneven, so the engine never treats "we do not know" as "no".
A fact a group's page does not give scores neutral (about 0.5) on that part, and the confidence part
reflects how thin the record is. A locked answer on a fact we do not have lets the group through as
"unknown": it is shown after every group we could confirm, and its card says what is not listed ("Cost
not listed.", "Location not listed."). Court ordered service is the one exception, because we never
infer it: only a yes counts. The role and format part also includes who is in the room, from the "who
would you like to meet" answers. These choices are implemented in `site/src/engine/`.

**Variety.** After scoring, results are picked one at a time with a penalty for repeating an interest
family or parent organization already chosen, so eight results are not eight running clubs.

**Explanations.** Built from the two or three parts that contributed most, in the person's own terms:
"You picked the trail scene and said you want to meet people. They walk the Wissahickon every Saturday
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
- Stretches toward the person's future self picks (question 8) are preferred, and the newness answers (question 7) set how far each step goes.
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

A person can switch the dial at any time; results update instantly.

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
  guide for nerves, a similar group for no reply). A gentle, honest note: places and faces feel more
  familiar with every visit, so it is worth going back a couple of times before deciding; real
  friendships take many hours together, and that is normal.

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

**How we know the questions work.** The engine is a plain TypeScript module, so we can test the quiz
itself, not just the code:

- **Simulated people.** Generate thousands of synthetic people, each with a hidden "true" taste
  (interests, motives, roles, constraints, comfort with strangers) drawn from realistic mixes plus the
  fixture people above. Simulate how they answer, including the known distortions: rating virtuous
  reasons too high, picking the first option when tired, skipping. Then measure how often groups that
  truly fit them land in the top eight.
- **Value per second.** Remove or reorder one question at a time and measure the change in that hit
  rate against the seconds the question costs. Questions that add little get cut; the best ones move
  earlier. The same runs tune the score weights in section 3 and decide how many taste test cards are
  worth showing.
- **Stretch quality.** Check that stretches change exactly one thing, and that in simulation people
  with a future self goal get stretches toward it.
- **Real people.** Persona testers (agents driving a real browser) for clarity and timing, then a few
  real people of different ages, backgrounds and reading levels, recruited by the owner, who think
  aloud while taking the quiz. On the results page a "Do these feel right?" thumbs up or down is
  stored only in the visitor's browser and shapes their own next results. Nothing is collected
  centrally unless the owner later decides to add an opt in, anonymous feedback route.

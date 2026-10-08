// Writes fixtures/data/ : made up sample data in the exact shapes of docs/DATA_MODEL.md section 5.
// Every group here is fictional. Run with `npm run fixtures`. The output is committed so the site
// builds without the pipeline; `npm run prepare-data` copies it into public/data/ only when the
// real pipeline output (public/data/groups.json) is not there.
//
// Usage: node fixtures/make-fixtures.mjs [outDir] [--scale N]
//   --scale N  also writes N synthetic groups (for speed tests), derived from the hand written ones.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const scaleAt = args.indexOf('--scale');
const scale = scaleAt >= 0 ? Number(args[scaleAt + 1]) : 0;
const outDir = path.resolve(args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--scale') ?? path.join(here, 'data'));

const BUILT = '2026-10-08';

// ---------------------------------------------------------------- vocabulary

const families = [
  { id: 'outdoors-adventure', label: 'Outdoors and adventure', icon: '🥾', examples: 'hiking, caving, birding, trail work', tags: ['caving', 'hiking', 'birding', 'trail-building', 'rowing'] },
  { id: 'civic-neighborhood', label: 'Civic and neighborhood', icon: '🏘️', examples: 'civic associations, block groups, park friends', tags: ['neighborhood-association', 'park-friends', 'block-captain', 'community-meetings'] },
  { id: 'food-gardens', label: 'Food and gardens', icon: '🌱', examples: 'community gardens, tree tending, food pantries', tags: ['community-gardening', 'street-trees', 'food-pantry', 'cooking'] },
  { id: 'helping-volunteering', label: 'Helping and volunteering', icon: '🤝', examples: 'tutoring, food banks, mutual aid', tags: ['tutoring', 'food-bank', 'mutual-aid', 'immigrant-support'] },
  { id: 'arts-culture', label: 'Arts and culture', icon: '🎨', examples: 'pottery, knitting, heritage groups, theater', tags: ['pottery', 'knitting', 'heritage', 'theater'] },
  { id: 'music-performance', label: 'Music and performance', icon: '🎺', examples: 'string bands, lion dance, orchestras, open mics', tags: ['string-band', 'lion-dance', 'orchestra', 'poetry', 'open-mic'] },
  { id: 'books-learning', label: 'Books and learning', icon: '📚', examples: 'book clubs, poetry, language practice', tags: ['books', 'writing', 'languages'] },
  { id: 'sports-fitness', label: 'Sports and fitness', icon: '🏀', examples: 'pickup soccer, rowing, walking clubs', tags: ['soccer', 'basketball', 'walking', 'rowing', 'running'] },
  { id: 'games-hobbies', label: 'Games and hobbies', icon: '♟️', examples: 'chess, board games, bike repair', tags: ['chess', 'board-games', 'bike-repair'] },
  { id: 'family-parenting', label: 'Family and parenting', icon: '👨‍👩‍👧', examples: 'playgroups, parent networks, kid friendly outings', tags: ['playgroups', 'parenting'] },
  { id: 'communities-heritage', label: 'Communities and heritage', icon: '🌍', examples: 'affinity groups, newcomer networks, cultural groups', tags: ['lgbtq', 'newcomers', 'seniors'] },
];

const districts = [
  ['central', 'Central'],
  ['river-wards', 'River Wards'],
  ['lower-north', 'Lower North'],
  ['upper-north', 'Upper North'],
  ['north-delaware', 'North Delaware'],
  ['central-northeast', 'Central Northeast'],
  ['lower-northeast', 'Lower Northeast'],
  ['lower-northwest', 'Lower Northwest'],
  ['upper-northwest', 'Upper Northwest'],
  ['west', 'West'],
  ['west-park', 'West Park'],
  ['university-southwest', 'University Southwest'],
  ['lower-southwest', 'Lower Southwest'],
  ['south', 'South'],
  ['lower-south', 'Lower South'],
];

const neighborhoods = [
  ['mayfair', 'Mayfair', 'lower-northeast'],
  ['fishtown', 'Fishtown', 'river-wards'],
  ['rittenhouse', 'Rittenhouse', 'central'],
  ['germantown', 'Germantown', 'lower-northwest'],
  ['mount-airy', 'Mount Airy', 'upper-northwest'],
  ['spruce-hill', 'Spruce Hill', 'university-southwest'],
  ['point-breeze', 'Point Breeze', 'lower-south'],
  ['passyunk', 'East Passyunk', 'south'],
  ['olney', 'Olney', 'upper-north'],
  ['hunting-park', 'Hunting Park', 'lower-north'],
  ['overbrook', 'Overbrook', 'west-park'],
  ['kingsessing', 'Kingsessing', 'lower-southwest'],
  ['tacony', 'Tacony', 'north-delaware'],
  ['oxford-circle', 'Oxford Circle', 'central-northeast'],
  ['cobbs-creek', 'Cobbs Creek', 'west'],
].map(([id, label, planning_district]) => ({ id, label, planning_district }));

const vocab = {
  interests: {
    families: families.map((f) => ({ ...f, tags: f.tags.map((t) => ({ id: t, label: t.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase()) })) })),
  },
  motives: [
    { id: 'values', label: 'Do something that matters' },
    { id: 'understanding', label: 'Learn something' },
    { id: 'social', label: 'Meet people' },
    { id: 'career', label: 'Build skills for work' },
    { id: 'protective', label: 'Get out of my head' },
    { id: 'enhancement', label: 'Feel good about myself' },
  ],
  formats: [
    { id: 'side_by_side', label: 'Side by side' },
    { id: 'conversation', label: 'Conversation' },
    { id: 'learn_skill', label: 'Learn a skill' },
  ],
  roles: [
    { id: 'hands_on', label: 'Hands on' },
    { id: 'help_teach', label: 'Helping and teaching' },
  ],
  audiences: [
    { id: 'all_adults', label: 'Adults of all ages' },
    { id: 'families', label: 'Families' },
  ],
  kinds: [
    { id: 'nonprofit', label: 'Nonprofit' },
    { id: 'civic', label: 'Civic group' },
  ],
  neighborhoods: {
    planning_districts: districts.map(([id, label]) => ({ id, label })),
    neighborhoods,
  },
};

// ---------------------------------------------------------------- groups

const hood = (id) => neighborhoods.find((n) => n.id === id);
const loc = (neighborhoodId, label, address, transit, extra = {}) => ({
  label,
  address,
  neighborhood: neighborhoodId,
  zip: null,
  lat: null,
  lng: null,
  in_city: true,
  transit,
  planning_district: hood(neighborhoodId)?.planning_district ?? null,
  ...extra,
});

function base(over) {
  const id = over.id;
  const site = `https://example.org/${id}`;
  const tier = over.research_tier ?? 1;
  const deep = tier >= 2;
  const g = {
    id,
    name: over.name,
    aka: [],
    leads: [`manual_seeds:${id}`],
    ein: null,
    summary: over.summary,
    what_you_do: null,
    kind: 'club',
    categories: ['games-hobbies'],
    interests: [],
    motives: ['social'],
    formats: ['side_by_side'],
    roles: ['hands_on'],
    crowd: ['all_adults'],
    bridging: false,
    audience: { open_to: 'public', school: null, min_age: null, max_age: null, community: [], faith: null, partisan: false, support_group: false },
    schedule: { text: null, days: [], times: [], recurring: true, season: 'year_round' },
    locations: [],
    online_ok: false,
    cost: { level: 'free', text: null },
    commitment: 'weekly',
    group_size: 'small',
    access: { wheelchair: 'unknown', languages: ['en'], notes: null },
    requirements: { act153_clearances: false, background_check: false, court_ordered_ok: 'unknown', service_hours_letter: 'unknown', kids_ok: false, gear: null },
    first_step: { how: null, drop_in: null, sign_up_needed: null, newcomer_friendliness: null, basis: null, what_to_expect: null, first_visit_tips: [] },
    contacts: { website: site, email: null, phone: null, contact_name: null, social: [], calendar_feed: null },
    status: 'active',
    last_sign_of_life: '2026-09',
    sign_of_life_url: site,
    sources: [{ url: site, seen: '2026-10-05', fields: ['name', 'summary', 'contacts.website'] }],
    research_tier: tier,
    confidence: deep ? 'high' : 'medium',
    last_checked: deep ? '2026-10-06' : '2026-10-05',
    hidden: false,
    hidden_reason: null,
  };
  // shallow merge per section so each fixture only states what differs
  for (const [k, v] of Object.entries(over)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && g[k] && typeof g[k] === 'object' && !Array.isArray(g[k])) g[k] = { ...g[k], ...v };
    else g[k] = v;
  }
  return g;
}

const hand = [
  base({
    id: 'example-street-tree-tenders',
    name: 'Example Street Tree Tenders',
    summary: 'Neighbors who water, prune and map the street trees on their blocks, and plant new ones each spring.',
    what_you_do: 'Meet on Saturday mornings to water young trees, pull weeds from tree pits and log each tree on a shared map.',
    kind: 'civic',
    categories: ['civic-neighborhood', 'food-gardens'],
    interests: ['street-trees', 'neighborhood-association'],
    motives: ['values', 'social'],
    formats: ['side_by_side'],
    bridging: true,
    crowd: ['families', 'all_adults'],
    schedule: { text: 'Most Saturday mornings from spring to fall, plus a planting day in April', days: ['sat'], times: ['morning'], season: 'year_round' },
    locations: [loc('mayfair', 'Meet at the corner shelter', '123 Example Ave', 'Route 14 bus to Example Ave')],
    cost: { level: 'free', text: 'No cost. Gloves and tools are provided.' },
    commitment: 'drop_in',
    group_size: 'medium',
    access: { wheelchair: 'unknown', languages: ['en', 'es'], notes: 'Work happens on sidewalks. Ask about tasks that can be done sitting down.' },
    requirements: { court_ordered_ok: 'unknown', service_hours_letter: 'yes', kids_ok: true, gear: 'Closed toe shoes and a water bottle' },
    audience: { min_age: 10 },
    first_step: {
      how: 'Come to any Saturday session and ask for the crew lead in the green vest',
      drop_in: true,
      sign_up_needed: false,
      newcomer_friendliness: 5,
      basis: 'The group invites first timers on its page and pairs each newcomer with a regular',
      what_to_expect: 'You will get a short tour of the block, a pair of gloves and a simple job. Most people stay for about two hours. Someone will sign your service hours form if you bring one.',
      first_visit_tips: ['Wear shoes you do not mind getting muddy', 'Bring water', 'Tell the lead if you have a form to sign'],
    },
    contacts: { website: 'https://example.org/example-street-tree-tenders', email: 'trees@example.org', phone: '215-555-0142', contact_name: 'Pat Example', social: ['https://example.org/social/tree-tenders'] },
    sources: [
      { url: 'https://example.org/example-street-tree-tenders', seen: '2026-10-05', fields: ['name', 'summary', 'schedule', 'contacts.website', 'contacts.email', 'requirements.service_hours_letter'] },
      { url: 'https://example.org/directory/tree-tenders', seen: '2026-10-06', fields: ['contacts.phone', 'contacts.contact_name'] },
    ],
    research_tier: 2,
    last_sign_of_life: '2026-10',
  }),
  base({
    id: 'example-caving-club',
    name: 'Example Caving Club',
    summary: 'A caving club that runs weekend trips to caves in Pennsylvania and nearby states, and teaches beginners how to cave safely.',
    what_you_do: 'Monthly meetings, weekend trips and gear days. Beginners go with experienced members.',
    categories: ['outdoors-adventure'],
    interests: ['caving', 'hiking'],
    motives: ['understanding', 'social'],
    formats: ['learn_skill', 'side_by_side'],
    schedule: { text: 'First Thursday evening meeting each month, trips on weekends', days: ['thu', 'sat', 'sun'], times: ['evening', 'daytime'] },
    locations: [loc('rittenhouse', 'Monthly meeting', '45 Example St', 'Walnut Locust Station', { in_city: true })],
    cost: { level: 'low', text: 'Yearly dues. Trips cost gas and gear rental.' },
    commitment: 'monthly',
    audience: { min_age: 18 },
    access: { wheelchair: 'no', languages: ['en'], notes: 'Caves involve crawling and climbing. The meetings are in a regular room.' },
    requirements: { gear: 'Helmet and lights. The club lends gear to beginners.' },
    first_step: {
      how: 'Come to a monthly meeting before you sign up for a trip',
      drop_in: true,
      sign_up_needed: false,
      newcomer_friendliness: 4,
      basis: 'The club site describes a beginner trip program',
      what_to_expect: 'Meetings have a short business part and a slide show from a recent trip. People stay to chat. Ask about the next beginner trip.',
      first_visit_tips: ['Introduce yourself to whoever is at the door', 'You do not need gear to come to a meeting'],
    },
    research_tier: 2,
  }),
  base({
    id: 'example-neighbors-association',
    name: 'Example Neighbors Association',
    summary: 'A registered civic association for one set of blocks. It holds monthly meetings about zoning, trash, safety and block parties.',
    kind: 'civic',
    categories: ['civic-neighborhood'],
    interests: ['neighborhood-association', 'community-meetings'],
    motives: ['values', 'social'],
    audience: { open_to: 'residents' },
    schedule: { text: 'Second Tuesday of the month at 7 pm', days: ['tue'], times: ['evening'] },
    locations: [loc('hunting-park', 'Meeting room', '800 Example Blvd', 'Broad Street Line, Erie Station')],
    commitment: 'monthly',
    group_size: 'medium',
    status: 'probably_active',
    last_sign_of_life: '2025-06',
    contacts: { website: 'https://example.org/example-neighbors-association', email: 'info@example.org', phone: null, contact_name: null, social: [], calendar_feed: null },
    sources: [{ url: 'https://example.org/rco-list', seen: '2026-10-04', fields: ['name', 'contacts.email'] }],
  }),
  base({
    id: 'example-library-knitting-circle',
    name: 'Example Library Knitting Circle',
    summary: 'A free knitting and crochet circle that meets in a library branch. Beginners get yarn and a lesson.',
    kind: 'program',
    categories: ['arts-culture'],
    interests: ['knitting'],
    motives: ['social', 'enhancement'],
    formats: ['side_by_side', 'learn_skill'],
    schedule: { text: 'Wednesday afternoons, 2 to 4 pm', days: ['wed'], times: ['afternoon'] },
    locations: [loc('germantown', 'Library meeting room', '6 Example Square', 'Route 23 bus')],
    commitment: 'drop_in',
    access: { wheelchair: 'yes', languages: ['en'] },
    first_step: {
      how: 'Walk in on any Wednesday afternoon',
      drop_in: true,
      sign_up_needed: false,
      newcomer_friendliness: 5,
      basis: 'The library lists the circle as open to all skill levels',
      what_to_expect: 'A volunteer will set you up with yarn and needles and teach a cast on. People chat while they work.',
      first_visit_tips: ['Bring a project if you have one', 'No need to know how to knit'],
    },
    research_tier: 2,
    last_sign_of_life: '2026-10',
  }),
  base({
    id: 'example-sunday-soccer',
    name: 'Example Sunday Pickup Soccer',
    summary: 'A casual pickup soccer game on a public field. Show up, split into teams and play.',
    kind: 'team',
    categories: ['sports-fitness'],
    interests: ['soccer'],
    motives: ['enhancement', 'social'],
    audience: { min_age: 16 },
    schedule: { text: 'Sunday mornings at 9 am, weather permitting', days: ['sun'], times: ['morning'] },
    locations: [loc('passyunk', 'Rec center field', '19 Example Field Rd', 'Route 29 bus')],
    cost: { level: 'free', text: null },
    commitment: 'drop_in',
    group_size: 'medium',
  }),
  base({
    id: 'example-youth-basketball',
    name: 'Example Youth Basketball League',
    summary: 'A low cost winter basketball league for school age kids, run by volunteer coaches.',
    kind: 'team',
    categories: ['sports-fitness', 'family-parenting'],
    interests: ['basketball'],
    motives: ['values'],
    crowd: ['families'],
    audience: { min_age: 6, max_age: 14 },
    schedule: { text: 'Saturday games, November to March', days: ['sat'], times: ['daytime'], season: 'winter' },
    locations: [loc('olney', 'Recreation center gym', '2200 Example Pl', 'Broad Street Line, Olney Station')],
    cost: { level: 'low', text: 'A small season fee. Ask about help with the fee.' },
    commitment: 'seasonal',
    group_size: 'large',
    requirements: { act153_clearances: true, background_check: true, kids_ok: true },
    access: { wheelchair: 'yes', languages: ['en', 'es'] },
    contacts: { website: 'https://example.org/example-youth-basketball', email: null, phone: '215-555-0166', contact_name: 'League desk', social: [], calendar_feed: null },
    sources: [{ url: 'https://example.org/example-youth-basketball', seen: '2026-10-05', fields: ['name', 'summary', 'contacts.website', 'contacts.phone', 'contacts.contact_name'] }],
  }),
  base({
    id: 'example-penn-board-game-society',
    name: 'Example Penn Board Game Society',
    summary: 'A student club that plays board games and card games every week. All skill levels welcome.',
    kind: 'student_org',
    categories: ['games-hobbies'],
    interests: ['board-games'],
    audience: { open_to: 'students', school: 'penn' },
    schedule: { text: 'Thursday nights during the school year', days: ['thu'], times: ['evening'], season: 'year_round' },
    locations: [loc('spruce-hill', 'Student center lounge', '3500 Example Walk', 'Trolley to 36th Street')],
    sources: [{ url: 'https://example.org/clubs/penn-board-games', seen: '2026-10-04', fields: ['name', 'audience.school'] }],
  }),
  base({
    id: 'example-drexel-bike-collective',
    name: 'Example Drexel Bike Collective',
    summary: 'Students fix bikes together in a shop on campus. Newcomers learn tune ups and flat repair.',
    kind: 'student_org',
    categories: ['games-hobbies'],
    interests: ['bike-repair'],
    audience: { open_to: 'students', school: 'drexel' },
    formats: ['learn_skill'],
    schedule: { text: 'Tuesday and Friday afternoons', days: ['tue', 'fri'], times: ['afternoon'] },
    locations: [loc('spruce-hill', 'Campus bike shop', '3100 Example Ct', null)],
    sources: [{ url: 'https://example.org/dragonlink/bike-collective', seen: '2026-10-04', fields: ['name', 'audience.school'] }],
  }),
  base({
    id: 'example-lower-south-garden',
    name: 'Example Lower South Community Garden',
    summary: 'A neighborhood garden with shared beds and a tool shed. Volunteers grow vegetables and give a share to a nearby pantry.',
    kind: 'garden',
    categories: ['food-gardens', 'civic-neighborhood'],
    interests: ['community-gardening'],
    motives: ['values', 'social'],
    bridging: true,
    schedule: { text: 'Work days on Saturdays 10 am to noon, April to October', days: ['sat'], times: ['morning'], season: 'spring' },
    locations: [loc('point-breeze', 'Garden', '1500 Example Garden Way', 'Route 17 bus')],
    commitment: 'drop_in',
    group_size: 'medium',
    access: { wheelchair: 'partial', languages: ['en', 'es'], notes: 'The paths are packed gravel. One raised bed is at wheelchair height.' },
    requirements: { kids_ok: true, court_ordered_ok: 'yes', service_hours_letter: 'yes', gear: 'Old clothes and sun protection' },
    first_step: {
      how: 'Come to a Saturday work day and check in at the shed',
      drop_in: true,
      sign_up_needed: false,
      newcomer_friendliness: 4,
      basis: 'Page says first time volunteers are welcome at every work day',
      what_to_expect: 'You will start with a simple job like weeding or watering. A garden leader will show you where the tools are. They will sign hours forms.',
      first_visit_tips: ['Bring a hat', 'You can leave when you need to'],
    },
    sources: [
      { url: 'https://example.org/example-lower-south-garden', seen: '2026-10-05', fields: ['name', 'summary', 'schedule', 'contacts.website'] },
      { url: 'https://example.org/example-lower-south-garden/volunteer', seen: '2026-10-05', fields: ['requirements.court_ordered_ok', 'requirements.service_hours_letter'] },
    ],
    research_tier: 2,
    last_sign_of_life: '2026-10',
  }),
  base({
    id: 'friends-of-example-park',
    name: 'Friends of Example Park',
    summary: 'A volunteer group that keeps a neighborhood park clean and hosts seasonal cleanups, movie nights and a spring plant sale.',
    kind: 'friends_group',
    categories: ['civic-neighborhood', 'outdoors-adventure'],
    interests: ['park-friends'],
    motives: ['values', 'social'],
    bridging: true,
    schedule: { text: 'Cleanup days on the first Saturday of the month', days: ['sat'], times: ['morning'] },
    locations: [loc('overbrook', 'Park entrance', '5900 Example Park Dr', 'Route 31 bus')],
    commitment: 'monthly',
    group_size: 'medium',
    requirements: { kids_ok: true },
    first_step: { how: 'Come to the next cleanup day and look for the sign at the entrance', drop_in: true, sign_up_needed: false, newcomer_friendliness: 3, basis: 'The group lists cleanup days as open to anyone', what_to_expect: null, first_visit_tips: [] },
    research_tier: 1,
  }),
  base({
    id: 'example-parish-pantry',
    name: 'Example Parish Food Pantry',
    summary: 'A food pantry run by a Catholic parish. Volunteers sort donations and help neighbors pick out groceries.',
    kind: 'congregation',
    categories: ['helping-volunteering', 'food-gardens'],
    interests: ['food-pantry'],
    motives: ['values'],
    audience: { faith: 'catholic', min_age: 14 },
    schedule: { text: 'Tuesday and Thursday mornings', days: ['tue', 'thu'], times: ['morning'] },
    locations: [loc('kingsessing', 'Parish hall', '6100 Example Ave', 'Route 108 bus')],
    commitment: 'weekly',
    group_size: 'medium',
    access: { wheelchair: 'yes', languages: ['en', 'es'] },
    requirements: { court_ordered_ok: 'yes', service_hours_letter: 'yes' },
    first_step: {
      how: 'Call or email the pantry coordinator to pick a first shift',
      drop_in: false,
      sign_up_needed: true,
      newcomer_friendliness: 4,
      basis: 'Volunteers are told to expect a short orientation at the start of the first shift',
      what_to_expect: 'You do not have to be Catholic to volunteer. A coordinator will walk you through the shift and sign your hours form.',
      first_visit_tips: ['Arrive ten minutes early', 'Wear shoes that cover your toes'],
    },
    contacts: { website: 'https://example.org/example-parish-pantry', email: 'pantry@example.org', phone: '215-555-0177', contact_name: 'Pantry coordinator', social: [], calendar_feed: null },
    sources: [
      { url: 'https://example.org/example-parish-pantry', seen: '2026-10-05', fields: ['name', 'summary', 'contacts.website', 'contacts.email', 'contacts.phone', 'contacts.contact_name', 'requirements.court_ordered_ok', 'requirements.service_hours_letter'] },
    ],
    research_tier: 2,
  }),
  base({
    id: 'example-interfaith-dinner-club',
    name: 'Example Interfaith Dinner Club',
    summary: 'People of different faiths and no faith share a meal once a month and talk about a question chosen by the hosts.',
    kind: 'network',
    categories: ['communities-heritage', 'food-gardens'],
    interests: ['cooking'],
    motives: ['social', 'understanding'],
    formats: ['conversation'],
    bridging: true,
    audience: { faith: 'interfaith' },
    schedule: { text: 'Last Sunday of the month at 5 pm', days: ['sun'], times: ['evening'] },
    locations: [loc('mount-airy', 'Rotating host homes and halls', null, null)],
    cost: { level: 'low', text: 'Bring a dish to share or chip in a few dollars.' },
    commitment: 'monthly',
  }),
  base({
    id: 'example-food-bank-volunteers',
    name: 'Example Neighborhood Food Bank Volunteers',
    summary: 'Volunteers pack boxes and run a weekly distribution for neighbors who need groceries.',
    kind: 'nonprofit',
    categories: ['helping-volunteering'],
    interests: ['food-bank'],
    motives: ['values'],
    audience: { min_age: 16 },
    schedule: { text: 'Saturday mornings, 8 am to noon', days: ['sat'], times: ['morning'] },
    locations: [loc('hunting-park', 'Warehouse', '3300 Example Industrial Way', 'Route 60 bus')],
    commitment: 'weekly',
    group_size: 'large',
    access: { wheelchair: 'yes', languages: ['en', 'es'] },
    requirements: { service_hours_letter: 'yes', gear: 'Closed toe shoes' },
    first_step: {
      how: 'Register for a shift on the volunteer page',
      drop_in: false,
      sign_up_needed: true,
      newcomer_friendliness: 4,
      basis: 'A staff member leads a short orientation each shift',
      what_to_expect: 'You will get a quick safety talk, then a station with a clear task like packing or sorting. They sign hour forms at the end of the shift.',
      first_visit_tips: ['Sign up online so they can plan', 'Ask for your hours form before you leave'],
    },
    sources: [{ url: 'https://example.org/example-food-bank-volunteers', seen: '2026-10-05', fields: ['name', 'summary', 'requirements.service_hours_letter'] }],
    research_tier: 2,
  }),
  base({
    id: 'example-literacy-tutors',
    name: 'Example Adult Literacy Tutors',
    summary: 'Volunteers tutor adults who want to read and write better, one on one or in small groups.',
    kind: 'nonprofit',
    categories: ['helping-volunteering', 'books-learning'],
    interests: ['tutoring', 'writing'],
    motives: ['values', 'career'],
    formats: ['learn_skill'],
    roles: ['help_teach'],
    audience: { min_age: 18 },
    schedule: { text: 'Weekday evenings, by appointment', days: ['mon', 'tue', 'wed', 'thu'], times: ['evening'] },
    locations: [loc('rittenhouse', 'Learning center', '1700 Example Sq', 'Walnut Locust Station')],
    commitment: 'ongoing_role',
    access: { wheelchair: 'yes', languages: ['en', 'es'] },
    requirements: { background_check: true },
    first_step: {
      how: 'Go to a volunteer information session',
      drop_in: false,
      sign_up_needed: true,
      newcomer_friendliness: 4,
      basis: 'The group runs training for every new tutor',
      what_to_expect: 'There is a two part training before you meet a learner. You choose a time that works for you.',
      first_visit_tips: ['Plan on about six hours of training'],
    },
    research_tier: 2,
  }),
  base({
    id: 'example-mummers-string-band',
    name: 'Example String Band',
    summary: 'A string band that rehearses all fall and marches on New Year\'s Day. Open rehearsals welcome people who want to watch or learn.',
    categories: ['music-performance'],
    interests: ['string-band'],
    motives: ['social', 'enhancement'],
    formats: ['learn_skill'],
    schedule: { text: 'Rehearsals on Wednesday evenings, September through December', days: ['wed'], times: ['evening'], season: 'fall' },
    locations: [loc('passyunk', 'Clubhouse', '2400 Example St', 'Broad Street Line, Snyder Station')],
    cost: { level: 'low', text: 'Costume fees come later in the fall.' },
    commitment: 'seasonal',
    group_size: 'large',
    status: 'probably_active',
    last_sign_of_life: '2025-01',
  }),
  base({
    id: 'example-lion-dance',
    name: 'Example Lion Dance Troupe',
    summary: 'A lion dance and drumming group that teaches beginners and performs at festivals.',
    categories: ['music-performance', 'communities-heritage'],
    interests: ['lion-dance'],
    motives: ['understanding', 'social'],
    formats: ['learn_skill', 'side_by_side'],
    schedule: { text: 'Saturday afternoons', days: ['sat'], times: ['afternoon'] },
    locations: [loc('rittenhouse', 'Practice hall', '1000 Example Way', 'Market East Station')],
    cost: { level: 'low', text: 'A monthly fee for the instructor.' },
    commitment: 'weekly',
    audience: { min_age: 8 },
    access: { wheelchair: 'unknown', languages: ['en', 'zh'] },
    requirements: { kids_ok: true },
    first_step: {
      how: 'Come to a Saturday session as a visitor first',
      drop_in: true,
      sign_up_needed: false,
      newcomer_friendliness: 5,
      basis: 'The troupe offers a free first class',
      what_to_expect: 'You will warm up with the group, learn a few steps and try the drums. No experience needed.',
      first_visit_tips: ['Wear clothes you can move in'],
    },
    research_tier: 2,
    bridging: true,
  }),
  base({
    id: 'example-open-mic-poetry',
    name: 'Example Open Mic Poetry Night',
    summary: 'A monthly poetry open mic. You can read your own work, read someone else\'s, or just listen.',
    categories: ['music-performance', 'books-learning'],
    interests: ['poetry', 'open-mic'],
    motives: ['enhancement', 'social'],
    schedule: { text: 'Third Friday of the month at 7:30 pm', days: ['fri'], times: ['evening'] },
    locations: [loc('fishtown', 'Cafe back room', '1 Example Cafe Row', 'Market Frankford Line, Girard Station')],
    online_ok: true,
    commitment: 'monthly',
    cost: { level: 'free', text: 'Free. Buy something at the cafe if you can.' },
    access: { wheelchair: 'yes', languages: ['en'] },
  }),
  base({
    id: 'example-pottery-studio',
    name: 'Example Community Pottery Studio',
    summary: 'A shared pottery studio with beginner classes and open studio hours for members.',
    kind: 'nonprofit',
    categories: ['arts-culture'],
    interests: ['pottery'],
    motives: ['enhancement'],
    formats: ['learn_skill'],
    audience: { min_age: 16 },
    schedule: { text: 'Classes on weeknights and Saturdays', days: ['mon', 'wed', 'sat'], times: ['evening', 'morning'] },
    locations: [loc('fishtown', 'Studio', '700 Example Clay Ln', 'Market Frankford Line, Girard Station')],
    cost: { level: 'paid', text: 'Classes cost about the same as a movie ticket each week.' },
    commitment: 'weekly',
  }),
  base({
    id: 'example-learn-to-row',
    name: 'Example Learn to Row',
    summary: 'A rowing club that runs learn to row days on the river and a summer program for beginners.',
    categories: ['sports-fitness', 'outdoors-adventure'],
    interests: ['rowing'],
    motives: ['enhancement'],
    formats: ['learn_skill'],
    audience: { min_age: 16 },
    schedule: { text: 'Learn to row days on summer Saturday mornings', days: ['sat'], times: ['morning'], season: 'summer' },
    locations: [loc('passyunk', 'Boathouse', '1 Boathouse Row', 'Route 32 bus')],
    cost: { level: 'paid', text: 'There is a fee for the learn to row program.' },
    commitment: 'seasonal',
    first_step: {
      how: 'Sign up for a learn to row day',
      drop_in: false,
      sign_up_needed: true,
      newcomer_friendliness: 4,
      basis: 'The club runs beginner days on a published calendar',
      what_to_expect: 'A coach teaches the basics on land, then you get on the water in a stable boat.',
      first_visit_tips: ['Wear clothes that dry fast'],
    },
    research_tier: 2,
  }),
  base({
    id: 'example-birdwatchers',
    name: 'Example Birdwatchers',
    summary: 'A birding group that walks local parks once a month. Binoculars to borrow for beginners.',
    categories: ['outdoors-adventure'],
    interests: ['birding', 'hiking'],
    motives: ['understanding', 'protective'],
    schedule: { text: 'One Sunday morning a month', days: ['sun'], times: ['morning'] },
    locations: [loc('mount-airy', 'Park gate', 'Example Nature Trail', 'Regional Rail, Example Station')],
    commitment: 'monthly',
    requirements: { kids_ok: true },
    access: { wheelchair: 'partial', languages: ['en'], notes: 'Some trails are paved and some are not.' },
  }),
  base({
    id: 'example-chess-in-the-park',
    name: 'Example Chess in the Park',
    summary: 'Free chess on tables in a city park. Players of every level drop in, and strong players teach.',
    categories: ['games-hobbies'],
    interests: ['chess'],
    motives: ['social', 'understanding'],
    schedule: { text: 'Saturday and Sunday afternoons, warm months', days: ['sat', 'sun'], times: ['afternoon'], season: 'summer' },
    locations: [loc('cobbs-creek', 'Park tables', '60th and Example Ave', 'Trolley route 34')],
    commitment: 'drop_in',
    access: { wheelchair: 'yes', languages: ['en', 'es'] },
    requirements: { kids_ok: true },
    first_step: {
      how: 'Walk up to a table and ask for a game',
      drop_in: true,
      sign_up_needed: false,
      newcomer_friendliness: 5,
      basis: 'The organizer confirmed that new players are welcome and that teaching is part of the day',
      what_to_expect: 'Boards and pieces are on the tables. People will play you or show you a few ideas.',
      first_visit_tips: ['You do not need to bring a set'],
    },
    research_tier: 3,
    confidence: 'high',
    last_sign_of_life: '2026-10',
  }),
  base({
    id: 'example-seniors-walking-club',
    name: 'Example Seniors Walking Club',
    summary: 'A walking club at a senior center. Walkers go at an easy pace, then have coffee.',
    kind: 'program',
    categories: ['sports-fitness', 'communities-heritage'],
    interests: ['walking', 'seniors'],
    motives: ['protective', 'social'],
    crowd: ['older_adults'],
    audience: { min_age: 55 },
    schedule: { text: 'Monday, Wednesday and Friday at 9:30 am', days: ['mon', 'wed', 'fri'], times: ['morning'] },
    locations: [loc('oxford-circle', 'Senior center front door', '7000 Example Blvd', 'Route 67 bus')],
    commitment: 'drop_in',
    access: { wheelchair: 'yes', languages: ['en'] },
    first_step: {
      how: 'Meet at the front door at 9:30 and tell the walk leader it is your first time',
      drop_in: true,
      sign_up_needed: false,
      newcomer_friendliness: 5,
      basis: 'The center describes the walk as open to all fitness levels',
      what_to_expect: 'A leader sets an easy pace and nobody gets left behind.',
      first_visit_tips: ['Wear comfortable shoes'],
    },
    research_tier: 2,
  }),
  base({
    id: 'example-rec-advisory-council',
    name: 'Example Recreation Advisory Council',
    summary: 'Neighbors who help the local recreation center plan programs and raise money for repairs.',
    kind: 'civic',
    categories: ['civic-neighborhood', 'family-parenting'],
    interests: ['community-meetings'],
    motives: ['values'],
    audience: { open_to: 'residents' },
    schedule: { text: 'Monthly evening meeting', days: ['wed'], times: ['evening'] },
    locations: [loc('kingsessing', 'Recreation center', '5200 Example Ave', 'Trolley route 11')],
    commitment: 'monthly',
    requirements: { kids_ok: true },
  }),
  base({
    id: 'example-immigrant-neighbors-network',
    name: 'Example Immigrant Neighbors Network',
    summary: 'A volunteer network that helps newcomers with English practice, paperwork questions and finding services.',
    kind: 'network',
    categories: ['helping-volunteering', 'communities-heritage'],
    interests: ['immigrant-support', 'newcomers', 'languages'],
    motives: ['values', 'social'],
    bridging: true,
    schedule: { text: 'English conversation hours on Tuesday evenings and Saturday mornings', days: ['tue', 'sat'], times: ['evening', 'morning'] },
    locations: [loc('olney', 'Community room', '5500 Example Rd', 'Broad Street Line, Olney Station')],
    online_ok: true,
    commitment: 'weekly',
    group_size: 'medium',
    access: { wheelchair: 'yes', languages: ['en', 'es', 'ht'] },
    requirements: { kids_ok: true },
    first_step: {
      how: 'Come to an English conversation hour, as a learner or a helper',
      drop_in: true,
      sign_up_needed: false,
      newcomer_friendliness: 5,
      basis: 'The group runs open sessions for both learners and volunteers',
      what_to_expect: 'You will be seated with a small group. Conversation topics are simple and friendly.',
      first_visit_tips: ['Bring a friend if you like'],
    },
    research_tier: 2,
  }),
  base({
    id: 'example-bike-repair-collective',
    name: 'Example Bike Repair Collective',
    summary: 'A volunteer run bike shop where anyone can fix their own bike with help, and teens can earn service hours.',
    kind: 'nonprofit',
    categories: ['games-hobbies', 'helping-volunteering'],
    interests: ['bike-repair'],
    motives: ['understanding', 'values'],
    formats: ['learn_skill', 'side_by_side'],
    audience: { min_age: 14 },
    schedule: { text: 'Thursday evenings and Saturday afternoons', days: ['thu', 'sat'], times: ['evening', 'afternoon'] },
    locations: [loc('fishtown', 'Shop', '2100 Example Garage St', 'Market Frankford Line, Girard Station')],
    commitment: 'drop_in',
    access: { wheelchair: 'no', languages: ['en'] },
    requirements: { service_hours_letter: 'yes' },
    first_step: {
      how: 'Drop in on a Thursday evening and say it is your first time',
      drop_in: true,
      sign_up_needed: false,
      newcomer_friendliness: 4,
      basis: 'The shop describes itself as a learning space for beginners',
      what_to_expect: 'A volunteer will teach you how to use the tools while you work on a bike.',
      first_visit_tips: ['Bring your own bike if you have one'],
    },
    research_tier: 2,
  }),
  base({
    id: 'example-grief-circle',
    name: 'Example Grief Circle',
    summary: 'A weekly peer support circle for adults grieving the death of someone close.',
    kind: 'support_group',
    categories: ['communities-heritage'],
    interests: [],
    motives: ['protective'],
    audience: { support_group: true, min_age: 18 },
    schedule: { text: 'Thursday evenings', days: ['thu'], times: ['evening'] },
    locations: [loc('rittenhouse', 'Meeting room', '1900 Example Pl', 'Walnut Locust Station')],
    commitment: 'weekly',
    access: { wheelchair: 'yes', languages: ['en'] },
  }),
  base({
    id: 'example-recovery-friends',
    name: 'Example Recovery Friends',
    summary: 'A peer recovery community with sober social events and weekly check in meetings.',
    kind: 'support_group',
    categories: ['communities-heritage'],
    interests: [],
    motives: ['protective', 'social'],
    audience: { support_group: true },
    schedule: { text: 'Tuesday and Saturday evenings', days: ['tue', 'sat'], times: ['evening'] },
    locations: [loc('hunting-park', 'Recovery center', '4200 Example Ave', 'Broad Street Line, Erie Station')],
    access: { wheelchair: 'yes', languages: ['en', 'es'] },
    first_step: { how: 'Call the center to ask about the next meeting', drop_in: true, sign_up_needed: false, newcomer_friendliness: 5, basis: 'The center asks newcomers to call or drop in', what_to_expect: null, first_visit_tips: [] },
    research_tier: 2,
  }),
  base({
    id: 'example-caregiver-coffee',
    name: 'Example Caregiver Coffee Hour',
    summary: 'A monthly coffee hour for people caring for a parent, partner or child with long term needs.',
    kind: 'support_group',
    categories: ['family-parenting'],
    interests: [],
    motives: ['protective', 'social'],
    audience: { support_group: true },
    schedule: { text: 'Second Saturday of the month, 10 am', days: ['sat'], times: ['morning'] },
    locations: [loc('germantown', 'Church hall', '5800 Example St', 'Regional Rail, Example Station')],
    commitment: 'monthly',
    requirements: { kids_ok: true },
  }),
  base({
    id: 'example-lgbtq-hiking-crew',
    name: 'Example Rainbow Hiking Crew',
    summary: 'An LGBTQ+ friendly hiking group. Easy to moderate hikes in parks near the city.',
    categories: ['outdoors-adventure', 'communities-heritage'],
    interests: ['hiking', 'lgbtq'],
    motives: ['social', 'protective'],
    bridging: true,
    audience: { community: ['lgbtq'] },
    schedule: { text: 'Most second Sundays at 10 am', days: ['sun'], times: ['morning'] },
    locations: [loc('mount-airy', 'Trailhead', 'Example Creek Trail', 'Regional Rail, Example Station')],
    commitment: 'monthly',
    first_step: {
      how: 'Message the organizer for the next trailhead and arrive ten minutes early',
      drop_in: false,
      sign_up_needed: true,
      newcomer_friendliness: 5,
      basis: 'The page says beginners and solo walkers are the norm',
      what_to_expect: 'Hikes take about two hours with a break. The group stays together and waits for slower walkers.',
      first_visit_tips: ['Bring water and a snack'],
    },
    research_tier: 2,
  }),
  base({
    id: 'example-parents-playgroup',
    name: 'Example Parents and Toddlers Playgroup',
    summary: 'A weekly playgroup in a church basement for parents and kids under five.',
    categories: ['family-parenting'],
    interests: ['playgroups', 'parenting'],
    motives: ['social'],
    crowd: ['families'],
    audience: { open_to: 'parents', max_age: 5 },
    schedule: { text: 'Tuesday and Thursday mornings', days: ['tue', 'thu'], times: ['morning'] },
    locations: [loc('tacony', 'Church hall', '4700 Example Rd', 'Route 66 bus')],
    commitment: 'drop_in',
    requirements: { kids_ok: true },
    access: { wheelchair: 'yes', languages: ['en'] },
    first_step: { how: 'Walk in during a session and say hello to the host', drop_in: true, sign_up_needed: false, newcomer_friendliness: 5, basis: 'The host asks first timers to introduce themselves', what_to_expect: 'Toys are out, snacks are shared, and parents chat. Strollers fit at the door.', first_visit_tips: ['Bring a snack for your child'] },
    research_tier: 2,
  }),
  base({
    id: 'example-community-orchestra',
    name: 'Example Community Orchestra',
    summary: 'A volunteer orchestra for adults who play an instrument. Two concerts a year.',
    categories: ['music-performance'],
    interests: ['orchestra'],
    motives: ['enhancement', 'social'],
    audience: { min_age: 18 },
    schedule: { text: 'Monday evening rehearsals', days: ['mon'], times: ['evening'] },
    locations: [loc('cobbs-creek', 'School auditorium', '6000 Example Pl', 'Trolley route 34')],
    cost: { level: 'low', text: 'A small yearly fee for music and the hall.' },
    commitment: 'weekly',
    group_size: 'large',
    requirements: { gear: 'Your own instrument' },
  }),
  base({
    id: 'example-regional-trail-builders',
    name: 'Example Regional Trail Builders',
    summary: 'A regional volunteer crew that builds and repairs trails in parks around the Philadelphia area. Some work days are inside the city.',
    kind: 'nonprofit',
    categories: ['outdoors-adventure', 'helping-volunteering'],
    interests: ['trail-building', 'hiking'],
    motives: ['values', 'enhancement'],
    audience: { min_age: 14 },
    schedule: { text: 'Work days on weekends, posted a month ahead', days: ['sat', 'sun'], times: ['morning', 'daytime'] },
    locations: [{ label: 'Work sites across the region', address: null, neighborhood: null, zip: null, lat: null, lng: null, in_city: false, transit: null, planning_district: null }],
    commitment: 'drop_in',
    group_size: 'medium',
    requirements: { gear: 'Work gloves and boots' },
  }),
];

// ---------------------------------------------------------------- synthetic scale (speed tests only)

function synthetic(n) {
  const out = [];
  const adjectives = ['Quiet', 'Friendly', 'Rowdy', 'Sunny', 'Old', 'New', 'Little', 'Big', 'Brick', 'River', 'Corner', 'Porch'];
  const nouns = ['Gardeners', 'Walkers', 'Readers', 'Cyclists', 'Singers', 'Makers', 'Cleanup Crew', 'Chess Players', 'Neighbors', 'Volunteers'];
  const costs = ['free', 'free', 'low', 'paid', 'unknown'];
  for (let i = 0; i < n; i++) {
    const src = hand[i % hand.length];
    if (src.audience.support_group) continue;
    const num = String(i).padStart(5, '0');
    const name = `Example ${adjectives[i % adjectives.length]} ${nouns[(i * 7) % nouns.length]} ${num}`;
    const id = `synthetic-${num}`;
    const g = JSON.parse(JSON.stringify(src));
    g.id = id;
    g.name = name;
    g.summary = `${src.summary} (Test copy ${num}.)`;
    g.cost.level = costs[i % costs.length];
    g.locations = (g.locations ?? []).map((l) => ({ ...l, planning_district: districts[i % districts.length][0] }));
    g.last_sign_of_life = `2026-0${(i % 9) + 1}`;
    g.contacts.website = `https://example.org/${id}`;
    g.sources = [{ url: `https://example.org/${id}`, seen: '2026-10-05', fields: ['name'] }];
    g.sign_of_life_url = `https://example.org/${id}`;
    out.push(g);
  }
  return out;
}

const all = [...hand, ...(scale > 0 ? synthetic(scale) : [])];

// ---------------------------------------------------------------- site files

function isEmpty(v) {
  return v === null || v === undefined || (Array.isArray(v) && v.length === 0) || (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0);
}

function prune(v) {
  if (Array.isArray(v)) return v.map(prune);
  if (v && typeof v === 'object') {
    const out = {};
    for (const [k, x] of Object.entries(v)) {
      const p = prune(x);
      if (!isEmpty(p)) out[k] = p;
    }
    return out;
  }
  return v;
}

function slim(g) {
  const s = JSON.parse(JSON.stringify(g));
  delete s.leads;
  delete s.sources;
  delete s.ein;
  delete s.contacts;
  delete s.hidden;
  delete s.hidden_reason;
  delete s.first_step.basis;
  delete s.first_step.what_to_expect;
  delete s.first_step.first_visit_tips;
  delete s.access.notes;
  delete s.requirements.gear;
  return prune(s);
}

function full(g) {
  const f = JSON.parse(JSON.stringify(g));
  delete f.leads;
  return f;
}

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(path.join(outDir, 'groups'), { recursive: true });

fs.writeFileSync(path.join(outDir, 'groups.json'), JSON.stringify({ built: BUILT, count: all.length, groups: all.map(slim) }));
for (const g of all) fs.writeFileSync(path.join(outDir, 'groups', `${g.id}.json`), JSON.stringify(full(g), null, 2) + '\n');
fs.writeFileSync(path.join(outDir, 'vocab.json'), JSON.stringify(vocab, null, 2) + '\n');

// manifest
const tally = (fn) => {
  const m = {};
  for (const g of all) for (const k of [].concat(fn(g))) if (k !== null && k !== undefined) m[k] = (m[k] ?? 0) + 1;
  return m;
};
const manifest = {
  built: BUILT,
  fixture: true,
  total: all.length,
  counts: {
    by_status: tally((g) => g.status),
    by_tier: { 0: 4212, ...tally((g) => String(g.research_tier)) },
    by_category: tally((g) => g.categories),
    by_planning_district: tally((g) => [...new Set(g.locations.map((l) => l.planning_district).filter(Boolean))]),
  },
  tier0_unchecked: 4212,
  coverage: {
    estimates: [
      { slice: 'Civic and neighborhood, Northeast', found: 12, estimate: 31, note: 'Made up numbers for testing' },
      { slice: 'Games and hobbies, citywide', found: 9, estimate: 14, note: 'Made up numbers for testing' },
    ],
  },
};
fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

console.log(`Wrote ${all.length} groups to ${outDir}`);

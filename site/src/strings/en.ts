// All interface text for the site, in one module, grouped by page. Spanish and other languages can
// be added later as a sibling module with the same shape (es.ts).
//
// Rules for this file (also checked by strings.test.ts):
// - No dashes as punctuation: no em dash, no en dash, no spaced hyphen. Use a comma, a colon,
//   parentheses or a new sentence.
// - Plain words, short sentences, about a sixth to eighth grade reading level.
// - Inline markup in prose strings: [link text](/internal/path/) or [text](https://...) and
//   **bold**. Internal paths start with a slash and get the site base added when rendered.
//
// Each group of strings is its own named export so a page script only ships the text it uses.

export type Block =
  | { h: string }
  | { h3: string }
  | { p: string }
  | { ul: string[] }
  | { ol: string[] }
  | { note: string };

export const site = {
  name: 'Find Your Jawn',
  tagline: 'Find your people in Philly.',
  description:
    'A free directory and matching quiz for community groups in Philadelphia: volunteering, civic groups, clubs, teams, student groups and more. Early preview.',
  skipLink: 'Skip to main content',
  homeLabel: 'Find Your Jawn, home',
  jawnLead: 'Jawn',
  jawnText: 'Philly for almost anything. Here, it means your thing, your place, your people.',
};

export const nav = {
  label: 'Main',
  match: 'Match me',
  browse: 'Browse',
  support: 'Support groups',
  myList: 'My list',
};

export const notice = {
  title: 'Early preview.',
  text: 'We are building this in the open. The list is still growing, so some groups are missing and some details may be out of date.',
  fixtureTitle: 'Sample data.',
  fixtureText:
    'The groups on this copy of the site are made up, for testing only. They are not real places.',
};

export const footer = {
  sources: 'Sources and credits',
  github: 'GitHub',
  suggest: 'Suggest a group',
  privacy: 'Privacy',
  exploreLabel: 'Explore',
  aboutLabel: 'About',
  about: 'About this site',
  ranking: 'How ranking works',
  complete: 'How complete is this?',
  interests: 'All interests',
  line: 'Free and open source. No accounts, no cookies, no tracking.',
};

// Words used on cards, badges and group pages.
export const labels = {
  cost: {
    free: 'Free',
    low: 'Low cost',
    paid: 'Paid',
    unknown: 'Cost not known yet',
  } as Record<string, string>,
  kind: {
    nonprofit: 'Nonprofit',
    civic: 'Civic group',
    club: 'Club',
    team: 'Team or league',
    student_org: 'Student group',
    congregation: 'Faith community',
    friends_group: 'Friends group',
    garden: 'Garden',
    program: 'Program',
    network: 'Network',
    support_group: 'Support group',
  } as Record<string, string>,
  commitment: {
    one_off: 'One time event',
    drop_in: 'Drop in whenever you like',
    monthly: 'About once a month',
    weekly: 'About once a week',
    ongoing_role: 'An ongoing role',
    seasonal: 'Seasonal',
  } as Record<string, string>,
  groupSize: {
    small: 'Small group (under 15 people)',
    medium: 'Medium group (15 to 60 people)',
    large: 'Large group (over 60 people)',
    varies: 'Size varies',
  } as Record<string, string>,
  openTo: {
    public: 'Open to anyone',
    students: 'Students only',
    members: 'Members only',
    parents: 'Parents and caregivers',
    residents: 'Neighbors who live in the area',
    invite: 'By invitation',
  } as Record<string, string>,
  dayShort: {
    mon: 'Mon',
    tue: 'Tue',
    wed: 'Wed',
    thu: 'Thu',
    fri: 'Fri',
    sat: 'Sat',
    sun: 'Sun',
  } as Record<string, string>,
  dayLong: {
    mon: 'Monday',
    tue: 'Tuesday',
    wed: 'Wednesday',
    thu: 'Thursday',
    fri: 'Friday',
    sat: 'Saturday',
    sun: 'Sunday',
  } as Record<string, string>,
  time: {
    morning: 'Morning',
    daytime: 'Daytime',
    afternoon: 'Afternoon',
    evening: 'Evening',
    night: 'Late night',
    flexible: 'Flexible',
  } as Record<string, string>,
  season: {
    year_round: 'All year',
    spring: 'Spring',
    summer: 'Summer',
    fall: 'Fall',
    winter: 'Winter',
    event_only: 'Special events only',
  } as Record<string, string>,
  wheelchair: {
    yes: 'Wheelchair accessible',
    partial: 'Partly wheelchair accessible',
    no: 'Not wheelchair accessible',
    unknown: 'We do not know yet. Ask the group before you go.',
  } as Record<string, string>,
  newcomer: {
    5: 'Very welcoming to newcomers',
    4: 'Welcoming to newcomers',
    3: 'Fine for newcomers, but you may need to speak up',
    2: 'Takes some effort for newcomers',
    1: 'Mostly for people who already know the group',
  } as Record<number, string>,
  status: {
    active: 'Active',
    probably_active: 'Probably active',
    dormant: 'May have gone quiet',
    defunct: 'Closed',
    unknown: 'Not sure yet',
  } as Record<string, string>,
  faith: {
    catholic: 'Catholic',
    muslim: 'Muslim',
    jewish: 'Jewish',
    protestant: 'Protestant',
    interfaith: 'Interfaith',
    buddhist: 'Buddhist',
    hindu: 'Hindu',
    sikh: 'Sikh',
    quaker: 'Quaker',
    orthodox: 'Orthodox',
  } as Record<string, string>,
  school: {
    penn: 'Penn',
    drexel: 'Drexel',
    ccp: 'Community College of Philadelphia',
    temple: 'Temple',
    jefferson: 'Jefferson',
    sju: "Saint Joseph's",
    lasalle: 'La Salle',
  } as Record<string, string>,
  tri: { yes: 'Yes', no: 'No', unknown: 'Not known yet' } as Record<string, string>,
};

export const badges = {
  free: 'Free',
  low: 'Low cost',
  paid: 'Paid',
  newcomers: 'Newcomers welcome',
  kids: 'Kids OK',
  wheelchair: 'Wheelchair accessible',
  clearances: 'Clearances needed',
  backgroundCheck: 'Background check',
  faith: 'Faith community',
  online: 'Online OK',
  studentsOnly: 'Students only',
  membersOnly: 'Members only',
  invite: 'By invitation',
  courtOk: 'Accepts court ordered hours',
  hoursLetter: 'Signs service hour forms',
  minAge: 'Ages {n} and up',
  maxAge: 'Up to age {n}',
  dropIn: 'Drop in',
};

export const card = {
  quickFacts: 'Quick facts',
  lastSeen: 'Last seen active',
  noDate: 'Last active date not known yet',
  tierBasic: 'Basic listing',
  viewGroup: 'See details',
  inCity: 'Meets in',
  regional: 'Regional group that serves the city',
  online: 'Online',
};

export const group = {
  titleSuffix: 'Find Your Jawn',
  breadcrumbBrowse: 'All groups',
  alsoCalled: 'Also called',
  whatTheyDo: 'What they do',
  whoFor: 'Who it is for',
  whenWhere: 'When and where',
  firstVisit: 'Your first visit',
  firstVisitNormal:
    'Feeling unsure the first time is normal. Most groups are glad when someone new walks in.',
  knownSoFar: 'What we know so far',
  knownSoFarNote:
    'We have not written a first visit guide for this group yet. Not sure what to expect? Contact them before you go.',
  firstStep: 'First step',
  dropInYes: 'You can just show up.',
  dropInNo: 'Check with the group before you show up.',
  signUpYes: 'You need to sign up first.',
  signUpNo: 'No sign up needed.',
  whatToExpect: 'What to expect',
  tips: 'Tips for your first visit',
  newcomerRating: 'Newcomer welcome',
  newcomerWhy: 'Why we say this',
  costCommit: 'Cost and commitment',
  cost: 'Cost',
  commitment: 'How often',
  groupSize: 'Group size',
  season: 'Season',
  access: 'Access and languages',
  wheelchair: 'Wheelchair access',
  languages: 'Languages spoken',
  languagesUnknown: 'We do not know yet which languages are spoken.',
  accessNotes: 'Access notes',
  requirements: 'Requirements',
  requirementsNone: 'We found no special requirements. Ask the group if you are not sure.',
  clearancesTitle: 'Pennsylvania child clearances',
  clearancesText:
    'This group works with children. Pennsylvania law says adults who volunteer with children need clearances. The usual ones are a child abuse history check and a State Police criminal record check. Some people also need an FBI fingerprint check. Ask the group which ones you need and how to get them. For unpaid volunteers, the clearances last five years.',
  clearancesLink: 'Read about the clearances on the state website',
  clearancesUrl: 'https://www.pa.gov/agencies/dhs/resources/keep-kids-safe/child-abuse-clearances',
  backgroundCheck: 'This group asks for a background check.',
  courtYes:
    'This group says it accepts court ordered community service. Always confirm with your probation officer or program before you start.',
  courtNo: 'This group does not take court ordered community service.',
  hoursYes: 'This group says it signs service hour forms.',
  hoursNo: 'This group does not sign service hour forms.',
  kidsOk: 'Children can take part with a parent.',
  gear: 'What to bring or wear',
  contacts: 'How to reach them',
  contactsNote:
    'We copy contact details as the group or a public source published them. Each one shows where it came from.',
  contactsNone: 'We do not have contact details for this group yet.',
  website: 'Website',
  email: 'Email',
  phone: 'Phone',
  contactName: 'Contact',
  social: 'Social media',
  calendar: 'Calendar the group publishes',
  sourceLabel: 'Source',
  sourceSeen: 'seen',
  sourceUnknown: 'Listed in the sources below',
  sources: 'Sources and last check',
  lastChecked: 'Last checked by our team',
  confidence: 'Our confidence in this listing',
  signOfLife: 'Last seen active',
  signOfLifeLink: 'See the evidence',
  statusLabel: 'Status',
  seenOn: 'Seen on',
  supports: 'Supports',
  tier1: 'Checked by our research team on {date}. This was a basic check: we confirmed the group is active and open to join.',
  tier2: 'Checked by our research team on {date}. This was a closer look, including what a first visit is like.',
  tier3: 'Confirmed by the group itself. Last checked by our research team on {date}.',
  tierNoDate: 'Checked by our research team.',
  fixTitle: 'Help us keep this right',
  fixIntro: 'These open a short form on GitHub. You will need a free GitHub account.',
  correct: 'Correct this listing',
  correctHelp: 'Something here is wrong or out of date.',
  iRun: 'I run this group',
  iRunHelp: 'Confirm your details and tell newcomers what to expect.',
  remove: 'Remove my details',
  removeHelp: 'Ask us to take down a name, phone, email or the whole listing.',
  moreInFamily: 'More groups in',
  seeAllIn: 'See all {family} groups',
  save: 'Save to my list',
  saved: 'Saved to my list',
  saveHelp: 'Saved in this browser only.',
  removeSaved: 'Remove from my list',
  viewList: 'View my list',
  storageBlocked: 'Your browser is not letting us save. This list will be gone when you close the page.',
  where: {
    address: 'Address',
    neighborhood: 'Neighborhood',
    district: 'Part of the city',
    transit: 'Getting there',
    noAddress: 'We do not have an address for this group yet.',
    outsideCity: 'Meets outside the city and serves Philadelphia.',
    online: 'You can join online.',
    noMap: '',
  },
  when: {
    days: 'Days',
    times: 'Times',
    notRecurring: 'Does not meet on a regular schedule.',
    unknown: 'We do not know the schedule yet. Ask the group.',
  },
  quickFacts: 'Quick facts',
  outOfFive: '{n} out of 5',
  who: {
    labelOpen: 'Open to',
    labelAges: 'Ages',
    labelFaith: 'Faith',
    minAge: 'Ages {n} and up',
    maxAge: 'Up to age {n}',
    ages: 'Ages {min} to {max}',
    school: 'For students at {school}',
    community: 'Community',
    faith: 'A faith community: {faith}',
    faithPlain: 'A faith community',
    bridging: 'Mixes ages, neighborhoods or backgrounds on purpose.',
    crowd: 'Who is there',
  },
  meta: {
    description: '{summary}',
    descriptionFallback: 'A {kind} in Philadelphia. See what they do, when they meet and how to get started.',
  },
};

export const browse = {
  title: 'Browse every group',
  metaDescription:
    'Search and filter every community group we have found in Philadelphia: by interest, cost, days, part of the city, access and more.',
  intro: 'Search by name or topic, then narrow it down.',
  loading: 'Loading groups...',
  loadError: 'We could not load the group list. Please check your connection and try again.',
  retry: 'Try again',
  noscript: 'Browsing needs JavaScript. Without it, you can still use the interest pages and the guides.',
  resultsHeading: 'Results',
  searchLabel: 'Search',
  searchPlaceholder: 'Try "garden", "chess" or "Fishtown"',
  filters: 'Filters',
  filtersShow: 'Show filters',
  filtersHide: 'Hide filters',
  activeCount: '{n} on',
  clearAll: 'Clear all filters',
  clearOne: 'Remove filter: {label}',
  sort: 'Sort by',
  sortBest: 'Best match',
  sortAZ: 'A to Z',
  sortRecent: 'Recently active',
  count: 'Showing {shown} of {total} groups',
  countOne: 'Showing 1 group',
  countNone: 'No groups match',
  showMore: 'Show {n} more',
  none: 'No groups match those filters.',
  noneHelp: 'Try removing a filter or two.',
  noneSuggest: 'Or tell us about a group we should add.',
  supportNote: 'Looking for a support group? They have their own page, with crisis lines first.',
  supportLink: 'Go to support groups',
  suggest: 'Suggest a group',
  shareHint: 'This page address keeps your search and filters, so you can share it.',
  data: {
    updated: 'List updated {date}',
  },
  f: {
    interest: 'Interest',
    kind: 'Kind of group',
    area: 'Part of the city',
    areaAll: 'Anywhere in the city',
    areaRegion: 'All of {region}',
    areaNote: 'Groups with no set meeting place are hidden when you pick a part of the city.',
    cost: 'Cost',
    days: 'Days',
    times: 'Time of day',
    scheduleNote: 'Groups with no schedule yet are hidden when you pick days or times.',
    people: 'Who and how',
    newcomers: 'Newcomers welcome',
    newcomersHelp: 'Rated 4 or 5 for how welcoming they are to new people.',
    kids: 'Kids OK',
    wheelchair: 'Wheelchair accessible',
    wheelchairHelp: 'Only groups where we confirmed access.',
    online: 'Online OK',
    open: 'Open to anyone',
    openHelp: 'Hides groups that are only for students, members or invited guests.',
    language: 'Language',
    languageAll: 'Any language',
    faith: 'Faith communities',
    faithInclude: 'Show them',
    faithExclude: 'Hide them',
    faithOnly: 'Only faith communities',
    hours: 'Service hours',
    hoursForms: 'Signs service hour forms',
    court: 'Accepts court ordered hours',
  },
  chips: {
    q: 'Search: {value}',
    newcomers: 'Newcomers welcome',
    kids: 'Kids OK',
    wheelchair: 'Wheelchair accessible',
    online: 'Online OK',
    open: 'Open to anyone',
    faithExclude: 'No faith communities',
    faithOnly: 'Only faith communities',
    hours: 'Signs service hour forms',
    court: 'Accepts court ordered hours',
    area: 'Part of the city: {value}',
    language: 'Language: {value}',
  },
};

export const interests = {
  indexTitle: 'Browse by interest',
  indexIntro: 'Pick something you like and see the groups for it.',
  metaIndex: 'Community groups in Philadelphia, grouped by interest.',
  pageTitle: '{family} in Philly',
  metaDescription: 'Groups for {family} in Philadelphia: {n} so far, with what they do, when they meet and how to start.',
  count: '{n} groups so far',
  countOne: '1 group so far',
  countNone: 'No groups yet',
  empty: 'We have not checked any groups in this interest yet. The list grows every week.',
  emptyActions: 'You can browse every group, or tell us about one we are missing.',
  browseAll: 'Browse every group',
  suggest: 'Suggest a group',
  includes: 'Includes: {list}.',
  refine: 'Narrow these down by cost, days and more',
  allInterests: 'All interests',
};

export const paths = {
  title: 'Guides for getting started',
  listCount: '{n} groups',
  listCountOne: '1 group',
  more: 'See all {n} in browse',
  capNote: 'We show the {n} that fit best here. Browse has the rest.',
  moreGuides: 'More guides',
  seeBrowse: 'Browse every group',
  suggest: 'Know a group that belongs here? Suggest it.',
  askFirst: 'Always confirm with the group before you count on it.',
  serviceHours: {
    slug: 'service-hours',
    title: 'Service hours for school',
    navTitle: 'Service hours',
    summary: 'Find places that sign hour forms, and learn how to ask.',
    metaDescription:
      'Find Philadelphia volunteer groups for students who need service hours: places that sign hour forms, minimum ages, and how to ask for a sign off.',
    lede: 'Many schools ask students to volunteer a set number of hours. Here is how to find a place that fits and get your hours signed.',
    guide: [
      { h: 'Before you start' },
      {
        p: 'Ask your school what counts. Find out how many hours you need, when they are due, and whether a form needs to be signed. Some schools keep a list of approved places.',
      },
      { h: 'Pick a place that fits' },
      {
        p: 'Look at the minimum age on each card. Many groups need volunteers to be 16 or 18. Some let younger people help with a parent. Choose something you will actually show up for, close to home or school.',
      },
      { h: 'How to ask for a sign off' },
      {
        ol: [
          'On your first visit, say: "I need to log service hours for school. Can you sign my form?"',
          'Bring the form with you. Ask who signs it and how to log your hours each time.',
          'Take a photo of the signed form. Do not wait until the deadline.',
        ],
      },
      {
        note: 'A group that says it signs forms has told the public so, but staff and rules change. Confirm with the group before you count on it.',
      },
    ] as Block[],
    listFormsTitle: 'Groups that say they sign hour forms',
    listFormsEmpty:
      'We have not found a group that says it signs hour forms yet. That list grows as we check more groups.',
    listTeensTitle: 'Open to teens (ask about a sign off)',
    listTeensIntro: 'These groups take volunteers age 16 or younger. They have not said whether they sign forms, so ask.',
    listTeensEmpty: 'We have not found teen friendly groups yet. Try browsing, or suggest one.',
  },
  courtOrdered: {
    slug: 'court-ordered',
    title: 'Court ordered community service',
    navTitle: 'Court ordered service',
    summary: 'Places that say they accept court ordered hours, and what to ask first.',
    metaDescription:
      'Philadelphia groups that say they accept court ordered community service, with a plain guide to what to ask before you start.',
    lede: 'If a court or a program told you to do community service, you are not alone. Plenty of people do it. This page helps you find a place and finish your hours.',
    guide: [
      { h: 'How it usually works' },
      {
        p: 'A judge, a probation officer or a program sets the number of hours and the deadline. They also decide which places count. Rules differ from case to case, so ask them directly.',
      },
      { h: 'Ask first' },
      {
        ul: [
          'Is this place approved for my hours?',
          'Do I need approval before I start?',
          'Are there places I cannot serve, such as places that work with children?',
          'What paperwork do I turn in, and who signs it?',
        ],
      },
      { h: 'At the place' },
      {
        p: 'Tell them you have court ordered hours. Ask them to write down your dates and hours, and to sign your form. Keep a copy for yourself.',
      },
      { h: 'About this list' },
      {
        p: 'We list only places with a public source that says they accept court ordered hours. That list is short. A place that is not here may still take you, so ask. We never guess.',
      },
      {
        note: 'Always confirm with your probation officer or program before you start. We cannot give legal advice, and we do not know the terms of your order.',
      },
    ] as Block[],
    listTitle: 'Places that say they accept court ordered hours',
    listEmpty:
      'We have not found a place with a public source that says it accepts court ordered hours yet. We do not list a place until we have one. Ask your probation officer or program for approved places, and check back soon.',
  },
  families: {
    slug: 'families',
    title: 'Families with young kids',
    navTitle: 'Families',
    summary: 'Groups where children can come along.',
    metaDescription:
      'Philadelphia groups where kids can take part with a parent: playgroups, gardens, libraries, sports and more.',
    lede: 'Looking for something to do with your kids? These groups say children can take part with a parent or caregiver.',
    guide: [
      { h: 'Things worth asking' },
      {
        ul: [
          'What ages does the group work for?',
          'Is there a quiet corner or a place for a stroller?',
          'Do meetings run around nap times, or can you come and go?',
          'Does every adult need Pennsylvania clearances?',
        ],
      },
      { h: 'Start small' },
      {
        p: 'Pick one group close to home and go a few times. Children and grown ups both feel better about a place after a few visits.',
      },
    ] as Block[],
    listTitle: 'Groups where kids can take part',
    listEmpty:
      'We have not found groups that say kids can take part yet. The list grows as we check more groups.',
  },
  newToPhilly: {
    slug: 'new-to-philly',
    title: 'New to Philly',
    navTitle: 'New to Philly',
    summary: 'Welcoming places to meet your neighbors.',
    metaDescription:
      'Welcoming Philadelphia groups for people who are new to the city: civic associations, library programs, walking groups and more.',
    lede: 'New in town? The fastest way to feel at home is to show up in the same places a few times.',
    guide: [
      { h: 'A good way to begin' },
      {
        ol: [
          'Pick one place close to where you live.',
          'Go three times before you decide. Faces and routines get familiar with every visit.',
          'Bring a friend if you can. It helps.',
        ],
      },
      {
        p: 'First chats with strangers usually go better than people expect. Most groups are happy to see someone new.',
      },
    ] as Block[],
    listWelcomingTitle: 'Groups that are very welcoming to newcomers',
    listWelcomingEmpty:
      'We have not rated groups for how welcoming they are yet. That comes with our closer checks.',
    listNeighborsTitle: 'Meet your neighbors: civic groups, libraries and walking groups',
    listNeighborsEmpty: 'We have not found civic, library or walking groups yet.',
  },
};

export const support = {
  title: 'Support groups',
  metaDescription:
    'Crisis lines in Philadelphia, links to meeting finders for recovery, grief, caregiving and mental health, and support groups from our directory.',
  lede: 'You do not have to do this alone. Help is close, and it is free to ask.',
  crisisTitle: 'If you need help right now',
  crisisIntro: 'These lines are open all day and night.',
  crisis: {
    emergency: {
      title: 'Emergency',
      name: '911',
      what: 'For an emergency: someone is in danger, hurt, or about to be.',
      call: 'Call 911',
      tel: 'tel:911',
    },
    lifeline: {
      title: '988 Suicide and Crisis Lifeline',
      name: '988',
      what: 'The 988 Suicide and Crisis Lifeline. Call or text 988 to talk with someone about suicide, a mental health crisis, or a substance use crisis. You can also chat online.',
      call: 'Call 988',
      text: 'Text 988',
      chat: 'Chat online',
      spanish: 'En español',
      tel: 'tel:988',
      sms: 'sms:988',
      chatUrl: 'https://988lifeline.org/',
      spanishUrl: 'https://988lifeline.org/es/',
    },
    philly: {
      title: 'Philadelphia crisis line',
      name: '215-686-4420',
      what: 'The Philadelphia suicide prevention and crisis intervention line, run by the City\'s Department of Behavioral Health and Intellectual disAbility Services. It is answered every day, all day and night.',
      call: 'Call 215-686-4420',
      tel: 'tel:+12156864420',
      sourceLabel: 'Source: DBHIDS',
      sourceUrl:
        'https://dbhids.org/about/organization/behavioral-health-division/behavioral-health-crisis-intervention-services/',
    },
    notSure: 'Not sure which one to call? Call 988. They will help you find the right place.',
  },
  topicsTitle: 'Find a meeting',
  topicsIntro: 'These groups already keep good meeting lists, so we point you to them instead of copying them.',
  topics: [
    {
      title: 'Alcohol',
      text: 'Alcoholics Anonymous meetings in Philadelphia and nearby counties, from the Southeastern Pennsylvania Intergroup Association.',
      link: 'Find an AA meeting',
      url: 'https://aasepia.org/meetings/',
    },
    {
      title: 'Drugs',
      text: 'Narcotics Anonymous meeting lists for the Greater Philadelphia region.',
      link: 'Find an NA meeting',
      url: 'https://meetinglists.gprna.org',
    },
    {
      title: 'Family and friends of someone who drinks',
      text: 'Al-Anon and Alateen are for people who are affected by someone else\'s drinking. Search for Philadelphia on the finder.',
      link: 'Find an Al-Anon meeting',
      url: 'https://al-anon.org/al-anon-meetings/find-an-al-anon-meeting/',
    },
    {
      title: 'Recovery that is not twelve step',
      text: 'SMART Recovery meetings are in person and online. They use tools based on science. Use the site to find a meeting.',
      link: 'Go to SMART Recovery',
      url: 'https://smartrecovery.org/',
    },
    {
      title: 'Mental health, for you or your family',
      text: 'NAMI offers free peer and family support groups. Use the finder to find the local NAMI near Philadelphia.',
      link: 'Find your local NAMI',
      url: 'https://www.nami.org/find-your-local-nami/',
    },
    {
      title: 'Losing a child',
      text: 'The Compassionate Friends supports families after the death of a child, with chapters you can search for.',
      link: 'Find grief support',
      url: 'https://www.compassionatefriends.org/find-support/',
    },
    {
      title: 'Grief for children and families',
      text: 'The National Alliance for Children\'s Grief has a list of places that help grieving children and the adults who love them.',
      link: 'Find support for grieving kids',
      url: 'https://nacg.org/find-support/',
    },
    {
      title: 'Caring for an older adult',
      text: 'The Philadelphia Corporation for Aging has a caregiver support program for people looking after an older relative or friend.',
      link: 'Caregiver support in Philadelphia',
      url: 'https://pcacares.org/services/caregiver-support/',
    },
    {
      title: 'Memory loss and dementia',
      text: 'The Alzheimer\'s Association Greater Pennsylvania Chapter runs support for families and caregivers.',
      link: 'Alzheimer\'s Association, Pennsylvania',
      url: 'https://www.alz.org/pa',
    },
  ],
  externalNote: 'These links go to other websites. We do not run them.',
  groupsTitle: 'Support groups in our directory',
  groupsIntro: 'Local groups we have found. Call or write first to ask about meeting times and who can come.',
  groupsEmpty:
    'We have not added support groups from our own research yet. The meeting finders above are the best place to start.',
  privacy:
    'This page does not save anything about you, and we do not track what you click. You do not need an account.',
  suggest: 'Know a support group that should be here?',
};

export const myList = {
  title: 'My list',
  metaDescription: 'Groups you saved on this device.',
  intro: 'Groups you saved. This list lives only in this browser. We never see it.',
  loading: 'Loading your list...',
  empty: 'You have not saved any groups yet.',
  emptyHelp: 'When you find one you like, tap "Save to my list" on its page.',
  emptyActions: 'Browse groups',
  count: '{n} saved',
  countOne: '1 saved',
  savedOn: 'Saved {date}',
  remove: 'Remove',
  removeLabel: 'Remove {name} from my list',
  gone: 'This group is not on the site anymore.',
  goneName: 'A group that was removed',
  export: 'Download my list',
  exportHelp: 'Saves a small file you can keep or move to another device.',
  import: 'Add a saved list',
  importHelp: 'Pick a file you downloaded before.',
  importDone: 'Added {n} groups.',
  importNone: 'That file did not have any groups we could add.',
  importBad: 'We could not read that file. Pick a file you downloaded from this page.',
  importSkipped: '{n} entries were skipped because they were not valid.',
  loadError: 'We could not load group names, but your list is safe.',
  blocked:
    'Your browser is not letting this site save anything, so your list will disappear when you close the page. Download it if you want to keep it.',
  forgetTitle: 'Forget everything',
  forgetText:
    'This removes your saved list and anything else this site stored in your browser. It cannot be undone.',
  forgetButton: 'Forget everything',
  forgetConfirm: 'Yes, forget everything',
  forgetCancel: 'Cancel',
  forgetDone: 'Done. This site has forgotten everything about you.',
  forgetNone: 'Nothing was stored, so there was nothing to forget.',
};

export const home = {
  title: 'Find Your Jawn',
  heroLede:
    'Find your people in Philly. Volunteering, civic groups, clubs, teams, student groups, cultural groups and the small neighborhood crews you only hear about by word of mouth, all in one place.',
  doorsTitle: 'Two ways in',
  match: {
    title: 'Match me',
    text: 'Answer a few quick questions. Get a short list of groups that fit you, why each one fits, and how to show up the first time.',
    cta: 'Match me',
  },
  browse: {
    title: 'Browse everything',
    text: 'Search every group we have found. Filter by cost, days, part of the city, access and more.',
    cta: 'Browse everything',
    countLine: '{n} groups so far, and more every week.',
  },
  pathsTitle: 'Start with what you need',
  interestsTitle: 'Or start with something you like',
  interestsAll: 'See all interests',
  supportTitle: 'Looking for a support group?',
  supportText: 'Grief, recovery, caregiving, mental health and more. Crisis lines come first, and there is no quiz.',
  supportCta: 'Go to support groups',
  suggestTitle: 'Know a group we should include?',
  suggestText:
    'Especially the small ones: the block crew, the knitting circle, the club that marches every New Year\'s Day. Tell us about it, or tell us about yours.',
  suggestCta: 'Suggest a group',
};

export const match = {
  title: 'Match me',
  metaDescription: 'The Find Your Jawn match quiz is almost ready.',
  heading: 'The match quiz is almost ready',
  lede: 'We are still building it. Here is what it will do.',
  points: [
    'Ask about a dozen quick questions with pictures and choices. You can skip any of them.',
    'Show you about eight groups, with why each one fits you and exactly how to show up the first time.',
    'Include a couple of gentle stretches, one small step outside what you would normally pick.',
    'Keep your answers on your device. Nothing you answer leaves your browser.',
  ],
  meanwhile: 'While you wait, you can:',
  browse: 'Browse every group',
  paths: 'Try a guide: service hours, families or new to Philly',
  how: 'Read how ranking will work',
  mountLabel: 'Match quiz',
};

export const about = {
  title: 'About',
  metaDescription:
    'What Find Your Jawn is, the rules we follow, how removals work, and where our information comes from.',
  blocks: [
    { h: 'What this is' },
    {
      p: 'Find Your Jawn is a free directory of community groups in Philadelphia. It lists volunteer groups, civic associations, clubs, sports teams, student groups, cultural groups, faith communities and more. Many of them are small and never show up in a web search.',
    },
    {
      p: 'You can [browse everything](/browse/), or take the [match quiz](/match/) and get a short list of groups that fit you. Every group page tells you what a first visit is like, as far as we know.',
    },
    { h: 'Our rules' },
    {
      ul: [
        '**No paid placement.** Nobody can pay to be listed, or to be listed higher. [How ranking works](/how-ranking-works/) explains the order.',
        '**Facts, not copied text.** We write every summary in our own words. We record facts such as a name, schedule, cost and address, and where we saw them. We never copy another site\'s descriptions.',
        '**No partisan politics.** Ward committees, party clubs, campaigns and PACs are left out. Nonpartisan civic and advocacy groups are in.',
        '**Faith communities are included and clearly labeled.** You can include or hide them when you browse.',
        '**Support and recovery groups have their own page.** [Support groups](/support/) shows crisis lines first. These groups never show up in general results.',
        '**We say what we do not know.** If we could not check something, we say it is not known yet.',
        '**No judgment.** Court ordered service and background checks are handled plainly and without judgment.',
        '**Contacts are shown as published.** We copy contact details as the group or a public source published them, and each one shows where it came from.',
      ],
    },
    { h: 'How corrections and removals work' },
    {
      p: 'Every group page links to three forms on GitHub: correct this listing, I run this group, and remove my details. We remove details promptly and keep them from coming back.',
    },
    {
      p: 'The forms need a free GitHub account. If you do not have one, anyone who does can file the form for you.',
    },
    { h: 'Who is checking' },
    {
      p: 'Our research team checks that each group is still active and open to join. A group page says how closely we checked it and when. Groups can also confirm their own listing through the "I run this group" form.',
    },
    { h: 'A related directory' },
    {
      p: '[Join Philly](https://www.joinphilly.com/) is a curated directory of social clubs in the city, with in person activities fairs. It is a great place to find social clubs, and we are glad it exists. If we find a group through its list, we check the group on its own pages and write our own words. We never copy their text.',
    },
    { h: 'It is open source' },
    {
      p: 'The plan, the data rules and the code are all public on [GitHub](https://github.com/holdTheDoorHoid/find-your-jawn). You can read how we decide things, or help.',
    },
  ] as Block[],
  sourcesTitle: 'Where our information comes from',
  sourcesIntro:
    'We find groups through public lists, then check each one. Here is every source and the credit it asks for.',
  sourcesCredits: 'Credits',
  sourcesLeadOnly: 'Used only to find groups',
  sourcesLeadOnlyText: 'The terms of these sources do not allow us to reuse their text. We use them only to find group names, then check each group on its own pages.',
  sourceOwner: 'From',
  sourceHandMade: 'Compiled by our team from public pages',
  sourceVisit: 'Visit',
  sourceNone: 'The source list is not available in this copy of the site.',
};

export const privacy = {
  title: 'Privacy',
  metaDescription: 'Find Your Jawn has no accounts, no cookies and no tracking. Here is what is stored and where.',
  blocks: [
    { h: 'The short version' },
    {
      p: 'We do not collect anything about you. There are no accounts, no cookies, no ads and no analytics. This site does not load anything from other websites while you use it.',
    },
    { h: 'What stays on your device' },
    {
      p: 'If you save a group, the site keeps its name in your browser\'s storage. If the match quiz saves your answers, they will live there too. The storage keys all start with "fyj:". We never see them, and they never leave your device.',
    },
    {
      p: 'You can wipe all of it any time with the button below, or on the [My list](/my-list/) page.',
    },
    { h: 'Sharing' },
    {
      p: 'When you share a link to a group or a filtered view, the link contains only the group or the filters. It never holds your answers or your list.',
    },
    { h: 'Hosting' },
    {
      p: 'This site is hosted by GitHub Pages. Like any web host, GitHub may keep ordinary server records, such as your internet address when you load a page. We do not see those records. See [GitHub\'s privacy statement](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement) for how GitHub handles them.',
    },
    { h: 'GitHub forms' },
    {
      p: 'The links to correct a listing, suggest a group or remove details open forms on GitHub. What you post there is public, and it is tied to your GitHub account. Please do not put private details in a form.',
    },
    { h: 'Other websites' },
    {
      p: 'Links to groups\' own websites, to crisis lines and to meeting finders take you to other sites. We do not control them, and their privacy rules apply.',
    },
  ] as Block[],
  forgetTitle: 'Forget everything',
};

export const ranking = {
  title: 'How ranking works',
  metaDescription:
    'Plain words on how Find Your Jawn orders groups: no paid placement, how browse is sorted, and how the match quiz will choose, explain and stretch.',
  blocks: [
    { h: 'No one can pay for a better spot' },
    {
      p: 'We never take money to list a group or to move it up. Nothing is sponsored. The rules below are the only rules.',
    },
    { h: 'Browse' },
    {
      p: 'Browse sorts groups from A to Z by name, or by most recent sign of life if you pick that. When you search, the best name matches come first. Filters only hide groups. They never change a group\'s place in the list.',
    },
    { h: 'The match quiz' },
    {
      p: 'The quiz is not live yet. This is how it will work. It uses plain rules, so every result can be explained. Everything runs in your browser.',
    },
    { h3: 'Step 1: what is ruled out' },
    {
      p: 'A group is never shown if any of these is true:',
    },
    {
      ul: [
        'It looks closed or has gone quiet for years, or it is a partisan group.',
        'It is not open to you, such as a group only for students at another school, a members only group, or one with a minimum age you do not meet.',
        'It is a support group, unless you asked for support groups.',
        'It is a faith community and you chose to leave those out.',
        'It breaks an answer you locked, such as cost, schedule, distance, access or background checks.',
        'It does not fit the guide you are using. For court ordered service, only groups with a public source that says they accept those hours are shown.',
      ],
    },
    { h3: 'Step 2: how well it fits' },
    {
      p: 'Each group that is left gets a score from these parts. The weights are starting values, and we tune them with practice runs. Every change is written down in the project on GitHub.',
    },
    {
      ul: [
        '**What you are into** (25 percent): the topics you picked and the moments you liked.',
        '**Why you want to join** (20 percent): whether the group offers the reasons that matter most to you.',
        '**What you would do there** (15 percent): hands on, figuring things out, making, helping, leading or organizing, and how you like to be with people.',
        '**Practical fit** (15 percent): your schedule, how far it is, how often, group size and cost, for the things you did not lock.',
        '**Your taste test** (10 percent): groups like the ones you liked, and not like the ones you passed on.',
        '**Welcome for newcomers** (10 percent): rises to 20 percent if you said meeting strangers is hard.',
        '**A regular place** (3 percent): groups that meet on a steady schedule in one place build friendships.',
        '**How well we know it** (2 percent): how closely we checked it and how recent its last sign of life is.',
      ],
    },
    { h3: 'Step 3: variety' },
    {
      p: 'We pick results one at a time. Each time, a group gets a small penalty if we already picked one in the same interest or from the same organization. Eight results should not be eight running clubs.',
    },
    { h3: 'Step 4: we explain' },
    {
      p: 'Each result says why it fits, in your own words: the answers that mattered most. No mystery scores.',
    },
    { h: 'Stretches and the wildcard' },
    {
      p: 'Most results are close fits. By default, two are stretches and one is a wildcard. A stretch changes exactly one thing and keeps the rest familiar:',
    },
    {
      ul: [
        '**One step sideways:** a neighboring interest, in the same style and with the same kind of crowd.',
        '**Same thing, new way in:** the same interest, but a new way to take part, such as teaching it instead of learning it.',
        '**New crowd:** the same interest in a group that mixes ages or neighborhoods.',
        '**Next rung:** a bigger role in something you already do.',
      ],
    },
    {
      p: 'We never stretch cost, schedule, distance, access, age, safety or clearances. We never stretch to support groups. Faith communities are stretches only for people who said yes to them. Every stretch is labeled and says why.',
    },
    {
      p: 'The wildcard is something you would probably never pick: very welcoming, free or cheap, easy to try once, and tied to something you said. A Mummers string band\'s open rehearsal is the kind of thing we mean.',
    },
    { h3: 'The adventure dial' },
    {
      p: 'You can turn the dial at any time. Gentle shows seven close fits and one stretch. Balanced (the default) shows five close fits, two stretches and one wildcard. Bold shows four close fits, three stretches and one wildcard.',
    },
    {
      note: 'The full design is public. Read [the design notes on GitHub](https://github.com/holdTheDoorHoid/find-your-jawn/blob/main/docs/DESIGN.md).',
    },
  ] as Block[],
};

export const complete = {
  title: 'How complete is this?',
  metaDescription: 'How many groups Find Your Jawn lists, by interest and part of the city, and how many we found but have not checked yet.',
  lede: 'Short answer: not very, yet. We are still finding and checking groups. This page shows where we are.',
  floorNote:
    'Treat every estimate here as a floor. The groups that are hardest to find are hard for every method we use, so the real number is likely higher.',
  totalLabel: 'Groups listed and checked',
  uncheckedLabel: 'Groups found but not checked yet',
  uncheckedHelp:
    'We found these in public lists, such as nonprofit filings. We have not confirmed that they are active and open to join, so they are not on the site.',
  uncheckedUnknown: 'We do not have this number for this copy of the site.',
  builtLabel: 'List updated',
  byCategory: 'Groups by interest',
  byDistrict: 'Groups by part of the city',
  byRegion: 'By region',
  noPlace: 'No set meeting place',
  tableGroup: 'Group',
  tableCount: 'Groups',
  coverageTitle: 'How close are we?',
  coverageIntro:
    'We compare lists from different methods to estimate how many groups exist in each slice. Where two methods find mostly the same groups, we are close to done.',
  coverageNone:
    'We have not run the first estimate yet. When we do, it will show here.',
  coverageSlice: 'Slice',
  coverageFound: 'Found',
  coverageEstimate: 'Estimated total',
  coverageNote: 'Note',
  nextTitle: 'Help fill the gaps',
  nextText: 'Know a group that is missing? Small ones matter most.',
  nextCta: 'Suggest a group',
};

export const notFound = {
  title: 'Page not found',
  text: 'We could not find that page. It may have moved, or the group may have been removed.',
  home: 'Go to the home page',
  browse: 'Browse every group',
};

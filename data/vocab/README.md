# Controlled vocabularies

These files are the shared word lists for Find Your Jawn. Group files, research records, the quiz
and the matching engine all use the same ids, so a word means one thing everywhere. The checks in
`pipeline/tests/test_vocab.py` make sure every id used in one file exists in the file that owns it.

Rules for all of them: ids never change once committed (labels can); text is plain words at a sixth
to eighth grade reading level; no dashes as punctuation.

`interests.yaml` lists the 29 interest families (the tiles in the quiz and the interest pages) and
the 220 tags under them, plus an adjacency graph of typed edges (same skill, crowd, place, cause or
topic) that powers the "one step sideways" stretch. Research agents read it to tag every group
(`categories` for families, `interests` for tags, and `aka` synonyms to map their own words), the
importer checks every tag against it, and the site reads it for tiles, browse filters and
stretches. The `support-recovery` family is marked `support_only` and is used only by the separate
support flow.

`ways_in.yaml` defines the five ways to take part in the same interest (do it, learn it, teach it,
serve it, lead it) and gives, for every family, example tags and a plain sentence for each. The
matching engine reads it for the "same thing, new way in" stretch, and the site uses the sentences
to explain a stretch.

`motives.yaml` holds the six reasons people join (values, understanding, social, career,
protective, enhancement) with the plain labels the quiz shows in question 5. The quiz and the
matching engine read it, and research agents tag each group with the motives it serves.

`formats.yaml` lists how people spend time together (side by side, talking, team play, making or
performing together, behind the scenes, leading, learning a skill, one time events). Scenes, groups
and the stretch rules all use these ids.

`roles.yaml` lists the six roles, what you actually do at a group, each echoing one Holland
interest type (kept internal, never shown as a label). Scenes, groups and the matching engine use
these ids.

`audiences.yaml` holds the crowd labels (who is in the room), who a group is open to, community
labels for affinity groups, a starter list of heritages (written `heritage:irish`), languages
(written `language:es` for a community, bare `es` in `access.languages`) and the faith traditions.
Research agents and the importer read it, and so do the quiz's optional "who would you like to
meet" and faith screens. The community answers stay in the visitor's browser.

`kinds.yaml` lists the eleven group kinds with a one line description each. Research agents pick
one per group, and the site uses the labels on cards and in filters.

`scenes.yaml` has the quiz's picture cards: the twelve "Saturday morning" scenes, eight more for
people whose picks are few or mixed, and ten "lost track of time" moments. Each card points to
interests (with weights), roles and formats, and has empty fields for a picture and its credit. The
quiz and the test simulation read it, and so does whoever finds the pictures. Between them the cards
cover every family except support and recovery, every role and every format.

`future_selves.yaml` holds the ten "a year from now" statements. Each maps to the interests, roles,
formats and ways in that move a person toward it, with a sentence the site can use to explain a
stretch. The quiz and the matching engine read it.

`neighborhoods.yaml` lists the City's 18 planning districts, six regions for coverage slices, 159
neighborhoods with their district and region, aliases for names that cover several neighborhoods,
and the ZIP code to district table that places a group which only has a ZIP. The importer, the
build, the coverage estimates and the neighborhood research agents read it. The data comes from
OpenDataPhilly (Creative Commons Attribution 4.0) and the City's open data; the file header says
how the districts were assigned.

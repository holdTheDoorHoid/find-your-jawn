# Quiz island (reserved)

The quiz agent builds the quiz screens, "Here's what we heard", results and the adventure dial here.

How it plugs into the shell:

1. `src/pages/match.astro` already has a `#quiz-root` section with a comment marking the mount
   point. Replace the placeholder list with
   `<QuizApp client:only="preact" config={config} />`, where `config` comes from
   `makeBrowseConfig(groups, vocab, built)` in `src/lib/browse-config.ts` (families with icons,
   labels, places, and the data version for cache busting). Extend that config, or add a sibling
   builder, if the quiz needs scenes, motives or formats from `vocab.json`.
2. Load group data in the browser with `fetchGroups(config.dataVersion)` from `src/lib/client-data.ts`.
   It returns normalized `Group` records.
3. Results use `GroupCard` from `src/components/GroupCard.tsx` and the badges in `src/lib/badges.ts`.
   Save buttons use `src/lib/saved.ts`. Group page links come from `groupPath` in `src/lib/site.ts`.
4. Styles: add quiz rules to `src/styles/global.css` using the existing custom properties, and keep
   tap targets at 44px or more, visible focus, and readable contrast (`contrast.test.ts` lists the
   pairs it checks; add any new color pair there).
5. Text goes in `src/strings/en.ts` as a `quiz` export. No dashes as punctuation.

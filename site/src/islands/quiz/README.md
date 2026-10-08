# Quiz island

`QuizApp.tsx` runs the whole flow on `/match/`: one decision per screen, every question skippable,
saved in this browser (`fyj:quiz`) so a reload offers to pick up where the person left off.

## How it loads

1. The page ships only `QuizApp` and the screens. It downloads `data/quiz-config.json` (the vocabulary the
   quiz needs, written by the site build from `vocab.json`, see `src/pages/data/quiz-config.json.ts`).
2. A few screens in, it downloads `groups.json` and the later half of the code (`late.ts`: taste test,
   follow ups, "Here's what we heard", results and the matching engine), so the first screens appear at once.

## Files

| File | What it does |
|---|---|
| `state.ts` | Which screens apply, what comes next, the progress curve (fast, then slow), the seeded shuffle, saved state |
| `screens.tsx` | The question screens (start, paths, scenes, moments, deal breakers, interests, motives, who, strangers, newness, future selves) |
| `steps.tsx` | The taste test, follow up questions and "Here's what we heard" |
| `summary.ts` | The chips on "Here's what we heard", each with the one tap that removes it |
| `Results.tsx`, `ResultCard.tsx` | The results page, the adventure dial, the cards and their actions |
| `panels.tsx` | Plan it and Send to a friend |
| `ics.ts`, `share.ts`, `plans.ts` | The calendar file, the message and link, and planned visits (key `fyj:plans`) |
| `widgets.tsx` | Pick cards, pills, the lock switch, the progress bar |

The "Did you go?" card is `../CheckInCard.tsx`. It is loaded by a tiny script (`components/CheckIn.astro`)
only when a planned visit has passed.

## Adding or changing a question

1. Add the field to `Answers` in `engine/types.ts` and to `sanitizeAnswers` in `engine/answers.ts`.
2. Use it in the engine (`profile.ts` for numbers, `filters.ts` if it can lock, `score.ts` for the part).
3. Add the screen to `screens.tsx`, its id to `ScreenId` and `sequence` in `state.ts`, the case in `QuizApp.tsx`.
4. Add the text to `strings/en.ts` (the `quiz` export) and a chip in `summary.ts`.
5. Add a test. Questions must earn their place (DESIGN section 2.1): the simulation in section 12 is how.

Text rules: plain words, no dashes as punctuation, privacy notes only on the sensitive screens (who you
would like to meet, faith and background checks, support).

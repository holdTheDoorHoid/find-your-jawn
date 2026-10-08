# Find Your Jawn: rules for agents

Read before doing anything: `docs/PLAN.md` (the owner's decisions, authoritative), `docs/DATA_MODEL.md`
(file formats, binding), `docs/ETHICS.md` (binding), `docs/RESEARCH.md` if you do research, and
`docs/DESIGN.md` if you build the site. Then read your task brief or GitHub issue.

## The owner

- The owner is not a programmer. Report decisions in plain language: lead with what a visitor will
  see, then why. Code details go in footnotes, if at all.
- **No dashes as punctuation** anywhere people read: interface text, docs, research reports, comments
  written for people, and commit messages. No em dashes, no en dashes, no spaced hyphens. Rewrite with
  a comma, a colon, parentheses, or a new sentence. Hyphens inside compound words, identifiers,
  command flags and file names are fine. Write ranges as "2019 to 2024".
- The interview decisions in `docs/PLAN.md` section 2 belong to the owner. Do not reopen them. If you
  hit a real conflict, stop and report it.

## Research rules

- Facts, not text. Record facts (name, schedule, cost, address, contact details as published) with a
  source URL and the date you saw them. Write every summary in our own words. Never copy a group's
  description, a directory's blurb, or another site's text into anything we publish. Source text may
  sit in `data/leads/` (internal, for matching and classification) but never reaches the site.
- Never log in, never get around a paywall, bot check, robots rule or HTTP 403, never submit a form,
  never create an account, never contact a group or a person. If a source is blocked, record that it
  is blocked and move on.
- Platforms whose terms forbid scraping or bulk reuse (Meetup, Eventbrite, Nextdoor, Facebook,
  Instagram, Idealist, Join Philly) are lead sources only: read individual public pages at human pace,
  record the group's name and link, then verify the group from its own pages. Never bulk scrape them.
- Partisan political groups are out of scope (ward committees, party clubs, campaigns, PACs).
  Nonpartisan civic, voter education and advocacy groups are in.
- WebSearch is capped at roughly 200 calls per session across all agents. Stay inside the per agent
  budget in your brief, prefer WebFetch on known URLs, and prefer scripts for anything structured.
- Save everything worth keeping inside the repo (`research/`), never only in /tmp. Session restarts
  wipe the scratchpad.

## Data rules

- Every source needs an entry in `registry/sources.yaml` (owner, access, terms, attribution, refresh).
- Send a descriptive User-Agent on every request:
  `FindYourJawn/0.1 (+https://github.com/holdTheDoorHoid/find-your-jawn)`.
- Raw downloads go to `$FYJ_CACHE` (default `~/.cache/find-your-jawn`), shared across worktrees.
  Check `df -h /` before any download over 100 MB and keep at least 10 GB free. Never commit raw
  downloads. Commit only the normalized leads and group files described in `docs/DATA_MODEL.md`.
- Group files change only through the pipeline's importer, which takes a file lock. Never hand edit
  many group files from parallel agents.

## Engineering conventions

- Pipeline: Python 3.12 in `pipeline/`, virtual environment at `pipeline/.venv`, installed with
  `pip install -e "pipeline[dev]"`. httpx, PyYAML, pandas or pyarrow where useful. Tests with pytest on
  small fixtures in `pipeline/tests/fixtures/`; unit tests never use the network. Lint with ruff.
- Site: Node 24 and npm in `site/`, TypeScript. Interface text lives in one strings module so
  translation can come later. The quiz and matching run entirely in the visitor's browser.
- Models (owner decision 2026-10-08): Haiku for research, Sonnet for engineering and routine work,
  Opus only for genuinely hard engineering. Never Fable for subagents.

## Git and process

- Work only in your own worktree, `~/Desktop/find-your-jawn-wt/<name>`, on branch `agent/<name>`.
- Commit often with plain language messages (no dashes as punctuation), ending with:
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
- Never push, open pull requests, create repositories, or change repository settings. The orchestrator
  reviews, merges and pushes.
- Finish with a short report: what you built or found, what the owner will see, test results, what
  you could not do, and any change you made to a contract.

## Machine limits

The laptop has 8 cores and 15 GB of memory, often with only about 3 GB free, and about 39 GB of free
disk. At most three agents build at once. Other projects run on this machine too.

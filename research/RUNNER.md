# The research runner

How one research run works: the nightly scheduled task, or the orchestrator during launch week.
Owner decisions behind this (2026-10-08): research on Haiku 5.5; a budget in share of the weekly usage
allowance (`research/budget.yaml`); a nightly run that skips itself when usage is running high;
research goes live automatically once it passes the checks; a short summary after every run.

Read `CLAUDE.md` first. The orchestrator's own work is light: pick, launch, import, check, publish,
log. All research is done by Haiku agents. Never use Fable or Opus agents for research.

## 0. Preconditions (stop quietly if any fails)

- `cd ~/Desktop/find-your-jawn`. The working tree must be clean and on `main`. Run
  `git pull --ff-only origin main`. If either fails, stop and report; never stash, reset or force.
- Never touch other projects, other worktrees, or lab hardware.

## 1. Budget gate

Load the usage tool (`ToolSearch` with `select:mcp__ccd_session_mgmt__get_usage`) and call it.
From the result take `weekly_percent` (Weekly, all models), `five_hour_percent` and the weekly reset
time. The current week started 7 days before that reset.

Read `research/budget.yaml` and `research/waves/usage.jsonl`. Find Your Jawn's spend this week is the
sum of `after - before` over the log lines whose time falls in the current week. The cap is
`launch_week.cap_percent` until `launch_week.ends`, then `weekly_cap_percent`.

Skip the run (append a `{"wave": "skipped", ...}` line with the reason, commit and push the log, and
finish with a one line summary) when any of these hold:
- the account's weekly usage is above `skip_if_account_weekly_above`;
- the 5 hour usage is above `skip_if_five_hour_above`;
- this week's Find Your Jawn spend has reached the cap.

## 2. Pick a wave

Read `research/queue.yaml`. Take the first wave with `status: todo` whose `after` waves are all done.

- If its brief file (`research/briefs/<brief>.md`) does not exist yet, write it first: short and
  self contained, in the pattern of `tier1.md`, `discover.md` and `chapters.md`, from the lane's
  description in `docs/RESEARCH.md` section 3, with concrete starting URLs where the lane names them.
  For `slices` waves with an empty `slices` list, write the slices too (eight or fewer). Commit these.
- `kind: script`: run the command, then go to step 4.
- `kind: batches`: `fyj batches <wave> <selector> --size <size>`. If `max_agents_per_run` is set,
  run only that many batches this time and leave the rest for the next run (the wave stays `todo`
  until every batch is done; `--exclude-done` makes this safe).
- WebSearch is limited to about 200 calls per session for everything together. Before launching,
  check that agents x `searches_per_agent` fits in what this session has left.

## 3. Launch Haiku agents

Up to eight at once, in the background, one per batch file or slice. Use `subagent_type:
"fyj-researcher"` (defined in `.claude/agents/fyj-researcher.md`: Haiku, research tools only). If that
type is not listed in this session, use `subagent_type: "general-purpose"` with `model: "haiku"`.
Prompt, filled in:

> You are a Find Your Jawn research agent. Read `~/Desktop/find-your-jawn/research/briefs/_common.md`,
> then `~/Desktop/find-your-jawn/research/briefs/<brief>.md`, then
> `~/Desktop/find-your-jawn/research/briefs/vocab-cheatsheet.md`.
> Wave: `<wave>`. Agent: `<agent>`. Lane: `<lane>`. WebSearch budget: `<n>` calls, hard cap.
> Your input: `<batch file path, or the slice text>`.
> Write your output to `~/Desktop/find-your-jawn/research/inbox/<wave>/<agent>.json`.
> Today's date is `<YYYY-MM-DD>`.

Wait for all of them. An agent that returns without writing its file gets one retry; after that,
note it in the wave log and move on.

## 4. Import, check, publish

```
pipeline/.venv/bin/fyj import-research <wave>
pipeline/.venv/bin/fyj check
pipeline/.venv/bin/pytest -q pipeline/tests
pipeline/.venv/bin/fyj build
(cd site && npm ci --silent && npm test --silent && npm run build --silent)
```

**Spot check.** Pick three newly published records at random. WebFetch each one's
`sign_of_life_url` and confirm the group exists, the status is supported by a dated item, and the
summary is fair and in our own words. If two or more of the three are wrong, the wave fails: do not
publish. Revert the data changes from this wave (`git checkout -- data/groups research`), move its
inbox files to `research/held/<wave>/`, mark the wave `status: held` in the queue with the reason,
and report.

If everything passes: mark the wave `done` in `research/queue.yaml` (or leave it `todo` with a note
of batches remaining), commit `data/`, `research/` and `registry/` with a plain language message (no
dashes as punctuation, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`), and
`git push origin main`. The Pages workflow deploys the site.

If tests or the site build fail for a reason that is not about this wave's data, do not try to fix
code in a scheduled run: commit the research inbox and wave log only, mark the wave `held`, and
report the failure.

## 5. Log

- Call the usage tool again. Append to `research/waves/usage.jsonl`:
  `{"wave": "<wave>", "time": "<ISO>", "before": <weekly % at start of the wave>, "after": <weekly % now>, "agents": n, "records": n}`.
- Write `research/waves/<YYYY-MM-DD>-<wave>.md`: agents, searches used, records in, published,
  held (with the top reasons), verdict counts, blocked sources, leads_only collected, the spot check
  result, and anything surprising. No dashes as punctuation.
- Append the `leads_only` names to `research/leads_only.jsonl` (one line each, with the wave) for
  wave w19.

## 6. Next wave or finish

If this run has spent less than `per_run_cap_percent` and the budget gate still passes, go back to
step 2. Otherwise finish.

Finish with a short summary for the owner in plain language (they are not a programmer): how many
groups were checked and published tonight, the total now live, what kinds of groups were added,
anything held back and why, and this week's Find Your Jawn usage against the cap. Lead with what a
visitor to the site will notice.

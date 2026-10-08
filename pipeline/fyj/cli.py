"""The `fyj` command line tool.

Harvest: fyj harvest <source id> | fyj harvest all | fyj leads stats
Groups:  fyj merge | fyj districts | fyj import-research <wave> | fyj check | fyj build
         fyj inbox-stats | fyj city-tier1 | fyj liveness | fyj batches <wave>
"""

from __future__ import annotations

import argparse
import collections
import sys
from pathlib import Path

from fyj.harvest import HARVESTERS
from fyj.http import FyjClient, RobotsBlocked
from fyj.leads import read_leads_jsonl, write_leads_jsonl
from fyj.paths import LEADS_DIR, leads_path


def _run_one(client: FyjClient, source_id: str) -> int | None:
    """Runs one harvester and writes its leads file. Returns the lead count, or None if the
    source was blocked (robots.txt) and nothing was written."""
    if source_id not in HARVESTERS:
        print(f"unknown source id: {source_id}", file=sys.stderr)
        print(f"known ids: {', '.join(sorted(HARVESTERS))}", file=sys.stderr)
        raise SystemExit(2)
    try:
        leads = HARVESTERS[source_id](client)
    except RobotsBlocked as exc:
        print(f"{source_id}: BLOCKED by robots.txt ({exc}), not harvested")
        return None
    count = write_leads_jsonl(leads_path(source_id), leads)
    print(f"{source_id}: wrote {count} leads to {leads_path(source_id)}")
    return count


def cmd_harvest(args: argparse.Namespace) -> None:
    with FyjClient() as client:
        if args.source_id == "all":
            results: dict[str, int | None] = {}
            for source_id in HARVESTERS:
                results[source_id] = _run_one(client, source_id)
            print("\nSummary:")
            for source_id, count in results.items():
                status = "blocked" if count is None else str(count)
                print(f"  {source_id}: {status}")
        else:
            _run_one(client, args.source_id)


def _ntee_major_group(ntee: str | None) -> str:
    if not ntee:
        return "(blank)"
    return ntee[0].upper()


def cmd_leads_stats(_args: argparse.Namespace) -> None:
    if not LEADS_DIR.exists():
        print(f"no leads directory at {LEADS_DIR}")
        return

    per_source: dict[str, int] = {}
    per_kind: collections.Counter[str] = collections.Counter()
    irs_leads: list[dict] = []

    for path in sorted(LEADS_DIR.glob("*.jsonl")):
        leads = read_leads_jsonl(path)
        per_source[path.stem] = len(leads)
        for lead in leads:
            per_kind[lead.get("kind_hint") or "(none)"] += 1
        if path.stem == "irs_bmf":
            irs_leads = leads

    print("Leads per source:")
    for source_id in sorted(per_source):
        print(f"  {source_id}: {per_source[source_id]}")

    print("\nLeads per kind_hint:")
    for kind, count in sorted(per_kind.items(), key=lambda kv: (-kv[1], kv[0])):
        print(f"  {kind}: {count}")

    if irs_leads:
        print(f"\nIRS BMF detail ({len(irs_leads)} Philadelphia ZIP records):")

        by_ntee: collections.Counter[str] = collections.Counter()
        by_subsection: collections.Counter[str] = collections.Counter()
        by_foundation: collections.Counter[str] = collections.Counter()
        non_unconditional = 0
        for lead in irs_leads:
            by_ntee[_ntee_major_group(lead.get("ntee"))] += 1
            by_subsection[lead.get("irs_subsection") or "(blank)"] += 1
            foundation = (lead.get("extra") or {}).get("foundation") or "(blank)"
            by_foundation[foundation] += 1
            if lead.get("irs_status") != "01":
                non_unconditional += 1

        print("  By NTEE major group:")
        for key, count in sorted(by_ntee.items(), key=lambda kv: (-kv[1], kv[0])):
            print(f"    {key}: {count}")

        print("  By IRS subsection:")
        for key, count in sorted(by_subsection.items(), key=lambda kv: (-kv[1], kv[0])):
            print(f"    {key}: {count}")

        print("  By foundation code:")
        for key, count in sorted(by_foundation.items(), key=lambda kv: (-kv[1], kv[0])):
            print(f"    {key}: {count}")

        print(
            f"  Status code other than 01 (Unconditional Exemption): {non_unconditional} "
            f"of {len(irs_leads)}. Per IRS Publication 5926, this extract only ever carries "
            "status 01, 02 (no longer issued) or 25 (terminating private foundation status); "
            "it does not include revoked organizations at all, so this count is not a count "
            "of revocations."
        )


def _layout_and_vocab():
    from fyj.paths import default_layout
    from fyj.vocab import load_vocab

    layout = default_layout()
    return layout, load_vocab(layout.vocab_dir)


def cmd_import_research(args: argparse.Namespace) -> None:
    from fyj.research_import import import_wave

    layout, vocab = _layout_and_vocab()
    if not layout.inbox_dir(args.wave).exists():
        print(f"no inbox for wave {args.wave} at {layout.inbox_dir(args.wave)}", file=sys.stderr)
        raise SystemExit(2)
    summary = import_wave(layout, args.wave, vocab, dry_run=args.dry_run)
    if args.dry_run:
        print("(dry run, nothing written)")
    print("\n".join(summary.lines()))


def cmd_merge(args: argparse.Namespace) -> None:
    from fyj.merge import run_merge

    layout, vocab = _layout_and_vocab()
    locator = _district_locator(layout, vocab)
    result = run_merge(layout, locator=locator, dry_run=args.dry_run)
    if args.dry_run:
        print("(dry run, nothing written)")
    print("\n".join(result.lines()))


def _district_locator(layout, vocab):
    """A function that gives a location its planning district, or None when no geometry exists."""
    from fyj.geo import DistrictLocator

    return DistrictLocator.load(layout, vocab)


def cmd_districts(args: argparse.Namespace) -> None:
    from fyj.geo import DistrictLocator, assign_planning_districts, refresh_geometry

    layout, vocab = _layout_and_vocab()
    if args.fetch or not layout.planning_districts_path.exists():
        size = refresh_geometry(layout, force=args.fetch)
        print(f"wrote {layout.planning_districts_path} ({size // 1024} KB)")
    locator = DistrictLocator.load(layout, vocab)
    if not locator.has_geometry:
        print("no planning district geometry; using the ZIP map only")
    counts = assign_planning_districts(layout, locator, force=args.force)
    print(
        f"{counts['locations']} locations: {counts['by_point']} placed by coordinates, "
        f"{counts['by_zip']} by ZIP, {counts['none']} left without a district; "
        f"{counts['files_changed']} group files updated"
    )


def cmd_city_tier1(args: argparse.Namespace) -> None:
    from fyj.city_tier1 import WAVE, generate, write_inbox_files

    layout, vocab = _layout_and_vocab()
    wave = args.wave or WAVE
    only = set(args.only.split(",")) if args.only else None
    generated = generate(layout, vocab, locator=_district_locator(layout, vocab), only=only)
    written = write_inbox_files(layout, generated, wave)
    print(f"{generated.count()} City records written to {layout.inbox_dir(wave)}:")
    for line in written:
        print(f"  {line}")
    for reason, count in sorted(generated.skipped.items()):
        print(f"  left alone ({reason}): {count}")
    for note in generated.notes:
        print(f"  note: {note}")
    if generated.unresolved:
        print("Not in data/vocab/, dropped from the records:")
        for item in sorted(generated.unresolved):
            print(f"  {item}")
    print(f"Next: fyj import-research {wave}")


def cmd_liveness(args: argparse.Namespace) -> None:
    from fyj.liveness import TIMEOUT, read_id_list, run_liveness

    layout, _vocab = _layout_and_vocab()
    only = read_id_list(Path(args.only)) if args.only else None

    def progress(done: int, total: int, result: dict) -> None:
        print(
            f"  [{done}/{total}] {result['group_id']}: {result['verdict']}"
            + (f" ({result['note']})" if result["note"] else "")
            + (f", newest {result['newest_date']}" if result["newest_date"] else "")
        )

    with FyjClient(timeout=TIMEOUT) as client:
        counts = run_liveness(
            layout,
            client=client,
            only=only,
            limit=args.limit,
            stale_days=args.stale_days,
            concurrency=args.concurrency,
            sleep_between=args.delay,
            progress=progress,
        )
    verdicts = ", ".join(f"{k} {v}" for k, v in sorted(counts.items()) if k != "checked")
    print(f"checked {counts['checked']}: {verdicts or 'nothing to check'}")
    print(f"results in {layout.liveness_path}")


def cmd_batches(args: argparse.Namespace) -> None:
    from fyj.batches import Selector, write_batches

    layout, vocab = _layout_and_vocab()

    def split(value: str | None) -> set[str] | None:
        return {v.strip() for v in value.split(",") if v.strip()} if value else None

    districts = split(args.district)
    if districts:
        districts = {vocab.resolve_district(d) or d for d in districts}
    ids = None
    if args.ids_file:
        from fyj.liveness import read_id_list

        ids = set(read_id_list(Path(args.ids_file)))
    selector = Selector(
        sources=split(args.source),
        kinds=split(args.kind),
        tiers={int(t) for t in split(args.tier) or []} or None,
        districts=districts,
        ids=ids,
        exclude_done=args.exclude_done,
        target_tier=args.target_tier,
    )
    total, files = write_batches(
        layout, vocab, args.wave, selector, size=args.size, limit=args.limit
    )
    print(f"{total} group(s) selected, {len(files)} batch file(s) of up to {args.size}")
    if files:
        print(f"written to {files[0].parent}")


def cmd_check(_args: argparse.Namespace) -> None:
    from fyj.checks import format_report, run_checks, write_report

    layout, vocab = _layout_and_vocab()
    report = run_checks(layout, vocab)
    path = write_report(layout, report)
    print(format_report(report))
    print(f"report written to {path}")


def cmd_build(_args: argparse.Namespace) -> None:
    from fyj.build import build_site_data
    from fyj.checks import format_report

    layout, vocab = _layout_and_vocab()
    result = build_site_data(layout, vocab)
    print(format_report(result.report))
    print(f"published {result.published} group(s) to {result.path}")


def cmd_inbox_stats(_args: argparse.Namespace) -> None:
    from fyj.inbox import format_inbox_stats, inbox_stats

    layout, _vocab = _layout_and_vocab()
    print(format_inbox_stats(inbox_stats(layout)))


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="fyj")
    sub = parser.add_subparsers(dest="command", required=True)

    harvest_parser = sub.add_parser("harvest", help="run a harvester and write its leads file")
    harvest_parser.add_argument(
        "source_id", help="a source id from registry/sources.yaml, or 'all'"
    )
    harvest_parser.set_defaults(func=cmd_harvest)

    leads_parser = sub.add_parser("leads", help="inspect harvested leads")
    leads_sub = leads_parser.add_subparsers(dest="leads_command", required=True)
    stats_parser = leads_sub.add_parser("stats", help="counts per source and kind_hint")
    stats_parser.set_defaults(func=cmd_leads_stats)

    import_parser = sub.add_parser(
        "import-research", help="validate research records in research/inbox/<wave>/ and merge them"
    )
    import_parser.add_argument("wave")
    import_parser.add_argument("--dry-run", action="store_true", help="report only, write nothing")
    import_parser.set_defaults(func=cmd_import_research)

    merge_parser = sub.add_parser(
        "merge", help="triage leads and turn the rest into tier 0 group files"
    )
    merge_parser.add_argument("--dry-run", action="store_true", help="report only, write nothing")
    merge_parser.set_defaults(func=cmd_merge)

    districts_parser = sub.add_parser(
        "districts", help="fetch planning district polygons and place every group location"
    )
    districts_parser.add_argument("--fetch", action="store_true", help="download the layer again")
    districts_parser.add_argument(
        "--force", action="store_true", help="recompute districts that are already set"
    )
    districts_parser.set_defaults(func=cmd_districts)

    city_parser = sub.add_parser(
        "city-tier1", help="write scripted tier 1 records for the City's own current lists"
    )
    city_parser.add_argument("--wave", help="inbox wave name (default w0-city-scripted)")
    city_parser.add_argument(
        "--only",
        help="comma separated: rco, nac, rec, libraries, senior, gardens, friends, programs, "
        "portal",
    )
    city_parser.set_defaults(func=cmd_city_tier1)

    live_parser = sub.add_parser(
        "liveness", help="check group websites for a sign of life (polite, respects robots.txt)"
    )
    live_parser.add_argument("--limit", type=int, help="check at most this many groups")
    live_parser.add_argument("--only", help="file of group ids, one per line or a JSON list")
    live_parser.add_argument(
        "--stale-days", type=int, help="skip groups checked less than this many days ago"
    )
    live_parser.add_argument("--concurrency", type=int, default=4)
    live_parser.add_argument(
        "--delay", type=float, default=1.0, help="seconds between requests to one host"
    )
    live_parser.set_defaults(func=cmd_liveness)

    batch_parser = sub.add_parser("batches", help="write batch files of groups for research agents")
    batch_parser.add_argument("wave")
    batch_parser.add_argument("--source", help="lead source ids, comma separated (irs_990n,...)")
    batch_parser.add_argument("--kind", help="group kinds, comma separated")
    batch_parser.add_argument("--tier", help="research tiers to start from, comma separated")
    batch_parser.add_argument("--district", help="planning districts, comma separated")
    batch_parser.add_argument("--ids-file", help="file of group ids, one per line or a JSON list")
    batch_parser.add_argument("--size", type=int, default=20, help="groups per batch file")
    batch_parser.add_argument("--limit", type=int, help="stop after this many groups")
    batch_parser.add_argument(
        "--exclude-done", action="store_true", help="skip groups already at the target tier"
    )
    batch_parser.add_argument(
        "--target-tier", type=int, default=1, help="the tier this wave produces (default 1)"
    )
    batch_parser.set_defaults(func=cmd_batches)

    check_parser = sub.add_parser("check", help="run the publish checks and write the report")
    check_parser.set_defaults(func=cmd_check)

    build_parser_ = sub.add_parser("build", help="write site/public/data/ from passing groups")
    build_parser_.set_defaults(func=cmd_build)

    stats_inbox = sub.add_parser("inbox-stats", help="what research files are waiting")
    stats_inbox.set_defaults(func=cmd_inbox_stats)

    return parser


def main(argv: list[str] | None = None) -> None:
    parser = build_parser()
    args = parser.parse_args(argv)
    args.func(args)


if __name__ == "__main__":
    main()

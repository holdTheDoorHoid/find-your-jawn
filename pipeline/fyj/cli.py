"""The `fyj` command line tool: fyj harvest <source id> | fyj harvest all | fyj leads stats."""

from __future__ import annotations

import argparse
import collections
import sys

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

    return parser


def main(argv: list[str] | None = None) -> None:
    parser = build_parser()
    args = parser.parse_args(argv)
    args.func(args)


if __name__ == "__main__":
    main()

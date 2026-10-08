"""`fyj build`: write site/public/data/ from the groups that pass the publish checks.

DATA_MODEL section 5. Only visible groups at research tier 1 or higher that pass `fyj check` are
published. The output is rebuilt from scratch each time and is never committed. Guide lists
(section 9) are written beside the groups, confirmed entries only.
"""

from __future__ import annotations

import copy
import datetime as _dt
import json
import shutil
from collections import Counter
from dataclasses import dataclass, field
from typing import Any

from fyj.checks import CheckReport, load_blocklist, run_checks, write_report
from fyj.groupfile import MAILING_LABELS, GroupStore, _plain
from fyj.guides import GuideBuild, build_guides
from fyj.paths import Layout
from fyj.vocab import Vocab

# Fields left out of groups.json, the compact file the quiz, results and browse load.
_COMPACT_DROP: tuple[tuple[str, ...], ...] = (
    ("leads",),
    ("sources",),
    ("ein",),
    ("contacts",),
    ("first_step", "basis"),
    ("first_step", "what_to_expect"),
    ("first_step", "first_visit_tips"),
    ("access", "notes"),
    ("requirements", "gear"),
)


def planning_district_for(location: dict[str, Any], vocab: Vocab) -> str | None:
    """A planning district id for a location: the one stored on it, else the neighborhood's, else
    the ZIP's."""
    stored = location.get("planning_district")
    if stored:
        return vocab.resolve_district(stored) or str(stored)
    hood = location.get("neighborhood")
    if hood and hood in vocab.neighborhoods:
        pd = vocab.neighborhoods[hood].get("planning_district")
        if pd:
            return vocab.resolve_district(pd) or str(pd)
    zip_code = location.get("zip")
    if zip_code:
        return vocab.zip_districts.get(str(zip_code)[:5])
    return None


def prune(value: Any) -> Any:
    """Drop None, empty lists and empty objects (False and 0 stay)."""
    if isinstance(value, dict):
        out = {}
        for key, item in value.items():
            pruned = prune(item)
            if pruned is None or pruned == [] or pruned == {}:
                continue
            out[key] = pruned
        return out
    if isinstance(value, list):
        return [p for p in (prune(v) for v in value) if p is not None and p != {} and p != []]
    return value


def _drop(group: dict[str, Any], path: tuple[str, ...]) -> None:
    node: Any = group
    for key in path[:-1]:
        node = node.get(key) if isinstance(node, dict) else None
        if node is None:
            return
    if isinstance(node, dict):
        node.pop(path[-1], None)


def _get(group: dict[str, Any], dotted: str) -> tuple[Any, str] | None:
    node: Any = group
    parts = dotted.split(".")
    for key in parts[:-1]:
        node = node.get(key) if isinstance(node, dict) else None
        if node is None:
            return None
    return (node, parts[-1]) if isinstance(node, dict) and parts[-1] in node else None


def apply_suppression(group: dict[str, Any], fields: list[dict[str, Any]]) -> list[str]:
    """Remove values the removal list says to suppress. Returns what was removed."""
    removed: list[str] = []
    for entry in fields:
        if entry.get("group") not in (group["id"], "*"):
            continue
        located = _get(group, str(entry.get("field", "")))
        if not located:
            continue
        container, key = located
        current = container[key]
        value = entry.get("value")
        if isinstance(current, list):
            kept = [v for v in current if str(v) != str(value)]
            if len(kept) != len(current):
                container[key] = kept
                removed.append(f"{group['id']}:{entry['field']}")
        elif current is not None and (value is None or str(current) == str(value)):
            container[key] = None
            removed.append(f"{group['id']}:{entry['field']}")
    return removed


def site_record(
    group: dict[str, Any], vocab: Vocab, suppress: list[dict[str, Any]] | None = None
) -> dict[str, Any]:
    """The full published record: everything except `leads`, with planning districts added, the
    street address of mailing-only locations removed, and suppressed values removed."""
    record = copy.deepcopy(group)
    record.pop("leads", None)
    for loc in record.get("locations") or []:
        loc["planning_district"] = planning_district_for(loc, vocab)
        if loc.get("label") in MAILING_LABELS:
            loc["address"] = None
            loc["lat"] = None
            loc["lng"] = None
    if suppress:
        apply_suppression(record, suppress)
    return record


def compact_record(record: dict[str, Any]) -> dict[str, Any]:
    compact = copy.deepcopy(record)
    for path in _COMPACT_DROP:
        _drop(compact, path)
    return prune(compact)


@dataclass
class BuildResult:
    published: int
    report: CheckReport
    path: str
    guides: dict[str, GuideBuild] = field(default_factory=dict)


def build_site_data(
    layout: Layout, vocab: Vocab, *, today: str | None = None, pages_dir: Any = None
) -> BuildResult:
    today = today or _dt.date.today().isoformat()
    report = run_checks(layout, vocab, pages_dir=pages_dir)
    write_report(layout, report)
    passed = set(report.passed)
    store = GroupStore(layout.groups_dir)
    blocklist = load_blocklist(layout.blocklist_path)

    out_dir = layout.site_data_dir
    if out_dir.exists():
        shutil.rmtree(out_dir)
    (out_dir / "groups").mkdir(parents=True)

    compact: list[dict[str, Any]] = []
    by_status: Counter[str] = Counter()
    by_tier: Counter[str] = Counter()
    by_category: Counter[str] = Counter()
    by_district: Counter[str] = Counter()
    tier_all: Counter[str] = Counter()
    tier0_unchecked = 0
    hidden = 0
    for group in store.iter_groups():
        tier_all[str(group.get("research_tier") or 0)] += 1
        if group.get("hidden"):
            hidden += 1
            continue
        if (group.get("research_tier") or 0) < 1:
            tier0_unchecked += 1
            continue
        if group["id"] not in passed or (group.get("audience") or {}).get("partisan"):
            continue
        record = site_record(group, vocab, blocklist.fields)
        (out_dir / "groups" / f"{group['id']}.json").write_text(
            json.dumps(record, ensure_ascii=False, separators=(",", ":")) + "\n",
            encoding="utf-8",
        )
        compact.append(compact_record(record))
        by_status[group.get("status") or "unknown"] += 1
        by_tier[str(group["research_tier"])] += 1
        for category in group.get("categories") or []:
            by_category[category] += 1
        districts = {d for d in (loc.get("planning_district") for loc in record["locations"]) if d}
        for district in districts:
            by_district[district] += 1

    (out_dir / "groups.json").write_text(
        json.dumps(
            {"built": today, "count": len(compact), "groups": compact},
            ensure_ascii=False,
            separators=(",", ":"),
        )
        + "\n",
        encoding="utf-8",
    )
    (out_dir / "vocab.json").write_text(
        json.dumps(_plain(vocab.raw), ensure_ascii=False, separators=(",", ":"), default=str)
        + "\n",
        encoding="utf-8",
    )
    manifest = {
        "built": today,
        "published": len(compact),
        "held_by_checks": report.counts["held"],
        "hidden": hidden,
        "tier0_unchecked": tier0_unchecked,
        "groups_total": sum(tier_all.values()),
        "by_status": dict(sorted(by_status.items())),
        "by_tier": dict(sorted(by_tier.items())),
        "by_tier_all_groups": dict(sorted(tier_all.items())),
        "by_category": dict(sorted(by_category.items())),
        "by_planning_district": dict(sorted(by_district.items())),
        "coverage": _latest_coverage(layout),
    }
    (out_dir / "manifest.json").write_text(
        json.dumps(manifest, indent=1, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    guides = build_guides(layout, today=today)
    return BuildResult(published=len(compact), report=report, path=str(out_dir), guides=guides)


def _latest_coverage(layout: Layout) -> Any:
    folder = layout.coverage_dir
    if not folder.exists():
        return None
    files = sorted(folder.glob("*.json"))
    if not files:
        return None
    try:
        return json.loads(files[-1].read_text(encoding="utf-8"))
    except ValueError:
        return None

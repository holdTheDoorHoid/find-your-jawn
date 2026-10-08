"""`fyj batches <wave>`: split groups into batch files for research agents.

Each file, research/batches/<wave>/<nn>.json, is a list of compact group dicts holding what an
agent needs to find the group and nothing it should copy: the name, other names, kind, address,
planning district, contacts as published, the lead ids to put in `match.lead_ids`, a trimmed
lead description, and the sign of life checker's result when there is one. Groups are ordered by
planning district so one agent's batch is mostly one part of the city.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from fyj.checks import LeadTexts
from fyj.groupfile import GroupStore
from fyj.liveness import read_results
from fyj.paths import Layout
from fyj.vocab import Vocab

DESCRIPTION_CAP = 600
DEFAULT_SIZE = 20


@dataclass
class Selector:
    sources: set[str] | None = None  # lead source ids, for example irs_990n
    kinds: set[str] | None = None
    tiers: set[int] | None = None
    districts: set[str] | None = None
    ids: set[str] | None = None
    exclude_done: bool = False
    target_tier: int = 1


def trim_description(text: str | None, cap: int = DESCRIPTION_CAP) -> str | None:
    """A lead description cut to `cap` characters at a word boundary. Page scripts that a crawl
    mistook for text are dropped."""
    if not text:
        return None
    flat = " ".join(text.split())
    if not flat or "dataLayer" in flat or re.search(r"function\s*\(", flat):
        return None
    if len(flat) <= cap:
        return flat
    cut = flat[:cap].rsplit(" ", 1)[0]
    return cut.rstrip(" ,;:") + "..."


def group_districts(group: dict[str, Any], vocab: Vocab) -> list[str]:
    seen: list[str] = []
    for loc in group.get("locations") or []:
        district = loc.get("planning_district")
        if district:
            district = vocab.resolve_district(district) or district
            if district not in seen:
                seen.append(district)
    return seen


def matches(group: dict[str, Any], sel: Selector, vocab: Vocab) -> bool:
    if group.get("hidden"):
        return False
    if sel.ids is not None and group["id"] not in sel.ids:
        return False
    if sel.sources is not None and not any(
        lead.split(":", 1)[0] in sel.sources for lead in group.get("leads") or []
    ):
        return False
    if sel.kinds is not None and group.get("kind") not in sel.kinds:
        return False
    tier = group.get("research_tier") or 0
    if sel.tiers is not None and tier not in sel.tiers:
        return False
    if sel.exclude_done and tier >= sel.target_tier:
        return False
    if sel.districts is not None and not (set(group_districts(group, vocab)) & sel.districts):
        return False
    return True


def compact_group(
    group: dict[str, Any],
    vocab: Vocab,
    lead_texts: LeadTexts,
    liveness: dict[str, Any] | None,
) -> dict[str, Any]:
    locations = group.get("locations") or []
    first = next((loc for loc in locations if loc.get("address") or loc.get("zip")), {})
    descriptions = []
    for lead_id in group.get("leads") or []:
        text = trim_description(lead_texts.description(lead_id))
        if text:
            descriptions.append({"lead_id": lead_id, "text": text})
    contacts = group.get("contacts") or {}
    districts = group_districts(group, vocab)
    entry: dict[str, Any] = {
        "id": group["id"],
        "name": group["name"],
        "aka": group.get("aka") or [],
        "kind": group.get("kind"),
        "ein": group.get("ein"),
        "address": first.get("address"),
        "zip": first.get("zip"),
        "planning_district": districts[0] if districts else None,
        "research_tier": group.get("research_tier") or 0,
        "lead_ids": group.get("leads") or [],
        "contacts": {k: v for k, v in contacts.items() if v},
        "lead_descriptions": descriptions,
    }
    if liveness:
        entry["liveness"] = {
            k: liveness.get(k)
            for k in (
                "verdict",
                "http_status",
                "final_url",
                "newest_date",
                "evidence_url",
                "checked_at",
                "note",
            )
        }
    return entry


def select_groups(layout: Layout, vocab: Vocab, sel: Selector) -> list[dict[str, Any]]:
    store = GroupStore(layout.groups_dir)
    picked = [g for g in store.iter_groups() if matches(g, sel, vocab)]
    picked.sort(key=lambda g: (group_districts(g, vocab) or ["~"])[0] + "/" + g["id"])
    return picked


def write_batches(
    layout: Layout,
    vocab: Vocab,
    wave: str,
    sel: Selector,
    *,
    size: int = DEFAULT_SIZE,
    limit: int | None = None,
) -> tuple[int, list[Path]]:
    """Write the batch files. Returns (groups selected, files written)."""
    groups = select_groups(layout, vocab, sel)
    if limit:
        groups = groups[:limit]
    lead_texts = LeadTexts(layout.leads_dir)
    liveness = read_results(layout.liveness_path)
    folder = layout.batches_dir(wave)
    folder.mkdir(parents=True, exist_ok=True)
    for old in folder.glob("*.json"):
        old.unlink()
    count = max(1, -(-len(groups) // size)) if groups else 0
    width = max(2, len(str(count)))
    files: list[Path] = []
    for number in range(count):
        chunk = groups[number * size : (number + 1) * size]
        entries = [compact_group(g, vocab, lead_texts, liveness.get(g["id"])) for g in chunk]
        path = folder / f"{number + 1:0{width}d}.json"
        path.write_text(json.dumps(entries, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
        files.append(path)
    return len(groups), files

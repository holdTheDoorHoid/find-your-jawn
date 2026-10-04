"""Converts the hand maintained data/seeds/manual.yaml into leads.

This is the only harvester that does not touch the network: the file itself is the source,
kept up to date by hand. See data/seeds/manual.yaml for what is in it and why.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml

from fyj.http import FyjClient
from fyj.leads import make_lead
from fyj.paths import MANUAL_SEEDS_PATH

SOURCE_ID = "manual_seeds"


def parse_seeds(entries: list[dict[str, Any]]) -> list[dict[str, Any]]:
    leads = []
    for entry in entries:
        extra = dict(entry.get("extra") or {})
        note = entry.get("note")
        if note:
            extra["note"] = note
        leads.append(
            make_lead(
                source=SOURCE_ID,
                source_url=entry["source_url"],
                native_id=entry["id"],
                name=entry["name"],
                aka=entry.get("aka", []),
                kind_hint=entry.get("kind_hint", "other"),
                website=entry.get("website"),
                city=entry.get("city", "Philadelphia"),
                tags_hint=entry.get("tags", []),
                extra=extra,
            )
        )
    return leads


def load_seed_file(path: Path = MANUAL_SEEDS_PATH) -> list[dict[str, Any]]:
    with open(path, encoding="utf-8") as f:
        data = yaml.safe_load(f) or []
    if not isinstance(data, list):
        raise ValueError(f"{path} must contain a YAML list of seed entries")
    return data


def harvest(_client: FyjClient) -> list[dict[str, Any]]:
    return parse_seeds(load_seed_file())

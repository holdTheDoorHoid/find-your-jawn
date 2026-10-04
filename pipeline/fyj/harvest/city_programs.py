"""Converts the hand researched data/seeds/city_programs.yaml into leads.

Like manual_seeds.py, this harvester does not touch the network: the YAML file itself is the
source. It exists because the keyword crawl in city_volunteer_pages.py cannot find a program that
has no phila.gov page matching its keyword list, or that lives on a City subdomain the crawl does
not follow, or whose name a crawl would otherwise take from link text rather than the program's
own heading. See research/harvest/2026-10-04-city-programs.md for how each entry was verified.

Only the `programs` list is harvested. The `discontinued` list in the same file is a research
record (what looked dead, and the evidence for that), not something to publish as a lead.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

import yaml

from fyj.http import FyjClient
from fyj.leads import make_lead
from fyj.paths import CITY_PROGRAMS_PATH

SOURCE_ID = "city_programs"


def _slugify(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return slug or "program"


def parse_programs(entries: list[dict[str, Any]]) -> list[dict[str, Any]]:
    leads = []
    seen_ids: set[str] = set()
    for entry in entries:
        native_id = _slugify(entry["name"])
        if native_id in seen_ids:
            # belt and suspenders, same reasoning as city_volunteer_pages.py: don't let a rare
            # slug collision between two differently named programs abort the whole harvest.
            native_id = f"{native_id}-{len(seen_ids)}"
        seen_ids.add(native_id)

        evidence_date = entry.get("evidence_date")
        seen_at = (
            [
                {
                    "source_url": entry["url"],
                    "date": evidence_date,
                    "note": "city_programs research pass",
                }
            ]
            if evidence_date
            else []
        )

        # DATA_MODEL's open_to_public_hint is true/false/null. Every entry in `programs` passed
        # the task's "a resident can actually volunteer with or join" bar, except Soak It Up
        # Adoption (an org level grant, not an individual sign up) and Mural Arts (a link only
        # nonprofit partner entry we deliberately did not research in depth).
        who_can_join = entry.get("who_can_join") or ""
        if entry["name"] == "Mural Arts Philadelphia volunteering":
            open_to_public_hint = None
        elif "not open to individual residents applying directly" in who_can_join:
            open_to_public_hint = False
        else:
            open_to_public_hint = True

        extra = {
            "department": entry.get("department"),
            "signup_url": entry.get("signup_url"),
            "what": entry.get("what"),
            "who_can_join": entry.get("who_can_join"),
            "commitment": entry.get("commitment"),
            "training": entry.get("training"),
            "clearances": entry.get("clearances"),
            "season": entry.get("season"),
            "evidence_date": evidence_date,
            "notes": entry.get("notes"),
        }

        leads.append(
            make_lead(
                source=SOURCE_ID,
                source_url=entry["url"],
                native_id=native_id,
                name=entry["name"],
                kind_hint="program",
                website=entry.get("url"),
                city="Philadelphia",
                open_to_public_hint=open_to_public_hint,
                tags_hint=["City of Philadelphia volunteer program"],
                seen_at=seen_at,
                extra=extra,
            )
        )
    return leads


def load_seed_file(path: Path = CITY_PROGRAMS_PATH) -> list[dict[str, Any]]:
    with open(path, encoding="utf-8") as f:
        data = yaml.safe_load(f) or {}
    if not isinstance(data, dict) or "programs" not in data:
        raise ValueError(f"{path} must be a mapping with a top level 'programs' list")
    programs = data["programs"]
    if not isinstance(programs, list):
        raise ValueError(f"{path}: 'programs' must be a YAML list")
    return programs


def harvest(_client: FyjClient) -> list[dict[str, Any]]:
    return parse_programs(load_seed_file())

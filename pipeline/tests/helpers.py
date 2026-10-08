"""Small builders shared by the group pipeline tests."""

from __future__ import annotations

import json
from typing import Any

from fyj.groupfile import GroupStore, blank_group, blank_location
from fyj.leads import make_lead, write_leads_jsonl


def good_record(**over: Any) -> dict[str, Any]:
    """A research record that passes every check on the fixture vocabulary."""
    rec: dict[str, Any] = {
        "match": {"lead_ids": [], "group_id": None, "ein": None, "website": None},
        "verdict": "publish",
        "name": "Philadelphia Grotto",
        "kind": "club",
        "summary": "A caving club that runs trips to caves in Pennsylvania and teaches beginners.",
        "what_you_do": "Join monthly meetings and weekend caving trips.",
        "categories": ["outdoors-adventure"],
        "interests": ["caving", "hiking"],
        "motives": ["social"],
        "formats": ["learn_skill"],
        "roles": ["hands_on"],
        "crowd": ["all_adults"],
        "audience": {"open_to": "public", "min_age": 18},
        "schedule": {"text": "First Thursday of each month", "days": ["thu"], "recurring": True},
        "cost": {"level": "low", "text": "Annual dues"},
        "commitment": "monthly",
        "contacts": {"website": "https://phillygrotto.org"},
        "status": "active",
        "last_sign_of_life": "2026-09",
        "sign_of_life_url": "https://phillygrotto.org",
        "sources": [{"url": "https://phillygrotto.org", "seen": "2026-10-04", "fields": ["name"]}],
        "research_tier": 1,
        "confidence": "medium",
    }
    rec.update(over)
    return rec


def write_inbox(layout, wave: str, agent: str, records: list[dict[str, Any]], **top: Any) -> None:
    folder = layout.inbox_dir(wave)
    folder.mkdir(parents=True, exist_ok=True)
    payload = {"wave": wave, "agent": agent, "records": records, **top}
    (folder / f"{agent}.json").write_text(json.dumps(payload), encoding="utf-8")


def make_group(layout, group_id: str, name: str, **fields: Any) -> dict[str, Any]:
    group = blank_group(group_id, name)
    for key, value in fields.items():
        if isinstance(value, dict) and isinstance(group.get(key), dict):
            group[key].update(value)
        else:
            group[key] = value
    GroupStore(layout.groups_dir).write_many([group])
    return group


def location(**values: Any) -> dict[str, Any]:
    return blank_location(**values)


def write_leads(layout, source: str, leads: list[dict[str, Any]]) -> None:
    write_leads_jsonl(layout.leads_dir / f"{source}.jsonl", leads)


def lead(source: str, native_id: str, name: str, **kwargs: Any) -> dict[str, Any]:
    return make_lead(
        source=source,
        source_url=f"https://example.org/{source}",
        native_id=native_id,
        name=name,
        harvested_at="2026-10-04",
        **kwargs,
    )

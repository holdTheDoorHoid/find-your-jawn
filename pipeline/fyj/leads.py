"""The lead schema and JSONL writer described in docs/DATA_MODEL.md section 2."""

from __future__ import annotations

import datetime as _dt
import json
from pathlib import Path
from typing import Any

# Order matches the table in docs/DATA_MODEL.md section 2, so every leads file reads the same way.
LEAD_FIELD_ORDER = [
    "lead_id",
    "source",
    "source_url",
    "native_id",
    "name",
    "aka",
    "kind_hint",
    "description",
    "website",
    "email",
    "phone",
    "social",
    "contact_name",
    "address",
    "city",
    "zip",
    "lat",
    "lng",
    "meeting_place",
    "schedule_text",
    "school",
    "open_to_public_hint",
    "ein",
    "ntee",
    "irs_subsection",
    "irs_status",
    "tags_hint",
    "seen_at",
    "extra",
    "harvested_at",
]

REQUIRED_FIELDS = ("lead_id", "source", "source_url", "native_id", "name")

_LIST_FIELDS = {"aka", "social", "tags_hint", "seen_at"}
_DICT_FIELDS = {"extra"}


def today_iso() -> str:
    return _dt.date.today().isoformat()


def make_lead(
    *,
    source: str,
    source_url: str,
    native_id: str,
    name: str,
    harvested_at: str | None = None,
    **kwargs: Any,
) -> dict[str, Any]:
    """Build one lead dict with every DATA_MODEL field present, defaulted to null/empty."""
    native_id = str(native_id)
    lead: dict[str, Any] = {
        "lead_id": f"{source}:{native_id}",
        "source": source,
        "source_url": source_url,
        "native_id": native_id,
        "name": name,
        "aka": [],
        "kind_hint": None,
        "description": None,
        "website": None,
        "email": None,
        "phone": None,
        "social": [],
        "contact_name": None,
        "address": None,
        "city": None,
        "zip": None,
        "lat": None,
        "lng": None,
        "meeting_place": None,
        "schedule_text": None,
        "school": None,
        "open_to_public_hint": None,
        "ein": None,
        "ntee": None,
        "irs_subsection": None,
        "irs_status": None,
        "tags_hint": [],
        "seen_at": [],
        "extra": {},
        "harvested_at": harvested_at or today_iso(),
    }
    for key, value in kwargs.items():
        if key not in lead:
            raise KeyError(f"unknown lead field: {key}")
        lead[key] = value
    validate_lead(lead)
    return lead


def validate_lead(lead: dict[str, Any]) -> None:
    for field in REQUIRED_FIELDS:
        if not lead.get(field):
            raise ValueError(f"lead missing required field {field!r}: {lead!r}")
    for field in _LIST_FIELDS:
        if not isinstance(lead.get(field, []), list):
            raise ValueError(f"lead field {field!r} must be a list: {lead!r}")
    for field in _DICT_FIELDS:
        if not isinstance(lead.get(field, {}), dict):
            raise ValueError(f"lead field {field!r} must be an object: {lead!r}")
    expected_prefix = f"{lead['source']}:"
    if not lead["lead_id"].startswith(expected_prefix):
        raise ValueError(
            f"lead_id {lead['lead_id']!r} does not start with {expected_prefix!r}"
        )


def ordered_lead(lead: dict[str, Any]) -> dict[str, Any]:
    """Return a copy with keys in the canonical DATA_MODEL order, dropping anything unknown."""
    return {key: lead[key] for key in LEAD_FIELD_ORDER if key in lead}


def write_leads_jsonl(path: Path, leads: list[dict[str, Any]]) -> int:
    """Write leads sorted by lead_id, one JSON object per line. Returns the number written.

    Raises ValueError on a duplicate lead_id, since that would silently drop a record.
    """
    for lead in leads:
        validate_lead(lead)
    sorted_leads = sorted(leads, key=lambda lead: lead["lead_id"])
    seen_ids: set[str] = set()
    for lead in sorted_leads:
        if lead["lead_id"] in seen_ids:
            raise ValueError(f"duplicate lead_id: {lead['lead_id']}")
        seen_ids.add(lead["lead_id"])

    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        for lead in sorted_leads:
            f.write(json.dumps(ordered_lead(lead), ensure_ascii=False))
            f.write("\n")
    return len(sorted_leads)


def read_leads_jsonl(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    leads = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            leads.append(json.loads(line))
    return leads


def clean_zip(raw: str | None) -> str | None:
    """Normalize a ZIP or ZIP+4 string down to the five digit ZIP, or None."""
    if not raw:
        return None
    digits = "".join(ch for ch in str(raw) if ch.isdigit())
    if len(digits) < 5:
        return None
    return digits[:5]


def clean_text(raw: str | None) -> str | None:
    """Collapse whitespace and drop a field that is empty or a lone placeholder character."""
    if raw is None:
        return None
    text = str(raw).strip()
    if not text or text in {"N/A", "n/a", "-", "."}:
        return None
    return text

"""Value lists and shape checks for group records (DATA_MODEL sections 3 and 7)."""

from __future__ import annotations

import re
from typing import Any

from fyj.vocab import Vocab

OPEN_TO = ("public", "students", "members", "parents", "residents", "invite")
STATUSES = ("active", "probably_active", "dormant", "defunct", "unknown")
COST_LEVELS = ("free", "low", "paid", "unknown")
COMMITMENTS = ("one_off", "drop_in", "monthly", "weekly", "ongoing_role", "seasonal")
GROUP_SIZES = ("small", "medium", "large", "varies")
WHEELCHAIR = ("yes", "partial", "no", "unknown")
YES_NO_UNKNOWN = ("yes", "no", "unknown")
SEASONS = ("year_round", "spring", "summer", "fall", "winter", "event_only")
DAYS = ("mon", "tue", "wed", "thu", "fri", "sat", "sun")
CONFIDENCES = ("high", "medium", "low")
VERDICTS = ("publish", "hide", "not_a_group", "duplicate", "out_of_area")

# 2026-09, or 2026 when only the year is known
_MONTH_RE = re.compile(r"^\d{4}(-(0[1-9]|1[0-2]))?$")
_DATE_RE = re.compile(r"^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$")

TEXT_FIELDS: tuple[tuple[str, ...], ...] = (
    ("summary",),
    ("what_you_do",),
    ("schedule", "text"),
    ("cost", "text"),
    ("first_step", "how"),
    ("first_step", "basis"),
    ("first_step", "what_to_expect"),
    ("access", "notes"),
    ("requirements", "gear"),
)
TEXT_LIST_FIELDS: tuple[tuple[str, ...], ...] = (("first_step", "first_visit_tips"),)

# A problem is (check name, detail). The check names follow DATA_MODEL section 7.
Problem = tuple[str, str]


def get_path(group: dict[str, Any], path: tuple[str, ...]) -> Any:
    node: Any = group
    for key in path:
        if not isinstance(node, dict):
            return None
        node = node.get(key)
    return node


def our_texts(group: dict[str, Any]) -> list[tuple[str, str]]:
    """Every piece of our own wording in a group, as (field name, text)."""
    out: list[tuple[str, str]] = []
    for path in TEXT_FIELDS:
        value = get_path(group, path)
        if isinstance(value, str) and value.strip():
            out.append((".".join(path), value))
    for path in TEXT_LIST_FIELDS:
        value = get_path(group, path)
        if isinstance(value, list):
            for index, tip in enumerate(value):
                if isinstance(tip, str) and tip.strip():
                    out.append((f"{'.'.join(path)}[{index}]", tip))
    for index, loc in enumerate(group.get("locations") or []):
        if isinstance(loc, dict) and isinstance(loc.get("transit"), str) and loc["transit"]:
            out.append((f"locations[{index}].transit", loc["transit"]))
    return out


def is_month(value: Any) -> bool:
    return isinstance(value, str) and bool(_MONTH_RE.match(value))


def is_date(value: Any) -> bool:
    return isinstance(value, str) and bool(_DATE_RE.match(value))


def _in(value: Any, allowed: tuple[str, ...] | set[str]) -> bool:
    return value is None or value in allowed


def _list_values(
    group: dict[str, Any], field: str, resolve: Any, label: str, problems: list[Problem]
) -> None:
    values = group.get(field) or []
    if not isinstance(values, list):
        problems.append(("schema", f"{field} must be a list"))
        return
    for value in values:
        if not resolve(value) == value:
            problems.append(("schema", f"{label} {value!r} is not in the vocabulary"))


def validate_schema(group: dict[str, Any], vocab: Vocab) -> list[Problem]:
    """Check 1: required fields are present and every controlled value exists."""
    problems: list[Problem] = []

    def need(label: str, value: Any) -> None:
        if value is None or value == "" or value == []:
            problems.append(("schema", f"{label} is required"))

    need("id", group.get("id"))
    need("name", group.get("name"))
    need("summary", group.get("summary"))
    need("kind", group.get("kind"))
    need("categories", group.get("categories"))
    need("interests", group.get("interests"))
    need("audience.open_to", get_path(group, ("audience", "open_to")))

    if group.get("id") and group.get("id") != group.get("id", "").lower():
        problems.append(("schema", "id must be lowercase"))

    if not vocab.families:
        problems.append(
            ("schema", "data/vocab/interests.yaml was not found, so interests cannot be checked")
        )
    else:
        _list_values(group, "categories", vocab.resolve_family, "category", problems)
        _list_values(group, "interests", vocab.resolve_tag, "interest", problems)
    kind = group.get("kind")
    if kind is not None and not vocab.valid("kinds", kind):
        problems.append(("schema", f"kind {kind!r} is not in the vocabulary"))
    for field, vocab_name in (
        ("motives", "motives"),
        ("formats", "formats"),
        ("roles", "roles"),
        ("crowd", "audiences"),
    ):
        if vocab_name in vocab.simple:
            _list_values(
                group,
                field,
                lambda v, name=vocab_name: vocab.resolve_simple(name, v),
                field,
                problems,
            )

    enums = (
        ("audience.open_to", get_path(group, ("audience", "open_to")), OPEN_TO),
        ("status", group.get("status"), STATUSES),
        ("cost.level", get_path(group, ("cost", "level")), COST_LEVELS),
        ("commitment", group.get("commitment"), COMMITMENTS),
        ("group_size", group.get("group_size"), GROUP_SIZES),
        ("access.wheelchair", get_path(group, ("access", "wheelchair")), WHEELCHAIR),
        (
            "requirements.court_ordered_ok",
            get_path(group, ("requirements", "court_ordered_ok")),
            YES_NO_UNKNOWN,
        ),
        (
            "requirements.service_hours_letter",
            get_path(group, ("requirements", "service_hours_letter")),
            YES_NO_UNKNOWN,
        ),
        ("schedule.season", get_path(group, ("schedule", "season")), SEASONS),
        ("confidence", group.get("confidence"), CONFIDENCES),
    )
    for label, value, allowed in enums:
        if not _in(value, allowed):
            problems.append(("schema", f"{label} {value!r} is not one of {', '.join(allowed)}"))
    for day in get_path(group, ("schedule", "days")) or []:
        if day not in DAYS:
            problems.append(("schema", f"schedule.days value {day!r} is not one of {DAYS}"))
    faith = get_path(group, ("audience", "faith"))
    if faith and "faith" in vocab.simple and faith not in vocab.simple["faith"]:
        problems.append(("schema", f"audience.faith {faith!r} is not in the vocabulary"))
    if "community" in vocab.simple:
        for item in get_path(group, ("audience", "community")) or []:
            prefix, _, rest = str(item).partition(":")
            if prefix == "heritage" and rest:
                continue  # new heritages are accepted and reviewed by a person
            if prefix == "language" and rest in vocab.simple.get("languages", {rest}):
                continue
            if item not in vocab.simple["community"]:
                problems.append(("schema", f"audience.community {item!r} is not in the vocabulary"))
    if "languages" in vocab.simple:
        for code in get_path(group, ("access", "languages")) or []:
            if code not in vocab.simple["languages"]:
                problems.append(("schema", f"access.languages {code!r} is not in the vocabulary"))
    support = group.get("kind") == "support_group" or bool(
        set(group.get("categories") or []) & vocab.support_families
    )
    if support and not get_path(group, ("audience", "support_group")):
        problems.append(("scope", "support groups need audience.support_group: true"))
    friendliness = get_path(group, ("first_step", "newcomer_friendliness"))
    if friendliness is not None and (
        isinstance(friendliness, bool) or friendliness not in (1, 2, 3, 4, 5)
    ):
        problems.append(("schema", "first_step.newcomer_friendliness must be 1 to 5"))
    if group.get("research_tier") not in (0, 1, 2, 3):
        problems.append(("schema", "research_tier must be 0, 1, 2 or 3"))
    if group.get("hidden_reason") is not None and group["hidden_reason"] not in (
        "out_of_scope",
        "partisan",
        "defunct",
        "duplicate",
        "private",
        "removal_request",
    ):
        problems.append(("schema", f"hidden_reason {group['hidden_reason']!r} is not allowed"))

    last = group.get("last_sign_of_life")
    if last is not None and not is_month(last):
        problems.append(("schema", f"last_sign_of_life {last!r} must look like 2026-09 or 2026"))
    status = group.get("status")
    if status == "active" and last is None:
        problems.append(("schema", "status active needs a dated last_sign_of_life"))
    if status in ("active", "probably_active") and not group.get("sign_of_life_url"):
        problems.append(("schema", f"status {status} needs sign_of_life_url"))
    checked = group.get("last_checked")
    if checked is not None and not is_date(checked):
        problems.append(("schema", f"last_checked {checked!r} must look like 2026-10-04"))

    for index, loc in enumerate(group.get("locations") or []):
        hood = loc.get("neighborhood") if isinstance(loc, dict) else None
        if hood and vocab.neighborhoods and hood not in vocab.neighborhoods:
            problems.append(("schema", f"locations[{index}].neighborhood {hood!r} is unknown"))
    return problems


def validate_sources(group: dict[str, Any]) -> list[Problem]:
    """Check 2: at least one source with a URL and the date it was seen."""
    sources = group.get("sources") or []
    good = [
        s
        for s in sources
        if isinstance(s, dict)
        and isinstance(s.get("url"), str)
        and s["url"].startswith(("http://", "https://"))
        and is_date(s.get("seen"))
    ]
    if not good:
        return [("sources", "needs at least one source with a URL and a date seen")]
    return []

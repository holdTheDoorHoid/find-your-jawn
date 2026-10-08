"""`fyj import-research <wave>`: validate research records and merge them into group files.

Implements DATA_MODEL section 6. Research agents (Haiku) make small format slips, so this module
is forgiving about shape (a string where a list belongs, "unknown" for null, a missing optional
block, wording that is a synonym of a vocabulary term) and strict about the required fields and the
publish checks of section 7. Records that fail are held in research/held/<wave>/ with the reasons.
"""

from __future__ import annotations

import copy
import datetime as _dt
import json
import re
import shutil
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from fyj import schema
from fyj.checks import CheckContext, check_group, load_blocklist
from fyj.dates import month_diff, status_for_age, to_full_date, to_month_or_year
from fyj.groupfile import (
    HIDDEN_REASONS,
    GroupStore,
    blank_group,
    canonical_group,
)
from fyj.groupindex import GroupIndex
from fyj.paths import Layout
from fyj.textutil import collapse_whitespace, fix_dashes, normalize_name, website_domain
from fyj.vocab import Vocab

NULLISH = {
    "",
    "unknown",
    "n/a",
    "na",
    "none",
    "null",
    "nil",
    "not stated",
    "not specified",
    "unspecified",
    "not available",
    "not found",
    "tbd",
    "-",
    "?",
    "unclear",
}

_TRUE = {"true", "yes", "y", "1", "t"}
_FALSE = {"false", "no", "n", "0", "f"}

_ENUM_SYNONYMS: dict[str, dict[str, str]] = {
    "audience.open_to": {
        "everyone": "public",
        "anyone": "public",
        "open": "public",
        "all": "public",
        "open_to_all": "public",
        "general_public": "public",
        "the_public": "public",
        "student": "students",
        "students_only": "students",
        "member": "members",
        "members_only": "members",
        "parent": "parents",
        "resident": "residents",
        "invitation": "invite",
        "invite_only": "invite",
        "by_invitation": "invite",
    },
    "cost.level": {
        "no_cost": "free",
        "none": "free",
        "gratis": "free",
        "cheap": "low",
        "inexpensive": "low",
        "low_cost": "low",
        "fee": "paid",
        "expensive": "paid",
        "moderate": "paid",
        "high": "paid",
    },
    "commitment": {
        "one_time": "one_off",
        "onetime": "one_off",
        "single": "one_off",
        "once": "one_off",
        "event": "one_off",
        "event_based": "one_off",
        "dropin": "drop_in",
        "ongoing": "ongoing_role",
        "regular": "weekly",
    },
    "schedule.season": {
        "year_round": "year_round",
        "yearround": "year_round",
        "all_year": "year_round",
        "autumn": "fall",
        "event": "event_only",
        "events_only": "event_only",
    },
    "access.wheelchair": {"accessible": "yes", "true": "yes", "false": "no", "partly": "partial"},
    "group_size": {"mid": "medium", "big": "large", "varied": "varies", "any": "varies"},
    "confidence": {"med": "medium", "mid": "medium"},
    "status": {"alive": "active", "inactive": "dormant", "closed": "defunct", "dead": "defunct"},
}

_DAY_WORDS = {
    "mon": "mon",
    "monday": "mon",
    "mondays": "mon",
    "tue": "tue",
    "tues": "tue",
    "tuesday": "tue",
    "tuesdays": "tue",
    "wed": "wed",
    "weds": "wed",
    "wednesday": "wed",
    "wednesdays": "wed",
    "thu": "thu",
    "thur": "thu",
    "thurs": "thu",
    "thursday": "thu",
    "thursdays": "thu",
    "fri": "fri",
    "friday": "fri",
    "fridays": "fri",
    "sat": "sat",
    "saturday": "sat",
    "saturdays": "sat",
    "sun": "sun",
    "sunday": "sun",
    "sundays": "sun",
}
_DAY_GROUPS = {
    "weekdays": ["mon", "tue", "wed", "thu", "fri"],
    "weekend": ["sat", "sun"],
    "weekends": ["sat", "sun"],
    "daily": list(schema.DAYS),
    "every_day": list(schema.DAYS),
}

SCALAR_FIELDS = ("summary", "what_you_do", "commitment", "group_size", "ein", "confidence")
LIST_REPLACE_FIELDS = ("categories", "interests", "motives", "formats", "roles", "crowd")
BOOL_FIELDS = ("bridging", "online_ok")

BLOCK_FIELDS: dict[str, dict[str, str]] = {
    "audience": {
        "open_to": "enum",
        "school": "text",
        "min_age": "int",
        "max_age": "int",
        "community": "community",
        "faith": "faith",
        "partisan": "bool",
        "support_group": "bool",
    },
    "schedule": {
        "text": "text",
        "days": "days",
        "times": "slugs",
        "recurring": "bool",
        "season": "enum",
    },
    "cost": {"level": "enum", "text": "text"},
    "access": {"wheelchair": "enum", "languages": "languages", "notes": "text"},
    "requirements": {
        "act153_clearances": "bool",
        "background_check": "bool",
        "court_ordered_ok": "yesno",
        "service_hours_letter": "yesno",
        "kids_ok": "bool",
        "gear": "text",
    },
    "first_step": {
        "how": "text",
        "drop_in": "bool",
        "sign_up_needed": "bool",
        "newcomer_friendliness": "int",
        "basis": "text",
        "what_to_expect": "text",
        "first_visit_tips": "tips",
    },
    "contacts": {
        "website": "url",
        "email": "text",
        "phone": "text",
        "contact_name": "text",
        "social": "urls",
        "calendar_feed": "url",
    },
}
_BLOCK_ENUM_KEY = {
    ("audience", "open_to"): "audience.open_to",
    ("cost", "level"): "cost.level",
    ("schedule", "season"): "schedule.season",
    ("access", "wheelchair"): "access.wheelchair",
}
_UNKNOWN_IS_VALUE = {
    ("access", "wheelchair"),
    ("requirements", "court_ordered_ok"),
    ("requirements", "service_hours_letter"),
    ("cost", "level"),
}


# -- coercion helpers --------------------------------------------------------------------------


def _nullish(value: Any) -> bool:
    if value is None:
        return True
    if isinstance(value, str):
        return value.strip().lower() in NULLISH
    if isinstance(value, (list, dict)):
        return not value
    return False


def _text(value: Any) -> str | None:
    if _nullish(value):
        return None
    if isinstance(value, list):
        value = "; ".join(str(v) for v in value if not _nullish(v))
    elif isinstance(value, dict):
        return None
    text = collapse_whitespace(str(value))
    return text or None


def _our_text(value: Any) -> str | None:
    text = _text(value)
    return fix_dashes(text) if text else None


def _bool(value: Any) -> bool | None:
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)) and value in (0, 1):
        return bool(value)
    if isinstance(value, str):
        low = value.strip().lower()
        if low in _TRUE:
            return True
        if low in _FALSE:
            return False
    return None


def _int(value: Any) -> int | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return int(value)
    if isinstance(value, str):
        match = re.search(r"\d+", value)
        if match and value.strip().lower() not in NULLISH:
            return int(match.group(0))
    return None


def _slug(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", value.strip().lower()).strip("_")


def _items(value: Any, *, split_commas: bool = True) -> list[str]:
    """A list of non empty strings from a list, or from a string split on commas or semicolons."""
    if _nullish(value):
        return []
    if isinstance(value, str):
        parts = re.split(r"[;,\n|]" if split_commas else r"[;\n|]", value)
    elif isinstance(value, list):
        parts = [str(v) for v in value if v is not None and not isinstance(v, (dict, list))]
    elif isinstance(value, dict):
        parts = [str(v) for v in value.values() if isinstance(v, str)]
    else:
        parts = [str(value)]
    out: list[str] = []
    for part in parts:
        text = collapse_whitespace(part)
        if text and text.lower() not in NULLISH and text not in out:
            out.append(text)
    return out


def _enum(path: str, value: Any, allowed: tuple[str, ...]) -> str | None:
    if value is None or isinstance(value, (list, dict)):
        return None
    if isinstance(value, bool):
        value = "yes" if value else "no"
    slug = _slug(str(value))
    slug = _ENUM_SYNONYMS.get(path, {}).get(slug, slug)
    if slug in allowed:
        return slug
    return None


def _days(value: Any) -> list[str]:
    out: list[str] = []
    for item in _items(value):
        key = _slug(item)
        for day in _DAY_GROUPS.get(key, [_DAY_WORDS.get(key, key)]):
            if day not in out:
                out.append(day)
    return out


def _url(value: Any) -> str | None:
    text = _text(value)
    return text


def _zip(value: Any) -> str | None:
    if value is None:
        return None
    digits = "".join(ch for ch in str(value) if ch.isdigit())
    return digits[:5] if len(digits) >= 5 else None


def _float(value: Any) -> float | None:
    if isinstance(value, bool) or value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


@dataclass
class Coerced:
    record: dict[str, Any]
    problems: list[str] = field(default_factory=list)  # reasons that hold the record
    warnings: list[str] = field(default_factory=list)  # slips that were repaired or dropped


def _coerce_vocab_list(
    values: Any, resolve: Any, label: str, out: Coerced, *, hint: str | None = None
) -> list[str]:
    result: list[str] = []
    for item in _items(values):
        mapped = resolve(item)
        if mapped is None:
            out.warnings.append(f"{label} {item!r} is not in the vocabulary, dropped")
        elif mapped not in result:
            result.append(mapped)
    return result


def coerce_record(raw: dict[str, Any], vocab: Vocab, today: str | None = None) -> Coerced:
    out = Coerced(record={})
    rec = out.record

    # -- meta ---------------------------------------------------------------------------------
    verdict = _slug(str(raw.get("verdict") or "")) if raw.get("verdict") is not None else ""
    verdict = {
        "publish": "publish",
        "published": "publish",
        "ok": "publish",
        "hide": "hide",
        "hidden": "hide",
        "not_a_group": "not_a_group",
        "notagroup": "not_a_group",
        "duplicate": "duplicate",
        "dup": "duplicate",
        "out_of_area": "out_of_area",
        "outofarea": "out_of_area",
    }.get(verdict, verdict)
    if verdict not in schema.VERDICTS:
        out.problems.append(
            f"verdict {raw.get('verdict')!r} must be one of {', '.join(schema.VERDICTS)}"
        )
    rec["verdict"] = verdict

    match_raw = raw.get("match") if isinstance(raw.get("match"), dict) else {}
    lead_ids = _items(match_raw.get("lead_ids") or raw.get("lead_ids"), split_commas=True)
    group_id = _text(match_raw.get("group_id") or raw.get("group_id"))
    ein = "".join(ch for ch in str(match_raw.get("ein") or raw.get("ein") or "") if ch.isdigit())
    rec["match"] = {
        "lead_ids": lead_ids,
        "group_id": group_id,
        "ein": ein if len(ein) == 9 else None,
        "website": _url(match_raw.get("website")),
    }
    if not isinstance(raw.get("match"), dict):
        out.warnings.append("match block missing, matching by name and the other fields")
    hidden_reason = _enum("hidden_reason", raw.get("hidden_reason"), HIDDEN_REASONS)
    rec["hidden_reason"] = hidden_reason

    # -- identity ---------------------------------------------------------------------------
    name = _text(raw.get("name"))
    if name:
        rec["name"] = name
    aka = _items(raw.get("aka"), split_commas=False)
    if aka:
        rec["aka"] = aka
    if rec["match"]["ein"] is None and raw.get("ein") and not _nullish(raw.get("ein")):
        digits = "".join(ch for ch in str(raw["ein"]) if ch.isdigit())
        if len(digits) == 9:
            rec["ein"] = digits
    elif rec["match"]["ein"]:
        rec["ein"] = rec["match"]["ein"]

    # -- text and enumerations -----------------------------------------------------------------
    for key in ("summary", "what_you_do"):
        text = _our_text(raw.get(key))
        if text:
            rec[key] = text
    kind_raw = raw.get("kind")
    if not _nullish(kind_raw):
        kind = vocab.resolve_simple("kinds", kind_raw)
        if kind is None:
            out.problems.append(f"kind {kind_raw!r} is not in the vocabulary")
        else:
            rec["kind"] = kind
    for key, allowed in (
        ("commitment", schema.COMMITMENTS),
        ("group_size", schema.GROUP_SIZES),
        ("confidence", schema.CONFIDENCES),
    ):
        if not _nullish(raw.get(key)):
            value = _enum(key, raw[key], allowed)
            if value is None:
                out.warnings.append(f"{key} {raw[key]!r} is not allowed, dropped")
            else:
                rec[key] = value
    for key in BOOL_FIELDS:
        value = _bool(raw.get(key))
        if value is not None:
            rec[key] = value

    # -- vocabulary lists, with synonym mapping ---------------------------------------------------
    cats = _coerce_vocab_list(raw.get("categories"), vocab.resolve_family, "category", out)
    tags: list[str] = []
    for item in _items(raw.get("interests")):
        tag = vocab.resolve_tag(item)
        if tag:
            if tag not in tags:
                tags.append(tag)
            continue
        family = vocab.resolve_family(item)
        if family:  # an agent put a family where a tag belongs
            if family not in cats:
                cats.append(family)
            continue
        out.warnings.append(f"interest {item!r} is not in the vocabulary, dropped")
    # a tag in categories: keep the tag and add its family
    for item in _items(raw.get("categories")):
        tag = vocab.resolve_tag(item)
        if tag and vocab.resolve_family(item) is None:
            if tag not in tags:
                tags.append(tag)
            fam = vocab.tags.get(tag)
            if fam and fam not in cats:
                cats.append(fam)
    if cats:
        rec["categories"] = cats
    if tags:
        rec["interests"] = tags
    for key, vocab_name in (
        ("motives", "motives"),
        ("formats", "formats"),
        ("roles", "roles"),
        ("crowd", "audiences"),
    ):
        if vocab_name in vocab.simple:
            values = _coerce_vocab_list(
                raw.get(key),
                lambda v, n=vocab_name: vocab.resolve_simple(n, v),
                key[:-1] if key.endswith("s") else key,
                out,
            )
        else:
            values = _items(raw.get(key))
        if values:
            rec[key] = values

    # -- blocks ----------------------------------------------------------------------------------
    for block, fields in BLOCK_FIELDS.items():
        raw_block = raw.get(block)
        if raw_block is None:
            continue
        if not isinstance(raw_block, dict):
            out.warnings.append(f"{block} should be an object, ignored")
            continue
        cleaned: dict[str, Any] = {}
        for key, kind_name in fields.items():
            if key not in raw_block:
                continue
            value = raw_block[key]
            coerced = _coerce_block_value(block, key, kind_name, value, out, vocab)
            if coerced is not None:
                cleaned[key] = coerced
        if cleaned:
            rec[block] = cleaned
    rec["locations"] = _coerce_locations(raw.get("locations"), out)
    if not rec["locations"]:
        del rec["locations"]

    # -- evidence and provenance ----------------------------------------------------------
    status = _enum("status", raw.get("status"), schema.STATUSES)
    if status:
        rec["status"] = status
    elif not _nullish(raw.get("status")):
        out.warnings.append(f"status {raw.get('status')!r} is not allowed, dropped")
    today = today or _dt.date.today().isoformat()
    last = raw.get("last_sign_of_life")
    if not _nullish(last):
        month = to_month_or_year(str(last))
        if month and month > today[: len(month)]:
            # a planned event is not a past sign of life: the newest honest date is this month
            out.warnings.append(f"last_sign_of_life {last!r} is in the future, set to now")
            month = today[: len(month)]
        if month:
            rec["last_sign_of_life"] = month
        else:
            out.warnings.append(f"last_sign_of_life {last!r} is not a date, dropped")
    sol_url = _url(raw.get("sign_of_life_url"))
    if sol_url:
        rec["sign_of_life_url"] = sol_url
    _settle_status(raw, rec, out, today)

    sources = _coerce_sources(raw.get("sources"), out)
    rec["sources"] = sources
    tier = _int(raw.get("research_tier"))
    if tier is None:
        tier = 1
        if verdict == "publish":
            out.warnings.append("research_tier missing, taken as 1")
    if tier not in (1, 2):
        out.problems.append(f"research_tier {raw.get('research_tier')!r} must be 1 or 2")
    rec["research_tier"] = tier

    # A publishable record that leaves out who can join defaults to the public (students for a
    # student group). Agents omit the block when a group simply says "come out" or "email us".
    if verdict == "publish":
        audience = rec.get("audience")
        if not isinstance(audience, dict):
            audience = rec["audience"] = {}
        if not audience.get("open_to"):
            audience["open_to"] = "students" if rec.get("kind") == "student_org" else "public"
            out.warnings.append(f"audience.open_to missing, defaulted to {audience['open_to']}")
    return out


def _settle_status(raw: dict[str, Any], rec: dict[str, Any], out: Coerced, today: str) -> None:
    """Make status, date and URL agree, the way the status rules in DATA_MODEL do.

    Agents often say probably_active for a live site with no dated post (allowed), say active
    with an old date or none (not allowed: active needs dated evidence in the last 12 months),
    or leave the URL out. The published "Last seen active" must not overclaim, so a status the
    date cannot support is lowered and a missing URL is taken from the site the agent cited.
    """
    status = rec.get("status")
    last = rec.get("last_sign_of_life")
    if status == "unknown" and last:
        rec["status"] = status = status_for_age(month_diff(last, today[:7]))
        out.warnings.append("status unknown with a dated sign of life, taken from the date")
    elif status == "active":
        supported = status_for_age(month_diff(last, today[:7])) if last else "probably_active"
        if supported != "active":
            rec["status"] = status = supported
            out.warnings.append(f"status active is not supported by the date, lowered to {status}")
    if status in ("active", "probably_active") and not rec.get("sign_of_life_url"):
        site = (
            _url((raw.get("contacts") or {}).get("website"))
            if isinstance(raw.get("contacts"), dict)
            else None
        )
        fallback = site or next((s["url"] for s in _coerce_sources(raw.get("sources"), out)), None)
        if fallback:
            rec["sign_of_life_url"] = fallback
            out.warnings.append("sign_of_life_url missing, taken from the cited site")


def _coerce_block_value(
    block: str, key: str, kind_name: str, value: Any, out: Coerced, vocab: Vocab
) -> Any:
    path = _BLOCK_ENUM_KEY.get((block, key))
    if kind_name == "text":
        return _our_text(value) if (block, key) in _OUR_WORDS else _text(value)
    if kind_name == "tips":
        tips = [fix_dashes(t) for t in _items(value, split_commas=False)]
        return tips or None
    if kind_name == "bool":
        return _bool(value)
    if kind_name == "int":
        return _int(value)
    if kind_name == "url":
        return _url(value)
    if kind_name == "urls":
        return _items(value, split_commas=False) or None
    if kind_name == "slugs":
        items = [_slug(i) for i in _items(value)]
        return [i for i in items if i] or None
    if kind_name == "community":
        return _coerce_community(value, out, vocab)
    if kind_name == "faith":
        return _coerce_faith(value, out, vocab)
    if kind_name == "languages":
        return _coerce_languages(value, out, vocab)
    if kind_name == "days":
        return _days(value) or None
    if kind_name == "yesno":
        coerced = _bool(value)
        if coerced is not None:
            return "yes" if coerced else "no"
        coerced_text = _enum("yesno", value, schema.YES_NO_UNKNOWN)
        return coerced_text if coerced_text not in (None, "unknown") else None
    if kind_name == "enum":
        allowed = {
            "audience.open_to": schema.OPEN_TO,
            "cost.level": schema.COST_LEVELS,
            "schedule.season": schema.SEASONS,
            "access.wheelchair": schema.WHEELCHAIR,
        }[path]
        if _nullish(value) and (block, key) not in _UNKNOWN_IS_VALUE:
            return None
        result = _enum(path, value, allowed)
        if result is None:
            if (block, key) == ("audience", "open_to"):
                if not _nullish(value):
                    out.problems.append(f"audience.open_to {value!r} is not allowed")
            elif not _nullish(value):
                out.warnings.append(f"{path} {value!r} is not allowed, dropped")
            return None
        if result == "unknown":
            return None
        return result
    return None


def _coerce_community(value: Any, out: Coerced, vocab: Vocab) -> list[str] | None:
    result: list[str] = []
    for item in _items(value):
        low = item.strip().lower()
        if low.startswith(("heritage:", "language:")):
            prefix, _, rest = low.partition(":")
            mapped = f"{prefix}:{_slug(rest)}"
        elif "community" not in vocab.simple:
            mapped = _slug(item)
        else:
            mapped = vocab.resolve_simple("community", item)
            if mapped is None and (heritage := vocab.resolve_simple("heritage", item)):
                mapped = f"heritage:{heritage}"
            if mapped is None and (language := vocab.resolve_simple("languages", item)):
                mapped = f"language:{language}"
        if mapped is None:
            out.warnings.append(f"community {item!r} is not in the vocabulary, dropped")
        elif mapped not in result:
            result.append(mapped)
    return result or None


def _coerce_faith(value: Any, out: Coerced, vocab: Vocab) -> str | None:
    text = _text(value)
    if text is None:
        return None
    if "faith" not in vocab.simple:
        return _slug(text)
    mapped = vocab.resolve_simple("faith", text)
    if mapped is None:
        out.warnings.append(f"faith {text!r} is not in the vocabulary, dropped")
    return mapped


def _coerce_languages(value: Any, out: Coerced, vocab: Vocab) -> list[str] | None:
    result: list[str] = []
    for item in _items(value):
        low = item.strip().lower()
        mapped = vocab.resolve_simple("languages", low) if "languages" in vocab.simple else low
        if mapped is None and re.fullmatch(r"[a-z]{2,3}", low):
            mapped = low
        if mapped is None:
            out.warnings.append(f"language {item!r} is not in the vocabulary, dropped")
        elif mapped not in result:
            result.append(mapped)
    return result or None


_OUR_WORDS = {
    ("schedule", "text"),
    ("cost", "text"),
    ("access", "notes"),
    ("requirements", "gear"),
    ("first_step", "how"),
    ("first_step", "basis"),
    ("first_step", "what_to_expect"),
}


def _coerce_locations(value: Any, out: Coerced) -> list[dict[str, Any]]:
    if value is None:
        return []
    if isinstance(value, (dict, str)):
        value = [value]
    if not isinstance(value, list):
        return []
    result: list[dict[str, Any]] = []
    for item in value:
        if isinstance(item, str):
            item = {"address": item}
        if not isinstance(item, dict):
            continue
        loc = {
            "label": _our_text(item.get("label")),
            "address": _text(item.get("address")),
            "neighborhood": _text(item.get("neighborhood")),
            "planning_district": _text(item.get("planning_district")),
            "zip": _zip(item.get("zip")),
            "lat": _float(item.get("lat")),
            "lng": _float(item.get("lng")),
            "in_city": _bool(item.get("in_city")),
            "transit": _our_text(item.get("transit")),
        }
        if loc["zip"] is None and loc["address"]:
            found = re.search(r"\b(\d{5})(?:-\d{4})?\b\s*$", loc["address"])
            if found:
                loc["zip"] = found.group(1)
        if any(v is not None for v in loc.values()):
            result.append(loc)
    return result


def _coerce_sources(value: Any, out: Coerced) -> list[dict[str, Any]]:
    if value is None:
        return []
    if isinstance(value, (dict, str)):
        value = [value]
    result: list[dict[str, Any]] = []
    for item in value if isinstance(value, list) else []:
        if isinstance(item, str):
            item = {"url": item}
        if not isinstance(item, dict):
            continue
        url = _text(item.get("url"))
        if not url:
            continue
        seen = (
            to_full_date(str(item.get("seen") or item.get("date") or ""))
            if (item.get("seen") or item.get("date"))
            else None
        )
        fields = [f for f in _items(item.get("fields")) if f]
        result.append({"url": url, "seen": seen, "fields": fields})
    return result


# -- validation and merge -------------------------------------------------------------------------


def required_problems(rec: dict[str, Any]) -> list[str]:
    """Missing required fields, by verdict. These hold the record."""
    problems: list[str] = []
    verdict = rec.get("verdict")
    if not rec.get("name") and not any(
        rec["match"].get(k) for k in ("lead_ids", "group_id", "ein", "website")
    ):
        problems.append("no name and nothing in match to find the group with")
    sources = rec.get("sources") or []
    good = [s for s in sources if s.get("url") and s.get("seen")]
    if not good:
        problems.append("sources: at least one entry with a url and a seen date (YYYY-MM-DD)")
    if verdict == "hide" and not rec.get("hidden_reason"):
        problems.append("hide needs a hidden_reason")
    if verdict == "duplicate" and not rec["match"].get("group_id"):
        problems.append("duplicate needs match.group_id (the group that survives)")
    if verdict == "publish":
        if not rec.get("name"):
            problems.append("name is required to publish")
        for key in ("summary", "kind"):
            if not rec.get(key):
                problems.append(f"{key} is required to publish")
        for key in ("categories", "interests"):
            if not rec.get(key):
                problems.append(f"{key} needs at least one value from the vocabulary")
        if not (rec.get("audience") or {}).get("open_to"):
            problems.append("audience.open_to is required to publish")
        status = rec.get("status")
        if not status:
            problems.append("status is required for tier 1 and tier 2 records")
        elif status == "active" and not rec.get("last_sign_of_life"):
            problems.append("status active needs last_sign_of_life")
        if status in ("active", "probably_active") and not rec.get("sign_of_life_url"):
            problems.append(f"sign_of_life_url is required when status is {status}")
    return problems


def _empty(value: Any) -> bool:
    return value is None or value == "" or value == [] or value == {}


def _union(base: list[Any], extra: list[Any]) -> list[Any]:
    out = list(base)
    for item in extra:
        if item not in out:
            out.append(item)
    return out


def _merge_sources(group: dict[str, Any], sources: list[dict[str, Any]]) -> None:
    by_url = {s["url"]: s for s in group["sources"] if isinstance(s, dict) and s.get("url")}
    for src in sources:
        if not src.get("url"):
            continue
        existing = by_url.get(src["url"])
        if existing is None:
            entry = {"url": src["url"], "seen": src.get("seen"), "fields": list(src["fields"])}
            group["sources"].append(entry)
            by_url[src["url"]] = entry
        else:
            existing["fields"] = _union(existing.get("fields") or [], src["fields"])
            if src.get("seen") and (not existing.get("seen") or src["seen"] > existing["seen"]):
                existing["seen"] = src["seen"]


def merge_record(
    group: dict[str, Any],
    rec: dict[str, Any],
    today: str,
    vocab_support: frozenset[str] | set[str] = frozenset(),
) -> None:
    """Merge one coerced record into a group dict, in place.

    Research values win over harvested values and over an older research tier. A record at a lower
    tier than the group only fills what is empty. Sources, leads and aka are only ever added to,
    so a published source is never dropped.
    """
    rec_tier = rec.get("research_tier") or 1
    overwrite = rec_tier >= (group.get("research_tier") or 0)

    def put(container: dict[str, Any], key: str, value: Any, *, unknown: Any = None) -> None:
        current = container.get(key)
        if overwrite or _empty(current) or current == unknown:
            container[key] = value

    name = rec.get("name")
    if name and name != group.get("name"):
        if overwrite or not group.get("name"):
            old = group.get("name")
            group["name"] = name
            if old and normalize_name(old) != normalize_name(name):
                group["aka"] = _union(group["aka"], [old])
        else:
            group["aka"] = _union(group["aka"], [name])
    group["aka"] = [
        a
        for a in _union(group["aka"], rec.get("aka") or [])
        if normalize_name(a) != normalize_name(group["name"] or "")
    ]
    group["leads"] = sorted(set(group["leads"]) | set(rec["match"].get("lead_ids") or []))
    if rec.get("ein") and not group.get("ein"):
        group["ein"] = rec["ein"]

    for key in ("summary", "what_you_do", "kind", "commitment", "group_size", "confidence"):
        if rec.get(key) is not None:
            put(group, key, rec[key])
    for key in BOOL_FIELDS:
        if key in rec:
            put(group, key, rec[key])
    for key in LIST_REPLACE_FIELDS:
        if rec.get(key):
            put(group, key, list(rec[key]))

    for block, values in BLOCK_FIELDS.items():
        incoming = rec.get(block) or {}
        target = group[block]
        for key in values:
            if key not in incoming:
                continue
            value = incoming[key]
            if key == "social":
                target[key] = _union(target.get(key) or [], value)
                continue
            if key == "community":
                put(target, key, value)
                continue
            unknown = "unknown" if (block, key) in _UNKNOWN_IS_VALUE else None
            put(target, key, value, unknown=unknown)

    if (group.get("kind") == "support_group") or (set(group["categories"]) & vocab_support):
        group["audience"]["support_group"] = True

    if rec.get("locations"):
        if overwrite or not group["locations"]:
            group["locations"] = copy.deepcopy(rec["locations"])

    # evidence: the newest dated sign of life wins, together with its URL
    new_last = rec.get("last_sign_of_life")
    old_last = group.get("last_sign_of_life")
    new_status = rec.get("status")
    if new_last:
        if not old_last or new_last > old_last or (new_last == old_last and overwrite):
            group["status"] = new_status or group.get("status")
            group["last_sign_of_life"] = new_last
            group["sign_of_life_url"] = rec.get("sign_of_life_url") or group.get("sign_of_life_url")
    elif new_status:
        if group.get("status") in (None, "unknown") or (new_status == "defunct" and overwrite):
            group["status"] = new_status
            if rec.get("sign_of_life_url") and not group.get("sign_of_life_url"):
                group["sign_of_life_url"] = rec["sign_of_life_url"]
    _merge_sources(group, rec.get("sources") or [])
    group["research_tier"] = max(group.get("research_tier") or 0, rec_tier)
    seen_dates = [s["seen"] for s in rec.get("sources") or [] if s.get("seen")]
    group["last_checked"] = max([*seen_dates, group.get("last_checked") or ""]) or today


def apply_verdict_flags(group: dict[str, Any], rec: dict[str, Any]) -> str | None:
    """Set hidden fields from the verdict. Returns a reason to hold the record, if any."""
    verdict = rec["verdict"]
    if verdict == "publish":
        if group.get("hidden"):
            if group.get("hidden_reason") in ("removal_request", "partisan"):
                return f"group is hidden as {group['hidden_reason']}; change that by hand"
            group["hidden"] = False
            group["hidden_reason"] = None
        return None
    if verdict == "hide":
        group["hidden"] = True
        group["hidden_reason"] = rec["hidden_reason"]
    elif verdict in ("not_a_group", "out_of_area"):
        group["hidden"] = True
        group["hidden_reason"] = rec.get("hidden_reason") or "out_of_scope"
    return None


# -- the import run -------------------------------------------------------------------------------


@dataclass
class ImportSummary:
    wave: str
    files: int = 0
    records_in: int = 0
    merged: int = 0
    created: int = 0
    held: int = 0
    noop: int = 0
    over_triage: int = 0
    warnings: int = 0
    by_verdict: Counter = field(default_factory=Counter)
    held_reasons: Counter = field(default_factory=Counter)

    def lines(self) -> list[str]:
        out = [
            f"Wave {self.wave}: {self.files} file(s), {self.records_in} record(s) in.",
            f"  merged into existing groups: {self.merged}",
            f"  new groups created: {self.created}",
            f"  held for repair: {self.held}",
        ]
        if self.noop:
            out.append(f"  nothing to change (no matching group to hide): {self.noop}")
        if self.over_triage:
            out.append(
                f"  created although triage had rejected the lead (research beats triage): "
                f"{self.over_triage}"
            )
        if self.warnings:
            out.append(f"  repaired or dropped small slips: {self.warnings}")
        if self.by_verdict:
            out.append(
                "  by verdict: " + ", ".join(f"{v} {n}" for v, n in sorted(self.by_verdict.items()))
            )
        if self.held_reasons:
            out.append("  top reasons held:")
            for reason, count in self.held_reasons.most_common(5):
                out.append(f"    {count} x {reason}")
        return out


def load_triage_rejected(layout: Layout) -> set[str]:
    path = layout.triage_path
    rejected: set[str] = set()
    if path.exists():
        with open(path, encoding="utf-8") as handle:
            for line in handle:
                line = line.strip()
                if line:
                    entry = json.loads(line)
                    if entry.get("decision") == "reject":
                        rejected.add(entry["lead_id"])
    return rejected


def _read_inbox_file(path: Path) -> tuple[dict[str, Any] | None, str | None]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        return None, f"not valid JSON: {exc}"
    if isinstance(data, list):
        data = {"records": data}
    if not isinstance(data, dict) or not isinstance(data.get("records"), list):
        return None, "expected an object with a records list"
    return data, None


def import_wave(
    layout: Layout,
    wave: str,
    vocab: Vocab,
    *,
    today: str | None = None,
    dry_run: bool = False,
    pages_dir: Path | None = None,
) -> ImportSummary:
    today = today or _dt.date.today().isoformat()
    summary = ImportSummary(wave=wave)
    inbox = layout.inbox_dir(wave)
    files = sorted(inbox.glob("*.json")) if inbox.exists() else []
    if not files:
        return summary
    store = GroupStore(layout.groups_dir)
    ctx = CheckContext.for_layout(layout, vocab, pages_dir)
    triage_rejected = load_triage_rejected(layout)
    blocklist = load_blocklist(layout.blocklist_path)
    warnings_log: list[dict[str, Any]] = []

    with store.lock():
        index = GroupIndex.build(store)
        taken = store.ids()
        cache: dict[str, dict[str, Any]] = {}
        dirty: set[str] = set()

        def get(gid: str) -> dict[str, Any]:
            if gid not in cache:
                cache[gid] = store.read(gid)
            return cache[gid]

        for path in files:
            summary.files += 1
            data, error = _read_inbox_file(path)
            if data is None:
                summary.held += 1
                summary.held_reasons[f"file: {error}"] += 1
                if not dry_run:
                    held_dir = layout.held_dir(wave)
                    held_dir.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(path, held_dir / path.name)
                    (held_dir / f"{path.stem}.reasons.txt").write_text(
                        f"{path.name}: {error}\n", encoding="utf-8"
                    )
                continue
            held_records: list[dict[str, Any]] = []
            for raw in data["records"]:
                summary.records_in += 1
                if not isinstance(raw, dict):
                    summary.held += 1
                    held_records.append(
                        {"_held_reasons": ["record is not an object"], "_original": raw}
                    )
                    summary.held_reasons["record is not an object"] += 1
                    continue
                outcome, reasons = _import_one(
                    raw,
                    vocab,
                    ctx,
                    index,
                    store,
                    taken,
                    cache,
                    dirty,
                    get,
                    triage_rejected,
                    blocklist,
                    today,
                    summary,
                    warnings_log,
                )
                summary.by_verdict[str(raw.get("verdict") or "unknown")] += 1
                if outcome == "held":
                    summary.held += 1
                    entry = dict(raw)
                    entry["_held_reasons"] = reasons
                    held_records.append(entry)
                    for reason in reasons:
                        summary.held_reasons[reason.split(":")[0][:80]] += 1
            if held_records and not dry_run:
                held_dir = layout.held_dir(wave)
                held_dir.mkdir(parents=True, exist_ok=True)
                held_payload = {k: v for k, v in data.items() if k != "records"}
                held_payload["records"] = held_records
                (held_dir / path.name).write_text(
                    json.dumps(held_payload, indent=1, ensure_ascii=False) + "\n", encoding="utf-8"
                )
            if not dry_run:
                done_dir = layout.done_dir(wave)
                done_dir.mkdir(parents=True, exist_ok=True)
                target = done_dir / path.name
                number = 2
                while target.exists():
                    target = done_dir / f"{path.stem}.{number}{path.suffix}"
                    number += 1
                shutil.move(str(path), target)
        if not dry_run:
            for gid in sorted(dirty):
                store.write(cache[gid])
    if warnings_log and not dry_run:
        held_dir = layout.held_dir(wave)
        held_dir.mkdir(parents=True, exist_ok=True)
        (held_dir / "_warnings.json").write_text(
            json.dumps(warnings_log, indent=1, ensure_ascii=False) + "\n", encoding="utf-8"
        )
    return summary


def _import_one(
    raw,
    vocab,
    ctx,
    index,
    store,
    taken,
    cache,
    dirty,
    get,
    triage_rejected,
    blocklist,
    today,
    summary,
    warnings_log,
) -> tuple[str, list[str]]:
    coerced = coerce_record(raw, vocab, today)
    rec = coerced.record
    if coerced.warnings:
        summary.warnings += len(coerced.warnings)
        warnings_log.append(
            {"record": raw.get("name") or raw.get("match"), "warnings": coerced.warnings}
        )
    reasons = list(coerced.problems) + required_problems(rec)
    if reasons:
        return "held", reasons

    verdict = rec["verdict"]
    zip_code = next((loc["zip"] for loc in rec.get("locations") or [] if loc.get("zip")), None)
    hit = index.find_for_record(
        {
            **rec["match"],
            "website": rec["match"].get("website") or (rec.get("contacts") or {}).get("website"),
        },
        rec.get("name"),
        zip_code,
    )
    lead_ids = rec["match"].get("lead_ids") or []

    # blocklist: never bring back what a removal request listed
    if any(lead in blocklist.leads for lead in lead_ids):
        return "held", ["a lead id is on the removal list (data/blocklist.yaml)"]
    if rec.get("ein") and rec["ein"] in blocklist.eins:
        return "held", ["the EIN is on the removal list (data/blocklist.yaml)"]
    domain = website_domain(
        (rec.get("contacts") or {}).get("website") or rec["match"].get("website")
    )
    if domain and domain in blocklist.domains:
        return "held", ["the website domain is on the removal list (data/blocklist.yaml)"]

    if verdict == "duplicate":
        survivor_id = rec["match"]["group_id"]
        if survivor_id not in index.by_id:
            return "held", [f"duplicate: match.group_id {survivor_id!r} is not a group"]
        dup_hit = index.find_for_record(
            {
                "lead_ids": lead_ids,
                "ein": rec["match"].get("ein"),
                "website": rec["match"].get("website"),
            },
            rec.get("name"),
            zip_code,
        )
        survivor = get(survivor_id)
        survivor["leads"] = sorted(set(survivor["leads"]) | set(lead_ids))
        if rec.get("name") and normalize_name(rec["name"]) != normalize_name(survivor["name"]):
            survivor["aka"] = _union(survivor["aka"], [rec["name"]])
        dirty.add(survivor_id)
        for lead_id in lead_ids:
            index.by_lead[lead_id] = survivor_id
        if dup_hit and dup_hit[0] != survivor_id:
            dup = get(dup_hit[0])
            dup["hidden"] = True
            dup["hidden_reason"] = "duplicate"
            dirty.add(dup_hit[0])
            summary.merged += 1
        else:
            summary.noop += 1
        return "ok", []

    created = False
    if hit is None:
        if verdict != "publish" and not rec.get("name"):
            summary.noop += 1
            return "ok", []
        name = rec.get("name") or "Unnamed group"
        hood = next(
            (loc["neighborhood"] for loc in rec.get("locations") or [] if loc.get("neighborhood")),
            None,
        )
        slug = store.make_slug(name, taken, neighborhood=hood, zip_code=zip_code)
        taken.add(slug)
        group = blank_group(slug, name)
        created = True
        gid = slug
    else:
        gid = hit[0]
        group = get(gid)

    candidate = copy.deepcopy(group)
    merge_record(candidate, rec, today, vocab.support_families)
    held_reason = apply_verdict_flags(candidate, rec)
    if held_reason:
        return "held", [held_reason]

    if verdict == "publish" and not candidate["hidden"]:
        problems = check_group(candidate, ctx)
        if problems:
            if created:
                taken.discard(gid)
            return "held", [f"{c}: {d}" for c, d in problems]

    candidate = canonical_group(candidate)
    cache[gid] = candidate
    dirty.add(gid)
    index.add(candidate)
    if created:
        summary.created += 1
        if any(lead in triage_rejected for lead in lead_ids) and verdict == "publish":
            summary.over_triage += 1
    else:
        summary.merged += 1
    return "ok", []

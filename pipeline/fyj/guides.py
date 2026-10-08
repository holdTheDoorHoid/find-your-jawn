"""Guide lists (DATA_MODEL section 9): `fyj import-guide <guide>` and the guide step of `fyj build`.

A guide is a list of useful things that are not groups, such as the bar quizzo nights on the
"Quizzo nights" page. One YAML file per guide at data/guides/<guide>.yaml. Research agents (Haiku)
leave entries in research/inbox/guide-<guide>/<agent>.json; the importer repairs small slips in
them (a time written "8 pm", a day written "Tuesday"), refuses entries that are missing the facts
we cannot guess (venue, day, a dated source, a status), and merges the rest into the guide file.
`fyj build` then copies the confirmed entries to site/public/data/guides/<guide>.json.
"""

from __future__ import annotations

import datetime as _dt
import fcntl
import json
import os
import re
import shutil
import tempfile
from collections import Counter
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml

from fyj.checks import load_blocklist
from fyj.dates import to_full_date
from fyj.groupfile import _plain
from fyj.paths import Layout
from fyj.textutil import (
    canon,
    collapse_whitespace,
    fix_dashes,
    normalize_name,
    slugify,
    website_domain,
)
from fyj.vocab import Vocab

_Loader = getattr(yaml, "CSafeLoader", yaml.SafeLoader)
_Dumper = getattr(yaml, "CSafeDumper", yaml.SafeDumper)

DAYS = ("mon", "tue", "wed", "thu", "fri", "sat", "sun")
COSTS = ("free", "paid", "unknown")
AGES = ("21_plus", "all_ages", "unknown")
STATUSES = ("confirmed", "unconfirmed")

# The fixed order of keys in an entry, so every entry has the same shape and diffs stay small.
ENTRY_KEYS = (
    "id",
    "venue",
    "address",
    "zip",
    "neighborhood",
    "planning_district",
    "day",
    "start",
    "host",
    "cost",
    "cost_text",
    "team_size",
    "age",
    "notes",
    "status",
    "sources",
    "last_checked",
)
HEADER_KEYS = ("guide", "title", "updated", "lead_sources")

# Platforms whose terms or nature make them leads, never the page that confirms a night
# (CLAUDE.md: Meetup, Eventbrite, Nextdoor, Facebook, Instagram and the like). A guide's own
# lead_sources are added to this list when the importer runs.
LEAD_ONLY_DOMAINS = {
    "facebook.com",
    "fb.com",
    "instagram.com",
    "meetup.com",
    "eventbrite.com",
    "nextdoor.com",
    "idealist.org",
    "joinphilly.com",
    "yelp.com",
    "tiktok.com",
    "twitter.com",
    "x.com",
}

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
    "not published",
    "unspecified",
    "not available",
    "not found",
    "tbd",
    "-",
    "?",
    "unclear",
}


# -- small coercions --------------------------------------------------------------------------


def _nullish(value: Any) -> bool:
    if value is None:
        return True
    if isinstance(value, str):
        return value.strip().lower() in NULLISH
    if isinstance(value, (list, dict)):
        return not value
    return False


def _text(value: Any) -> str | None:
    if _nullish(value) or isinstance(value, dict):
        return None
    if isinstance(value, list):
        value = "; ".join(str(v) for v in value if not _nullish(v))
    text = collapse_whitespace(str(value))
    return text or None


def _our_text(value: Any) -> str | None:
    text = _text(value)
    return fix_dashes(text) if text else None


def _build_day_words() -> dict[str, str]:
    full = {
        "mon": "monday",
        "tue": "tuesday",
        "wed": "wednesday",
        "thu": "thursday",
        "fri": "friday",
        "sat": "saturday",
        "sun": "sunday",
    }
    extra = {"tue": ["tues"], "wed": ["weds"], "thu": ["thur", "thurs"]}
    words: dict[str, str] = {}
    for short, name in full.items():
        for word in [short, name, name + "s", *extra.get(short, [])]:
            words[word] = short
    return words


_DAY_WORDS = _build_day_words()


def parse_day(value: Any) -> tuple[str | None, str | None]:
    """(day, problem). 'Tuesday', 'Tuesdays', 'Tues.' and 'tue' all give 'tue'. Two different days
    are a problem: an entry is one night, so a venue with two nights gets two entries."""
    if isinstance(value, list):
        value = " ".join(str(v) for v in value)
    if _nullish(value):
        return None, "day is required (mon, tue, wed, thu, fri, sat or sun)"
    found: list[str] = []
    for word in re.findall(r"[a-z]+", str(value).lower()):
        day = _DAY_WORDS.get(word)
        if day and day not in found:
            found.append(day)
    if not found:
        return None, f"day {str(value)!r} is not a day of the week"
    if len(found) > 1:
        return None, f"day {str(value)!r} names more than one night; write one entry per night"
    return found[0], None


_MERIDIEM = r"(?:[ap]\.?\s?m\.?)"
_TIME_TOKEN = re.compile(
    rf"(?<![\d:.])(\d{{1,2}})(?::(\d{{2}}))?(?::\d{{2}})?\s*({_MERIDIEM})?(?!\d)", re.IGNORECASE
)


def parse_time(value: Any) -> tuple[str | None, str | None]:
    """(24 hour 'HH:MM' or None, a warning). Reads '20:00', '8 pm', '8:30 p.m.', '8-10pm' and
    '2000'. A time with no am or pm that could be either ('8:00') is left blank with a warning,
    because we never guess."""
    if _nullish(value) or isinstance(value, (list, dict, bool)):
        return None, None
    text = collapse_whitespace(str(value)).lower()
    if text in ("noon", "12 noon"):
        return "12:00", None
    if re.fullmatch(r"\d{4}", text):
        hh, mm = int(text[:2]), int(text[2:])
        return (f"{hh:02d}:{mm:02d}", None) if hh < 24 and mm < 60 else (None, _bad_time(value))
    tokens = list(_TIME_TOKEN.finditer(text))
    # Prefer a token that looks like a time (has a colon or am or pm) over a stray number.
    pick = next((m for m in tokens if m.group(2) or m.group(3)), tokens[0] if tokens else None)
    if pick is None:
        return None, _bad_time(value)
    at = tokens.index(pick)
    start, meridiem = pick, pick.group(3)
    if meridiem and at > 0 and not tokens[at - 1].group(3) and _joined(text, tokens[at - 1], pick):
        start = tokens[at - 1]  # '8-10 pm': the night starts at 8, which shares the closing pm
    elif not meridiem and at + 1 < len(tokens) and _joined(text, pick, tokens[at + 1]):
        meridiem = tokens[at + 1].group(3)  # '7:30 to 9:30 pm'
    hour = int(start.group(1))
    minute = int(start.group(2) or 0)
    pick = start
    if minute >= 60:
        return None, _bad_time(value)
    if meridiem:
        if not 1 <= hour <= 12:
            return None, _bad_time(value)
        hour24 = hour % 12 + (12 if meridiem.strip().lower().startswith("p") else 0)
        return f"{hour24:02d}:{minute:02d}", None
    if 13 <= hour <= 23 or hour == 12:
        return f"{hour:02d}:{minute:02d}", None
    zero_padded = len(pick.group(1)) == 2 and pick.group(2) is not None
    if zero_padded and hour < 24:
        return f"{hour:02d}:{minute:02d}", None
    return None, f"start {value!r} has no am or pm, so the time was left blank"


def _joined(text: str, first: re.Match[str], second: re.Match[str]) -> bool:
    """True when two times in a text are the two ends of a range ('8-10', '7:30 to 9:30')."""
    between = text[first.end() : second.start()].replace("\u2013", "-").replace("\u2014", "-")
    return bool(re.fullmatch(r"\s*(-|to|until|till|through)\s*", between))


def _bad_time(value: Any) -> str:
    return f"start {value!r} is not a time we can read, so it was left blank"


_FREE_RE = re.compile(r"\b(free|no cover|no charge|no cost|gratis)\b|\$\s?0(?!\d)", re.IGNORECASE)
_PAID_RE = re.compile(
    r"\$\s?[1-9]|\bpaid\b|\bcover\b|\bfee\b|\bticket|\bper (person|player|team)\b|\bbuy.?in\b",
    re.IGNORECASE,
)


def parse_cost(value: Any) -> tuple[str, bool]:
    """(cost, was_a_plain_word). 'Free' gives ('free', True); '$5 per person' gives ('paid',
    False), and the caller keeps the words as cost_text when it has none of its own."""
    if _nullish(value) or isinstance(value, (list, dict)):
        return "unknown", True
    if isinstance(value, bool):
        return ("paid" if value else "free"), True
    slug = re.sub(r"[^a-z0-9]+", "_", str(value).strip().lower()).strip("_")
    synonyms = {"no_cost": "free", "no_cover": "free", "gratis": "free", "cover": "paid"}
    slug = synonyms.get(slug, slug)
    if slug in COSTS:
        return slug, True
    text = str(value)
    free, paid = bool(_FREE_RE.search(text)), bool(_PAID_RE.search(text))
    if free and not paid:
        return "free", False
    if paid and not free:
        return "paid", False
    return "unknown", False


_AGE_21 = re.compile(
    r"\b21[\s_]*(\+|plus|and[\s_]*(over|up|older)|or[\s_]*(over|older|up))|\bover[\s_]*21\b"
    r"|\b21[\s_]*(years|yrs)",
    re.IGNORECASE,
)
_AGE_ALL = re.compile(r"\ball[\s_-]*ages\b|\bany[\s_]*age|\bfamily[\s_-]*friendly", re.IGNORECASE)


def parse_age(value: Any) -> tuple[str, str | None]:
    """(age, a warning). Rules we have no word for (18 and over) are left as unknown."""
    if _nullish(value) or isinstance(value, (list, dict, bool)):
        return "unknown", None
    text = str(value).strip()
    slug = re.sub(r"[^a-z0-9]+", "_", text.lower()).strip("_")
    if slug in AGES:
        return slug, None
    if _AGE_21.search(text):
        return "21_plus", None
    if _AGE_ALL.search(text):
        return "all_ages", None
    return "unknown", f"age rule {text!r} is not one we have a word for, so it was left unknown"


def parse_zip(value: Any) -> str | None:
    if value is None or isinstance(value, bool):
        return None
    digits = "".join(ch for ch in str(value) if ch.isdigit())
    return digits[:5] if len(digits) >= 5 else None


def parse_status(value: Any) -> str | None:
    """'Confirmed', 'confirmed ' and 'verified' give confirmed; 'unverified' and 'lead only' give
    unconfirmed. Anything else (including nothing) is None, which holds the entry."""
    if value is None or isinstance(value, (list, dict, bool)):
        return None
    slug = re.sub(r"[^a-z0-9]+", "_", str(value).strip().lower()).strip("_")
    synonyms = {
        "verified": "confirmed",
        "unverified": "unconfirmed",
        "lead": "unconfirmed",
        "lead_only": "unconfirmed",
        "not_confirmed": "unconfirmed",
    }
    slug = synonyms.get(slug, slug)
    return slug if slug in STATUSES else None


def _clean_url(value: Any) -> str | None:
    text = _text(value)
    if not text or re.search(r"\s", text):
        return None
    if re.match(r"https?://[^/\s]+\.[^/\s]+", text, re.IGNORECASE):
        return text
    if re.match(r"^[\w-]+(\.[\w-]+)+(/|$)", text):
        return "https://" + text
    return None


def _list_of_words(value: Any) -> list[str]:
    if _nullish(value):
        return []
    parts = re.split(r"[;,\n|]", value) if isinstance(value, str) else list(value)
    out: list[str] = []
    for part in parts:
        if isinstance(part, (dict, list)) or part is None:
            continue
        word = collapse_whitespace(str(part)).lower()
        if word and word not in NULLISH and word not in out:
            out.append(word)
    return out


def coerce_sources(value: Any) -> list[dict[str, Any]]:
    """Source entries with a real web address. A `seen` that is not a full date is None, which
    the caller treats as missing."""
    if isinstance(value, (dict, str)):
        value = [value]
    result: list[dict[str, Any]] = []
    for item in value if isinstance(value, list) else []:
        if isinstance(item, str):
            item = {"url": item}
        if not isinstance(item, dict):
            continue
        url = _clean_url(item.get("url"))
        if not url:
            continue
        raw_seen = item.get("seen") or item.get("date")
        seen = to_full_date(str(raw_seen)) if raw_seen else None
        result.append({"url": url, "seen": seen, "fields": _list_of_words(item.get("fields"))})
    return result


def lead_only_domains(doc: dict[str, Any]) -> set[str]:
    domains = set(LEAD_ONLY_DOMAINS)
    for lead in doc.get("lead_sources") or []:
        domain = website_domain(lead.get("url")) if isinstance(lead, dict) else None
        if domain:
            domains.add(domain)
    return domains


def _on_domain(url: str, domains: set[str]) -> bool:
    host = website_domain(url)
    if not host:
        return False
    parts = host.split(".")
    return any(".".join(parts[i:]) in domains for i in range(len(parts) - 1))


def has_confirming_source(entry: dict[str, Any], lead_domains: set[str]) -> bool:
    """True when some source is dated and is not a lead only page (a venue's or host's own page)."""
    return any(
        s.get("url") and s.get("seen") and not _on_domain(s["url"], lead_domains)
        for s in entry.get("sources") or []
    )


# -- vocabulary lookups --------------------------------------------------------------------------


def _hood_key(name: str) -> str:
    """A key for comparing neighborhood names: 'Mt. Airy' and 'Mount Airy' match."""
    return canon(re.sub(r"\bmt\b\.?", "mount", name.lower()))


def _neighborhood_lookup(vocab: Vocab) -> dict[str, tuple[str, str | None]]:
    """_hood_key(id, name or alias) -> (label, planning district id or None).

    A broad name from the vocabulary's `aliases` (Center City, Passyunk) has a district only when
    every neighborhood it covers is in the same one. Aliases are read first, so the broad name
    people use wins over a neighborhood that happens to share its id."""
    table: dict[str, tuple[str, str | None]] = {}
    raw = vocab.raw.get("neighborhoods")
    aliases = raw.get("aliases") if isinstance(raw, dict) else None
    for alias in aliases if isinstance(aliases, list) else []:
        if not isinstance(alias, dict) or not alias.get("name"):
            continue
        districts = {
            vocab.neighborhoods.get(str(c), {}).get("planning_district")
            for c in alias.get("covers") or []
        }
        district = next(iter(districts)) if len(districts) == 1 else None
        label = str(alias["name"])
        table.setdefault(_hood_key(label), (label, str(district) if district else None))
    for hood_id, attrs in vocab.neighborhoods.items():
        label = str(attrs.get("name") or hood_id)
        pd = attrs.get("planning_district")
        for key in (hood_id, label):
            table.setdefault(_hood_key(key), (label, str(pd) if pd else None))
    return table


def district_for(
    raw_district: Any, zip_code: str | None, hood: tuple[str, str | None] | None, vocab: Vocab
) -> str | None:
    """The planning district: the one written on the entry if the vocabulary knows it, else the
    ZIP's (vocabulary ZIP table), else the neighborhood's."""
    if not _nullish(raw_district):
        resolved = vocab.resolve_district(raw_district)
        if resolved:
            return resolved
    if zip_code and zip_code in vocab.zip_districts:
        return vocab.zip_districts[zip_code]
    if hood and hood[1]:
        return vocab.resolve_district(hood[1]) or hood[1]
    return None


# -- one entry -----------------------------------------------------------------------------------


@dataclass
class Coerced:
    entry: dict[str, Any]
    problems: list[str] = field(default_factory=list)  # reasons that hold the entry
    warnings: list[str] = field(default_factory=list)  # slips repaired or dropped
    downgraded: bool = False  # marked confirmed, kept as unconfirmed (no venue or host page)


def entry_id(venue: str, day: str, zip_code: str | None = None, *, with_zip: bool = False) -> str:
    base = f"{venue} {zip_code}" if with_zip and zip_code else venue
    return f"{slugify(base, max_len=60)}-{day}"


def coerce_entry(
    raw: dict[str, Any],
    vocab: Vocab,
    lead_domains: set[str] | None = None,
    hoods: dict[str, tuple[str, str | None]] | None = None,
) -> Coerced:
    """Repair a research entry. Strict about the venue, the day, a dated source and the status;
    forgiving about everything else (an unreadable time or an unknown age rule is left blank)."""
    out = Coerced(entry={})
    warnings, problems = out.warnings, out.problems
    lead_domains = lead_domains if lead_domains is not None else set(LEAD_ONLY_DOMAINS)

    venue = _our_text(raw.get("venue") or raw.get("name"))
    if not venue:
        problems.append("venue is required")
    day, day_problem = parse_day(raw.get("day"))
    if day_problem:
        problems.append(day_problem)

    sources = coerce_sources(raw.get("sources"))
    good = [s for s in sources if s["url"] and s["seen"]]
    if not good:
        problems.append("sources: at least one entry with a web address and a seen date")
    status = parse_status(raw.get("status"))
    if status is None:
        problems.append("status is required: confirmed or unconfirmed")
    if problems:
        return out

    assert venue is not None and day is not None and status is not None
    zip_code = parse_zip(raw.get("zip"))
    if zip_code and not zip_code.startswith("191"):
        warnings.append(f"{venue}: ZIP {zip_code} is not a Philadelphia ZIP")
    hood: tuple[str, str | None] | None = None
    neighborhood = _text(raw.get("neighborhood"))
    if neighborhood:
        # the vocabulary finds the planning district; the name stays as the venue's own page or
        # the host calls it ("Fishtown"), with only its spelling and capitals tidied
        hood = (hoods or _neighborhood_lookup(vocab)).get(_hood_key(neighborhood))
        if hood and _hood_key(hood[0]) == _hood_key(neighborhood):
            neighborhood = hood[0]

    start, start_warning = parse_time(raw.get("start") or raw.get("time"))
    if start_warning:
        warnings.append(f"{venue}: {start_warning}")
    cost, plain = parse_cost(raw.get("cost"))
    cost_text = _our_text(raw.get("cost_text"))
    if cost_text is None and not plain:
        cost_text = _our_text(raw.get("cost"))
    age, age_warning = parse_age(raw.get("age"))
    if age_warning:
        warnings.append(f"{venue}: {age_warning}")

    last_checked = to_full_date(str(raw["last_checked"])) if raw.get("last_checked") else None
    if last_checked is None:
        last_checked = max(s["seen"] for s in good)

    entry: dict[str, Any] = {
        "id": entry_id(venue, day),
        "venue": venue,
        "address": _text(raw.get("address")),
        "zip": zip_code,
        "neighborhood": neighborhood,
        "planning_district": district_for(raw.get("planning_district"), zip_code, hood, vocab),
        "day": day,
        "start": start,
        "host": _our_text(raw.get("host")),
        "cost": cost,
        "cost_text": cost_text,
        "team_size": _our_text(raw.get("team_size")),
        "age": age,
        "notes": _our_text(raw.get("notes")),
        "status": status,
        "sources": good,
        "last_checked": last_checked,
    }
    if status == "confirmed" and not has_confirming_source(entry, lead_domains):
        entry["status"] = "unconfirmed"
        out.downgraded = True
        warnings.append(
            f"{venue} ({day}): marked confirmed, but no source is a venue or host page, "
            "so it was kept as unconfirmed"
        )
    out.entry = entry
    return out


# -- merge ---------------------------------------------------------------------------------------


def _venue_key(venue: str) -> str:
    return normalize_name(venue) or canon(venue)


_STREET_RE = re.compile(
    r"^\s*(\d+)\w*\s+(?:(?:n|s|e|w|north|south|east|west)\.?\s+(?=[a-z0-9]+\s))?([a-z0-9]+)",
    re.IGNORECASE,
)


def _street_key(address: Any) -> tuple[str, str] | None:
    """('123', 'chestnut') from '123 Chestnut Street' and '123 W. Chestnut St.'."""
    match = _STREET_RE.match(str(address or ""))
    return (match.group(1), match.group(2).lower()) if match else None


def same_night(a: dict[str, Any], b: dict[str, Any]) -> bool:
    """The same venue on the same night. Two venues of one name at different ZIP codes or street
    addresses (a chain) are different venues."""
    if a["day"] != b["day"] or _venue_key(a["venue"]) != _venue_key(b["venue"]):
        return False
    za, zb = a.get("zip"), b.get("zip")
    if za and zb and za != zb:
        return False
    sa, sb = _street_key(a.get("address")), _street_key(b.get("address"))
    return not (sa and sb and sa != sb)


def _blank(key: str, value: Any) -> bool:
    if value is None or value == "" or value == [] or value == {}:
        return True
    return key in ("cost", "age") and value == "unknown"


_NO_FILL = {"id", "status", "sources", "last_checked", "day"}


def merge_entries(old: dict[str, Any], new: dict[str, Any]) -> dict[str, Any]:
    """One entry from two reports of the same night. A confirmed entry beats an unconfirmed one;
    among equals the newer last_checked wins (a tie goes to the incoming one). Gaps in the winner
    are filled from the loser only when both have the same status, so a fact that only a lead
    claimed never joins a confirmed entry. Sources from both are kept."""
    rank = {"confirmed": 1, "unconfirmed": 0}

    def score(e: dict[str, Any]) -> tuple[int, str]:
        return rank.get(e.get("status"), 0), str(e.get("last_checked") or "")

    winner, loser = (new, old) if score(new) >= score(old) else (old, new)
    merged = {k: v for k, v in winner.items()}
    merged["id"] = old["id"]
    if winner.get("status") == loser.get("status"):
        for key in ENTRY_KEYS:
            if key in _NO_FILL:
                continue
            if _blank(key, merged.get(key)) and not _blank(key, loser.get(key)):
                merged[key] = loser[key]
    by_url: dict[str, dict[str, Any]] = {}
    for source in [*(winner.get("sources") or []), *(loser.get("sources") or [])]:
        url = source["url"]
        if url not in by_url:
            by_url[url] = {"url": url, "seen": source.get("seen"), "fields": []}
        have = by_url[url]
        if str(source.get("seen") or "") > str(have.get("seen") or ""):
            have["seen"] = source["seen"]
        for f in source.get("fields") or []:
            if f not in have["fields"]:
                have["fields"].append(f)
    merged["sources"] = list(by_url.values())
    return merged


def sort_entries(entries: list[dict[str, Any]]) -> list[dict[str, Any]]:
    order = {d: i for i, d in enumerate(DAYS)}
    return sorted(
        entries,
        key=lambda e: (
            order.get(e["day"], 9),
            str(e.get("start") or "99:99"),
            _venue_key(e["venue"]),
        ),
    )


# -- the guide file --------------------------------------------------------------------------------


def guide_name_ok(guide: str) -> bool:
    return bool(re.fullmatch(r"[a-z0-9]+(-[a-z0-9]+)*", guide))


def read_guide(path: Path) -> dict[str, Any]:
    with open(path, encoding="utf-8") as handle:
        data = yaml.load(handle, Loader=_Loader)  # noqa: S506 (SafeLoader subclass)
    if not isinstance(data, dict):
        raise ValueError(f"{path}: a guide file must contain a mapping")
    doc = _plain(data)
    doc["entries"] = [e for e in (doc.get("entries") or []) if isinstance(e, dict)]
    for entry in doc["entries"]:
        entry["zip"] = parse_zip(entry.get("zip"))
        entry["sources"] = [s for s in entry.get("sources") or [] if isinstance(s, dict)]
    return doc


_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def _as_date(value: Any) -> Any:
    """A YYYY-MM-DD string becomes a date so YAML writes it unquoted (2026-10-08), as in the
    DATA_MODEL example. Anything else is left alone."""
    if isinstance(value, str) and _DATE_RE.match(value):
        try:
            return _dt.date.fromisoformat(value)
        except ValueError:
            return value
    return value


def _ordered_entry(entry: dict[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for key in ENTRY_KEYS:
        value = entry.get(key)
        if key == "last_checked":
            value = _as_date(value)
        if key == "sources":
            value = [
                {
                    "url": s["url"],
                    "seen": _as_date(s.get("seen")),
                    "fields": list(s.get("fields") or []),
                }
                for s in value or []
            ]
        out[key] = value
    for key in sorted(k for k in entry if k not in ENTRY_KEYS):
        out[key] = entry[key]
    return out


def dump_guide(doc: dict[str, Any]) -> str:
    data: dict[str, Any] = {}
    for key in HEADER_KEYS:
        value = doc.get(key)
        if key == "updated":
            value = _as_date(value)
        data[key] = value if value is not None else ([] if key == "lead_sources" else None)
    for key in sorted(k for k in doc if k not in HEADER_KEYS and k != "entries"):
        data[key] = doc[key]
    data["entries"] = [_ordered_entry(e) for e in sort_entries(doc.get("entries") or [])]
    return yaml.dump(
        data,
        Dumper=_Dumper,
        sort_keys=False,
        allow_unicode=True,
        default_flow_style=False,
        width=100,
    )


@contextmanager
def guide_lock(layout: Layout) -> Iterator[None]:
    """Hold an exclusive lock while a guide file is read and rewritten."""
    layout.guides_dir.mkdir(parents=True, exist_ok=True)
    fd = os.open(layout.guides_dir / ".lock", os.O_CREAT | os.O_RDWR)
    try:
        fcntl.flock(fd, fcntl.LOCK_EX)
        yield
    finally:
        fcntl.flock(fd, fcntl.LOCK_UN)
        os.close(fd)


def write_guide(path: Path, doc: dict[str, Any]) -> None:
    text = dump_guide(doc)
    if path.exists() and path.read_text(encoding="utf-8") == text:
        return
    fd, tmp_name = tempfile.mkstemp(dir=path.parent, prefix=f".{path.stem}.", suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            handle.write(text)
        os.replace(tmp_name, path)
    except BaseException:
        Path(tmp_name).unlink(missing_ok=True)
        raise


# -- the import run --------------------------------------------------------------------------------


@dataclass
class GuideSummary:
    guide: str
    files: int = 0
    entries_in: int = 0
    created: int = 0
    updated: int = 0
    unchanged: int = 0
    held: int = 0
    downgraded: int = 0
    confirmed_total: int = 0
    unconfirmed_total: int = 0
    held_reasons: Counter = field(default_factory=Counter)
    warnings: list[str] = field(default_factory=list)

    def lines(self) -> list[str]:
        out = [
            f"Guide {self.guide}: {self.files} file(s), {self.entries_in} entry(ies) in.",
            f"  new: {self.created}, updated: {self.updated}, nothing changed: {self.unchanged}",
            f"  held for repair: {self.held}",
        ]
        if self.downgraded:
            out.append(
                f"  kept as unconfirmed because no venue or host page backs them: {self.downgraded}"
            )
        out.append(
            f"  the guide now has {self.confirmed_total} confirmed and "
            f"{self.unconfirmed_total} unconfirmed night(s)"
        )
        if self.held_reasons:
            out.append("  top reasons held:")
            for reason, count in self.held_reasons.most_common(5):
                out.append(f"    {count} x {reason}")
        if self.warnings:
            out.append(f"  repaired or dropped small slips: {len(self.warnings)}")
            for warning in self.warnings[:8]:
                out.append(f"    {warning}")
            if len(self.warnings) > 8:
                out.append(f"    and {len(self.warnings) - 8} more (see held/_warnings.json)")
        return out


def _read_inbox_file(path: Path) -> tuple[dict[str, Any] | None, str | None]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        return None, f"not valid JSON: {exc}"
    if isinstance(data, list):
        data = {"entries": data}
    if not isinstance(data, dict) or not isinstance(data.get("entries"), list):
        return None, "expected an object with an entries list"
    return data, None


def import_guide(
    layout: Layout, guide: str, vocab: Vocab, *, today: str | None = None, dry_run: bool = False
) -> GuideSummary:
    """Merge research/inbox/guide-<guide>/*.json into data/guides/<guide>.yaml."""
    if not guide_name_ok(guide):
        raise ValueError(f"not a guide name: {guide!r}")
    today = today or _dt.date.today().isoformat()
    summary = GuideSummary(guide=guide)
    path = layout.guide_path(guide)
    if not path.exists():
        raise FileNotFoundError(
            f"no guide file at {path}; create it with the guide, title, updated and "
            "lead_sources fields and an empty entries list first"
        )
    wave = f"guide-{guide}"
    inbox = layout.inbox_dir(wave)
    files = sorted(inbox.glob("*.json")) if inbox.exists() else []
    warnings_log: list[dict[str, Any]] = []

    with guide_lock(layout):
        doc = read_guide(path)
        lead_domains = lead_only_domains(doc)
        entries: list[dict[str, Any]] = doc["entries"]
        before = json.dumps(entries, sort_keys=True, default=str)
        # fill in what the vocabulary can supply for entries already on file
        hoods = _neighborhood_lookup(vocab)
        for existing in entries:
            if not existing.get("planning_district"):
                hood = hoods.get(_hood_key(existing.get("neighborhood") or ""))
                existing["planning_district"] = district_for(None, existing.get("zip"), hood, vocab)
        taken = {e["id"] for e in entries}

        for inbox_path in files:
            summary.files += 1
            data, error = _read_inbox_file(inbox_path)
            if data is None:
                summary.held += 1
                summary.held_reasons[f"file: {error}"] += 1
                if not dry_run:
                    held_dir = layout.held_dir(wave)
                    held_dir.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(inbox_path, held_dir / inbox_path.name)
                    (held_dir / f"{inbox_path.stem}.reasons.txt").write_text(
                        f"{inbox_path.name}: {error}\n", encoding="utf-8"
                    )
                continue
            held_entries: list[dict[str, Any]] = []
            for raw in data["entries"]:
                summary.entries_in += 1
                if not isinstance(raw, dict):
                    summary.held += 1
                    summary.held_reasons["entry is not an object"] += 1
                    held_entries.append(
                        {"_held_reasons": ["entry is not an object"], "_original": raw}
                    )
                    continue
                coerced = coerce_entry(raw, vocab, lead_domains, hoods)
                if coerced.problems:
                    summary.held += 1
                    for problem in coerced.problems:
                        summary.held_reasons[problem[:80]] += 1
                    held_entries.append({**raw, "_held_reasons": coerced.problems})
                    continue
                incoming = coerced.entry
                if coerced.warnings:
                    summary.warnings.extend(coerced.warnings)
                    warnings_log.append(
                        {
                            "file": inbox_path.name,
                            "entry": raw.get("venue"),
                            "notes": coerced.warnings,
                        }
                    )
                if coerced.downgraded:
                    summary.downgraded += 1
                match = next((e for e in entries if same_night(e, incoming)), None)
                if match is None:
                    candidate = incoming["id"]
                    if candidate in taken:
                        candidate = entry_id(
                            incoming["venue"], incoming["day"], incoming.get("zip"), with_zip=True
                        )
                    number = 2
                    while candidate in taken:
                        candidate = f"{entry_id(incoming['venue'], incoming['day'])}-{number}"
                        number += 1
                    incoming["id"] = candidate
                    taken.add(candidate)
                    entries.append(incoming)
                    summary.created += 1
                else:
                    merged = merge_entries(match, incoming)
                    if merged != match:
                        entries[entries.index(match)] = merged
                        summary.updated += 1
                    else:
                        summary.unchanged += 1
            if held_entries and not dry_run:
                held_dir = layout.held_dir(wave)
                held_dir.mkdir(parents=True, exist_ok=True)
                payload = {k: v for k, v in data.items() if k != "entries"}
                payload["entries"] = held_entries
                (held_dir / inbox_path.name).write_text(
                    json.dumps(payload, indent=1, ensure_ascii=False) + "\n", encoding="utf-8"
                )
            if not dry_run:
                done_dir = layout.done_dir(wave)
                done_dir.mkdir(parents=True, exist_ok=True)
                target = done_dir / inbox_path.name
                number = 2
                while target.exists():
                    target = done_dir / f"{inbox_path.stem}.{number}{inbox_path.suffix}"
                    number += 1
                shutil.move(str(inbox_path), target)

        summary.confirmed_total = sum(1 for e in entries if e.get("status") == "confirmed")
        summary.unconfirmed_total = len(entries) - summary.confirmed_total
        changed = json.dumps(entries, sort_keys=True, default=str) != before
        if changed and not dry_run:
            doc["updated"] = today
            write_guide(path, doc)
    if warnings_log and not dry_run:
        held_dir = layout.held_dir(wave)
        held_dir.mkdir(parents=True, exist_ok=True)
        (held_dir / "_warnings.json").write_text(
            json.dumps(warnings_log, indent=1, ensure_ascii=False) + "\n", encoding="utf-8"
        )
    return summary


# -- the site build --------------------------------------------------------------------------------


@dataclass
class GuideBuild:
    published: int = 0
    unconfirmed: int = 0
    skipped: int = 0
    blocked: int = 0


def site_ready(entry: dict[str, Any]) -> bool:
    """A last look before an entry reaches the site: the facts the page cannot do without."""
    return bool(
        entry.get("status") == "confirmed"
        and entry.get("venue")
        and entry.get("day") in DAYS
        and any(s.get("url") and s.get("seen") for s in entry.get("sources") or [])
    )


def _prune(value: Any) -> Any:
    if isinstance(value, dict):
        out = {k: _prune(v) for k, v in value.items()}
        return {k: v for k, v in out.items() if v is not None and v != [] and v != {}}
    if isinstance(value, list):
        return [p for p in (_prune(v) for v in value) if p is not None and p != {} and p != []]
    return value


def guide_site_json(
    doc: dict[str, Any], *, built: str, blocked_ids: set[str] | None = None
) -> tuple[dict[str, Any], GuideBuild]:
    """The published form of a guide: the header and the confirmed entries only."""
    blocked_ids = blocked_ids or set()
    result = GuideBuild()
    out_entries: list[dict[str, Any]] = []
    for entry in sort_entries(doc.get("entries") or []):
        if entry.get("status") != "confirmed":
            result.unconfirmed += 1
        elif entry.get("id") in blocked_ids:
            result.blocked += 1
        elif not site_ready(entry):
            result.skipped += 1
        else:
            out_entries.append(_prune(_ordered_entry(entry)))
    result.published = len(out_entries)
    payload = {
        "guide": doc.get("guide"),
        "title": doc.get("title"),
        "updated": doc.get("updated"),
        "built": built,
        "lead_sources": [
            {"name": s.get("name"), "url": s.get("url")}
            for s in doc.get("lead_sources") or []
            if isinstance(s, dict) and s.get("url")
        ],
        "count": len(out_entries),
        "entries": _plain(out_entries),
    }
    return payload, result


def build_guides(layout: Layout, *, today: str) -> dict[str, GuideBuild]:
    """Write site/public/data/guides/<guide>.json for every data/guides/*.yaml."""
    results: dict[str, GuideBuild] = {}
    folder = layout.guides_dir
    files = sorted(folder.glob("*.yaml")) if folder.exists() else []
    if not files:
        return results
    blocked_ids = load_blocklist(layout.blocklist_path).groups
    out_dir = layout.site_guides_dir
    out_dir.mkdir(parents=True, exist_ok=True)
    for path in files:
        doc = read_guide(path)
        name = str(doc.get("guide") or path.stem)
        if name != path.stem or not guide_name_ok(name):
            raise ValueError(f"{path}: the guide field ({name!r}) must match the file name")
        payload, result = guide_site_json(doc, built=today, blocked_ids=blocked_ids)
        (out_dir / f"{name}.json").write_text(
            json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8"
        )
        results[name] = result
    return results

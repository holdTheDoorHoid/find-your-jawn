"""The official 2026 Mummers Parade lineup.

https://philadelphiamummersparade.com/2026-official-parade-lineup/ lists every string band,
wench brigade, fancy club and comic New Year Brigade by division, with comic clubs further
grouped under three "mother clubs". robots.txt for this host disallows only WooCommerce and
admin paths, not this page, so it is allowed.

The page markup is ordinary WordPress/Elementor HTML with some pasted-in artifacts (the last
Comic Division entry carries stray Gmail markup from however the page was edited). Rather than
depend on that markup staying stable, we strip tags to plain text and walk the resulting lines:
a line ending in "Division" starts a new division, a line starting "Mother Club:" starts a new
sub-group inside Comic Division, and in String Band Division each band's name and its theme are
two consecutive lines joined by an en dash and curly quotes in the source.
"""

from __future__ import annotations

import html as html_lib
import re
from typing import Any

from fyj.http import FyjClient
from fyj.leads import make_lead

SOURCE_ID = "mummers"
LINEUP_URL = "https://philadelphiamummersparade.com/2026-official-parade-lineup/"
PARADE_DATE = "2026-01-01"
PARADE_YEAR = "2026"

_TAG_RE = re.compile(r"<(script|style)[^>]*>.*?</\1>", re.S)
_ANY_TAG_RE = re.compile(r"<[^>]+>")
_INTRO_LINE = "2026 Official Parade Lineup"
_END_LINE = "Plan Your Parade Day"
_DASH_SPLIT_RE = re.compile(r"\s*[–—-]\s*[“\"]?\s*$")


def _lines_from_html(raw_html: str) -> list[str]:
    text = _TAG_RE.sub(" ", raw_html)
    text = _ANY_TAG_RE.sub("\n", text)
    lines = [html_lib.unescape(line).strip() for line in text.splitlines()]
    return [line for line in lines if line]


def _slugify(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return slug or "unknown"


def parse_lineup(raw_html: str, *, source_url: str = LINEUP_URL) -> list[dict[str, Any]]:
    lines = _lines_from_html(raw_html)
    intro_positions = [i for i, line in enumerate(lines) if line == _INTRO_LINE]
    if not intro_positions:
        return []
    start = intro_positions[-1] + 1
    end = lines.index(_END_LINE) if _END_LINE in lines else len(lines)
    section = lines[start:end]

    entries: list[tuple[str, str | None, str, str | None]] = []
    division: str | None = None
    mother_club: str | None = None
    i = 0
    while i < len(section):
        line = section[i]
        if line.endswith("Division"):
            division = line
            mother_club = None
            i += 1
            continue
        if division is None:
            i += 1  # intro prose before the first division heading
            continue
        if line.startswith("Mother Club:"):
            mother_club = line.split(":", 1)[1].strip()
            i += 1
            continue
        if division == "String Band Division":
            name = _DASH_SPLIT_RE.sub("", line).strip()
            theme = None
            if i + 1 < len(section):
                theme = section[i + 1].rstrip("”\"").strip()
                i += 1
            entries.append((division, None, name, theme))
        else:
            entries.append((division, mother_club, line, None))
        i += 1

    leads = []
    used_ids: set[str] = set()
    for division_name, mother, name, theme in entries:
        base_id = _slugify(name)
        native_id = base_id
        suffix = 2
        while native_id in used_ids:
            native_id = f"{base_id}-{suffix}"
            suffix += 1
        used_ids.add(native_id)

        tags = [division_name]
        if mother:
            tags.append(f"Mother Club: {mother}")
        extra: dict[str, Any] = {"division": division_name}
        if mother:
            extra["mother_club"] = mother
        if theme:
            extra["2026_theme"] = theme

        leads.append(
            make_lead(
                source=SOURCE_ID,
                source_url=source_url,
                native_id=native_id,
                name=name,
                kind_hint="parade_unit",
                city="Philadelphia",
                tags_hint=tags,
                seen_at=[
                    {
                        "source_url": source_url,
                        "date": PARADE_DATE,
                        "note": f"marched in {PARADE_YEAR} Mummers Parade, {division_name}",
                    }
                ],
                extra=extra,
            )
        )
    return leads


def harvest(client: FyjClient) -> list[dict[str, Any]]:
    resp = client.get_html(LINEUP_URL)
    return parse_lineup(resp.text)

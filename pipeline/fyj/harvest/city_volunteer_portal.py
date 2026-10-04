"""City of Philadelphia Volunteer Portal, a Galaxy Digital site run for the Community Schools
program: https://communityschools.galaxydigital.com

robots.txt allows our user agent (only a long list of named bots and scrapers are disallowed;
`User-agent: *` carries an empty Disallow). Two listing types share the same card markup:

- /agency/ (then /agency/index/12, /agency/index/24, ...): the programs. kind_hint `program`.
- /need/ (then /need/index/12, /need/index/24, ...): individual volunteer opportunities within
  a program. kind_hint `opportunity`.

Each listing page shows 12 cards; we page until a page comes back with none. We then fetch every
detail page (at least 2 seconds apart, per the coordinator's note that this is a small, specific
site worth being extra polite to) for the facts a card does not carry. Note on the image alt
text trap: every icon on this site carries `<title>Get Connected Icon</title>`, which is not a
name; names come from `<div class="title">` on cards and `<h1>` on detail pages.

Gotcha found while scouting this source: the "Begins / Registration Closes / Duration / Open
Spots" shift table on a need's detail page is populated server side for some opportunities but
left for JavaScript to fill in for others (the static HTML table body is simply empty). We parse
whatever shift rows are present and leave `extra.shifts` as an empty list rather than guessing
when they are not; this is a real gap in what a plain HTTP fetch can see here, not a parsing bug.
"""

from __future__ import annotations

import re
from typing import Any

from fyj.htmlutil import info_rows, requirement_texts, section_text, strip_tags
from fyj.http import FyjClient
from fyj.leads import make_lead

SOURCE_ID = "city_volunteer_portal"
BASE_URL = "https://communityschools.galaxydigital.com"
AGENCY_LIST_PATH = "/agency/"
NEED_LIST_PATH = "/need/"
PAGE_STEP = 12
MIN_DELAY = 2.0  # coordinator asked for at least 2 seconds between requests on this source

_CARD_RE = re.compile(
    r'href="[^"]*(?:agency_id|need_id)=(\d+)"[^>]*class="card-body[^"]*"(.*?)</a>', re.S
)
_TITLE_RE = re.compile(r'<div class="title"\s*>(.*?)</div>', re.S)
_H1_RE = re.compile(r"<h1[^>]*>(.*?)</h1>", re.S)
_SHIFT_ROW_RE = re.compile(
    r"<tr>\s*<td>(.*?)</td>\s*<td>(.*?)</td>\s*<td>(.*?)</td>\s*<td>(.*?)</td>", re.S
)
_PROGRAM_SECTION_RE = re.compile(
    r'<h2 class="section-header">\s*Program\s*</h2>.*?agency_id=(\d+)', re.S
)


def list_url(section: str, offset: int) -> str:
    path = AGENCY_LIST_PATH if section == "agency" else NEED_LIST_PATH
    return f"{BASE_URL}{path}" if offset == 0 else f"{BASE_URL}{path}index/{offset}"


def detail_url(section: str, native_id: str) -> str:
    param = "agency_id" if section == "agency" else "need_id"
    return f"{BASE_URL}/{section}/detail/?{param}={native_id}"


def parse_listing_cards(html_text: str) -> list[tuple[str, str | None]]:
    """Returns (native_id, name) pairs from a listing page. Name may be None; the detail page's
    <h1> is the fallback used when writing the lead."""
    cards = []
    for match in _CARD_RE.finditer(html_text):
        native_id = match.group(1)
        title_match = _TITLE_RE.search(match.group(2))
        name = strip_tags(title_match.group(1)) if title_match else None
        cards.append((native_id, name))
    return cards


def parse_agency_detail(html_text: str, *, native_id: str, url: str) -> dict[str, Any]:
    h1_match = _H1_RE.search(html_text)
    name = strip_tags(h1_match.group(1)) if h1_match else None

    parts = []
    pos = 0
    for header in ("Who We Are", "What We Do"):
        text, pos = section_text(html_text, header, start=pos)
        if text:
            parts.append(f"{header}: {text}")
    description = " | ".join(parts) if parts else None

    rows = info_rows(html_text, ("phone", "email", "address", "website"))
    email = rows.get("email")
    # the email row's <td class="text"> holds a mailto link; info_rows already stripped tags,
    # but a stray "mailto:" prefix can remain if the link text itself included it
    if email:
        email = email.replace("mailto:", "").strip()

    return make_lead(
        source=SOURCE_ID,
        source_url=url,
        native_id=native_id,
        name=name or "Unknown program",
        kind_hint="program",
        description=description,
        website=rows.get("website"),
        email=email,
        phone=rows.get("phone"),
        address=rows.get("address"),
        city="Philadelphia",
        tags_hint=["City of Philadelphia Volunteer Portal"],
        extra={"portal": "Community Schools Volunteer Portal"},
    )


def _parse_shifts(html_text: str) -> list[dict[str, str | None]]:
    shifts = []
    tbody_match = re.search(r"<tbody>(.*?)</tbody>", html_text, re.S)
    if not tbody_match:
        return shifts
    for row in _SHIFT_ROW_RE.finditer(tbody_match.group(1)):
        begins, closes, duration, spots = (strip_tags(g) for g in row.groups())
        if begins:
            shifts.append(
                {
                    "begins": begins,
                    "registration_closes": closes,
                    "duration": duration,
                    "open_spots": spots,
                }
            )
    return shifts


def parse_need_detail(html_text: str, *, native_id: str, url: str) -> dict[str, Any]:
    h1_match = _H1_RE.search(html_text)
    name = strip_tags(h1_match.group(1)) if h1_match else None

    description, _ = section_text(html_text, "Description")
    # info_rows (not section_text) for location: section_text would also sweep in the pin icon's
    # SVG <title>Location Dot Shift</title>, which is decoration, not part of the address.
    location_text = info_rows(html_text, ("address",)).get("address")
    requirements = requirement_texts(html_text)
    shifts = _parse_shifts(html_text)

    program_match = _PROGRAM_SECTION_RE.search(html_text)
    agency_id = program_match.group(1) if program_match else None

    return make_lead(
        source=SOURCE_ID,
        source_url=url,
        native_id=native_id,
        name=name or "Unknown opportunity",
        kind_hint="opportunity",
        description=description,
        address=location_text,
        city="Philadelphia",
        tags_hint=["City of Philadelphia Volunteer Portal"],
        extra={
            "agency_id": agency_id,
            "location": location_text,
            "requirements": requirements,
            "shifts": shifts,
            "portal": "Community Schools Volunteer Portal",
        },
    )


def _harvest_section(client: FyjClient, section: str) -> list[dict[str, Any]]:
    cards: list[tuple[str, str | None]] = []
    offset = 0
    while True:
        url = list_url(section, offset)
        resp = client.get_html(url, min_delay=MIN_DELAY)
        page_cards = parse_listing_cards(resp.text)
        if not page_cards:
            break
        cards.extend(page_cards)
        offset += PAGE_STEP

    leads = []
    seen: set[str] = set()
    for native_id, _name in cards:
        if native_id in seen:
            continue
        seen.add(native_id)
        url = detail_url(section, native_id)
        resp = client.get_html(url, min_delay=MIN_DELAY)
        if section == "agency":
            leads.append(parse_agency_detail(resp.text, native_id=native_id, url=url))
        else:
            leads.append(parse_need_detail(resp.text, native_id=native_id, url=url))
    return leads


def harvest(client: FyjClient) -> list[dict[str, Any]]:
    programs = _harvest_section(client, "agency")
    opportunities = _harvest_section(client, "need")
    return programs + opportunities

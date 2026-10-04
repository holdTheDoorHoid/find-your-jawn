"""Philadelphia Cultural Fund grantee directory.

https://philaculturalfund.org/grantee-directory is a public Webflow page, no login, paginated
25 grantees per page via a `?2e1ab49c_page=N` query parameter (confirmed in the scouting pass
and again here). robots.txt (served from www.philaculturalfund.org after a redirect) has no
Disallow rules at all, so this source is allowed.

No JSON API was found, so we parse the server rendered HTML with plain regular expressions
rather than adding a parser dependency the project does not otherwise need. The directory's
markup is Webflow CMS output with `fs-cmsfilter-field="..."` attributes marking each fact,
which makes this more reliable than scraping arbitrary prose would be.
"""

from __future__ import annotations

import html as html_lib
import re
from typing import Any

from fyj.http import FyjClient
from fyj.leads import make_lead

SOURCE_ID = "cultural_fund"
DIRECTORY_URL = "https://philaculturalfund.org/grantee-directory"
PAGE_PARAM = "2e1ab49c_page"
MAX_PAGES = 30  # the scouting pass found about 13 pages at 25/page for ~322 grantees

_BLOCK_SPLIT = 'class="ci-grantees w-dyn-item"'
_DETAIL_RE = re.compile(r'href="(/grantee-directory-main/[^"]+)"')
_SITE_RE = re.compile(
    r'href="(https?://[^"]+)"[^>]*target="_blank"[^>]*class="wrapper-grantee_img'
)
_NAME_RE = re.compile(r'fs-cmsfilter-field="name"[^>]*>([^<]*)</h3>')
_FIELD_RE = re.compile(r'fs-cmsfilter-field="(\w+)"[^>]*>([^<]*)</div>')


def _unescape(raw: str | None) -> str | None:
    if raw is None:
        return None
    return html_lib.unescape(raw).strip() or None


def parse_directory_page(html_text: str, *, page_url: str) -> list[dict[str, Any]]:
    leads = []
    blocks = html_text.split(_BLOCK_SPLIT)[1:]
    for block in blocks:
        detail_match = _DETAIL_RE.search(block)
        if not detail_match:
            continue
        native_id = detail_match.group(1).rsplit("/", 1)[-1]
        name_match = _NAME_RE.search(block)
        name = _unescape(name_match.group(1)) if name_match else None
        site_match = _SITE_RE.search(block)
        website = site_match.group(1) if site_match else None

        fields: dict[str, list[str]] = {}
        for key, value in _FIELD_RE.findall(block):
            clean_value = _unescape(value)
            if not clean_value:
                continue
            fields.setdefault(key, []).append(clean_value)

        disciplines = fields.get("discipline", [])
        grant_programs = fields.get("grantprogram", [])
        districts = fields.get("districts", [])
        years = fields.get("year", [])

        leads.append(
            make_lead(
                source=SOURCE_ID,
                source_url=page_url,
                native_id=native_id,
                name=name or "Unknown grantee",
                kind_hint="grantee",
                website=website,
                city="Philadelphia",
                tags_hint=disciplines,
                extra={
                    "grant_program": grant_programs[0] if grant_programs else None,
                    "council_district": districts[0] if districts else None,
                    "grant_year": years[0] if years else None,
                    "detail_path": detail_match.group(1),
                },
            )
        )
    return leads


def harvest(client: FyjClient) -> list[dict[str, Any]]:
    all_leads: list[dict[str, Any]] = []
    seen_native_ids: set[str] = set()
    for page in range(1, MAX_PAGES + 1):
        url = f"{DIRECTORY_URL}?{PAGE_PARAM}={page}"
        resp = client.get_html(url)
        page_leads = parse_directory_page(resp.text, page_url=url)
        if not page_leads:
            break
        first_id = page_leads[0]["native_id"]
        if first_id in seen_native_ids:
            # the site served the same content again (we ran past the last real page)
            break
        for lead in page_leads:
            if lead["native_id"] not in seen_native_ids:
                seen_native_ids.add(lead["native_id"])
                all_leads.append(lead)
    return all_leads

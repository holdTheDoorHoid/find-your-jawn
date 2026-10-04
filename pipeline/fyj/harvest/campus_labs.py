"""Campus Labs Engage student org directories (Drexel DragonLink, CCP Engage).

Endpoint pattern: https://<subdomain>.campuslabs.com/engage/api/discovery/search/organizations

IMPORTANT: both drexel.campuslabs.com/robots.txt and ccp.campuslabs.com/robots.txt carry
`Disallow: /engage/api/` under `User-agent: *` (checked 2026-10-04). That disallow covers
exactly this endpoint. CLAUDE.md is unconditional on this point: "never get around a ... robots
rule". So this harvester checks robots.txt before every fetch and refuses to proceed if it is
disallowed, raising RobotsBlocked rather than fetching anyway. As of this harvest, both schools
are blocked and were not harvested; see registry/sources.yaml notes and the harvest report.
"""

from __future__ import annotations

import re
from typing import Any

from fyj.http import FyjClient, RobotsBlocked
from fyj.leads import clean_text, make_lead

API_PATH = "/engage/api/discovery/search/organizations"
PAGE_SIZE = 100

_TAG_RE = re.compile(r"<[^>]+>")


def _strip_html(raw: str | None) -> str | None:
    if not raw:
        return None
    text = _TAG_RE.sub(" ", raw)
    text = " ".join(text.split())
    return text or None


def api_url(subdomain: str) -> str:
    return f"https://{subdomain}.campuslabs.com{API_PATH}"


def parse_organizations(
    orgs: list[dict[str, Any]], *, source_id: str, school: str, subdomain: str
) -> list[dict[str, Any]]:
    leads = []
    url = api_url(subdomain)
    for org in orgs:
        native_id = clean_text(str(org.get("Id"))) if org.get("Id") is not None else None
        if not native_id:
            continue
        name = clean_text(org.get("Name")) or "Unknown organization"
        short_name = clean_text(org.get("ShortName"))
        aka = [short_name] if short_name and short_name != name else []
        description = clean_text(org.get("Summary")) or _strip_html(org.get("Description"))
        tags = [t for t in (org.get("CategoryNames") or []) if t]
        website_key = clean_text(org.get("WebsiteKey"))
        extra = {
            "status": org.get("Status"),
            "visibility": org.get("Visibility"),
            "directory_url": (
                f"https://{subdomain}.campuslabs.com/engage/organization/{website_key}"
                if website_key
                else None
            ),
        }
        leads.append(
            make_lead(
                source=source_id,
                source_url=url,
                native_id=native_id,
                name=name,
                aka=aka,
                kind_hint="student_org",
                description=description,
                school=school,
                tags_hint=tags,
                extra=extra,
            )
        )
    return leads


def _fetch_all(client: FyjClient, subdomain: str) -> list[dict[str, Any]]:
    url = api_url(subdomain)
    if not client.robots_allowed(url):
        raise RobotsBlocked(url)
    orgs: list[dict[str, Any]] = []
    skip = 0
    while True:
        data = client.get_json(url, params={"top": PAGE_SIZE, "skip": skip})
        page = data.get("value", [])
        orgs.extend(page)
        total = data.get("@odata.count", len(orgs))
        skip += PAGE_SIZE
        if skip >= total or not page:
            break
    return orgs


def harvest_drexel(client: FyjClient) -> list[dict[str, Any]]:
    orgs = _fetch_all(client, "drexel")
    return parse_organizations(orgs, source_id="engage_drexel", school="drexel", subdomain="drexel")


def harvest_ccp(client: FyjClient) -> list[dict[str, Any]]:
    orgs = _fetch_all(client, "ccp")
    return parse_organizations(orgs, source_id="engage_ccp", school="ccp", subdomain="ccp")

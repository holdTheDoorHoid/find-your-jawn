"""Penn Clubs, a student-built (Penn Labs) directory of University of Pennsylvania student orgs.

https://pennclubs.com/api/clubs/?format=json returns every active club in one unauthenticated
call. There is no published robots.txt (confirmed: the route 404s through the site's own
single page app), so this is treated as an open JSON API like the others.
"""

from __future__ import annotations

from typing import Any

from fyj.http import FyjClient
from fyj.leads import clean_text, make_lead

SOURCE_ID = "penn_clubs"
API_URL = "https://pennclubs.com/api/clubs/?format=json"

EXTRA_KEYS = (
    "accepting_members",
    "active",
    "application_required",
    "appointment_needed",
    "approved",
    "available_virtually",
    "enables_subscription",
    "favorite_count",
    "founded",
    "is_wharton",
    "membership_count",
    "size",
)


def parse_clubs(clubs: list[dict[str, Any]]) -> list[dict[str, Any]]:
    leads = []
    for club in clubs:
        code = clean_text(club.get("code"))
        if not code:
            continue
        tags = [t["name"] for t in club.get("tags") or [] if t.get("name")]
        extra = {key: club.get(key) for key in EXTRA_KEYS}
        extra["directory_url"] = f"https://pennclubs.com/club/{code}"
        leads.append(
            make_lead(
                source=SOURCE_ID,
                source_url=API_URL,
                native_id=code,
                name=clean_text(club.get("name")) or "Unknown club",
                kind_hint="student_org",
                description=clean_text(club.get("subtitle")),
                email=clean_text(club.get("email")),
                address=clean_text(club.get("address")),
                school="penn",
                open_to_public_hint=None,
                tags_hint=tags,
                extra=extra,
            )
        )
    return leads


def harvest(client: FyjClient) -> list[dict[str, Any]]:
    data = client.get_json(API_URL)
    if not isinstance(data, list):
        raise RuntimeError(f"unexpected Penn Clubs payload shape: {type(data)}")
    return parse_clubs(data)

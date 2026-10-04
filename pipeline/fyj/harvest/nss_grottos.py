"""National Speleological Society grottos (caving clubs) in Pennsylvania.

https://caves.org/state/pennsylvania/ lists every NSS-affiliated PA grotto as a simple card
with a name, a mailing address, and a details link. robots.txt only blocks SemrushBot, so our
own user agent is allowed. We keep every PA grotto as a lead (task brief: "Keep all PA grottos
as leads") and flag the Philadelphia-area ones, since the brief's actual target is Philadelphia
Grotto but the page naturally lists the whole state.

Note: the page shows "1 2 Next" pagination controls, but a direct fetch of page 2
(state/pennsylvania/page/2/) returned the same single grotto already present on page 1 rather
than new ones, so this harvester only captures what is reachable from page 1. That is recorded
in registry/sources.yaml and the harvest report as a possible small gap, not a silent assumption
of completeness.
"""

from __future__ import annotations

import html as html_lib
import re
from typing import Any

from fyj.http import FyjClient
from fyj.leads import make_lead

SOURCE_ID = "nss_grottos"
LISTING_URL = "https://caves.org/state/pennsylvania/"

# Counties/towns in the Philadelphia metro area among the PA grotto addresses we see.
PHILADELPHIA_AREA_TOWNS = {"media", "warrington", "philadelphia"}

_CARD_RE = re.compile(
    r'<h[23] class="fl-post-title">(.*?)</h[23]>\s*'
    r'(?:<span class="grotto-address">(.*?)</span>\s*)?'
    r'<div class="fl-post-more-link arrow-link">\s*'
    r"<a href='([^']+)'",
    re.S,
)


def _unescape(raw: str | None) -> str | None:
    if raw is None:
        return None
    text = html_lib.unescape(raw).strip()
    return text or None


def _is_philly_area(address: str | None) -> bool:
    if not address:
        return False
    lowered = address.lower()
    return any(town in lowered for town in PHILADELPHIA_AREA_TOWNS)


def parse_listing(html_text: str, *, source_url: str = LISTING_URL) -> list[dict[str, Any]]:
    leads = []
    for match in _CARD_RE.finditer(html_text):
        name = _unescape(match.group(1))
        address_raw = match.group(2)
        address = _unescape(address_raw.replace("\n", ", ")) if address_raw else None
        detail_url = match.group(3)
        if not name:
            continue
        native_id = detail_url.rstrip("/").rsplit("/", 1)[-1]
        leads.append(
            make_lead(
                source=SOURCE_ID,
                source_url=source_url,
                native_id=native_id,
                name=name,
                kind_hint="club",
                website=detail_url,
                address=address,
                tags_hint=["NSS grotto", "Pennsylvania"],
                extra={"philadelphia_area": _is_philly_area(address)},
            )
        )
    return leads


def harvest(client: FyjClient) -> list[dict[str, Any]]:
    resp = client.get_html(LISTING_URL)
    return parse_listing(resp.text)

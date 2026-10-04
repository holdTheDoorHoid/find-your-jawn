"""IRS Exempt Organizations Business Master File, Pennsylvania extract.

Source: https://www.irs.gov/pub/irs-soi/eo_pa.csv (a genuine PA-only file, not one of the
eo1-eo4.csv national chunks). We keep every row whose ZIP starts with 191 and do not filter
further here; triage into real groups happens in a later step, per the task brief.

The official IRS dataset guide (Publication 5926) documents only status codes 01 (unconditional
exemption), 02 (conditional exemption, no longer issued) and 25 (terminating private foundation
status under 507(b)(1)(B)). Revoked organizations are not included in this extract at all, so a
non-01 status here does not mean "revoked"; see the harvest report for what we actually found.
"""

from __future__ import annotations

import csv
from pathlib import Path
from typing import Any

from fyj.http import FyjClient
from fyj.leads import clean_text, clean_zip, make_lead

SOURCE_URL = "https://www.irs.gov/pub/irs-soi/eo_pa.csv"
SOURCE_ID = "irs_bmf"

# Fields explicitly called out in docs/research/scouting/structured-sources.md and the task
# brief to keep verbatim in `extra`.
EXTRA_FIELDS = (
    "FOUNDATION",
    "RULING",
    "ASSET_AMT",
    "INCOME_AMT",
    "REVENUE_AMT",
    "FILING_REQ_CD",
    "CLASSIFICATION",
    "AFFILIATION",
    "SORT_NAME",
)

CHURCH_FOUNDATION_CODE = "10"  # Church, 170(b)(1)(A)(i)


def _contact_name(ico: str | None) -> str | None:
    text = clean_text(ico)
    if not text:
        return None
    return text.lstrip("%").strip() or None


def _kind_hint(ntee: str | None, foundation: str | None) -> str:
    if ntee and ntee.upper().startswith("X2"):
        return "congregation"
    if foundation and foundation.strip() == CHURCH_FOUNDATION_CODE:
        return "congregation"
    return "nonprofit"


def parse_rows(rows: list[dict[str, str]]) -> list[dict[str, Any]]:
    leads = []
    for row in rows:
        zip5 = clean_zip(row.get("ZIP"))
        if not zip5 or not zip5.startswith("191"):
            continue
        ein = clean_text(row.get("EIN"))
        if not ein:
            continue
        ntee = clean_text(row.get("NTEE_CD"))
        foundation = row.get("FOUNDATION")
        extra = {field.lower(): row.get(field) for field in EXTRA_FIELDS}
        leads.append(
            make_lead(
                source=SOURCE_ID,
                source_url=SOURCE_URL,
                native_id=ein,
                name=clean_text(row.get("NAME")) or "Unknown organization",
                kind_hint=_kind_hint(ntee, foundation),
                contact_name=_contact_name(row.get("ICO")),
                address=clean_text(row.get("STREET")),
                city=clean_text(row.get("CITY")),
                zip=zip5,
                ein=ein,
                ntee=ntee,
                irs_subsection=clean_text(row.get("SUBSECTION")),
                irs_status=clean_text(row.get("STATUS")),
                extra=extra,
            )
        )
    return leads


def harvest(client: FyjClient) -> list[dict[str, Any]]:
    path: Path = client.download_to_cache(SOURCE_URL, "irs_bmf/eo_pa.csv")
    with open(path, encoding="latin-1", newline="") as f:
        reader = csv.DictReader(f)
        rows = list(reader)
    return parse_rows(rows)

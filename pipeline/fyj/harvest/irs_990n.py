"""IRS Form 990-N e-Postcard bulk file, mirrored by the Urban Institute's NCCS.

The IRS's own bulk download page blocks automated fetches (Akamai bot protection, confirmed
in the scouting pass), so we use the NCCS mirror at
nccsdata.s3.us-east-1.amazonaws.com/raw/e-postcard/<YYYY>-<MM>-E-POSTCARD.csv, updated monthly.
This is the only source that reaches organizations too small to ever file a real Form 990
(under $50,000 in gross receipts), which is exactly the long tail this project wants.

The file covers the whole country (roughly 370 MB), so we download it once to the shared
cache and stream-filter rather than loading it into memory.
"""

from __future__ import annotations

import csv
import datetime as _dt
import shutil
from collections.abc import Iterable
from pathlib import Path
from typing import Any

from fyj.http import FyjClient
from fyj.leads import clean_text, clean_zip, make_lead

SOURCE_ID = "irs_990n"
MIRROR_URL_TEMPLATE = (
    "https://nccsdata.s3.us-east-1.amazonaws.com/raw/e-postcard/{year:04d}-{month:02d}-E-POSTCARD.csv"
)
MIN_FREE_BYTES = 10 * 1024 * 1024 * 1024  # 10 GB, per CLAUDE.md


def check_disk_space(path: str = "/") -> None:
    """Mirrors `df -h /`: refuse to start a large download with less than 10 GB free."""
    free = shutil.disk_usage(path).free
    if free < MIN_FREE_BYTES:
        raise RuntimeError(
            f"only {free / (1024**3):.1f} GB free on {path}, need at least 10 GB before "
            "downloading the 990-N bulk file"
        )


def _prev_month(year: int, month: int) -> tuple[int, int]:
    if month == 1:
        return year - 1, 12
    return year, month - 1


def find_latest_month(
    client: FyjClient, *, start: _dt.date | None = None, lookback_months: int = 8
) -> tuple[int, int, str]:
    """HEAD-probe recent months, newest first, and return the first one that exists."""
    year, month = (start or _dt.date.today()).timetuple()[:2]
    for _ in range(lookback_months):
        url = MIRROR_URL_TEMPLATE.format(year=year, month=month)
        if client.head_ok(url):
            return year, month, url
        year, month = _prev_month(year, month)
    raise RuntimeError(f"no e-postcard file found in the last {lookback_months} months")


def _aka_names(row: dict[str, str]) -> list[str]:
    names = []
    for field in ("dba_name_1", "dba_name_2", "dba_name_3"):
        value = clean_text(row.get(field))
        if value:
            names.append(value)
    return names


def _organization_address(row: dict[str, str]) -> str | None:
    line1 = clean_text(row.get("organization_address_line_1"))
    line2 = clean_text(row.get("organization_address_line_2"))
    parts = [p for p in (line1, line2) if p]
    return ", ".join(parts) if parts else None


def _matches_philadelphia(row: dict[str, str]) -> bool:
    zip5 = clean_zip(row.get("organization_zip"))
    if not zip5 or not zip5.startswith("191"):
        return False
    state = (row.get("organization_state") or "").strip().upper()
    city = (row.get("organization_city") or "").strip().upper()
    return state == "PA" or city == "PHILADELPHIA"


def parse_rows(
    rows: Iterable[dict[str, str]], *, source_url: str = MIRROR_URL_TEMPLATE
) -> list[dict[str, Any]]:
    """Filter to Philadelphia, keep only the latest tax_year per EIN, and build leads."""
    latest_by_ein: dict[str, dict[str, str]] = {}
    for row in rows:
        if not _matches_philadelphia(row):
            continue
        ein = clean_text(row.get("ein"))
        if not ein:
            continue
        tax_year = row.get("tax_year") or "0"
        existing = latest_by_ein.get(ein)
        if existing is None or tax_year > (existing.get("tax_year") or "0"):
            latest_by_ein[ein] = row

    leads = []
    for ein, row in latest_by_ein.items():
        leads.append(
            make_lead(
                source=SOURCE_ID,
                source_url=source_url,
                native_id=ein,
                name=clean_text(row.get("legal_name")) or "Unknown organization",
                aka=_aka_names(row),
                kind_hint="nonprofit",
                website=clean_text(row.get("website")),
                contact_name=clean_text(row.get("officer_name")),
                address=_organization_address(row),
                city=clean_text(row.get("organization_city")),
                zip=clean_zip(row.get("organization_zip")),
                ein=ein,
                extra={
                    "tax_year": row.get("tax_year"),
                    "terminated": row.get("terminated"),
                    "gross_receipts_under_25000": row.get("gross_receipts_under_25000"),
                },
            )
        )
    return leads


def harvest(client: FyjClient) -> list[dict[str, Any]]:
    check_disk_space()
    year, month, url = find_latest_month(client)
    cache_key = f"irs_990n/{year:04d}-{month:02d}-E-POSTCARD.csv"
    path: Path = client.download_to_cache(url, cache_key)
    with open(path, encoding="utf-8", errors="replace", newline="") as f:
        reader = csv.DictReader(f)
        return parse_rows(reader, source_url=url)

"""Forgiving date parsing for research records and for dates found on web pages."""

from __future__ import annotations

import datetime as _dt
import re

MONTHS = {
    "january": 1,
    "jan": 1,
    "february": 2,
    "feb": 2,
    "march": 3,
    "mar": 3,
    "april": 4,
    "apr": 4,
    "may": 5,
    "june": 6,
    "jun": 6,
    "july": 7,
    "jul": 7,
    "august": 8,
    "aug": 8,
    "september": 9,
    "sept": 9,
    "sep": 9,
    "october": 10,
    "oct": 10,
    "november": 11,
    "nov": 11,
    "december": 12,
    "dec": 12,
}
_MONTH_NAMES = "|".join(sorted(MONTHS, key=len, reverse=True))

_ISO_FULL = re.compile(r"(?<!\d)(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?!\d)")
_ISO_MONTH = re.compile(r"^\s*(\d{4})[-/](\d{1,2})\s*$")
_US_FULL = re.compile(r"\b(\d{1,2})/(\d{1,2})/(\d{4})\b")
_US_MONTH_YEAR = re.compile(r"^\s*(\d{1,2})/(\d{4})\s*$")
_NAME_DAY_YEAR = re.compile(
    rf"\b({_MONTH_NAMES})\.?\s+(\d{{1,2}})(?:st|nd|rd|th)?,?\s+(\d{{4}})\b", re.I
)
_DAY_NAME_YEAR = re.compile(
    rf"\b(\d{{1,2}})(?:st|nd|rd|th)?\s+({_MONTH_NAMES})\.?,?\s+(\d{{4}})\b", re.I
)
_NAME_YEAR = re.compile(rf"\b({_MONTH_NAMES})\.?,?\s+(\d{{4}})\b", re.I)


def _valid(year: int, month: int, day: int | None) -> tuple[int, int, int | None] | None:
    if not (1990 <= year <= 2100 and 1 <= month <= 12):
        return None
    if day is not None:
        try:
            _dt.date(year, month, day)
        except ValueError:
            return None
    return year, month, day


def parse_loose(text: str | None) -> tuple[int, int, int | None] | None:
    """(year, month, day or None) from '2026-09-12', '2026-09', 'September 2026', '9/12/2026'..."""
    if not text:
        return None
    raw = str(text).strip()
    if m := _ISO_FULL.search(raw):
        return _valid(int(m.group(1)), int(m.group(2)), int(m.group(3)))
    if m := _ISO_MONTH.match(raw):
        return _valid(int(m.group(1)), int(m.group(2)), None)
    if m := _US_FULL.search(raw):
        return _valid(int(m.group(3)), int(m.group(1)), int(m.group(2)))
    if m := _US_MONTH_YEAR.match(raw):
        return _valid(int(m.group(2)), int(m.group(1)), None)
    if m := _NAME_DAY_YEAR.search(raw):
        return _valid(int(m.group(3)), MONTHS[m.group(1).lower()], int(m.group(2)))
    if m := _DAY_NAME_YEAR.search(raw):
        return _valid(int(m.group(3)), MONTHS[m.group(2).lower()], int(m.group(1)))
    if m := _NAME_YEAR.search(raw):
        return _valid(int(m.group(2)), MONTHS[m.group(1).lower()], None)
    return None


def to_month(text: str | None) -> str | None:
    parsed = parse_loose(text)
    return f"{parsed[0]:04d}-{parsed[1]:02d}" if parsed else None


def to_month_or_year(text: str | None) -> str | None:
    """YYYY-MM from any date, or YYYY when only a year is written (a sign of life dated '2026')."""
    if text is not None and re.fullmatch(r"\s*\d{4}\s*", str(text)):
        year = int(str(text).strip())
        return f"{year:04d}" if 1990 <= year <= 2100 else None
    return to_month(text)


def to_full_date(text: str | None) -> str | None:
    """YYYY-MM-DD, or None when the text has no day."""
    parsed = parse_loose(text)
    if not parsed or parsed[2] is None:
        return None
    return f"{parsed[0]:04d}-{parsed[1]:02d}-{parsed[2]:02d}"


def find_dates(text: str) -> list[tuple[int, int, int | None]]:
    """Every date written out in a block of page text (day precision where given)."""
    found: list[tuple[int, int, int | None]] = []
    spans: list[tuple[int, int]] = []

    def take(match: re.Match[str], value: tuple[int, int, int | None] | None) -> None:
        if value:
            found.append(value)
            spans.append(match.span())

    for m in _ISO_FULL.finditer(text):
        take(m, _valid(int(m.group(1)), int(m.group(2)), int(m.group(3))))
    for m in _US_FULL.finditer(text):
        take(m, _valid(int(m.group(3)), int(m.group(1)), int(m.group(2))))
    for m in _NAME_DAY_YEAR.finditer(text):
        take(m, _valid(int(m.group(3)), MONTHS[m.group(1).lower()], int(m.group(2))))
    for m in _DAY_NAME_YEAR.finditer(text):
        take(m, _valid(int(m.group(3)), MONTHS[m.group(2).lower()], int(m.group(1))))
    for m in _NAME_YEAR.finditer(text):
        if any(s <= m.start() < e for s, e in spans):
            continue
        take(m, _valid(int(m.group(2)), MONTHS[m.group(1).lower()], None))
    return found


def month_diff(a: str, b: str) -> int:
    """Whole months from `a` to `b`, each YYYY-MM or YYYY (a bare year counts as January, so a
    year only date never looks newer than it is). Positive when b is later."""
    ay, am = int(a[:4]), int(a[5:7]) if len(a) >= 7 else 1
    by, bm = int(b[:4]), int(b[5:7]) if len(b) >= 7 else 1
    return (by - ay) * 12 + (bm - am)


def status_for_age(months: int) -> str:
    """The status the evidence alone supports (DATA_MODEL status rules)."""
    if months <= 12:
        return "active"
    return "probably_active" if months <= 24 else "dormant"

"""Out of scope triage for leads (RESEARCH.md section 1; owner scope decisions in ETHICS.md).

A rejected lead gets one line in data/triage.jsonl and no group file. The rules are conservative:
when a lead might be a joinable group it is kept as a tier 0 group and research decides later.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

from fyj.checks import Blocklist, partisan_reason
from fyj.textutil import website_domain

# IRS foundation codes (BMF FOUNDATION field): private foundations.
PRIVATE_FOUNDATION_CODES = {
    "02": "private operating foundation",
    "03": "private operating foundation",
    "04": "private non-operating foundation",
}

# IRS subsection codes (the 501(c) number) that are never a group a person can join.
NEVER_JOINABLE_SUBSECTIONS = {
    "01": "corporation organized by Congress, such as a federal credit union",
    "02": "title holding corporation",
    "09": "employee benefit association",
    "11": "teachers retirement fund",
    "12": "benevolent life insurance or mutual utility association",
    "13": "cemetery company",
    "14": "credit union",
    "15": "mutual insurance company",
    "16": "crop financing corporation",
    "17": "supplemental unemployment benefit trust",
    "18": "employee funded pension trust",
    "20": "legal services plan",
    "21": "black lung benefit trust",
    "22": "withdrawal liability payment fund",
    "24": "ERISA benefit trust",
    "25": "title holding corporation",
    "26": "state high risk health insurance pool",
    "27": "state workers compensation reinsurance pool",
    "29": "health insurance cooperative",
}

_I = re.I
_CONDO = re.compile(
    r"\bcondominiums?\b|\bcondo\b.*\b(association|assoc|assn|owners?|council|unit)\b"
    r"|\b(association|assoc|assn)\b.*\bcondo\b",
    _I,
)
_HOMEOWNERS = re.compile(
    r"\bhome\s?owners?'?s?\b.*\b(association|assoc|assn|corp|inc|council)\b"
    r"|\b(home|condo|unit|townhouse|town\s?house)\s?owners?\b",
    _I,
)
_CEMETERY = re.compile(r"\bcemeter(y|ies)\b|\bcemetary\b|\bburial\b|\bmemorial park\b", _I)
_CEMETERY_FRIENDS = re.compile(
    r"\bfriends of\b|\bhistoric\b|\bpreservation\b|\bconservancy\b|\bsociety\b|\brestoration\b", _I
)
_SCHOLARSHIP = re.compile(
    r"\bscholarship\s+(fund|foundation|trust|tr|inc|corp|association|committee)\b", _I
)
_TRUST = re.compile(
    r"\b(charitable|family|memorial|testamentary|living|revocable|irrevocable|residuary|"
    r"endowment|welfare|pension|retirement|annuity|remainder|educational|scholarship)\s+"
    r"(trust|tr)\b|\btrust\s+(fund|agreement)\b|\b(trust|tr)\b.*\b(fbo|f/b/o|u/a|u/w|uw|ua)\b",
    _I,
)
_PAC = re.compile(r"\bPAC\b")
_PAC_LONG = re.compile(r"\bpolitical action committee\b", _I)
_CHURCH_WORDS = re.compile(
    r"church|parish|congregation|temple|synagogue|mosque|chapel|baptist|methodist|"
    r"presbyterian|lutheran|episcopal|catholic|ministr",
    _I,
)
_BUILDING_CORP = re.compile(
    r"\b(building|bldg|property|properties|holding|holdings|realty|real estate|rectory)\s+"
    r"(corp|corporation|company|co|association|inc)\b",
    _I,
)
_TRUSTY_NAME = re.compile(r"\b(trust|fund|foundation|endowment|tr|tw)\b", _I)
_REC_CENTER = re.compile(
    r"\b(recreation|rec)\s+(center|ctr)\b|\byouth center\b|\bcultural center\b|\blloyd hall\b", _I
)
_NOT_A_CENTER = re.compile(r"playground|pumptrack|playlot|\bpool\b", _I)


def is_rec_center(lead: dict[str, Any]) -> bool:
    """True for a real recreation center in the City's Parks and Recreation inventory."""
    name = lead.get("name") or ""
    tagged = "Recreation Center" in (lead.get("tags_hint") or [])
    if _NOT_A_CENTER.search(name) and not _REC_CENTER.search(name):
        return False
    return tagged or bool(_REC_CENTER.search(name))


@dataclass
class TriageContext:
    blocklist: Blocklist = field(default_factory=Blocklist)
    bmf_eins: set[str] = field(default_factory=set)  # EINs present in the IRS master file


def _foundation(lead: dict[str, Any]) -> str | None:
    value = (lead.get("extra") or {}).get("foundation")
    return str(value).strip() if value not in (None, "") else None


def decide(lead: dict[str, Any], ctx: TriageContext) -> tuple[str, str] | None:
    """(reason code, plain detail) when the lead should not become a group, else None."""
    name = lead.get("name") or ""
    source = lead.get("source") or ""
    extra = lead.get("extra") or {}
    ein = lead.get("ein")
    irs = source in ("irs_bmf", "irs_990n")
    subsection = (lead.get("irs_subsection") or "").strip()

    if lead["lead_id"] in ctx.blocklist.leads:
        return "blocklist", "on the removal list"
    if ein and str(ein) in ctx.blocklist.eins:
        return "blocklist", "EIN is on the removal list"
    domain = website_domain(lead.get("website"))
    if domain and domain in ctx.blocklist.domains:
        return "blocklist", "website is on the removal list"

    # partisan groups
    if str(extra.get("org_type") or "").strip() == "Ward":
        return "partisan", "a party ward committee that is also a registered community organization"
    label = partisan_reason(name, *(lead.get("aka") or []))
    pac_in_a_charity = irs and label == "PAC" and (subsection == "03" or ein in ctx.bmf_eins)
    if label and not pac_in_a_charity:
        return "partisan", f"the name looks partisan ({label})"

    kind = lead.get("kind_hint")
    if kind == "opportunity":
        return "not_a_group", "a single volunteer shift, kept inside its program instead"
    if source == "city_rec" and not is_rec_center(lead):
        return "not_a_group", "a park, playground, pool or other site, not a group"

    if not irs:
        return None

    foundation = _foundation(lead)
    if foundation in PRIVATE_FOUNDATION_CODES:
        kind_of = PRIVATE_FOUNDATION_CODES[foundation]
        return "private_foundation", f"IRS foundation code {foundation}, a {kind_of}"
    if subsection in NEVER_JOINABLE_SUBSECTIONS:
        # subsection 13 is sometimes miscoded on ordinary associations, so it also needs the name
        miscoded = subsection == "13" and not (
            _CEMETERY.search(name) or re.search(r"company|corp", name, _I)
        )
        if not miscoded:
            detail = NEVER_JOINABLE_SUBSECTIONS[subsection]
            return "never_joinable", f"IRS subsection {subsection}: {detail}"
    if subsection in ("91", "92") and _TRUSTY_NAME.search(name):
        return "trust", "a charitable trust or fund under IRC 4947, not a group"
    if _CONDO.search(name):
        return "condo_association", "a condominium association"
    if _HOMEOWNERS.search(name):
        return "homeowners_association", "a homeowners or unit owners association"
    if _CEMETERY.search(name) and not _CEMETERY_FRIENDS.search(name):
        return "cemetery", "a cemetery association or company"
    if _SCHOLARSHIP.search(name):
        return "scholarship_fund", "a scholarship fund"
    if _TRUST.search(name):
        return "trust", "a trust or fund, not a group"
    if (_PAC.search(name) and subsection != "03" and ein not in ctx.bmf_eins) or (
        _PAC_LONG.search(name)
    ):
        return "partisan", "a political action committee"
    if _CHURCH_WORDS.search(name) and _BUILDING_CORP.search(name):
        return "church_building_corporation", "a church building or property corporation"
    if (
        source == "irs_990n"
        and str(extra.get("terminated") or "").upper() == "T"
        and ein not in ctx.bmf_eins
    ):
        return "terminated", "the organization told the IRS it terminated"
    return None

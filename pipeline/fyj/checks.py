"""The automatic publish checks (DATA_MODEL section 7) and the `fyj check` report.

A group that fails is held back from the site, not deleted. The checks run on groups that are
visible (not hidden) and at research tier 1 or higher; tier 0 groups are not published, so they
are only counted.
"""

from __future__ import annotations

import datetime as _dt
import hashlib
import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml

from fyj.groupfile import GroupStore
from fyj.paths import Layout, cache_dir
from fyj.schema import Problem, our_texts, validate_schema, validate_sources
from fyj.textutil import (
    has_dash_punctuation,
    ngram_set,
    shared_run,
    website_domain,
    words,
)
from fyj.vocab import Vocab

OWN_WORDS_RUN = 8

BLOCKLIST_HEADER = """\
# Removal list (docs/ETHICS.md and docs/DATA_MODEL.md section 7 item 7).
#
# Anything listed here is never published and never brought back by a harvest or by the merge
# step. Add an entry when a group or a person asks to be removed (through the GitHub issue form)
# or when a field must be suppressed everywhere. Every list may stay empty.
#
#   groups:  group ids (the file name without .yaml). The group is held back from the site.
#   leads:   lead ids (for example irs_bmf:123456789). `fyj merge` will not turn them into groups.
#   eins:    nine digit EINs. Any group or lead with this EIN is treated as listed.
#   domains: website domains without www (example.org). Same effect as eins.
#   fields:  values to remove from published output, for example
#              - {group: some-group-id, field: contacts.phone, value: "215-555-0100",
#                 reason: removal_request}
#            Use group: "*" to suppress a value (a personal email, say) on every group.
groups: []
leads: []
eins: []
domains: []
fields: []
"""

# Wording that marks a partisan group (section 7 item 5). Compared against the name and aka.
_PARTISAN = (
    (
        "ward committee",
        re.compile(
            r"\bward\b.*\b(committee|democratic|republican|party|executive)\b"
            r"|\b(democratic|republican)\b.*\bward\b",
            re.I,
        ),
    ),
    ("Democratic or Republican group", re.compile(r"\b(democrat(ic)?|republican)s?\b", re.I)),
    (
        "campaign",
        re.compile(
            r"\bcampaign\s+(committee|fund|account)\b|\b(re-?elect|committee to elect)\b", re.I
        ),
    ),
    (
        "candidate",
        re.compile(
            r"\bfor\s+(mayor|city council|council|congress|senate|governor|judge|sheriff|"
            r"controller|district attorney|state representative|state senate|"
            r"city commissioner)\b",
            re.I,
        ),
    ),
    ("political action committee", re.compile(r"\bpolitical action committee\b", re.I)),
    ("PAC", re.compile(r"\bPAC\b")),
)


def partisan_reason(*names: str) -> str | None:
    for name in names:
        for label, pattern in _PARTISAN:
            if pattern.search(name or ""):
                return label
    return None


# -- blocklist -----------------------------------------------------------------------------------


@dataclass
class Blocklist:
    groups: set[str] = field(default_factory=set)
    leads: set[str] = field(default_factory=set)
    eins: set[str] = field(default_factory=set)
    domains: set[str] = field(default_factory=set)
    fields: list[dict[str, Any]] = field(default_factory=list)

    def blocks_group(self, group: dict[str, Any]) -> str | None:
        if group.get("id") in self.groups:
            return "group id is on the removal list"
        if group.get("ein") and str(group["ein"]) in self.eins:
            return "EIN is on the removal list"
        domain = website_domain((group.get("contacts") or {}).get("website"))
        if domain and domain in self.domains:
            return "website domain is on the removal list"
        return None


def load_blocklist(path: Path) -> Blocklist:
    if not path.exists():
        return Blocklist()
    with open(path, encoding="utf-8") as handle:
        data = yaml.safe_load(handle) or {}
    return Blocklist(
        groups={str(x) for x in data.get("groups") or []},
        leads={str(x) for x in data.get("leads") or []},
        eins={str(x) for x in data.get("eins") or []},
        domains={str(x).lower().removeprefix("www.") for x in data.get("domains") or []},
        fields=[f for f in data.get("fields") or [] if isinstance(f, dict)],
    )


def write_blocklist_if_missing(path: Path) -> bool:
    if path.exists():
        return False
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(BLOCKLIST_HEADER, encoding="utf-8")
    return True


# -- lead and page texts -----------------------------------------------------------------------


class LeadTexts:
    """Lead descriptions by lead id, loaded once and only when a check needs them."""

    def __init__(self, leads_dir: Path) -> None:
        self.leads_dir = leads_dir
        self._loaded: dict[str, str] | None = None

    def _load(self) -> dict[str, str]:
        if self._loaded is None:
            loaded: dict[str, str] = {}
            for path in sorted(self.leads_dir.glob("*.jsonl")) if self.leads_dir.exists() else []:
                with open(path, encoding="utf-8") as handle:
                    for line in handle:
                        if '"description": null' in line:
                            continue
                        lead = json.loads(line)
                        description = lead.get("description")
                        if isinstance(description, str) and description.strip():
                            loaded[lead["lead_id"]] = description
            self._loaded = loaded
        return self._loaded

    def description(self, lead_id: str) -> str | None:
        return self._load().get(lead_id)


def page_cache_path(pages_dir: Path, url: str) -> Path:
    """Where the plain text of a fetched page is cached: <sha1 of the URL>.txt."""
    return pages_dir / f"{hashlib.sha1(url.encode('utf-8')).hexdigest()}.txt"


def default_pages_dir() -> Path:
    return cache_dir() / "pages"


@dataclass
class CheckContext:
    vocab: Vocab
    blocklist: Blocklist
    lead_texts: LeadTexts
    pages_dir: Path | None = None

    @classmethod
    def for_layout(
        cls, layout: Layout, vocab: Vocab, pages_dir: Path | None = None
    ) -> CheckContext:
        return cls(
            vocab=vocab,
            blocklist=load_blocklist(layout.blocklist_path),
            lead_texts=LeadTexts(layout.leads_dir),
            pages_dir=pages_dir if pages_dir is not None else default_pages_dir(),
        )


# -- the checks ----------------------------------------------------------------------------------


def _source_ngrams(group: dict[str, Any], ctx: CheckContext) -> set[tuple[str, ...]]:
    grams: set[tuple[str, ...]] = set()
    for lead_id in group.get("leads") or []:
        description = ctx.lead_texts.description(lead_id)
        if description:
            grams |= ngram_set(words(description), OWN_WORDS_RUN)
    if ctx.pages_dir is not None and ctx.pages_dir.exists():
        urls = [s.get("url") for s in group.get("sources") or [] if isinstance(s, dict)]
        urls.append((group.get("contacts") or {}).get("website"))
        urls.append(group.get("sign_of_life_url"))
        for url in {u for u in urls if isinstance(u, str) and u}:
            path = page_cache_path(ctx.pages_dir, url)
            if path.exists():
                grams |= ngram_set(
                    words(path.read_text(encoding="utf-8", errors="replace")), OWN_WORDS_RUN
                )
    return grams


def check_own_words(group: dict[str, Any], ctx: CheckContext) -> list[Problem]:
    grams = _source_ngrams(group, ctx)
    if not grams:
        return []
    problems: list[Problem] = []
    for label, text in our_texts(group):
        run = shared_run(text, grams, OWN_WORDS_RUN)
        if run:
            problems.append(
                (
                    "own_words",
                    f"{label} shares {OWN_WORDS_RUN} words in a row with a source: “{run}”",
                )
            )
    return problems


def check_dashes(group: dict[str, Any]) -> list[Problem]:
    return [
        ("dashes", f"{label} uses a dash as punctuation")
        for label, text in our_texts(group)
        if has_dash_punctuation(text)
    ]


def check_scope(group: dict[str, Any]) -> list[Problem]:
    problems: list[Problem] = []
    if (group.get("audience") or {}).get("partisan"):
        problems.append(("scope", "audience.partisan is true"))
    names = [group.get("name") or ""] + list(group.get("aka") or [])
    reason = partisan_reason(*names)
    if reason:
        problems.append(("scope", f"the name looks partisan ({reason})"))
    return problems


def check_claims(group: dict[str, Any]) -> list[Problem]:
    problems: list[Problem] = []
    requirements = group.get("requirements") or {}
    sourced = {
        str(f).removeprefix("requirements.")
        for src in group.get("sources") or []
        if isinstance(src, dict)
        for f in src.get("fields") or []
    }
    for claim in ("court_ordered_ok", "service_hours_letter"):
        if requirements.get(claim) == "yes" and claim not in sourced:
            problems.append(
                ("claims", f"requirements.{claim} is yes but no source lists that field")
            )
    return problems


def check_blocklist(group: dict[str, Any], ctx: CheckContext) -> list[Problem]:
    reason = ctx.blocklist.blocks_group(group)
    return [("blocklist", reason)] if reason else []


def check_group(group: dict[str, Any], ctx: CheckContext) -> list[Problem]:
    """All seven checks for one group. Hidden and tier 0 groups are not checked here."""
    problems: list[Problem] = []
    problems += validate_schema(group, ctx.vocab)
    problems += validate_sources(group)
    problems += check_own_words(group, ctx)
    problems += check_dashes(group)
    problems += check_scope(group)
    problems += check_claims(group)
    problems += check_blocklist(group, ctx)
    return problems


def is_checkable(group: dict[str, Any]) -> bool:
    return not group.get("hidden") and (group.get("research_tier") or 0) >= 1


# -- the report ----------------------------------------------------------------------------------


@dataclass
class CheckReport:
    checked_at: str
    counts: dict[str, int]
    passed: list[str]
    held: list[dict[str, Any]]
    warnings: list[str]

    def to_json(self) -> dict[str, Any]:
        return {
            "checked_at": self.checked_at,
            "counts": self.counts,
            "warnings": self.warnings,
            "held": self.held,
            "passed": self.passed,
        }


def run_checks(layout: Layout, vocab: Vocab, *, pages_dir: Path | None = None) -> CheckReport:
    store = GroupStore(layout.groups_dir)
    ctx = CheckContext.for_layout(layout, vocab, pages_dir)
    counts = {"groups": 0, "hidden": 0, "tier0": 0, "checked": 0, "passed": 0, "held": 0}
    passed: list[str] = []
    held: list[dict[str, Any]] = []
    for group in store.iter_groups():
        counts["groups"] += 1
        if group.get("hidden"):
            counts["hidden"] += 1
            continue
        if (group.get("research_tier") or 0) < 1:
            counts["tier0"] += 1
            continue
        counts["checked"] += 1
        problems = check_group(group, ctx)
        if problems:
            counts["held"] += 1
            held.append(
                {
                    "id": group["id"],
                    "name": group.get("name"),
                    "tier": group.get("research_tier"),
                    "problems": [{"check": c, "detail": d} for c, d in problems],
                }
            )
        else:
            counts["passed"] += 1
            passed.append(group["id"])
    warnings: list[str] = []
    if not vocab.families:
        warnings.append("data/vocab/interests.yaml was not found; interest values were not checked")
    for name in ("formats", "audiences"):
        if name not in vocab.raw:
            warnings.append(f"data/vocab/{name}.yaml was not found; those values were not checked")
    now = _dt.datetime.now(_dt.UTC).replace(microsecond=0)
    return CheckReport(now.isoformat().replace("+00:00", "Z"), counts, passed, held, warnings)


def write_report(layout: Layout, report: CheckReport) -> Path:
    layout.checks_dir.mkdir(parents=True, exist_ok=True)
    path = layout.checks_dir / "latest.json"
    path.write_text(
        json.dumps(report.to_json(), indent=1, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    return path


def format_report(report: CheckReport) -> str:
    c = report.counts
    lines = [
        f"Checked {c['groups']} groups: {c['hidden']} hidden, {c['tier0']} at tier 0 "
        f"(not published, not checked), {c['checked']} at tier 1 or higher.",
        f"  passed: {c['passed']}",
        f"  held back: {c['held']}",
    ]
    reasons: dict[str, int] = {}
    for entry in report.held:
        for problem in entry["problems"]:
            reasons[problem["check"]] = reasons.get(problem["check"], 0) + 1
    for check, count in sorted(reasons.items(), key=lambda kv: (-kv[1], kv[0])):
        lines.append(f"    {check}: {count}")
    for entry in report.held[:10]:
        first = entry["problems"][0]
        lines.append(f"  - {entry['id']}: {first['detail']}")
    if len(report.held) > 10:
        lines.append(f"  ... and {len(report.held) - 10} more, see research/checks/latest.json")
    for warning in report.warnings:
        lines.append(f"  note: {warning}")
    return "\n".join(lines)

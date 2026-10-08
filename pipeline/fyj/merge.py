"""`fyj merge`: turn leads into tier 0 groups (triage first, then dedupe across sources).

Leads that describe the same real group (same EIN, same website domain, or the same normalized
name in the same ZIP) become one group whose `leads:` lists all of them. Leads that cannot be a
joinable group are written to data/triage.jsonl and get no group file. The step is idempotent: a
lead already listed by a group is left alone, and an existing group is only ever added to (empty
fields filled, lists extended), never overwritten, so research already in a file survives.
"""

from __future__ import annotations

import json
import re
from collections import Counter, defaultdict
from collections.abc import Callable, Iterator
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from fyj.checks import load_blocklist, write_blocklist_if_missing
from fyj.groupfile import MAILING_LABELS, GroupStore, blank_group, blank_location
from fyj.groupindex import GroupIndex
from fyj.paths import Layout
from fyj.textutil import (
    is_shared_domain,
    names_related,
    normalize_name,
    significant_tokens,
    smart_title,
    website_domain,
)
from fyj.triage import TriageContext, decide

# Which source's wording to prefer when leads disagree (earlier is better).
SOURCE_PRIORITY = [
    "manual_seeds",
    "city_programs",
    "city_volunteer_portal",
    "city_volunteer_pages",
    "nss_grottos",
    "mummers",
    "cultural_fund",
    "penn_clubs",
    "engage_drexel",
    "engage_ccp",
    "city_rco",
    "city_nac",
    "city_gardens",
    "city_friends",
    "city_libraries",
    "city_senior",
    "city_rec",
    "city_rco_points",
    "irs_bmf",
    "irs_990n",
]

# How specific a lead's kind_hint is (earlier wins when leads disagree), and the group kind
# each hint maps to.
KIND_ORDER = [
    "friends_group",
    "garden",
    "student_org",
    "congregation",
    "team",
    "club",
    "parade_unit",
    "civic",
    "program",
    "library_program",
    "facility",
    "grantee",
    "nonprofit",
    "opportunity",
    "other",
]
KIND_MAP = {
    "friends_group": "friends_group",
    "garden": "garden",
    "student_org": "student_org",
    "congregation": "congregation",
    "team": "team",
    "club": "club",
    "parade_unit": "club",
    "civic": "civic",
    "program": "program",
    "library_program": "program",
    "facility": "program",
    "grantee": "nonprofit",
    "nonprofit": "nonprofit",
    "opportunity": "program",
    "other": "nonprofit",
}

# Label for the address a source gives. The IRS and RCO addresses may be a person's home.
ADDRESS_LABELS = {
    "irs_bmf": MAILING_LABELS[0],
    "irs_990n": MAILING_LABELS[0],
    "city_rco": MAILING_LABELS[1],
    "city_rco_points": MAILING_LABELS[1],
    "city_nac": "Office",
    "city_gardens": "Garden",
    "city_friends": "Park",
    "city_libraries": "Library branch",
    "city_senior": "Senior center",
    "city_rec": "Recreation center",
}

_KEEP_EXTRA = ("org_type", "philadelphia_area", "terminated", "foundation")
_MAX_DOMAIN_CLUSTER = 6


@dataclass(slots=True)
class Node:
    lead: dict[str, Any]
    lead_id: str
    source: str
    ein: str | None
    domain: str | None
    norm: str
    zip: str | None
    rank: int


def _rank(source: str) -> int:
    return SOURCE_PRIORITY.index(source) if source in SOURCE_PRIORITY else len(SOURCE_PRIORITY)


def trim_lead(lead: dict[str, Any]) -> dict[str, Any]:
    """The part of a lead the merge needs (leads are large; descriptions are not carried)."""
    keep = (
        "lead_id",
        "source",
        "source_url",
        "name",
        "aka",
        "kind_hint",
        "website",
        "email",
        "phone",
        "social",
        "contact_name",
        "address",
        "city",
        "zip",
        "lat",
        "lng",
        "meeting_place",
        "school",
        "ein",
        "harvested_at",
        "native_id",
    )
    out = {key: lead.get(key) for key in keep}
    extra = lead.get("extra") or {}
    out["extra"] = {k: extra[k] for k in _KEEP_EXTRA if k in extra}
    return out


def iter_leads(leads_dir: Path) -> Iterator[dict[str, Any]]:
    for path in sorted(leads_dir.glob("*.jsonl")) if leads_dir.exists() else []:
        with open(path, encoding="utf-8") as handle:
            for line in handle:
                line = line.strip()
                if line:
                    yield json.loads(line)


_ADDRESS_ZIP = re.compile(r"\b(?:PA|Pa|Penna?|Pennsylvania)\.?,?\s+(\d{5})(?:-\d{4})?\s*$")


_CITY_ZIP = re.compile(r"\b(19[01]\d{2})(?:-\d{4})?\b")


def lead_zip(lead: dict[str, Any]) -> str | None:
    """The five digit ZIP of a lead. When the address ends in a state and ZIP, that wins: a P.O.
    box number can be mistaken for a ZIP by a source's own field."""
    address = (lead.get("address") or "").strip()
    found = _ADDRESS_ZIP.search(address)
    if found:
        return found.group(1)
    zip_code = lead.get("zip")
    return str(zip_code)[:5] if zip_code else None


def lead_ein(lead: dict[str, Any]) -> str | None:
    ein = lead.get("ein")
    digits = "".join(ch for ch in str(ein) if ch.isdigit()) if ein else ""
    return digits if len(digits) == 9 else None


def make_node(lead: dict[str, Any]) -> Node:
    return Node(
        lead=trim_lead(lead),
        lead_id=lead["lead_id"],
        source=lead["source"],
        ein=lead_ein(lead),
        domain=_domain(lead.get("website")),
        norm=normalize_name(display_name(lead)),
        zip=lead_zip(lead),
        rank=_rank(lead["source"]),
    )


def _domain(website: str | None) -> str | None:
    domain = website_domain(website)
    return domain if domain and not is_shared_domain(domain) else None


def display_name(lead: dict[str, Any]) -> str:
    """The name a group is created with. IRS names in capitals are re-cased, and a Free Library
    branch (the City layer gives only 'Andorra') becomes 'Andorra Library'."""
    name = smart_title(lead["name"])
    if lead.get("source") == "city_libraries" and "library" not in name.lower():
        name = f"{name} Library"
    return name


# -- clustering --


class _UnionFind:
    def __init__(self, nodes: list[Node]) -> None:
        self.parent = list(range(len(nodes)))
        self.eins: list[set[str]] = [{n.ein} if n.ein else set() for n in nodes]

    def find(self, i: int) -> int:
        while self.parent[i] != i:
            self.parent[i] = self.parent[self.parent[i]]
            i = self.parent[i]
        return i

    def union(self, a: int, b: int) -> bool:
        ra, rb = self.find(a), self.find(b)
        if ra == rb:
            return True
        if self.eins[ra] and self.eins[rb] and self.eins[ra] != self.eins[rb]:
            return False  # two different legal entities are never one group
        self.parent[rb] = ra
        self.eins[ra] |= self.eins[rb]
        return True


def cluster_nodes(nodes: list[Node]) -> list[list[Node]]:
    uf = _UnionFind(nodes)
    by_ein: dict[str, list[int]] = defaultdict(list)
    by_domain: dict[str, list[int]] = defaultdict(list)
    by_name_zip: dict[tuple[str, str], list[int]] = defaultdict(list)
    by_name: dict[str, list[int]] = defaultdict(list)
    for i, node in enumerate(nodes):
        if node.ein:
            by_ein[node.ein].append(i)
        if node.domain:
            by_domain[node.domain].append(i)
        if node.norm:
            by_name[node.norm].append(i)
            if node.zip:
                by_name_zip[(node.norm, node.zip)].append(i)
    for members in by_ein.values():
        for other in members[1:]:
            uf.union(members[0], other)
    for members in by_domain.values():
        if len(members) > _MAX_DOMAIN_CLUSTER:  # a bigger crowd is probably a platform
            continue
        # a shared website is not enough: a civic association and the gardens it hosts share one
        for pos, i in enumerate(members):
            for j in members[pos + 1 :]:
                if names_related(nodes[i].norm, nodes[j].norm):
                    uf.union(i, j)
    for members in by_name_zip.values():
        for other in members[1:]:
            uf.union(members[0], other)
    for norm, members in by_name.items():
        if len(significant_tokens(norm)) < 2:
            continue
        if not any(nodes[i].zip is None for i in members):
            continue
        zipped_roots = {uf.find(i) for i in members if nodes[i].zip}
        if len(zipped_roots) > 1:
            continue  # the same name in several ZIPs: leave the unplaced lead on its own
        for other in members[1:]:
            uf.union(members[0], other)
    clusters: dict[int, list[Node]] = defaultdict(list)
    for i, node in enumerate(nodes):
        clusters[uf.find(i)].append(node)
    out = []
    for members in clusters.values():
        members.sort(key=lambda n: (n.rank, n.lead_id))
        out.append(members)
    return out


# -- building and extending groups --


def _in_city(lead: dict[str, Any]) -> bool:
    zip_code = lead_zip(lead)
    if zip_code and zip_code.startswith("191"):
        return True
    city = (lead.get("city") or "").strip().lower()
    return city in ("philadelphia", "phila", "philly")


def locations_for(nodes: list[Node]) -> list[dict[str, Any]]:
    locations: list[dict[str, Any]] = []
    seen: set[str] = set()

    def add(loc: dict[str, Any], key: str) -> None:
        if key not in seen and len(locations) < 3:
            seen.add(key)
            locations.append(loc)

    for node in nodes:
        lead = node.lead
        meeting = lead.get("meeting_place")
        if meeting:
            found = _ADDRESS_ZIP.search(meeting.strip()) or _CITY_ZIP.search(meeting)
            add(
                blank_location(
                    label="Meeting place",
                    address=smart_title(meeting),
                    zip=found.group(1) if found else None,
                    in_city=bool(found and found.group(1).startswith("191")) or _in_city(lead),
                ),
                "m:" + normalize_name(meeting),
            )
        address = lead.get("address")
        zip_code = lead_zip(lead)
        lat, lng = lead.get("lat"), lead.get("lng")
        if address or zip_code or lat is not None:
            key = "a:" + (normalize_name(address) if address else f"{zip_code}:{lat}:{lng}")
            add(
                blank_location(
                    label=ADDRESS_LABELS.get(node.source, "Address"),
                    address=smart_title(address) if address else None,
                    zip=str(zip_code)[:5] if zip_code else None,
                    lat=lat,
                    lng=lng,
                    in_city=_in_city(lead),
                ),
                key,
            )
    return locations


def _pick_kind(nodes: list[Node]) -> str:
    hints = [n.lead.get("kind_hint") or "other" for n in nodes]
    best = min(hints, key=lambda h: KIND_ORDER.index(h) if h in KIND_ORDER else len(KIND_ORDER))
    return KIND_MAP.get(best, "nonprofit")


def _source_entry(node: Node) -> dict[str, Any]:
    lead = node.lead
    fields = ["name"]
    if lead.get("address") or lead.get("zip"):
        fields.append("locations")
    for key in ("website", "email", "phone", "contact_name"):
        if lead.get(key):
            fields.append(f"contacts.{key}")
    if node.ein:
        fields.append("ein")
    return {
        "url": lead["source_url"],
        "seen": lead.get("harvested_at"),
        "fields": fields,
    }


def _add_sources(group: dict[str, Any], nodes: list[Node]) -> None:
    present = {(s.get("url"), s.get("seen")) for s in group["sources"]}
    for node in nodes:
        entry = _source_entry(node)
        if (entry["url"], entry["seen"]) not in present:
            group["sources"].append(entry)
            present.add((entry["url"], entry["seen"]))


def _add_aka(group: dict[str, Any], nodes: list[Node]) -> None:
    have = {normalize_name(group["name"])} | {normalize_name(a) for a in group["aka"]}
    for node in nodes:
        for name in [display_name(node.lead), *(node.lead.get("aka") or [])]:
            name = smart_title(name)
            norm = normalize_name(name)
            if norm and norm not in have:
                group["aka"].append(name)
                have.add(norm)


def _fill_contacts(group: dict[str, Any], nodes: list[Node]) -> None:
    contacts = group["contacts"]
    for node in nodes:
        lead = node.lead
        for key in ("website", "email", "phone"):
            if not contacts.get(key) and lead.get(key):
                contacts[key] = lead[key]
        if not contacts.get("contact_name") and lead.get("contact_name"):
            contacts["contact_name"] = smart_title(lead["contact_name"])
        for url in lead.get("social") or []:
            if url not in contacts["social"]:
                contacts["social"].append(url)


def build_group(
    group_id: str, nodes: list[Node], locator: Callable[[dict[str, Any]], str | None] | None
) -> dict[str, Any]:
    first = nodes[0]
    group = blank_group(group_id, display_name(first.lead))
    group["leads"] = sorted(n.lead_id for n in nodes)
    group["ein"] = next((n.ein for n in nodes if n.ein), None)
    group["kind"] = _pick_kind(nodes)
    school = next((n.lead.get("school") for n in nodes if n.lead.get("school")), None)
    if school:
        group["audience"]["school"] = school
        if group["kind"] == "student_org":
            group["audience"]["open_to"] = "students"
    _add_aka(group, nodes)
    _fill_contacts(group, nodes)
    group["locations"] = locations_for(nodes)
    if locator:
        for loc in group["locations"]:
            loc["planning_district"] = locator(loc)
    _add_sources(group, nodes)
    return group


def extend_group(
    group: dict[str, Any],
    nodes: list[Node],
    locator: Callable[[dict[str, Any]], str | None] | None,
) -> bool:
    """Add what the new leads know to an existing group without overwriting anything. Returns
    True when the group changed."""
    before = json.dumps(group, sort_keys=True, default=str)
    group["leads"] = sorted(set(group["leads"]) | {n.lead_id for n in nodes})
    if not group.get("ein"):
        group["ein"] = next((n.ein for n in nodes if n.ein), None)
    if not group.get("kind"):
        group["kind"] = _pick_kind(nodes)
    _add_aka(group, nodes)
    _fill_contacts(group, nodes)
    if not group["locations"]:
        group["locations"] = locations_for(nodes)
        if locator:
            for loc in group["locations"]:
                loc["planning_district"] = locator(loc)
    _add_sources(group, nodes)
    return json.dumps(group, sort_keys=True, default=str) != before


# -- the run --


@dataclass
class MergeResult:
    leads_read: int = 0
    already_merged: int = 0
    rejected: Counter = field(default_factory=Counter)
    kept: int = 0
    clusters: int = 0
    created: int = 0
    extended: int = 0
    groups_total: int = 0
    triage_lines: int = 0

    def lines(self) -> list[str]:
        out = [
            f"Read {self.leads_read} leads.",
            f"  already in a group from an earlier run: {self.already_merged}",
            f"  triaged out (no group file, see data/triage.jsonl): {sum(self.rejected.values())}",
        ]
        for reason, count in self.rejected.most_common():
            out.append(f"    {reason}: {count}")
        out += [
            f"  kept: {self.kept}, forming {self.clusters} distinct groups after matching",
            f"  new tier 0 group files: {self.created}",
            f"  existing groups that gained leads: {self.extended}",
            f"Groups on disk now: {self.groups_total}",
        ]
        return out


def _write_triage(path: Path, entries: list[dict[str, str]]) -> None:
    entries.sort(key=lambda e: e["lead_id"])
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as handle:
        for entry in entries:
            handle.write(json.dumps(entry, ensure_ascii=False) + "\n")


def run_merge(
    layout: Layout,
    *,
    locator: Callable[[dict[str, Any]], str | None] | None = None,
    dry_run: bool = False,
) -> MergeResult:
    result = MergeResult()
    if not dry_run:
        write_blocklist_if_missing(layout.blocklist_path)
    blocklist = load_blocklist(layout.blocklist_path)
    store = GroupStore(layout.groups_dir)

    # EINs in the IRS master file, so a 990-N "terminated" flag does not remove a group the
    # master file still lists
    bmf_eins: set[str] = set()
    bmf_path = layout.leads_dir / "irs_bmf.jsonl"
    if bmf_path.exists():
        with open(bmf_path, encoding="utf-8") as handle:
            for line in handle:
                ein = lead_ein(json.loads(line))
                if ein:
                    bmf_eins.add(ein)
    ctx = TriageContext(blocklist=blocklist, bmf_eins=bmf_eins)

    with store.lock():
        index = GroupIndex.build(store)
        pending: list[Node] = []
        rejected: list[dict[str, str]] = []
        rejected_eins: dict[str, tuple[str, str]] = {}
        for lead in iter_leads(layout.leads_dir):
            result.leads_read += 1
            if lead["lead_id"] in index.by_lead:
                result.already_merged += 1
                continue
            verdict = decide(lead, ctx)
            if verdict:
                rejected.append(_entry(lead["lead_id"], *verdict))
                result.rejected[verdict[0]] += 1
                ein = lead_ein(lead)
                if ein and verdict[0] not in ("blocklist", "not_a_group", "partisan"):
                    rejected_eins.setdefault(ein, verdict)
                continue
            pending.append(make_node(lead))

        # an organization rejected under one EIN is rejected under every lead that carries it
        if rejected_eins:
            kept_nodes = []
            for node in pending:
                hit = rejected_eins.get(node.ein) if node.ein else None
                if hit:
                    code, detail = hit
                    rejected.append(
                        _entry(node.lead_id, code, f"{detail} (same EIN as another lead)")
                    )
                    result.rejected[code] += 1
                else:
                    kept_nodes.append(node)
            pending = kept_nodes
        result.kept = len(pending)

        clusters = cluster_nodes(pending)
        result.clusters = len(clusters)
        clusters.sort(key=lambda c: (c[0].norm, c[0].lead_id))
        taken = store.ids()
        to_write: dict[str, dict[str, Any]] = {}
        for members in clusters:
            gid = _existing_group(index, members)
            if gid is not None:
                group = to_write.get(gid) or store.read(gid)
                if extend_group(group, members, locator):
                    to_write[gid] = group
                    result.extended += 1
                for node in members:
                    index.by_lead[node.lead_id] = gid
                continue
            name = display_name(members[0].lead)
            zip_code = next((n.zip for n in members if n.zip), None)
            slug = store.make_slug(name, taken, zip_code=zip_code)
            taken.add(slug)
            group = build_group(slug, members, locator)
            to_write[slug] = group
            result.created += 1
        if not dry_run:
            for group in to_write.values():
                store.write(group)
            _write_triage(layout.triage_path, rejected)
        result.triage_lines = len(rejected)
        result.groups_total = len(taken)
    return result


def _entry(lead_id: str, code: str, detail: str) -> dict[str, str]:
    return {"lead_id": lead_id, "decision": "reject", "reason": code, "detail": detail}


def _existing_group(index: GroupIndex, members: list[Node]) -> str | None:
    """An existing group these leads belong to (EIN first, then domain, then name and ZIP)."""
    tried: list[tuple[str, dict[str, Any]]] = []
    for node in members:
        if node.ein:
            tried.append(("ein", {"ein": node.ein}))
    for node in members:
        if node.domain:
            tried.append(("website", {"website": node.lead.get("website")}))
    for node in members:
        tried.append(("name", {"name": display_name(node.lead), "zip_code": node.zip}))
    norms = [n.norm for n in members]
    for how, keys in tried:
        hit = index.find_by_keys(**keys)
        if not hit:
            continue
        if how == "website" and not any(
            names_related(a, b) for a in norms for b in index.names.get(hit[0], [])
        ):
            continue  # same website, different group
        return hit[0]
    return None

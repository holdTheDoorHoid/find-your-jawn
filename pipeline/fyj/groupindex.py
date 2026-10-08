"""Finds the existing group that a lead or a research record is about.

Match order (DATA_MODEL section 6): group id, then lead ids (any group whose `leads` list holds
one), then EIN, then website domain (ignoring www and any path), then normalized name plus ZIP.
Domains that many unrelated groups share (Facebook, phila.gov and the like) never match.
"""

from __future__ import annotations

from collections import defaultdict
from typing import Any

from fyj.groupfile import GroupStore
from fyj.textutil import is_shared_domain, normalize_name, significant_tokens, website_domain


def group_zips(group: dict[str, Any]) -> list[str]:
    return [
        str(loc["zip"])[:5]
        for loc in group.get("locations") or []
        if isinstance(loc, dict) and loc.get("zip")
    ]


def group_names(group: dict[str, Any]) -> list[str]:
    names = [group.get("name") or ""] + list(group.get("aka") or [])
    return [n for n in names if n]


class GroupIndex:
    def __init__(self) -> None:
        self.by_id: dict[str, bool] = {}
        self.by_lead: dict[str, str] = {}
        self.by_ein: dict[str, list[str]] = defaultdict(list)
        self.by_domain: dict[str, list[str]] = defaultdict(list)
        self.by_name_zip: dict[tuple[str, str], list[str]] = defaultdict(list)
        self.by_name: dict[str, list[str]] = defaultdict(list)
        self.hidden: dict[str, bool] = {}
        self.zips: dict[str, list[str]] = {}
        self.names: dict[str, list[str]] = {}

    @classmethod
    def build(cls, store: GroupStore) -> GroupIndex:
        index = cls()
        for group in store.iter_groups():
            index.add(group)
        return index

    def add(self, group: dict[str, Any]) -> None:
        gid = group["id"]
        self.by_id[gid] = True
        self.hidden[gid] = bool(group.get("hidden"))
        for lead_id in group.get("leads") or []:
            self.by_lead.setdefault(lead_id, gid)
        ein = group.get("ein")
        if ein:
            self._append(self.by_ein, str(ein), gid)
        domains = {website_domain((group.get("contacts") or {}).get("website"))}
        domains.discard(None)
        for domain in domains:
            if not is_shared_domain(domain):
                self._append(self.by_domain, domain, gid)
        zips = group_zips(group)
        self.zips[gid] = zips
        self.names[gid] = [n for n in (normalize_name(x) for x in group_names(group)) if n]
        for name in group_names(group):
            norm = normalize_name(name)
            if not norm:
                continue
            self._append(self.by_name, norm, gid)
            for zip_code in zips:
                self._append(self.by_name_zip, (norm, zip_code), gid)

    @staticmethod
    def _append(table: dict, key: Any, gid: str) -> None:
        if gid not in table[key]:
            table[key].append(gid)

    # -- lookups -----------------------------------------------------------------------------

    def find_by_keys(
        self,
        *,
        ein: str | None = None,
        website: str | None = None,
        name: str | None = None,
        zip_code: str | None = None,
        allow_name_only: bool = True,
    ) -> tuple[str, str] | None:
        """(group id, how it matched) or None. Ambiguous matches return None."""
        if ein:
            hits = self.by_ein.get(str(ein), [])
            if len(hits) == 1:
                return hits[0], "ein"
        domain = website_domain(website)
        if domain and not is_shared_domain(domain):
            hits = self.by_domain.get(domain, [])
            if len(hits) == 1:
                return hits[0], "website"
        norm = normalize_name(name or "")
        if norm and zip_code:
            hits = self.by_name_zip.get((norm, str(zip_code)[:5]), [])
            if len(hits) == 1:
                return hits[0], "name+zip"
        if norm and allow_name_only and len(significant_tokens(norm)) >= 2:
            hits = self.by_name.get(norm, [])
            if zip_code:
                # the group we know has no address yet, so the ZIP cannot contradict the name
                hits = [h for h in hits if not self.zips.get(h)]
            if len(hits) == 1:
                return hits[0], "name"
        return None

    def find_for_record(
        self, match: dict[str, Any], name: str | None, zip_code: str | None
    ) -> tuple[str, str] | None:
        gid = match.get("group_id")
        if gid and gid in self.by_id:
            return gid, "group_id"
        lead_hits: dict[str, int] = {}
        for lead_id in match.get("lead_ids") or []:
            hit = self.by_lead.get(lead_id)
            if hit:
                lead_hits[hit] = lead_hits.get(hit, 0) + 1
        if lead_hits:
            best = sorted(lead_hits.items(), key=lambda kv: (-kv[1], kv[0]))[0][0]
            return best, "lead_ids"
        return self.find_by_keys(
            ein=match.get("ein"), website=match.get("website"), name=name, zip_code=zip_code
        )

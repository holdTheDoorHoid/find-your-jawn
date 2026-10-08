"""Group files and the lock (DATA_MODEL section 3).

One YAML file per group at data/groups/<first character of slug>/<slug>.yaml. Keys are written in
a fixed order with nulls kept, so every file has the same shape and diffs stay small. Every write
batch holds an exclusive file lock on data/groups/.lock, so two agents cannot interleave writes.
"""

from __future__ import annotations

import copy
import datetime as _dt
import fcntl
import os
import tempfile
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path
from typing import Any

import yaml

from fyj.textutil import slugify

_Loader = getattr(yaml, "CSafeLoader", yaml.SafeLoader)
_Dumper = getattr(yaml, "CSafeDumper", yaml.SafeDumper)

# Location labels that mean "a mailing address on file", which may be somebody's home. The site
# build publishes only the ZIP for these (ETHICS: no home addresses that are not a meeting place).
MAILING_LABELS = ("Mailing address (IRS)", "Contact address (City list)")

HIDDEN_REASONS = ("out_of_scope", "partisan", "defunct", "duplicate", "private", "removal_request")

# Canonical key order. The values are the defaults of a blank group; None means unknown.
_AUDIENCE: dict[str, Any] = {
    "open_to": None,
    "school": None,
    "min_age": None,
    "max_age": None,
    "community": [],
    "faith": None,
    "partisan": False,
    "support_group": False,
}
_SCHEDULE: dict[str, Any] = {
    "text": None,
    "days": [],
    "times": [],
    "recurring": None,
    "season": None,
}
_LOCATION: dict[str, Any] = {
    "label": None,
    "address": None,
    "neighborhood": None,
    "planning_district": None,
    "zip": None,
    "lat": None,
    "lng": None,
    "in_city": None,
    "transit": None,
}
_COST: dict[str, Any] = {"level": None, "text": None}
_ACCESS: dict[str, Any] = {"wheelchair": "unknown", "languages": [], "notes": None}
_REQUIREMENTS: dict[str, Any] = {
    "act153_clearances": None,
    "background_check": None,
    "court_ordered_ok": "unknown",
    "service_hours_letter": "unknown",
    "kids_ok": None,
    "gear": None,
}
_FIRST_STEP: dict[str, Any] = {
    "how": None,
    "drop_in": None,
    "sign_up_needed": None,
    "newcomer_friendliness": None,
    "basis": None,
    "what_to_expect": None,
    "first_visit_tips": [],
}
_CONTACTS: dict[str, Any] = {
    "website": None,
    "email": None,
    "phone": None,
    "contact_name": None,
    "social": [],
    "calendar_feed": None,
}
_SOURCE: dict[str, Any] = {"url": None, "seen": None, "fields": []}

# name -> default; a dict default is a nested block with its own canonical order.
BLOCKS: dict[str, dict[str, Any]] = {
    "audience": _AUDIENCE,
    "schedule": _SCHEDULE,
    "cost": _COST,
    "access": _ACCESS,
    "requirements": _REQUIREMENTS,
    "first_step": _FIRST_STEP,
    "contacts": _CONTACTS,
}

GROUP_TEMPLATE: dict[str, Any] = {
    "id": None,
    "name": None,
    "aka": [],
    "leads": [],
    "ein": None,
    "summary": None,
    "what_you_do": None,
    "kind": None,
    "categories": [],
    "interests": [],
    "motives": [],
    "formats": [],
    "roles": [],
    "crowd": [],
    "bridging": None,
    "audience": _AUDIENCE,
    "schedule": _SCHEDULE,
    "locations": [],
    "online_ok": None,
    "cost": _COST,
    "commitment": None,
    "group_size": None,
    "access": _ACCESS,
    "requirements": _REQUIREMENTS,
    "first_step": _FIRST_STEP,
    "contacts": _CONTACTS,
    "status": "unknown",
    "last_sign_of_life": None,
    "sign_of_life_url": None,
    "sources": [],
    "research_tier": 0,
    "confidence": None,
    "last_checked": None,
    "hidden": False,
    "hidden_reason": None,
}


def blank_group(group_id: str, name: str) -> dict[str, Any]:
    group = copy.deepcopy(GROUP_TEMPLATE)
    group["id"] = group_id
    group["name"] = name
    return group


def blank_location(**values: Any) -> dict[str, Any]:
    loc = copy.deepcopy(_LOCATION)
    for key, value in values.items():
        if key not in loc:
            raise KeyError(f"unknown location field: {key}")
        loc[key] = value
    return loc


def blank_source(url: str, seen: str, fields: list[str] | None = None) -> dict[str, Any]:
    return {"url": url, "seen": seen, "fields": list(fields or [])}


def _ordered(template: dict[str, Any], data: dict[str, Any]) -> dict[str, Any]:
    """Template keys first in template order (defaults filled in), unknown keys after, sorted."""
    out: dict[str, Any] = {}
    for key, default in template.items():
        if key in data:
            value = data[key]
        else:
            value = copy.deepcopy(default)
        out[key] = value
    for key in sorted(k for k in data if k not in template):
        out[key] = data[key]
    return out


def canonical_group(group: dict[str, Any]) -> dict[str, Any]:
    """The group with keys in the fixed order and every field present."""
    out = _ordered(GROUP_TEMPLATE, group)
    for name, template in BLOCKS.items():
        block = out.get(name)
        out[name] = _ordered(template, block if isinstance(block, dict) else {})
    locations = out.get("locations")
    out["locations"] = [
        _ordered(_LOCATION, loc)
        for loc in (locations if isinstance(locations, list) else [])
        if isinstance(loc, dict)
    ]
    sources = out.get("sources")
    out["sources"] = [
        _ordered(_SOURCE, src)
        for src in (sources if isinstance(sources, list) else [])
        if isinstance(src, dict)
    ]
    return out


def _plain(value: Any) -> Any:
    """Dates read by YAML become ISO strings; ZIP-like ints stay as they are for the validator."""
    if isinstance(value, dict):
        return {str(k): _plain(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_plain(v) for v in value]
    if isinstance(value, _dt.datetime):
        return value.date().isoformat()
    if isinstance(value, _dt.date):
        return value.isoformat()
    return value


def dump_group(group: dict[str, Any]) -> str:
    return yaml.dump(
        canonical_group(group),
        Dumper=_Dumper,
        sort_keys=False,
        allow_unicode=True,
        default_flow_style=False,
        width=100,
    )


def load_group_text(text: str) -> dict[str, Any]:
    data = yaml.load(text, Loader=_Loader)  # noqa: S506 (SafeLoader subclass)
    if not isinstance(data, dict):
        raise ValueError("a group file must contain a mapping")
    return _plain(data)


class GroupStore:
    """Reads and writes group files under one groups directory."""

    def __init__(self, groups_dir: Path) -> None:
        self.groups_dir = Path(groups_dir)
        self._lock_depth = 0
        self._lock_fd: int | None = None

    # -- locking ---------------------------------------------------------------------------

    @contextmanager
    def lock(self) -> Iterator[None]:
        """Hold the exclusive group lock. Re-entrant within one process."""
        if self._lock_depth == 0:
            self.groups_dir.mkdir(parents=True, exist_ok=True)
            fd = os.open(self.groups_dir / ".lock", os.O_CREAT | os.O_RDWR)
            fcntl.flock(fd, fcntl.LOCK_EX)
            self._lock_fd = fd
        self._lock_depth += 1
        try:
            yield
        finally:
            self._lock_depth -= 1
            if self._lock_depth == 0 and self._lock_fd is not None:
                fcntl.flock(self._lock_fd, fcntl.LOCK_UN)
                os.close(self._lock_fd)
                self._lock_fd = None

    # -- paths -----------------------------------------------------------------------------

    def path_for(self, slug: str) -> Path:
        return self.groups_dir / slug[0] / f"{slug}.yaml"

    def ids(self) -> set[str]:
        """Every group id on disk, from file names alone (no YAML is parsed)."""
        if not self.groups_dir.exists():
            return set()
        return {p.stem for p in self.groups_dir.glob("*/*.yaml")}

    def exists(self, slug: str) -> bool:
        return self.path_for(slug).exists()

    # -- reading ---------------------------------------------------------------------------

    def read(self, slug: str) -> dict[str, Any]:
        return canonical_group(load_group_text(self.path_for(slug).read_text(encoding="utf-8")))

    def iter_groups(self) -> Iterator[dict[str, Any]]:
        for path in sorted(self.groups_dir.glob("*/*.yaml")) if self.groups_dir.exists() else []:
            yield canonical_group(load_group_text(path.read_text(encoding="utf-8")))

    # -- writing ---------------------------------------------------------------------------

    def write(self, group: dict[str, Any]) -> Path:
        """Write one group file atomically. The caller must hold lock() (use write_many for a
        single batch)."""
        if self._lock_depth == 0:
            raise RuntimeError("write group files only while holding GroupStore.lock()")
        slug = group.get("id")
        if not slug or slug != slugify(slug, max_len=200):
            raise ValueError(f"group id must be a lowercase ASCII slug, got {slug!r}")
        path = self.path_for(slug)
        path.parent.mkdir(parents=True, exist_ok=True)
        text = dump_group(group)
        if path.exists() and path.read_text(encoding="utf-8") == text:
            return path
        fd, tmp_name = tempfile.mkstemp(dir=path.parent, prefix=f".{slug}.", suffix=".tmp")
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as handle:
                handle.write(text)
            os.replace(tmp_name, path)
        except BaseException:
            Path(tmp_name).unlink(missing_ok=True)
            raise
        return path

    def write_many(self, groups: list[dict[str, Any]]) -> int:
        with self.lock():
            for group in groups:
                self.write(group)
        return len(groups)

    # -- slugs -----------------------------------------------------------------------------

    def make_slug(
        self,
        name: str,
        taken: set[str],
        *,
        neighborhood: str | None = None,
        zip_code: str | None = None,
    ) -> str:
        """A unique, stable slug for a new group.

        The name alone when free. When another group already has it, the neighborhood is added,
        then the ZIP, then a number. Callers keep `taken` up to date (ids on disk plus the slugs
        handed out in the same batch) and never rename a group afterwards.
        """
        base = slugify(name)
        candidates = [base]
        if neighborhood:
            candidates.append(slugify(f"{base}-{neighborhood}"))
        if zip_code:
            candidates.append(slugify(f"{base}-{zip_code}"))
        for candidate in candidates:
            if candidate not in taken:
                return candidate
        stem = candidates[-1]
        number = 2
        while f"{stem}-{number}" in taken:
            number += 1
        return f"{stem}-{number}"

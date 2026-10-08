"""Reads the controlled vocabularies in data/vocab/ (DATA_MODEL section 4) at runtime.

The vocabulary files are written by a separate step, so this loader is deliberately forgiving about
their layout: a list of ids, a list of mappings with an `id`, or a mapping keyed by id all work, and
interest families may carry their tags nested inside or in a separate `tags` list that names the
family. Every tag can list `aka` synonyms, which the importer uses to map free wording to tag ids.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml

from fyj.textutil import canon

_Loader = getattr(yaml, "CSafeLoader", yaml.SafeLoader)

# lists that live in sections of audiences.yaml; the file has no list of its own for them
SECTIONED_NAMES = {"open_to", "community", "heritage", "languages", "faith"}

# vocabulary name -> (file stem, keys the list may sit under)
SIMPLE_FILES = {
    "motives": ("motives", ("motives",)),
    "formats": ("formats", ("formats",)),
    "roles": ("roles", ("roles",)),
    "kinds": ("kinds", ("kinds",)),
    "audiences": ("audiences", ("crowd", "audiences")),
    "open_to": ("audiences", ("open_to",)),
    "community": ("audiences", ("community",)),
    "heritage": ("audiences", ("heritage",)),
    "languages": ("audiences", ("languages",)),
    "faith": ("audiences", ("faith",)),
}
_META_KEYS = {
    "version",
    "description",
    "notes",
    "note",
    "source",
    "sources",
    "credits",
    "updated",
    "title",
    "comment",
    "comments",
    "about",
    "schema",
    "generated",
    "license",
}
_ALIAS_KEYS = ("aka", "aliases", "synonyms", "also")
_ID_KEYS = ("id", "slug", "key", "code", "name")

# The kinds DATA_MODEL section 3 lists, used when data/vocab/kinds.yaml is absent.
DEFAULT_KINDS = (
    "nonprofit",
    "civic",
    "club",
    "team",
    "student_org",
    "congregation",
    "friends_group",
    "garden",
    "program",
    "network",
    "support_group",
)
DEFAULT_MOTIVES = ("values", "understanding", "social", "career", "protective", "enhancement")
DEFAULT_ROLES = ("hands_on", "figure_out", "create", "help_teach", "lead", "organize")


def _items(node: Any) -> list[tuple[str, dict[str, Any]]]:
    """(id, attributes) pairs from a list of ids, a list of mappings, or a mapping keyed by id."""
    out: list[tuple[str, dict[str, Any]]] = []
    if isinstance(node, dict):
        for key, value in node.items():
            if str(key) in _META_KEYS:
                continue
            if isinstance(value, dict):
                out.append((str(key), value))
            elif isinstance(value, str):
                out.append((str(key), {"label": value}))
            elif isinstance(value, list) and all(isinstance(v, str) for v in value):
                out.append((str(key), {"aka": value}))
            else:
                out.append((str(key), {}))
    elif isinstance(node, list):
        for item in node:
            if isinstance(item, str):
                out.append((item, {}))
            elif isinstance(item, dict):
                ident = next((item[k] for k in _ID_KEYS if item.get(k)), None)
                if ident:
                    out.append((str(ident), item))
    return out


def _aliases(attrs: dict[str, Any]) -> list[str]:
    out: list[str] = []
    for key in _ALIAS_KEYS:
        value = attrs.get(key)
        if isinstance(value, str):
            out.append(value)
        elif isinstance(value, list):
            out.extend(str(v) for v in value if v)
    return out


def _pick(data: Any, *keys: str) -> Any:
    """A list or mapping under one of `keys`, else the document itself."""
    if isinstance(data, dict):
        for key in keys:
            if isinstance(data.get(key), (list, dict)):
                return data[key]
    return data


@dataclass
class Vocab:
    families: dict[str, str] = field(default_factory=dict)  # family id -> label
    tags: dict[str, str] = field(default_factory=dict)  # tag id -> family id ("" if unknown)
    simple: dict[str, set[str]] = field(default_factory=dict)  # motives, formats, roles, ...
    neighborhoods: dict[str, dict[str, Any]] = field(default_factory=dict)
    planning_districts: dict[str, str] = field(default_factory=dict)  # id -> name
    zip_districts: dict[str, str] = field(default_factory=dict)  # zip -> district id
    support_families: set[str] = field(default_factory=set)  # families only for the support flow
    raw: dict[str, Any] = field(default_factory=dict)  # file stem -> parsed YAML
    _lookup: dict[str, dict[str, str]] = field(default_factory=dict, repr=False)

    # -- presence ------------------------------------------------------------------------------

    def has(self, name: str) -> bool:
        if name == "interests":
            return bool(self.families)
        if name == "neighborhoods":
            return bool(self.neighborhoods or self.planning_districts)
        return name in self.raw or name in self.simple

    # -- lookups -------------------------------------------------------------------------------

    def _table(self, kind: str) -> dict[str, str]:
        return self._lookup.setdefault(kind, {})

    def resolve_family(self, value: Any) -> str | None:
        if value is None:
            return None
        if str(value) in self.families:
            return str(value)
        return self._table("families").get(canon(str(value)))

    def resolve_tag(self, value: Any) -> str | None:
        if value is None:
            return None
        if str(value) in self.tags:
            return str(value)
        return self._table("tags").get(canon(str(value)))

    def resolve_simple(self, name: str, value: Any) -> str | None:
        allowed = self.simple.get(name)
        if allowed is None or value is None:
            return None
        if str(value) in allowed:
            return str(value)
        return self._table(name).get(canon(str(value)))

    def resolve_district(self, value: Any) -> str | None:
        if value is None:
            return None
        if str(value) in self.planning_districts:
            return str(value)
        return self._table("districts").get(canon(str(value)))

    def tags_of(self, family: str) -> list[str]:
        return [t for t, f in self.tags.items() if f == family]

    def find_tags(self, *words: str) -> list[str]:
        """Tag ids whose id, label or aliases contain any of the given words (for generators)."""
        wanted = [canon(w) for w in words]
        hits = []
        for tag_id in self.tags:
            keys = [canon(tag_id)] + [k for k, v in self._table("tags").items() if v == tag_id]
            if any(w and any(w in k for k in keys) for w in wanted):
                hits.append(tag_id)
        return hits

    def valid(self, name: str, value: Any) -> bool:
        if name == "families":
            return str(value) in self.families
        if name == "tags":
            return str(value) in self.tags
        return str(value) in self.simple.get(name, set())


def _register(table: dict[str, str], key: str, target: str) -> None:
    c = canon(key)
    if c and c not in table:
        table[c] = target


def _load_interests(vocab: Vocab, data: Any) -> None:
    fam_node = _pick(data, "families", "interest_families", "categories")
    if isinstance(data, dict) and fam_node is data:
        fam_node = {k: v for k, v in data.items() if isinstance(v, dict) and k not in _META_KEYS}
    fam_tables = vocab._table("families")
    tag_table = vocab._table("tags")
    for fam_id, attrs in _items(fam_node):
        if fam_id in _META_KEYS:
            continue
        vocab.families[fam_id] = str(attrs.get("label") or attrs.get("title") or fam_id)
        if attrs.get("support_only"):
            vocab.support_families.add(fam_id)
        _register(fam_tables, fam_id, fam_id)
        _register(fam_tables, vocab.families[fam_id], fam_id)
        for alias in _aliases(attrs):
            _register(fam_tables, alias, fam_id)
        nested = attrs.get("tags") or attrs.get("interests")
        for tag_id, tattrs in _items(nested):
            vocab.tags[tag_id] = fam_id
            _register(tag_table, tag_id, tag_id)
            if tattrs.get("label"):
                _register(tag_table, str(tattrs["label"]), tag_id)
            for alias in _aliases(tattrs):
                _register(tag_table, alias, tag_id)
    if isinstance(data, dict):
        flat = data.get("tags") or data.get("interests")
        for tag_id, tattrs in _items(flat):
            if tag_id in vocab.tags:
                continue
            family = tattrs.get("family") or tattrs.get("category") or ""
            vocab.tags[tag_id] = str(family)
            _register(tag_table, tag_id, tag_id)
            if tattrs.get("label"):
                _register(tag_table, str(tattrs["label"]), tag_id)
            for alias in _aliases(tattrs):
                _register(tag_table, alias, tag_id)


def _load_simple(vocab: Vocab, name: str, data: Any, keys: tuple[str, ...]) -> None:
    node = _pick(data, *keys, "items", "values", "entries")
    if isinstance(data, dict) and node is data and name in SECTIONED_NAMES:
        return  # the file has no section for this list
    table = vocab._table(name)
    ids: set[str] = set()
    for item_id, attrs in _items(node):
        ids.add(item_id)
        _register(table, item_id, item_id)
        if attrs.get("label"):
            _register(table, str(attrs["label"]), item_id)
        for alias in _aliases(attrs):
            _register(table, alias, item_id)
    vocab.simple[name] = ids


def _load_neighborhoods(vocab: Vocab, data: Any) -> None:
    if not isinstance(data, dict):
        return
    districts = data.get("planning_districts") or data.get("districts")
    district_table = vocab._table("districts")
    for dist_id, attrs in _items(districts):
        name = str(attrs.get("name") or attrs.get("label") or dist_id)
        vocab.planning_districts[dist_id] = name
        _register(district_table, dist_id, dist_id)
        _register(district_table, name, dist_id)
        for alias in _aliases(attrs):
            _register(district_table, alias, dist_id)
    unverified = next(
        (v for k, v in data.items() if "zip" in str(k).lower() and "unverified" in str(k).lower()),
        None,
    )
    hoods = data.get("neighborhoods")
    for hood_id, attrs in _items(hoods):
        pd = attrs.get("planning_district") or attrs.get("district")
        vocab.neighborhoods[hood_id] = {
            "name": str(attrs.get("name") or attrs.get("label") or hood_id),
            "planning_district": pd,
        }
        if pd and vocab.resolve_district(pd) is None:
            vocab.planning_districts[str(pd)] = str(pd)
            _register(district_table, str(pd), str(pd))
    for key, value in data.items():
        if "zip" not in str(key).lower() or "unverified" in str(key).lower():
            continue
        if isinstance(value, dict):
            pairs = list(value.items())
        elif isinstance(value, list):
            pairs = [
                (str(v.get("zip")), v.get("planning_district") or v.get("district"))
                for v in value
                if isinstance(v, dict)
            ]
        else:
            continue
        for zip_code, dist in pairs:
            if dist is None:
                continue
            if isinstance(dist, dict):
                dist = dist.get("district") or dist.get("planning_district")
            if isinstance(dist, list):
                dist = dist[0] if dist else None
            if not dist:
                continue
            resolved = vocab.resolve_district(dist) or str(dist)
            vocab.zip_districts[str(zip_code)[:5]] = resolved
    if isinstance(unverified, dict):
        for zip_code, entry in unverified.items():
            dist = entry.get("district") if isinstance(entry, dict) else entry
            if dist and str(zip_code)[:5] not in vocab.zip_districts:
                vocab.zip_districts[str(zip_code)[:5]] = vocab.resolve_district(dist) or str(dist)


def load_vocab(vocab_dir: Path) -> Vocab:
    """Load every vocabulary file that exists. A missing file leaves that part empty."""
    vocab = Vocab()
    vocab_dir = Path(vocab_dir)
    for path in sorted(vocab_dir.glob("*.yaml")) if vocab_dir.exists() else []:
        with open(path, encoding="utf-8") as handle:
            data = yaml.load(handle, Loader=_Loader)  # noqa: S506 (SafeLoader subclass)
        vocab.raw[path.stem] = data
    if "interests" in vocab.raw:
        _load_interests(vocab, vocab.raw["interests"])
    for name, (stem, keys) in SIMPLE_FILES.items():
        if stem in vocab.raw:
            _load_simple(vocab, name, vocab.raw[stem], keys)
    if "neighborhoods" in vocab.raw:
        _load_neighborhoods(vocab, vocab.raw["neighborhoods"])
    # the vocab may also keep the ZIP map in a file of its own
    for stem, data in vocab.raw.items():
        if stem != "neighborhoods" and "zip" in stem.lower() and isinstance(data, (dict, list)):
            _load_neighborhoods(vocab, {"zip_districts": _pick(data, "zip_districts", "zips")})
    # Defaults for lists that DATA_MODEL itself spells out
    vocab.simple.setdefault("kinds", set(DEFAULT_KINDS))
    vocab.simple.setdefault("motives", set(DEFAULT_MOTIVES))
    vocab.simple.setdefault("roles", set(DEFAULT_ROLES))
    for name in ("kinds", "motives", "roles"):
        table = vocab._table(name)
        for item in vocab.simple[name]:
            _register(table, item, item)
    return vocab

"""Checks on the controlled vocabularies in data/vocab/. No network.

Every id used in one file must exist in the file that owns it, ids must be unique, and the quiz
scenes together must cover every interest family (except the support flow), every role and every
format.
"""

from __future__ import annotations

import re
from collections import Counter, defaultdict
from pathlib import Path

import pytest
import yaml

VOCAB = Path(__file__).resolve().parents[2] / "data" / "vocab"

EDGE_TYPES = {"same_skill", "same_crowd", "same_place", "same_cause", "same_topic"}
SNAKE = re.compile(r"^[a-z][a-z0-9]*(_[a-z0-9]+)*$")
KEBAB = re.compile(r"^[a-z][a-z0-9]*(-[a-z0-9]+)*$")


def load(name: str):
    with open(VOCAB / f"{name}.yaml", encoding="utf-8") as fh:
        return yaml.safe_load(fh)


def strings(node):
    """Yield every string value (not keys) in a loaded YAML document."""
    if isinstance(node, str):
        yield node
    elif isinstance(node, dict):
        for value in node.values():
            yield from strings(value)
    elif isinstance(node, list):
        for value in node:
            yield from strings(value)


# ---------------------------------------------------------------- interests


@pytest.fixture(scope="module")
def interests():
    return load("interests")


@pytest.fixture(scope="module")
def tag_family(interests):
    return {t["id"]: f["id"] for f in interests["families"] for t in f["tags"]}


def test_family_ids_unique_and_kebab(interests):
    ids = [f["id"] for f in interests["families"]]
    assert len(ids) == len(set(ids))
    for fid in ids:
        assert KEBAB.match(fid), fid
    assert 25 <= len(ids) <= 32


def test_family_fields(interests):
    for f in interests["families"]:
        for key in ("id", "label", "examples", "icon", "tags"):
            assert f.get(key), (f["id"], key)
        assert len(f["icon"].strip()) <= 4, f["id"]
        assert len(f["tags"]) >= 5, f["id"]


def test_tag_ids_unique_and_snake(interests):
    ids = [t["id"] for f in interests["families"] for t in f["tags"]]
    dup = [i for i, c in Counter(ids).items() if c > 1]
    assert not dup, dup
    for tid in ids:
        assert SNAKE.match(tid), tid
    assert 150 <= len(ids) <= 230, len(ids)


def test_tag_fields(interests):
    for f in interests["families"]:
        for t in f["tags"]:
            assert isinstance(t["label"], str) and t["label"].strip(), t["id"]
            for a in t.get("aka", []):
                assert isinstance(a, str), (t["id"], a)
                assert a.strip(), t["id"]


def test_family_and_tag_ids_do_not_collide(interests):
    fids = {f["id"].replace("-", "_") for f in interests["families"]}
    tids = {t["id"] for f in interests["families"] for t in f["tags"]}
    assert not (fids & tids)


def test_aka_unique_and_not_a_label(interests):
    seen = defaultdict(set)
    labels = {t["label"].lower(): t["id"] for f in interests["families"] for t in f["tags"]}
    for f in interests["families"]:
        for t in f["tags"]:
            for a in t.get("aka", []):
                seen[a.lower()].add(t["id"])
                owner = labels.get(a.lower())
                assert owner in (None, t["id"]), (a, t["id"], owner)
    clashes = {a: sorted(v) for a, v in seen.items() if len(v) > 1}
    assert not clashes, clashes


def test_edges_resolve_and_are_typed(interests, tag_family):
    for e in interests["edges"]:
        assert e["from"] in tag_family, e
        assert e["to"] in tag_family, e
        assert e["from"] != e["to"], e
        assert e["type"] in EDGE_TYPES, e


def test_no_duplicate_edges(interests):
    pairs = Counter(frozenset((e["from"], e["to"])) for e in interests["edges"])
    assert not [tuple(p) for p, c in pairs.items() if c > 1]


def test_every_tag_has_two_edges(interests, tag_family):
    degree = Counter()
    for e in interests["edges"]:
        degree[e["from"]] += 1
        degree[e["to"]] += 1
    thin = [t for t in tag_family if degree[t] < 2]
    assert not thin, thin


def test_every_tag_crosses_families(interests, tag_family):
    """Stretches need at least one neighbor outside the tag's own family."""
    cross = Counter()
    for e in interests["edges"]:
        if tag_family[e["from"]] != tag_family[e["to"]]:
            cross[e["from"]] += 1
            cross[e["to"]] += 1
    flat = [t for t, fam in tag_family.items() if fam != "support-recovery" and not cross[t]]
    assert not flat, flat


def test_support_family_is_flagged(interests):
    fams = {f["id"]: f for f in interests["families"]}
    assert fams["support-recovery"].get("support_only") is True
    assert sum(1 for f in fams.values() if f.get("support_only")) == 1


# ---------------------------------------------------------------- house style


def vocab_text_files():
    return sorted(VOCAB.glob("*.yaml")) + sorted(VOCAB.glob("*.md"))


@pytest.mark.parametrize("path", vocab_text_files(), ids=lambda p: p.name)
def test_no_dashes_as_punctuation(path):
    """CLAUDE.md: no em dash, no en dash, no spaced hyphen anywhere people read."""
    for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        assert "—" not in line and "–" not in line, f"{path.name}:{number} long dash"
        body = re.sub(r"^\s*(- )+", "", line)  # a YAML list marker is not punctuation
        body = re.sub(r"^\s*#\s*", "", body)
        assert " - " not in body, f"{path.name}:{number} spaced hyphen: {line!r}"
        assert " -- " not in body and not body.endswith(" -"), f"{path.name}:{number}"

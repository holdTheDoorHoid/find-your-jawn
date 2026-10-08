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


# ---------------------------------------------------------------- small id lists


@pytest.fixture(scope="module")
def tag_ids(interests):
    return {t["id"] for f in interests["families"] for t in f["tags"]}


@pytest.fixture(scope="module")
def family_ids(interests):
    return {f["id"] for f in interests["families"]}


@pytest.fixture(scope="module")
def role_ids():
    return {r["id"] for r in load("roles")["roles"]}


@pytest.fixture(scope="module")
def format_ids():
    return {f["id"] for f in load("formats")["formats"]}


def ids_of(rows, key="id"):
    return [row[key] for row in rows]


def test_every_file_has_a_version():
    for name in (
        "interests",
        "ways_in",
        "motives",
        "formats",
        "roles",
        "audiences",
        "kinds",
        "scenes",
        "future_selves",
        "neighborhoods",
    ):
        assert load(name)["version"] == 1, name


def test_motives_are_the_six():
    motives = load("motives")["motives"]
    assert ids_of(motives) == [
        "values",
        "understanding",
        "social",
        "career",
        "protective",
        "enhancement",
    ]
    labels = {m["id"]: m["label"] for m in motives}
    assert labels["social"] == "Meet people"
    assert labels["values"] == "Do something that matters"
    assert labels["understanding"] == "Learn something"
    assert labels["career"] == "Build skills for work"
    assert labels["protective"] == "Get out of my head and feel better"
    assert labels["enhancement"] == "Feel good about myself"
    for m in motives:
        assert m["description"].strip(), m["id"]


def test_formats_are_the_eight():
    formats = load("formats")["formats"]
    assert sorted(ids_of(formats)) == sorted(
        [
            "side_by_side",
            "conversation",
            "team_play",
            "perform_make_together",
            "behind_the_scenes",
            "lead_organize",
            "learn_skill",
            "one_off_event",
        ]
    )
    for f in formats:
        assert f["label"].strip() and f["description"].strip(), f["id"]


def test_roles_are_the_six_and_echo_holland():
    roles = load("roles")["roles"]
    assert sorted(ids_of(roles)) == sorted(
        ["hands_on", "figure_out", "create", "help_teach", "lead", "organize"]
    )
    holland = {r["holland"] for r in roles}
    assert holland == {
        "Realistic",
        "Investigative",
        "Artistic",
        "Social",
        "Enterprising",
        "Conventional",
    }


def test_kinds_match_the_data_model():
    kinds = load("kinds")["kinds"]
    assert sorted(ids_of(kinds)) == sorted(
        [
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
        ]
    )
    for k in kinds:
        assert k["label"].strip() and k["description"].strip(), k["id"]


# ---------------------------------------------------------------- audiences


def test_audiences_ids_unique_and_complete():
    a = load("audiences")
    for section in ("crowd", "open_to", "community", "heritage", "faith"):
        ids = ids_of(a[section])
        assert len(ids) == len(set(ids)), section
        for i in ids:
            assert SNAKE.match(i), (section, i)
    codes = ids_of(a["languages"], "code")
    assert len(codes) == len(set(codes))
    assert {"en", "es", "zh", "vi", "ar", "ase"} <= set(codes)
    assert {
        "all_adults",
        "all_ages",
        "families",
        "teens",
        "young_adults",
        "seniors",
        "students",
        "professionals",
    } <= set(ids_of(a["crowd"]))
    assert {
        "lgbtq",
        "women",
        "men",
        "black",
        "latino",
        "asian_american",
        "immigrants",
        "veterans",
        "parents",
        "disability",
        "deaf",
        "blind",
        "sober",
    } <= set(ids_of(a["community"]))
    assert set(ids_of(a["faith"])) >= {
        "catholic",
        "protestant",
        "black_church",
        "orthodox_christian",
        "jewish",
        "muslim",
        "buddhist",
        "hindu",
        "sikh",
        "quaker",
        "unitarian",
        "interfaith",
        "other",
    }
    assert set(ids_of(a["open_to"])) == {
        "public",
        "students",
        "members",
        "parents",
        "residents",
        "invite",
    }
    for c in a["crowd"]:
        lo, hi = c["ages"]
        assert 0 <= lo < hi <= 99, c["id"]


# ---------------------------------------------------------------- ways in


def test_ways_in_cover_every_family_and_resolve(family_ids, tag_ids):
    data = load("ways_in")
    way_ids = ids_of(data["ways"])
    assert way_ids == ["do_it", "learn_it", "teach_it", "serve_it", "lead_it"]
    assert set(data["by_family"]) == family_ids
    for fam, entries in data["by_family"].items():
        assert set(entries) == set(way_ids), fam
        for way, entry in entries.items():
            assert entry["tags"], (fam, way)
            for tag in entry["tags"]:
                assert tag in tag_ids, (fam, way, tag)
            assert isinstance(entry["example"], str) and entry["example"].strip(), (fam, way)


# ---------------------------------------------------------------- scenes


SCENE_SETS = ("saturday_scenes", "extra_scenes", "moments")


@pytest.fixture(scope="module")
def all_cards():
    data = load("scenes")
    return [card for name in SCENE_SETS for card in data[name]]


def test_scene_counts_and_ids():
    data = load("scenes")
    assert len(data["saturday_scenes"]) == 12
    assert len(data["extra_scenes"]) == 8
    assert len(data["moments"]) == 10
    ids = [c["id"] for name in SCENE_SETS for c in data[name]]
    assert len(ids) == len(set(ids))
    for i in ids:
        assert SNAKE.match(i), i


def test_scene_fields_and_references(all_cards, tag_ids, role_ids, format_ids, interests):
    support_tags = {
        t["id"] for f in interests["families"] if f.get("support_only") for t in f["tags"]
    }
    for card in all_cards:
        cid = card["id"]
        assert card["text"].strip() and len(card["text"].split()) <= 14, cid
        assert card["icon"].strip(), cid
        assert card["picture"] is None and card["picture_credit"] is None, cid
        assert card["picture_brief"].strip(), cid
        assert card["interests"], cid
        for tag, weight in card["interests"].items():
            assert tag in tag_ids, (cid, tag)
            assert tag not in support_tags, (cid, tag)
            assert 0 < weight <= 1, (cid, tag, weight)
        assert card["roles"] and set(card["roles"]) <= role_ids, cid
        assert card["formats"] and set(card["formats"]) <= format_ids, cid


def test_scenes_cover_every_family_role_and_format(
    all_cards, interests, tag_family, role_ids, format_ids
):
    covered = set()
    for card in all_cards:
        for tag, weight in card["interests"].items():
            if weight >= 0.5:
                covered.add(tag_family[tag])
    needed = {f["id"] for f in interests["families"] if not f.get("support_only")}
    assert needed - covered == set(), needed - covered
    assert role_ids - {r for c in all_cards for r in c["roles"]} == set()
    assert format_ids - {f for c in all_cards for f in c["formats"]} == set()


def test_each_base_set_is_varied(interests, tag_family):
    """The first twelve alone should reach a good spread of families, not just a few."""
    data = load("scenes")
    fams = {
        tag_family[tag]
        for card in data["saturday_scenes"]
        for tag, weight in card["interests"].items()
        if weight >= 0.5
    }
    assert len(fams) >= 14, sorted(fams)


# ---------------------------------------------------------------- future selves


def test_future_selves(tag_ids, role_ids, format_ids):
    selves = load("future_selves")["future_selves"]
    assert len(selves) == 10
    way_ids = set(ids_of(load("ways_in")["ways"]))
    ids = ids_of(selves)
    assert len(ids) == len(set(ids))
    for s in selves:
        sid = s["id"]
        assert SNAKE.match(sid), sid
        assert s["text"].strip() and s["icon"].strip() and s["because"].strip(), sid
        assert len(s["interests"]) >= 5, sid
        for tag, weight in s["interests"].items():
            assert tag in tag_ids, (sid, tag)
            assert 0 < weight <= 1, (sid, tag)
        assert s["roles"] and set(s["roles"]) <= role_ids, sid
        assert s["formats"] and set(s["formats"]) <= format_ids, sid
        assert s["ways_in"] and set(s["ways_in"]) <= way_ids, sid


# ---------------------------------------------------------------- neighborhoods


PLANNING_DISTRICTS = {
    "Central",
    "Central Northeast",
    "Lower Far Northeast",
    "Lower North",
    "Lower Northeast",
    "Lower Northwest",
    "Lower South",
    "Lower Southwest",
    "North",
    "North Delaware",
    "River Wards",
    "South",
    "University Southwest",
    "Upper Far Northeast",
    "Upper North",
    "Upper Northwest",
    "West",
    "West Park",
}


def test_planning_districts_and_regions():
    data = load("neighborhoods")
    assert {d["label"] for d in data["planning_districts"]} == PLANNING_DISTRICTS
    assert len(data["planning_districts"]) == 18
    assert [r["label"] for r in data["regions"]] == [
        "Center City",
        "North",
        "Northeast",
        "Northwest",
        "South",
        "West and Southwest",
    ]
    region_ids = set(ids_of(data["regions"]))
    for d in data["planning_districts"]:
        assert d["region"] in region_ids, d


def test_neighborhoods_resolve():
    data = load("neighborhoods")
    districts = {d["id"]: d for d in data["planning_districts"]}
    regions = set(ids_of(data["regions"]))
    ids = ids_of(data["neighborhoods"])
    assert len(ids) == len(set(ids))
    assert len(ids) >= 140
    for n in data["neighborhoods"]:
        assert SNAKE.match(n["id"]), n["id"]
        assert n["label"].strip(), n["id"]
        assert n["district"] in districts, n
        assert n["region"] in regions, n
        assert n["region"] == districts[n["district"]]["region"], n
        for other in n.get("also_in", []):
            assert other in districts and other != n["district"], n
    # every planning district holds at least one neighborhood
    used = {n["district"] for n in data["neighborhoods"]}
    assert used == set(districts)
    for expected in ("fishtown", "rittenhouse", "manayunk", "chestnut_hill", "kingsessing"):
        assert expected in ids


def test_aliases_resolve():
    data = load("neighborhoods")
    ids = set(ids_of(data["neighborhoods"]))
    names = [a["name"] for a in data["aliases"]]
    assert len(names) == len(set(names))
    for alias in data["aliases"]:
        assert alias["covers"], alias
        assert set(alias["covers"]) <= ids, alias


def test_zip_table():
    data = load("neighborhoods")
    districts = {d["id"]: d for d in data["planning_districts"]}
    for table in ("zip_districts", "zip_districts_unverified"):
        for zip_code, row in data[table].items():
            assert re.fullmatch(r"191\d\d", str(zip_code)), zip_code
            assert row["district"] in districts, (zip_code, row)
            assert row["region"] == districts[row["district"]]["region"], (zip_code, row)
            for other in row.get("also_in", []):
                assert other in districts, (zip_code, other)
    assert not set(data["zip_districts"]) & set(data["zip_districts_unverified"])
    # the central ZIPs and a few well known ones land where a Philadelphian expects
    assert data["zip_districts"]["19103"]["district"] == "central"
    assert data["zip_districts"]["19147"]["region"] in ("center_city", "south")
    assert data["zip_districts"]["19146"]["region"] == "south"
    assert data["zip_districts"]["19104"]["region"] == "west_southwest"
    assert data["zip_districts"]["19118"]["region"] == "northwest"
    assert data["zip_districts"]["19149"]["region"] == "northeast"
    assert len(data["zip_districts"]) >= 45

import multiprocessing
import time

import pytest

from fyj.groupfile import GroupStore, blank_group, blank_location, canonical_group, dump_group
from fyj.textutil import slugify


def test_slugify_makes_lowercase_ascii_words():
    assert slugify("Philadelphia Grotto") == "philadelphia-grotto"
    assert slugify("St. Patrick’s Day Parade & Friends") == "st-patricks-day-parade-and-friends"
    assert slugify("Café Bolívar") == "cafe-bolivar"
    assert slugify("!!!") == "group"


def test_slugify_truncates_at_a_word_boundary():
    slug = slugify("A very long group name " * 8, max_len=40)
    assert len(slug) <= 40
    assert not slug.endswith("-")


def test_blank_group_has_every_section_in_the_documented_order():
    group = blank_group("philadelphia-grotto", "Philadelphia Grotto")
    keys = list(group)
    assert keys[:4] == ["id", "name", "aka", "leads"]
    assert keys.index("audience") < keys.index("schedule") < keys.index("locations")
    assert keys[-6:] == [
        "sources",
        "research_tier",
        "confidence",
        "last_checked",
        "hidden",
        "hidden_reason",
    ]
    assert group["research_tier"] == 0
    assert group["status"] == "unknown"
    assert group["hidden"] is False
    # facts we do not know stay unknown, never a guessed false
    assert group["requirements"]["background_check"] is None
    assert group["requirements"]["court_ordered_ok"] == "unknown"


def test_write_then_read_round_trips_and_is_stable(tmp_path):
    store = GroupStore(tmp_path / "groups")
    group = blank_group("philadelphia-grotto", "Philadelphia Grotto")
    group["summary"] = "A caving club: trips, beginners welcome."
    group["locations"] = [blank_location(label="Monthly meeting", zip="19104", in_city=False)]
    group["sources"] = [{"url": "https://caves.org/x", "seen": "2026-10-04", "fields": ["name"]}]
    group["last_sign_of_life"] = "2026-09"
    with store.lock():
        path = store.write(group)
    assert path == tmp_path / "groups" / "p" / "philadelphia-grotto.yaml"
    first = path.read_text(encoding="utf-8")
    again = store.read("philadelphia-grotto")
    assert again["last_sign_of_life"] == "2026-09"
    assert again["sources"][0]["seen"] == "2026-10-04"
    assert again["locations"][0]["zip"] == "19104"
    with store.lock():
        store.write(again)
    assert path.read_text(encoding="utf-8") == first


def test_file_keeps_nulls_so_the_shape_is_visible(tmp_path):
    text = dump_group(blank_group("a-group", "A group"))
    assert "summary: null" in text
    assert "newcomer_friendliness: null" in text
    assert text.index("id: a-group") < text.index("name: A group") < text.index("summary:")


def test_unknown_keys_are_kept_after_the_known_ones():
    group = blank_group("x", "X")
    group["zzz_extra"] = 1
    group["audience"]["custom"] = True
    canon = canonical_group(group)
    assert list(canon)[-1] == "zzz_extra"
    assert list(canon["audience"])[-1] == "custom"


def test_yaml_dates_come_back_as_strings(tmp_path):
    store = GroupStore(tmp_path / "groups")
    path = store.path_for("dated")
    path.parent.mkdir(parents=True)
    path.write_text(
        "id: dated\nname: Dated\nlast_checked: 2026-10-04\nsources:\n"
        "  - {url: 'https://x.org', seen: 2026-10-04, fields: []}\n",
        encoding="utf-8",
    )
    group = store.read("dated")
    assert group["last_checked"] == "2026-10-04"
    assert group["sources"][0]["seen"] == "2026-10-04"


def test_write_requires_the_lock(tmp_path):
    store = GroupStore(tmp_path / "groups")
    with pytest.raises(RuntimeError):
        store.write(blank_group("x", "X"))


def test_write_many_takes_the_lock_and_creates_the_lock_file(tmp_path):
    store = GroupStore(tmp_path / "groups")
    store.write_many([blank_group("a-one", "A one"), blank_group("b-two", "B two")])
    assert (tmp_path / "groups" / ".lock").exists()
    assert store.ids() == {"a-one", "b-two"}
    assert [g["id"] for g in store.iter_groups()] == ["a-one", "b-two"]


def test_lock_is_reentrant_in_one_process(tmp_path):
    store = GroupStore(tmp_path / "groups")
    with store.lock(), store.lock():
        store.write(blank_group("x", "X"))
    assert store.exists("x")


def _hold_lock(groups_dir, hold_seconds, ready, done):
    store = GroupStore(groups_dir)
    with store.lock():
        ready.set()
        time.sleep(hold_seconds)
        done.value = time.time()


def test_second_process_waits_for_the_lock(tmp_path):
    groups_dir = tmp_path / "groups"
    ready = multiprocessing.Event()
    released = multiprocessing.Value("d", 0.0)
    proc = multiprocessing.Process(target=_hold_lock, args=(groups_dir, 0.6, ready, released))
    proc.start()
    assert ready.wait(5)
    store = GroupStore(groups_dir)
    with store.lock():
        acquired = time.time()
    proc.join()
    assert acquired >= released.value - 0.05


def test_make_slug_adds_neighborhood_then_zip_then_a_number():
    store = GroupStore(__import__("pathlib").Path("/nonexistent"))
    taken = {"friends-of-the-park"}
    assert store.make_slug("Friends of the Park", set()) == "friends-of-the-park"
    assert store.make_slug("Friends of the Park", taken, neighborhood="Fairmount") == (
        "friends-of-the-park-fairmount"
    )
    taken.add("friends-of-the-park-fairmount")
    assert (
        store.make_slug("Friends of the Park", taken, neighborhood="Fairmount", zip_code="19130")
        == "friends-of-the-park-19130"
    )
    taken.add("friends-of-the-park-19130")
    assert store.make_slug("Friends of the Park", taken, zip_code="19130") == (
        "friends-of-the-park-19130-2"
    )
    assert store.make_slug("Friends of the Park", taken) == "friends-of-the-park-2"


def test_write_rejects_a_bad_id(tmp_path):
    store = GroupStore(tmp_path / "groups")
    with store.lock(), pytest.raises(ValueError):
        store.write(blank_group("Not A Slug", "x"))

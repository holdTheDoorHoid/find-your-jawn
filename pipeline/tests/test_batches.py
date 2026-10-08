import json

from helpers import lead, location, make_group, write_leads

from fyj.batches import Selector, trim_description, write_batches
from fyj.cli import main
from fyj.liveness import write_results


def setup_groups(layout):
    make_group(
        layout,
        "a-penn",
        "A Penn Club",
        kind="student_org",
        leads=["penn_clubs:a"],
        locations=[location(zip="19104", planning_district="west", address="1 Main St")],
        contacts={"website": "https://a.org", "email": "a@a.org"},
    )
    make_group(
        layout,
        "b-irs",
        "B Org",
        kind="nonprofit",
        leads=["irs_990n:1", "irs_bmf:1"],
        ein="123456789",
        locations=[location(zip="19130", planning_district="lower_north")],
    )
    make_group(
        layout,
        "c-city",
        "C Garden",
        kind="garden",
        leads=["city_gardens:1"],
        locations=[location(zip="19103", planning_district="central")],
    )
    make_group(
        layout,
        "d-done",
        "D Done",
        kind="nonprofit",
        leads=["irs_bmf:2"],
        research_tier=1,
        locations=[location(planning_district="west")],
    )
    make_group(
        layout,
        "e-hidden",
        "E Hidden",
        kind="nonprofit",
        leads=["irs_bmf:3"],
        hidden=True,
        hidden_reason="defunct",
    )
    make_group(layout, "f-nowhere", "F Nowhere", kind="club", leads=["manual_seeds:f"])
    write_leads(
        layout,
        "penn_clubs",
        [
            lead(
                "penn_clubs",
                "a",
                "A Penn Club",
                description="We are a student group. " + "word " * 200,
            )
        ],
    )
    write_leads(
        layout,
        "city_volunteer_pages",
        [
            lead(
                "city_volunteer_pages",
                "x",
                "Page",
                description="window.dataLayer = []; function(a){}",
            )
        ],
    )


def ids_in(layout, wave):
    out = []
    for path in sorted(layout.batches_dir(wave).glob("*.json")):
        out.append([e["id"] for e in json.loads(path.read_text(encoding="utf-8"))])
    return out


def test_trim_description_cuts_at_a_word_and_drops_script_junk():
    text = "alpha beta gamma " * 100
    cut = trim_description(text)
    assert cut.endswith("...") and len(cut) <= 603 and not cut.startswith(" ")
    assert trim_description("short   text\n here") == "short text here"
    assert trim_description("window.dataLayer = window.dataLayer || [];") is None
    assert trim_description(None) is None


def test_all_visible_groups_are_ordered_by_district_and_split_by_size(layout, vocab):
    setup_groups(layout)
    total, files = write_batches(layout, vocab, "w1", Selector(), size=2)
    assert total == 5 and len(files) == 3
    assert [p.name for p in files] == ["01.json", "02.json", "03.json"]
    # central, lower_north, west, west, then the group with no district last
    assert ids_in(layout, "w1") == [["c-city", "b-irs"], ["a-penn", "d-done"], ["f-nowhere"]]


def test_selectors_by_source_kind_tier_district_and_ids(layout, vocab):
    setup_groups(layout)

    def run(**kw):
        total, _ = write_batches(layout, vocab, "w", Selector(**kw))
        return sorted(i for batch in ids_in(layout, "w") for i in batch) if total else []

    assert run(sources={"irs_990n"}) == ["b-irs"]
    assert run(sources={"irs_990n", "city_gardens"}) == ["b-irs", "c-city"]
    assert run(kinds={"garden", "club"}) == ["c-city", "f-nowhere"]
    assert run(tiers={1}) == ["d-done"]
    assert run(districts={"west"}) == ["a-penn", "d-done"]
    assert run(ids={"a-penn", "zzz"}) == ["a-penn"]
    assert run(sources={"irs_bmf"}, tiers={0}) == ["b-irs"]


def test_exclude_done_skips_groups_at_or_above_the_target_tier(layout, vocab):
    setup_groups(layout)
    write_batches(layout, vocab, "w", Selector(exclude_done=True))
    assert "d-done" not in sum(ids_in(layout, "w"), [])
    write_batches(layout, vocab, "w", Selector(exclude_done=True, target_tier=2))
    assert "d-done" in sum(ids_in(layout, "w"), [])


def test_batch_entries_carry_what_an_agent_needs_and_nothing_extra(layout, vocab):
    setup_groups(layout)
    write_results(
        layout.liveness_path,
        {
            "a-penn": {
                "group_id": "a-penn",
                "url": "https://a.org",
                "checked_at": "2026-10-08T00:00:00Z",
                "http_status": 200,
                "final_url": "https://a.org/",
                "newest_date": "2026-09",
                "evidence_url": "https://a.org/",
                "verdict": "alive",
                "note": None,
            }
        },
    )
    write_batches(layout, vocab, "w", Selector(ids={"a-penn", "b-irs"}))
    entries = json.loads((layout.batches_dir("w") / "01.json").read_text(encoding="utf-8"))
    by_id = {e["id"]: e for e in entries}
    penn = by_id["a-penn"]
    assert penn["name"] == "A Penn Club" and penn["kind"] == "student_org"
    assert penn["address"] == "1 Main St" and penn["zip"] == "19104"
    assert penn["planning_district"] == "west"
    assert penn["lead_ids"] == ["penn_clubs:a"]
    assert penn["contacts"] == {"website": "https://a.org", "email": "a@a.org"}
    assert len(penn["lead_descriptions"]) == 1
    assert len(penn["lead_descriptions"][0]["text"]) <= 603
    assert penn["liveness"]["verdict"] == "alive" and penn["liveness"]["newest_date"] == "2026-09"
    other = by_id["b-irs"]
    assert other["ein"] == "123456789" and "liveness" not in other
    assert other["lead_descriptions"] == []
    assert set(penn) == {
        "id",
        "name",
        "aka",
        "kind",
        "ein",
        "address",
        "zip",
        "planning_district",
        "research_tier",
        "lead_ids",
        "contacts",
        "lead_descriptions",
        "liveness",
    }


def test_rewriting_a_wave_removes_stale_batch_files(layout, vocab):
    setup_groups(layout)
    write_batches(layout, vocab, "w", Selector(), size=1)
    assert len(list(layout.batches_dir("w").glob("*.json"))) == 5
    write_batches(layout, vocab, "w", Selector(ids={"a-penn"}), size=1)
    assert [p.name for p in layout.batches_dir("w").glob("*.json")] == ["01.json"]


def test_cli_batches(layout, monkeypatch, capsys, tmp_path):
    setup_groups(layout)
    monkeypatch.setenv("FYJ_ROOT", str(layout.root))
    ids = tmp_path / "ids.txt"
    ids.write_text("a-penn\nb-irs\nc-city\n", encoding="utf-8")
    main(
        [
            "batches",
            "w9",
            "--ids-file",
            str(ids),
            "--kind",
            "student_org,nonprofit",
            "--district",
            "West,lower_north",
            "--size",
            "1",
            "--exclude-done",
            "--limit",
            "5",
        ]
    )
    out = capsys.readouterr().out
    assert "2 group(s) selected, 2 batch file(s) of up to 1" in out
    assert ids_in(layout, "w9") == [["b-irs"], ["a-penn"]]

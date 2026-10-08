import json

from conftest import FIXTURES_DIR
from helpers import (
    good_record,
    lead,
    location,
    make_group,
    write_inbox,
    write_leads,
)

from fyj.groupfile import GroupStore
from fyj.research_import import import_wave

TODAY = "2026-10-08"


def run(layout, vocab, wave="w1", **kw):
    return import_wave(layout, wave, vocab, today=TODAY, **kw)


def test_a_new_group_is_created_from_a_clean_record(layout, vocab):
    write_inbox(layout, "w1", "a1", [good_record()])
    summary = run(layout, vocab)
    assert (summary.records_in, summary.created, summary.merged, summary.held) == (1, 1, 0, 0)
    group = GroupStore(layout.groups_dir).read("philadelphia-grotto")
    assert group["summary"].startswith("A caving club")
    assert group["research_tier"] == 1
    assert group["interests"] == ["caving", "hiking"]
    assert group["last_checked"] == "2026-10-04"
    assert group["contacts"]["website"] == "https://phillygrotto.org"
    # the inbox file moved to done
    assert not (layout.inbox_dir("w1") / "a1.json").exists()
    assert (layout.done_dir("w1") / "a1.json").exists()


def test_match_by_lead_ids_merges_and_research_wins(layout, vocab):
    make_group(
        layout,
        "grotto-old",
        "Philly Cave Club",
        leads=["nss:1"],
        kind="nonprofit",
        contacts={"email": "old@example.org", "website": "http://old.example.org"},
        sources=[{"url": "https://caves.org/g", "seen": "2026-10-01", "fields": ["name"]}],
    )
    rec = good_record(match={"lead_ids": ["nss:1", "nss:2"]})
    write_inbox(layout, "w1", "a1", [rec])
    summary = run(layout, vocab)
    assert (summary.created, summary.merged) == (0, 1)
    group = GroupStore(layout.groups_dir).read("grotto-old")
    assert group["name"] == "Philadelphia Grotto"
    assert "Philly Cave Club" in group["aka"]
    assert group["kind"] == "club"
    assert group["leads"] == ["nss:1", "nss:2"]
    assert group["contacts"]["email"] == "old@example.org"  # not dropped
    assert group["contacts"]["website"] == "https://phillygrotto.org"  # research wins
    assert {s["url"] for s in group["sources"]} == {
        "https://caves.org/g",
        "https://phillygrotto.org",
    }
    assert not GroupStore(layout.groups_dir).exists("philadelphia-grotto")


def test_domain_match_ignores_www_and_paths_and_name_zip_is_the_last_resort(layout, vocab):
    make_group(layout, "grotto", "Philadelphia Grotto Inc.", locations=[location(zip="19104")])
    write_inbox(
        layout, "w1", "a1", [good_record(contacts={"website": None}, locations=[{"zip": "19104"}])]
    )
    summary = run(layout, vocab)
    assert summary.merged == 1
    assert GroupStore(layout.groups_dir).read("grotto")["research_tier"] == 1


def test_a_different_zip_does_not_match_by_name(layout, vocab):
    make_group(layout, "grotto", "Philadelphia Grotto", locations=[location(zip="19130")])
    write_inbox(
        layout, "w1", "a1", [good_record(contacts={"website": None}, locations=[{"zip": "19104"}])]
    )
    summary = run(layout, vocab)
    assert summary.created == 1


def test_synonyms_and_slips_are_repaired(layout, vocab):
    rec = good_record(
        interests="Spelunking, trail walking, basketweaving",
        categories="Outdoors & Adventure",
        motives="social, SOCIAL",
        crowd="all_adults",
        audience={
            "open_to": "Everyone",
            "min_age": "18+",
            "max_age": "unknown",
            "faith": "unknown",
        },
        schedule={"text": "Thursdays", "days": "Thursdays, saturdays", "recurring": "yes"},
        cost={"level": "Free", "text": "unknown"},
        access={"wheelchair": "unknown", "languages": "en, es"},
        requirements={"kids_ok": "no", "court_ordered_ok": "unknown"},
        first_step={
            "drop_in": "true",
            "newcomer_friendliness": "4",
            "first_visit_tips": "Bring water; wear boots",
        },
        contacts={"website": "https://phillygrotto.org", "email": "unknown", "social": "x.com/a"},
        commitment="unknown",
        group_size=None,
    )
    del rec["what_you_do"]
    del rec["roles"]
    write_inbox(layout, "w1", "a1", [rec])
    summary = run(layout, vocab)
    assert (summary.created, summary.held) == (1, 0)
    group = GroupStore(layout.groups_dir).read("philadelphia-grotto")
    assert group["interests"] == ["caving", "hiking"]
    assert group["categories"] == ["outdoors-adventure"]
    assert group["motives"] == ["social"]
    assert group["audience"]["open_to"] == "public"
    assert group["audience"]["min_age"] == 18
    assert group["audience"]["max_age"] is None
    assert group["audience"]["faith"] is None
    assert group["schedule"]["days"] == ["thu", "sat"]
    assert group["schedule"]["recurring"] is True
    assert group["cost"] == {"level": "free", "text": None}
    assert group["access"]["languages"] == ["en", "es"]
    assert group["requirements"]["kids_ok"] is False
    assert group["first_step"]["drop_in"] is True
    assert group["first_step"]["newcomer_friendliness"] == 4
    assert group["first_step"]["first_visit_tips"] == ["Bring water", "wear boots"]
    assert group["contacts"]["email"] is None
    assert group["contacts"]["social"] == ["x.com/a"]
    assert group["commitment"] is None
    assert summary.warnings >= 1  # basketweaving was dropped


def test_dashes_in_our_text_become_commas(layout, vocab):
    rec = good_record(
        summary="A caving club — trips and beginner days.",
        schedule={"text": "Meets 6–8 pm - first Thursday"},
    )
    write_inbox(layout, "w1", "a1", [rec])
    run(layout, vocab)
    group = GroupStore(layout.groups_dir).read("philadelphia-grotto")
    assert group["summary"] == "A caving club, trips and beginner days."
    assert group["schedule"]["text"] == "Meets 6 to 8 pm, first Thursday"


def test_missing_required_fields_hold_the_record_with_reasons(layout, vocab):
    bad = good_record(name="Needs Summary")
    del bad["summary"]
    no_source = good_record(name="No Source", sources=[])
    no_date = good_record(name="No Date", sources=[{"url": "https://x.org", "fields": []}])
    bad_kind = good_record(name="Bad Kind", kind="magazine")
    stale = good_record(name="Unknown Kind Wording", kind="")
    write_inbox(layout, "w1", "a1", [good_record(), bad, no_source, no_date, bad_kind, stale])
    summary = run(layout, vocab)
    assert (summary.created, summary.held) == (1, 5)
    held = json.loads((layout.held_dir("w1") / "a1.json").read_text(encoding="utf-8"))
    assert len(held["records"]) == 5
    reasons = {r["name"]: " ".join(r["_held_reasons"]) for r in held["records"]}
    assert "summary" in reasons["Needs Summary"]
    assert "sources" in reasons["No Source"]
    assert "sources" in reasons["No Date"]
    assert "kind" in reasons["Bad Kind"]
    assert "kind" in reasons["Unknown Kind Wording"]
    # only the good record became a group
    assert GroupStore(layout.groups_dir).ids() == {"philadelphia-grotto"}
    assert (layout.done_dir("w1") / "a1.json").exists()


def test_held_file_can_be_dropped_back_in_the_inbox_after_a_fix(layout, vocab):
    bad = good_record()
    del bad["summary"]
    write_inbox(layout, "w1", "a1", [bad])
    run(layout, vocab)
    held = json.loads((layout.held_dir("w1") / "a1.json").read_text(encoding="utf-8"))
    fixed = held["records"][0]
    fixed["summary"] = "A caving club that teaches beginners."
    write_inbox(layout, "w1", "a1-fixed", [fixed])
    summary = run(layout, vocab)
    assert (summary.created, summary.held) == (1, 0)


def test_own_words_check_holds_a_record_that_copies_a_lead(layout, vocab):
    copied = "We are a student group that consults for social impact focused businesses"
    write_leads(layout, "penn", [lead("penn", "1", "180 Consulting", description=copied)])
    rec = good_record(
        match={"lead_ids": ["penn:1"]},
        summary="We are a student group that consults for social impact businesses nearby.",
    )
    write_inbox(layout, "w1", "a1", [rec])
    summary = run(layout, vocab)
    assert summary.held == 1
    held = json.loads((layout.held_dir("w1") / "a1.json").read_text(encoding="utf-8"))
    assert "own_words" in held["records"][0]["_held_reasons"][0]


def test_partisan_names_are_held_unless_hidden_as_partisan(layout, vocab):
    rec = good_record(name="12th Ward Democratic Committee")
    hidden = good_record(
        name="14th Ward Democratic Committee", verdict="hide", hidden_reason="partisan"
    )
    write_inbox(layout, "w1", "a1", [rec, hidden])
    summary = run(layout, vocab)
    assert summary.held == 1
    group = GroupStore(layout.groups_dir).read("14th-ward-democratic-committee")
    assert group["hidden"] is True and group["hidden_reason"] == "partisan"


def test_court_ordered_yes_needs_a_source_that_names_the_field(layout, vocab):
    rec = good_record(requirements={"court_ordered_ok": "yes"})
    write_inbox(layout, "w1", "a1", [rec])
    assert run(layout, vocab).held == 1
    rec["sources"][0]["fields"] = ["requirements.court_ordered_ok"]
    write_inbox(layout, "w2", "a1", [rec])
    assert run(layout, vocab, "w2").created == 1


def test_a_lower_tier_record_does_not_overwrite_a_higher_tier(layout, vocab):
    write_inbox(
        layout,
        "w1",
        "deep",
        [
            good_record(
                research_tier=2,
                summary="Deep summary of the club.",
                first_step={
                    "how": "Come to a meeting",
                    "newcomer_friendliness": 4,
                    "basis": "site",
                },
            )
        ],
    )
    run(layout, vocab, "w1")
    write_inbox(
        layout,
        "w2",
        "basic",
        [
            good_record(
                research_tier=1,
                summary="A shallower summary that must not win.",
                cost={"level": "paid", "text": "A fee"},
                group_size="small",
            )
        ],
    )
    run(layout, vocab, "w2")
    group = GroupStore(layout.groups_dir).read("philadelphia-grotto")
    assert group["summary"] == "Deep summary of the club."
    assert group["research_tier"] == 2
    assert group["group_size"] == "small"  # empty before, so it fills
    assert group["cost"]["level"] == "low"  # kept from the deeper pass


def test_verdicts_hide_not_a_group_duplicate_and_out_of_area(layout, vocab):
    make_group(layout, "survivor", "The Real Club", leads=["a:1"])
    make_group(layout, "twin", "Real Club Twin", leads=["b:1"])
    make_group(layout, "shop", "A Shop", leads=["c:1"])
    make_group(layout, "faraway", "Pittsburgh Group", leads=["d:1"])
    src = [{"url": "https://x.org/p", "seen": "2026-10-05", "fields": []}]
    records = [
        {
            "verdict": "duplicate",
            "name": "Real Club Twin",
            "match": {"lead_ids": ["b:1"], "group_id": "survivor"},
            "sources": src,
        },
        {
            "verdict": "not_a_group",
            "name": "A Shop",
            "match": {"lead_ids": ["c:1"]},
            "sources": src,
        },
        {
            "verdict": "out_of_area",
            "name": "Pittsburgh Group",
            "match": {"lead_ids": ["d:1"]},
            "sources": src,
        },
        {
            "verdict": "hide",
            "name": "Private Chat",
            "hidden_reason": "private",
            "match": {"lead_ids": []},
            "sources": src,
        },
    ]
    write_inbox(layout, "w1", "a1", records)
    summary = run(layout, vocab)
    assert summary.held == 0
    store = GroupStore(layout.groups_dir)
    assert store.read("twin")["hidden_reason"] == "duplicate"
    assert store.read("survivor")["leads"] == ["a:1", "b:1"]
    assert "Real Club Twin" in store.read("survivor")["aka"]
    assert store.read("shop")["hidden_reason"] == "out_of_scope"
    assert store.read("faraway")["hidden"] is True
    private = store.read("private-chat")
    assert private["hidden"] and private["hidden_reason"] == "private"


def test_duplicate_without_a_real_survivor_is_held(layout, vocab):
    src = [{"url": "https://x.org/p", "seen": "2026-10-05", "fields": []}]
    write_inbox(
        layout,
        "w1",
        "a1",
        [{"verdict": "duplicate", "name": "X", "match": {"group_id": "nope"}, "sources": src}],
    )
    assert run(layout, vocab).held == 1


def test_research_beats_triage_and_the_summary_says_so(layout, vocab):
    layout.triage_path.write_text(
        json.dumps({"lead_id": "irs:1", "decision": "reject", "reason": "private_foundation"})
        + "\n",
        encoding="utf-8",
    )
    write_inbox(layout, "w1", "a1", [good_record(match={"lead_ids": ["irs:1"]})])
    summary = run(layout, vocab)
    assert summary.created == 1 and summary.over_triage == 1
    group = GroupStore(layout.groups_dir).read("philadelphia-grotto")
    assert group["leads"] == ["irs:1"]
    assert any("triage had rejected" in line for line in summary.lines())


def test_blocklisted_leads_are_held(layout, vocab):
    layout.blocklist_path.write_text("leads: ['irs:1']\ngroups: []\n", encoding="utf-8")
    write_inbox(layout, "w1", "a1", [good_record(match={"lead_ids": ["irs:1"]})])
    assert run(layout, vocab).held == 1


def test_a_group_hidden_for_a_removal_request_is_never_unhidden(layout, vocab):
    make_group(
        layout,
        "philadelphia-grotto",
        "Philadelphia Grotto",
        hidden=True,
        hidden_reason="removal_request",
    )
    write_inbox(layout, "w1", "a1", [good_record(match={"group_id": "philadelphia-grotto"})])
    assert run(layout, vocab).held == 1
    assert GroupStore(layout.groups_dir).read("philadelphia-grotto")["hidden"] is True


def test_dry_run_changes_nothing(layout, vocab):
    write_inbox(layout, "w1", "a1", [good_record()])
    summary = run(layout, vocab, dry_run=True)
    assert summary.created == 1
    assert GroupStore(layout.groups_dir).ids() == set()
    assert (layout.inbox_dir("w1") / "a1.json").exists()


def test_a_broken_file_is_held_whole(layout, vocab):
    folder = layout.inbox_dir("w1")
    folder.mkdir(parents=True)
    (folder / "broken.json").write_text("{not json", encoding="utf-8")
    summary = run(layout, vocab)
    assert summary.held == 1
    assert (layout.held_dir("w1") / "broken.reasons.txt").exists()


def test_a_bare_list_of_records_is_accepted(layout, vocab):
    folder = layout.inbox_dir("w1")
    folder.mkdir(parents=True)
    (folder / "list.json").write_text(json.dumps([good_record()]), encoding="utf-8")
    assert run(layout, vocab).created == 1


def test_slug_collisions_use_zip_or_neighborhood(layout, vocab):
    make_group(
        layout, "friends-of-the-park", "Friends of the Park", locations=[location(zip="19130")]
    )
    rec = good_record(
        name="Friends of the Park",
        contacts={"website": None},
        locations=[{"zip": "19104", "neighborhood": "university_city"}],
    )
    write_inbox(layout, "w1", "a1", [rec])
    run(layout, vocab)
    assert "friends-of-the-park-university-city" in GroupStore(layout.groups_dir).ids()


def test_importing_the_same_record_twice_changes_nothing(layout, vocab):
    write_inbox(layout, "w1", "a1", [good_record()])
    run(layout, vocab)
    store = GroupStore(layout.groups_dir)
    before = store.path_for("philadelphia-grotto").read_text(encoding="utf-8")
    write_inbox(layout, "w1", "a1", [good_record()])
    run(layout, vocab)
    assert store.path_for("philadelphia-grotto").read_text(encoding="utf-8") == before
    assert len(store.ids()) == 1


def test_community_faith_and_languages_are_mapped_through_the_vocabulary(layout, vocab):
    rec = good_record(
        audience={
            "open_to": "public",
            "community": "Veterans, Irish, heritage:Polish, Klingon",
            "faith": "Catholic",
        },
        access={"languages": "Spanish, en, Klingon"},
    )
    write_inbox(layout, "w1", "a1", [rec])
    summary = run(layout, vocab)
    assert summary.created == 1
    group = GroupStore(layout.groups_dir).read("philadelphia-grotto")
    assert group["audience"]["community"] == ["veterans", "heritage:irish", "heritage:polish"]
    assert group["audience"]["faith"] == "catholic"
    assert group["access"]["languages"] == ["es", "en"]


def test_a_support_recovery_group_is_flagged_as_a_support_group(layout, vocab):
    rec = good_record(
        name="Tuesday Recovery Circle",
        kind="support_group",
        categories=["support-recovery"],
        interests=["recovery_meetings"],
        contacts={"website": None},
    )
    write_inbox(layout, "w1", "a1", [rec])
    assert run(layout, vocab).created == 1
    group = GroupStore(layout.groups_dir).read("tuesday-recovery-circle")
    assert group["audience"]["support_group"] is True


def sign_of_life(layout, vocab, **over):
    """Import one record and return the group, with the repairs the importer made."""
    write_inbox(layout, "w1", "a1", [good_record(**over)])
    summary = run(layout, vocab)
    assert summary.held == 0, summary.held_reasons
    return GroupStore(layout.groups_dir).read("philadelphia-grotto")


def test_a_year_only_sign_of_life_is_kept_as_the_year(layout, vocab):
    group = sign_of_life(layout, vocab, last_sign_of_life="2026")
    assert group["last_sign_of_life"] == "2026"
    assert group["status"] == "active"  # a bare year counts as January: nine months before today


def test_a_full_date_is_cut_to_the_month(layout, vocab):
    group = sign_of_life(layout, vocab, last_sign_of_life="2026-09-12")
    assert group["last_sign_of_life"] == "2026-09"
    assert (
        sign_of_life(layout, vocab, last_sign_of_life="September 3, 2026")["last_sign_of_life"]
        == "2026-09"
    )


def test_a_planned_event_is_not_a_past_sign_of_life(layout, vocab):
    group = sign_of_life(layout, vocab, last_sign_of_life="2026-12")
    assert group["last_sign_of_life"] == "2026-10"


def test_active_without_a_supporting_date_is_lowered_not_held(layout, vocab):
    old = sign_of_life(layout, vocab, last_sign_of_life="2025-05")
    assert old["status"] == "probably_active"
    undated = sign_of_life(layout, vocab, last_sign_of_life=None)
    assert undated["status"] == "probably_active" and undated["last_sign_of_life"] == "2025-05"
    # a year only date from last year is 21 months old by the January rule
    year = sign_of_life(
        layout,
        vocab,
        last_sign_of_life="2025",
        name="Other Club",
        contacts={"website": "https://other.org"},
    )
    assert year is not None


def test_probably_active_may_be_undated_and_takes_the_cited_site_as_its_url(layout, vocab):
    group = sign_of_life(
        layout, vocab, status="probably_active", last_sign_of_life=None, sign_of_life_url=None
    )
    assert group["last_sign_of_life"] is None
    assert group["status"] == "probably_active"
    assert group["sign_of_life_url"] == "https://phillygrotto.org"


def test_unknown_status_with_a_date_takes_its_status_from_the_date(layout, vocab):
    group = sign_of_life(layout, vocab, status="unknown", last_sign_of_life="2024-10")
    assert group["status"] == "probably_active"  # 24 months before October 2026
    assert group["last_sign_of_life"] == "2024-10"


def test_an_invented_group_id_creates_nothing_under_that_id(layout, vocab):
    make_group(layout, "real-group", "Some Other Group")
    rec = good_record(
        match={
            "group_id": "philadelphia-grotto-club",
            "lead_ids": [],
            "website": "https://phillygrotto.org",
        }
    )
    write_inbox(layout, "w1", "a1", [rec])
    summary = run(layout, vocab)
    assert (summary.created, summary.held) == (1, 0)
    ids = GroupStore(layout.groups_dir).ids()
    assert "philadelphia-grotto-club" not in ids and "philadelphia-grotto" in ids


def test_an_invented_group_id_falls_through_to_lead_ids_and_the_website(layout, vocab):
    make_group(layout, "by-lead", "Grotto Old", leads=["nss:1"])
    make_group(layout, "by-site", "Other", contacts={"website": "https://www.otherclub.org/x"})
    rec = good_record(match={"group_id": "made-up", "lead_ids": ["nss:1"]})
    write_inbox(layout, "w1", "a1", [rec])
    run(layout, vocab)
    assert GroupStore(layout.groups_dir).read("by-lead")["research_tier"] == 1
    rec = good_record(
        name="Another Name",
        contacts={"website": None},
        match={"group_id": "made-up", "lead_ids": [], "website": "https://otherclub.org"},
    )
    write_inbox(layout, "w2", "a1", [rec])
    assert run(layout, vocab, "w2").merged == 1
    assert GroupStore(layout.groups_dir).read("by-site")["name"] == "Another Name"


def test_real_haiku_output_shapes_import_with_the_expected_repairs(layout, vocab):
    """A trimmed sample of real agent output: invented group ids, an undated probably_active
    status with no sign_of_life_url, extra keys such as notes, and a record with no audience."""
    folder = layout.inbox_dir("w2")
    folder.mkdir(parents=True)
    sample = (FIXTURES_DIR / "inbox_haiku_sample.json").read_text(encoding="utf-8")
    (folder / "p5.json").write_text(sample, encoding="utf-8")
    summary = run(layout, vocab, "w2")
    assert (summary.records_in, summary.created, summary.held) == (3, 2, 1)
    ids = GroupStore(layout.groups_dir).ids()
    assert ids == {
        "appalachian-mountain-club-delaware-valley-chapter",
        "philadelphia-canoe-club",
    }
    amc = GroupStore(layout.groups_dir).read("appalachian-mountain-club-delaware-valley-chapter")
    assert amc["status"] == "probably_active" and amc["last_sign_of_life"] is None
    assert amc["sign_of_life_url"] == "https://www.amcdv.org"
    assert amc["interests"] == ["hiking", "kayaking", "camping", "trail_building"]
    held = json.loads((layout.held_dir("w2") / "p5.json").read_text(encoding="utf-8"))
    (record,) = held["records"]
    assert "audience.open_to is required to publish" in record["_held_reasons"]

import json

import yaml
from helpers import lead, write_leads

from fyj.checks import run_checks
from fyj.city_tier1 import (
    PROFILES,
    PROGRAM_PROFILES,
    WAVE,
    generate,
    write_inbox_files,
)
from fyj.cli import main
from fyj.groupfile import GroupStore
from fyj.merge import run_merge
from fyj.research_import import import_wave
from fyj.vocab import load_vocab

TODAY = "2026-10-08"


def full_vocab_dir(layout):
    """The fixture vocabulary plus every family and tag the City profiles ask for, so the
    generator tests do not depend on the real vocabulary."""
    families: dict[str, set[str]] = {}
    tables = [{"categories": p.categories, "interests": p.interests} for p in PROFILES.values()] + [
        {"categories": p["categories"], "interests": p["interests"]}
        for p in PROGRAM_PROFILES.values()
    ]
    for table in tables:
        for family in table["categories"]:
            families.setdefault(family, set())
        for tag in table["interests"]:
            families[table["categories"][0]].add(tag)
    data = {
        "families": [
            {"id": fam, "label": fam, "tags": [{"id": t, "label": t} for t in sorted(tags)]}
            for fam, tags in sorted(families.items())
        ]
    }
    (layout.vocab_dir / "interests.yaml").write_text(yaml.safe_dump(data), encoding="utf-8")
    (layout.vocab_dir / "audiences.yaml").write_text(
        yaml.safe_dump(
            {
                "crowd": [
                    {"id": i}
                    for i in (
                        "all_ages",
                        "all_adults",
                        "seniors",
                        "neighbors",
                        "kids",
                        "teens",
                        "young_adults",
                        "families",
                    )
                ]
            }
        ),
        encoding="utf-8",
    )
    fmt = yaml.safe_load((layout.vocab_dir / "formats.yaml").read_text(encoding="utf-8"))
    fmt["formats"] += [{"id": "perform_make_together"}, {"id": "lead_organize"}]
    return load_vocab(layout.vocab_dir)


def write_city_leads(layout):
    write_leads(
        layout,
        "city_rco",
        [
            lead(
                "city_rco",
                "1",
                "Fairmount Civic Association",
                kind_hint="civic",
                zip="19130",
                address="1 Main St",
                lat=39.97,
                lng=-75.17,
                email="info@fairmount.org",
                extra={"org_type": "Other"},
            ),
            lead(
                "city_rco",
                "2",
                "10th Democratic Ward",
                kind_hint="civic",
                zip="19126",
                extra={"org_type": "Ward"},
            ),
        ],
    )
    write_leads(
        layout,
        "city_rec",
        [
            lead(
                "city_rec",
                "1",
                "Olney Recreation Center",
                kind_hint="facility",
                zip="19120",
                address="100 Olney Ave",
                tags_hint=["Land", "Recreation Center"],
            ),
            lead(
                "city_rec",
                "2",
                "Markward Playground",
                kind_hint="facility",
                zip="19103",
                tags_hint=["Land", "Recreation Site"],
            ),
        ],
    )
    write_leads(
        layout,
        "city_libraries",
        [
            lead(
                "city_libraries",
                "1",
                "Andorra",
                kind_hint="facility",
                zip="19128",
                address="705 East Cathedral Road",
            ),
        ],
    )
    write_leads(
        layout,
        "city_senior",
        [
            lead(
                "city_senior",
                "pca:1",
                "Journey's Way Center",
                kind_hint="facility",
                zip="19128",
                address="403 Rector Street",
            ),
            lead(
                "city_senior",
                "sites:9",
                "Journeys Way Center",
                kind_hint="facility",
                zip="19128",
                address="403 Rector St",
            ),
        ],
    )
    write_leads(
        layout,
        "city_gardens",
        [
            lead(
                "city_gardens",
                "1",
                "Emily Community Garden",
                kind_hint="garden",
                zip="19148",
                address="742 Emily St",
            ),
        ],
    )
    write_leads(
        layout,
        "city_nac",
        [
            lead(
                "city_nac",
                "1",
                "Achieveability",
                kind_hint="civic",
                zip="19139",
                address="5901 Market St",
                website="achieveability.org",
            ),
        ],
    )
    write_leads(
        layout,
        "city_friends",
        [
            lead(
                "city_friends",
                "7",
                "Friends of Clark Park",
                kind_hint="friends_group",
                zip="19104",
                extra={"parent_name": "Clark Park"},
            ),
        ],
    )
    write_leads(
        layout,
        "city_programs",
        [
            lead(
                "city_programs",
                "philly-reading-coaches",
                "Philly Reading Coaches",
                kind_hint="program",
                website="http://ost.phila.gov/philly-reading-coaches/",
            ),
            lead(
                "city_programs", "soak-it-up-adoption", "Soak It Up Adoption", kind_hint="program"
            ),
            lead(
                "city_programs",
                "citizens-police-academy",
                "Citizens Police Academy",
                kind_hint="program",
            ),
            lead(
                "city_programs",
                "recreation-advisory-councils",
                "Recreation Advisory Councils",
                kind_hint="program",
            ),
        ],
    )
    write_leads(
        layout,
        "city_volunteer_portal",
        [
            lead(
                "city_volunteer_portal",
                "177491",
                "City of Philadelphia - Philly Reading Coaches",
                kind_hint="program",
                extra={"agency_id": "177491"},
            ),
            lead(
                "city_volunteer_portal",
                "186276",
                "Community Schools @Frankford High School",
                kind_hint="program",
                address="5000 Oxford Ave Philadelphia , PA 19124",
                email="a@phila.gov",
                extra={"agency_id": "186276"},
            ),
            lead(
                "city_volunteer_portal",
                "9",
                "PRC @ Anderson",
                kind_hint="opportunity",
                extra={
                    "agency_id": "186276",
                    "requirements": [
                        "16 and older",
                        "Requires: PA Child Abuse History Clearance",
                        "Requires: PA State Criminal Background Check",
                    ],
                },
            ),
        ],
    )
    (layout.seeds_dir).mkdir(parents=True, exist_ok=True)
    (layout.seeds_dir / "city_programs.yaml").write_text(
        yaml.safe_dump(
            {
                "programs": [
                    {
                        "name": "Philly Reading Coaches",
                        "url": "http://ost.phila.gov/philly-reading-coaches/",
                        "signup_url": "https://example.org/signup",
                        "what": "Pairs a trained volunteer with a "
                        "young student for weekly one on one reading.",
                        "who_can_join": "16 or older",
                        "commitment": "weekly",
                        "training": "Yes: an orientation",
                        "clearances": "PA Child Abuse History Clearance, criminal background check",
                        "season": "School year",
                        "evidence_date": "2026-10",
                        "notes": "n",
                    },
                    {
                        "name": "Soak It Up Adoption",
                        "url": "https://water.phila.gov/adoption/",
                        "what": "A grant.",
                        "who_can_join": "organizations",
                        "evidence_date": "2026",
                    },
                    {
                        "name": "Citizens Police Academy",
                        "url": "https://example.org/cpa",
                        "what": "A ten week evening course that teaches residents how police work.",
                        "who_can_join": "unknown, not confirmed",
                        "commitment": "weekly",
                        "clearances": "unknown",
                        "training": "n/a",
                        "evidence_date": "2023-08",
                        "notes": "from indexed search text",
                    },
                    {
                        "name": "Recreation Advisory Councils",
                        "url": "https://example.org/rac",
                        "what": "Lets anyone join the advisory council of a recreation center.",
                        "who_can_join": "Any resident",
                        "commitment": "monthly",
                        "evidence_date": "2024-02",
                        "notes": "A page we read ourselves.",
                    },
                ]
            }
        ),
        encoding="utf-8",
    )


def test_generator_writes_one_record_per_group_with_the_documented_shape(layout):
    vocab = full_vocab_dir(layout)
    write_city_leads(layout)
    run_merge(layout)
    out = generate(layout, vocab, today=TODAY)
    assert not out.unresolved
    counts = {agent: len(p["records"]) for agent, p in out.files.items()}
    assert counts == {
        "city-rco": 2,
        "city-rec": 1,
        "city-libraries": 1,
        "city-senior": 1,
        "city-gardens": 1,
        "city-nac": 1,
        "city-friends": 1,
        "city-programs": 3,
        "city-volunteer-portal": 2,
    }
    rco = next(r for r in out.files["city-rco"]["records"] if r["verdict"] == "publish")
    assert rco["match"]["lead_ids"] == ["city_rco:1"]
    assert rco["research_tier"] == 1 and rco["confidence"] == "medium"
    assert rco["status"] == "active" and rco["last_sign_of_life"] == "2026-10"
    assert rco["sign_of_life_url"] == "https://example.org/city_rco"
    assert rco["sources"][0]["seen"] == TODAY
    assert rco["kind"] == "civic" and rco["categories"] == ["neighborhood-civic"]
    assert "Fairmount Civic Association" in rco["summary"]
    assert out.files["city-rco"]["model"] == "script"


def test_partisan_wards_become_hide_records_and_parks_are_left_out(layout):
    vocab = full_vocab_dir(layout)
    write_city_leads(layout)
    run_merge(layout)
    out = generate(layout, vocab, today=TODAY)
    hidden = [r for r in out.files["city-rco"]["records"] if r["verdict"] == "hide"]
    assert [(r["name"], r["hidden_reason"]) for r in hidden] == [
        ("10th Democratic Ward", "partisan")
    ]
    recs = [r["name"] for r in out.files["city-rec"]["records"]]
    assert recs == ["Olney Recreation Center"]
    assert any("1 of 2 records are real recreation centers" in n for n in out.notes)


def test_the_two_senior_center_lists_become_one_record(layout):
    vocab = full_vocab_dir(layout)
    write_city_leads(layout)
    out = generate(layout, vocab, today=TODAY)
    (record,) = out.files["city-senior"]["records"]
    assert record["match"]["lead_ids"] == ["city_senior:pca:1", "city_senior:sites:9"]


def test_programs_are_mapped_with_ages_clearances_status_and_skips(layout):
    vocab = full_vocab_dir(layout)
    write_city_leads(layout)
    out = generate(layout, vocab, today=TODAY)
    records = {r["name"]: r for r in out.files["city-programs"]["records"]}
    prc = records["Philly Reading Coaches"]
    assert prc["audience"] == {"open_to": "public", "min_age": 16}
    assert prc["requirements"] == {"act153_clearances": True, "background_check": True}
    assert prc["status"] == "active" and prc["last_sign_of_life"] == "2026-10"
    assert prc["commitment"] == "weekly"
    assert prc["first_step"]["how"] == "Use the sign up form at https://example.org/signup."
    assert "Training: Yes: an orientation." in prc["first_step"]["what_to_expect"]
    cpa = records["Citizens Police Academy"]
    assert cpa["status"] == "dormant"  # evidence from 2023-08 is over 24 months old
    assert cpa["confidence"] == "low"
    assert "requirements" in cpa and cpa["requirements"] == {}
    # a City page we read ourselves with an old update date is probably active, not dormant
    rac = records["Recreation Advisory Councils"]
    assert rac["status"] == "probably_active" and rac["confidence"] == "medium"
    assert "Soak It Up Adoption" not in records
    assert any("organization level grant" in k for k in out.skipped)


def test_portal_programs_carry_requirements_and_the_reading_coaches_duplicate_is_marked(layout):
    vocab = full_vocab_dir(layout)
    write_city_leads(layout)
    run_merge(layout)
    out = generate(layout, vocab, today=TODAY)
    records = out.files["city-volunteer-portal"]["records"]
    school = next(r for r in records if r["verdict"] == "publish")
    assert school["name"] == "Community Schools @Frankford High School"
    assert school["audience"]["min_age"] == 16
    assert school["requirements"] == {"act153_clearances": True, "background_check": True}
    assert school["locations"][0]["label"] == "School"
    dup = next(r for r in records if r["verdict"] == "duplicate")
    survivor = GroupStore(layout.groups_dir).ids()
    assert dup["match"]["group_id"] in survivor
    assert dup["match"]["lead_ids"] == ["city_volunteer_portal:177491"]


def test_without_a_merge_the_duplicate_is_skipped_not_guessed(layout):
    vocab = full_vocab_dir(layout)
    write_city_leads(layout)
    out = generate(layout, vocab, today=TODAY)
    records = out.files["city-volunteer-portal"]["records"]
    assert [r["verdict"] for r in records] == ["publish"]
    assert any("run fyj merge first" in k for k in out.skipped)


def test_unknown_vocabulary_ids_are_reported_and_dropped(layout, vocab):
    write_city_leads(layout)
    out = generate(layout, vocab, today=TODAY, only={"nac"})
    assert any(item.startswith("interest community_development") for item in out.unresolved)
    (record,) = out.files["city-nac"]["records"]
    assert record["categories"] == ["neighborhood-civic"]
    # "civic_association" is not in the fixture vocabulary, but its synonym list maps it
    assert record["interests"] == ["neighborhood_association"]


def test_summaries_are_stable_between_runs_and_vary_between_groups(layout):
    vocab = full_vocab_dir(layout)
    leads = [
        lead(
            "city_libraries",
            str(i),
            f"Branch {i}",
            kind_hint="facility",
            zip="19128",
            address=f"{i} Main St",
        )
        for i in range(12)
    ]
    write_leads(layout, "city_libraries", leads)
    first = generate(layout, vocab, today=TODAY, only={"libraries"})
    second = generate(layout, vocab, today=TODAY, only={"libraries"})
    texts = [r["summary"].replace(r["name"], "X") for r in first.files["city-libraries"]["records"]]
    assert texts == [
        r["summary"].replace(r["name"], "X") for r in second.files["city-libraries"]["records"]
    ]
    assert len(set(texts)) > 1


def test_end_to_end_merge_generate_import_check_all_pass(layout):
    vocab = full_vocab_dir(layout)
    write_city_leads(layout)
    run_merge(layout)
    out = generate(layout, vocab, today=TODAY)
    write_inbox_files(layout, out)
    summary = import_wave(layout, WAVE, vocab, today=TODAY)
    assert summary.held == 0, summary.held_reasons
    assert summary.by_verdict["publish"] > 0
    report = run_checks(layout, vocab, pages_dir=layout.root / "no-pages")
    assert report.counts["held"] == 0
    assert report.counts == {
        "groups": 14,
        "hidden": 2,
        "tier0": 1,
        "checked": 11,
        "passed": 11,
        "held": 0,
    }
    store = GroupStore(layout.groups_dir)
    group = next(g for g in store.iter_groups() if g["name"] == "Fairmount Civic Association")
    assert group["research_tier"] == 1 and group["status"] == "active"
    ward = next(g for g in store.iter_groups() if g["name"] == "10th Democratic Ward")
    assert ward["hidden"] and ward["hidden_reason"] == "partisan"
    # the duplicate portal listing is hidden and folded into the program
    prc = next(g for g in store.iter_groups() if g["name"] == "Philly Reading Coaches")
    assert "city_volunteer_portal:177491" in prc["leads"]


def test_cli_city_tier1_writes_the_wave(layout, monkeypatch, capsys):
    full_vocab_dir(layout)
    write_city_leads(layout)
    monkeypatch.setenv("FYJ_ROOT", str(layout.root))
    main(["city-tier1", "--only", "nac,gardens"])
    out = capsys.readouterr().out
    assert "2 City records written" in out
    names = sorted(p.name for p in layout.inbox_dir(WAVE).glob("*.json"))
    assert names == ["city-gardens.json", "city-nac.json"]
    payload = json.loads((layout.inbox_dir(WAVE) / "city-nac.json").read_text(encoding="utf-8"))
    assert payload["wave"] == WAVE and payload["model"] == "script"


def test_a_group_on_several_city_lists_gets_one_record_under_the_most_specific_list(layout):
    vocab = full_vocab_dir(layout)
    write_leads(
        layout,
        "city_rco",
        [
            lead(
                "city_rco",
                "9",
                "Friends of Clark Park",
                kind_hint="civic",
                zip="19104",
                email="rco@clark.org",
                extra={"org_type": "Other"},
            ),
            lead(
                "city_rco",
                "10",
                "Tioga United, Inc.",
                kind_hint="civic",
                zip="19140",
                extra={"org_type": "Other"},
            ),
        ],
    )
    write_leads(
        layout,
        "city_friends",
        [
            lead(
                "city_friends",
                "745",
                "Friends of Clark Park",
                kind_hint="friends_group",
                zip="19104",
                website="https://clark.org",
                extra={"parent_name": "Clark Park"},
            ),
        ],
    )
    write_leads(
        layout,
        "city_nac",
        [
            lead("city_nac", "22", "Tioga United, Inc.", kind_hint="civic", zip="19140"),
        ],
    )
    run_merge(layout)
    out = generate(layout, vocab, today=TODAY)
    assert sorted(out.files) == ["city-friends", "city-nac"]
    (friends,) = out.files["city-friends"]["records"]
    assert friends["match"]["lead_ids"] == ["city_friends:745", "city_rco:9"]
    assert friends["kind"] == "friends_group"
    assert "also a registered community organization" in friends["summary"]
    assert friends["contacts"]["website"] == "https://clark.org"
    assert friends["contacts"]["email"] == "rco@clark.org"  # filled from the other list
    assert len(friends["sources"]) == 2
    (nac,) = out.files["city-nac"]["records"]
    assert nac["match"]["lead_ids"] == ["city_nac:22", "city_rco:10"]
    assert nac["kind"] == "civic"
    assert "also a registered community organization" in nac["summary"]
    write_inbox_files(layout, out)
    summary = import_wave(layout, WAVE, vocab, today=TODAY)
    assert summary.held == 0, summary.held_reasons
    assert len(list(GroupStore(layout.groups_dir).ids())) == 2

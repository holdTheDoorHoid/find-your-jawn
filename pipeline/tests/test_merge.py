import json

import yaml
from helpers import good_record, lead, write_inbox, write_leads

from fyj.cli import main
from fyj.groupfile import GroupStore
from fyj.merge import run_merge
from fyj.triage import TriageContext, decide, is_rec_center


def bmf(ein, name, *, sub="03", foundation="15", zip="19104", ntee=None, **kw):
    return lead(
        "irs_bmf",
        ein,
        name,
        ein=ein,
        irs_subsection=sub,
        irs_status="01",
        zip=zip,
        city="PHILADELPHIA",
        address="1 MAIN ST",
        kind_hint="nonprofit",
        ntee=ntee,
        extra={"foundation": foundation},
        **kw,
    )


def n990(ein, name, *, terminated="F", zip="19104", **kw):
    return lead(
        "irs_990n",
        ein,
        name,
        ein=ein,
        zip=zip,
        kind_hint="nonprofit",
        extra={"terminated": terminated, "tax_year": "2024"},
        **kw,
    )


def triage_reasons(layout):
    if not layout.triage_path.exists():
        return {}
    rows = [json.loads(x) for x in layout.triage_path.read_text(encoding="utf-8").splitlines()]
    return {r["lead_id"]: r["reason"] for r in rows}


def ctx(**kw):
    return TriageContext(**kw)


# -- triage rules --------------------------------------------------------------------------------


def test_private_foundation_codes_are_rejected():
    for code in ("02", "03", "04"):
        assert decide(bmf("1", "ABC FAMILY FOUNDATION", foundation=code), ctx())[0] == (
            "private_foundation"
        )
    assert decide(bmf("1", "ABC FAMILY FOUNDATION", foundation="15"), ctx()) is None
    assert decide(bmf("1", "SOMETHING", foundation="09"), ctx()) is None


def test_subsections_that_are_never_joinable_are_rejected():
    for sub in ("01", "02", "09", "13", "14", "15", "21", "25"):
        name = "IVY HILL CEMETERY COMPANY" if sub == "13" else "SOMETHING FUND"
        verdict = decide(bmf("1", name, sub=sub, foundation="00"), ctx())
        assert verdict and verdict[0] == "never_joinable", sub
    # clubs, lodges, veterans posts, civic leagues and chambers stay
    for sub in ("04", "05", "06", "07", "08", "10", "19", "23", "40"):
        assert decide(bmf("1", "SOME CLUB", sub=sub, foundation="00"), ctx()) is None, sub


def test_subsection_13_on_an_ordinary_association_is_a_miscode_and_is_kept():
    lead_ = bmf("1", "PENNSYLVANIA CHINESE SENIOR CITIZEN ASSOCIATION", sub="13", foundation="00")
    assert decide(lead_, ctx()) is None


def test_name_rules_for_condos_homeowners_cemeteries_and_scholarship_funds():
    assert decide(bmf("1", "EASTERN TOWER CONDOMINIUM ASSOCIATION", sub="04"), ctx())[0] == (
        "condo_association"
    )
    assert decide(bmf("1", "MADISON COURT HOMEOWNERS ASSOC", sub="04"), ctx())[0] == (
        "homeowners_association"
    )
    assert decide(bmf("1", "KENSINGTON BURIAL GROUND PALMER CEMETARY ASSOCIATION"), ctx())[0] == (
        "cemetery"
    )
    assert decide(bmf("1", "FRIENDS OF MOUNT MORIAH CEMETERY INC"), ctx()) is None
    assert decide(bmf("1", "JOHN FOX SCHOLARSHIP FUND"), ctx())[0] == "scholarship_fund"
    assert decide(bmf("1", "KATIE KIRLIN MEMORIAL CHARITABLE TRUST"), ctx())[0] == "trust"
    assert decide(bmf("1", "NEIGHBORHOOD GARDENS TRUST"), ctx()) is None
    assert decide(bmf("1", "SEGER PARK DOG OWNERS ASSOCIATION"), ctx()) is None


def test_church_building_corporations_are_rejected_but_congregations_are_kept():
    assert decide(bmf("1", "ST JOHNS CHURCH BUILDING CORP"), ctx())[0] == (
        "church_building_corporation"
    )
    kept = bmf("2", "ST JOHNS BAPTIST CHURCH", foundation="10", ntee="X20")
    assert decide(kept, ctx()) is None


def test_partisan_leads_are_rejected():
    ward = lead("city_rco", "1", "10th Democratic Ward", extra={"org_type": "Ward"})
    assert decide(ward, ctx())[0] == "partisan"
    named = lead("manual_seeds", "x", "Young Republicans of Philadelphia")
    assert decide(named, ctx())[0] == "partisan"
    other_rco = lead("city_rco", "2", "Fairmount Civic Association", extra={"org_type": "Other"})
    assert decide(other_rco, ctx()) is None


def test_opportunities_and_non_rec_center_sites_are_rejected():
    assert (
        decide(
            lead("city_volunteer_portal", "1", "PRC @ Anderson", kind_hint="opportunity"), ctx()
        )[0]
        == "not_a_group"
    )
    park = lead("city_rec", "1", "Markward Playground", tags_hint=["Land", "Recreation Site"])
    center = lead(
        "city_rec", "2", "Olney Recreation Center", tags_hint=["Land", "Recreation Center"]
    )
    odd = lead(
        "city_rec",
        "3",
        "East Passyunk Community Recreation Center",
        tags_hint=["Land", "Recreation Site"],
    )
    assert decide(park, ctx())[0] == "not_a_group"
    assert decide(center, ctx()) is None
    assert decide(odd, ctx()) is None
    assert is_rec_center(center) and not is_rec_center(park)


def test_terminated_990n_is_rejected_unless_the_master_file_still_lists_it():
    terminated = n990("123456789", "OLD CLUB INC", terminated="T")
    assert decide(terminated, ctx())[0] == "terminated"
    assert decide(terminated, ctx(bmf_eins={"123456789"})) is None


# -- merging -------------------------------------------------------------------------------------


def groups(layout):
    return {g["id"]: g for g in GroupStore(layout.groups_dir).iter_groups()}


def test_same_ein_across_sources_becomes_one_group(layout):
    write_leads(layout, "irs_bmf", [bmf("111111111", "FAIRMOUNT CIVIC ASSN")])
    write_leads(layout, "irs_990n", [n990("111111111", "FAIRMOUNT CIVIC ASSOCIATION INC")])
    result = run_merge(layout)
    assert result.created == 1
    (group,) = groups(layout).values()
    assert group["leads"] == ["irs_990n:111111111", "irs_bmf:111111111"]
    assert group["ein"] == "111111111"
    assert group["name"] == "Fairmount Civic Assn"  # IRS capitals re-cased
    assert group["research_tier"] == 0 and group["status"] == "unknown"
    assert group["kind"] == "nonprofit"
    assert group["locations"][0]["label"] == "Mailing address (IRS)"
    assert group["locations"][0]["address"] == "1 Main St"
    assert group["locations"][0]["in_city"] is True
    assert {s["url"] for s in group["sources"]} == {
        "https://example.org/irs_bmf",
        "https://example.org/irs_990n",
    }


def test_name_and_zip_merge_across_sources_and_the_city_name_wins(layout):
    write_leads(layout, "irs_bmf", [bmf("222222222", "FAIRMOUNT CIVIC ASSN", zip="19130")])
    write_leads(
        layout,
        "city_rco",
        [
            lead(
                "city_rco",
                "7",
                "Fairmount Civic Association",
                kind_hint="civic",
                zip="19130",
                email="info@fairmount.org",
                contact_name="Pat Smith",
                extra={"org_type": "Other"},
            )
        ],
    )
    run_merge(layout)
    (group,) = groups(layout).values()
    assert group["name"] == "Fairmount Civic Association"
    assert group["kind"] == "civic"
    assert group["contacts"]["email"] == "info@fairmount.org"
    assert group["contacts"]["contact_name"] == "Pat Smith"
    assert len(group["leads"]) == 2


def test_website_domain_merges_but_platform_domains_do_not(layout):
    write_leads(
        layout,
        "cultural_fund",
        [
            lead(
                "cultural_fund", "a", "Orchard Collective", website="http://www.orchard.org/about"
            ),
            lead("cultural_fund", "b", "The Orchard Project", website="https://orchard.org"),
            lead("cultural_fund", "c", "Alpha Club", website="https://www.facebook.com/alpha"),
            lead("cultural_fund", "d", "Beta Club", website="https://www.facebook.com/beta"),
        ],
    )
    result = run_merge(layout)
    assert result.created == 3
    names = sorted(g["name"] for g in groups(layout).values())
    assert names == ["Alpha Club", "Beta Club", "Orchard Collective"]


def test_different_eins_are_never_merged_even_with_the_same_name_and_zip(layout):
    write_leads(
        layout,
        "irs_bmf",
        [bmf("333333333", "RIVER WARDS CLUB"), bmf("444444444", "RIVER WARDS CLUB")],
    )
    assert run_merge(layout).created == 2


def test_a_lead_without_a_zip_joins_the_one_group_with_its_name(layout):
    write_leads(layout, "irs_bmf", [bmf("555555555", "MURAL ARTS PHILADELPHIA", zip="19107")])
    write_leads(
        layout, "cultural_fund", [lead("cultural_fund", "m", "Mural Arts", kind_hint="grantee")]
    )
    assert run_merge(layout).created == 1
    (group,) = groups(layout).values()
    assert len(group["leads"]) == 2


def test_an_ambiguous_name_with_no_zip_is_left_alone(layout):
    write_leads(
        layout,
        "irs_bmf",
        [
            bmf("555555555", "SOUTH PHILLY ARTS GROUP", zip="19145"),
            bmf("666666666", "SOUTH PHILLY ARTS GROUP", zip="19148"),
        ],
    )
    write_leads(layout, "cultural_fund", [lead("cultural_fund", "m", "South Philly Arts Group")])
    assert run_merge(layout).created == 3


def test_slugs_are_unique_and_stable(layout):
    write_leads(
        layout,
        "irs_bmf",
        [
            bmf("111111111", "ST MARYS CHURCH", zip="19104", foundation="10"),
            bmf("222222222", "ST MARYS CHURCH", zip="19130", foundation="10"),
            bmf("333333333", "ST MARYS CHURCH", zip="19130", foundation="10"),
        ],
    )
    run_merge(layout)
    assert set(groups(layout)) == {
        "st-marys-church",
        "st-marys-church-19130",
        "st-marys-church-19130-2",
    }


def test_rejected_leads_get_a_triage_line_and_no_group(layout):
    write_leads(
        layout,
        "irs_bmf",
        [
            bmf("111111111", "WALSH FAMILY FOUNDATION", foundation="04"),
            bmf("222222222", "GOOD CLUB INC"),
        ],
    )
    write_leads(layout, "irs_990n", [n990("111111111", "WALSH FAMILY FOUNDATION INC")])
    result = run_merge(layout)
    assert result.created == 1 and result.rejected["private_foundation"] == 2
    reasons = triage_reasons(layout)
    assert reasons == {
        "irs_bmf:111111111": "private_foundation",
        "irs_990n:111111111": "private_foundation",
    }
    lines = layout.triage_path.read_text(encoding="utf-8").splitlines()
    rows = [json.loads(line) for line in lines]
    assert [r["decision"] for r in rows] == ["reject", "reject"]
    assert rows[0]["lead_id"] == "irs_990n:111111111"
    assert rows[0]["detail"].endswith("(same EIN as another lead)")
    assert rows[1]["detail"] == "IRS foundation code 04, a private non-operating foundation"


def test_blocklist_file_is_created_and_blocked_leads_are_not_resurrected(layout):
    write_leads(
        layout, "irs_bmf", [bmf("111111111", "GOOD CLUB INC"), bmf("222222222", "OTHER CLUB")]
    )
    run_merge(layout)
    assert yaml.safe_load(layout.blocklist_path.read_text(encoding="utf-8")) == {
        "groups": [],
        "leads": [],
        "eins": [],
        "domains": [],
        "fields": [],
    }
    GroupStore(layout.groups_dir).path_for("other-club").unlink()
    layout.blocklist_path.write_text("leads: ['irs_bmf:222222222']\n", encoding="utf-8")
    result = run_merge(layout)
    assert result.created == 0 and result.rejected["blocklist"] == 1
    assert "other-club" not in groups(layout)


def test_rerunning_merge_changes_nothing(layout):
    write_leads(
        layout, "irs_bmf", [bmf("111111111", "GOOD CLUB INC"), bmf("222222222", "OTHER CLUB")]
    )
    run_merge(layout)
    store = GroupStore(layout.groups_dir)
    before = {p.name: p.read_text(encoding="utf-8") for p in layout.groups_dir.glob("*/*.yaml")}
    result = run_merge(layout)
    assert result.created == 0 and result.extended == 0 and result.already_merged == 2
    after = {p.name: p.read_text(encoding="utf-8") for p in layout.groups_dir.glob("*/*.yaml")}
    assert before == after and len(store.ids()) == 2


def test_research_already_in_a_group_survives_a_rerun_and_new_leads_extend_it(layout, vocab):
    write_leads(layout, "irs_bmf", [bmf("111111111", "PHILADELPHIA GROTTO")])
    run_merge(layout)
    write_inbox(
        layout,
        "w1",
        "a1",
        [good_record(match={"lead_ids": ["irs_bmf:111111111"]}, contacts={"website": None})],
    )
    from fyj.research_import import import_wave

    assert import_wave(layout, "w1", vocab, today="2026-10-08").merged == 1
    write_leads(
        layout, "irs_990n", [n990("111111111", "PHILADELPHIA GROTTO INC", email="new@grotto.org")]
    )
    result = run_merge(layout)
    assert result.created == 0 and result.extended == 1
    group = groups(layout)["philadelphia-grotto"]
    assert group["summary"].startswith("A caving club")
    assert group["research_tier"] == 1
    assert group["name"] == "Philadelphia Grotto"
    assert (
        group["leads"] == ["irs_990n:111111111", "irs_bmf:111111111"][::-1]
        or len(group["leads"]) == 2
    )
    assert group["contacts"]["email"] == "new@grotto.org"  # empty field was filled


def test_a_lead_that_research_kept_is_not_listed_in_triage_again(layout, vocab):
    write_leads(layout, "irs_bmf", [bmf("111111111", "WALSH FAMILY FOUNDATION", foundation="04")])
    run_merge(layout)
    assert triage_reasons(layout) == {"irs_bmf:111111111": "private_foundation"}
    write_inbox(
        layout,
        "w1",
        "a1",
        [
            good_record(
                name="Walsh Family Foundation",
                match={"lead_ids": ["irs_bmf:111111111"]},
                contacts={"website": None},
            )
        ],
    )
    from fyj.research_import import import_wave

    assert import_wave(layout, "w1", vocab, today="2026-10-08").over_triage == 1
    run_merge(layout)
    assert triage_reasons(layout) == {}


def test_libraries_get_a_library_name_and_parade_units_become_clubs(layout):
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
                lat=40.06,
                lng=-75.23,
            )
        ],
    )
    write_leads(
        layout, "mummers", [lead("mummers", "americans", "Americans", kind_hint="parade_unit")]
    )
    run_merge(layout)
    by_name = {g["name"]: g for g in groups(layout).values()}
    assert by_name["Andorra Library"]["kind"] == "program"
    assert by_name["Andorra Library"]["locations"][0]["label"] == "Library branch"
    assert by_name["Andorra Library"]["locations"][0]["lat"] == 40.06
    assert by_name["Americans"]["kind"] == "club"


def test_student_org_gets_school_and_open_to_students(layout):
    write_leads(
        layout,
        "penn_clubs",
        [lead("penn_clubs", "x", "Penn Chess Club", kind_hint="student_org", school="penn")],
    )
    run_merge(layout)
    (group,) = groups(layout).values()
    assert group["audience"]["school"] == "penn"
    assert group["audience"]["open_to"] == "students"


def test_merge_gives_locations_a_planning_district_when_a_locator_is_supplied(layout):
    write_leads(
        layout,
        "city_gardens",
        [
            lead(
                "city_gardens",
                "1",
                "Emily Garden",
                kind_hint="garden",
                zip="19148",
                lat=1.0,
                lng=2.0,
            )
        ],
    )
    run_merge(layout, locator=lambda loc: "south" if loc["zip"] == "19148" else None)
    (group,) = groups(layout).values()
    assert group["locations"][0]["planning_district"] == "south"


def test_dry_run_writes_nothing(layout):
    write_leads(layout, "irs_bmf", [bmf("111111111", "GOOD CLUB INC")])
    result = run_merge(layout, dry_run=True)
    assert result.created == 1
    assert not layout.groups_dir.exists() or not list(layout.groups_dir.glob("*/*.yaml"))
    assert not layout.triage_path.exists()


def test_cli_merge(layout, monkeypatch, capsys):
    monkeypatch.setenv("FYJ_ROOT", str(layout.root))
    write_leads(layout, "irs_bmf", [bmf("111111111", "GOOD CLUB INC")])
    main(["merge"])
    out = capsys.readouterr().out
    assert "new tier 0 group files: 1" in out


def test_a_shared_website_does_not_merge_a_civic_association_with_its_gardens(layout):
    site = "https://www.wswcivic.org/gardens"
    write_leads(
        layout,
        "city_rco",
        [
            lead(
                "city_rco",
                "1",
                "Washington Square West Civic Association",
                kind_hint="civic",
                website="http://wswcivic.org",
                extra={"org_type": "Other"},
            )
        ],
    )
    write_leads(
        layout,
        "city_gardens",
        [
            lead(
                "city_gardens",
                "1",
                "Waverly Street Community Garden",
                kind_hint="garden",
                website=site,
            ),
            lead("city_gardens", "2", "Sartain Community Garden", kind_hint="garden", website=site),
        ],
    )
    assert run_merge(layout).created == 3


def test_a_shared_website_still_merges_an_acronym_with_its_full_name(layout):
    write_leads(
        layout,
        "manual_seeds",
        [
            lead(
                "manual_seeds",
                "a",
                "African Cultural Alliance of North America",
                website="https://acanaus.org",
            ),
            lead("manual_seeds", "b", "ACANA", website="https://www.acanaus.org/about"),
        ],
    )
    assert run_merge(layout).created == 1


def test_pac_in_a_charity_name_is_kept(layout):
    kept = bmf("452713988", "PAC RESOURCE GROUP INC")
    assert decide(kept, ctx()) is None
    other_year = n990("452713988", "PAC RESOURCE GROUP INC")
    assert decide(other_year, ctx(bmf_eins={"452713988"})) is None
    assert decide(n990("472622533", "COHEN SEGLIAS PAC INC"), ctx())[0] == "partisan"


def test_a_po_box_number_is_not_taken_for_a_zip(layout):
    write_leads(
        layout,
        "city_rco",
        [
            lead(
                "city_rco",
                "1",
                "Clark Park Neighbors",
                kind_hint="civic",
                zip="31908",
                address="P.O. Box 31908, Philadelphia, PA 19104",
                extra={"org_type": "Other"},
            )
        ],
    )
    run_merge(layout)
    (group,) = groups(layout).values()
    assert group["locations"][0]["zip"] == "19104"
    assert group["locations"][0]["in_city"] is True

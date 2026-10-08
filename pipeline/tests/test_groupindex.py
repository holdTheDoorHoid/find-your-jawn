from helpers import location, make_group

from fyj.groupfile import GroupStore
from fyj.groupindex import GroupIndex


def build(layout):
    make_group(layout, "by-id", "Other Name")
    make_group(layout, "by-lead", "Another", leads=["src:9"])
    make_group(layout, "by-ein", "Third", ein="123456789")
    make_group(
        layout, "by-domain", "Fourth", contacts={"website": "https://www.phillygrotto.org/x"}
    )
    make_group(layout, "by-name", "Philadelphia Grotto Inc.", locations=[location(zip="19104")])
    make_group(layout, "no-zip", "Mural Arts Philadelphia")
    make_group(
        layout,
        "social",
        "Facebook Page Group",
        contacts={"website": "https://www.facebook.com/somegroup"},
    )
    return GroupIndex.build(GroupStore(layout.groups_dir))


def test_match_order_is_group_id_then_lead_ids_then_ein_then_domain_then_name_zip(layout):
    index = build(layout)
    everything = {
        "group_id": "by-id",
        "lead_ids": ["src:9"],
        "ein": "123456789",
        "website": "https://phillygrotto.org",
    }
    name = "Philadelphia Grotto"
    assert index.find_for_record(everything, name, "19104") == ("by-id", "group_id")
    del everything["group_id"]
    assert index.find_for_record(everything, name, "19104") == ("by-lead", "lead_ids")
    del everything["lead_ids"]
    assert index.find_for_record(everything, name, "19104") == ("by-ein", "ein")
    del everything["ein"]
    assert index.find_for_record(everything, name, "19104") == ("by-domain", "website")
    del everything["website"]
    assert index.find_for_record(everything, name, "19104") == ("by-name", "name+zip")


def test_unknown_group_id_falls_through_to_the_other_keys(layout):
    index = build(layout)
    hit = index.find_for_record({"group_id": "nope", "lead_ids": ["src:9"]}, "x", None)
    assert hit == ("by-lead", "lead_ids")


def test_shared_platform_domains_never_match(layout):
    index = build(layout)
    assert index.find_by_keys(website="https://www.facebook.com/somegroup") is None


def test_name_zip_needs_the_same_zip(layout):
    index = build(layout)
    assert index.find_by_keys(name="Philadelphia Grotto", zip_code="19130") is None
    assert index.find_by_keys(name="philadelphia grotto, inc", zip_code="19104") == (
        "by-name",
        "name+zip",
    )


def test_a_name_alone_matches_only_when_it_is_distinctive_and_the_group_has_no_zip(layout):
    index = build(layout)
    assert index.find_by_keys(name="MURAL ARTS PHILADELPHIA", zip_code="19104") == (
        "no-zip",
        "name",
    )
    assert index.find_by_keys(name="Philadelphia Grotto") == ("by-name", "name")
    assert index.find_by_keys(name="Grotto") is None  # one word is not enough

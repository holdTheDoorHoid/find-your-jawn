"""Guide lists: `fyj import-guide`, the guide file, and the guide step of `fyj build`."""

import json

import pytest
import yaml

from fyj.build import build_site_data
from fyj.cli import main
from fyj.guides import (
    build_guides,
    coerce_entry,
    dump_guide,
    import_guide,
    lead_only_domains,
    merge_entries,
    parse_age,
    parse_cost,
    parse_day,
    parse_status,
    parse_time,
    read_guide,
)

TODAY = "2026-10-08"
BILLY_PENN = "https://billypenn.com/2026/08/10/philly-quizzo-history-guide/"

HEADER = {
    "guide": "quizzo",
    "title": "Quizzo nights",
    "updated": "2026-10-01",
    "lead_sources": [{"name": "Billy Penn: Philly quizzo guide (August 2026)", "url": BILLY_PENN}],
    "entries": [],
}


def raw_entry(**over):
    entry = {
        "venue": "Johnny's Tavern",
        "address": "123 Example St",
        "zip": "19130",
        "neighborhood": "Fairmount",
        "day": "tue",
        "start": "20:00",
        "host": "Example Quizzo Co",
        "cost": "free",
        "cost_text": "Free to play",
        "team_size": "Up to 6 players",
        "age": "21_plus",
        "notes": "Themed rounds once a month.",
        "status": "confirmed",
        "sources": [
            {"url": "https://examplequizzo.com/schedule", "seen": "2026-10-08", "fields": ["day"]}
        ],
        "last_checked": "2026-10-08",
    }
    entry.update(over)
    return entry


def setup_guide(layout, header=None):
    layout.guides_dir.mkdir(parents=True, exist_ok=True)
    layout.guide_path("quizzo").write_text(
        yaml.safe_dump(header or HEADER, sort_keys=False), encoding="utf-8"
    )


def write_guide_inbox(layout, agent, entries, **top):
    folder = layout.inbox_dir("guide-quizzo")
    folder.mkdir(parents=True, exist_ok=True)
    payload = {"wave": "guide-quizzo", "agent": agent, "guide": "quizzo", "entries": entries, **top}
    (folder / f"{agent}.json").write_text(json.dumps(payload), encoding="utf-8")


def run(layout, vocab, **kw):
    return import_guide(layout, "quizzo", vocab, today=TODAY, **kw)


def entries_on_disk(layout):
    return read_guide(layout.guide_path("quizzo"))["entries"]


# -- the small repairs ---------------------------------------------------------------


@pytest.mark.parametrize(
    "text,expected",
    [
        ("20:00", "20:00"),
        ("8 pm", "20:00"),
        ("8pm", "20:00"),
        ("8:30 PM", "20:30"),
        ("8:30 p.m.", "20:30"),
        ("7:30pm", "19:30"),
        ("12 pm", "12:00"),
        ("12:00 am", "00:00"),
        ("noon", "12:00"),
        ("2000", "20:00"),
        ("19:00", "19:00"),
        ("8-10pm", "20:00"),
        ("7:30 to 9:30 PM", "19:30"),
        ("Tuesdays at 8 pm", "20:00"),
        ("Round 1 at 8pm", "20:00"),
        ("08:00", "08:00"),
    ],
)
def test_times_are_read_into_24_hour_form(text, expected):
    assert parse_time(text) == (expected, None)


@pytest.mark.parametrize("text", ["8", "8:00", "8-10", "7:30"])
def test_a_time_that_could_be_am_or_pm_is_left_blank_with_a_warning(text):
    value, warning = parse_time(text)
    assert value is None and "no am or pm" in warning


@pytest.mark.parametrize("text", ["late", "25:00 pm", "13 pm"])
def test_an_unreadable_time_is_left_blank(text):
    value, warning = parse_time(text)
    assert value is None and warning


@pytest.mark.parametrize("text", [None, "", "unknown", "n/a", "TBD"])
def test_no_time_is_just_none(text):
    assert parse_time(text) == (None, None)


@pytest.mark.parametrize(
    "text,expected",
    [
        ("tue", "tue"),
        ("Tuesday", "tue"),
        ("Tuesdays", "tue"),
        ("Tues.", "tue"),
        ("THURSDAY NIGHT", "thu"),
        ("Weds", "wed"),
        (["Sunday"], "sun"),
    ],
)
def test_days_are_read_into_three_letter_form(text, expected):
    assert parse_day(text) == (expected, None)


@pytest.mark.parametrize("text", [None, "", "weekly", "every Tuesday and Thursday", "tue, thu"])
def test_a_missing_or_unclear_day_is_a_problem(text):
    day, problem = parse_day(text)
    assert day is None and problem


def test_costs_and_ages_are_read_from_plain_words():
    assert parse_cost("Free") == ("free", True)
    assert parse_cost("no cover") == ("free", True)
    assert parse_cost("$5 per person") == ("paid", False)
    assert parse_cost("Free, with a $5 pitcher deal") == ("unknown", False)
    assert parse_cost(None) == ("unknown", True)
    assert parse_age("21+") == ("21_plus", None)
    assert parse_age("21 and over") == ("21_plus", None)
    assert parse_age("All ages") == ("all_ages", None)
    assert parse_age("18+")[0] == "unknown" and parse_age("18+")[1]
    assert parse_age("unknown") == ("unknown", None)


def test_status_words_are_read_but_a_guess_is_not():
    assert parse_status(" Confirmed ") == "confirmed"
    assert parse_status("verified") == "confirmed"
    assert parse_status("lead only") == "unconfirmed"
    assert parse_status("probably") is None
    assert parse_status(None) is None


# -- one entry -----------------------------------------------------------------------


def test_a_slightly_messy_entry_is_repaired(vocab):
    raw = raw_entry(
        day="Tuesday",
        start="8 pm",
        zip=" 19130-4321 ",
        neighborhood="fairmount",
        age="21 and over",
        cost="Free",
        cost_text=None,
        sources=[{"url": "examplequizzo.com/schedule", "seen": "October 8, 2026"}],
        last_checked=None,
    )
    out = coerce_entry(raw, vocab)
    assert out.problems == []
    entry = out.entry
    assert entry["id"] == "johnnys-tavern-tue"
    assert (entry["day"], entry["start"], entry["zip"]) == ("tue", "20:00", "19130")
    assert entry["neighborhood"] == "Fairmount"
    assert entry["age"] == "21_plus" and entry["cost"] == "free"
    assert entry["sources"] == [
        {"url": "https://examplequizzo.com/schedule", "seen": "2026-10-08", "fields": []}
    ]
    assert entry["last_checked"] == "2026-10-08"  # the newest date seen


def test_planning_district_comes_from_the_zip_table(vocab):
    assert coerce_entry(raw_entry(zip="19104"), vocab).entry["planning_district"] == "west"
    # a ZIP the table does not know falls back to the neighborhood's district
    out = coerce_entry(raw_entry(zip="19199", neighborhood="Fairmount"), vocab)
    assert out.entry["planning_district"] == "lower_north"
    # a district written on the entry wins when the vocabulary knows it
    assert (
        coerce_entry(raw_entry(planning_district="Central"), vocab).entry["planning_district"]
        == "central"
    )
    assert coerce_entry(raw_entry(zip=None, neighborhood="Nowhere"), vocab).entry[
        "planning_district"
    ] is None


def test_broad_neighborhood_names_find_a_district_only_when_the_districts_agree(layout):
    from fyj.vocab import load_vocab

    path = layout.vocab_dir / "neighborhoods.yaml"
    path.write_text(
        path.read_text(encoding="utf-8")
        + """
aliases:
  - {name: "Center City", covers: [center_city, fairmount_x]}
  - {name: "Art Museum area", covers: [fairmount, center_city]}
""",
        encoding="utf-8",
    )
    extra = "neighborhoods:\n  - {id: fairmount_x, label: X, district: central}\n"
    text = path.read_text(encoding="utf-8").replace("neighborhoods:\n", extra, 1)
    path.write_text(text, encoding="utf-8")
    vocab = load_vocab(layout.vocab_dir)
    no_zip = {"zip": None}
    # every neighborhood it covers is in Central
    out = coerce_entry(raw_entry(neighborhood="center city", **no_zip), vocab)
    assert (out.entry["neighborhood"], out.entry["planning_district"]) == ("Center City", "central")
    # the covered neighborhoods sit in different districts: no guess
    out = coerce_entry(raw_entry(neighborhood="Art Museum area", **no_zip), vocab)
    assert out.entry["neighborhood"] == "Art Museum area"
    assert out.entry["planning_district"] is None
    # the venue's own wording is kept when it is not exactly the vocabulary's label
    out = coerce_entry(raw_entry(neighborhood="Fairmount area", **no_zip), vocab)
    assert out.entry["neighborhood"] == "Fairmount area" and out.entry["planning_district"] is None


@pytest.mark.parametrize(
    "change,reason",
    [
        ({"venue": None}, "venue is required"),
        ({"venue": "  "}, "venue is required"),
        ({"day": None}, "day is required"),
        ({"day": "weekends"}, "not a day"),
        ({"status": None}, "status is required"),
        ({"status": "probably"}, "status is required"),
        ({"sources": []}, "sources:"),
        ({"sources": None}, "sources:"),
        ({"sources": [{"url": "https://example.com/events"}]}, "sources:"),
        ({"sources": [{"seen": "2026-10-08"}]}, "sources:"),
        ({"sources": ["https://example.com/events"]}, "sources:"),
    ],
)
def test_the_facts_we_cannot_guess_hold_the_entry(vocab, change, reason):
    out = coerce_entry(raw_entry(**change), vocab)
    assert out.problems and any(reason in p for p in out.problems)


def test_the_no_dashes_rule_is_applied_to_text_people_read(vocab):
    out = coerce_entry(
        raw_entry(
            notes="Themed rounds — bring a friend - it is fun",
            cost_text="Free – prizes are bar tabs",
            team_size="4 - 6 players",
            host="Quiz Co — Philly",
        ),
        vocab,
    )
    entry = out.entry
    for key in ("notes", "cost_text", "team_size", "host"):
        assert "—" not in entry[key] and "–" not in entry[key] and " - " not in entry[key]
    assert entry["notes"] == "Themed rounds, bring a friend, it is fun"
    assert entry["team_size"] == "4 to 6 players"


def test_a_cost_written_in_words_is_kept_as_the_cost_text(vocab):
    out = coerce_entry(raw_entry(cost="$5 per person", cost_text=None), vocab)
    assert out.entry["cost"] == "paid" and out.entry["cost_text"] == "$5 per person"


def test_confirmed_needs_a_venue_or_host_page_not_just_a_lead(vocab):
    lead_only = [{"url": BILLY_PENN, "seen": "2026-10-08", "fields": ["day"]}]
    domains = lead_only_domains(HEADER)  # the platforms plus the guide's own lead sources
    assert "billypenn.com" in domains and "facebook.com" in domains
    out = coerce_entry(raw_entry(sources=lead_only), vocab, domains)
    assert out.entry["status"] == "unconfirmed" and out.downgraded
    social = [{"url": "https://www.facebook.com/johnnys", "seen": "2026-10-08"}]
    assert coerce_entry(raw_entry(sources=social), vocab, domains).entry["status"] == "unconfirmed"
    both = lead_only + [{"url": "https://johnnystavern.example/events", "seen": "2026-10-08"}]
    assert coerce_entry(raw_entry(sources=both), vocab, domains).entry["status"] == "confirmed"
    # a lead source with a dated page of its own subdomain still counts as the lead
    sub = [{"url": "https://www.billypenn.com/other-page", "seen": "2026-10-08"}]
    assert coerce_entry(raw_entry(sources=sub), vocab, domains).entry["status"] == "unconfirmed"


def test_a_zip_outside_the_city_is_flagged_not_dropped(vocab):
    out = coerce_entry(raw_entry(zip="08002"), vocab)
    assert out.problems == [] and out.entry["zip"] == "08002"
    assert any("not a Philadelphia ZIP" in w for w in out.warnings)


# -- merging -------------------------------------------------------------------------


def clean(vocab, **over):
    return coerce_entry(raw_entry(**over), vocab).entry


def test_confirmed_beats_unconfirmed_even_when_the_lead_is_newer(vocab):
    confirmed = clean(vocab, last_checked="2026-09-01")
    lead = clean(
        vocab,
        status="unconfirmed",
        start="21:00",
        host="Someone Else",
        sources=[{"url": BILLY_PENN, "seen": "2026-10-08"}],
        last_checked="2026-10-08",
    )
    merged = merge_entries(confirmed, lead)
    assert merged["status"] == "confirmed" and merged["start"] == "20:00"
    assert merged["host"] == "Example Quizzo Co"
    assert merged["last_checked"] == "2026-09-01"
    assert {s["url"] for s in merged["sources"]} == {
        "https://examplequizzo.com/schedule",
        BILLY_PENN,
    }
    # and the same when the lead is the one already on file
    assert merge_entries(lead, confirmed)["status"] == "confirmed"


def test_a_lead_never_fills_gaps_in_a_confirmed_entry(vocab):
    confirmed = clean(vocab, host=None, team_size=None)
    lead = clean(
        vocab,
        status="unconfirmed",
        host="Lead Host",
        team_size="Up to 4",
        sources=[{"url": BILLY_PENN, "seen": "2026-10-08"}],
    )
    merged = merge_entries(confirmed, lead)
    assert merged["host"] is None and merged["team_size"] is None


def test_among_equals_the_newer_check_wins_and_gaps_are_filled(vocab):
    old = clean(vocab, start="19:00", host="Old Host", last_checked="2026-09-01")
    new = clean(vocab, start="20:00", host=None, last_checked="2026-10-08")
    merged = merge_entries(old, new)
    assert merged["start"] == "20:00"
    assert merged["host"] == "Old Host"  # a gap in the newer report, filled from the older
    assert merged["last_checked"] == "2026-10-08"
    # the older report arriving later does not win
    assert merge_entries(new, old)["start"] == "20:00"


def test_sources_are_added_to_never_dropped(vocab):
    a = clean(
        vocab, sources=[{"url": "https://a.example/x", "seen": "2026-09-01", "fields": ["day"]}]
    )
    b = clean(
        vocab,
        sources=[
            {"url": "https://a.example/x", "seen": "2026-10-08", "fields": ["start"]},
            {"url": "https://b.example/y", "seen": "2026-10-08"},
        ],
    )
    merged = merge_entries(a, b)
    by_url = {s["url"]: s for s in merged["sources"]}
    assert set(by_url) == {"https://a.example/x", "https://b.example/y"}
    assert by_url["https://a.example/x"]["seen"] == "2026-10-08"
    assert by_url["https://a.example/x"]["fields"] == ["start", "day"]


# -- the import run ------------------------------------------------------------------


def test_import_creates_merges_archives_and_summarises(layout, vocab):
    setup_guide(layout)
    write_guide_inbox(
        layout,
        "a1",
        [
            raw_entry(),
            raw_entry(venue="The Rusty Anchor", day="Wednesday", start="7:30 PM", zip="19104"),
            raw_entry(venue="No Day Bar", day=None),
        ],
    )
    write_guide_inbox(
        layout,
        "a2",
        [
            # the same night as a1's first entry, reported again with a different spelling
            raw_entry(venue="Johnnys Tavern", start="9 pm", last_checked="2026-10-09"),
            raw_entry(
                venue="Lead Only Pub",
                day="mon",
                status="unconfirmed",
                sources=[{"url": BILLY_PENN, "seen": "2026-10-08", "fields": ["day"]}],
            ),
        ],
    )
    summary = run(layout, vocab)
    assert (summary.files, summary.entries_in) == (2, 5)
    assert (summary.created, summary.updated, summary.held) == (3, 1, 1)
    assert (summary.confirmed_total, summary.unconfirmed_total) == (2, 1)

    entries = {e["id"]: e for e in entries_on_disk(layout)}
    assert set(entries) == {"johnnys-tavern-tue", "the-rusty-anchor-wed", "lead-only-pub-mon"}
    assert entries["johnnys-tavern-tue"]["start"] == "21:00"  # the newer check
    assert entries["johnnys-tavern-tue"]["venue"] == "Johnnys Tavern"
    assert entries["the-rusty-anchor-wed"]["start"] == "19:30"
    assert entries["the-rusty-anchor-wed"]["planning_district"] == "west"
    assert entries["lead-only-pub-mon"]["status"] == "unconfirmed"

    # the header is kept and the update date moves
    guide = read_guide(layout.guide_path("quizzo"))
    assert guide["updated"] == TODAY and guide["title"] == "Quizzo nights"
    assert guide["lead_sources"][0]["url"] == BILLY_PENN

    # files are archived; the entry that could not be used is held with its reason
    inbox = layout.inbox_dir("guide-quizzo")
    assert not list(inbox.glob("*.json"))
    assert sorted(p.name for p in layout.done_dir("guide-quizzo").glob("*.json")) == [
        "a1.json",
        "a2.json",
    ]
    held = json.loads((layout.held_dir("guide-quizzo") / "a1.json").read_text(encoding="utf-8"))
    assert held["entries"][0]["venue"] == "No Day Bar"
    assert any("day is required" in r for r in held["entries"][0]["_held_reasons"])
    text = "\n".join(summary.lines())
    assert "2 file(s), 5 entry(ies) in" in text and "held for repair: 1" in text


def test_a_confirmed_entry_backed_only_by_the_lead_is_kept_as_unconfirmed(layout, vocab):
    setup_guide(layout)
    lead = [{"url": BILLY_PENN, "seen": "2026-10-08", "fields": ["day", "host"]}]
    write_guide_inbox(layout, "a1", [raw_entry(sources=lead)])
    summary = run(layout, vocab)
    assert (summary.created, summary.downgraded) == (1, 1)
    assert entries_on_disk(layout)[0]["status"] == "unconfirmed"
    assert "no venue or host page backs them: 1" in "\n".join(summary.lines())


def test_a_second_import_of_the_same_report_changes_nothing(layout, vocab):
    setup_guide(layout)
    write_guide_inbox(layout, "a1", [raw_entry()])
    run(layout, vocab)
    first = layout.guide_path("quizzo").read_text(encoding="utf-8")
    write_guide_inbox(layout, "a1", [raw_entry()])
    summary = run(layout, vocab)
    assert (summary.created, summary.updated, summary.unchanged) == (0, 0, 1)
    assert layout.guide_path("quizzo").read_text(encoding="utf-8") == first
    # the archived name is not overwritten
    assert sorted(p.name for p in layout.done_dir("guide-quizzo").glob("*.json")) == [
        "a1.2.json",
        "a1.json",
    ]


def test_the_same_name_in_two_zip_codes_is_two_venues(layout, vocab):
    setup_guide(layout)
    write_guide_inbox(
        layout,
        "a1",
        [
            raw_entry(venue="Iron Hill Brewery", zip="19103"),
            raw_entry(venue="Iron Hill Brewery", zip="19104"),
            raw_entry(venue="Iron Hill Brewery", zip=None),  # no ZIP: joins the first match
        ],
    )
    summary = run(layout, vocab)
    assert (summary.created, summary.updated + summary.unchanged) == (2, 1)
    ids = sorted(e["id"] for e in entries_on_disk(layout))
    assert ids == ["iron-hill-brewery-19104-tue", "iron-hill-brewery-tue"]


def test_the_same_name_at_two_street_addresses_is_two_venues_even_without_a_zip(layout, vocab):
    setup_guide(layout)
    write_guide_inbox(
        layout,
        "a1",
        [
            raw_entry(venue="Wissahickon Brewing", address="3705 W. School House Lane", zip=None),
            raw_entry(venue="Wissahickon Brewing", address="1526 N. American Street", zip=None),
            raw_entry(venue="Wissahickon Brewing", address="3705 West School House Ln", zip=None),
        ],
    )
    summary = run(layout, vocab)
    assert (summary.created, summary.updated + summary.unchanged) == (2, 1)


def test_the_same_venue_on_two_nights_is_two_entries(layout, vocab):
    setup_guide(layout)
    write_guide_inbox(layout, "a1", [raw_entry(), raw_entry(day="thu", start="19:00")])
    run(layout, vocab)
    ids = [e["id"] for e in entries_on_disk(layout)]
    assert ids == ["johnnys-tavern-tue", "johnnys-tavern-thu"]  # in week order


def test_a_bad_file_is_held_whole_and_good_files_still_import(layout, vocab):
    setup_guide(layout)
    folder = layout.inbox_dir("guide-quizzo")
    folder.mkdir(parents=True)
    (folder / "broken.json").write_text("{not json", encoding="utf-8")
    (folder / "wrong-shape.json").write_text('{"records": []}', encoding="utf-8")
    write_guide_inbox(layout, "good", [raw_entry()])
    summary = run(layout, vocab)
    assert (summary.files, summary.held, summary.created) == (3, 2, 1)
    held = layout.held_dir("guide-quizzo")
    assert (held / "broken.reasons.txt").exists() and (held / "wrong-shape.reasons.txt").exists()


def test_a_bare_list_of_entries_is_accepted(layout, vocab):
    setup_guide(layout)
    folder = layout.inbox_dir("guide-quizzo")
    folder.mkdir(parents=True)
    (folder / "list.json").write_text(json.dumps([raw_entry()]), encoding="utf-8")
    assert run(layout, vocab).created == 1


def test_dry_run_reports_and_writes_nothing(layout, vocab):
    setup_guide(layout)
    before = layout.guide_path("quizzo").read_text(encoding="utf-8")
    write_guide_inbox(layout, "a1", [raw_entry(), raw_entry(venue=None)])
    summary = run(layout, vocab, dry_run=True)
    assert (summary.created, summary.held) == (1, 1)
    assert layout.guide_path("quizzo").read_text(encoding="utf-8") == before
    assert (layout.inbox_dir("guide-quizzo") / "a1.json").exists()
    assert not layout.done_dir("guide-quizzo").exists()
    assert not layout.held_dir("guide-quizzo").exists()


def test_import_needs_the_guide_file(layout, vocab):
    with pytest.raises(FileNotFoundError):
        run(layout, vocab)
    with pytest.raises(ValueError):
        import_guide(layout, "../etc", vocab)


def test_the_file_is_written_the_way_the_data_model_shows_it(layout, vocab):
    setup_guide(layout)
    write_guide_inbox(layout, "a1", [raw_entry()])
    run(layout, vocab)
    text = layout.guide_path("quizzo").read_text(encoding="utf-8")
    assert "updated: 2026-10-08\n" in text  # a date, not a quoted string
    assert "last_checked: 2026-10-08\n" in text
    assert "start: '20:00'" in text
    assert text.index("id: johnnys-tavern-tue") < text.index("venue:") < text.index("  sources:")
    # reading it back and writing it again gives the same text
    assert dump_guide(read_guide(layout.guide_path("quizzo"))) == text


def test_existing_entries_get_a_planning_district_when_they_lack_one(layout, vocab):
    header = dict(HEADER)
    header["entries"] = [
        {**clean(vocab), "planning_district": None, "zip": "19104", "neighborhood": None}
    ]
    setup_guide(layout, header)
    run(layout, vocab)
    assert entries_on_disk(layout)[0]["planning_district"] == "west"


# -- the build -----------------------------------------------------------------------


def test_build_publishes_only_confirmed_entries_in_week_order(layout, vocab):
    setup_guide(layout)
    write_guide_inbox(
        layout,
        "a1",
        [
            raw_entry(venue="Thursday Place", day="thu", start="19:00"),
            raw_entry(venue="Tuesday Late", day="tue", start="21:00", host=None),
            raw_entry(venue="Tuesday Early", day="tue", start="19:30"),
            raw_entry(
                venue="Only A Lead",
                status="unconfirmed",
                sources=[{"url": BILLY_PENN, "seen": "2026-10-08"}],
            ),
        ],
    )
    run(layout, vocab)
    results = build_guides(layout, today=TODAY)
    assert (results["quizzo"].published, results["quizzo"].unconfirmed) == (3, 1)
    data = json.loads((layout.site_guides_dir / "quizzo.json").read_text(encoding="utf-8"))
    assert data["guide"] == "quizzo" and data["title"] == "Quizzo nights" and data["count"] == 3
    assert data["built"] == TODAY and data["updated"] == TODAY
    assert data["lead_sources"] == [
        {"name": "Billy Penn: Philly quizzo guide (August 2026)", "url": BILLY_PENN}
    ]
    assert [e["venue"] for e in data["entries"]] == [
        "Tuesday Early",
        "Tuesday Late",
        "Thursday Place",
    ]
    late = data["entries"][1]
    assert "host" not in late  # empty values are left out
    assert late["status"] == "confirmed" and late["sources"][0]["seen"] == "2026-10-08"
    assert all(e["id"] != "only-a-lead-tue" for e in data["entries"])


def test_build_with_no_confirmed_nights_still_writes_the_guide(layout, vocab):
    setup_guide(layout)
    build_guides(layout, today=TODAY)
    data = json.loads((layout.site_guides_dir / "quizzo.json").read_text(encoding="utf-8"))
    assert data["count"] == 0 and data["entries"] == []
    assert data["title"] == "Quizzo nights"


def test_build_honours_the_removal_list_and_skips_incomplete_entries(layout, vocab):
    header = dict(HEADER)
    header["entries"] = [
        clean(vocab, venue="Keep Me"),
        clean(vocab, venue="Take Me Down"),
        {**clean(vocab, venue="No Source"), "sources": []},
    ]
    setup_guide(layout, header)
    layout.blocklist_path.write_text("groups: [take-me-down-tue]\n", encoding="utf-8")
    result = build_guides(layout, today=TODAY)["quizzo"]
    assert (result.published, result.blocked, result.skipped) == (1, 1, 1)
    data = json.loads((layout.site_guides_dir / "quizzo.json").read_text(encoding="utf-8"))
    assert [e["venue"] for e in data["entries"]] == ["Keep Me"]


def test_build_refuses_a_guide_file_that_names_another_guide(layout):
    layout.guides_dir.mkdir(parents=True)
    other = "guide: trivia\ntitle: X\nentries: []\n"
    layout.guide_path("quizzo").write_text(other, encoding="utf-8")
    with pytest.raises(ValueError):
        build_guides(layout, today=TODAY)


def test_fyj_build_writes_the_guides_beside_the_groups(layout, vocab):
    setup_guide(layout)
    write_guide_inbox(layout, "a1", [raw_entry()])
    run(layout, vocab)
    result = build_site_data(layout, vocab, today=TODAY, pages_dir=layout.root / "no-pages")
    assert result.guides["quizzo"].published == 1
    assert (layout.site_data_dir / "groups.json").exists()
    assert (layout.site_guides_dir / "quizzo.json").exists()
    # rebuilt from scratch: a guide that is gone does not linger
    layout.guide_path("quizzo").unlink()
    build_site_data(layout, vocab, today=TODAY, pages_dir=layout.root / "no-pages")
    assert not (layout.site_guides_dir / "quizzo.json").exists()


def test_cli_import_guide_and_build(layout, monkeypatch, capsys):
    monkeypatch.setenv("FYJ_ROOT", str(layout.root))
    setup_guide(layout)
    write_guide_inbox(layout, "a1", [raw_entry(), raw_entry(venue=None)])
    main(["import-guide", "quizzo", "--dry-run"])
    out = capsys.readouterr().out
    assert "(dry run, nothing written)" in out and "held for repair: 1" in out
    main(["inbox-stats"])
    assert "guide-quizzo: 1 file(s), 2 record(s)" in capsys.readouterr().out
    main(["import-guide", "quizzo"])
    assert "new: 1" in capsys.readouterr().out
    main(["build"])
    assert "guide quizzo: 1 confirmed night(s) published" in capsys.readouterr().out
    with pytest.raises(SystemExit):
        main(["import-guide", "nonesuch"])

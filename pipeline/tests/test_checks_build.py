import json

from helpers import good_record, lead, location, make_group, write_inbox, write_leads

from fyj.build import build_site_data, compact_record, site_record
from fyj.checks import (
    CheckContext,
    check_dashes,
    check_group,
    format_report,
    partisan_reason,
    run_checks,
    write_blocklist_if_missing,
)
from fyj.cli import main
from fyj.groupfile import MAILING_LABELS, GroupStore
from fyj.research_import import import_wave


def published_group(layout, vocab, **over):
    write_inbox(layout, "w1", "a1", [good_record(**over)])
    summary = import_wave(layout, "w1", vocab, today="2026-10-08")
    assert summary.held == 0, summary.held_reasons
    return GroupStore(layout.groups_dir).read("philadelphia-grotto")


def test_a_clean_group_passes_every_check(layout, vocab):
    group = published_group(layout, vocab)
    ctx = CheckContext.for_layout(layout, vocab, pages_dir=layout.root / "no-pages")
    assert check_group(group, ctx) == []


def test_each_check_reports_a_reason(layout, vocab):
    group = published_group(layout, vocab)
    group["interests"] = ["not_a_tag"]
    group["summary"] = "A club — for cavers."
    group["sources"] = []
    group["name"] = "Campaign Committee for Mayor"
    group["requirements"]["service_hours_letter"] = "yes"
    layout.blocklist_path.write_text("groups: [philadelphia-grotto]\n", encoding="utf-8")
    ctx = CheckContext.for_layout(layout, vocab, pages_dir=layout.root / "no-pages")
    checks = {c for c, _ in check_group(group, ctx)}
    assert checks == {"schema", "sources", "dashes", "scope", "claims", "blocklist"}


def test_own_words_also_compares_cached_page_text(layout, vocab, tmp_path):
    from fyj.checks import page_cache_path

    group = published_group(layout, vocab)
    pages = tmp_path / "pages"
    pages.mkdir()
    page_cache_path(pages, "https://phillygrotto.org").write_text(
        "Welcome. A caving club that runs trips to caves in Pennsylvania and teaches beginners "
        "to cave safely. Join us.",
        encoding="utf-8",
    )
    ctx = CheckContext.for_layout(layout, vocab, pages_dir=pages)
    problems = check_group(group, ctx)
    assert [c for c, _ in problems] == ["own_words"]


def test_partisan_patterns():
    assert partisan_reason("22nd Ward Democratic RCO")
    assert partisan_reason("Friends of Smith for Mayor")
    assert partisan_reason("Philadelphia Young Republicans")
    assert partisan_reason("Greater Philly PAC")
    assert partisan_reason("Committee to Elect Jane Doe")
    assert partisan_reason("Fairmount Civic Association") is None
    assert partisan_reason("Campaign for Working Families") is None
    assert partisan_reason("27th Ward Neighbors") is None
    assert partisan_reason("Pacific Rim Cooking Club") is None


def test_check_dashes_flags_spaced_hyphens_but_not_compounds(layout, vocab):
    group = published_group(layout, vocab)
    group["summary"] = "A drop-in club - for cavers"
    assert len(check_dashes(group)) == 1
    group["summary"] = "A drop-in club for cavers"
    assert check_dashes(group) == []


def test_run_checks_counts_tiers_and_hidden(layout, vocab):
    published_group(layout, vocab)
    make_group(layout, "tier-zero", "Tier Zero")
    make_group(
        layout, "hidden-one", "Hidden One", research_tier=1, hidden=True, hidden_reason="defunct"
    )
    make_group(layout, "broken", "Broken", research_tier=1)
    report = run_checks(layout, vocab, pages_dir=layout.root / "no-pages")
    assert report.counts == {
        "groups": 4,
        "hidden": 1,
        "tier0": 1,
        "checked": 2,
        "passed": 1,
        "held": 1,
    }
    assert report.passed == ["philadelphia-grotto"]
    assert report.held[0]["id"] == "broken"
    text = format_report(report)
    assert "held back: 1" in text and "schema" in text


def test_check_command_writes_the_report_and_exits_zero_with_held_groups(
    layout, vocab, monkeypatch, capsys
):
    make_group(layout, "broken", "Broken", research_tier=1)
    monkeypatch.setenv("FYJ_ROOT", str(layout.root))
    main(["check"])
    out = capsys.readouterr().out
    assert "held back: 1" in out
    report = json.loads((layout.checks_dir / "latest.json").read_text(encoding="utf-8"))
    assert report["counts"]["held"] == 1


def test_blocklist_file_is_created_with_a_header_and_empty_lists(layout):
    assert write_blocklist_if_missing(layout.blocklist_path) is True
    assert write_blocklist_if_missing(layout.blocklist_path) is False
    text = layout.blocklist_path.read_text(encoding="utf-8")
    assert text.startswith("# Removal list")
    import yaml

    data = yaml.safe_load(text)
    assert data == {"groups": [], "leads": [], "eins": [], "domains": [], "fields": []}


def test_site_record_adds_planning_district_and_hides_mailing_addresses(layout, vocab):
    group = published_group(layout, vocab)
    group["locations"] = [
        location(label="Monthly meeting", address="1 Main St", zip="19104"),
        location(label=MAILING_LABELS[0], address="PO Box 5", zip="19130", lat=1.0, lng=2.0),
        location(label="Hall", neighborhood="fairmount", zip="19103"),
    ]
    record = site_record(group, vocab)
    assert [loc["planning_district"] for loc in record["locations"]] == [
        "west",
        "lower_north",
        "lower_north",
    ]
    assert record["locations"][1]["address"] is None
    assert record["locations"][1]["lat"] is None
    assert record["locations"][0]["address"] == "1 Main St"
    assert "leads" not in record
    assert record["ein"] is None  # full record keeps the key


def test_compact_record_drops_internal_fields_and_nulls(layout, vocab):
    group = published_group(layout, vocab)
    group["first_step"]["basis"] = "internal"
    group["access"]["notes"] = "internal"
    group["requirements"]["gear"] = "helmet"
    compact = compact_record(site_record(group, vocab))
    for key in ("leads", "sources", "ein", "contacts"):
        assert key not in compact
    assert "basis" not in compact.get("first_step", {})
    assert "notes" not in compact.get("access", {})
    assert "gear" not in compact.get("requirements", {})
    assert "hidden_reason" not in compact
    assert compact["hidden"] is False  # False values stay
    assert "summary" in compact and compact["audience"]["min_age"] == 18


def test_build_publishes_only_passing_visible_tier_one_groups(layout, vocab):
    published_group(layout, vocab)
    make_group(layout, "tier-zero", "Tier Zero")
    make_group(layout, "broken", "Broken", research_tier=1)
    make_group(layout, "gone", "Gone", research_tier=1, hidden=True, hidden_reason="defunct")
    result = build_site_data(layout, vocab, today="2026-10-08", pages_dir=layout.root / "no-pages")
    assert result.published == 1
    out = layout.site_data_dir
    listing = json.loads((out / "groups.json").read_text(encoding="utf-8"))
    assert listing["count"] == 1 and listing["built"] == "2026-10-08"
    assert [g["id"] for g in listing["groups"]] == ["philadelphia-grotto"]
    assert sorted(p.name for p in (out / "groups").iterdir()) == ["philadelphia-grotto.json"]
    page = json.loads((out / "groups" / "philadelphia-grotto.json").read_text(encoding="utf-8"))
    assert page["contacts"]["website"] == "https://phillygrotto.org"
    assert "leads" not in page
    vocab_json = json.loads((out / "vocab.json").read_text(encoding="utf-8"))
    assert {"interests", "motives", "formats", "roles"} <= set(vocab_json)
    manifest = json.loads((out / "manifest.json").read_text(encoding="utf-8"))
    assert manifest["published"] == 1
    assert manifest["tier0_unchecked"] == 1
    assert manifest["hidden"] == 1
    assert manifest["by_status"] == {"active": 1}
    assert manifest["by_category"] == {"outdoors-adventure": 1}
    assert manifest["coverage"] is None
    assert (layout.checks_dir / "latest.json").exists()


def test_build_clears_stale_files_and_suppresses_blocklisted_fields(layout, vocab):
    published_group(
        layout, vocab, contacts={"website": "https://phillygrotto.org", "phone": "215-555-0100"}
    )
    stale = layout.site_data_dir / "groups" / "stale.json"
    stale.parent.mkdir(parents=True)
    stale.write_text("{}", encoding="utf-8")
    layout.blocklist_path.write_text(
        "fields:\n  - {group: philadelphia-grotto, field: contacts.phone, value: '215-555-0100'}\n",
        encoding="utf-8",
    )
    build_site_data(layout, vocab, pages_dir=layout.root / "no-pages")
    assert not stale.exists()
    page = json.loads(
        (layout.site_data_dir / "groups" / "philadelphia-grotto.json").read_text(encoding="utf-8")
    )
    assert page["contacts"]["phone"] is None


def test_build_manifest_includes_coverage_when_present(layout, vocab):
    published_group(layout, vocab)
    layout.coverage_dir.mkdir(parents=True)
    (layout.coverage_dir / "2026-10-01.json").write_text('{"estimate": 123}', encoding="utf-8")
    build_site_data(layout, vocab, pages_dir=layout.root / "no-pages")
    manifest = json.loads((layout.site_data_dir / "manifest.json").read_text(encoding="utf-8"))
    assert manifest["coverage"] == {"estimate": 123}


def test_cli_inbox_stats_import_and_build(layout, vocab, monkeypatch, capsys):
    monkeypatch.setenv("FYJ_ROOT", str(layout.root))
    write_inbox(
        layout,
        "w1",
        "a1",
        [
            good_record(),
            good_record(
                verdict="hide", name="X", hidden_reason="private", contacts={"website": None}
            ),
        ],
    )
    main(["inbox-stats"])
    out = capsys.readouterr().out
    assert "w1: 1 file(s), 2 record(s)" in out and "publish 1" in out
    main(["import-research", "w1"])
    out = capsys.readouterr().out
    assert "new groups created: 2" in out
    main(["build"])
    out = capsys.readouterr().out
    assert "published 1 group(s)" in out
    main(["inbox-stats"])
    assert "Already imported" in capsys.readouterr().out


def test_lead_descriptions_are_read_from_every_leads_file(layout, vocab):
    copied = "We run weekend trips into wild caves across central Pennsylvania for beginners"
    write_leads(layout, "src", [lead("src", "1", "X", description=copied)])
    group = published_group(layout, vocab)
    group["leads"] = ["src:1"]
    group["summary"] = "We run weekend trips into wild caves across the state."
    ctx = CheckContext.for_layout(layout, vocab, pages_dir=layout.root / "no-pages")
    assert [c for c, _ in check_group(group, ctx)] == ["own_words"]

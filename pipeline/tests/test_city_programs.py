import yaml

from fyj.harvest import city_programs


def test_parses_sample_program_file(fixtures_dir):
    with open(fixtures_dir / "city_programs_sample.yaml", encoding="utf-8") as f:
        data = yaml.safe_load(f)
    leads = city_programs.parse_programs(data["programs"])
    assert len(leads) == 2

    first = leads[0]
    assert first["lead_id"] == "city_programs:test-reading-buddies"
    assert first["kind_hint"] == "program"
    assert first["website"] == "https://www.phila.gov/programs/test-reading-buddies/"
    assert first["city"] == "Philadelphia"
    assert first["open_to_public_hint"] is True
    assert first["tags_hint"] == ["City of Philadelphia volunteer program"]
    assert first["extra"]["department"] == "Office of Testing"
    assert first["extra"]["who_can_join"] == "16 or older"
    assert first["extra"]["commitment"] == "weekly"
    assert first["extra"]["evidence_date"] == "2026-09"
    assert first["seen_at"] == [
        {
            "source_url": "https://www.phila.gov/programs/test-reading-buddies/",
            "date": "2026-09",
            "note": "city_programs research pass",
        }
    ]


def test_org_only_program_is_not_open_to_public_hint(fixtures_dir):
    with open(fixtures_dir / "city_programs_sample.yaml", encoding="utf-8") as f:
        data = yaml.safe_load(f)
    leads = city_programs.parse_programs(data["programs"])
    second = leads[1]
    assert second["open_to_public_hint"] is False
    assert second["extra"]["evidence_date"] is None
    assert second["seen_at"] == []


def test_discontinued_list_is_not_turned_into_leads(fixtures_dir):
    with open(fixtures_dir / "city_programs_sample.yaml", encoding="utf-8") as f:
        data = yaml.safe_load(f)
    leads = city_programs.parse_programs(data["programs"])
    names = {lead["name"] for lead in leads}
    assert "Test Dead Program" not in names
    assert "discontinued" in data  # present in the file, just not harvested by parse_programs


def test_load_seed_file_requires_programs_key(tmp_path):
    bad_file = tmp_path / "bad.yaml"
    bad_file.write_text("not_programs: []\n", encoding="utf-8")
    try:
        city_programs.load_seed_file(bad_file)
        assert False, "expected ValueError"
    except ValueError as exc:
        assert "programs" in str(exc)


def test_the_real_city_programs_file_loads_and_parses_without_error():
    entries = city_programs.load_seed_file()
    leads = city_programs.parse_programs(entries)
    assert len(leads) == len(entries)
    assert len(leads) >= 25, "expected at least 25 researched City programs"
    native_ids = [lead["native_id"] for lead in leads]
    assert len(native_ids) == len(set(native_ids)), "program ids must be unique"
    for lead in leads:
        assert lead["source_url"].startswith("http")
        assert lead["name"]
        assert lead["extra"]["department"]
        assert lead["extra"]["what"], f"{lead['name']} is missing a 'what' summary"

    mural_arts = next(
        lead for lead in leads if lead["name"] == "Mural Arts Philadelphia volunteering"
    )
    assert mural_arts["open_to_public_hint"] is None

    soak_it_up = next(lead for lead in leads if lead["name"] == "Soak It Up Adoption")
    assert soak_it_up["open_to_public_hint"] is False

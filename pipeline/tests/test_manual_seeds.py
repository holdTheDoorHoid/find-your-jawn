import yaml

from fyj.harvest import manual_seeds


def test_parses_sample_seed_file(fixtures_dir):
    with open(fixtures_dir / "manual_seeds_sample.yaml", encoding="utf-8") as f:
        entries = yaml.safe_load(f)
    leads = manual_seeds.parse_seeds(entries)
    assert len(leads) == 2
    first = leads[0]
    assert first["lead_id"] == "manual_seeds:test-club-one"
    assert first["kind_hint"] == "club"
    assert first["extra"]["note"] == "A short research note, not copied from the source."
    assert first["tags_hint"] == ["testing"]

    second = leads[1]
    assert second["website"] == "https://testclubtwo.org"
    assert second["extra"]["membership_tier"] == "full"


def test_the_real_seed_file_loads_and_parses_without_error():
    entries = manual_seeds.load_seed_file()
    leads = manual_seeds.parse_seeds(entries)
    assert len(leads) == len(entries)
    native_ids = [lead["native_id"] for lead in leads]
    assert len(native_ids) == len(set(native_ids)), "seed ids must be unique"
    for lead in leads:
        assert lead["source_url"].startswith("http")
        assert lead["name"]

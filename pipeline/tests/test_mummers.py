from fyj.harvest import mummers


def test_parses_all_divisions_from_fixture(fixtures_dir):
    html = (fixtures_dir / "mummers_page.html").read_text(encoding="utf-8")
    leads = mummers.parse_lineup(html, source_url="https://example.com/lineup")

    names = {lead["name"] for lead in leads}
    assert "Golden Sunrise" in names  # Fancy
    assert "Froggy Carr" in names  # Wench Brigade
    assert "Philadelphia Pranking Authority" in names  # Comic, under a mother club
    assert "Duffy String Band" in names  # String Band

    fancy = next(lead for lead in leads if lead["name"] == "Golden Sunrise")
    assert fancy["kind_hint"] == "parade_unit"
    assert fancy["tags_hint"] == ["Fancy Division"]
    assert fancy["seen_at"][0]["date"] == "2026-01-01"
    assert "Fancy Division" in fancy["seen_at"][0]["note"]

    comic = next(lead for lead in leads if lead["name"] == "Philadelphia Pranking Authority")
    assert comic["extra"]["mother_club"] == "Landi Comics NYA"
    assert "Mother Club: Landi Comics NYA" in comic["tags_hint"]

    band = next(lead for lead in leads if lead["name"] == "Duffy String Band")
    assert band["extra"]["2026_theme"] == "Music Store Galore"


def test_native_ids_are_unique_slugs(fixtures_dir):
    html = (fixtures_dir / "mummers_page.html").read_text(encoding="utf-8")
    leads = mummers.parse_lineup(html, source_url="https://example.com/lineup")
    native_ids = [lead["native_id"] for lead in leads]
    assert len(native_ids) == len(set(native_ids))


def test_slugify_handles_punctuation():
    assert mummers._slugify("O'Malley's Pub!") == "o-malley-s-pub"

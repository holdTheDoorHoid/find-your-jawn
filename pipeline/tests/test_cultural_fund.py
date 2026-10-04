from fyj.harvest import cultural_fund


def test_parses_grantee_cards_from_fixture(fixtures_dir):
    html = (fixtures_dir / "cultural_fund_page.html").read_text(encoding="utf-8")
    leads = cultural_fund.parse_directory_page(html, page_url="https://example.com/page1")
    assert len(leads) == 2

    first = leads[0]
    assert first["name"] == "1807 & Friends, Inc."
    assert first["website"] == "http://www.1807friends.org/"
    assert first["kind_hint"] == "grantee"
    assert first["tags_hint"] == ["Music"]
    assert first["extra"]["grant_program"] == "Art & Culture"
    assert first["extra"]["council_district"] == "District 8"
    assert first["native_id"] == "1807-friends-inc-2"

    second = leads[1]
    assert second["name"] == "1812 Productions"
    assert second["extra"]["council_district"] == "District 1"


def test_empty_page_returns_no_leads():
    assert cultural_fund.parse_directory_page("<html></html>", page_url="https://example.com") == []

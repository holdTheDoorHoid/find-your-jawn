from fyj.harvest import city_volunteer_portal as cvp


def test_parse_listing_cards_from_fixture(fixtures_dir):
    html = (fixtures_dir / "galaxydigital_agency_list.html").read_text(encoding="utf-8")
    cards = cvp.parse_listing_cards(html)
    assert cards == [
        ("186276", "Community Schools @Frankford High School"),
        ("177491", "City of Philadelphia - Philly Reading Coaches"),
    ]


def test_parse_agency_detail_from_fixture(fixtures_dir):
    html = (fixtures_dir / "galaxydigital_agency_detail.html").read_text(encoding="utf-8")
    lead = cvp.parse_agency_detail(html, native_id="186276", url="https://example.com/agency/186276")
    assert lead["name"] == "Community Schools @Frankford High School"
    assert lead["kind_hint"] == "program"
    assert "Who We Are" in lead["description"]
    assert "What We Do" in lead["description"]
    assert lead["phone"] == "(215) 834-6277"
    assert lead["email"] == "test@phila.gov"
    assert "5000 Oxford Ave" in lead["address"]


def test_parse_need_detail_from_fixture(fixtures_dir):
    html = (fixtures_dir / "galaxydigital_need_detail.html").read_text(encoding="utf-8")
    lead = cvp.parse_need_detail(html, native_id="1164492", url="https://example.com/need/1164492")
    assert lead["name"] == "PRC @ Anderson"
    assert lead["kind_hint"] == "opportunity"
    assert "16 and older" in lead["extra"]["requirements"]
    assert "Public Transportation" in lead["extra"]["requirements"]
    assert lead["extra"]["agency_id"] == "177491"
    assert "1034 S 60th St." in lead["extra"]["location"]
    assert lead["extra"]["shifts"] == [
        {
            "begins": "Wed Oct 7, 2026 @ 9:00am to 10:15am",
            "registration_closes": "Wed Oct 7, 2026 @ 8:00am",
            "duration": "1.25 hours",
            "open_spots": "5 of 5",
        }
    ]


def test_list_url_and_detail_url_patterns():
    assert cvp.list_url("agency", 0) == "https://communityschools.galaxydigital.com/agency/"
    assert cvp.list_url("agency", 12) == "https://communityschools.galaxydigital.com/agency/index/12"
    assert cvp.detail_url("need", "42") == (
        "https://communityschools.galaxydigital.com/need/detail/?need_id=42"
    )

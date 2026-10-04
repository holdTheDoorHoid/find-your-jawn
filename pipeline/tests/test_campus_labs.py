import json

from fyj.harvest import campus_labs


def test_parses_real_drexel_sample_fixture(fixtures_dir):
    with open(fixtures_dir / "drexel_dragonlink_sample.json", encoding="utf-8") as f:
        data = json.load(f)
    leads = campus_labs.parse_organizations(
        data["value"], source_id="engage_drexel", school="drexel", subdomain="drexel"
    )
    assert len(leads) == len(data["value"])
    assert all(lead["school"] == "drexel" for lead in leads)
    assert all(lead["kind_hint"] == "student_org" for lead in leads)
    assert all(lead["lead_id"].startswith("engage_drexel:") for lead in leads)


def test_parses_real_ccp_sample_fixture(fixtures_dir):
    with open(fixtures_dir / "ccp_engage_sample.json", encoding="utf-8") as f:
        data = json.load(f)
    leads = campus_labs.parse_organizations(
        data["value"], source_id="engage_ccp", school="ccp", subdomain="ccp"
    )
    assert len(leads) == len(data["value"])
    assert all(lead["school"] == "ccp" for lead in leads)


def test_description_strips_html_when_summary_is_blank():
    orgs = [
        {
            "Id": "1",
            "Name": "Test Org",
            "ShortName": "TO",
            "Description": "<p>Hello <strong>World</strong></p>",
            "Summary": "",
            "CategoryNames": ["Clubs"],
            "WebsiteKey": "test-org",
        }
    ]
    lead = campus_labs.parse_organizations(
        orgs, source_id="engage_drexel", school="drexel", subdomain="drexel"
    )[0]
    assert lead["description"] == "Hello World"
    assert lead["aka"] == ["TO"]
    assert lead["extra"]["directory_url"] == "https://drexel.campuslabs.com/engage/organization/test-org"


def test_robots_txt_blocks_the_engage_api_path():
    # this is the actual rule found on drexel.campuslabs.com/robots.txt and
    # ccp.campuslabs.com/robots.txt as of 2026-10-04; a regression here means the harvester
    # would start fetching a path the site's own robots.txt disallows.
    import urllib.robotparser

    parser = urllib.robotparser.RobotFileParser()
    parser.parse(
        """User-agent: *
Disallow: /engage/notfound
Disallow: /engage/forbidden
Disallow: /engage/error
Disallow: /engage/api/
Disallow: /notfound
Disallow: /forbidden
Disallow: /error
Disallow: /api/""".splitlines()
    )
    assert parser.can_fetch(
        "FindYourJawn/0.1", campus_labs.api_url("drexel") + "?top=100&skip=0"
    ) is False

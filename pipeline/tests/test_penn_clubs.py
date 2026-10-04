import json

from fyj.harvest import penn_clubs


def test_parses_real_sample_fixture(fixtures_dir):
    with open(fixtures_dir / "pennclubs_sample.json", encoding="utf-8") as f:
        clubs = json.load(f)
    leads = penn_clubs.parse_clubs(clubs)
    assert len(leads) == len(clubs)
    lead = leads[0]
    assert lead["source"] == "penn_clubs"
    assert lead["school"] == "penn"
    assert lead["kind_hint"] == "student_org"
    assert lead["open_to_public_hint"] is None
    assert lead["lead_id"].startswith("penn_clubs:")


def test_tags_come_from_tag_names():
    clubs = [
        {
            "code": "test",
            "name": "Test Club",
            "subtitle": "A club for testing",
            "email": "test@example.com",
            "tags": [{"id": 1, "name": "Special Interest"}, {"id": 2, "name": "Academic"}],
        }
    ]
    lead = penn_clubs.parse_clubs(clubs)[0]
    assert lead["tags_hint"] == ["Special Interest", "Academic"]
    assert lead["description"] == "A club for testing"
    assert lead["extra"]["directory_url"] == "https://pennclubs.com/club/test"


def test_club_without_code_is_skipped():
    assert penn_clubs.parse_clubs([{"name": "No code club"}]) == []

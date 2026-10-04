import csv

from fyj.harvest import irs_990n


def test_filters_to_philadelphia_and_keeps_latest_tax_year(fixtures_dir):
    with open(fixtures_dir / "irs_990n_sample.csv", encoding="utf-8", newline="") as f:
        rows = list(csv.DictReader(f))
    leads = irs_990n.parse_rows(rows)
    eins = {lead["ein"] for lead in leads}

    # the Maine row and the Scranton (non-191 ZIP) row must be dropped
    assert "010002847" not in eins
    assert "999000003" not in eins

    # the Philadelphia rows must be kept, including the one identified by city text alone
    assert "999000001" in eins
    assert "999000002" in eins

    # only the newer tax year should survive for the duplicated EIN
    dup = next(lead for lead in leads if lead["ein"] == "999000001")
    assert dup["extra"]["tax_year"] == "2025"
    assert dup["website"] == "phillytestgarden.org"
    assert dup["aka"] == ["Test Garden Club DBA"]


def test_matches_philadelphia_by_city_text_even_without_state_field():
    rows = [
        {
            "ein": "111111111",
            "tax_year": "2025",
            "legal_name": "NO STATE FIELD ORG",
            "organization_city": "Philadelphia",
            "organization_state": "",
            "organization_zip": "19107",
            "officer_name": "",
            "website": "",
            "dba_name_1": "",
            "dba_name_2": "",
            "dba_name_3": "",
            "terminated": "F",
            "gross_receipts_under_25000": "T",
        }
    ]
    leads = irs_990n.parse_rows(rows)
    assert len(leads) == 1
    assert leads[0]["name"] == "NO STATE FIELD ORG"


def test_blank_dba_fields_do_not_become_aka_entries():
    rows = [
        {
            "ein": "222222222",
            "tax_year": "2025",
            "legal_name": "ORG",
            "organization_city": "PHILADELPHIA",
            "organization_state": "PA",
            "organization_zip": "19107",
            "officer_name": "",
            "website": "",
            "dba_name_1": " ",
            "dba_name_2": "",
            "dba_name_3": "",
            "terminated": "F",
            "gross_receipts_under_25000": "T",
        }
    ]
    leads = irs_990n.parse_rows(rows)
    assert leads[0]["aka"] == []


def test_find_latest_month_steps_backward_until_head_ok():
    calls = []

    class FakeClient:
        def head_ok(self, url):
            calls.append(url)
            return url.endswith("2026-07-E-POSTCARD.csv")

    import datetime as dt

    year, month, url = irs_990n.find_latest_month(
        FakeClient(), start=dt.date(2026, 9, 15), lookback_months=4
    )
    assert (year, month) == (2026, 7)
    assert url.endswith("2026-07-E-POSTCARD.csv")
    assert len(calls) == 3  # tried 09, 08, then 07

import csv

from fyj.harvest import irs_bmf

HEADER = [
    "EIN", "NAME", "ICO", "STREET", "CITY", "STATE", "ZIP", "GROUP", "SUBSECTION",
    "AFFILIATION", "CLASSIFICATION", "RULING", "DEDUCTIBILITY", "FOUNDATION", "ACTIVITY",
    "ORGANIZATION", "STATUS", "TAX_PERIOD", "ASSET_CD", "INCOME_CD", "FILING_REQ_CD",
    "PF_FILING_REQ_CD", "ACCT_PD", "ASSET_AMT", "INCOME_AMT", "REVENUE_AMT", "NTEE_CD",
    "SORT_NAME",
]


def _row(**overrides):
    base = {key: "" for key in HEADER}
    base.update(
        {
            "EIN": "010548049",
            "NAME": "TEST NONPROFIT INC",
            "ZIP": "19130-4074",
            "CITY": "PHILADELPHIA",
            "STATE": "PA",
            "SUBSECTION": "03",
            "STATUS": "01",
            "FOUNDATION": "15",
            "NTEE_CD": "B82",
        }
    )
    base.update(overrides)
    return base


def test_keeps_only_191_zip_codes():
    rows = [_row(), _row(EIN="999999991", ZIP="18103")]
    leads = irs_bmf.parse_rows(rows)
    assert len(leads) == 1
    assert leads[0]["zip"] == "19130"


def test_maps_core_fields_and_keeps_extras():
    rows = [_row()]
    lead = irs_bmf.parse_rows(rows)[0]
    assert lead["ein"] == "010548049"
    assert lead["name"] == "TEST NONPROFIT INC"
    assert lead["irs_subsection"] == "03"
    assert lead["irs_status"] == "01"
    assert lead["ntee"] == "B82"
    assert lead["extra"]["foundation"] == "15"
    assert lead["kind_hint"] == "nonprofit"


def test_congregation_kind_hint_from_ntee_x2():
    rows = [_row(EIN="999999992", NTEE_CD="X20")]
    lead = irs_bmf.parse_rows(rows)[0]
    assert lead["kind_hint"] == "congregation"


def test_congregation_kind_hint_from_church_foundation_code():
    rows = [_row(EIN="999999993", NTEE_CD="", FOUNDATION="10")]
    lead = irs_bmf.parse_rows(rows)[0]
    assert lead["kind_hint"] == "congregation"


def test_ico_becomes_contact_name_without_leading_percent():
    rows = [_row(EIN="999999994", ICO="% COLLEEN WALSH")]
    lead = irs_bmf.parse_rows(rows)[0]
    assert lead["contact_name"] == "COLLEEN WALSH"


def test_parses_the_real_sample_fixture(fixtures_dir):
    with open(fixtures_dir / "eo_pa_sample.csv", encoding="latin-1", newline="") as f:
        rows = list(csv.DictReader(f))
    leads = irs_bmf.parse_rows(rows)
    assert len(leads) == len(rows)  # the sample file is pre-filtered to 191xx ZIPs
    assert all(lead["zip"].startswith("191") for lead in leads)
    assert all(lead["lead_id"].startswith("irs_bmf:") for lead in leads)

import json

import pytest

from fyj.leads import (
    clean_text,
    clean_zip,
    make_lead,
    ordered_lead,
    read_leads_jsonl,
    write_leads_jsonl,
)


def test_make_lead_defaults_everything_else_to_null_or_empty():
    lead = make_lead(
        source="test_src", source_url="https://example.com", native_id="42", name="Thing"
    )
    assert lead["lead_id"] == "test_src:42"
    assert lead["aka"] == []
    assert lead["kind_hint"] is None
    assert lead["website"] is None
    assert lead["social"] == []
    assert lead["extra"] == {}
    assert lead["harvested_at"]  # some ISO date string


def test_lead_id_is_stable_for_the_same_source_and_native_id():
    lead1 = make_lead(source="s", source_url="https://x", native_id="7", name="A")
    lead2 = make_lead(source="s", source_url="https://y", native_id="7", name="A renamed")
    assert lead1["lead_id"] == lead2["lead_id"] == "s:7"


def test_make_lead_requires_a_name():
    with pytest.raises(ValueError):
        make_lead(source="s", source_url="https://x", native_id="1", name="")


def test_make_lead_rejects_unknown_fields():
    with pytest.raises(KeyError):
        make_lead(source="s", source_url="https://x", native_id="1", name="A", not_a_field=True)


def test_write_leads_jsonl_sorts_by_lead_id(tmp_path):
    leads = [
        make_lead(source="s", source_url="https://x", native_id="b", name="B"),
        make_lead(source="s", source_url="https://x", native_id="a", name="A"),
    ]
    path = tmp_path / "s.jsonl"
    count = write_leads_jsonl(path, leads)
    assert count == 2
    lines = path.read_text(encoding="utf-8").splitlines()
    ids = [json.loads(line)["lead_id"] for line in lines]
    assert ids == ["s:a", "s:b"]


def test_write_leads_jsonl_rejects_duplicate_lead_ids(tmp_path):
    leads = [
        make_lead(source="s", source_url="https://x", native_id="a", name="A"),
        make_lead(source="s", source_url="https://x", native_id="a", name="A again"),
    ]
    with pytest.raises(ValueError):
        write_leads_jsonl(tmp_path / "s.jsonl", leads)


def test_write_then_read_round_trips(tmp_path):
    leads = [
        make_lead(
            source="s", source_url="https://x", native_id="1", name="A", email="a@example.com"
        )
    ]
    path = tmp_path / "s.jsonl"
    write_leads_jsonl(path, leads)
    read_back = read_leads_jsonl(path)
    assert len(read_back) == 1
    assert read_back[0]["email"] == "a@example.com"


def test_read_leads_jsonl_missing_file_returns_empty_list(tmp_path):
    assert read_leads_jsonl(tmp_path / "nope.jsonl") == []


def test_ordered_lead_matches_data_model_field_order():
    lead = make_lead(source="s", source_url="https://x", native_id="1", name="A")
    ordered_keys = list(ordered_lead(lead).keys())
    assert ordered_keys[0] == "lead_id"
    assert ordered_keys[-1] == "harvested_at"
    assert ordered_keys.index("source") < ordered_keys.index("name")


def test_clean_zip_handles_zip_plus_four_and_junk():
    assert clean_zip("19130-4074") == "19130"
    assert clean_zip("19130") == "19130"
    assert clean_zip(None) is None
    assert clean_zip("") is None
    assert clean_zip("N/A") is None
    assert clean_zip(19128) == "19128"


def test_clean_text_drops_placeholders_and_collapses_whitespace():
    assert clean_text("  Hello   World  ") == "Hello   World"
    assert clean_text("N/A") is None
    assert clean_text("") is None
    assert clean_text(None) is None
    assert clean_text(".") is None

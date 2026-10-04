from fyj.harvest import city_volunteer_pages as cvp


def test_page_title_prefers_sub_page_title_h2(fixtures_dir):
    html = (fixtures_dir / "phila_gov_page.html").read_text(encoding="utf-8")
    assert cvp._page_title(html) == "Get involved"


def test_page_title_falls_back_to_title_tag_first_segment():
    html = "<title>Some Program | A Department | City of Philadelphia</title>"
    assert cvp._page_title(html) == "Some Program"


def test_department_from_url():
    assert cvp._department_from_url(
        "https://www.phila.gov/departments/town-watch-integrated-services/about/"
    ) == "town watch integrated services"
    assert cvp._department_from_url("https://www.phila.gov/programs/foster-grandparents/") is None


def test_facts_pulls_sentences_with_keywords(fixtures_dir):
    html = (fixtures_dir / "phila_gov_page.html").read_text(encoding="utf-8")
    content_html = cvp._main_content_html(html)
    content_text = cvp.strip_tags(content_html)
    facts = cvp._facts(content_text)
    assert any("14 years old" in fact for fact in facts)
    assert any("clearance" in fact.lower() for fact in facts)


def test_find_links_resolves_relative_and_absolute():
    fragment = '<a href="/a/b/">rel</a><a href="https://example.com/c">abs</a>'
    links = cvp.find_links(fragment, "https://www.phila.gov/x/")
    assert ("https://www.phila.gov/a/b/", "rel") in links
    assert ("https://example.com/c", "abs") in links


def test_matches_keyword():
    assert cvp._matches_keyword("https://www.phila.gov/get-involved/", "")
    assert cvp._matches_keyword("https://www.phila.gov/anything/", "Become a block captain")
    assert not cvp._matches_keyword("https://www.phila.gov/permits/", "Apply for a permit")


def test_harvest_finds_program_and_external_partner_leads(fixtures_dir, monkeypatch):
    html = (fixtures_dir / "phila_gov_page.html").read_text(encoding="utf-8")

    class FakeResponse:
        def __init__(self, text):
            self.text = text

    class FakeClient:
        def __init__(self):
            self.calls = []

        def get_html(self, url, min_delay=0.0):
            self.calls.append(url)
            return FakeResponse(html)

    fake_seed = (
        "https://www.phila.gov/departments/philadelphia-parks-recreation/get-involved/",
    )
    monkeypatch.setattr(cvp, "KNOWN_PAGES", fake_seed)

    leads = cvp.harvest(FakeClient())
    programs = [
        lead
        for lead in leads
        if lead["kind_hint"] == "program" and not lead["extra"].get("external_partner")
    ]
    partners = [lead for lead in leads if lead["extra"].get("external_partner")]

    # the fixture page links to a second www.phila.gov page whose URL contains "volunteer", so
    # the one-hop crawl fetches it too (the fake client serves the same fixture body for every
    # URL); both become their own program lead. The second page's own outgoing links are not
    # followed again, proving the one-hop limit holds.
    assert len(programs) == 2
    assert {lead["name"] for lead in programs} == {"Get involved"}
    assert len({lead["lead_id"] for lead in programs}) == 2

    partner_names = {lead["name"] for lead in partners}
    assert "Love Your Park" in partner_names
    assert any("loveyourpark.org" in lead["website"] for lead in partners)
    # the Google Form link must not become a partner lead
    assert not any("docs.google.com" in lead["website"] for lead in partners)
    # a link back to another phila.gov page must not become a partner lead
    assert not any("phila.gov" in (lead["website"] or "") for lead in partners)

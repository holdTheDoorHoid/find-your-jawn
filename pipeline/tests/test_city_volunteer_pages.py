import httpx

from fyj.harvest import city_volunteer_pages as cvp
from fyj.http import RobotsBlocked


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
    # the one hop crawl frontier is deliberately broad (it only decides what to fetch next);
    # "Joins" containing the substring "join" is exactly why a real page slipped through, and
    # _is_volunteer_page (checked against the fetched page itself, not this match) is the fix.
    assert cvp._matches_keyword(
        "https://www.phila.gov/2026-04-01-philadelphia-joins-cities/", "Philadelphia Joins Cities"
    )


# --- _is_volunteer_page: a page's own title and body decide whether it becomes a lead ---


def test_is_volunteer_page_true_when_title_or_body_has_a_real_signal():
    assert cvp._is_volunteer_page("Volunteering", "")
    assert cvp._is_volunteer_page("Get involved", "")
    assert cvp._is_volunteer_page("Recreation Advisory Councils", "")
    assert cvp._is_volunteer_page(
        "Foster Grandparents",
        "If you become a Foster Grandparent, you'll volunteer 15 to 40 hours a week.",
    )


def test_is_volunteer_page_false_for_generic_index_and_concession_and_job_pages():
    # the exact noise named in the task brief
    assert not cvp._is_volunteer_page(
        "Departments and other agencies", "a landing page of services"
    )
    assert not cvp._is_volunteer_page("All events", "")
    assert not cvp._is_volunteer_page(
        "Concession opportunities", "Anyone who provides goods or services needs a contract."
    )
    assert not cvp._is_volunteer_page("Join the team: open jobs", "We have several job openings.")


def test_is_volunteer_page_false_when_only_the_referring_text_would_have_matched():
    # "Philadelphia Joins Cities" contains the substring "join", but the page's own content
    # (a reentry month announcement) never actually describes a way to volunteer.
    title = "Philadelphia Joins Cities Across the Nation in Honoring Second Chance Month"
    body = (
        "Second Chance Month raises awareness about challenges faced by returning citizens and "
        "encourages employers to offer jobs to people who have served their sentences."
    )
    assert not cvp._is_volunteer_page(title, body)


# --- _external_page_title: naming a partner lead from the partner's own page ---


def test_external_page_title_takes_the_last_segment_as_the_organization_name():
    # Real partner sites checked while fixing this harvester both put the specific page label
    # first and the organization's own name last.
    assert cvp._external_page_title("<title>Volunteer | Love Your Park</title>") == "Love Your Park"
    assert (
        cvp._external_page_title(
            "<title>Home - Independence Blue Cross Broad Street Run</title>"
        )
        == "Independence Blue Cross Broad Street Run"
    )
    assert (
        cvp._external_page_title(
            "<title>Contact - Independence Blue Cross Broad Street Run</title>"
        )
        == "Independence Blue Cross Broad Street Run"
    )


def test_external_page_title_prefers_the_segment_matching_the_site_domain():
    # TreePhilly's real <title> puts the organization's name first, not last, unlike Love Your
    # Park's or Broad Street Run's; passing the host lets the right segment win either way.
    html = "<title>TreePhilly: Making Philadelphia the City of Arborly Love</title>"
    assert cvp._external_page_title(html, host="treephilly.org") == "TreePhilly"
    # without a host to check against, the function still falls back to the last segment
    assert cvp._external_page_title(html) == "Making Philadelphia the City of Arborly Love"


def test_external_page_title_falls_back_to_h1_only_when_no_title_tag():
    html = "<h1>Love Your Park</h1><p>Sign up for a cleanup.</p>"
    assert cvp._external_page_title(html) == "Love Your Park"


def test_external_page_title_rejects_a_long_sentence_shaped_h1():
    # a real bug found while fixing this harvester: Broad Street Run's own <h1> is a marketing
    # sentence, not a name, and must not become a lead's name.
    html = (
        "<h1>The Independence Blue Cross Broad Street Run 10-Miler has been a proud "
        "Philadelphia tradition for 47 years.</h1>"
    )
    assert cvp._external_page_title(html) is None


def test_external_page_title_none_when_nothing_usable():
    assert cvp._external_page_title("<p>No heading here.</p>") is None


# --- _resolve_partner_name: fetch the partner page; fall back only if that fails ---


def test_resolve_partner_name_uses_fetched_partner_title_not_anchor_text():
    class FakeClient:
        def get_html(self, url, min_delay=0.0):
            return type("R", (), {"text": "<h1>Love Your Park</h1>"})()

    name = cvp._resolve_partner_name(
        FakeClient(),
        "https://loveyourpark.org/volunteer/",
        "individual or group volunteer",
        "loveyourpark.org",
    )
    assert name == "Love Your Park"


def test_resolve_partner_name_falls_back_to_anchor_text_when_fetch_fails():
    class FailingClient:
        def get_html(self, url, min_delay=0.0):
            raise httpx.TransportError("boom")

    name = cvp._resolve_partner_name(
        FailingClient(), "https://example.org/x", "Example Partner Org", "example.org"
    )
    assert name == "Example Partner Org"


def test_resolve_partner_name_falls_back_when_robots_blocked():
    class BlockedClient:
        def get_html(self, url, min_delay=0.0):
            raise RobotsBlocked("blocked")

    name = cvp._resolve_partner_name(
        BlockedClient(), "https://example.org/x", "here", "example.org"
    )
    # "here" is a generic anchor text, so the final fallback is the host
    assert name == "example.org"


def test_is_excluded_partner_domain_drops_dot_gov_and_dot_mil():
    assert cvp._is_excluded_partner_domain("aspr.hhs.gov")
    assert cvp._is_excluded_partner_domain("www.ojp.gov")
    assert cvp._is_excluded_partner_domain("serv.pa.gov")
    assert cvp._is_excluded_partner_domain("example.mil")
    assert not cvp._is_excluded_partner_domain("loveyourpark.org")


class _FakeMultiUrlClient:
    """Routes each URL in `responses` to its own fixture text; anything else raises, so a test
    notices if the harvester fetches something it shouldn't."""

    def __init__(self, responses: dict[str, str]):
        self.responses = responses
        self.calls: list[str] = []

    def get_html(self, url, min_delay=0.0):
        self.calls.append(url)
        if url not in self.responses:
            raise httpx.TransportError(f"no fixture response for {url}")
        return type("R", (), {"text": self.responses[url]})()


def test_harvest_names_program_lead_from_its_own_heading_and_partner_from_partner_title(
    fixtures_dir, monkeypatch
):
    main_html = (fixtures_dir / "phila_gov_page.html").read_text(encoding="utf-8")
    partner_html = (fixtures_dir / "love_your_park_partner_page.html").read_text(encoding="utf-8")
    second_hop_url = (
        "https://www.phila.gov/departments/philadelphia-parks-recreation/get-involved/"
        "business-and-individual-volunteer-opportunities/"
    )
    seed_url = "https://www.phila.gov/departments/philadelphia-parks-recreation/get-involved/"

    client = _FakeMultiUrlClient(
        {
            seed_url: main_html,
            second_hop_url: main_html,
            "https://loveyourpark.org/volunteer/": partner_html,
        }
    )
    monkeypatch.setattr(cvp, "KNOWN_PAGES", (seed_url,))

    leads = cvp.harvest(client)
    programs = [
        lead
        for lead in leads
        if lead["kind_hint"] == "program" and not lead["extra"].get("external_partner")
    ]
    partners = [lead for lead in leads if lead["extra"].get("external_partner")]

    # named from the page's own heading (the sub page title h2), not any link text
    assert {lead["name"] for lead in programs} == {"Get involved"}
    assert len(programs) == 2  # the seed page plus the one hop away page it links to

    # named from the partner page's own <h1>, not the anchor text ("Love Your Park") that
    # happened to already be a good name here, nor a worse anchor text elsewhere on the same
    # fixture page pointing at the same host
    love_your_park = next(lead for lead in partners if "loveyourpark.org" in lead["website"])
    assert love_your_park["name"] == "Love Your Park"

    # the Google Form link must not become a partner lead
    assert not any("docs.google.com" in (lead["website"] or "") for lead in partners)
    # a link back to another phila.gov page must not become a partner lead
    assert not any("phila.gov" in (lead["website"] or "") for lead in partners)


def test_harvest_drops_non_volunteer_pages_and_does_not_mine_their_partner_links(
    fixtures_dir, monkeypatch
):
    concession_html = (fixtures_dir / "phila_gov_concession_page.html").read_text(encoding="utf-8")
    seed_url = (
        "https://www.phila.gov/departments/philadelphia-parks-recreation/get-involved/"
        "concession-opportunities/"
    )

    client = _FakeMultiUrlClient({seed_url: concession_html})
    monkeypatch.setattr(cvp, "KNOWN_PAGES", (seed_url,))

    leads = cvp.harvest(client)

    # the concession page itself is not a volunteer program and must not become a lead
    assert not any(lead["name"] == "Concession opportunities" for lead in leads)
    # its own outgoing link (a stand in for the real Department of Justice link found in the
    # original run) must not be mined into a partner lead, since the page it came from isn't
    # itself a real volunteer or join page
    assert leads == []
    assert "https://www.ojp.gov/some-reference-page" not in client.calls

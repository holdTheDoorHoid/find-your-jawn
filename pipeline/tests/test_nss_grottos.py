from fyj.harvest import nss_grottos


def test_parses_grotto_cards_from_fixture(fixtures_dir):
    html = (fixtures_dir / "nss_grottos_page.html").read_text(encoding="utf-8")
    leads = nss_grottos.parse_listing(html, source_url="https://caves.org/state/pennsylvania/")
    assert len(leads) == 3
    names = {lead["name"] for lead in leads}
    assert names == {"Bucks County Grotto", "Philadelphia Grotto", "Nittany Grotto"}
    assert all(lead["kind_hint"] == "club" for lead in leads)


def test_philadelphia_area_flag():
    html = (
        "<h3 class=\"fl-post-title\">Philadelphia Grotto</h2>"
        "<span class=\"grotto-address\">13 Levis Avenue\nMedia, PA 19063</span>"
        "<div class=\"fl-post-more-link arrow-link\">"
        "<a href='https://caves.org/grotto/philadelphia-grotto/' "
        "title='VIEW DETAILS'>VIEW DETAILS</a></div>"
    )
    lead = nss_grottos.parse_listing(html)[0]
    assert lead["extra"]["philadelphia_area"] is True


def test_non_philadelphia_area_grotto_is_not_flagged():
    html = (
        "<h3 class=\"fl-post-title\">Nittany Grotto</h2>"
        "<span class=\"grotto-address\">PO Box 685\nState College, PA 16804-0676</span>"
        "<div class=\"fl-post-more-link arrow-link\">"
        "<a href='https://caves.org/grotto/nittany-grotto/' "
        "title='VIEW DETAILS'>VIEW DETAILS</a></div>"
    )
    lead = nss_grottos.parse_listing(html)[0]
    assert lead["extra"]["philadelphia_area"] is False

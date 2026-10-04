from fyj.htmlutil import info_rows, requirement_texts, section_text, strip_tags


def test_strip_tags_unescapes_and_collapses_whitespace():
    assert strip_tags("<p>Hello &amp;   <b>World</b></p>") == "Hello & World"
    assert strip_tags(None) is None
    assert strip_tags("   ") is None


def test_section_text_stops_at_the_next_header():
    html = (
        '<h2 class="section-header">Who We Are</h2>'
        "<div>We are a test org.</div>"
        '<h2 class="section-header">What We Do</h2>'
        "<div>We do tests.</div>"
    )
    text, _ = section_text(html, "Who We Are")
    assert text == "We are a test org."


def test_section_text_missing_header_returns_none():
    text, pos = section_text("<p>nothing here</p>", "Nope")
    assert text is None
    assert pos == 0


def test_info_rows_extracts_td_text_values():
    html = (
        '<tr class="phone"><td class="icon"></td><td class="text">215-555-0100</td></tr>'
        '<tr class="email"><td class="icon"></td><td class="text">a@example.com</td></tr>'
    )
    rows = info_rows(html, ("phone", "email", "address"))
    assert rows == {"phone": "215-555-0100", "email": "a@example.com"}


def test_requirement_texts_collects_every_row():
    html = (
        '<tr class="requirement"><td class="text">16 and older</td></tr>'
        '<tr class="requirement"><td class="text">Bring ID</td></tr>'
    )
    assert requirement_texts(html) == ["16 and older", "Bring ID"]

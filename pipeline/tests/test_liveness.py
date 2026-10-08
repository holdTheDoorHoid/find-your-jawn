import datetime as dt
import json

import httpx
from helpers import make_group

from fyj.checks import page_cache_path
from fyj.cli import main
from fyj.http import USER_AGENT, FyjClient
from fyj.liveness import (
    Checker,
    feed_dates,
    newest_month,
    normalize_url,
    parked_reason,
    read_page,
    read_results,
    run_liveness,
    sitemap_dates,
)

TODAY = dt.date(2026, 10, 8)

ALIVE = """<html><head><title>Philly Grotto</title>
<meta property="article:modified_time" content="2026-08-14T10:00:00Z">
<link rel="alternate" type="application/rss+xml" href="/feed.xml"></head>
<body><h1>Welcome</h1><p>Our next trip is in the fall.</p>
<time datetime="2026-09-12">Sept 12</time>
<footer>Copyright 2026 Philly Grotto. All rights reserved.</footer></body></html>"""
OLD = """<html><head><title>Old club</title></head><body>
<p>Posted March 3, 2019: meeting notes.</p>
<footer>&copy; 2026 Old Club</footer></body></html>"""
PARKED = (
    "<html><head><title>x.org</title></head>"
    "<body>This domain is for sale. Buy this domain.</body></html>"
)
GAMBLING = (
    "<html><head><title>Slot Gacor Hari Ini</title></head><body>slot online togel</body></html>"
)
FEED = """<?xml version="1.0"?><rss><channel>
<lastBuildDate>Thu, 08 Oct 2026 00:00:00 +0000</lastBuildDate>
<item><title>a</title><pubDate>Tue, 07 Oct 2025 12:00:00 +0000</pubDate></item></channel></rss>"""
SITEMAP = """<?xml version="1.0"?><urlset><url><loc>https://sitemap.org/a</loc>
<lastmod>2026-05-20</lastmod></url></urlset>"""


def make_transport(requests_seen):
    def handler(request: httpx.Request) -> httpx.Response:
        requests_seen.append(str(request.url))
        assert request.headers["user-agent"] == USER_AGENT
        host, path = request.url.host, request.url.path
        if path == "/robots.txt":
            if host == "robots.org":
                return httpx.Response(200, text="User-agent: *\nDisallow: /\n")
            return httpx.Response(404)
        if host == "alive.org":
            if path == "/feed.xml":
                return httpx.Response(200, text=FEED)
            if path == "/sitemap.xml":
                return httpx.Response(404)
            return httpx.Response(200, text=ALIVE, headers={"content-type": "text/html"})
        if host == "sitemap.org":
            if path == "/sitemap.xml":
                return httpx.Response(200, text=SITEMAP)
            return httpx.Response(200, text="<html><body>Hello</body></html>")
        if host == "old.org":
            return httpx.Response(200, text=OLD)
        if host == "parked.org":
            return httpx.Response(200, text=PARKED)
        if host == "casino.org":
            return httpx.Response(200, text=GAMBLING)
        if host == "moved.org":
            return httpx.Response(301, headers={"location": "https://alive.org/"})
        if host == "gone.org":
            return httpx.Response(404, text="not found")
        if host == "blocked.org":
            return httpx.Response(403, text="forbidden")
        if host == "bot.org":
            return httpx.Response(200, text="<html><title>Just a moment...</title></html>")
        if host == "nodns.org":
            raise httpx.ConnectError("[Errno -2] Name or service not known")
        if host == "slow.org":
            raise httpx.ReadTimeout("timed out")
        if host == "broken.org":
            return httpx.Response(500, text="oops")
        return httpx.Response(404)

    return httpx.MockTransport(handler)


def checker(tmp_path, seen=None):
    client = FyjClient(
        cache_root=tmp_path, transport=make_transport(seen if seen is not None else [])
    )
    return Checker(client, tmp_path / "pages", TODAY, sleep_between=0)


def test_normalize_url_adds_https():
    assert normalize_url("phillygrotto.org") == "https://phillygrotto.org"
    assert normalize_url("http://x.org/a") == "http://x.org/a"


def test_read_page_finds_dates_in_tags_and_ignores_the_copyright_footer():
    facts = read_page(ALIVE)
    assert facts.title == "Philly Grotto"
    assert (2026, 9, 12) in facts.dates and (2026, 8, 14) in facts.dates
    assert facts.feeds == ["/feed.xml"]
    old = read_page(OLD)
    assert newest_month(old.dates, TODAY) == "2019-03"
    assert "Posted March 3, 2019" in old.text


def test_visible_dates_in_several_forms():
    html = "<p>Meeting October 4, 2026. Minutes 10/4/2025. Notes 2024-02-09. Spring 2023.</p>"
    facts = read_page(html)
    assert newest_month(facts.dates, TODAY) == "2026-10"
    assert (2023, 4, None) not in facts.dates


def test_newest_month_clamps_upcoming_dates_and_drops_far_future_noise():
    assert newest_month([(2026, 11, 5)], TODAY) == "2026-10"
    assert newest_month([(2030, 1, None)], TODAY) is None
    assert newest_month([(1990, 5, 1)], TODAY) is None
    assert newest_month([], TODAY) is None


def test_feed_dates_use_items_not_the_build_date():
    assert feed_dates(FEED) == [(2025, 10, 7)]
    atom = (
        "<feed><updated>2026-10-01T00:00:00Z</updated>"
        "<entry><updated>2025-02-03T00:00:00Z</updated></entry></feed>"
    )
    assert feed_dates(atom) == [(2025, 2, 3)]
    assert sitemap_dates(SITEMAP) == [(2026, 5, 20)]


def test_parking_and_gambling_pages_are_recognized():
    assert parked_reason("https://x.org/", read_page(PARKED)) == "parked domain"
    assert parked_reason("https://x.org/", read_page(GAMBLING)) == "gambling page"
    assert parked_reason("https://www.sedoparking.com/x", read_page("<p>hi</p>")) == "parked domain"
    assert parked_reason("https://phillygrotto.org/", read_page(ALIVE)) is None


def test_alive_site_reports_the_newest_month_and_where_it_found_it(tmp_path):
    seen: list[str] = []
    result = checker(tmp_path, seen).check("grotto", "alive.org")
    assert result["verdict"] == "alive" and result["http_status"] == 200
    assert result["newest_date"] == "2026-09"
    assert result["evidence_url"] == "https://alive.org"
    assert result["final_url"] == "https://alive.org"
    assert result["note"] is None
    assert result["group_id"] == "grotto"
    assert any(u.endswith("/feed.xml") for u in seen) and any(
        u.endswith("/sitemap.xml") for u in seen
    )


def test_sitemap_lastmod_counts_as_evidence(tmp_path):
    result = checker(tmp_path).check("s", "https://sitemap.org")
    assert result["verdict"] == "alive"
    assert result["newest_date"] == "2026-05"
    assert result["evidence_url"] == "https://sitemap.org/sitemap.xml"


def test_old_site_is_alive_but_with_an_old_date(tmp_path):
    result = checker(tmp_path).check("old", "old.org")
    assert result["verdict"] == "alive" and result["newest_date"] == "2019-03"


def test_dead_blocked_and_unknown_cases(tmp_path):
    c = checker(tmp_path)
    assert c.check("a", "parked.org")["verdict"] == "dead"
    assert c.check("a", "casino.org")["note"] == "gambling page"
    assert c.check("a", "gone.org")["verdict"] == "dead"
    assert c.check("a", "nodns.org")["verdict"] == "dead"
    assert c.check("a", "blocked.org")["verdict"] == "blocked"
    assert c.check("a", "bot.org")["verdict"] == "blocked"
    slow = c.check("a", "slow.org")
    assert slow["verdict"] == "unknown" and slow["note"] == "timed out"
    assert c.check("a", "broken.org")["verdict"] == "unknown"


def test_things_that_are_not_web_addresses_are_unknown_not_dead(tmp_path):
    seen: list[str] = []
    c = checker(tmp_path, seen)
    for junk in ("Celestial", "Tom Wible", "CPA", "n/a"):
        result = c.check("x", junk)
        assert result["verdict"] == "unknown" and result["note"] == "not a web address"
    assert seen == []


def test_robots_txt_is_respected_and_nothing_else_is_fetched(tmp_path):
    seen: list[str] = []
    result = checker(tmp_path, seen).check("r", "robots.org")
    assert result["verdict"] == "blocked" and "robots" in result["note"]
    assert seen == ["https://robots.org/robots.txt"]


def test_a_redirect_to_another_domain_is_recorded(tmp_path):
    result = checker(tmp_path).check("m", "moved.org")
    assert result["verdict"] == "alive"
    assert result["final_url"] == "https://alive.org/"
    assert result["note"] == "redirects to alive.org"


def test_page_text_is_cached_by_url_hash_and_capped(tmp_path):
    checker(tmp_path).check("grotto", "alive.org")
    path = page_cache_path(tmp_path / "pages", "https://alive.org")
    assert path.exists()
    text = path.read_text(encoding="utf-8")
    assert "Our next trip is in the fall." in text and "<html" not in text
    assert len(text) <= 50_000


def test_run_liveness_selects_checks_and_writes_jsonl(layout, tmp_path):
    for gid, site in [
        ("a-alive", "alive.org"),
        ("b-old", "old.org"),
        ("c-gone", "gone.org"),
        ("d-none", None),
    ]:
        make_group(layout, gid, gid, contacts={"website": site})
    make_group(
        layout,
        "e-hidden",
        "e",
        contacts={"website": "alive.org"},
        hidden=True,
        hidden_reason="defunct",
    )
    seen: list[str] = []
    client = FyjClient(cache_root=tmp_path, transport=make_transport(seen))
    counts = run_liveness(
        layout, client=client, limit=2, pages_dir=tmp_path / "pages", today=TODAY, sleep_between=0
    )
    assert counts["checked"] == 2
    results = read_results(layout.liveness_path)
    assert sorted(results) == ["a-alive", "b-old"]
    first = results["a-alive"]
    assert set(first) == {
        "group_id",
        "url",
        "checked_at",
        "http_status",
        "final_url",
        "newest_date",
        "evidence_url",
        "verdict",
        "note",
    }
    # the next run takes the groups never checked, then stops at the limit again
    run_liveness(
        layout, client=client, limit=2, pages_dir=tmp_path / "pages", today=TODAY, sleep_between=0
    )
    assert sorted(read_results(layout.liveness_path)) == ["a-alive", "b-old", "c-gone"]
    lines = layout.liveness_path.read_text(encoding="utf-8").splitlines()
    assert [json.loads(x)["group_id"] for x in lines] == ["a-alive", "b-old", "c-gone"]


def test_only_file_and_stale_days(layout, tmp_path):
    make_group(layout, "a-alive", "a", contacts={"website": "alive.org"})
    make_group(layout, "b-old", "b", contacts={"website": "old.org"})
    ids = tmp_path / "ids.txt"
    ids.write_text("b-old\n# comment\n", encoding="utf-8")
    from fyj.liveness import read_id_list

    client = FyjClient(cache_root=tmp_path, transport=make_transport([]))
    run_liveness(
        layout,
        client=client,
        only=read_id_list(ids),
        pages_dir=tmp_path / "p",
        today=TODAY,
        sleep_between=0,
    )
    assert sorted(read_results(layout.liveness_path)) == ["b-old"]
    again = run_liveness(
        layout,
        client=client,
        stale_days=7,
        pages_dir=tmp_path / "p",
        today=dt.date.today(),
        sleep_between=0,
    )
    assert again["checked"] == 1  # only a-alive: b-old was just checked
    assert sorted(read_results(layout.liveness_path)) == ["a-alive", "b-old"]


def test_cli_liveness_runs_with_a_limit(layout, monkeypatch, capsys, tmp_path):
    make_group(layout, "a-alive", "a", contacts={"website": "alive.org"})
    monkeypatch.setenv("FYJ_ROOT", str(layout.root))
    monkeypatch.setenv("FYJ_CACHE", str(tmp_path / "cache"))
    import fyj.cli as cli

    real = cli.FyjClient

    def fake_client(*args, **kwargs):
        return real(*args, transport=make_transport([]), **kwargs)

    monkeypatch.setattr(cli, "FyjClient", fake_client)
    main(["liveness", "--limit", "1", "--delay", "0"])
    out = capsys.readouterr().out
    assert "checked 1" in out and "alive 1" in out

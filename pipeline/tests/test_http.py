import time

import httpx
import pytest

from fyj.http import USER_AGENT, FyjClient, RobotsBlocked


def test_user_agent_matches_claude_md():
    assert USER_AGENT == "FindYourJawn/0.1 (+https://github.com/holdTheDoorHoid/find-your-jawn)"


def test_robots_allowed_true_when_robots_txt_is_missing(tmp_path):
    client = FyjClient(cache_root=tmp_path)

    def fake_get(url, **kwargs):
        return httpx.Response(404, request=httpx.Request("GET", url))

    client._client.get = fake_get  # type: ignore[assignment]
    assert client.robots_allowed("https://example.com/anything") is True


def test_robots_allowed_false_when_disallowed(tmp_path):
    client = FyjClient(cache_root=tmp_path)
    robots_body = "User-agent: *\nDisallow: /engage/api/\n"

    def fake_get(url, **kwargs):
        return httpx.Response(200, text=robots_body, request=httpx.Request("GET", url))

    client._client.get = fake_get  # type: ignore[assignment]
    assert client.robots_allowed("https://example.com/engage/api/thing") is False
    assert client.robots_allowed("https://example.com/other") is True


def test_polite_delay_waits_at_least_min_seconds(tmp_path):
    client = FyjClient(cache_root=tmp_path)
    url = "https://example.com/a"
    client.polite_delay(url, min_seconds=0.2)
    start = time.monotonic()
    client.polite_delay(url, min_seconds=0.2)
    elapsed = time.monotonic() - start
    assert elapsed >= 0.15  # allow a little scheduling slack


def test_polite_delay_does_not_wait_for_a_different_host(tmp_path):
    client = FyjClient(cache_root=tmp_path)
    client.polite_delay("https://example.com/a", min_seconds=5.0)
    start = time.monotonic()
    client.polite_delay("https://other.com/a", min_seconds=5.0)
    elapsed = time.monotonic() - start
    assert elapsed < 1.0


def test_get_html_raises_robots_blocked_rather_than_fetching(tmp_path):
    client = FyjClient(cache_root=tmp_path)

    def fake_robots_get(url, **kwargs):
        body = "User-agent: *\nDisallow: /\n"
        return httpx.Response(200, text=body, request=httpx.Request("GET", url))

    client._client.get = fake_robots_get  # type: ignore[assignment]

    called = False

    def fake_request(*args, **kwargs):
        nonlocal called
        called = True
        raise AssertionError("should not have fetched a disallowed URL")

    client.request = fake_request  # type: ignore[assignment]

    with pytest.raises(RobotsBlocked):
        client.get_html("https://example.com/private")
    assert not called

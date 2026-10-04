"""Shared HTTP client for harvesters.

One client to carry the User-Agent required by CLAUDE.md, retry transient failures with
backoff, check robots.txt before any HTML fetch, keep at least a one second gap between
requests to the same host for HTML pages, and cache large raw downloads on disk.
"""

from __future__ import annotations

import time
import urllib.robotparser
from pathlib import Path
from urllib.parse import urlsplit

import httpx

from fyj.paths import cache_dir

USER_AGENT = "FindYourJawn/0.1 (+https://github.com/holdTheDoorHoid/find-your-jawn)"

DEFAULT_TIMEOUT = 30.0
DEFAULT_MAX_RETRIES = 3
DEFAULT_BACKOFF_SECONDS = 1.5
HTML_MIN_DELAY_SECONDS = 1.0


class RobotsBlocked(RuntimeError):
    """Raised when a fetch is disallowed by robots.txt. Harvesters should catch this,
    report it, and move on rather than working around it."""


class FyjClient:
    """A small wrapper around httpx.Client with the manners this project requires."""

    def __init__(
        self,
        user_agent: str = USER_AGENT,
        cache_root: Path | None = None,
        timeout: float = DEFAULT_TIMEOUT,
    ) -> None:
        self.user_agent = user_agent
        self.cache_root = cache_root or cache_dir()
        self._client = httpx.Client(
            headers={"User-Agent": user_agent}, timeout=timeout, follow_redirects=True
        )
        self._last_request_at: dict[str, float] = {}
        self._robots_cache: dict[str, urllib.robotparser.RobotFileParser] = {}

    def close(self) -> None:
        self._client.close()

    def __enter__(self) -> FyjClient:
        return self

    def __exit__(self, *exc_info: object) -> None:
        self.close()

    # -- low level request with retry -------------------------------------------------

    def request(
        self,
        method: str,
        url: str,
        *,
        params: dict | None = None,
        max_retries: int = DEFAULT_MAX_RETRIES,
        backoff_seconds: float = DEFAULT_BACKOFF_SECONDS,
        **kwargs: object,
    ) -> httpx.Response:
        last_exc: Exception | None = None
        for attempt in range(max_retries):
            try:
                resp = self._client.request(method, url, params=params, **kwargs)
                if resp.status_code >= 500:
                    resp.raise_for_status()
                return resp
            except (httpx.TransportError, httpx.HTTPStatusError) as exc:
                last_exc = exc
                if attempt == max_retries - 1:
                    raise
                time.sleep(backoff_seconds * (2**attempt))
        # unreachable, but keeps type checkers happy
        assert last_exc is not None
        raise last_exc

    def get(self, url: str, *, params: dict | None = None, **kwargs: object) -> httpx.Response:
        return self.request("GET", url, params=params, **kwargs)

    def get_json(self, url: str, *, params: dict | None = None) -> dict:
        resp = self.get(url, params=params)
        resp.raise_for_status()
        return resp.json()

    # -- politeness ---------------------------------------------------------------------

    def _host(self, url: str) -> str:
        return urlsplit(url).netloc

    def polite_delay(self, url: str, min_seconds: float = HTML_MIN_DELAY_SECONDS) -> None:
        """Block until at least `min_seconds` have passed since the last request to this host."""
        host = self._host(url)
        now = time.monotonic()
        last = self._last_request_at.get(host)
        if last is not None:
            elapsed = now - last
            if elapsed < min_seconds:
                time.sleep(min_seconds - elapsed)
        self._last_request_at[host] = time.monotonic()

    # -- robots.txt -----------------------------------------------------------------------

    def robots_allowed(self, url: str) -> bool:
        """True if robots.txt allows this user agent to fetch `url`.

        A missing or error-returning robots.txt is treated as "allow" (standard convention).
        Results are cached per host for the life of the client.
        """
        parts = urlsplit(url)
        host = parts.netloc
        parser = self._robots_cache.get(host)
        if parser is None:
            parser = urllib.robotparser.RobotFileParser()
            robots_url = f"{parts.scheme}://{host}/robots.txt"
            try:
                resp = self._client.get(robots_url)
                if resp.status_code >= 400:
                    parser.allow_all = True
                else:
                    parser.parse(resp.text.splitlines())
            except httpx.TransportError:
                parser.allow_all = True
            self._robots_cache[host] = parser
        return parser.can_fetch(self.user_agent, url)

    def get_html(
        self, url: str, *, params: dict | None = None, min_delay: float = HTML_MIN_DELAY_SECONDS
    ) -> httpx.Response:
        """Fetch an HTML page: checks robots.txt first, then waits out the polite delay.

        Raises RobotsBlocked if disallowed, rather than fetching anyway. `min_delay` defaults to
        one second (the project wide minimum) but a harvester can ask for a larger gap.
        """
        if not self.robots_allowed(url):
            raise RobotsBlocked(url)
        self.polite_delay(url, min_seconds=min_delay)
        resp = self.get(url, params=params)
        resp.raise_for_status()
        return resp

    # -- caching for large downloads -------------------------------------------------------

    def download_to_cache(self, url: str, cache_key: str, *, force: bool = False) -> Path:
        """Stream a (potentially large) file to $FYJ_CACHE/<cache_key>, reusing it if present."""
        path = self.cache_root / cache_key
        path.parent.mkdir(parents=True, exist_ok=True)
        if path.exists() and not force:
            return path
        tmp_path = path.with_name(path.name + ".part")
        with self._client.stream("GET", url) as resp:
            resp.raise_for_status()
            with open(tmp_path, "wb") as f:
                for chunk in resp.iter_bytes(chunk_size=1024 * 1024):
                    f.write(chunk)
        tmp_path.rename(path)
        return path

    def head_ok(self, url: str) -> bool:
        """True if a HEAD request to `url` returns a success status. Used to probe for the
        newest file in a dated series without downloading it."""
        try:
            resp = self.request("HEAD", url, max_retries=1)
        except httpx.HTTPStatusError:
            return False
        except httpx.TransportError:
            return False
        return resp.status_code == 200

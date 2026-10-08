"""`fyj liveness`: a polite sign of life checker for group websites.

For each group with a website it records the final URL and HTTP status, whether the address now
leads to another domain (a parked or gambling page counts as dead), and the newest year and month
it can find on the site: <time> tags, article date meta tags, JSON-LD, the sitemap, an RSS or Atom
feed, and dates written out in the page text (copyright footers are ignored). It respects
robots.txt, sends the project User-Agent, makes at most four requests per site, and never logs in or
gets around a block: a 403 or a bot check is recorded as `blocked`.

Results go to data/liveness.jsonl. The plain text of each home page (capped at 50 KB) is saved to
$FYJ_CACHE/pages/ so the own words check can compare against it.
"""

from __future__ import annotations

import datetime as _dt
import json
import re
import threading
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from html.parser import HTMLParser
from pathlib import Path
from typing import Any
from urllib.parse import urljoin, urlsplit

import httpx

from fyj.checks import default_pages_dir, page_cache_path
from fyj.dates import find_dates, parse_loose
from fyj.groupfile import GroupStore
from fyj.http import CappedResponse, FyjClient
from fyj.paths import Layout
from fyj.textutil import registrable_domain, website_domain

CONCURRENCY = 4
TIMEOUT = 10.0
PAGE_BYTES = 1_500_000
FEED_BYTES = 400_000
TEXT_CAP = 50_000
MAX_FUTURE_MONTHS = 12

PARKING_HOSTS = (
    "sedoparking.com",
    "hugedomains.com",
    "dan.com",
    "afternic.com",
    "parkingcrew.net",
    "bodis.com",
    "above.com",
    "domainsponsor.com",
    "parkingpage.namecheap.com",
    "sedo.com",
    "undeveloped.com",
    "godaddy.com/forsale",
)
PARKING_PHRASES = (
    "this domain is for sale",
    "domain is for sale",
    "buy this domain",
    "this domain may be for sale",
    "make an offer on this domain",
    "domain for sale",
    "this web page is parked",
    "this site is parked",
    "this domain is parked",
    "parked free",
    "domain parking",
    "the domain name is available",
    "this domain has expired",
    "inquire about this domain",
)
GAMBLING_PHRASES = (
    "slot gacor",
    "slot online",
    "togel",
    "judi online",
    "situs slot",
    "sbobet",
    "casino online",
    "sportsbook",
    "bandar",
    "slot88",
    "maxwin",
    "pragmatic play",
    "online betting",
    "agen judi",
    "poker online",
    "scatter hitam",
)
BOT_CHECK_PHRASES = (
    "just a moment",
    "checking your browser",
    "captcha",
    "access denied",
    "attention required",
    "are you a robot",
    "verify you are human",
    "request blocked",
)
DNS_DEAD = ("name or service not known", "nodename nor servname", "no address associated")


# -- reading a page ---------------------------------------------------------------------------


class _Page(HTMLParser):
    """Collects the visible text, the title, date hints in tags, and feed links from one page."""

    _SKIP = {"script", "style", "noscript", "svg", "template", "head"}

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.text: list[str] = []
        self.title = ""
        self.time_values: list[str] = []
        self.meta: dict[str, str] = {}
        self.feeds: list[str] = []
        self.jsonld: list[str] = []
        self._skip = 0
        self._in_title = False
        self._in_jsonld = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        a = {k.lower(): (v or "") for k, v in attrs}
        if tag == "title":
            self._in_title = True
        elif tag == "meta":
            key = (a.get("property") or a.get("name") or a.get("itemprop") or "").lower()
            if key and a.get("content"):
                self.meta.setdefault(key, a["content"])
        elif tag == "time" and a.get("datetime"):
            self.time_values.append(a["datetime"])
        elif tag == "link" and "alternate" in a.get("rel", "").lower():
            if re.search(r"rss|atom", a.get("type", ""), re.I) and a.get("href"):
                self.feeds.append(a["href"])
        elif tag == "script" and "ld+json" in a.get("type", "").lower():
            self._in_jsonld = True
        elif tag in self._SKIP and tag != "head":
            self._skip += 1
        if tag in ("p", "br", "div", "li", "h1", "h2", "h3", "tr", "section", "article"):
            self.text.append("\n")

    def handle_endtag(self, tag: str) -> None:
        if tag == "title":
            self._in_title = False
        elif tag == "script" and self._in_jsonld:
            self._in_jsonld = False
        elif tag in self._SKIP and tag != "head" and self._skip:
            self._skip -= 1

    def handle_data(self, data: str) -> None:
        if self._in_title:
            self.title += data
        elif self._in_jsonld:
            self.jsonld.append(data)
        elif not self._skip:
            self.text.append(data)


@dataclass
class PageFacts:
    title: str
    text: str
    dates: list[tuple[int, int, int | None]]
    feeds: list[str]


_COPYRIGHT = re.compile(
    r"(?:©|&copy;|\(c\)|copyright)\s*(?:\(c\)\s*)?\d{4}(?:\s*[-–—]\s*\d{4})?[^\n.]{0,60}"
    r"|all rights reserved",
    re.I,
)
_JSONLD_DATE = re.compile(
    r'"(?:dateModified|datePublished|dateCreated|uploadDate)"\s*:\s*"([^"]+)"'
)
_META_DATE_KEYS = (
    "article:modified_time",
    "article:published_time",
    "og:updated_time",
    "og:published_time",
    "datemodified",
    "datepublished",
    "date",
    "dc.date",
    "dc.date.modified",
    "last-modified",
    "pubdate",
    "sailthru.date",
)


def read_page(html: str) -> PageFacts:
    parser = _Page()
    try:
        parser.feed(html)
        parser.close()
    except Exception:  # noqa: BLE001 (broken markup must not stop a check)
        pass
    raw_text = re.sub(r"[ \t\r\f\v]+", " ", "".join(parser.text))
    raw_text = re.sub(r"\n\s*\n+", "\n", raw_text).strip()
    text_no_copyright = _COPYRIGHT.sub(" ", raw_text)
    dates: list[tuple[int, int, int | None]] = []
    for value in parser.time_values:
        if parsed := parse_loose(value):
            dates.append(parsed)
    for key in _META_DATE_KEYS:
        if key in parser.meta and (parsed := parse_loose(parser.meta[key])):
            dates.append(parsed)
    for blob in parser.jsonld:
        for value in _JSONLD_DATE.findall(blob):
            if parsed := parse_loose(value):
                dates.append(parsed)
    dates.extend(find_dates(text_no_copyright))
    return PageFacts(
        title=" ".join(parser.title.split()),
        text=raw_text[:TEXT_CAP],
        dates=dates,
        feeds=parser.feeds,
    )


def newest_month(dates: list[tuple[int, int, int | None]], today: _dt.date) -> str | None:
    """The newest year and month among `dates`, as YYYY-MM. Dates far in the future are noise and
    ignored; an upcoming date within a year counts as this month (the group plans something)."""
    limit = today.year * 12 + today.month + MAX_FUTURE_MONTHS
    best: int | None = None
    for year, month, _day in dates:
        index = year * 12 + month
        if year < 1998 or index > limit:
            continue
        best = index if best is None else max(best, index)
    if best is None:
        return None
    best = min(best, today.year * 12 + today.month)
    year, month = divmod(best - 1, 12)
    return f"{year:04d}-{month + 1:02d}"


_FEED_DATE = re.compile(
    r"<(?:pubDate|published|updated|dc:date)>\s*([^<]+?)\s*</(?:pubDate|published|updated|dc:date)>",
    re.I,
)
_SITEMAP_LASTMOD = re.compile(r"<lastmod>\s*([^<]+?)\s*</lastmod>", re.I)


def feed_dates(xml: str) -> list[tuple[int, int, int | None]]:
    """Item and entry dates of an RSS or Atom feed (the feed's own build date is not evidence)."""
    body = re.sub(r"<lastBuildDate>.*?</lastBuildDate>", "", xml, flags=re.S | re.I)
    first = re.search(r"<(?:item|entry)\b", body, re.I)
    body = body[first.start() :] if first else ""
    return [p for v in _FEED_DATE.findall(body) if (p := parse_loose(v))]


def sitemap_dates(xml: str) -> list[tuple[int, int, int | None]]:
    return [p for v in _SITEMAP_LASTMOD.findall(xml) if (p := parse_loose(v))]


def parked_reason(final_url: str, facts: PageFacts) -> str | None:
    host = (urlsplit(final_url).hostname or "").lower()
    if any(host == h or host.endswith("." + h) for h in PARKING_HOSTS if "/" not in h):
        return "parked domain"
    haystack = f"{facts.title} {facts.text[:6000]}".lower()
    if any(phrase in haystack for phrase in PARKING_PHRASES):
        return "parked domain"
    title = facts.title.lower()
    hits = {p for p in GAMBLING_PHRASES if p in haystack}
    if len(hits) >= 2 or any(p in title for p in GAMBLING_PHRASES):
        return "gambling page"
    return None


# -- fetching ----------------------------------------------------------------------------------


def normalize_url(raw: str) -> str:
    url = raw.strip()
    if not re.match(r"^[a-z][a-z0-9+.-]*://", url, re.I):
        url = "https://" + url
    return url


class Checker:
    """Checks one site at a time; safe to call from several threads."""

    def __init__(
        self, client: FyjClient, pages_dir: Path | None, today: _dt.date, sleep_between: float = 1.0
    ) -> None:
        self.client = client
        self.pages_dir = pages_dir
        self.today = today
        self.sleep_between = sleep_between
        self._host_locks: dict[str, threading.Lock] = {}
        self._lock = threading.Lock()

    def _host_lock(self, url: str) -> threading.Lock:
        host = urlsplit(url).netloc
        with self._lock:
            return self._host_locks.setdefault(host, threading.Lock())

    def _get(self, url: str, max_bytes: int) -> CappedResponse:
        with self._host_lock(url):
            self.client.polite_delay(url, min_seconds=self.sleep_between)
            return self.client.get_capped(url, max_bytes=max_bytes)

    def _allowed(self, url: str) -> bool:
        try:
            return self.client.robots_allowed(url)
        except Exception:  # noqa: BLE001 (an unreadable robots.txt means allow, the convention)
            return True

    def check(self, group_id: str, website: str) -> dict[str, Any]:
        url = normalize_url(website)
        checked_at = (
            _dt.datetime.now(_dt.UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")
        )
        result: dict[str, Any] = {
            "group_id": group_id,
            "url": url,
            "checked_at": checked_at,
            "http_status": None,
            "final_url": None,
            "newest_date": None,
            "evidence_url": None,
            "verdict": "unknown",
            "note": None,
        }
        if website_domain(url) is None or " " in website.strip():
            result.update(note="not a web address")  # some filings put a name in the website box
            return result
        if not self._allowed(url):
            result.update(verdict="blocked", note="robots.txt does not allow this page")
            return result
        try:
            page = self._fetch_home(url)
        except httpx.HTTPError as exc:
            message = str(exc).lower()
            if isinstance(exc, httpx.ConnectError) and any(m in message for m in DNS_DEAD):
                result.update(verdict="dead", note="the address does not resolve")
            elif isinstance(exc, httpx.TimeoutException):
                result.update(note="timed out")
            else:
                result.update(note=f"{type(exc).__name__}")
            return result
        result["http_status"] = page.status_code
        result["final_url"] = page.url
        status = page.status_code
        lowered = page.text[:3000].lower()
        if status in (401, 403, 429, 451) or (
            status in (503, 200)
            and any(p in lowered for p in BOT_CHECK_PHRASES)
            and len(page.text) < 8000
        ):
            result.update(verdict="blocked", note="the site refused or asked for a bot check")
            return result
        if status in (404, 410):
            result.update(verdict="dead", note=f"HTTP {status}")
            return result
        if status >= 400:
            result.update(note=f"HTTP {status}")
            return result
        facts = read_page(page.text)
        self._save_text(url, page.url, facts.text)
        reason = parked_reason(page.url, facts)
        if reason:
            result.update(verdict="dead", note=reason)
            return result
        final_domain = website_domain(page.url) or ""
        original_domain = website_domain(url) or ""
        if final_domain and registrable_domain(final_domain) != registrable_domain(original_domain):
            result["note"] = f"redirects to {final_domain}"
        result["verdict"] = "alive"
        evidence = [(d, page.url) for d in facts.dates]
        evidence += self._extra_evidence(page.url, facts)
        self._pick_newest(result, evidence)
        return result

    def _fetch_home(self, url: str) -> CappedResponse:
        try:
            return self._get(url, PAGE_BYTES)
        except httpx.ConnectError:
            if url.startswith("https://"):  # some small sites only answer on http
                alternative = "http://" + url[len("https://") :]
                if self._allowed(alternative):
                    return self._get(alternative, PAGE_BYTES)
            raise

    def _extra_evidence(
        self, page_url: str, facts: PageFacts
    ) -> list[tuple[tuple[int, int, int | None], str]]:
        """Dates from one feed and the sitemap, when robots.txt allows and they exist."""
        found: list[tuple[tuple[int, int, int | None], str]] = []
        feed_urls = [urljoin(page_url, href) for href in facts.feeds[:1]]
        parts = urlsplit(page_url)
        sitemap = f"{parts.scheme}://{parts.netloc}/sitemap.xml"
        for url, reader in [(u, feed_dates) for u in feed_urls] + [(sitemap, sitemap_dates)]:
            if not self._allowed(url):
                continue
            try:
                response = self._get(url, FEED_BYTES)
            except httpx.HTTPError:
                continue
            if response.status_code == 200 and "<" in response.text[:200]:
                found.extend((d, url) for d in reader(response.text))
        return found

    def _pick_newest(
        self, result: dict[str, Any], evidence: list[tuple[tuple[int, int, int | None], str]]
    ) -> None:
        month = newest_month([d for d, _ in evidence], self.today)
        if month is None:
            return
        result["newest_date"] = month
        for date, url in evidence:
            if newest_month([date], self.today) == month:
                result["evidence_url"] = url
                break

    def _save_text(self, requested: str, final: str, text: str) -> None:
        if self.pages_dir is None or not text:
            return
        self.pages_dir.mkdir(parents=True, exist_ok=True)
        for url in {requested, final}:
            page_cache_path(self.pages_dir, url).write_text(text, encoding="utf-8")


# -- the run -----------------------------------------------------------------------------------


def read_results(path: Path) -> dict[str, dict[str, Any]]:
    results: dict[str, dict[str, Any]] = {}
    if path.exists():
        with open(path, encoding="utf-8") as handle:
            for line in handle:
                if line.strip():
                    entry = json.loads(line)
                    results[entry["group_id"]] = entry
    return results


def write_results(path: Path, results: dict[str, dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as handle:
        for group_id in sorted(results):
            handle.write(json.dumps(results[group_id], ensure_ascii=False) + "\n")


def read_id_list(path: Path) -> list[str]:
    text = path.read_text(encoding="utf-8").strip()
    if text.startswith("["):
        return [str(x) for x in json.loads(text)]
    return [line.strip() for line in text.splitlines() if line.strip() and not line.startswith("#")]


def select_groups(
    layout: Layout,
    *,
    only: list[str] | None,
    limit: int | None,
    stale_days: int | None,
    existing: dict[str, dict[str, Any]],
    today: _dt.date,
) -> list[tuple[str, str]]:
    """(group id, website) pairs to check: never checked first, then the oldest checks."""
    store = GroupStore(layout.groups_dir)
    wanted = set(only) if only is not None else None
    candidates: list[tuple[str, str, str]] = []
    for group in store.iter_groups():
        if group.get("hidden") or not (group.get("contacts") or {}).get("website"):
            continue
        if wanted is not None and group["id"] not in wanted:
            continue
        previous = existing.get(group["id"])
        if previous and stale_days is not None:
            checked = previous.get("checked_at", "")[:10]
            try:
                age = (today - _dt.date.fromisoformat(checked)).days
            except ValueError:
                age = stale_days + 1
            if age < stale_days:
                continue
        candidates.append(
            ((previous or {}).get("checked_at", ""), group["id"], group["contacts"]["website"])
        )
    candidates.sort()
    picked = [(gid, site) for _, gid, site in candidates]
    return picked[:limit] if limit else picked


def run_liveness(
    layout: Layout,
    *,
    client: FyjClient | None = None,
    only: list[str] | None = None,
    limit: int | None = None,
    stale_days: int | None = None,
    concurrency: int = CONCURRENCY,
    pages_dir: Path | None = None,
    today: _dt.date | None = None,
    progress: Callable[[int, int, dict[str, Any]], None] | None = None,
    sleep_between: float = 1.0,
) -> dict[str, int]:
    today = today or _dt.date.today()
    existing = read_results(layout.liveness_path)
    picked = select_groups(
        layout, only=only, limit=limit, stale_days=stale_days, existing=existing, today=today
    )
    owns_client = client is None
    client = client or FyjClient(timeout=TIMEOUT)
    checker = Checker(
        client, pages_dir if pages_dir is not None else default_pages_dir(), today, sleep_between
    )
    counts: dict[str, int] = {"checked": 0}
    try:
        with ThreadPoolExecutor(max_workers=concurrency) as pool:
            futures = [pool.submit(checker.check, gid, site) for gid, site in picked]
            for index, future in enumerate(futures, start=1):
                result = future.result()
                existing[result["group_id"]] = result
                counts["checked"] += 1
                counts[result["verdict"]] = counts.get(result["verdict"], 0) + 1
                if progress:
                    progress(index, len(futures), result)
    finally:
        if owns_client:
            client.close()
        write_results(layout.liveness_path, existing)
    return counts

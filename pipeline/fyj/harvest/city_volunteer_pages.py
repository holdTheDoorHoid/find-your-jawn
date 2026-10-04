"""City of Philadelphia volunteer programs scattered across phila.gov department pages.

phila.gov has no usable API (wp-json returns 502) and its sitemap.xml is a stale 2018 file, so
this harvester crawls instead. https://www.phila.gov/departments/ turns out to be mostly a
landing page (broad service categories plus the elected offices) rather than a true directory of
every department's homepage in static HTML, so a generic crawl from it alone finds little. We
therefore seed the crawl with that index page plus a list of known volunteer program pages
(given directly, or found by one targeted search each for Philly Reading Coaches, City
Commissioners poll workers, Town Watch Integrated Services, and the Foster Grandparent Program),
then follow, one hop only, any link on those pages whose URL or text contains a volunteering
keyword (volunteer, get-involved, serve, corps, become a, join). We stay on www.phila.gov for
that automatic following; the handful of known pages that live on a different phila.gov
subdomain (serve.phila.gov, vote.phila.gov) are fetched directly as given, not crawled further.

serve.phila.gov is checked and, as expected, simply redirects to the Office of Community
Empowerment and Opportunity's department page; we record that rather than treating it as a
distinct program. The two dead portals the coordinator named
(serve.volunteermatch.org and volunteer.phila.gov) were checked too and do not resolve; see
registry/sources.yaml.

External, non phila.gov links that a City volunteer page points to (Love Your Park, TreePhilly,
and similar) become their own leads, with the City page as source_url, per the coordinator's
instruction. Generic tool and social links (a Google Form, Facebook, etc.) are not treated as
organizations and are skipped.

Fixed 2026-10-04 after a review of the first real run found noisy leads: a page's own content,
not the anchor text that pointed to it, decides both its name and whether it becomes a lead at
all. The one hop keyword match on a referring link's URL or text (above) is deliberately broad,
since it is only deciding what to fetch next; two problems followed from treating every fetch as
automatically a good lead. First, some fetched City pages are not volunteer programs at all
("Concession opportunities" is a business contracting page; "Departments and other agencies" and
"All events" are index and calendar pages that only exist in the crawl to seed more links,
matched in the first place because "Philadelphia **Join**s Cities..." contains the substring
"join"). `_is_volunteer_page` checks the fetched page's own title and body text for a real
volunteering signal and excludes a short list of index, concession, contracting and job page
titles outright, regardless of how the referring link matched. Second, an external partner lead
was named from the referring link's anchor text ("apply online", "national MRC program.",
literal body text where a link's own text spanned a whole sentence), rather than the partner
page's own heading; `_resolve_partner_name` now fetches the partner page and names the lead from
its `<h1>` or `<title>`, falling back to the anchor text only when that fetch fails. Partner
candidates are also no longer mined off a page that fails `_is_volunteer_page` (that is exactly
how a U.S. Department of Justice link ended up a lead, from the "Second Chance Month" post), and
any partner host ending `.gov` or `.mil` is excluded outright: a federal or state reference page
(the CDC, ASPR, SERVPA, the DOJ) is not a local community or volunteer organization a resident can
join, whatever its own title says.

One known, accepted change from this fix: serve.phila.gov no longer becomes a lead of its own.
Its content (the Office of Community Empowerment and Opportunity's landing page) never actually
describes a way to volunteer, so the new rule correctly drops it; the fact that serve.phila.gov
redirects there rather than to a distinct volunteer program is still recorded in this file's
module docstring and in registry/sources.yaml, just not as a noisy "program" lead.
"""

from __future__ import annotations

import re
from typing import Any
from urllib.parse import urljoin, urlsplit

import httpx

from fyj.htmlutil import strip_tags
from fyj.http import FyjClient, RobotsBlocked
from fyj.leads import make_lead

SOURCE_ID = "city_volunteer_pages"
MIN_DELAY = 2.0
MAX_PAGES = 400
CRAWL_HOST = "www.phila.gov"

KEYWORDS = (
    "volunteer",
    "get-involved",
    "get involved",
    "serve",
    "corps",
    "become a",
    "become-a",
    "join",
)

# (url, hop) seeds. hop 0 pages are crawled for outgoing links; everything found at hop 1 is
# recorded but not crawled further, matching the "one hop" instruction.
KNOWN_PAGES: tuple[str, ...] = (
    "https://www.phila.gov/departments/",
    "https://www.phila.gov/departments/philadelphia-parks-recreation/get-involved/",
    "https://www.phila.gov/departments/philadelphia-parks-recreation/get-involved/business-and-individual-volunteer-opportunities/",
    "https://www.phila.gov/services/education-learning/get-help-with-technology/volunteer-for-the-power-up-tech-corps/",
    "https://www.phila.gov/services/mental-physical-health/volunteer-for-the-philadelphia-medical-reserve-corps-pmrc/",
    "https://www.phila.gov/departments/oem/ready-or-not/how-to-get-ready/how-you-can-help/volunteering/",
    "https://www.phila.gov/services/trash-recycling-city-upkeep/become-a-block-captain/",
    "https://serve.phila.gov",
    "https://www.phila.gov/2023-11-27-we-need-you-become-a-philly-reading-coach/",
    "https://vote.phila.gov/working-the-polls/become-a-poll-worker/",
    "https://www.phila.gov/departments/town-watch-integrated-services/",
    "https://www.phila.gov/programs/foster-grandparents/",
)

# Off-www known pages are fetched as given but never crawled onward (hop 1 from the start).
OFF_WWW_NO_FOLLOW = {"serve.phila.gov", "vote.phila.gov"}

EXTERNAL_PARTNER_EXCLUDE_DOMAINS = {
    "docs.google.com",
    "forms.gle",
    "google.com",
    "www.google.com",
    "facebook.com",
    "www.facebook.com",
    "twitter.com",
    "x.com",
    "instagram.com",
    "www.instagram.com",
    "youtube.com",
    "www.youtube.com",
    "flickr.com",
    "www.flickr.com",
    "linkedin.com",
    "www.linkedin.com",
    "github.com",
    # generic city chrome and tooling that showed up repeatedly while running this harvester for
    # real: site-wide footer links (SEPTA, Visit Philadelphia, elected offices, the City Code),
    # a 311 widget, a maps link, an internal file share, a URL shortener, and a generic online
    # form tool used for several unrelated sign-ups. None of these are a volunteer program or
    # partner organization in their own right.
    "www.septa.org",
    "septa.org",
    "www.visitphilly.com",
    "visitphilly.com",
    "phlcouncil.com",
    "www.phlcouncil.com",
    "phillyda.org",
    "www.phillyda.org",
    "phillysheriff.com",
    "www.phillysheriff.com",
    "browsehappy.com",
    "codelibrary.amlegal.com",
    "iframe.publicstuff.com",
    "maps.google.com",
    "phila.sharepoint.com",
    "secure.ngpvan.com",
    "bit.ly",
    "www.pavoterservices.pa.gov",
    "pavoterservices.pa.gov",
}
_GENERIC_ANCHOR_TEXTS = {
    "here",
    "click here",
    "this form",
    "this google form",
    "registration",
    "register",
    "learn more",
    "more information",
    "website",
    "link",
}

_H2_TITLE_RE = re.compile(r'<h2 class="sub-page-title[^"]*">(.*?)</h2>', re.S)
_TITLE_RE = re.compile(r"<title>(.*?)</title>", re.S)
_ENTRY_CONTENT_RE = re.compile(r'<div[^>]*class="[^"]*entry-content[^"]*"', re.S)
_LINK_RE = re.compile(r'<a[^>]+href="([^"]+)"[^>]*>(.*?)</a>', re.S)
_SENTENCE_SPLIT_RE = re.compile(r"(?<=[.!?])\s+")

# A page whose own title matches one of these is never a lead, no matter what pointed to it:
# business concessions and contracting opportunities, job and career postings, and the generic
# index or calendar pages the crawl only visits to find more links (see module docstring).
_NOT_A_VOLUNTEER_PAGE_TITLE_RE = re.compile(
    r"concession|contract(?:ing|or)?|\bjob\b|\bjobs\b|career|employment|"
    r"departments and other agencies|\ball events\b|request for proposals|\brfp\b|"
    r"procurement|bid opportunit",
    re.I,
)

# A real volunteering signal somewhere in the page's own title or body text (not the referring
# link's text or URL, which is only used to decide what to fetch next).
_VOLUNTEER_SIGNAL_RE = re.compile(
    r"volunteer|become an?\b|sign up to help|join (?:us|the|a )|service hours|"
    r"get involved|advisory council|friends group|\bcorps\b|poll worker|election board",
    re.I,
)

_H1_ANY_RE = re.compile(r"<h1[^>]*>(.*?)</h1>", re.S)
# A "|" or en/em dash with or without surrounding space, a plain hyphen only when it has space on
# both sides (so a hyphenated word like "Street-Smart" never splits), or a colon.
_TITLE_SEPARATOR_RE = re.compile(r"\s*[|–—]\s*|\s+-\s+|\s*:\s*")
_FACT_KEYWORDS = (
    "age",
    "year old",
    "years old",
    "hour",
    "training",
    "clearance",
    "background check",
    "act 33",
    "act 34",
    "fbi",
    "orientation",
    "commitment",
)


def _page_title(html_text: str) -> str | None:
    h2_match = _H2_TITLE_RE.search(html_text)
    if h2_match:
        text = strip_tags(h2_match.group(1))
        if text:
            return text
    title_match = _TITLE_RE.search(html_text)
    if title_match:
        first = title_match.group(1).split("|")[0]
        text = strip_tags(first)
        if text:
            return text
    return None


def _is_volunteer_page(title: str | None, content_text: str | None) -> bool:
    """Decide from the page's own title and body text, not the link that pointed to it, whether
    this page actually describes a way to volunteer or join. See the module docstring."""
    title_text = title or ""
    if _NOT_A_VOLUNTEER_PAGE_TITLE_RE.search(title_text):
        return False
    haystack = f"{title_text} {content_text or ''}"
    return bool(_VOLUNTEER_SIGNAL_RE.search(haystack))


def _domain_stem(host: str) -> str:
    """The registrable part of a host, lowercased and stripped to letters and digits, so
    "www.loveyourpark.org" and "TreePhilly" both reduce to a comparable "loveyourpark" or
    "treephilly" for `_external_page_title`'s organization name check."""
    label = host.split(".")[0] if host else ""
    return re.sub(r"[^a-z0-9]", "", label.lower())


def _external_page_title(html_text: str, host: str | None = None) -> str | None:
    """A generic title extractor for partner sites whose markup we don't know, unlike
    `_page_title`, which relies on phila.gov's own template classes. A partner site's `<title>`
    usually has one segment that is the organization's own name and another that is a page
    specific label or tagline, but which position holds the name is not consistent (checked
    against real partner sites while fixing this harvester: "Volunteer | Love Your Park" and
    "Home - Independence Blue Cross Broad Street Run" put the name last; "TreePhilly: Making
    Philadelphia the City of Arborly Love" puts it first). When `host` is given, this prefers
    whichever segment contains the site's own domain name, which reliably picks out the
    organization regardless of position; otherwise, or if no segment matches, it falls back to
    the last segment (true for 3 of the 4 real partner sites checked). Falls back further to a
    short `<h1>` that reads like a heading rather than a sentence, only when there is no usable
    `<title>` at all: some partner sites' `<h1>` is a long marketing sentence ("The Independence
    Blue Cross Broad Street Run 10-Miler has been a proud Philadelphia tradition for 47
    years."), not a name."""
    title_match = _TITLE_RE.search(html_text)
    if title_match:
        raw = strip_tags(title_match.group(1))
        if raw:
            segments = [s.strip() for s in _TITLE_SEPARATOR_RE.split(raw) if s.strip()]
            if segments:
                stem = _domain_stem(host) if host else ""
                if stem:
                    for segment in segments:
                        if stem in re.sub(r"[^a-z0-9]", "", segment.lower()):
                            return segment
                return segments[-1]
    h1_match = _H1_ANY_RE.search(html_text)
    if h1_match:
        text = strip_tags(h1_match.group(1))
        if text and len(text) <= 70 and not text.endswith((".", "!", "?")):
            return text
    return None


def _department_from_url(url: str) -> str | None:
    path = urlsplit(url).path.strip("/")
    parts = path.split("/")
    if len(parts) >= 2 and parts[0] == "departments":
        return parts[1].replace("-", " ")
    return None


def _main_content_html(html_text: str) -> str:
    match = _ENTRY_CONTENT_RE.search(html_text)
    if not match:
        return html_text
    start = match.end()
    rest = html_text[start:]
    end_match = re.search(r"<footer\b|<aside\b", rest)
    return rest[: end_match.start()] if end_match else rest[:20000]


def _facts(content_text: str) -> list[str]:
    sentences = _SENTENCE_SPLIT_RE.split(content_text)
    facts = []
    for sentence in sentences:
        sentence = sentence.strip()
        if not sentence or len(sentence) > 240:
            continue
        lowered = sentence.lower()
        if any(keyword in lowered for keyword in _FACT_KEYWORDS):
            facts.append(sentence)
    # de-duplicate while keeping order, cap at a handful
    seen: set[str] = set()
    out = []
    for fact in facts:
        if fact not in seen:
            seen.add(fact)
            out.append(fact)
        if len(out) >= 8:
            break
    return out


def find_links(html_fragment: str, base_url: str) -> list[tuple[str, str]]:
    links = []
    for match in _LINK_RE.finditer(html_fragment):
        href, text = match.group(1), strip_tags(match.group(2)) or ""
        if href.startswith("#") or href.startswith("mailto:") or href.startswith("tel:"):
            continue
        absolute = urljoin(base_url, href)
        links.append((absolute, text))
    return links


def _matches_keyword(url: str, text: str) -> bool:
    haystack = f"{url} {text}".lower()
    return any(keyword in haystack for keyword in KEYWORDS)


def _slug_native_id(url: str) -> str:
    parts = urlsplit(url)
    path = parts.path.strip("/") or "home"
    slug = re.sub(r"[^a-z0-9]+", "-", path.lower()).strip("-")
    host_prefix = parts.netloc.replace("www.", "").split(".")[0]
    return f"{host_prefix}:{slug}" if host_prefix != "phila" else slug


def _partner_name(text: str, host: str) -> str:
    cleaned = text.strip()
    if cleaned and cleaned.lower() not in _GENERIC_ANCHOR_TEXTS and len(cleaned) > 2:
        return cleaned
    return host


def _is_excluded_partner_domain(host: str) -> bool:
    if host in EXTERNAL_PARTNER_EXCLUDE_DOMAINS:
        return True
    # A federal or state government reference page (the CDC, ASPR, SERVPA, the DOJ) is not a
    # local community or volunteer organization a resident can join, whatever its own page says.
    return host.endswith(".gov") or host.endswith(".mil")


def _resolve_partner_name(client: FyjClient, href: str, text: str, host: str) -> str:
    """Name a partner lead from the partner page's own heading, per the module docstring's
    fix. Falls back to the referring link's anchor text (via `_partner_name`) only if the
    partner page can't be fetched or has no usable title."""
    try:
        resp = client.get_html(href, min_delay=1.0)
    except RobotsBlocked:
        pass
    except (httpx.HTTPStatusError, httpx.TransportError):
        pass
    else:
        fetched = _external_page_title(resp.text, host=host)
        if fetched:
            return fetched
    return _partner_name(text, host)


def harvest(client: FyjClient) -> list[dict[str, Any]]:
    queue: list[tuple[str, int]] = [(url, 0) for url in KNOWN_PAGES]
    visited: set[str] = set()
    queued: set[str] = set(KNOWN_PAGES)
    leads: list[dict[str, Any]] = []
    seen_partner_urls: set[str] = set()

    while queue and len(visited) < MAX_PAGES:
        url, hop = queue.pop(0)
        if url in visited:
            continue
        visited.add(url)

        try:
            resp = client.get_html(url, min_delay=MIN_DELAY)
        except RobotsBlocked:
            continue
        except (httpx.HTTPStatusError, httpx.TransportError):
            # a dead or error page on a best effort crawl; skip rather than abort the whole run
            continue

        content_html = _main_content_html(resp.text)
        content_text = strip_tags(content_html) or ""
        title = _page_title(resp.text)
        is_volunteer_page = _is_volunteer_page(title, content_text)

        if is_volunteer_page:
            leads.append(
                make_lead(
                    source=SOURCE_ID,
                    source_url=url,
                    native_id=_slug_native_id(url),
                    name=title or url,
                    kind_hint="program",
                    description=content_text[:2000] if content_text else None,
                    city="Philadelphia",
                    tags_hint=["City of Philadelphia volunteer program"],
                    extra={
                        "department": _department_from_url(url),
                        "facts": _facts(content_text),
                        "crawl_hop": hop,
                    },
                )
            )

        host = urlsplit(url).netloc
        for href, text in find_links(content_html, url):
            link_host = urlsplit(href).netloc
            if not link_host:
                continue
            if link_host == CRAWL_HOST or link_host.endswith(".phila.gov"):
                if hop == 0 and host not in OFF_WWW_NO_FOLLOW and link_host == CRAWL_HOST:
                    if href not in queued and _matches_keyword(href, text):
                        queued.add(href)
                        queue.append((href, 1))
                continue
            if not is_volunteer_page:
                # Don't mine partner links off a page that doesn't itself describe a way to
                # volunteer or join; this is exactly how a U.S. Department of Justice link ended
                # up a lead, off a "Second Chance Month" post that only matched the one hop crawl
                # because "Philadelphia Joins Cities..." contains the substring "join".
                continue
            if _is_excluded_partner_domain(link_host):
                continue
            if href in seen_partner_urls:
                continue
            seen_partner_urls.add(href)
            leads.append(
                make_lead(
                    source=SOURCE_ID,
                    source_url=url,
                    native_id=f"partner:{_slug_native_id(href)}",
                    name=_resolve_partner_name(client, href, text, link_host),
                    kind_hint="program",
                    website=href,
                    tags_hint=["external partner linked from a City volunteer page"],
                    extra={"external_partner": True, "linked_from": url},
                )
            )

    # Belt and suspenders: two different URLs could in principle slugify to the same native_id.
    # The writer refuses duplicate lead_ids outright, so keep the first lead seen for any id
    # rather than letting a rare slug collision abort the whole harvest.
    deduped: list[dict[str, Any]] = []
    seen_lead_ids: set[str] = set()
    for lead in leads:
        if lead["lead_id"] in seen_lead_ids:
            continue
        seen_lead_ids.add(lead["lead_id"])
        deduped.append(lead)
    return deduped

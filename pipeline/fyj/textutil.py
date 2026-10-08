"""Text helpers shared by the merge, import and check steps: dash cleanup, name normalization for
matching, website domains, and the word runs used by the own words check."""

from __future__ import annotations

import re
import unicodedata
from urllib.parse import urlsplit

# -- dashes -------------------------------------------------------------------------------------

_EM_EN = "‒–—―"
_RANGE_RE = re.compile(rf"(\d)\s*[{_EM_EN}]\s*(\d)")
_SPACED_RANGE_RE = re.compile(r"(\d)\s+-\s+(\d)")
_DASH_RE = re.compile(rf"\s*(?:[{_EM_EN}]|--+)\s*")
_SPACED_HYPHEN_RE = re.compile(r"(?<=\s)-(?=\s)")
_COMMA_BEFORE_PUNCT_RE = re.compile(r",\s*([.,;:!?)])")
_MULTI_COMMA_RE = re.compile(r",(\s*,)+")

# What fyj check treats as a dash used as punctuation (DATA_MODEL section 7 item 4).
DASH_PUNCTUATION_RE = re.compile(rf"[{_EM_EN}]|--|(?<=\s)-(?=\s)")


def fix_dashes(text: str) -> str:
    """Rewrite dashes used as punctuation to commas (and number ranges to 'to').

    Hyphens inside compound words are left alone. 'open Thursdays — bring a friend' becomes
    'open Thursdays, bring a friend'; '6–8 pm' becomes '6 to 8 pm'.
    """
    out = _RANGE_RE.sub(r"\1 to \2", text)
    out = _SPACED_RANGE_RE.sub(r"\1 to \2", out)
    out = _DASH_RE.sub(", ", out)
    out = re.sub(r"\s+-\s+", ", ", out)
    out = _MULTI_COMMA_RE.sub(",", out)
    out = _COMMA_BEFORE_PUNCT_RE.sub(r"\1", out)
    out = out.strip()
    out = re.sub(r"^,\s*", "", out)
    out = re.sub(r",\s*$", "", out)
    return re.sub(r"[ \t]{2,}", " ", out)


def has_dash_punctuation(text: str) -> bool:
    return bool(DASH_PUNCTUATION_RE.search(text))


def collapse_whitespace(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


# -- names and matching ---------------------------------------------------------------------------


def strip_accents(text: str) -> str:
    return "".join(
        ch for ch in unicodedata.normalize("NFKD", text) if not unicodedata.combining(ch)
    )


def canon(text: str) -> str:
    """Lowercase letters and digits only. 'Outdoors & Adventure' and 'outdoors-adventure' match."""
    return re.sub(r"[^a-z0-9]+", "", strip_accents(str(text)).lower())


_ABBREVIATIONS = {
    "assn": "association",
    "assoc": "association",
    "ctr": "center",
    "cntr": "center",
    "centre": "center",
    "cmty": "community",
    "cmnty": "community",
    "cmmty": "community",
    "comm": "community",
    "dept": "department",
    "fdn": "foundation",
    "fndn": "foundation",
    "fnd": "foundation",
    "mt": "mount",
    "natl": "national",
    "nbrhd": "neighborhood",
    "nghbrhd": "neighborhood",
    "org": "organization",
    "recr": "recreation",
    "rec": "recreation",
    "sch": "school",
    "soc": "society",
    "st": "saint",
}
_DROP_TOKENS = {
    "inc",
    "incorporated",
    "llc",
    "ltd",
    "corp",
    "corporation",
    "co",
    "the",
    "philly",
    "phila",
    "pa",
}
_FILLER_TOKENS = {"and", "of", "for", "in", "at", "to", "a", "an", "on"}


def normalize_name(name: str) -> str:
    """The key used to decide that two records name the same group.

    Lowercases, drops accents and punctuation, removes 'inc', 'the', 'of Philadelphia' and
    'Philly', and expands the abbreviations that IRS names use (assn, ctr, cmty, st).
    """
    text = strip_accents(name or "").lower()
    text = text.replace("&", " and ")
    text = re.sub(r"['’`]", "", text)
    text = re.sub(r"[^a-z0-9]+", " ", text)
    text = re.sub(r"\bof philadelphia\b", " ", text)
    text = re.sub(r"\bphiladelphia\b$", " ", text)
    tokens = []
    for tok in text.split():
        tok = _ABBREVIATIONS.get(tok, tok)
        if tok in _DROP_TOKENS:
            continue
        tokens.append(tok)
    return " ".join(tokens)


def significant_tokens(normalized: str) -> list[str]:
    return [t for t in normalized.split() if t not in _FILLER_TOKENS]


_GENERIC_TOKENS = {
    "community",
    "association",
    "civic",
    "garden",
    "gardens",
    "friends",
    "park",
    "playground",
    "center",
    "club",
    "neighbors",
    "neighborhood",
    "group",
    "council",
    "committee",
    "organization",
    "society",
    "project",
    "program",
    "programs",
    "league",
    "foundation",
    "fund",
    "school",
    "church",
    "united",
    "citizens",
    "coalition",
    "alliance",
    "network",
    "services",
    "service",
    "development",
    "house",
    "place",
    "square",
    "playlot",
    "recreation",
    "library",
    "senior",
    "seniors",
    "youth",
    "advisory",
    "greater",
    "new",
    "west",
    "east",
    "north",
    "south",
    "street",
    "saint",
    "philadelphia",
    "city",
    "area",
    "corp",
    "company",
}


def _initials(tokens: list[str]) -> str:
    return "".join(t[0] for t in tokens if t)


def names_related(norm_a: str, norm_b: str) -> bool:
    """Do two normalized names plausibly belong to one group? They must share a distinctive word
    (not 'garden', 'friends', 'civic'...), or one must be the acronym of the other. Used to keep
    two different groups that happen to share a website from being merged."""
    ta, tb = significant_tokens(norm_a), significant_tokens(norm_b)
    if not ta or not tb:
        return False
    da = {t for t in ta if t not in _GENERIC_TOKENS and len(t) > 2}
    db = {t for t in tb if t not in _GENERIC_TOKENS and len(t) > 2}
    if da and db:
        if da & db:
            return True
    elif set(ta) & set(tb):
        return True
    for short, long in ((ta, tb), (tb, ta)):
        if len(short) == 1 and len(short[0]) >= 3 and short[0] == _initials(long):
            return True
    return False


_SMALL_WORDS = {
    "and",
    "of",
    "the",
    "for",
    "in",
    "on",
    "at",
    "to",
    "a",
    "an",
    "by",
    "de",
    "la",
    "el",
}
_ACRONYMS = {
    "naacp",
    "ymca",
    "ywca",
    "usa",
    "us",
    "pa",
    "ne",
    "nw",
    "se",
    "sw",
    "llc",
    "cdc",
    "vfw",
    "amvets",
    "pal",
    "nami",
    "lgbt",
    "lgbtq",
    "lgbtqia",
    "stem",
    "hiv",
    "aids",
    "dj",
    "pta",
    "pto",
    "hs",
    "ii",
    "iii",
    "iv",
    "vi",
    "vii",
    "viii",
    "ix",
    "xi",
    "xii",
    "pcc",
    "ccp",
    "uarts",
    "upenn",
    "ucd",
    "pwa",
    "nrg",
    "gsa",
    "mlk",
    "tv",
    "fm",
    "am",
    "jfk",
    "ibew",
    "afscme",
    "seiu",
    "aarp",
    "bpoe",
    "ems",
    "pdl",
    "phs",
    "phmc",
    "pgw",
    "iuoe",
    "uaw",
    "usw",
    "ufcw",
}


_TITLE_ABBREVIATIONS = {
    "st",
    "rd",
    "dr",
    "ct",
    "ln",
    "pl",
    "jr",
    "sr",
    "mr",
    "mrs",
    "ms",
    "mt",
    "fr",
    "blvd",
    "ave",
    "hwy",
    "sq",
    "ter",
    "apt",
    "ste",
}


def _title_token(tok: str) -> str:
    bare = re.sub(r"[^A-Za-z0-9]", "", tok)
    low = bare.lower()
    if low in _TITLE_ABBREVIATIONS:
        return tok.capitalize()
    if low in _ACRONYMS:
        return tok.upper()
    if re.fullmatch(r"\d+(ST|ND|RD|TH)", tok.upper()):
        return tok.lower()
    if bare and len(bare) <= 3 and not re.search(r"[AEIOUY]", bare.upper()):
        return tok.upper()
    if "-" in tok:
        return "-".join(_title_token(part) for part in tok.split("-"))
    if "'" in tok:
        head, _, tail = tok.partition("'")
        if len(head) == 1 or head.lower() in {"mc", "mac"}:
            return head.upper() + "'" + tail.capitalize()
        return head.capitalize() + "'" + tail.lower()
    return tok.capitalize()


def smart_title(name: str) -> str:
    """Title case for the ALL CAPS names in IRS files. Names that already mix case are kept."""
    stripped = name.strip()
    letters = [ch for ch in stripped if ch.isalpha()]
    if not letters or any(ch.islower() for ch in letters):
        return collapse_whitespace(stripped)
    out = []
    for index, tok in enumerate(collapse_whitespace(stripped).split(" ")):
        if index > 0 and tok.lower() in _SMALL_WORDS:
            out.append(tok.lower())
        else:
            out.append(_title_token(tok))
    return " ".join(out)


# -- websites -----------------------------------------------------------------------------------

# Hosts that many unrelated groups share. A match on one of these says nothing about identity.
SHARED_DOMAINS = {
    "facebook.com",
    "fb.com",
    "instagram.com",
    "linkedin.com",
    "twitter.com",
    "x.com",
    "tiktok.com",
    "youtube.com",
    "youtu.be",
    "meetup.com",
    "eventbrite.com",
    "linktr.ee",
    "wixsite.com",
    "wix.com",
    "weebly.com",
    "blogspot.com",
    "wordpress.com",
    "squarespace.com",
    "google.com",
    "github.io",
    "carrd.co",
    "notion.site",
    "yelp.com",
    "gofundme.com",
    "patch.com",
    "guidestar.org",
    "propublica.org",
    "givepulse.com",
    "idealist.org",
    "nextdoor.com",
    "pinterest.com",
    "reddit.com",
    "bit.ly",
    "forms.gle",
    "jotform.com",
    "typeform.com",
    "mailchi.mp",
    "constantcontact.com",
    "godaddysites.com",
    "webs.com",
    "phila.gov",
    "philasd.org",
    "galaxydigital.com",
    "upenn.edu",
    "drexel.edu",
    "temple.edu",
    "villanova.edu",
    "jefferson.edu",
    "sju.edu",
    "lasalle.edu",
    "ccp.edu",
    "pennclubs.com",
    "archphila.org",
    "caves.org",
    "pa.gov",
    "state.pa.us",
    "libwww.library.phila.gov",
}


def website_domain(url: str | None) -> str | None:
    """The host of a website with 'www.' removed and any path ignored, or None."""
    if not url:
        return None
    text = str(url).strip()
    if not text or text.lower() in {"n/a", "none", "unknown"}:
        return None
    if "://" not in text:
        text = "http://" + text
    try:
        host = urlsplit(text).hostname
    except ValueError:
        return None
    if not host or "." not in host:
        return None
    host = host.lower().rstrip(".")
    if host.startswith("www."):
        host = host[4:]
    return host


def is_shared_domain(domain: str) -> bool:
    parts = domain.split(".")
    for i in range(len(parts) - 1):
        if ".".join(parts[i:]) in SHARED_DOMAINS:
            return True
    return False


def registrable_domain(domain: str) -> str:
    """A rough 'example.org' from 'www.sub.example.org' (two label suffixes like co.uk are rare
    for the groups we track, so this keeps the last two labels)."""
    parts = domain.split(".")
    return ".".join(parts[-2:]) if len(parts) >= 2 else domain


# -- own words check ------------------------------------------------------------------------------

_WORD_RE = re.compile(r"[a-z0-9]+(?:'[a-z]+)?")


def words(text: str) -> list[str]:
    return _WORD_RE.findall(strip_accents(text or "").lower().replace("’", "'"))


def ngram_set(tokens: list[str], n: int) -> set[tuple[str, ...]]:
    if len(tokens) < n:
        return set()
    return {tuple(tokens[i : i + n]) for i in range(len(tokens) - n + 1)}


def shared_run(text: str, source_ngrams: set[tuple[str, ...]], n: int = 8) -> str | None:
    """The first run of `n` consecutive words in `text` that also occurs in a source text."""
    tokens = words(text)
    for i in range(len(tokens) - n + 1):
        if tuple(tokens[i : i + n]) in source_ngrams:
            return " ".join(tokens[i : i + n])
    return None


def slugify(name: str, max_len: int = 64) -> str:
    """Lowercase ASCII words joined by hyphens (DATA_MODEL section 3)."""
    text = strip_accents(name or "").lower().replace("&", " and ")
    text = re.sub(r"['’`]", "", text)
    text = re.sub(r"[^a-z0-9]+", "-", text).strip("-")
    if len(text) > max_len:
        cut = text[:max_len]
        if "-" in cut and text[max_len] != "-":
            cut = cut.rsplit("-", 1)[0]
        text = cut.strip("-")
    return text or "group"

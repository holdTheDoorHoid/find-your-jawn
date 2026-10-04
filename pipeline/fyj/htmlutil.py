"""Small regex based HTML text helpers, shared by the harvesters that scrape plain HTML pages
rather than call a JSON API. The project's dependency list is deliberately just httpx and
PyYAML, so this is a light, good enough parser rather than a real HTML DOM, used only on pages
whose structure we have actually inspected."""

from __future__ import annotations

import html as html_lib
import re

_TAG_RE = re.compile(r"<[^>]+>")
_WS_RE = re.compile(r"\s+")


def strip_tags(raw: str | None) -> str | None:
    """Drop every tag and collapse whitespace. Good for turning a small HTML fragment into text."""
    if raw is None:
        return None
    text = _TAG_RE.sub(" ", raw)
    text = html_lib.unescape(text)
    text = _WS_RE.sub(" ", text).strip()
    return text or None


def section_text(html_text: str, header: str, *, start: int = 0) -> tuple[str | None, int]:
    """Find `<h2 class="section-header">{header}</h2>` and return the plain text that follows,
    up to the next section header, <section>, or <footer> tag. Returns (text, position after
    the match) so callers can keep searching forward for repeated headers (not needed here but
    keeps the function honest about where it left off); position is 0 if the header is absent."""
    pattern = re.compile(
        r'<h2 class="section-header"[^>]*>\s*' + re.escape(header) + r"\s*</h2>", re.S
    )
    match = pattern.search(html_text, start)
    if not match:
        return None, 0
    rest = html_text[match.end() :]
    boundary = re.search(r'<h2 class="section-header"|<section\b|<footer\b', rest)
    chunk = rest[: boundary.start()] if boundary else rest[:4000]
    return strip_tags(chunk), match.end()


def info_rows(html_text: str, row_classes: tuple[str, ...]) -> dict[str, str]:
    """Pull `<tr class="phone">...<td class="text">VALUE</td>...</tr>` style rows into a dict."""
    out: dict[str, str] = {}
    pattern = re.compile(
        r'<tr class="(' + "|".join(re.escape(c) for c in row_classes) + r')">(.*?)</tr>', re.S
    )
    for match in pattern.finditer(html_text):
        cls, block = match.group(1), match.group(2)
        text_match = re.search(r'<td class="text">(.*?)</td>', block, re.S)
        if text_match:
            value = strip_tags(text_match.group(1))
            if value:
                out[cls] = value
    return out


def requirement_texts(html_text: str) -> list[str]:
    """Every `<tr class="requirement">...<td class="text">VALUE</td></tr>` row's text."""
    out = []
    for match in re.finditer(r'<tr class="requirement"[^>]*>(.*?)</tr>', html_text, re.S):
        text_match = re.search(r'<td class="text">(.*?)</td>', match.group(1), re.S)
        if text_match:
            value = strip_tags(text_match.group(1))
            if value:
                out.append(value)
    return out

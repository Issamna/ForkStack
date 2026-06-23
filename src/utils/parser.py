import ipaddress
import re
import socket
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup
from fastapi import HTTPException
from recipe_scrapers import scrape_html

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)

# Units we recognise when splitting an ingredient line into quantity/unit/name.
MEASURE_UNITS = {
    "tsp", "teaspoon", "teaspoons",
    "tbsp", "tablespoon", "tablespoons",
    "cup", "cups",
    "oz", "ounce", "ounces",
    "lb", "lbs", "pound", "pounds",
    "g", "gram", "grams",
    "kg", "kilogram", "kilograms",
    "ml", "milliliter", "milliliters",
    "l", "liter", "liters", "litre", "litres",
    "pinch", "pinches", "dash", "dashes",
    "clove", "cloves", "can", "cans",
    "package", "packages", "pkg",
    "slice", "slices", "stick", "sticks",
    "quart", "quarts", "pint", "pints", "gallon", "gallons",
    "handful", "sprig", "sprigs", "stalk", "stalks",
    "head", "heads", "bunch", "bunches", "piece", "pieces",
}

_UNICODE_FRACTIONS = {
    "¼": "1/4", "½": "1/2", "¾": "3/4", "⅓": "1/3", "⅔": "2/3",
    "⅕": "1/5", "⅖": "2/5", "⅗": "3/5", "⅘": "4/5", "⅙": "1/6",
    "⅚": "5/6", "⅛": "1/8", "⅜": "3/8", "⅝": "5/8", "⅞": "7/8",
}

# Leading amount: mixed number (1 1/2), fraction (1/2), or decimal/range (1, 1.5, 1-2).
_QTY_RE = re.compile(
    r"^(\d+\s+\d+/\d+|\d+/\d+|\d+(?:\.\d+)?(?:\s*[-–]\s*\d+(?:\.\d+)?)?)\s*"
)


def assert_safe_url(url: str) -> None:
    """Reject URLs that could be used for SSRF (internal/metadata addresses).

    Validates the scheme and ensures every address the host resolves to is a
    public, routable IP before any HTTP request is made.
    """
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise HTTPException(status_code=400, detail="Only http(s) URLs are allowed")

    host = parsed.hostname
    if not host:
        raise HTTPException(status_code=400, detail="Invalid URL host")

    try:
        addr_infos = socket.getaddrinfo(host, None)
    except socket.gaierror:
        raise HTTPException(status_code=400, detail="Could not resolve host")

    for info in addr_infos:
        ip = ipaddress.ip_address(info[4][0])
        if (
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_reserved
            or ip.is_multicast
            or ip.is_unspecified
        ):
            raise HTTPException(
                status_code=400, detail="URL resolves to a disallowed address"
            )


def _fetch_html(url: str, max_redirects: int = 4) -> str:
    """Fetch a page, validating every URL (including each redirect hop) so the
    SSRF guard can't be bypassed via a redirect to an internal address."""
    current = url
    for _ in range(max_redirects + 1):
        assert_safe_url(current)
        try:
            resp = requests.get(
                current,
                headers={"User-Agent": USER_AGENT},
                timeout=15,
                allow_redirects=False,
            )
        except requests.RequestException:
            raise HTTPException(status_code=400, detail="Couldn't reach that site.")

        if resp.is_redirect and resp.headers.get("Location"):
            current = urljoin(current, resp.headers["Location"])
            continue

        if resp.status_code in (401, 403, 406, 429):
            raise HTTPException(
                status_code=422,
                detail="This site blocked the automatic import. You may need to add the recipe manually.",
            )
        if resp.status_code in (404, 410):
            raise HTTPException(status_code=404, detail="That page couldn't be found.")
        if resp.status_code >= 400:
            raise HTTPException(
                status_code=502,
                detail=f"The site returned an error (HTTP {resp.status_code}).",
            )
        return resp.text
    raise HTTPException(status_code=400, detail="Too many redirects.")


def parse_ingredient(text: str):
    """Best-effort split of a free-text ingredient into quantity/unit/name.

    Falls back to putting the whole string in ``name`` when it can't confidently
    identify an amount or unit -- a clean unparsed line beats a mangled one.
    """
    raw = text.strip()
    normalized = raw
    for symbol, ascii_fraction in _UNICODE_FRACTIONS.items():
        normalized = normalized.replace(symbol, " " + ascii_fraction)
    normalized = re.sub(r"\s+", " ", normalized).strip()

    quantity = ""
    rest = normalized
    match = _QTY_RE.match(normalized)
    if match:
        quantity = re.sub(r"\s+", " ", match.group(1)).strip()
        rest = normalized[match.end():].strip()

    unit = ""
    head, _, tail = rest.partition(" ")
    if head and head.lower().strip(".") in MEASURE_UNITS:
        unit = head.lower().strip(".")
        rest = tail.strip()

    return {
        "name": rest if rest else raw,
        "quantity": quantity,
        "measurement_type": unit,
    }


def recipe_scraper(url: str):
    """Import a recipe from a URL.

    Primary path: recipe-scrapers in wild mode, which uses a site-specific
    scraper when available and otherwise reads schema.org/Recipe metadata
    (present on the large majority of recipe blogs). Falls back to a heuristic
    HTML scrape only when no structured recipe data exists.
    """
    assert_safe_url(url)
    html = _fetch_html(url)

    structured = _from_structured(html, url)
    if structured and structured["ingredients"]:
        return structured

    fallback = bs4_scraper(html)
    if not fallback["ingredients"]:
        raise HTTPException(
            status_code=422, detail="Couldn't find a recipe on that page."
        )
    return fallback


def _from_structured(html: str, url: str):
    try:
        scraper = scrape_html(html, org_url=url, wild_mode=True)
    except Exception:
        return None

    def safe(fn, default):
        try:
            return fn() or default
        except Exception:
            return default

    ingredients = safe(scraper.ingredients, [])
    if not ingredients:
        return None

    try:
        steps = scraper.instructions_list() or []
    except Exception:
        steps = [s for s in safe(scraper.instructions, "").split("\n") if s.strip()]

    return {
        "title": safe(scraper.title, "Untitled Recipe"),
        "ingredients": [parse_ingredient(i) for i in ingredients],
        "instructions": [
            {"step_number": i + 1, "text": step.strip()}
            for i, step in enumerate(steps)
            if step.strip()
        ],
    }


def bs4_scraper(html: str):
    """Last-resort heuristic scrape for pages with no structured recipe data."""
    soup = BeautifulSoup(html, "html.parser")

    ingredients_raw = [
        li.get_text(strip=True)
        for li in soup.select("li")
        if any(unit in li.text.lower().split() for unit in MEASURE_UNITS)
    ]

    instructions_raw = [
        p.get_text(strip=True) for p in soup.select("p") if len(p.text.strip()) > 50
    ]

    return {
        "title": soup.title.string.strip() if soup.title and soup.title.string else "Untitled Recipe",
        "ingredients": [parse_ingredient(i) for i in ingredients_raw[:15]],
        "instructions": [
            {"step_number": i + 1, "text": step}
            for i, step in enumerate(instructions_raw[:10])
        ],
    }

import ipaddress
import re
import socket
from urllib.parse import urlparse

from fastapi import HTTPException
from recipe_scrapers import scrape_me, WebsiteNotImplementedError
from bs4 import BeautifulSoup
import requests


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

MEASURE_UNITS = [
    "tsp",
    "tbsp",
    "cup",
    "cups",
    "oz",
    "ounce",
    "ounces",
    "lb",
    "pound",
    "pounds",
    "ml",
    "l",
    "g",
    "gram",
    "grams",
    "kg",
    "pinch",
    "dash",
    "clove",
    "cloves",
    "can",
    "cans",
]


def parse_ingredient(text: str):
    match = re.match(r"^(\d+[\/\d\s\.]*)\s*([a-zA-Z]+)?\s*(.*)", text.strip())
    if match:
        quantity, unit, name = match.groups()
        if unit and unit.lower() not in MEASURE_UNITS:
            name = f"{unit} {name}".strip()
            unit = ""
        return {
            "name": name.strip(),
            "quantity": quantity.strip(),
            "measurement_type": unit.lower() if unit else "",
        }
    return {"name": text.strip(), "quantity": "", "measurement_type": ""}


def recipe_scraper(url: str):
    assert_safe_url(url)
    try:
        scraper = scrape_me(url)
        ingredients = scraper.ingredients()
        instructions_text = scraper.instructions()

        return {
            "title": scraper.title(),
            "ingredients": [parse_ingredient(i) for i in ingredients],
            "instructions": [
                {"step_number": i + 1, "text": step.strip()}
                for i, step in enumerate(instructions_text.split("\n"))
                if step.strip()
            ],
        }
    except WebsiteNotImplementedError:
        return bs4_scraper(url)


def bs4_scraper(url: str):
    try:
        res = requests.get(
            url,
            headers={"User-Agent": "Mozilla/5.0"},
            timeout=10,
            allow_redirects=False,
        )
        soup = BeautifulSoup(res.text, "html.parser")

        ingredients_raw = [
            li.get_text(strip=True)
            for li in soup.select("li")
            if any(unit in li.text.lower() for unit in MEASURE_UNITS)
        ]

        instructions_raw = [
            p.get_text(strip=True) for p in soup.select("p") if len(p.text.strip()) > 50
        ]

        return {
            "title": soup.title.string.strip() if soup.title else "Untitled Recipe",
            "ingredients": [parse_ingredient(i) for i in ingredients_raw[:15]],
            "instructions": [
                {"step_number": i + 1, "text": step}
                for i, step in enumerate(instructions_raw[:10])
            ],
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Fallback parser failed: {str(e)}")

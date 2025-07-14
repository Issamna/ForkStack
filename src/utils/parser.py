from fastapi import HTTPException
from recipe_scrapers import scrape_me, WebsiteNotImplementedError
from bs4 import BeautifulSoup
import requests
import re

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
        res = requests.get(url, headers={"User-Agent": "Mozilla/5.0"})
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

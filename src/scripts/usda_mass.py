import os
import requests
import time
import json
from typing import List
from dotenv import load_dotenv

from models.ingredient import Ingredient, UnitOption

load_dotenv()

USDA_API_KEY = os.getenv("USDA_API_KEY")
FORKSTACK_API_URL = os.getenv("FORKSTACK_API_URL", "http://localhost:8000/ingredients")
USDA_SEARCH_URL = "https://api.nal.usda.gov/fdc/v1/foods/search"
USDA_DETAIL_URL = "https://api.nal.usda.gov/fdc/v1/food"

CHECKPOINT_FILE = "usda_checkpoint.json"


def save_checkpoint(letter: str, page: int):
    with open(CHECKPOINT_FILE, "w") as f:
        json.dump({"letter": letter, "page": page}, f)


def load_checkpoint():
    if not os.path.exists(CHECKPOINT_FILE):
        return None, 1
    with open(CHECKPOINT_FILE) as f:
        data = json.load(f)
        return data.get("letter", "a"), data.get("page", 1)


def search_fdc_ids(query: str, page: int = 1) -> List[int]:
    params = {
        "query": query,
        "api_key": USDA_API_KEY,
        "dataType": ["Foundation"],
        "pageSize": 200,
        "pageNumber": page,
    }
    response = requests.get(USDA_SEARCH_URL, params=params)
    response.raise_for_status()
    return [item["fdcId"] for item in response.json().get("foods", [])]


def get_food_details(fdc_id: int) -> Ingredient:
    response = requests.get(f"{USDA_DETAIL_URL}/{fdc_id}", params={"api_key": USDA_API_KEY})
    response.raise_for_status()
    data = response.json()

    name = data["description"].strip()
    plural_name = f"{name}s"

    calories = next(
        (n["value"] for n in data.get("foodNutrients", []) if n["nutrientName"] == "Energy"),
        None
    )

    unit_options = []
    for portion in data.get("foodPortions", []):
        unit_name = portion.get("measureUnit", {}).get("name", "").lower()
        grams = portion.get("gramWeight")
        if grams and unit_name:
            unit_options.append(
                UnitOption(
                    unit=unit_name,
                    grams_equivalent=grams,
                    is_default=False
                )
            )

    if not any(u.unit == "g" for u in unit_options):
        unit_options.append(UnitOption(unit="g", grams_equivalent=1, is_default=True))
    else:
        for u in unit_options:
            if u.unit == "g":
                u.is_default = True

    return Ingredient(
        ingredient_id=str(fdc_id),
        name=name.title(),
        plural_name=plural_name.title(),
        calories_per_gram=(calories / 100) if calories else None,
        unit_options=unit_options,
        data_type="foundation"
    )


def post_ingredient(ingredient: Ingredient):
    res = requests.post(
        FORKSTACK_API_URL,
        json=ingredient.model_dump(),
        timeout=5
    )
    return res.status_code, res.text


def mass_import():
    letters = "abcdefghijklmnopqrstuvwxyz"
    checkpoint_letter, checkpoint_page = load_checkpoint()
    start = False

    for letter in letters:
        if not start and letter != checkpoint_letter:
            continue
        start = True
        page = checkpoint_page if letter == checkpoint_letter else 1

        while True:
            print(f"Fetching page {page} for '{letter}'...")
            fdc_ids = search_fdc_ids(letter, page)
            if not fdc_ids:
                break

            for fdc_id in fdc_ids:
                try:
                    ingredient = get_food_details(fdc_id)
                    status, text = post_ingredient(ingredient)
                    print(f"{ingredient.name} → {status}")
                    time.sleep(0.2)
                except Exception as e:
                    print(f"Error on {fdc_id}: {e}")

            save_checkpoint(letter, page + 1)
            page += 1
            time.sleep(1)


if __name__ == "__main__":
    mass_import()

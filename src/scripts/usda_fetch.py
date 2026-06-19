import os
import requests
import json

FORKSTACK_API_URL = "https://e6q9keyixh.execute-api.us-east-1.amazonaws.com/prod/ingredients"
USDA_API_KEY = "0hN7YzOEdAh9jqCWuNhDgYHLX8ex8IAwzHN1M3Oe"
USDA_SEARCH_URL = "https://api.nal.usda.gov/fdc/v1/foods/search"
USDA_DETAILS_URL = "https://api.nal.usda.gov/fdc/v1/food/{fdc_id}"


def search_ingredient(query: str) -> dict:
    params = {
        "api_key": USDA_API_KEY,
        "query": query,
        "dataType": ["Foundation"],
        "pageSize": 1,
    }
    response = requests.get(USDA_SEARCH_URL, params=params)
    response.raise_for_status()
    foods = response.json().get("foods", [])
    return foods[0] if foods else None


def get_ingredient_details(fdc_id: int) -> dict:
    params = {"api_key": USDA_API_KEY}
    response = requests.get(USDA_DETAILS_URL.format(fdc_id=fdc_id), params=params)
    response.raise_for_status()
    return response.json()


def parse_to_payload(data: dict) -> dict:
    name = data["description"].strip()
    plural_name = f"{name}s"

    # Extract calories per 100g using specific or general Atwater factors
    calories = None
    for n in data.get("foodNutrients", []):
        name_lower = n.get("nutrientName", "").lower()
        unit = n.get("unitName", "").upper()
        value = n.get("value") or n.get("amount")

        if unit == "KCAL":
            if "specific factor" in name_lower:
                calories = value
                break
            elif "general factor" in name_lower and calories is None:
                calories = value

    unit_options = []
    for portion in data.get("foodPortions", []):
        unit = portion.get("measureUnit", {}).get("name", "").lower()
        grams = portion.get("gramWeight")
        if unit and grams:
            unit_options.append({
                "unit": unit,
                "grams_equivalent": grams,
                "is_default": False
            })

    # Ensure a default 'g' unit exists
    if not any(u["unit"] == "g" for u in unit_options):
        unit_options.append({
            "unit": "g",
            "grams_equivalent": 1,
            "is_default": True
        })
    else:
        for u in unit_options:
            if u["unit"] == "g":
                u["is_default"] = True

    return {
        "ingredient_id": str(data["fdcId"]),
        "name": name.title(),
        "plural_name": plural_name.title(),
        "calories_per_gram": (calories / 100) if calories else None,
        "unit_options": unit_options,
        "data_type": "foundation"
    }


def post_to_api(payload: dict):
    response = requests.post(FORKSTACK_API_URL, json=payload)
    response.raise_for_status()
    return response.json()


if __name__ == "__main__":
    query = input("Enter ingredient to fetch and import: ").strip()
    food = search_ingredient(query)
    if not food:
        print("No matching ingredient found.")
        exit(1)

    details = get_ingredient_details(food["fdcId"])
    payload = parse_to_payload(details)
    print(payload)

    try:
        result = post_to_api(payload)
        print("✔️ Successfully imported to API:")
        print(result)
    except requests.HTTPError as e:
        print(f"❌ Failed to POST to API: {e.response.status_code}")
        print(e.response.text)


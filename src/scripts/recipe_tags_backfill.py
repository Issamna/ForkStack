# scripts/prefill_recipe_tags_via_api.py
import requests

API_URL = "https://e6q9keyixh.execute-api.us-east-1.amazonaws.com/prod/tags"

RECIPE_TAGS = [
    # Meal Types
    "Appetizer",
    "Main Course",
    "Side Dish",
    "Dessert",
    "Snack",
    "Salad",
    "Soup",
    "Breakfast",
    "Brunch",
    "Lunch",
    "Dinner",
    "Beverage",
    # Dietary
    "Vegetarian",
    "Vegan",
    "Gluten-Free",
    "Keto",
    "Paleo",
    "Low Carb",
    "High Protein",
    "Dairy-Free",
    "Nut-Free",
    # Methods
    "Baking",
    "Grilling",
    "Roasting",
    "Stir Fry",
    "Air Fryer",
    "Slow Cooker",
    "Pressure Cooker",
    "One-Pot",
    "No-Cook",
    # Dish Formats / Styles
    "Pasta",
    "Pizza",
    "Sandwich",
    "Wrap",
    "Burger",
    "Noodles",
    "Rice Bowl",
    "Casserole",
    "Stew",
    "Curry",
    "Grain Bowl",
    "Taco",
    "Burrito",
    "Flatbread",
    "Dumplings",
    "Skewers",
    "Stuffed Vegetables",
    "Salad Bowl",
    "Dip",
    "Spread",
    "Toast",
    "Porridge",
    "Pancakes",
    "Waffles",
    # Themes
    "Comfort Food",
    "Healthy",
    "Light Meal",
    "Party Food",
    "Kids-Friendly",
    "Holiday",
    "Weeknight",
    "30-Minute Meal",
    # Cuisines
    "Chinese",
    "Japanese",
    "Korean",
    "Thai",
    "Vietnamese",
    "Indian",
    "Filipino",
    "Indonesian",
    "Malaysian",
    "Italian",
    "French",
    "Spanish",
    "Greek",
    "British",
    "German",
    "Scandinavian",
    "Eastern European",
    "Lebanese",
    "Persian",
    "Turkish",
    "Moroccan",
    "Ethiopian",
    "Egyptian",
    "Mexican",
    "Brazilian",
    "Argentinian",
    "Peruvian",
    "Cuban",
    "American",
    "Southern",
    "Tex-Mex",
    "Cajun",
    "Hawaiian",
    "Californian",
    "Midwestern",
    "Caribbean",
    "Fusion",
    "Mediterranean",
    "Global",
]


def create_tag(name):
    response = requests.post(API_URL, json={"name": name})
    if response.status_code == 200:
        print(f"Created: {name}")
    elif response.status_code == 400 and "already exists" in response.text:
        print(f"Skipped duplicate: {name}")
    else:
        print(f"Failed for {name}: {response.status_code} - {response.text}")


if __name__ == "__main__":
    for tag in RECIPE_TAGS:
        create_tag(tag)

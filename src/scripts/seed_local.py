"""Create and seed the local DynamoDB tables for development.

Local-only by design: the script refuses to run against anything but a
localhost endpoint, so it can never write dummy recipes into the real AWS
tables. Point it at a moto server (dev-local.sh starts one):

    moto_server -p 5001

Then:

    python src/scripts/seed_local.py --owner user_local_dev

Recipes are owned by that id because the API scopes everything to the caller's
user id -- seed under the wrong id and the app shows an empty cookbook. With
mock auth that id is `user_local_dev` (VITE_MOCK_USER_ID / MOCK_USER_ID), so the
default just works.
"""

import argparse
import os
import sys
import uuid
from datetime import date, timedelta
from urllib.parse import urlparse

import boto3

TABLES = {
    "RecipeTable": "recipe_id",
    "RecipeTagTable": "id",
    "IngredientTable": "ingredient_id",
    "MealPlanTable": "user_id",
    "ShoppingListTable": "user_id",
}

TAGS = [
    "breakfast", "lunch", "dinner", "main course", "side", "salad",
    "sandwich", "soup", "snack", "dessert", "appetizer", "beverage",
    "quick", "vegetarian", "pasta", "italian", "chinese", "comfort",
]


def ing(quantity, unit, name):
    return {"name": name, "quantity": quantity, "measurement_type": unit}


def steps(*texts):
    return [{"step_number": i + 1, "text": t} for i, t in enumerate(texts)]


RECIPES = [
    {
        "title": "Easy Creamy Spicy Chicken Pasta",
        "servings": 4, "total_time": 35,
        "recipe_tags": ["dinner", "pasta", "italian"],
        "import_source_url": "https://www.bbcgoodfood.com/recipes/creamy-chicken-pasta",
        "ingredients": [
            ing("350", "g", "chicken breast"), ing("250", "g", "rigatoni"),
            ing("75", "g", "cream cheese"), ing("1", "tbsp", "tomato paste"),
            ing("1", "tbsp", "olive oil"), ing("2", "", "garlic cloves"),
            ing("1", "", "shallot"), ing("1", "tsp", "smoked paprika"),
            ing("1", "tsp", "dried oregano"), ing("0.25", "tsp", "cayenne pepper"),
            ing("1", "tbsp", "fresh parsley"), ing("50", "g", "parmesan"),
        ],
        "instructions": steps(
            "Bring a large pan of salted water to the boil and cook the rigatoni until just shy of al dente. Reserve a mug of pasta water before draining.",
            "Sear the chicken in olive oil over a high heat until golden, then lower the heat and add the shallot, garlic, paprika, oregano and cayenne.",
            "Stir in the tomato paste and cream cheese, loosen with pasta water, then fold through the drained rigatoni and finish with parsley and parmesan.",
        ),
    },
    {
        "title": "Crispy Baked Sweet Potato Fries",
        "servings": 4, "total_time": 40,
        "recipe_tags": ["side", "snack", "vegetarian"],
        "ingredients": [
            ing("2", "lb", "sweet potatoes"), ing("2", "tbsp", "olive oil"),
            ing("1", "tbsp", "cornflour"), ing("1", "tsp", "smoked paprika"),
            ing("1", "tsp", "salt"), ing("0.5", "tsp", "black pepper"),
        ],
        "instructions": steps(
            "Heat the oven to 220C. Cut the sweet potatoes into even batons.",
            "Toss with cornflour first, then the oil and spices, so every piece is coated.",
            "Spread on two trays without crowding and roast for 25-30 minutes, turning once.",
        ),
    },
    {
        "title": "Vegetarian Chickpea Sandwich Filling",
        "servings": 2, "total_time": 15,
        "recipe_tags": ["sandwich", "lunch", "vegetarian", "quick"],
        "ingredients": [
            ing("400", "g", "chickpeas"), ing("3", "tbsp", "mayonnaise"),
            ing("1", "", "celery stick"), ing("1", "tbsp", "lemon juice"),
            ing("2", "", "spring onions"), ing("1", "tsp", "dijon mustard"),
        ],
        "instructions": steps(
            "Drain the chickpeas and crush roughly with a fork -- leave plenty of texture.",
            "Fold through the mayonnaise, mustard, lemon juice, diced celery and spring onion.",
            "Season well and pile onto thick bread.",
        ),
    },
    {
        "title": "Charred Broccoli with Garlic",
        "servings": 4, "total_time": 18,
        "recipe_tags": ["side", "vegetarian", "quick"],
        "ingredients": [
            ing("500", "g", "broccoli"), ing("3", "", "garlic cloves"),
            ing("2", "tbsp", "olive oil"), ing("0.5", "tsp", "chilli flakes"),
            ing("1", "tbsp", "lemon juice"),
        ],
        "instructions": steps(
            "Cut the broccoli into flat-sided florets so they take colour.",
            "Fry cut-side down in a hot dry pan until well charred, then add oil, garlic and chilli.",
            "Finish with lemon juice off the heat.",
        ),
    },
    {
        "title": "Chicken Fried Rice",
        "servings": 4, "total_time": 30,
        "recipe_tags": ["dinner", "chinese", "main course"],
        "ingredients": [
            ing("400", "g", "cooked rice"), ing("300", "g", "chicken thigh"),
            ing("3", "", "eggs"), ing("150", "g", "frozen peas"),
            ing("3", "tbsp", "soy sauce"), ing("2", "", "spring onions"),
            ing("1", "tbsp", "sesame oil"), ing("2", "", "garlic cloves"),
        ],
        "instructions": steps(
            "Use rice cooked the day before -- fresh rice steams instead of frying.",
            "Scramble the eggs in a very hot wok and set aside.",
            "Fry the chicken hard, add garlic and peas, then the rice, soy and sesame oil. Return the egg and finish with spring onion.",
        ),
    },
    {
        "title": "Halloumi & Pepper Flatbread",
        "servings": 2, "total_time": 22,
        "recipe_tags": ["lunch", "sandwich", "vegetarian"],
        "ingredients": [
            ing("225", "g", "halloumi"), ing("2", "", "red peppers"),
            ing("2", "", "flatbreads"), ing("3", "tbsp", "greek yoghurt"),
            ing("1", "tsp", "honey"), ing("1", "tbsp", "olive oil"),
        ],
        "instructions": steps(
            "Blister the peppers in a dry pan until the skins darken, then slice.",
            "Fry the halloumi until deeply golden on both sides.",
            "Warm the flatbreads, spread with yoghurt, pile on the peppers and halloumi, and drizzle with honey.",
        ),
    },
    {
        "title": "Roast Tomato & Lentil Soup",
        "servings": 6, "total_time": 35,
        "recipe_tags": ["soup", "lunch", "vegetarian", "comfort"],
        "ingredients": [
            ing("1", "kg", "tomatoes"), ing("200", "g", "red lentils"),
            ing("1", "", "onion"), ing("3", "", "garlic cloves"),
            ing("1", "l", "vegetable stock"), ing("2", "tbsp", "olive oil"),
            ing("1", "tsp", "smoked paprika"),
        ],
        "instructions": steps(
            "Roast the tomatoes and garlic with oil at 200C for 25 minutes until collapsing.",
            "Soften the onion in a large pan, add the lentils, stock and paprika, and simmer for 20 minutes.",
            "Add the roast tomatoes, blend until smooth and season generously.",
        ),
    },
    {
        "title": "Shrimp Fried Rice",
        "servings": 3, "total_time": 25,
        "recipe_tags": ["dinner", "main course", "chinese", "quick"],
        "ingredients": [
            ing("300", "g", "cooked rice"), ing("250", "g", "prawns"),
            ing("2", "", "eggs"), ing("100", "g", "frozen peas"),
            ing("2", "tbsp", "soy sauce"), ing("1", "tbsp", "sesame oil"),
            ing("2", "", "garlic cloves"),
        ],
        "instructions": steps(
            "Pat the prawns very dry so they sear rather than steam.",
            "Cook them fast in a hot wok, remove, then scramble the eggs.",
            "Fry the rice with garlic and peas, return everything, and season with soy and sesame.",
        ),
    },
    {
        "title": "White Bean Chili",
        "servings": 5, "total_time": 45,
        "recipe_tags": ["dinner", "soup", "comfort"],
        "ingredients": [
            ing("800", "g", "cannellini beans"), ing("500", "g", "chicken thigh"),
            ing("1", "", "onion"), ing("2", "", "green chillies"),
            ing("1", "tsp", "ground cumin"), ing("1", "tsp", "dried oregano"),
            ing("700", "ml", "chicken stock"), ing("100", "ml", "soured cream"),
        ],
        "instructions": steps(
            "Brown the chicken, then soften the onion and chillies with the cumin and oregano.",
            "Add the beans and stock and simmer for 25 minutes, crushing some beans to thicken.",
            "Shred the chicken back through and stir in the soured cream off the heat.",
        ),
    },
    {
        "title": "Overnight Oats with Berries",
        "servings": 2, "total_time": 10,
        "recipe_tags": ["breakfast", "quick", "vegetarian"],
        "ingredients": [
            ing("100", "g", "rolled oats"), ing("250", "ml", "milk"),
            ing("150", "g", "greek yoghurt"), ing("150", "g", "mixed berries"),
            ing("1", "tbsp", "honey"), ing("1", "tbsp", "chia seeds"),
        ],
        "instructions": steps(
            "Stir the oats, milk, yoghurt and chia together in a jar.",
            "Chill overnight.",
            "Top with berries and honey before eating.",
        ),
    },
    {
        "title": "Sticky Sesame Aubergine",
        "servings": 3, "total_time": 30,
        "recipe_tags": ["dinner", "vegetarian", "main course"],
        "ingredients": [
            ing("2", "", "aubergines"), ing("3", "tbsp", "soy sauce"),
            ing("2", "tbsp", "honey"), ing("1", "tbsp", "rice vinegar"),
            ing("1", "tbsp", "sesame seeds"), ing("2", "", "garlic cloves"),
            ing("200", "g", "jasmine rice"),
        ],
        "instructions": steps(
            "Halve the aubergines, score deeply and roast cut-side down at 220C for 20 minutes.",
            "Simmer the soy, honey, vinegar and garlic into a glaze.",
            "Brush the glaze over the aubergine, return to the oven for 5 minutes and scatter with sesame.",
        ),
    },
    {
        "title": "Lemon Yoghurt Loaf",
        "servings": 8, "total_time": 55,
        "recipe_tags": ["dessert", "snack", "vegetarian"],
        "ingredients": [
            ing("200", "g", "plain flour"), ing("180", "g", "caster sugar"),
            ing("150", "g", "greek yoghurt"), ing("3", "", "eggs"),
            ing("120", "ml", "sunflower oil"), ing("2", "", "lemons"),
            ing("1.5", "tsp", "baking powder"),
        ],
        "instructions": steps(
            "Whisk the eggs and sugar with the lemon zest until pale.",
            "Fold in the yoghurt and oil, then the flour and baking powder.",
            "Bake at 180C for 45 minutes, then soak with lemon juice while still warm.",
        ),
    },
]


def build_plan(owner_id: str, week_start: date, recipe_ids: dict) -> dict:
    """A week with a mix of days, meals, an anytime entry and an eat-out day."""

    def entry(title, day, meal, servings, eat_out=False, tags=None):
        return {
            "id": str(uuid.uuid4()),
            "recipe_id": recipe_ids.get(title),
            "title": title,
            "tags": tags or [],
            "day": day,
            "meal": meal,
            "who": None,
            "eat_out": eat_out,
            "servings": servings,
        }

    entries = [
        entry("Easy Creamy Spicy Chicken Pasta", "mon", "dinner", 4, tags=["dinner", "pasta"]),
        entry("Crispy Baked Sweet Potato Fries", "mon", "side", 4, tags=["side"]),
        entry("Roast Tomato & Lentil Soup", "tue", "lunch", 6, tags=["soup", "lunch"]),
        entry("White Bean Chili", "tue", "dinner", 5, tags=["dinner", "soup"]),
        entry("Chicken Fried Rice", "thu", "dinner", 4, tags=["dinner", "chinese"]),
        entry("Sticky Sesame Aubergine", "fri", "dinner", 3, tags=["dinner"]),
        entry("Overnight Oats with Berries", "sat", "breakfast", 2, tags=["breakfast"]),
        # Anytime: no day set.
        entry("Vegetarian Chickpea Sandwich Filling", None, "lunch", 2, tags=["sandwich", "lunch"]),
    ]
    out = entry("Pizza out", "wed", "dinner", None, eat_out=True)
    out["recipe_id"] = None
    entries.append(out)

    return {"user_id": owner_id, "weeks": {week_start.isoformat(): entries}}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--owner",
        default=os.environ.get("MOCK_USER_ID", "user_local_dev"),
        help="User id to own the seeded data (default: the mock-auth user)",
    )
    parser.add_argument(
        "--endpoint",
        default=os.environ.get("AWS_ENDPOINT_URL", "http://localhost:5001"),
        help="Mock AWS endpoint (must be localhost)",
    )
    parser.add_argument(
        "--bucket",
        default=os.environ.get("RECIPE_PHOTO_BUCKET", "forkstack-photos-local"),
        help="Photo bucket to create in the mock",
    )
    parser.add_argument(
        "--week-start",
        default=None,
        help="ISO date for the seeded plan week (default: this Monday)",
    )
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Drop the local tables first, so re-seeding doesn't pile up",
    )
    args = parser.parse_args()

    # Hard guard: this script exists to fill a throwaway database. Pointing it
    # at real AWS would scatter dummy recipes through the live tables.
    host = (urlparse(args.endpoint).hostname or "").lower()
    if host not in {"localhost", "127.0.0.1", "::1"}:
        print(f"Refusing to seed a non-local endpoint: {args.endpoint}", file=sys.stderr)
        return 1

    if not args.owner.strip():
        print("--owner must not be empty", file=sys.stderr)
        return 1

    ddb = boto3.resource(
        "dynamodb",
        endpoint_url=args.endpoint,
        region_name="us-east-1",
        aws_access_key_id="local",
        aws_secret_access_key="local",
    )
    client = ddb.meta.client

    if args.reset:
        for name in client.list_tables().get("TableNames", []):
            if name in TABLES:
                client.delete_table(TableName=name)
                client.get_waiter("table_not_exists").wait(TableName=name)
                print(f"dropped {name}")

    existing = set(client.list_tables().get("TableNames", []))
    for name, key in TABLES.items():
        if name in existing:
            continue
        client.create_table(
            TableName=name,
            KeySchema=[{"AttributeName": key, "KeyType": "HASH"}],
            AttributeDefinitions=[{"AttributeName": key, "AttributeType": "S"}],
            BillingMode="PAY_PER_REQUEST",
        )
        client.get_waiter("table_exists").wait(TableName=name)
        print(f"created {name}")

    s3 = boto3.client(
        "s3",
        endpoint_url=args.endpoint,
        region_name="us-east-1",
        aws_access_key_id="local",
        aws_secret_access_key="local",
    )
    buckets = {b["Name"] for b in s3.list_buckets().get("Buckets", [])}
    if args.bucket not in buckets:
        s3.create_bucket(Bucket=args.bucket)
        print(f"created bucket {args.bucket}")

    tag_table = ddb.Table("RecipeTagTable")
    for name in TAGS:
        tag_table.put_item(Item={"id": str(uuid.uuid4()), "name": name})
    print(f"seeded {len(TAGS)} tags")

    recipe_table = ddb.Table("RecipeTable")
    recipe_ids: dict = {}
    for i, r in enumerate(RECIPES):
        rid = str(uuid.uuid4())
        recipe_ids[r["title"]] = rid
        recipe_table.put_item(
            Item={
                "recipe_id": rid,
                "owner_id": args.owner,
                # A couple are public so the Shared and Discover scopes and the
                # visibility toggle have something to show.
                "is_shareable": i % 5 == 0,
                "import_source_url": r.get("import_source_url"),
                "image_key": None,
                **{k: v for k, v in r.items() if k != "import_source_url"},
            }
        )
    print(f"seeded {len(RECIPES)} recipes for {args.owner}")

    if args.week_start:
        week_start = date.fromisoformat(args.week_start)
    else:
        today = date.today()
        week_start = today - timedelta(days=today.weekday())  # Monday

    ddb.Table("MealPlanTable").put_item(
        Item=build_plan(args.owner, week_start, recipe_ids)
    )
    print(f"seeded a meal plan for the week of {week_start.isoformat()}")
    print("\nShopping list is generated on demand -- open the list to build it.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

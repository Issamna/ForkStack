from unittest.mock import patch

from fastapi.testclient import TestClient

from api import app
from tests.helpers import auth
from utils.categories import categorize
from utils.ingredients import canonical_name, canonical_unit, clean_name
from utils.quantity import format_quantity, parse_quantity, parse_servings

client = TestClient(app)
USER = "sl-user"
AUTH = auth(USER)
WEEK = "2026-06-22"

PASTA = {
    "recipe_id": "r1",
    "title": "Tomato Pasta",
    "servings": 4,
    "ingredients": [
        {"name": "roma tomatoes", "quantity": "2", "measurement_type": ""},
        {"name": "garlic", "quantity": "1", "measurement_type": "clove"},
        {"name": "salt", "quantity": "", "measurement_type": ""},
        {"name": "medium onion (diced)", "quantity": "1", "measurement_type": ""},
    ],
}
SALSA = {
    "recipe_id": "r2",
    "title": "Salsa",
    "servings": 4,
    "ingredients": [
        {"name": "Roma Tomatoes", "quantity": "3", "measurement_type": ""},
        {"name": "onion , chopped", "quantity": "1", "measurement_type": ""},
    ],
}


class TestQuantityUtils:
    def test_parse(self):
        assert parse_quantity("2") == 2
        assert parse_quantity("1 1/2") == 1.5
        assert parse_quantity("½") == 0.5
        assert parse_quantity("1-2") == 2  # upper bound
        assert parse_quantity("to taste") is None
        assert parse_quantity("") is None

    def test_servings_and_format(self):
        assert parse_servings("Serves 6") == 6
        assert parse_servings("4 servings") == 4
        assert format_quantity(5.0) == "5"
        assert format_quantity(1.5) == "1.5"


class TestCanonicalization:
    def test_prep_noise_stripped(self):
        assert canonical_name("medium onion (diced)") == "onion"
        assert canonical_name("onion , chopped") == "onion"
        assert canonical_name("finely chopped garlic") == "garlic"
        assert canonical_name("salt, to taste") == "salt"
        assert canonical_name("salt to taste") == "salt"

    def test_singularizes_for_matching_only(self):
        assert canonical_name("Roma Tomatoes") == "roma tomato"
        assert canonical_name("roma tomato") == "roma tomato"
        assert clean_name("Roma Tomatoes") == "roma tomatoes"  # display keeps plural
        assert canonical_name("berries") == "berry"

    def test_meaningful_words_kept(self):
        # These change what you buy — they must NOT merge with the bare word.
        assert canonical_name("boneless, skinless chicken breasts") == \
            "boneless, skinless chicken breast"
        assert canonical_name("dried basil") == "dried basil"
        assert canonical_name("ground beef") == "ground beef"
        assert canonical_name("whole milk") == "whole milk"

    def test_units(self):
        assert canonical_unit("tablespoons") == "tbsp"
        assert canonical_unit("Tablespoon") == "tbsp"
        assert canonical_unit("tbsp") == "tbsp"
        assert canonical_unit("cloves") == "clove"
        assert canonical_unit("") == ""


class TestCategorize:
    def test_basic_aisles(self):
        assert categorize("medium onion (diced)") == "produce"
        assert categorize("boneless, skinless chicken breasts") == "meat"
        assert categorize("shredded cheddar cheese") == "dairy"
        assert categorize("salt") == "spices"
        assert categorize("paper towels") == "household"
        assert categorize("all-purpose flour") == "pantry"
        assert categorize("unicorn dust") == "other"

    def test_phrases_beat_tokens(self):
        assert categorize("bell pepper") == "produce"
        assert categorize("black pepper") == "spices"
        assert categorize("olive oil") == "pantry"
        assert categorize("chicken broth") == "pantry"  # not meat
        assert categorize("sour cream") == "dairy"
        assert categorize("ice cream") == "frozen"

    def test_head_noun_wins(self):
        assert categorize("goat cheese") == "dairy"

    def test_dried_rule(self):
        assert categorize("dried basil") == "spices"
        assert categorize("dried apricots") == "pantry"


@patch("services.shopping_list_service.recipe_table")
@patch("services.shopping_list_service.meal_plan_table")
@patch("services.shopping_list_service.table")
class TestGenerate:
    def _wire(self, mock_table, mock_mp, mock_recipe, entries):
        mock_table.get_item.return_value = {}
        mock_table.put_item.return_value = {}
        mock_mp.get_item.return_value = {"Item": {"weeks": {WEEK: entries}}}
        recipes = {"r1": PASTA, "r2": SALSA}
        mock_recipe.get_item.side_effect = lambda Key: {
            "Item": recipes.get(Key["recipe_id"])
        }

    def test_aggregates_and_scales(self, mock_table, mock_mp, mock_recipe):
        # Pasta wanted 6 (base 4 -> x1.5): tomatoes 2->3; Salsa default 4: tomatoes 3
        entries = [
            {"id": "e1", "recipe_id": "r1", "title": "Tomato Pasta", "servings": 6},
            {"id": "e2", "recipe_id": "r2", "title": "Salsa"},
            {"id": "e3", "title": "Pizza out", "eat_out": True},  # ignored
        ]
        self._wire(mock_table, mock_mp, mock_recipe, entries)
        r = client.post(f"/shopping-list/generate?week={WEEK}", headers=AUTH)
        assert r.status_code == 200
        items = {i["name"].lower(): i for i in r.json()["items"]}
        # 3 (scaled pasta) + 3 (salsa) = 6 roma tomatoes, from both recipes
        tom = items["roma tomatoes"]
        assert tom["quantity"] == "6"
        assert sorted(tom["sources"]) == ["Salsa", "Tomato Pasta"]
        # "medium onion (diced)" + "onion , chopped" pool onto one line:
        # 1 * 1.5 (scaled pasta) + 1 (salsa) = 2.5
        onion = items["onion"]
        assert onion["quantity"] == "2.5"
        assert sorted(onion["sources"]) == ["Salsa", "Tomato Pasta"]
        # garlic scaled 1 -> 1.5
        assert items["garlic"]["quantity"] == "1.5"
        # salt has no number -> blank quantity, still listed
        assert items["salt"]["quantity"] == ""
        # aisle categories assigned
        assert onion["category"] == "produce"
        assert items["salt"]["category"] == "spices"

    def test_preserves_custom_and_removed(self, mock_table, mock_mp, mock_recipe):
        entries = [{"id": "e2", "recipe_id": "r2", "title": "Salsa"}]
        self._wire(mock_table, mock_mp, mock_recipe, entries)
        prev = [
            {"name": "paper towels", "unit": "", "quantity": "2",
             "sources": [], "checked": False, "custom": True, "removed": False},
            {"name": "onion", "unit": "", "quantity": "1",
             "sources": ["Salsa"], "checked": True, "custom": False,
             "removed": True},
        ]
        mock_table.get_item.return_value = {
            "Item": {"weeks": {WEEK: {"items": prev}}}
        }
        r = client.post(f"/shopping-list/generate?week={WEEK}", headers=AUTH)
        assert r.status_code == 200
        items = {i["name"]: i for i in r.json()["items"]}
        # user-added item survives regenerate untouched (and gets an aisle)
        assert items["paper towels"]["custom"] is True
        assert items["paper towels"]["quantity"] == "2"
        assert items["paper towels"]["category"] == "household"
        # removed + checked state carries over to the regenerated onion line
        assert items["onion"]["removed"] is True
        assert items["onion"]["checked"] is True

    def test_requires_auth(self, mock_table, mock_mp, mock_recipe):
        assert client.post(f"/shopping-list/generate?week={WEEK}").status_code == 401

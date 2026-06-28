from unittest.mock import patch

from fastapi.testclient import TestClient

from api import app
from utils.auth import create_access_token
from utils.quantity import format_quantity, parse_quantity, parse_servings

client = TestClient(app)
USER = "sl-user"
AUTH = {"Authorization": f"Bearer {create_access_token({'sub': USER})}"}
WEEK = "2026-06-22"

PASTA = {
    "recipe_id": "r1",
    "title": "Tomato Pasta",
    "servings": 4,
    "ingredients": [
        {"name": "roma tomatoes", "quantity": "2", "measurement_type": ""},
        {"name": "garlic", "quantity": "1", "measurement_type": "clove"},
        {"name": "salt", "quantity": "", "measurement_type": ""},
    ],
}
SALSA = {
    "recipe_id": "r2",
    "title": "Salsa",
    "servings": 4,
    "ingredients": [
        {"name": "Roma Tomatoes", "quantity": "3", "measurement_type": ""},
        {"name": "onion", "quantity": "1", "measurement_type": ""},
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
        # garlic scaled 1 -> 1.5
        assert items["garlic"]["quantity"] == "1.5"
        # salt has no number -> blank quantity, still listed
        assert items["salt"]["quantity"] == ""

    def test_requires_auth(self, mock_table, mock_mp, mock_recipe):
        assert client.post(f"/shopping-list/generate?week={WEEK}").status_code == 401

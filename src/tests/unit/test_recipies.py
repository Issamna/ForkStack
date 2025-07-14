from fastapi.testclient import TestClient
from unittest.mock import patch
from api import app

client = TestClient(app)

sample_recipe = {
    "title": "Grilled Cheese",
    "ingredients": [{"name": "cheese", "quantity": "2 slices"}],
    "instructions": "Toast bread. Add cheese. Grill.",
}


@patch("services.recipe_service.table")
class TestRecipeAPI:

    def test_create_recipe(self, mock_table):
        mock_table.put_item.return_value = {}

        response = client.post("/recipes", json=sample_recipe)
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == sample_recipe["title"]
        assert "recipe_id" in data

    def test_list_recipes(self, mock_table):
        mock_table.scan.return_value = {
            "Items": [dict(recipe_id="abc", **sample_recipe)]
        }

        response = client.get("/recipes")
        assert response.status_code == 200
        assert isinstance(response.json(), list)
        assert response.json()[0]["title"] == "Grilled Cheese"

    def test_get_recipe_by_id(self, mock_table):
        recipe_id = "abc123"
        mock_table.get_item.return_value = {
            "Item": dict(recipe_id=recipe_id, **sample_recipe)
        }

        response = client.get(f"/recipes/{recipe_id}")
        assert response.status_code == 200
        assert response.json()["recipe_id"] == recipe_id

    def test_update_recipe(self, mock_table):
        recipe_id = "abc123"
        mock_table.get_item.return_value = {"Item": True}
        mock_table.put_item.return_value = {}

        response = client.put(f"/recipes/{recipe_id}", json=sample_recipe)
        assert response.status_code == 200
        assert response.json()["title"] == sample_recipe["title"]

    def test_delete_recipe(self, mock_table):
        recipe_id = "abc123"
        mock_table.get_item.return_value = {"Item": True}
        mock_table.delete_item.return_value = {}

        response = client.delete(f"/recipes/{recipe_id}")
        assert response.status_code == 200
        assert response.json() == {"message": "Recipe deleted"}

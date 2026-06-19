from unittest.mock import patch
from fastapi.testclient import TestClient
from api import app
from utils.auth import create_access_token

client = TestClient(app)

TEST_USER_ID = "test-user"
AUTH = {"Authorization": f"Bearer {create_access_token({'sub': TEST_USER_ID})}"}

sample_recipe = {
    "title": "Grilled Cheese",
    "ingredients": [{"name": "cheese", "quantity": "2", "measurement_type": "slices"}],
    "instructions": [{"step_number": 1, "text": "Toast bread. Add cheese. Grill."}],
    "is_shareable": True,
    "owner_id": TEST_USER_ID,
}


@patch("services.recipe_service.table")
class TestRecipeAPI:

    def test_create_recipe(self, mock_table):
        mock_table.put_item.return_value = {}

        response = client.post("/recipes", json=sample_recipe, headers=AUTH)
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == sample_recipe["title"]
        assert "recipe_id" in data

    def test_create_recipe_requires_auth(self, mock_table):
        assert client.post("/recipes", json=sample_recipe).status_code == 401

    def test_list_recipes(self, mock_table):
        mock_table.scan.return_value = {
            "Items": [dict(recipe_id="abc", **sample_recipe)]
        }

        response = client.get("/recipes", headers=AUTH)
        assert response.status_code == 200
        assert isinstance(response.json(), list)
        assert response.json()[0]["title"] == "Grilled Cheese"

    def test_get_recipe_by_id(self, mock_table):
        recipe_id = "abc123"
        mock_table.get_item.return_value = {
            "Item": dict(recipe_id=recipe_id, **sample_recipe)
        }

        response = client.get(f"/recipes/{recipe_id}", headers=AUTH)
        assert response.status_code == 200
        assert response.json()["recipe_id"] == recipe_id

    def test_update_recipe(self, mock_table):
        recipe_id = "abc123"
        mock_table.get_item.return_value = {"Item": {"owner_id": TEST_USER_ID}}
        mock_table.put_item.return_value = {}

        response = client.put(
            f"/recipes/{recipe_id}", json=sample_recipe, headers=AUTH
        )
        assert response.status_code == 200
        assert response.json()["title"] == sample_recipe["title"]

    def test_delete_recipe(self, mock_table):
        recipe_id = "abc123"
        mock_table.get_item.return_value = {"Item": {"owner_id": TEST_USER_ID}}
        mock_table.delete_item.return_value = {}

        response = client.delete(f"/recipes/{recipe_id}", headers=AUTH)
        assert response.status_code == 200
        assert response.json() == {"message": "Recipe deleted"}

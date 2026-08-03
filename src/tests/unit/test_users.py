from unittest.mock import patch

from fastapi.testclient import TestClient

from api import app
from tests.helpers import auth

client = TestClient(app)

# Identity is a Clerk user id now.
USER = "user_2abcCLERK"
AUTH = auth(USER)


class TestAuthRequired:
    def test_delete_requires_token(self):
        r = client.delete("/users/me")
        assert r.status_code == 401


# Login/register/change-password are gone -- Clerk owns them. The only remaining
# /users endpoint deletes the app data (recipes, meal plan, shopping list) that
# this app stores for the signed-in user.
@patch("services.user_service.shopping_list_table")
@patch("services.user_service.meal_plan_table")
@patch("services.user_service.recipe_table")
class TestDeleteMyData:
    def test_delete_cascades_app_data(self, mock_recipe, mock_meal, mock_shop):
        mock_recipe.scan.return_value = {
            "Items": [{"recipe_id": "r1"}, {"recipe_id": "r2"}]
        }
        mock_recipe.delete_item.return_value = {}
        mock_meal.delete_item.return_value = {}
        mock_shop.delete_item.return_value = {}

        r = client.delete("/users/me", headers=AUTH)

        assert r.status_code == 200
        assert r.json()["recipes_deleted"] == 2
        assert mock_recipe.delete_item.call_count == 2
        mock_meal.delete_item.assert_called_once_with(Key={"user_id": USER})
        mock_shop.delete_item.assert_called_once_with(Key={"user_id": USER})

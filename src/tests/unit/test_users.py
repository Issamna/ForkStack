from unittest.mock import patch

from fastapi.testclient import TestClient

from api import app
from utils.auth import create_access_token
from utils.security import hash_password

client = TestClient(app)

TEST_USER_ID = "user-123"
AUTH = {"Authorization": f"Bearer {create_access_token({'sub': TEST_USER_ID})}"}


def _user_record(password="oldpass"):
    return {
        "user_id": TEST_USER_ID,
        "username": "alice",
        "email": "alice@example.com",
        "hashed_password": hash_password(password),
    }


@patch("services.user_service.table")
class TestRegister:
    def test_register_success(self, mock_table):
        mock_table.scan.return_value = {"Items": []}
        mock_table.put_item.return_value = {}
        r = client.post(
            "/users",
            json={"username": "bob", "email": "bob@example.com", "password": "pw"},
        )
        assert r.status_code == 200
        assert r.json()["username"] == "bob"
        assert "user_id" in r.json()

    def test_register_duplicate(self, mock_table):
        mock_table.scan.return_value = {"Items": [{"user_id": "someone-else"}]}
        r = client.post(
            "/users",
            json={"username": "bob", "email": "bob@example.com", "password": "pw"},
        )
        assert r.status_code == 400


class TestAuthRequired:
    def test_get_me_requires_token(self):
        assert client.get("/users/me").status_code == 401

    def test_list_users_removed(self):
        # The public listing was removed; only POST /users exists.
        assert client.get("/users").status_code == 405


@patch("services.user_service.table")
class TestProfile:
    def test_get_me(self, mock_table):
        mock_table.get_item.return_value = {"Item": _user_record()}
        r = client.get("/users/me", headers=AUTH)
        assert r.status_code == 200
        assert r.json() == {
            "user_id": TEST_USER_ID,
            "username": "alice",
            "email": "alice@example.com",
        }

    def test_update_me(self, mock_table):
        mock_table.get_item.return_value = {"Item": _user_record()}
        mock_table.scan.return_value = {"Items": []}  # no username/email conflict
        mock_table.put_item.return_value = {}
        r = client.patch("/users/me", json={"username": "alice2"}, headers=AUTH)
        assert r.status_code == 200
        assert r.json()["username"] == "alice2"

    def test_update_me_conflict(self, mock_table):
        mock_table.get_item.return_value = {"Item": _user_record()}
        mock_table.scan.return_value = {"Items": [{"user_id": "another"}]}
        r = client.patch("/users/me", json={"email": "taken@example.com"}, headers=AUTH)
        assert r.status_code == 400

    def test_change_password_wrong_current(self, mock_table):
        mock_table.get_item.return_value = {"Item": _user_record("realpass")}
        r = client.post(
            "/users/me/change-password",
            json={"current_password": "wrong", "new_password": "x"},
            headers=AUTH,
        )
        assert r.status_code == 400

    def test_change_password_success(self, mock_table):
        mock_table.get_item.return_value = {"Item": _user_record("realpass")}
        mock_table.put_item.return_value = {}
        r = client.post(
            "/users/me/change-password",
            json={"current_password": "realpass", "new_password": "newpw"},
            headers=AUTH,
        )
        assert r.status_code == 200


@patch("services.user_service.shopping_list_table")
@patch("services.user_service.meal_plan_table")
@patch("services.user_service.recipe_table")
@patch("services.user_service.table")
class TestDelete:
    def test_delete_me(
        self, mock_table, mock_recipe_table, mock_meal_plan_table, mock_shopping_table
    ):
        mock_table.get_item.return_value = {"Item": _user_record()}
        mock_recipe_table.scan.return_value = {
            "Items": [{"recipe_id": "r1"}, {"recipe_id": "r2"}]
        }
        r = client.delete("/users/me", headers=AUTH)
        assert r.status_code == 200
        assert r.json()["recipes_deleted"] == 2
        mock_table.delete_item.assert_called_once_with(Key={"user_id": TEST_USER_ID})
        assert mock_recipe_table.delete_item.call_count == 2
        mock_meal_plan_table.delete_item.assert_called_once_with(
            Key={"user_id": TEST_USER_ID}
        )

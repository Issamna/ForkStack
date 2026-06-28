from unittest.mock import patch

from fastapi.testclient import TestClient

from api import app
from utils.auth import create_access_token

client = TestClient(app)
USER = "mp-user"
AUTH = {"Authorization": f"Bearer {create_access_token({'sub': USER})}"}

ENTRY = {
    "id": "e1",
    "recipe_id": "r1",
    "title": "Tacos",
    "tags": ["Dinner"],
    "day": "mon",
    "meal": "dinner",
    "who": "Kids",
    "eat_out": False,
}


WEEK = "2026-06-22"


@patch("services.meal_plan_service.table")
class TestMealPlan:
    def test_get_empty(self, mock_table):
        mock_table.get_item.return_value = {}
        r = client.get(f"/meal-plan?week={WEEK}", headers=AUTH)
        assert r.status_code == 200
        assert r.json() == {"week": WEEK, "entries": []}

    def test_get_existing_week(self, mock_table):
        mock_table.get_item.return_value = {
            "Item": {"user_id": USER, "weeks": {WEEK: [ENTRY]}}
        }
        r = client.get(f"/meal-plan?week={WEEK}", headers=AUTH)
        assert r.status_code == 200
        assert r.json()["entries"][0]["title"] == "Tacos"

    def test_get_other_week_empty(self, mock_table):
        mock_table.get_item.return_value = {
            "Item": {"user_id": USER, "weeks": {WEEK: [ENTRY]}}
        }
        r = client.get("/meal-plan?week=2026-07-06", headers=AUTH)
        assert r.status_code == 200
        assert r.json()["entries"] == []

    def test_save(self, mock_table):
        mock_table.get_item.return_value = {}
        mock_table.put_item.return_value = {}
        quick = {"id": "e2", "title": "Pizza out", "eat_out": True}
        r = client.put(
            f"/meal-plan?week={WEEK}", json={"entries": [ENTRY, quick]}, headers=AUTH
        )
        assert r.status_code == 200
        assert len(r.json()["entries"]) == 2
        assert r.json()["entries"][1]["eat_out"] is True
        mock_table.put_item.assert_called_once()

    def test_bad_week_rejected(self, mock_table):
        assert client.get("/meal-plan?week=nonsense", headers=AUTH).status_code == 422


class TestMealPlanAuth:
    def test_requires_auth(self):
        assert client.get(f"/meal-plan?week={WEEK}").status_code == 401

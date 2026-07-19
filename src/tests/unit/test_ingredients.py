from unittest.mock import patch

from fastapi.testclient import TestClient

from api import app
from tests.helpers import auth

client = TestClient(app)
AUTH = auth("u1")

# ingredient_id is set server-side; any value in the body is ignored.
SAMPLE = {"ingredient_id": "ignored", "name": "Shallot"}


@patch("services.ingredient_service.table")
class TestIngredientCatalog:
    def test_anyone_can_add_a_missing_ingredient(self, mock_table):
        mock_table.scan.return_value = {"Items": []}
        mock_table.put_item.return_value = {}
        r = client.post("/ingredients", json=SAMPLE, headers=AUTH)
        assert r.status_code == 200
        assert r.json()["name"] == "Shallot"

    def test_duplicate_is_rejected(self, mock_table):
        mock_table.scan.return_value = {"Items": [{"name": "shallot"}]}
        r = client.post("/ingredients", json=SAMPLE, headers=AUTH)
        assert r.status_code == 400

    def test_list(self, mock_table):
        mock_table.scan.return_value = {
            "Items": [{"ingredient_id": "1", "name": "Onion"}]
        }
        r = client.get("/ingredients", headers=AUTH)
        assert r.status_code == 200
        assert len(r.json()) == 1

    # The shared catalog is append-only: existing entries can't be edited or
    # removed via the API, so one account can't corrupt it for everyone.
    def test_update_is_not_allowed(self, mock_table):
        r = client.put("/ingredients/1", json=SAMPLE, headers=AUTH)
        assert r.status_code == 405

    def test_delete_is_not_allowed(self, mock_table):
        r = client.delete("/ingredients/1", headers=AUTH)
        assert r.status_code == 405

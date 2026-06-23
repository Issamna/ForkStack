import base64
from unittest.mock import patch

from fastapi.testclient import TestClient

from api import app
from utils.auth import create_access_token
from utils.pdf import build_recipe_pdf

client = TestClient(app)
USER = "pdf-user"
AUTH = {"Authorization": f"Bearer {create_access_token({'sub': USER})}"}

RECIPE = {
    "recipe_id": "r1",
    "title": "Test Pancakes",
    "owner_id": USER,
    "is_shareable": False,
    "ingredients": [{"name": "flour", "quantity": "2", "measurement_type": "cups"}],
    "instructions": [{"step_number": 1, "text": "Mix and cook."}],
    "recipe_tags": ["Breakfast"],
}


def test_build_pdf_returns_pdf_bytes():
    pdf = build_recipe_pdf(RECIPE)
    assert pdf[:4] == b"%PDF"
    assert len(pdf) > 500


@patch("services.recipe_service.table")
class TestPdfEndpoint:
    def test_download_pdf(self, mock_table):
        mock_table.get_item.return_value = {"Item": RECIPE}
        r = client.get("/recipes/r1/pdf", headers=AUTH)
        assert r.status_code == 200
        body = r.json()
        assert body["filename"] == "test-pancakes.pdf"
        assert base64.b64decode(body["content_base64"])[:4] == b"%PDF"

    def test_requires_auth(self, mock_table):
        assert client.get("/recipes/r1/pdf").status_code == 401

    def test_other_users_private_recipe_denied(self, mock_table):
        mock_table.get_item.return_value = {
            "Item": dict(RECIPE, owner_id="someone-else", is_shareable=False)
        }
        assert client.get("/recipes/r1/pdf", headers=AUTH).status_code == 403

from unittest.mock import patch
from fastapi.testclient import TestClient
from api import app
from tests.helpers import auth

client = TestClient(app)

TEST_USER_ID = "test-user"
AUTH = auth(TEST_USER_ID)
# Shaped like a key `utils.photos.presigned_upload` would actually mint.
OWN_KEY = f"recipes/{TEST_USER_ID}/3f2a1c8e-1b2d-4f6a-9c0e-7d8b5a4e3f21.jpg"

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


@patch("services.recipe_service.table")
class TestRecipePhotos:
    """`image_key` is client-supplied, so ownership is enforced server-side."""

    def test_create_rejects_another_users_image_key(self, mock_table):
        mock_table.put_item.return_value = {}

        response = client.post(
            "/recipes",
            json={**sample_recipe, "image_key": "recipes/someone-else/x.jpg"},
            headers=AUTH,
        )
        assert response.status_code == 400
        mock_table.put_item.assert_not_called()

    def test_create_accepts_own_image_key(self, mock_table):
        mock_table.put_item.return_value = {}

        response = client.post(
            "/recipes", json={**sample_recipe, "image_key": OWN_KEY}, headers=AUTH
        )
        assert response.status_code == 200
        assert response.json()["image_key"] == OWN_KEY

    def test_create_rejects_traversal_out_of_own_prefix(self, mock_table):
        """`recipes/<me>/../<victim>/x.jpg` passes a naive prefix check."""
        mock_table.put_item.return_value = {}

        response = client.post(
            "/recipes",
            json={
                **sample_recipe,
                "image_key": f"recipes/{TEST_USER_ID}/../victim/x.jpg",
            },
            headers=AUTH,
        )
        assert response.status_code == 400
        mock_table.put_item.assert_not_called()

    def test_create_rejects_arbitrary_filename_in_own_prefix(self, mock_table):
        """Only the uuid filenames the service mints are accepted."""
        mock_table.put_item.return_value = {}

        response = client.post(
            "/recipes",
            json={**sample_recipe, "image_key": f"recipes/{TEST_USER_ID}/x.jpg"},
            headers=AUTH,
        )
        assert response.status_code == 400
        mock_table.put_item.assert_not_called()

    def test_update_rejects_another_users_image_key(self, mock_table):
        mock_table.get_item.return_value = {"Item": {"owner_id": TEST_USER_ID}}

        response = client.put(
            "/recipes/abc123",
            json={**sample_recipe, "image_key": "recipes/someone-else/x.jpg"},
            headers=AUTH,
        )
        assert response.status_code == 400
        mock_table.put_item.assert_not_called()

    def test_upload_url_rejects_non_image(self, mock_table):
        response = client.post(
            "/recipes/photo-upload",
            json={"content_type": "application/pdf"},
            headers=AUTH,
        )
        assert response.status_code == 400

    def test_upload_url_is_scoped_to_the_caller(self, mock_table):
        with patch("utils.photos._s3") as s3, patch("utils.photos.BUCKET", "b"):
            s3.generate_presigned_post.return_value = {
                "url": "https://s3.example",
                "fields": {"key": "k"},
            }
            response = client.post(
                "/recipes/photo-upload",
                json={"content_type": "image/jpeg"},
                headers=AUTH,
            )

        assert response.status_code == 200
        body = response.json()
        assert body["image_key"].startswith(f"recipes/{TEST_USER_ID}/")
        assert body["url"] == "https://s3.example"

    def test_upload_url_requires_auth(self, mock_table):
        response = client.post(
            "/recipes/photo-upload", json={"content_type": "image/jpeg"}
        )
        assert response.status_code == 401

    def test_minted_keys_pass_the_ownership_check(self, mock_table):
        """The generator and the validator must not drift apart.

        If they do, uploads succeed but every recipe save is rejected.
        """
        from utils import photos

        for content_type in photos.EXTENSIONS:
            with patch("utils.photos._s3") as s3, patch("utils.photos.BUCKET", "b"):
                s3.generate_presigned_post.return_value = {"url": "u", "fields": {}}
                minted = photos.presigned_upload(TEST_USER_ID, content_type)
            assert photos.owns_key(TEST_USER_ID, minted["image_key"])
            assert not photos.owns_key("someone-else", minted["image_key"])

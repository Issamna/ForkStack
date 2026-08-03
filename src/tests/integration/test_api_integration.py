"""End-to-end API tests against a real (mocked) AWS.

The unit tests patch each service's `table` object, which proves the routing
and the ownership rules but never exercises a real DynamoDB round-trip: item
shapes, Decimal coercion, `scan_all` pagination and the S3 presigning all go
untested there. These run the same FastAPI app against moto, so the whole path
from request to stored item is covered.

Tables and the bucket are created per-test, so nothing leaks between cases.
"""

import importlib
import os

import boto3
import pytest
from fastapi.testclient import TestClient
from moto import mock_aws

TABLES = {
    "RecipeTable": "recipe_id",
    "RecipeTagTable": "id",
    "IngredientTable": "ingredient_id",
    "MealPlanTable": "user_id",
    "ShoppingListTable": "user_id",
}
BUCKET = "forkstack-test-photos"
USER = "user_integration"
OTHER_USER = "user_someone_else"


@pytest.fixture
def client():
    """App wired to a fresh mocked AWS, with auth stubbed to a known user."""
    with mock_aws():
        os.environ.update(
            {
                "AWS_ACCESS_KEY_ID": "test",
                "AWS_SECRET_ACCESS_KEY": "test",
                "AWS_DEFAULT_REGION": "us-east-1",
                "RECIPE_TABLE": "RecipeTable",
                "RECIPE_TAG_TABLE": "RecipeTagTable",
                "INGREDIENT_TABLE": "IngredientTable",
                "MEAL_PLAN_TABLE": "MealPlanTable",
                "SHOPPING_LIST_TABLE": "ShoppingListTable",
                "RECIPE_PHOTO_BUCKET": BUCKET,
            }
        )

        ddb = boto3.client("dynamodb", region_name="us-east-1")
        for name, key in TABLES.items():
            ddb.create_table(
                TableName=name,
                KeySchema=[{"AttributeName": key, "KeyType": "HASH"}],
                AttributeDefinitions=[{"AttributeName": key, "AttributeType": "S"}],
                BillingMode="PAY_PER_REQUEST",
            )
        boto3.client("s3", region_name="us-east-1").create_bucket(Bucket=BUCKET)

        # Services bind their table handle at import time, so they must be
        # imported *inside* the mock for the handles to point at it.
        import api
        import dependencies
        from services import (
            meal_plan_service,
            recipe_service,
            shopping_list_service,
            tag_service,
        )
        from utils import photos

        for module in (
            photos,
            recipe_service,
            tag_service,
            meal_plan_service,
            shopping_list_service,
            api,
        ):
            importlib.reload(module)

        api.app.dependency_overrides[dependencies.get_current_user] = lambda: USER
        yield TestClient(api.app)
        api.app.dependency_overrides.clear()


def make_recipe(**overrides):
    return {
        "title": "Test Pasta",
        "ingredients": [
            {"name": "rigatoni", "quantity": "250", "measurement_type": "g"},
            {"name": "cream cheese", "quantity": "75", "measurement_type": "g"},
        ],
        "instructions": [{"step_number": 1, "text": "Boil, stir, serve."}],
        "is_shareable": False,
        "servings": 4,
        "total_time": 35,
        **overrides,
    }


class TestRecipeRoundTrip:
    def test_create_then_read_back(self, client):
        created = client.post("/recipes", json=make_recipe()).json()
        assert created["total_time"] == 35

        fetched = client.get(f"/recipes/{created['recipe_id']}").json()
        assert fetched["title"] == "Test Pasta"
        assert fetched["servings"] == 4
        assert fetched["total_time"] == 35
        assert len(fetched["ingredients"]) == 2

    def test_update_persists(self, client):
        rid = client.post("/recipes", json=make_recipe()).json()["recipe_id"]
        client.put(f"/recipes/{rid}", json=make_recipe(title="Renamed", total_time=50))

        fetched = client.get(f"/recipes/{rid}").json()
        assert fetched["title"] == "Renamed"
        assert fetched["total_time"] == 50

    def test_delete_removes_it(self, client):
        rid = client.post("/recipes", json=make_recipe()).json()["recipe_id"]
        assert client.delete(f"/recipes/{rid}").status_code == 200
        assert client.get(f"/recipes/{rid}").status_code == 404

    def test_list_excludes_other_peoples_private_recipes(self, client):
        client.post("/recipes", json=make_recipe(title="Mine"))

        # Write another user's private recipe straight to the table.
        boto3.resource("dynamodb", region_name="us-east-1").Table(
            "RecipeTable"
        ).put_item(
            Item={
                "recipe_id": "other-1",
                "owner_id": OTHER_USER,
                "is_shareable": False,
                "title": "Theirs",
                "ingredients": [],
                "instructions": [],
            }
        )

        titles = [r["title"] for r in client.get("/recipes").json()]
        assert "Mine" in titles
        assert "Theirs" not in titles


class TestStepIngredients:
    """Per-step ingredient links: None means "never curated", [] means "none"."""

    def test_links_round_trip(self, client):
        payload = make_recipe()
        payload["instructions"] = [
            {"step_number": 1, "text": "Boil the pasta.", "ingredients": [0]},
            {"step_number": 2, "text": "Stir it through.", "ingredients": [0, 1]},
        ]
        rid = client.post("/recipes", json=payload).json()["recipe_id"]

        steps = client.get(f"/recipes/{rid}").json()["instructions"]
        assert steps[0]["ingredients"] == [0]
        assert steps[1]["ingredients"] == [0, 1]

    def test_uncurated_steps_stay_null(self, client):
        """None has to survive: it's what tells readers to fall back to
        matching the step text rather than showing nothing."""
        rid = client.post("/recipes", json=make_recipe()).json()["recipe_id"]
        steps = client.get(f"/recipes/{rid}").json()["instructions"]
        assert steps[0]["ingredients"] is None

    def test_empty_list_is_not_null(self, client):
        payload = make_recipe()
        payload["instructions"] = [
            {"step_number": 1, "text": "Preheat the oven.", "ingredients": []}
        ]
        rid = client.post("/recipes", json=payload).json()["recipe_id"]
        assert client.get(f"/recipes/{rid}").json()["instructions"][0]["ingredients"] == []


class TestStepTimers:
    def test_duration_round_trips(self, client):
        payload = make_recipe()
        payload["instructions"] = [
            {"step_number": 1, "text": "Simmer for 20 minutes.", "duration_seconds": 1200}
        ]
        rid = client.post("/recipes", json=payload).json()["recipe_id"]
        step = client.get(f"/recipes/{rid}").json()["instructions"][0]
        assert step["duration_seconds"] == 1200

    def test_absent_duration_stays_null(self, client):
        """None is what tells cook mode to read a duration out of the text."""
        rid = client.post("/recipes", json=make_recipe()).json()["recipe_id"]
        assert client.get(f"/recipes/{rid}").json()["instructions"][0]["duration_seconds"] is None

    def test_absurd_durations_are_refused(self, client):
        for bad in (0, -60, 25 * 3600):
            payload = make_recipe()
            payload["instructions"] = [
                {"step_number": 1, "text": "Wait.", "duration_seconds": bad}
            ]
            assert client.post("/recipes", json=payload).status_code == 422, bad


class TestPhotos:
    def test_presigned_post_targets_the_bucket(self, client):
        body = client.post(
            "/recipes/photo-upload", json={"content_type": "image/jpeg"}
        ).json()
        assert body["image_key"].startswith(f"recipes/{USER}/")
        assert BUCKET in body["url"] or BUCKET in body["fields"].get("key", "")

    def test_recipe_with_photo_gets_a_view_url(self, client):
        key = client.post(
            "/recipes/photo-upload", json={"content_type": "image/jpeg"}
        ).json()["image_key"]

        created = client.post("/recipes", json=make_recipe(image_key=key)).json()
        assert created["image_key"] == key
        assert created["image_url"] and BUCKET in created["image_url"]

    def test_another_users_key_is_refused(self, client):
        payload = make_recipe(
            image_key=f"recipes/{OTHER_USER}/3f2a1c8e-1b2d-4f6a-9c0e-7d8b5a4e3f21.jpg"
        )
        assert client.post("/recipes", json=payload).status_code == 400


class TestPlanToShoppingList:
    """The core domain flow: plan a week, generate the list from it."""

    def _plan(self, client, recipe_id, servings=4, eat_out=False):
        return client.put(
            "/meal-plan?week=2026-08-03",
            json={
                "entries": [
                    {
                        "id": "e1",
                        "recipe_id": recipe_id,
                        "title": "Test Pasta",
                        "tags": [],
                        "day": "mon",
                        "meal": "dinner",
                        "who": None,
                        "eat_out": eat_out,
                        "servings": servings,
                    }
                ]
            },
        )

    def test_list_is_generated_from_the_plan(self, client):
        rid = client.post("/recipes", json=make_recipe()).json()["recipe_id"]
        assert self._plan(client, rid).status_code == 200

        items = client.post("/shopping-list/generate?week=2026-08-03").json()["items"]
        names = {i["name"] for i in items}
        assert "rigatoni" in names
        assert all(i["sources"] == ["Test Pasta"] for i in items)

    def test_servings_scale_the_quantities(self, client):
        rid = client.post("/recipes", json=make_recipe()).json()["recipe_id"]
        self._plan(client, rid, servings=8)  # recipe serves 4 -> double

        items = client.post("/shopping-list/generate?week=2026-08-03").json()["items"]
        rigatoni = next(i for i in items if i["name"] == "rigatoni")
        assert rigatoni["quantity"] == "500"

    def test_eating_out_contributes_nothing(self, client):
        rid = client.post("/recipes", json=make_recipe()).json()["recipe_id"]
        self._plan(client, rid, eat_out=True)

        items = client.post("/shopping-list/generate?week=2026-08-03").json()["items"]
        assert items == []

    def test_checked_state_survives_regeneration(self, client):
        rid = client.post("/recipes", json=make_recipe()).json()["recipe_id"]
        self._plan(client, rid)

        items = client.post("/shopping-list/generate?week=2026-08-03").json()["items"]
        items[0]["checked"] = True
        client.put("/shopping-list?week=2026-08-03", json={"items": items})

        regenerated = client.post("/shopping-list/generate?week=2026-08-03").json()
        ticked = [i for i in regenerated["items"] if i["checked"]]
        assert len(ticked) == 1
        assert ticked[0]["name"] == items[0]["name"]

    def test_custom_items_survive_regeneration(self, client):
        rid = client.post("/recipes", json=make_recipe()).json()["recipe_id"]
        self._plan(client, rid)
        items = client.post("/shopping-list/generate?week=2026-08-03").json()["items"]

        items.append(
            {
                "name": "paper towels",
                "unit": "",
                "quantity": "2",
                "sources": [],
                "checked": False,
                "custom": True,
                "removed": False,
            }
        )
        client.put("/shopping-list?week=2026-08-03", json={"items": items})

        regenerated = client.post("/shopping-list/generate?week=2026-08-03").json()
        assert "paper towels" in {i["name"] for i in regenerated["items"]}

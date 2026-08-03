from unittest.mock import patch

from fastapi.testclient import TestClient

from api import app
from tests.helpers import auth

client = TestClient(app)
AUTH = auth("test-user")


def _reset_token_cache():
    from services import feedback_service

    feedback_service._token.cache_clear()


class TestFeedback:
    def test_requires_auth(self):
        res = client.post("/feedback", json={"type": "bug", "title": "x"})
        assert res.status_code == 401

    def test_rejects_a_blank_title(self):
        _reset_token_cache()
        res = client.post(
            "/feedback", json={"type": "bug", "title": "   "}, headers=AUTH
        )
        assert res.status_code == 400

    def test_says_so_when_no_token_is_configured(self):
        """Without storage there's nowhere to keep the report, so refusing it
        is better than accepting and silently dropping it."""
        _reset_token_cache()
        with patch.dict("os.environ", {"GITHUB_FEEDBACK_TOKEN": ""}, clear=False):
            with patch("services.feedback_service.boto3.client", side_effect=Exception):
                res = client.post(
                    "/feedback",
                    json={"type": "bug", "title": "Broken"},
                    headers=AUTH,
                )
        assert res.status_code == 503

    def test_creates_an_issue_and_returns_its_link(self):
        _reset_token_cache()
        with patch.dict("os.environ", {"GITHUB_FEEDBACK_TOKEN": "tok"}, clear=False):
            with patch("services.feedback_service.requests.post") as post:
                post.return_value.status_code = 201
                post.return_value.json.return_value = {
                    "number": 42,
                    "html_url": "https://github.com/Issamna/ForkStack/issues/42",
                }
                res = client.post(
                    "/feedback",
                    json={
                        "type": "feature",
                        "title": "Sort by how often I cook",
                        "description": "Would help.",
                    },
                    headers=AUTH,
                )

        assert res.status_code == 200
        assert res.json() == {
            "number": 42,
            "url": "https://github.com/Issamna/ForkStack/issues/42",
        }

        sent = post.call_args.kwargs["json"]
        assert sent["labels"] == ["enhancement"]
        assert "test-user" in sent["body"]

    def test_github_errors_do_not_leak_the_response_body(self):
        _reset_token_cache()
        with patch.dict("os.environ", {"GITHUB_FEEDBACK_TOKEN": "tok"}, clear=False):
            with patch("services.feedback_service.requests.post") as post:
                post.return_value.status_code = 403
                post.return_value.text = "token scope: repo, admin:org"
                res = client.post(
                    "/feedback",
                    json={"type": "bug", "title": "Broken"},
                    headers=AUTH,
                )

        assert res.status_code == 502
        assert "scope" not in res.json()["detail"]

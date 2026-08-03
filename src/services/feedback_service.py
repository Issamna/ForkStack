"""In-app bug reports and feature requests, filed as GitHub issues.

GitHub is already the tracker, so reports go straight there rather than into a
table of their own -- no extra storage to keep in sync, and the issue link comes
back to the user immediately.

The token is a SecureString in SSM Parameter Store (free, unlike Secrets
Manager) read once per cold start. `GITHUB_FEEDBACK_TOKEN` overrides it for
local development.
"""

import os
from functools import lru_cache

import boto3
import requests
from fastapi import APIRouter, Depends, HTTPException

from dependencies import get_current_user
from models.feedback import FeedbackIn, FeedbackOut

REPO = os.environ.get("GITHUB_FEEDBACK_REPO", "Issamna/ForkStack")
TOKEN_PARAM = os.environ.get("GITHUB_FEEDBACK_PARAM", "")
LABELS = {"bug": "bug", "feature": "enhancement"}

router = APIRouter()


@lru_cache(maxsize=1)
def _token() -> str | None:
    """Resolve the GitHub token; cached for the life of the container."""
    direct = os.environ.get("GITHUB_FEEDBACK_TOKEN")
    if direct:
        return direct
    if not TOKEN_PARAM:
        return None
    try:
        ssm = boto3.client("ssm")
        got = ssm.get_parameter(Name=TOKEN_PARAM, WithDecryption=True)
        return got["Parameter"]["Value"]
    except Exception:
        return None


def _body(payload: FeedbackIn, user_id: str) -> str:
    return "\n".join(
        [
            f"**Type:** {'Bug report' if payload.type == 'bug' else 'Feature request'}",
            f"**Reported by:** `{user_id}`",
            "",
            payload.description.strip() or "_(no description)_",
            "",
            "_Filed automatically from in-app feedback._",
        ]
    )


@router.post("", response_model=FeedbackOut)
def create_feedback(
    payload: FeedbackIn, current_user_id: str = Depends(get_current_user)
):
    title = payload.title.strip()
    if not title:
        raise HTTPException(status_code=400, detail="Please add a short title.")

    token = _token()
    if not token:
        # Say so plainly: without storage there is no way to keep the report,
        # and silently dropping it would be worse than refusing it.
        raise HTTPException(
            status_code=503,
            detail="Feedback isn't configured yet. Please open an issue on GitHub directly.",
        )

    try:
        res = requests.post(
            f"https://api.github.com/repos/{REPO}/issues",
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/vnd.github+json",
                "User-Agent": "forkstack-feedback",
            },
            json={
                "title": title,
                "body": _body(payload, current_user_id),
                "labels": [LABELS.get(payload.type, "bug")],
            },
            timeout=10,
        )
    except requests.RequestException:
        raise HTTPException(
            status_code=502, detail="Couldn't reach GitHub. Please try again."
        )

    if res.status_code not in (200, 201):
        # Never surface GitHub's response body -- it can echo the token scope
        # and repository details.
        raise HTTPException(
            status_code=502, detail="GitHub rejected the report. Please try again."
        )

    issue = res.json()
    return {"number": issue["number"], "url": issue["html_url"]}

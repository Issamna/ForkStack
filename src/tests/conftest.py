import os

# dependencies.py reads CLERK_ISSUER at import; give it a value so import is
# clean. Tests never actually reach Clerk -- get_current_user is overridden.
os.environ.setdefault("CLERK_ISSUER", "https://test.clerk.accounts.dev")

# Service modules build boto3 clients at import time, so region and credentials
# must exist before anything is imported. Set here rather than in a fixture for
# two reasons: without a region, collection fails outright on a machine with no
# AWS config (which is every CI runner), and pinning fake credentials stops a
# test that loses its mock from reaching a real account with a developer's keys.
os.environ.setdefault("AWS_DEFAULT_REGION", "us-east-1")
os.environ.setdefault("AWS_ACCESS_KEY_ID", "testing")
os.environ.setdefault("AWS_SECRET_ACCESS_KEY", "testing")
os.environ.setdefault("AWS_SESSION_TOKEN", "testing")

from fastapi import HTTPException, Request  # noqa: E402
from jose import jwt  # noqa: E402

from api import app  # noqa: E402
from dependencies import get_current_user  # noqa: E402


def _test_current_user(request: Request) -> str:
    """Test override for get_current_user: trust the token's `sub` without
    contacting Clerk. Real Clerk RS256/JWKS verification is exercised at
    runtime, not in unit tests."""
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    return jwt.get_unverified_claims(header.split(" ", 1)[1])["sub"]


app.dependency_overrides[get_current_user] = _test_current_user

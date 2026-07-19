import os

# dependencies.py reads CLERK_ISSUER at import; give it a value so import is
# clean. Tests never actually reach Clerk -- get_current_user is overridden.
os.environ.setdefault("CLERK_ISSUER", "https://test.clerk.accounts.dev")

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

"""Local-development ASGI app: the real API with mock authentication.

**This module is never imported by the Lambda.** The deployed handler is
`api.handler`; nothing in the production import graph reaches this file, so the
override below cannot be switched on in a deployed environment -- which is why
mock auth lives here rather than behind an env flag inside `dependencies`. An
env flag in the auth path is one bad default away from disabling auth in prod.

Run it with `uvicorn local_app:app` (see dev-local.sh), never `api:app`, when
you want to work without a Clerk instance.
"""

import os

from fastapi import Header, HTTPException

from api import app
from dependencies import get_current_user

# Refuse to load inside Lambda, belt-and-braces on top of the import-graph
# guarantee above.
if os.environ.get("AWS_LAMBDA_FUNCTION_NAME"):
    raise RuntimeError("local_app must never be loaded in Lambda")

DEFAULT_USER = os.environ.get("MOCK_USER_ID", "user_local_dev")


def mock_current_user(authorization: str | None = Header(default=None)) -> str:
    """Accept the façade's `Bearer mock:<user_id>` token.

    Still rejects unauthenticated requests, so local behaviour matches
    production closely enough for the tests to be worth something.
    """
    if not authorization:
        raise HTTPException(status_code=401, detail="Not authenticated")
    prefix = "Bearer mock:"
    if authorization.startswith(prefix):
        return authorization[len(prefix) :] or DEFAULT_USER
    return DEFAULT_USER


app.dependency_overrides[get_current_user] = mock_current_user

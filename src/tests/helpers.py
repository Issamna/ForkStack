from jose import jwt


def make_token(sub: str) -> str:
    """A minimal JWT carrying `sub`. The conftest override reads it unverified,
    so the signing key here is irrelevant to the tests."""
    return jwt.encode({"sub": sub}, "test-key", algorithm="HS256")


def auth(sub: str) -> dict:
    return {"Authorization": f"Bearer {make_token(sub)}"}

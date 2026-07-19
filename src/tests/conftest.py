import os

# Provide a deterministic signing key so token-authenticated tests can mint
# real bearer tokens without reaching Secrets Manager.
os.environ.setdefault("JWT_SECRET_KEY", "test-secret")

from unittest.mock import patch  # noqa: E402

import pytest  # noqa: E402


@pytest.fixture(autouse=True)
def _auth_user_table():
    """get_current_user does a GetItem for the token-revocation check. Default
    it to a user at token_version 0 so tokens minted with the default ver
    validate. Tests that need a specific version re-patch dependencies._user_table.
    """
    with patch("dependencies._user_table") as t:
        t.get_item.return_value = {"Item": {"user_id": "x", "token_version": 0}}
        yield

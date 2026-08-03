"""Direct tests of the Clerk token verification.

conftest overrides `get_current_user` for every other test, so without these the
actual auth boundary is never exercised. Signing keys are generated here and
`_jwks` is stubbed, so nothing contacts Clerk.
"""

import time

import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import HTTPException
from jose import jwt as jose_jwt
from jose.utils import base64url_encode

import dependencies

ISSUER = "https://mint-chow-13.clerk.accounts.dev"
PARTY = "https://issamna.github.io"


@pytest.fixture
def signing(monkeypatch):
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    pem = key.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption(),
    ).decode()
    nums = key.public_key().public_numbers()

    def b64(i):
        return base64url_encode(i.to_bytes((i.bit_length() + 7) // 8, "big")).decode()

    jwk = {
        "kty": "RSA",
        "kid": "testkid",
        "use": "sig",
        "alg": "RS256",
        "n": b64(nums.n),
        "e": b64(nums.e),
    }

    monkeypatch.setattr(dependencies, "CLERK_ISSUER", ISSUER)
    monkeypatch.setattr(dependencies, "_AUTHORIZED_PARTIES", [PARTY])
    monkeypatch.setattr(dependencies, "_jwks", lambda force=False: [jwk])
    return pem


def token(pem, **overrides):
    now = int(time.time())
    claims = {
        "sub": "user_abc",
        "iss": ISSUER,
        "iat": now,
        "exp": now + 3600,
        "azp": PARTY,
        **overrides,
    }
    claims = {k: v for k, v in claims.items() if v is not None}
    return jose_jwt.encode(claims, pem, algorithm="RS256", headers={"kid": "testkid"})


def call(tok):
    class Creds:
        credentials = tok

    return dependencies.get_current_user(Creds())


class TestTokenVerification:
    def test_valid_token_is_accepted(self, signing):
        assert call(token(signing)) == "user_abc"

    def test_expired_token_rejected(self, signing):
        with pytest.raises(HTTPException) as e:
            call(token(signing, exp=int(time.time()) - 60))
        assert e.value.status_code == 401

    def test_wrong_issuer_rejected(self, signing):
        with pytest.raises(HTTPException):
            call(token(signing, iss="https://evil.example"))

    def test_unknown_key_id_rejected(self, signing):
        tok = jose_jwt.encode(
            {"sub": "x", "iss": ISSUER, "exp": int(time.time()) + 60, "azp": PARTY},
            signing,
            algorithm="RS256",
            headers={"kid": "not-a-real-kid"},
        )
        with pytest.raises(HTTPException):
            call(tok)

    def test_foreign_authorized_party_rejected(self, signing):
        with pytest.raises(HTTPException):
            call(token(signing, azp="https://evil.example"))

    def test_missing_authorized_party_rejected(self, signing):
        """Regression: the check used to be skipped when `azp` was absent, so
        any token this Clerk instance signed was accepted whatever its origin."""
        with pytest.raises(HTTPException) as e:
            call(token(signing, azp=None))
        assert e.value.status_code == 401

    def test_missing_subject_rejected(self, signing):
        with pytest.raises(HTTPException):
            call(token(signing, sub=None))

    def test_no_credentials_rejected(self):
        with pytest.raises(HTTPException) as e:
            dependencies.get_current_user(None)
        assert e.value.status_code == 401

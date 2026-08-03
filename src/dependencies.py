import json
import os
import threading
import time
import urllib.request

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt
from jose.exceptions import JWTError

# Clerk Frontend API / issuer, e.g. https://mint-chow-13.clerk.accounts.dev
CLERK_ISSUER = os.environ.get("CLERK_ISSUER", "").rstrip("/")
# Frontend origins Clerk may issue tokens for; checked against the `azp` claim.
_AUTHORIZED_PARTIES = [
    p.strip()
    for p in os.environ.get("CLERK_AUTHORIZED_PARTIES", "").split(",")
    if p.strip()
]

_bearer = HTTPBearer(auto_error=False)

_JWKS_TTL = 3600
_jwks_cache = {"keys": None, "at": 0.0}
_jwks_lock = threading.Lock()


def _jwks():
    """Clerk's public signing keys, cached per-process (rotated hourly)."""
    if _jwks_cache["keys"] is None or time.time() - _jwks_cache["at"] > _JWKS_TTL:
        with _jwks_lock:
            if (
                _jwks_cache["keys"] is None
                or time.time() - _jwks_cache["at"] > _JWKS_TTL
            ):
                url = f"{CLERK_ISSUER}/.well-known/jwks.json"
                with urllib.request.urlopen(url, timeout=5) as resp:
                    _jwks_cache["keys"] = json.loads(resp.read())["keys"]
                    _jwks_cache["at"] = time.time()
    return _jwks_cache["keys"]


def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(_bearer),
) -> str:
    """Verify a Clerk session JWT and return the Clerk user id (`sub`).

    Clerk signs session tokens with RS256; we fetch its public keys from the
    instance JWKS endpoint and validate signature, issuer, and expiry. No shared
    secret is involved -- verification uses public keys only.
    """
    if creds is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    token = creds.credentials
    try:
        kid = jwt.get_unverified_header(token).get("kid")
        key = next((k for k in _jwks() if k.get("kid") == kid), None)
        if key is None:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token")
        claims = jwt.decode(
            token,
            key,
            algorithms=["RS256"],
            issuer=CLERK_ISSUER,
            options={"verify_aud": False},
        )
    except JWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token")

    azp = claims.get("azp")
    if _AUTHORIZED_PARTIES and azp and azp not in _AUTHORIZED_PARTIES:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token")

    sub = claims.get("sub")
    if not sub:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token")
    return sub

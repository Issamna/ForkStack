import os
from datetime import datetime, timedelta

from jose import jwt

from utils.secrets import get_secret_value

ALGORITHM = os.environ.get("JWT_ALGORITHM", "HS256")


def get_jwt_secret() -> str:
    """Signing key for access tokens.

    Prefers the ``JWT_SECRET_KEY`` env var (local development), otherwise reads
    the secret referenced by ``JWT_SECRET_ARN`` from Secrets Manager. Raises if
    neither is configured -- there is intentionally no insecure default.
    """
    secret = os.environ.get("JWT_SECRET_KEY") or get_secret_value("JWT_SECRET_ARN")
    if not secret:
        raise RuntimeError(
            "JWT secret is not configured: set JWT_SECRET_KEY (local) "
            "or JWT_SECRET_ARN (deployed)."
        )
    return secret


def create_access_token(data: dict, expires_delta: int = 1):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(hours=expires_delta)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, get_jwt_secret(), algorithm=ALGORITHM)

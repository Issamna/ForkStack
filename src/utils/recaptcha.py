import os

import requests
from fastapi import HTTPException

from utils.secrets import get_secret_value

VERIFY_URL = "https://www.google.com/recaptcha/api/siteverify"
SCORE_THRESHOLD = 0.5


def _enforced() -> bool:
    return os.environ.get("ENFORCE_RECAPTCHA", "").lower() in ("1", "true", "yes")


def verify(token: str | None) -> None:
    """Validate a reCAPTCHA v3 token.

    No-op unless ``ENFORCE_RECAPTCHA`` is truthy, so deployments without the
    secret populated keep working. Raises an HTTPException on any failure.
    """
    if not _enforced():
        return

    secret = os.environ.get("RECAPTCHA_SECRET") or get_secret_value(
        "RECAPTCHA_SECRET_ARN"
    )
    if not secret:
        raise HTTPException(status_code=500, detail="reCAPTCHA is not configured")
    if not token:
        raise HTTPException(status_code=400, detail="Missing captcha token")

    try:
        resp = requests.post(
            VERIFY_URL,
            data={"secret": secret, "response": token},
            timeout=10,
        )
        result = resp.json()
    except Exception:
        raise HTTPException(status_code=502, detail="Could not verify captcha")

    if not result.get("success") or result.get("score", 0) < SCORE_THRESHOLD:
        raise HTTPException(status_code=400, detail="Captcha verification failed")

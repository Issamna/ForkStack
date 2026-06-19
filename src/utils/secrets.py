import json
import os

import boto3

# Secret values are immutable for the life of a Lambda execution environment,
# so cache them per-process to avoid a Secrets Manager call on every request.
_cache: dict[str, str] = {}


def _fetch(secret_id: str) -> str:
    client = boto3.client("secretsmanager")
    resp = client.get_secret_value(SecretId=secret_id)
    return resp.get("SecretString", "")


def get_secret_value(env_var: str, *, json_key: str | None = None) -> str | None:
    """Resolve a secret whose ARN/name is held in environment variable ``env_var``.

    Returns ``None`` when the env var is unset (so callers can fall back to a
    local override). When ``json_key`` is given the secret string is parsed as
    JSON and that key is returned.
    """
    secret_id = os.environ.get(env_var)
    if not secret_id:
        return None

    if secret_id not in _cache:
        _cache[secret_id] = _fetch(secret_id)
    raw = _cache[secret_id]

    if json_key:
        try:
            return json.loads(raw).get(json_key)
        except (json.JSONDecodeError, AttributeError):
            return None
    return raw

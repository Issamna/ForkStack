import os

# Provide a deterministic signing key so token-authenticated tests can mint
# real bearer tokens without reaching Secrets Manager.
os.environ.setdefault("JWT_SECRET_KEY", "test-secret")

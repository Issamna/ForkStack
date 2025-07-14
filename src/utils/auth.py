import os
from datetime import datetime, timedelta
from jose import jwt

SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "secret_key_yo")
ALGORITHM = os.environ.get("JWT_ALGORITHM", "HS256")


def create_access_token(data: dict, expires_delta: int = 1):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(hours=expires_delta)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

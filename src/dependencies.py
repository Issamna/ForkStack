import os

import boto3
from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError

from utils.auth import ALGORITHM, get_jwt_secret


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/users/login")

_dynamodb = boto3.resource("dynamodb")
_user_table = _dynamodb.Table(os.environ.get("USER_TABLE", "UserTable"))


def get_current_user(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")

    # Revocation check: the token carries the account's token_version from when
    # it was issued. Changing the password bumps that version (and deleting the
    # account removes the record), so all older tokens stop validating here.
    # Costs one GetItem per authenticated request.
    user = _user_table.get_item(Key={"user_id": user_id}).get("Item")
    if not user:
        raise HTTPException(status_code=401, detail="Invalid token")
    if int(payload.get("ver", 0)) != int(user.get("token_version", 0)):
        raise HTTPException(
            status_code=401, detail="Session expired, please log in again"
        )

    return user_id

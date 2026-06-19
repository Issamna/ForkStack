from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError

from utils.auth import ALGORITHM, get_jwt_secret


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/users/login")


def get_current_user(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        return user_id
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

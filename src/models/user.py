from typing import Optional

from pydantic import BaseModel, EmailStr


class UserIn(BaseModel):
    username: str
    password: str
    email: EmailStr
    captcha_token: Optional[str] = None


class UserOut(BaseModel):
    user_id: str
    username: str
    email: EmailStr


class UserDB(UserOut):
    hashed_password: str


class UserUpdate(BaseModel):
    username: Optional[str] = None
    email: Optional[EmailStr] = None


class PasswordChange(BaseModel):
    current_password: str
    new_password: str

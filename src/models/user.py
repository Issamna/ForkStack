from typing import Optional

from pydantic import BaseModel, EmailStr, Field

# Minimum length only -- length is the property that actually resists brute
# force; composition rules mostly push users toward predictable patterns.
MIN_PASSWORD_LENGTH = 10


class UserIn(BaseModel):
    username: str = Field(..., min_length=1, max_length=100)
    password: str = Field(..., min_length=MIN_PASSWORD_LENGTH, max_length=256)
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
    new_password: str = Field(..., min_length=MIN_PASSWORD_LENGTH, max_length=256)

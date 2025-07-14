from pydantic import BaseModel, EmailStr


class UserIn(BaseModel):
    username: str
    password: str
    email: EmailStr


class UserOut(BaseModel):
    user_id: str
    username: str
    email: EmailStr


class UserDB(UserOut):
    hashed_password: str

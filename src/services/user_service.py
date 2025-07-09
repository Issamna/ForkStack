import boto3
import logging
import os
import uuid
from typing import List

from fastapi import APIRouter, HTTPException, Depends
from boto3.dynamodb.conditions import Attr
from fastapi.security import OAuth2PasswordRequestForm
from passlib.context import CryptContext

from models.token import Token
from models.user import UserIn, UserOut
from utils.auth import create_access_token
from utils.security import hash_password, verify_password


logger = logging.getLogger("user_service")
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(os.environ.get("USER_TABLE", "UserTable"))

router = APIRouter()

@router.post("", response_model=UserOut)
def create_user(user: UserIn):
    existing = table.scan(
        FilterExpression=Attr("username").eq(user.username) | Attr("email").eq(user.email),
        ProjectionExpression="user_id"
    )
    if existing.get("Items"):
        raise HTTPException(status_code=400, detail="Username or email already exists")

    user_id = str(uuid.uuid4())
    item = {
        "user_id": user_id,
        "username": user.username,
        "email": user.email,
        "hashed_password": hash_password(user.password),
    }
    table.put_item(Item=item)
    return UserOut(user_id=user_id, username=user.username, email=user.email)

@router.get("", response_model=List[UserOut])
def list_users():
    users = table.scan().get("Items", [])
    return [{"user_id": u["user_id"], "username": u["username"], "email": u["email"]} for u in users]

@router.get("/{user_id}", response_model=UserOut)
def get_user(user_id: str):
    response = table.get_item(Key={"user_id": user_id})
    item = response.get("Item")
    if not item:
        raise HTTPException(status_code=404, detail="User not found")
    return UserOut(user_id=item["user_id"], username=item["username"], email=item["email"])

@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends()):
    logger.info(f"Login attempt: username={form_data.username!r}")
    logger.info(f"Login attempt: username={form_data.username}")
    users = table.scan().get("Items", [])
    for u in users:
        logger.info(u["username"])
    users = table.scan(
        FilterExpression=Attr("username").eq(form_data.username)
    ).get("Items", [])

    if not users:
        logger.warning("User not found for username: %s", form_data.username)
        raise HTTPException(status_code=400, detail="Invalid username")

    user = users[0]
    if not verify_password(form_data.password, user["hashed_password"]):
        raise HTTPException(status_code=400, detail="Invalid password")

    access_token = create_access_token(data={"sub": user["user_id"]})
    return {"access_token": access_token, "token_type": "bearer"}
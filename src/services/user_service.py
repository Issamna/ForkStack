import boto3
import logging
import os
import uuid

from fastapi import APIRouter, HTTPException, Depends, Request
from boto3.dynamodb.conditions import Attr

from dependencies import get_current_user
from models.token import Token
from models.user import UserIn, UserOut, UserUpdate, PasswordChange
from utils import recaptcha
from utils.auth import create_access_token
from utils.security import hash_password, verify_password


logger = logging.getLogger("user_service")
dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(os.environ.get("USER_TABLE", "UserTable"))
recipe_table = dynamodb.Table(os.environ.get("RECIPE_TABLE", "RecipeTable"))
meal_plan_table = dynamodb.Table(os.environ.get("MEAL_PLAN_TABLE", "MealPlanTable"))

router = APIRouter()


def _get_user_or_404(user_id: str) -> dict:
    item = table.get_item(Key={"user_id": user_id}).get("Item")
    if not item:
        raise HTTPException(status_code=404, detail="User not found")
    return item


def _conflict_exists(username: str | None, email: str | None, exclude_user_id: str | None) -> bool:
    """True if another user already uses this username or email."""
    conditions = []
    if username:
        conditions.append(Attr("username").eq(username))
    if email:
        conditions.append(Attr("email").eq(email))
    if not conditions:
        return False

    filter_expr = conditions[0]
    for cond in conditions[1:]:
        filter_expr = filter_expr | cond

    items = table.scan(
        FilterExpression=filter_expr, ProjectionExpression="user_id"
    ).get("Items", [])
    return any(u["user_id"] != exclude_user_id for u in items)


@router.post("", response_model=UserOut)
def create_user(user: UserIn):
    recaptcha.verify(user.captcha_token)

    if _conflict_exists(user.username, user.email, exclude_user_id=None):
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


@router.post("/login", response_model=Token)
async def login(request: Request):
    form = await request.form()
    username = form.get("username")
    password = form.get("password")
    remember_me = form.get("remember_me") == "true"

    users = table.scan(FilterExpression=Attr("username").eq(username)).get("Items", [])

    if not users:
        logger.warning("User not found for username: %s", username)
        raise HTTPException(status_code=400, detail="Invalid username")

    user = users[0]
    if not verify_password(password, user["hashed_password"]):
        raise HTTPException(status_code=400, detail="Invalid password")

    expires = 24 * 7 if remember_me else 1
    access_token = create_access_token(
        data={"sub": user["user_id"]}, expires_delta=expires
    )
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me", response_model=UserOut)
def get_me(current_user_id: str = Depends(get_current_user)):
    user = _get_user_or_404(current_user_id)
    return UserOut(
        user_id=user["user_id"], username=user["username"], email=user["email"]
    )


@router.patch("/me", response_model=UserOut)
def update_me(
    updates: UserUpdate, current_user_id: str = Depends(get_current_user)
):
    user = _get_user_or_404(current_user_id)

    new_username = updates.username or user["username"]
    new_email = updates.email or user["email"]

    if _conflict_exists(
        updates.username, updates.email, exclude_user_id=current_user_id
    ):
        raise HTTPException(status_code=400, detail="Username or email already in use")

    user["username"] = new_username
    user["email"] = new_email
    table.put_item(Item=user)
    return UserOut(user_id=current_user_id, username=new_username, email=new_email)


@router.post("/me/change-password")
def change_password(
    payload: PasswordChange, current_user_id: str = Depends(get_current_user)
):
    user = _get_user_or_404(current_user_id)
    if not verify_password(payload.current_password, user["hashed_password"]):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    user["hashed_password"] = hash_password(payload.new_password)
    table.put_item(Item=user)
    return {"message": "Password updated"}


@router.delete("/me")
def delete_me(current_user_id: str = Depends(get_current_user)):
    _get_user_or_404(current_user_id)

    owned = recipe_table.scan(
        FilterExpression=Attr("owner_id").eq(current_user_id),
        ProjectionExpression="recipe_id",
    ).get("Items", [])
    for recipe in owned:
        recipe_table.delete_item(Key={"recipe_id": recipe["recipe_id"]})

    meal_plan_table.delete_item(Key={"user_id": current_user_id})
    table.delete_item(Key={"user_id": current_user_id})
    return {"message": "Account deleted", "recipes_deleted": len(owned)}

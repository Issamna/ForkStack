import os

import boto3
from boto3.dynamodb.conditions import Attr
from fastapi import APIRouter, Depends

from dependencies import get_current_user
from utils.db import scan_all

dynamodb = boto3.resource("dynamodb")
recipe_table = dynamodb.Table(os.environ.get("RECIPE_TABLE", "RecipeTable"))
meal_plan_table = dynamodb.Table(os.environ.get("MEAL_PLAN_TABLE", "MealPlanTable"))
shopping_list_table = dynamodb.Table(
    os.environ.get("SHOPPING_LIST_TABLE", "ShoppingListTable")
)

router = APIRouter()


# Account identity, profile, and password are owned by Clerk now. The only
# app-specific user operation left is deleting the data THIS app stores
# (recipes + meal plans + shopping lists) for the signed-in user; the Clerk
# account itself is deleted through Clerk's own UI (or a user.deleted webhook,
# a future addition).
@router.delete("/me")
def delete_my_data(current_user_id: str = Depends(get_current_user)):
    owned = scan_all(
        recipe_table,
        FilterExpression=Attr("owner_id").eq(current_user_id),
        ProjectionExpression="recipe_id",
    )
    for recipe in owned:
        recipe_table.delete_item(Key={"recipe_id": recipe["recipe_id"]})

    meal_plan_table.delete_item(Key={"user_id": current_user_id})
    shopping_list_table.delete_item(Key={"user_id": current_user_id})
    return {"message": "Account data deleted", "recipes_deleted": len(owned)}

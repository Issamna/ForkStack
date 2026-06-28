import os

import boto3
from fastapi import APIRouter, Depends

from dependencies import get_current_user
from models.meal_plan import MealPlanIn, MealPlanOut

dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(os.environ.get("MEAL_PLAN_TABLE", "MealPlanTable"))

router = APIRouter()


@router.get("", response_model=MealPlanOut)
def get_plan(user_id: str = Depends(get_current_user)):
    item = table.get_item(Key={"user_id": user_id}).get("Item")
    return {"entries": item.get("entries", []) if item else []}


@router.put("", response_model=MealPlanOut)
def save_plan(plan: MealPlanIn, user_id: str = Depends(get_current_user)):
    entries = [e.dict() for e in plan.entries]
    table.put_item(Item={"user_id": user_id, "entries": entries})
    return {"entries": entries}

import os

import boto3
from fastapi import APIRouter, Depends, Query

from dependencies import get_current_user
from models.meal_plan import MealPlanIn, MealPlanOut

dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(os.environ.get("MEAL_PLAN_TABLE", "MealPlanTable"))

router = APIRouter()

# One item per user holds every week's plan, keyed by the week's Monday (ISO).
WeekParam = Query(..., pattern=r"^\d{4}-\d{2}-\d{2}$", description="Monday of the week, YYYY-MM-DD")


@router.get("", response_model=MealPlanOut)
def get_plan(week: str = WeekParam, user_id: str = Depends(get_current_user)):
    item = table.get_item(Key={"user_id": user_id}).get("Item") or {}
    weeks = item.get("weeks", {})
    return {"week": week, "entries": weeks.get(week, [])}


@router.put("", response_model=MealPlanOut)
def save_plan(
    plan: MealPlanIn,
    week: str = WeekParam,
    user_id: str = Depends(get_current_user),
):
    item = table.get_item(Key={"user_id": user_id}).get("Item") or {}
    weeks = item.get("weeks", {})
    weeks[week] = [e.dict() for e in plan.entries]
    table.put_item(Item={"user_id": user_id, "weeks": weeks})
    return {"week": week, "entries": weeks[week]}

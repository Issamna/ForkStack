import os

import boto3
from fastapi import APIRouter, Depends, Query

from dependencies import get_current_user
from models.shopping_list import ShoppingListIn, ShoppingListOut
from utils.quantity import (
    format_quantity,
    normalize_name,
    parse_quantity,
    parse_servings,
)

dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(os.environ.get("SHOPPING_LIST_TABLE", "ShoppingListTable"))
meal_plan_table = dynamodb.Table(os.environ.get("MEAL_PLAN_TABLE", "MealPlanTable"))
recipe_table = dynamodb.Table(os.environ.get("RECIPE_TABLE", "RecipeTable"))

router = APIRouter()

WeekParam = Query(..., pattern=r"^\d{4}-\d{2}-\d{2}$")


def _week_items(user_id: str, week: str) -> list:
    item = table.get_item(Key={"user_id": user_id}).get("Item") or {}
    return (item.get("weeks") or {}).get(week, {}).get("items", [])


def _save_week(user_id: str, week: str, items: list) -> None:
    item = table.get_item(Key={"user_id": user_id}).get("Item") or {}
    weeks = item.get("weeks") or {}
    weeks[week] = {"items": items}
    table.put_item(Item={"user_id": user_id, "weeks": weeks})


def _generate_items(user_id: str, week: str, prev_items: list) -> list:
    plan = meal_plan_table.get_item(Key={"user_id": user_id}).get("Item") or {}
    entries = (plan.get("weeks") or {}).get(week, [])

    # Remember what was already checked off (match on name + unit).
    checked = {
        (normalize_name(i.get("name", "")), normalize_name(i.get("unit", "")))
        for i in prev_items
        if i.get("checked")
    }

    agg: dict = {}
    for entry in entries:
        if not entry.get("recipe_id") or entry.get("eat_out"):
            continue
        recipe = recipe_table.get_item(
            Key={"recipe_id": entry["recipe_id"]}
        ).get("Item")
        if not recipe:
            continue

        base = parse_servings(recipe.get("servings"))
        want = parse_servings(entry.get("servings")) or base
        scale = (want / base) if (base and want and base > 0) else 1.0
        title = recipe.get("title", "Recipe")

        for ing in recipe.get("ingredients", []):
            name = (ing.get("name") or "").strip()
            if not name:
                continue
            unit = (ing.get("measurement_type") or "").strip()
            key = (normalize_name(name), normalize_name(unit))
            slot = agg.setdefault(
                key,
                {"name": name, "unit": unit, "total": 0.0, "num": False, "sources": []},
            )
            qty = parse_quantity(ing.get("quantity"))
            if qty is not None:
                slot["total"] += qty * scale
                slot["num"] = True
            if title not in slot["sources"]:
                slot["sources"].append(title)

    items = [
        {
            "name": v["name"],
            "unit": v["unit"],
            "quantity": format_quantity(v["total"]) if v["num"] else "",
            "sources": v["sources"],
            "checked": key in checked,
        }
        for key, v in agg.items()
    ]
    items.sort(key=lambda i: i["name"].lower())
    return items


@router.post("/generate", response_model=ShoppingListOut)
def generate(week: str = WeekParam, user_id: str = Depends(get_current_user)):
    items = _generate_items(user_id, week, _week_items(user_id, week))
    _save_week(user_id, week, items)
    return {"week": week, "items": items}


@router.get("", response_model=ShoppingListOut)
def get_list(week: str = WeekParam, user_id: str = Depends(get_current_user)):
    return {"week": week, "items": _week_items(user_id, week)}


@router.put("", response_model=ShoppingListOut)
def save_list(
    payload: ShoppingListIn,
    week: str = WeekParam,
    user_id: str = Depends(get_current_user),
):
    items = [i.dict() for i in payload.items]
    _save_week(user_id, week, items)
    return {"week": week, "items": items}

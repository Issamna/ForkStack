import boto3
import os
import uuid

from fastapi import APIRouter, HTTPException, Depends
from typing import List

from dependencies import get_current_user
from models.ingredient import Ingredient

dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(os.environ.get("INGREDIENT_TABLE", "IngredientTable"))

router = APIRouter()


def _require_ingredient(ingredient_id: str) -> dict:
    """Return the ingredient or raise 404. Shared by read/update/delete."""
    item = table.get_item(Key={"ingredient_id": ingredient_id}).get("Item")
    if not item:
        raise HTTPException(status_code=404, detail="Ingredient not found")
    return item


@router.get("", response_model=List[Ingredient])
def list_all_ingredients(current_user_id: str = Depends(get_current_user)):
    response = table.scan()
    items = response.get("Items", [])
    return sorted(items, key=lambda x: x["name"].lower())


@router.get("/{ingredient_id}", response_model=Ingredient)
def get_ingredient(
    ingredient_id: str, current_user_id: str = Depends(get_current_user)
):
    return _require_ingredient(ingredient_id)


@router.post("", response_model=Ingredient)
def create_ingredient(
    ingredient: Ingredient, current_user_id: str = Depends(get_current_user)
):
    normalized_name = ingredient.name.strip().lower()

    # Check for duplicates
    response = table.scan()
    for item in response.get("Items", []):
        if item["name"].strip().lower() == normalized_name:
            raise HTTPException(status_code=400, detail="Ingredient already exists")

    ingredient.ingredient_id = str(uuid.uuid4())
    table.put_item(Item=ingredient.dict())
    return ingredient


@router.put("/{ingredient_id}", response_model=Ingredient)
def update_ingredient(
    ingredient_id: str,
    updated: Ingredient,
    current_user_id: str = Depends(get_current_user),
):
    _require_ingredient(ingredient_id)
    updated.ingredient_id = ingredient_id
    table.put_item(Item=updated.dict())
    return updated


@router.delete("/{ingredient_id}")
def delete_ingredient(
    ingredient_id: str, current_user_id: str = Depends(get_current_user)
):
    _require_ingredient(ingredient_id)
    table.delete_item(Key={"ingredient_id": ingredient_id})
    return {"message": "Ingredient deleted"}

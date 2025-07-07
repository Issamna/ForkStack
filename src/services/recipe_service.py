import boto3
import os
import uuid

from boto3.dynamodb.conditions import Key
from fastapi import APIRouter, HTTPException
from typing import List

from models.recipe import RecipeIn, RecipeOut

dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(os.environ.get("RECIPE_TABLE", "RecipesTable"))

router = APIRouter()

@router.post("", response_model=RecipeOut)
def create(recipe: RecipeIn):
    recipe_id = str(uuid.uuid4())
    item = {
        "recipe_id": recipe_id,
        "title": recipe.title,
        "ingredients": [i.dict() for i in recipe.ingredients],
        "instructions": recipe.instructions,
    }
    table.put_item(Item=item)
    return item

@router.get("", response_model=List[RecipeOut])
def list_all():
    return table.scan().get("Items", [])

@router.get("/search", response_model=List[RecipeOut])
def search(title: str):
    items = table.scan().get("Items", [])
    return [item for item in items if title.lower() in item["title"].lower()]

@router.get("/{recipe_id}", response_model=RecipeOut)
def get(recipe_id: str):
    response = table.get_item(Key={"recipe_id": recipe_id})
    item = response.get("Item")
    if not item:
        raise HTTPException(status_code=404, detail="Recipe not found")
    return item

@router.put("/{recipe_id}", response_model=RecipeOut)
def update(recipe_id: str, recipe: RecipeIn):
    response = table.get_item(Key={"recipe_id": recipe_id})
    if "Item" not in response:
        raise HTTPException(status_code=404, detail="Recipe not found")

    updated = {
        "recipe_id": recipe_id,
        "title": recipe.title,
        "ingredients": [i.dict() for i in recipe.ingredients],
        "instructions": recipe.instructions,
    }
    table.put_item(Item=updated)
    return updated

@router.delete("/{recipe_id}")
def delete(recipe_id: str):
    response = table.get_item(Key={"recipe_id": recipe_id})
    if "Item" not in response:
        raise HTTPException(status_code=404, detail="Recipe not found")

    table.delete_item(Key={"recipe_id": recipe_id})
    return {"message": "Recipe deleted"}

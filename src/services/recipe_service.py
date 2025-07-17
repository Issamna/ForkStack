import boto3
import os
import uuid

from boto3.dynamodb.conditions import Key
from fastapi import APIRouter, HTTPException, Depends
from typing import List

from dependencies import get_current_user
from models.recipe import RecipeIn, RecipeOut, URLIn
from utils.parser import recipe_scraper


dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(os.environ.get("RECIPE_TABLE", "RecipesTable"))

router = APIRouter()


@router.post("", response_model=RecipeOut)
def create(recipe: RecipeIn, current_user_id: str = Depends(get_current_user)):
    recipe_id = str(uuid.uuid4())
    item = {
        "recipe_id": recipe_id,
        "title": recipe.title,
        "ingredients": [i.dict() for i in recipe.ingredients],
        "instructions": [s.dict() for s in recipe.instructions],
        "is_shareable": recipe.is_shareable,
        "owner_id": current_user_id,
        "import_source_url": recipe.import_source_url,
        "recipe_tags": recipe.recipe_tags,
    }
    table.put_item(Item=item)
    return item


@router.get("", response_model=List[RecipeOut])
def list_all(current_user_id: str = Depends(get_current_user)):
    all_items = table.scan().get("Items", [])
    return [
        item
        for item in all_items
        if item.get("is_shareable") is True or item.get("owner_id") == current_user_id
    ]


@router.get("/search", response_model=List[RecipeOut])
def search(title: str, current_user_id: str = Depends(get_current_user)):
    all_items = table.scan().get("Items", [])
    return [
        item
        for item in all_items
        if title.lower() in item["title"].lower()
        and (
            item.get("is_shareable") is True or item.get("owner_id") == current_user_id
        )
    ]


@router.get("/{recipe_id}", response_model=RecipeOut)
def get(recipe_id: str, user_id: str = Depends(get_current_user)):
    response = table.get_item(Key={"recipe_id": recipe_id})
    item = response.get("Item")
    if not item:
        raise HTTPException(status_code=404, detail="Recipe not found")
    if item["owner_id"] != user_id and not item.get("is_shareable", False):
        raise HTTPException(status_code=403, detail="Access denied")
    return item


@router.put("/{recipe_id}", response_model=RecipeOut)
def update(
    recipe_id: str, recipe: RecipeIn, current_user_id: str = Depends(get_current_user)
):
    response = table.get_item(Key={"recipe_id": recipe_id})
    item = response.get("Item")
    if not item:
        raise HTTPException(status_code=404, detail="Recipe not found")
    if item.get("owner_id") != current_user_id:
        raise HTTPException(
            status_code=403, detail="Not authorized to update this recipe"
        )

    updated = {
        "recipe_id": recipe_id,
        "title": recipe.title,
        "ingredients": [i.dict() for i in recipe.ingredients],
        "instructions": [s.dict() for s in recipe.instructions],
        "is_shareable": recipe.is_shareable,
        "owner_id": current_user_id,
        "recipe_tags": recipe.recipe_tags,
    }
    table.put_item(Item=updated)
    return updated


@router.delete("/{recipe_id}")
def delete(recipe_id: str, current_user_id: str = Depends(get_current_user)):
    response = table.get_item(Key={"recipe_id": recipe_id})
    item = response.get("Item")
    if not item:
        raise HTTPException(status_code=404, detail="Recipe not found")
    if item.get("owner_id") != current_user_id:
        raise HTTPException(
            status_code=403, detail="Not authorized to delete this recipe"
        )

    table.delete_item(Key={"recipe_id": recipe_id})
    return {"message": "Recipe deleted"}


@router.post("/parse-url")
def parse_recipe_url(data: URLIn):
    try:
        return recipe_scraper(data.url)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse recipe: {str(e)}")

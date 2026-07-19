import boto3
import os
import uuid

from fastapi import APIRouter, HTTPException, Depends
from typing import List

from dependencies import get_current_user
from models.recipe import RecipeTag
from utils.db import scan_all

dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(os.environ.get("RECIPE_TAG_TABLE", "RecipeTagTable"))


router = APIRouter()


@router.get("", response_model=List[RecipeTag])
def list_all_tags(current_user_id: str = Depends(get_current_user)):
    items = scan_all(table)
    return sorted(items, key=lambda x: x["name"].lower())


@router.get("/{tag_id}", response_model=RecipeTag)
def get_tag(tag_id: str, current_user_id: str = Depends(get_current_user)):
    response = table.get_item(Key={"id": tag_id})
    item = response.get("Item")
    if not item:
        raise HTTPException(status_code=404, detail="Tag not found")
    return item


@router.post("", response_model=RecipeTag)
def create_tag(tag: RecipeTag, current_user_id: str = Depends(get_current_user)):
    normalized_name = tag.name.strip().lower()
    for item in scan_all(table):
        if item["name"].strip().lower() == normalized_name:
            raise HTTPException(status_code=400, detail="Tag already exists")

    tag.id = str(uuid.uuid4())
    table.put_item(Item=tag.dict())
    return tag

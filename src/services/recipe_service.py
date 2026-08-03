import base64
import boto3
import os
import re
import uuid

from boto3.dynamodb.conditions import Key
from fastapi import APIRouter, HTTPException, Depends
from typing import List

from dependencies import get_current_user
from models.recipe import PhotoUploadIn, PhotoUploadOut, RecipeIn, RecipeOut, URLIn
from utils import photos
from utils.db import scan_all
from utils.parser import recipe_scraper
from utils.pdf import build_recipe_pdf


dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(os.environ.get("RECIPE_TABLE", "RecipesTable"))

router = APIRouter()


def _with_photo(item: dict) -> dict:
    """Attach a short-lived view URL for the stored photo key."""
    return {**item, "image_url": photos.view_url(item.get("image_key"))}


def _accepted_key(recipe: RecipeIn, owner_id: str) -> str | None:
    """Take the submitted photo key only if it belongs to this user.

    `image_key` arrives from the client, so an unchecked value would let anyone
    attach (and then read, via the presigned URL) another user's object.
    """
    key = recipe.image_key
    if key and not photos.owns_key(owner_id, key):
        raise HTTPException(status_code=400, detail="Invalid image reference")
    return key


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
        "servings": recipe.servings,
        "total_time": recipe.total_time,
        "image_key": _accepted_key(recipe, current_user_id),
    }
    table.put_item(Item=item)
    return _with_photo(item)


@router.post("/photo-upload", response_model=PhotoUploadOut)
def photo_upload(
    payload: PhotoUploadIn, current_user_id: str = Depends(get_current_user)
):
    """Presigned POST so the browser can upload a photo directly to S3."""
    if payload.content_type not in photos.EXTENSIONS:
        raise HTTPException(status_code=400, detail="Unsupported image type")
    return photos.presigned_upload(current_user_id, payload.content_type)


@router.get("", response_model=List[RecipeOut])
def list_all(current_user_id: str = Depends(get_current_user)):
    all_items = scan_all(table)
    return [
        _with_photo(item)
        for item in all_items
        if item.get("is_shareable") is True or item.get("owner_id") == current_user_id
    ]


@router.get("/search", response_model=List[RecipeOut])
def search(title: str, current_user_id: str = Depends(get_current_user)):
    all_items = scan_all(table)
    return [
        _with_photo(item)
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
    return _with_photo(item)


@router.get("/{recipe_id}/pdf")
def get_pdf(recipe_id: str, user_id: str = Depends(get_current_user)):
    response = table.get_item(Key={"recipe_id": recipe_id})
    item = response.get("Item")
    if not item:
        raise HTTPException(status_code=404, detail="Recipe not found")
    if item.get("owner_id") != user_id and not item.get("is_shareable", False):
        raise HTTPException(status_code=403, detail="Access denied")

    pdf_bytes = build_recipe_pdf(item)
    slug = re.sub(r"[^a-z0-9]+", "-", (item.get("title") or "recipe").lower()).strip("-")
    return {
        "filename": f"{slug or 'recipe'}.pdf",
        "content_base64": base64.b64encode(pdf_bytes).decode("ascii"),
    }


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

    new_key = _accepted_key(recipe, current_user_id)
    updated = {
        "recipe_id": recipe_id,
        "title": recipe.title,
        "ingredients": [i.dict() for i in recipe.ingredients],
        "instructions": [s.dict() for s in recipe.instructions],
        "is_shareable": recipe.is_shareable,
        "owner_id": current_user_id,
        "import_source_url": recipe.import_source_url,
        "recipe_tags": recipe.recipe_tags,
        "servings": recipe.servings,
        "total_time": recipe.total_time,
        "image_key": new_key,
    }
    table.put_item(Item=updated)
    # Swapping or clearing the photo orphans the old object, which nothing else
    # would ever collect.
    old_key = item.get("image_key")
    if old_key and old_key != new_key:
        photos.delete(old_key)
    return _with_photo(updated)


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
    photos.delete(item.get("image_key"))
    return {"message": "Recipe deleted"}


@router.post("/parse-url")
def parse_recipe_url(data: URLIn, current_user_id: str = Depends(get_current_user)):
    try:
        return recipe_scraper(data.url)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse recipe: {str(e)}")

import re
from pydantic import BaseModel, field_validator
from typing import List, Optional


class Ingredient(BaseModel):
    name: str
    quantity: str
    measurement_type: Optional[str] = ""


class InstructionStep(BaseModel):
    step_number: int
    text: str
    # Indices into the recipe's ingredient list that this step uses. None means
    # the cook never curated it, and readers fall back to matching the step text
    # -- an empty list means "deliberately none", which is a different thing.
    ingredients: Optional[List[int]] = None


class RecipeIn(BaseModel):
    title: str
    ingredients: List[Ingredient]
    instructions: List[InstructionStep]
    is_shareable: bool = False
    owner_id: Optional[str] = None
    import_source_url: Optional[str] = None
    recipe_tags: Optional[list[str]] = []
    servings: Optional[int] = None
    # Total time in minutes. Optional: hand-entered recipes often omit it and
    # not every imported page publishes one, so every surface must tolerate None.
    total_time: Optional[int] = None
    # S3 object key for a user-uploaded photo; None falls back to the
    # tag-based placeholder the frontend picks.
    image_key: Optional[str] = None

    @field_validator("import_source_url")
    def validate_url(cls, v):
        if v and not re.match(r"^https?://", v):
            raise ValueError("URL must start with http:// or https://")
        return v


class RecipeOut(RecipeIn):
    recipe_id: str
    # Presigned GET minted per response -- short-lived, so never persisted.
    image_url: Optional[str] = None


class PhotoUploadIn(BaseModel):
    content_type: str


class PhotoUploadOut(BaseModel):
    image_key: str
    url: str
    fields: dict


class URLIn(BaseModel):
    url: str


class RecipeTag(BaseModel):
    id: Optional[str] = None
    name: str

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


class RecipeIn(BaseModel):
    title: str
    ingredients: List[Ingredient]
    instructions: List[InstructionStep]
    is_shareable: bool = False
    owner_id: Optional[str] = None
    import_source_url: Optional[str] = None
    recipe_tags: Optional[list[str]] = []

    @field_validator("import_source_url")
    def validate_url(cls, v):
        if v and not re.match(r"^https?://", v):
            raise ValueError("URL must start with http:// or https://")
        return v


class RecipeOut(RecipeIn):
    recipe_id: str


class URLIn(BaseModel):
    url: str


class RecipeTag(BaseModel):
    id: Optional[str] = None
    name: str

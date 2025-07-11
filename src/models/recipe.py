from pydantic import BaseModel
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

class RecipeOut(RecipeIn):
    recipe_id: str
    owner_id: str

class URLIn(BaseModel):
    url: str

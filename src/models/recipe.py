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

class RecipeOut(RecipeIn):
    recipe_id: str

from pydantic import BaseModel
from typing import List

class Ingredient(BaseModel):
    name: str
    quantity: str

class RecipeIn(BaseModel):
    title: str
    ingredients: List[Ingredient]
    instructions: str

class RecipeOut(RecipeIn):
    recipe_id: str

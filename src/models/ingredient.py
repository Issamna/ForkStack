from pydantic import BaseModel
from typing import List, Optional


class UnitOption(BaseModel):
    unit: str
    grams_equivalent: float
    is_default: Optional[bool] = False

class Ingredient(BaseModel):
    ingredient_id: str
    name: str
    plural_name: Optional[str] = None
    calories_per_gram: Optional[float] = None
    unit_options: Optional[List[UnitOption]] = []
    data_type: Optional[str] = ""

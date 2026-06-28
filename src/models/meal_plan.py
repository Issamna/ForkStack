from typing import List, Optional

from pydantic import BaseModel


class MealEntry(BaseModel):
    id: str
    # A planned thing is either a saved recipe or a free-text quick item.
    recipe_id: Optional[str] = None
    title: str
    tags: Optional[List[str]] = []
    # All scheduling is optional -- loose planning is the default.
    day: Optional[str] = None  # mon..sun, or None = "anytime this week"
    meal: Optional[str] = None  # breakfast | lunch | dinner | snack
    who: Optional[str] = None
    eat_out: bool = False


class MealPlanIn(BaseModel):
    entries: List[MealEntry] = []


class MealPlanOut(BaseModel):
    week: str  # ISO date of the week's Monday, e.g. "2026-06-22"
    entries: List[MealEntry] = []

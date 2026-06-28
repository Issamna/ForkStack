from typing import List

from pydantic import BaseModel


class ShoppingItem(BaseModel):
    name: str
    unit: str = ""
    quantity: str = ""  # display string, e.g. "5" or "1.5" ("" when not summable)
    sources: List[str] = []  # recipe titles that need this ingredient
    checked: bool = False


class ShoppingListIn(BaseModel):
    items: List[ShoppingItem] = []


class ShoppingListOut(BaseModel):
    week: str
    items: List[ShoppingItem] = []

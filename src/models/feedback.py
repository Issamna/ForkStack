from typing import Literal

from pydantic import BaseModel, Field


class FeedbackIn(BaseModel):
    type: Literal["bug", "feature"] = "bug"
    title: str = Field(max_length=200)
    # Capped so a runaway paste can't be turned into a giant issue body.
    description: str = Field(default="", max_length=5000)


class FeedbackOut(BaseModel):
    number: int
    url: str

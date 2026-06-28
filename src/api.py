import logging
import os
import sys

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum

from services import (
    recipe_service,
    user_service,
    tag_service,
    ingredient_service,
    meal_plan_service,
    shopping_list_service,
)

logger = logging.getLogger()
logger.setLevel(logging.INFO)

if not logger.handlers:
    handler = logging.StreamHandler(sys.stdout)
    formatter = logging.Formatter("%(asctime)s - %(levelname)s - %(message)s")
    handler.setFormatter(formatter)
    logger.addHandler(handler)

app = FastAPI(debug=True)
app.include_router(recipe_service.router, prefix="/recipes", tags=["recipes"])
app.include_router(user_service.router, prefix="/users", tags=["users"])
app.include_router(tag_service.router, prefix="/tags", tags=["tags"])
app.include_router(ingredient_service.router, prefix="/ingredients", tags=["ingredients"])
app.include_router(meal_plan_service.router, prefix="/meal-plan", tags=["meal-plan"])
app.include_router(
    shopping_list_service.router, prefix="/shopping-list", tags=["shopping-list"]
)


@app.get("/openapi.json")
def get_openapi():
    return app.openapi()


# Comma-separated list of allowed origins; defaults to the Angular dev server.
allowed_origins = [
    origin.strip()
    for origin in os.environ.get("ALLOWED_ORIGINS", "http://localhost:4200").split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    # Auth uses bearer tokens in the Authorization header, not cookies, so
    # credentialed requests are unnecessary (and incompatible with "*").
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

handler = Mangum(app)

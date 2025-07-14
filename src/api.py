import logging
import sys

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum

from services import recipe_service, user_service

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


@app.get("/openapi.json")
def get_openapi():
    return app.openapi()


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # or ["http://localhost:3000"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

handler = Mangum(app)

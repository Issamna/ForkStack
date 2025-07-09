from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum

from services.recipe_service import router

app = FastAPI()
app.include_router(router, prefix="/recipes")

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

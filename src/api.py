# forkstack/src/api.py
from fastapi import FastAPI
from mangum import Mangum

app = FastAPI()

@app.get("/")
def read_root():
    return {"message": "Welcome to Forkstack 🍴📚"}

handler = Mangum(app)

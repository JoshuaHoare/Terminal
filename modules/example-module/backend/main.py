from fastapi import FastAPI

app = FastAPI()


@app.get("/module/metadata")
async def metadata():
    return {
        "id": "example-module",
        "name": "Example Module",
        "description": "An example FastAPI module",
        "version": "0.1.0",
    }


@app.get("/health")
async def health():
    return {"status": "ok"}

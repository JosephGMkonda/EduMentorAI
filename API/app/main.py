from fastapi import FastAPI
from app.api.routes import math_route as math_routes
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="EduMentorAI API")

app.include_router(math_routes.router, prefix="/api/math", tags=["math"])
app.include_router(math_routes.router, prefix="/api", tags=["general"])

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health_check():
    return {"status": "ok"}
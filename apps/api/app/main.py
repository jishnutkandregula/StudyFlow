from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.planner import PlanningRequest, PlanningResponse, generate_plan

app = FastAPI(
    title="StudyFlow API",
    description="Explainable planning and recovery suggestions for academic work.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["system"])
def health() -> dict[str, str]:
    return {"service": "studyflow-api", "status": "ok", "version": "0.1.0"}


@app.post("/api/v1/plans/generate", response_model=PlanningResponse, tags=["planning"])
def create_plan(request: PlanningRequest) -> PlanningResponse:
    return generate_plan(request)

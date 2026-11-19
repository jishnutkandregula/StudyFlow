from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import timedelta

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app import storage
from app.canvas_routes import router as canvas_router
from app.estimates_routes import router as estimates_router
from app.planner import PlanningRequest, PlanningResponse, generate_plan
from app.settings import get_settings
from app.workspace import router as workspace_router

logger = logging.getLogger(__name__)
SESSION_MAX_IDLE = timedelta(days=180)


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    problems = get_settings().production_problems()
    if problems:
        # Refuse to serve students with an unsafe configuration.
        raise RuntimeError("Unsafe production configuration:\n- " + "\n- ".join(problems))
    try:
        removed = storage.purge_idle_sessions(SESSION_MAX_IDLE)
        if removed:
            logger.info("Purged %d idle sessions", removed)
    except Exception:
        logger.exception("Idle-session purge failed; continuing")
    yield


app = FastAPI(
    title="StudyFlow API",
    description="Explainable planning and recovery suggestions for academic work.",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type", "X-StudyFlow-Request"],
)

app.include_router(canvas_router)
app.include_router(workspace_router)
app.include_router(estimates_router)


@app.get("/health", tags=["system"])
def health() -> dict[str, str]:
    """Liveness: the process is up."""
    return {"service": "studyflow-api", "status": "ok", "version": "0.1.0"}


@app.get("/health/ready", tags=["system"], response_model=None)
def ready() -> dict[str, str] | JSONResponse:
    """Readiness: the database answers. Used by the host's health checks and uptime monitors."""
    try:
        storage.ping()
    except Exception:
        logger.exception("Readiness check failed")
        return JSONResponse(status_code=503, content={"status": "unavailable"})
    return {"status": "ready"}


@app.post("/api/v1/plans/generate", response_model=PlanningResponse, tags=["planning"])
def create_plan(request: PlanningRequest) -> PlanningResponse:
    return generate_plan(request)

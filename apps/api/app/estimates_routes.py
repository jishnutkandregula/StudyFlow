"""POST /api/v1/estimates: explainable time estimates, calibrated to this student.

Calibration history lives in the student's saved workspace (``estimate_history``),
so it follows the same privacy rules: it's tied to the session and deleted with it.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field, ValidationError

from app import storage
from app.estimator import Estimate, EstimateRequestItem, EstimateSample, estimate
from app.ratelimit import rate_limit
from app.session import require_session

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/estimates", tags=["estimates"])


class EstimateRequest(BaseModel):
    items: list[EstimateRequestItem] = Field(max_length=300)


class EstimateResponse(BaseModel):
    estimates: list[Estimate]
    calibrated_from: int = Field(description="Finished tasks the calibration learned from.")


def _history(record: storage.SessionRecord) -> list[EstimateSample]:
    raw = (record.workspace or {}).get("estimate_history") or []
    samples = []
    for item in raw:
        try:
            samples.append(EstimateSample.model_validate(item))
        except ValidationError:
            continue
    return samples


@router.post(
    "",
    response_model=EstimateResponse,
    summary="Estimate focus time for assignments",
    description=(
        "Reads each assignment's title and description, classifies the work, extracts the "
        "amount asked for (words, pages, problems, chapters, time limits), and calibrates the "
        "result to this student's finished work. Each estimate includes a plain-language reason."
    ),
)
def create_estimates(
    request: EstimateRequest,
    record: storage.SessionRecord = Depends(require_session),
    _: None = Depends(rate_limit("estimates", limit=60, window_seconds=60)),
) -> EstimateResponse:
    history = _history(record)
    return EstimateResponse(
        estimates=[estimate(item, history) for item in request.items],
        calibrated_from=len(history),
    )

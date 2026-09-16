from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.calculator.scoring import ScenarioInput, compute_impact_scores

router = APIRouter(prefix="/api", tags=["impact-score"])


class ScenarioScoreInput(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    annual_kwh: float = Field(default=0, ge=0, le=1_000_000_000)
    annual_usd: float = Field(default=0, ge=0, le=1_000_000_000)
    co2_tons: float = Field(default=0, ge=0, le=10_000_000)
    people: float = Field(default=0, ge=0, le=1_000_000_000)
    cost_usd: float = Field(default=0, ge=0, le=1_000_000_000)
    timeline_months: float = Field(default=12, ge=0, le=120)
    confidence: float = Field(default=0.5, ge=0, le=1)
    evidence_quality: float = Field(default=0.5, ge=0, le=1)
    evidence_source: str = Field(default="default", max_length=255)


class ImpactScoreRequest(BaseModel):
    scenarios: list[ScenarioScoreInput] = Field(min_length=1, max_length=20)
    weights: dict[str, float] | None = None


@router.post("/impact-score")
def score_impacts(data: ImpactScoreRequest):
    try:
        return compute_impact_scores(
            scenarios=[ScenarioInput(**s.model_dump()) for s in data.scenarios],
            weights=data.weights,
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

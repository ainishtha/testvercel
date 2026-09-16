import datetime
from pydantic import BaseModel, Field


class ProblemCreate(BaseModel):
    title: str = Field(..., max_length=255)
    description: str
    domain: str = "campus_sustainability"


class ProblemResponse(BaseModel):
    id: int
    title: str
    description: str
    domain: str
    created_at: datetime.datetime

    class Config:
        from_attributes = True


class AnalysisCreate(BaseModel):
    problem_id: int


class AnalysisResponse(BaseModel):
    id: int
    problem_id: int
    status: str
    current_state: str | None = None
    summary: str | None = None
    created_at: datetime.datetime
    completed_at: datetime.datetime | None = None

    class Config:
        from_attributes = True


class RootCauseResponse(BaseModel):
    id: int
    analysis_id: int
    description: str
    confidence: float
    evidence: list

    class Config:
        from_attributes = True


class SolutionResponse(BaseModel):
    id: int
    analysis_id: int
    name: str
    description: str
    solution_type: str
    estimated_cost: float | None = None
    estimated_timeline_months: int | None = None
    confidence: float
    difficulty: str = "medium"
    expected_effect: str | None = None
    assumptions: list = []
    risks: list = []

    class Config:
        from_attributes = True


class ImpactEstimateResponse(BaseModel):
    id: int
    solution_id: int
    category: str
    label: str
    value: float
    unit: str
    is_estimate: int
    assumptions: list
    low_bound: float | None = None
    high_bound: float | None = None

    class Config:
        from_attributes = True


class ComparisonResponse(BaseModel):
    id: int
    analysis_id: int
    rankings: list
    recommendation: str | None = None
    rationale: str | None = None

    class Config:
        from_attributes = True


class EvidenceResponse(BaseModel):
    id: int
    solution_id: int
    source: str
    claim: str
    confidence: float
    is_verified: int
    url: str | None = None
    published_date: str | None = None
    summary: str | None = None
    quality: str = "unassessed"
    quality_score: float = 0.0
    gaps: list = []
    is_demo: int = 0

    class Config:
        from_attributes = True


class ActionPlanResponse(BaseModel):
    id: int
    analysis_id: int
    solution_id: int
    steps: list
    timeline_months: int | None = None
    resources: list
    risks: list
    phases: list = []
    success_metrics: list = []
    risk_register: list = []

    class Config:
        from_attributes = True


class ActionPlanUpdate(BaseModel):
    timeline_months: int | None = None
    resources: list | None = None
    phases: list | None = None
    success_metrics: list | None = None
    risk_register: list | None = None


class ActionPlanGenerate(BaseModel):
    analysis_id: int
    solution_id: int


class MonitoringCreate(BaseModel):
    action_plan_id: int
    metric_name: str
    predicted_value: float
    actual_value: float | None = None
    unit: str
    notes: str | None = None


class MonitoringUpdate(BaseModel):
    actual_value: float | None = None
    notes: str | None = None


class MonitoringResponse(BaseModel):
    id: int
    action_plan_id: int
    metric_name: str
    predicted_value: float
    actual_value: float | None = None
    unit: str
    recorded_at: datetime.datetime
    notes: str | None = None

    class Config:
        from_attributes = True


class ImpactReportResponse(BaseModel):
    problem: ProblemResponse
    analysis: AnalysisResponse
    root_causes: list[RootCauseResponse]
    solutions: list[SolutionResponse]
    impact_estimates: dict[int, list[ImpactEstimateResponse]]
    comparison: ComparisonResponse | None = None
    evidence: dict[int, list[EvidenceResponse]]
    action_plan: ActionPlanResponse | None = None
    monitoring: list[MonitoringResponse]

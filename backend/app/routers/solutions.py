from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import (
    SolutionResponse, ImpactEstimateResponse, ComparisonResponse,
    EvidenceResponse, ActionPlanResponse, ActionPlanUpdate, ActionPlanGenerate,
    ImpactReportResponse,
    MonitoringCreate, MonitoringResponse,
    ProblemResponse, AnalysisResponse,
)
from app.db import (
    Solution, ImpactEstimate, Comparison, Evidence, ActionPlan,
    MonitoringEntry, Analysis, Problem,
)
from app.agents.action import normalize_plan

router = APIRouter(prefix="/api", tags=["solutions"])


@router.get("/solutions/{analysis_id}", response_model=list[SolutionResponse])
def get_solutions(analysis_id: int, db: Session = Depends(get_db)):
    return db.query(Solution).filter(Solution.analysis_id == analysis_id).all()


@router.get("/solutions/{solution_id}/estimates", response_model=list[ImpactEstimateResponse])
def get_solution_estimates(solution_id: int, db: Session = Depends(get_db)):
    return db.query(ImpactEstimate).filter(ImpactEstimate.solution_id == solution_id).all()


@router.get("/solutions/{solution_id}/evidence", response_model=list[EvidenceResponse])
def get_solution_evidence(solution_id: int, db: Session = Depends(get_db)):
    return db.query(Evidence).filter(Evidence.solution_id == solution_id).all()


@router.get("/comparisons/{analysis_id}")
def get_comparison(analysis_id: int, db: Session = Depends(get_db)):
    comp = db.query(Comparison).filter(Comparison.analysis_id == analysis_id).first()
    if not comp:
        return None
    return comp


@router.get("/action-plans/{analysis_id}")
def get_action_plan(analysis_id: int, db: Session = Depends(get_db)):
    plan = db.query(ActionPlan).filter(ActionPlan.analysis_id == analysis_id).first()
    if not plan:
        return None
    return plan


@router.get("/action-plans/by-solution/{solution_id}", response_model=ActionPlanResponse | None)
def get_action_plan_by_solution(solution_id: int, db: Session = Depends(get_db)):
    return db.query(ActionPlan).filter(ActionPlan.solution_id == solution_id).first()


@router.post("/action-plans/generate", response_model=ActionPlanResponse)
async def generate_action_plan(data: ActionPlanGenerate, db: Session = Depends(get_db)):
    from app.agents.action import ActionAgent

    solution = db.query(Solution).filter(Solution.id == data.solution_id).first()
    if not solution or solution.analysis_id != data.analysis_id:
        raise HTTPException(status_code=404, detail="Solution not found in this analysis")

    agent = ActionAgent()
    result = await agent.run({"selected_solution": {
        "id": solution.id, "name": solution.name,
        "description": solution.description,
        "estimated_cost": solution.estimated_cost,
        "estimated_timeline_months": solution.estimated_timeline_months,
    }, "estimates": []})
    if not result.success:
        raise HTTPException(status_code=502, detail=result.error or "Plan generation failed")
    plan = normalize_plan(result.data)

    existing = db.query(ActionPlan).filter(ActionPlan.solution_id == solution.id).first()
    if existing:
        existing.steps = plan["steps"]
        existing.timeline_months = plan["timeline_months"]
        existing.resources = plan["resources"]
        existing.risks = plan["risks"]
        existing.phases = plan["phases"]
        existing.success_metrics = plan["success_metrics"]
        existing.risk_register = plan["risk_register"]
        db.commit()
        db.refresh(existing)
        return existing

    created = ActionPlan(
        analysis_id=solution.analysis_id, solution_id=solution.id,
        steps=plan["steps"], timeline_months=plan["timeline_months"],
        resources=plan["resources"], risks=plan["risks"],
        phases=plan["phases"], success_metrics=plan["success_metrics"],
        risk_register=plan["risk_register"],
    )
    db.add(created)
    db.commit()
    db.refresh(created)
    return created


@router.put("/action-plans/{plan_id}", response_model=ActionPlanResponse)
def update_action_plan(plan_id: int, data: ActionPlanUpdate, db: Session = Depends(get_db)):
    plan = db.query(ActionPlan).filter(ActionPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Action plan not found")
    patch = data.model_dump(exclude_unset=True)
    if "phases" in patch:
        _validate_phases(patch["phases"])
        plan.phases = patch["phases"]
        # Keep the legacy flat view in sync with edited phases.
        plan.steps = [
            {"order": n + 1, "title": t.get("title", ""),
             "description": t.get("description", ""),
             "duration_weeks": t.get("duration_weeks", 0) or 0}
            for n, t in enumerate([t for p in patch["phases"] for t in p.get("tasks", [])])
        ]
    if "risk_register" in patch:
        plan.risk_register = patch["risk_register"]
        plan.risks = [
            r.get("risk", r) if isinstance(r, dict) else r
            for r in patch["risk_register"]
        ]
    if patch.get("timeline_months") is not None:
        plan.timeline_months = patch["timeline_months"]
    if patch.get("resources") is not None:
        plan.resources = patch["resources"]
    if patch.get("success_metrics") is not None:
        plan.success_metrics = patch["success_metrics"]
    db.commit()
    db.refresh(plan)
    return plan


def _validate_phases(phases) -> None:
    if not isinstance(phases, list):
        raise HTTPException(status_code=422, detail="phases must be a list")
    for p in phases:
        if not isinstance(p, dict) or not p.get("name"):
            raise HTTPException(status_code=422, detail="Each phase needs a name")
        tasks = p.get("tasks", [])
        if not isinstance(tasks, list):
            raise HTTPException(status_code=422, detail="Phase tasks must be a list")
        for t in tasks:
            if not isinstance(t, dict) or not t.get("title"):
                raise HTTPException(status_code=422, detail="Each task needs a title")

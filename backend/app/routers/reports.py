from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import (
    ImpactReportResponse, ProblemResponse, AnalysisResponse,
    RootCauseResponse, SolutionResponse, ImpactEstimateResponse,
    ComparisonResponse, EvidenceResponse, ActionPlanResponse,
    MonitoringResponse,
)
from app.db import (
    Problem, Analysis, RootCause, Solution, ImpactEstimate,
    Comparison, Evidence, ActionPlan, MonitoringEntry,
)

router = APIRouter(prefix="/api", tags=["reports"])


@router.get("/reports/{analysis_id}")
def get_impact_report(analysis_id: int, db: Session = Depends(get_db)):
    analysis = db.query(Analysis).filter(Analysis.id == analysis_id).first()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")

    problem = db.query(Problem).filter(Problem.id == analysis.problem_id).first()
    root_causes = db.query(RootCause).filter(RootCause.analysis_id == analysis_id).all()
    solutions = db.query(Solution).filter(Solution.analysis_id == analysis_id).all()
    comparison = db.query(Comparison).filter(Comparison.analysis_id == analysis_id).first()
    action_plan = db.query(ActionPlan).filter(ActionPlan.analysis_id == analysis_id).first()

    impact_estimates = {}
    all_evidence = {}
    for sol in solutions:
        estimates = db.query(ImpactEstimate).filter(ImpactEstimate.solution_id == sol.id).all()
        impact_estimates[sol.id] = [
            {k: v for k, v in e.__dict__.items() if not k.startswith("_")} for e in estimates
        ]
        ev = db.query(Evidence).filter(Evidence.solution_id == sol.id).all()
        all_evidence[sol.id] = [
            {k: v for k, v in e.__dict__.items() if not k.startswith("_")} for e in ev
        ]

    monitoring = []
    if action_plan:
        monitoring = db.query(MonitoringEntry).filter(
            MonitoringEntry.action_plan_id == action_plan.id
        ).all()

    return {
        "problem": {k: v for k, v in problem.__dict__.items() if not k.startswith("_")} if problem else None,
        "analysis": {k: v for k, v in analysis.__dict__.items() if not k.startswith("_")},
        "root_causes": [
            {k: v for k, v in rc.__dict__.items() if not k.startswith("_")} for rc in root_causes
        ],
        "solutions": [
            {k: v for k, v in s.__dict__.items() if not k.startswith("_")} for s in solutions
        ],
        "impact_estimates": impact_estimates,
        "comparison": {k: v for k, v in comparison.__dict__.items() if not k.startswith("_")} if comparison else None,
        "evidence": all_evidence,
        "action_plan": {k: v for k, v in action_plan.__dict__.items() if not k.startswith("_")} if action_plan else None,
        "monitoring": [
            {k: v for k, v in m.__dict__.items() if not k.startswith("_")} for m in monitoring
        ],
    }

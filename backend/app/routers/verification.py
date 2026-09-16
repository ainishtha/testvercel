from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.db import Analysis, Comparison, Evidence, ImpactEstimate, Solution
from app.verification import run_verification

router = APIRouter(prefix="/api", tags=["verification"])


@router.get("/verification/{analysis_id}")
def get_verification(analysis_id: int, db: Session = Depends(get_db)):
    analysis = db.query(Analysis).filter(Analysis.id == analysis_id).first()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")

    solutions = db.query(Solution).filter(Solution.analysis_id == analysis_id).all()
    comparison = db.query(Comparison).filter(Comparison.analysis_id == analysis_id).first()

    estimates, evidence = [], []
    for sol in solutions:
        for e in db.query(ImpactEstimate).filter(ImpactEstimate.solution_id == sol.id).all():
            estimates.append({
                "id": e.id, "solution_id": sol.id, "label": e.label,
                "value": e.value, "unit": e.unit,
                "low_bound": e.low_bound, "high_bound": e.high_bound,
                "assumptions": e.assumptions or [],
            })
        for v in db.query(Evidence).filter(Evidence.solution_id == sol.id).all():
            evidence.append({
                "id": v.id, "solution_id": sol.id, "source": v.source,
                "claim": v.claim, "url": v.url,
                "published_date": v.published_date,
                "is_demo": bool(v.is_demo),
            })

    return {
        "analysis_id": analysis_id,
        **run_verification({
            "solutions": [
                {"id": s.id, "name": s.name, "assumptions": s.assumptions or []}
                for s in solutions
            ],
            "estimates": estimates,
            "evidence": evidence,
            "comparison": (
                {
                    "rankings": comparison.rankings or [],
                    "recommendation": comparison.recommendation or "",
                    "rationale": comparison.rationale or "",
                }
                if comparison else None
            ),
        }),
    }

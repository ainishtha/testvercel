from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import AnalysisCreate, AnalysisResponse
from app.db import Analysis, AnalysisStatus
from app.orchestrator import AgentOrchestrator

router = APIRouter(prefix="/api", tags=["analyses"])


async def _run_analysis_bg(analysis_id: int):
    from app.database import SessionLocal
    db = SessionLocal()
    try:
        orchestrator = AgentOrchestrator(db)
        await orchestrator.run_full_analysis(analysis_id)
    finally:
        db.close()


@router.post("/analyses", response_model=AnalysisResponse)
async def create_analysis(data: AnalysisCreate, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    from app.db import Problem
    problem = db.query(Problem).filter(Problem.id == data.problem_id).first()
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found")

    analysis = Analysis(problem_id=data.problem_id, status=AnalysisStatus.PENDING)
    db.add(analysis)
    db.commit()
    db.refresh(analysis)

    background_tasks.add_task(_run_analysis_bg, analysis.id)

    return analysis


@router.get("/analyses/{analysis_id}", response_model=AnalysisResponse)
def get_analysis(analysis_id: int, db: Session = Depends(get_db)):
    analysis = db.query(Analysis).filter(Analysis.id == analysis_id).first()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")
    return analysis


@router.get("/analyses", response_model=list[AnalysisResponse])
def list_analyses(skip: int = 0, limit: int = 50, db: Session = Depends(get_db)):
    return db.query(Analysis).order_by(Analysis.created_at.desc()).offset(skip).limit(limit).all()

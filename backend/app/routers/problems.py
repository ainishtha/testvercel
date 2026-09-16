from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import ProblemCreate, ProblemResponse, AnalysisCreate, AnalysisResponse
from app.db import Problem, Analysis

router = APIRouter(prefix="/api", tags=["problems"])


@router.post("/problems", response_model=ProblemResponse)
def create_problem(data: ProblemCreate, db: Session = Depends(get_db)):
    problem = Problem(
        title=data.title,
        description=data.description,
        domain=data.domain,
    )
    db.add(problem)
    db.commit()
    db.refresh(problem)
    return problem


@router.get("/problems", response_model=list[ProblemResponse])
def list_problems(skip: int = 0, limit: int = 50, db: Session = Depends(get_db)):
    return db.query(Problem).order_by(Problem.created_at.desc()).offset(skip).limit(limit).all()


@router.get("/problems/{problem_id}", response_model=ProblemResponse)
def get_problem(problem_id: int, db: Session = Depends(get_db)):
    problem = db.query(Problem).filter(Problem.id == problem_id).first()
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found")
    return problem

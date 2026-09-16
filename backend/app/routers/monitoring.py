from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import MonitoringCreate, MonitoringResponse, MonitoringUpdate
from app.db import MonitoringEntry, ActionPlan

router = APIRouter(prefix="/api", tags=["monitoring"])


@router.post("/monitoring", response_model=MonitoringResponse)
def create_monitoring_entry(data: MonitoringCreate, db: Session = Depends(get_db)):
    plan = db.query(ActionPlan).filter(ActionPlan.id == data.action_plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Action plan not found")

    entry = MonitoringEntry(
        action_plan_id=data.action_plan_id,
        metric_name=data.metric_name,
        predicted_value=data.predicted_value,
        actual_value=data.actual_value,
        unit=data.unit,
        notes=data.notes,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.get("/monitoring/{analysis_id}", response_model=list[MonitoringResponse])
def get_monitoring_entries(analysis_id: int, db: Session = Depends(get_db)):
    plan = db.query(ActionPlan).filter(ActionPlan.analysis_id == analysis_id).first()
    if not plan:
        return []
    return db.query(MonitoringEntry).filter(MonitoringEntry.action_plan_id == plan.id).all()


@router.put("/monitoring/{entry_id}", response_model=MonitoringResponse)
def record_actual_measurement(entry_id: int, data: MonitoringUpdate, db: Session = Depends(get_db)):
    """Record (or correct) the real measured value for a tracked metric.

    Predicted values are simulated estimates and are never modified here —
    only the measured actual and notes change.
    """
    entry = db.query(MonitoringEntry).filter(MonitoringEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Monitoring entry not found")
    patch = data.model_dump(exclude_unset=True)
    if "actual_value" in patch:
        entry.actual_value = patch["actual_value"]
    if "notes" in patch:
        entry.notes = patch["notes"]
    db.commit()
    db.refresh(entry)
    return entry

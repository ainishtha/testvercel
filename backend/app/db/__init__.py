import datetime
import enum
from sqlalchemy import (
    Column, Integer, String, Text, Float, DateTime, ForeignKey,
    JSON, Enum as SAEnum
)
from sqlalchemy.orm import relationship
from app.database import Base


class AnalysisStatus(str, enum.Enum):
    PENDING = "pending"
    DISCOVERING = "discovering"
    RESEARCHING = "researching"
    GENERATING_SOLUTIONS = "generating_solutions"
    SIMULATING = "simulating"
    COMPARING = "comparing"
    VERIFYING = "verifying"
    PLANNING = "planning"
    REPORTING = "reporting"
    COMPLETED = "completed"
    FAILED = "failed"


class Problem(Base):
    __tablename__ = "problems"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    domain = Column(String(100), default="campus_sustainability")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    analyses = relationship("Analysis", back_populates="problem")


class Analysis(Base):
    __tablename__ = "analyses"

    id = Column(Integer, primary_key=True, index=True)
    problem_id = Column(Integer, ForeignKey("problems.id"), nullable=False)
    status = Column(SAEnum(AnalysisStatus), default=AnalysisStatus.PENDING)
    current_state = Column(Text, nullable=True)
    summary = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    problem = relationship("Problem", back_populates="analyses")
    root_causes = relationship("RootCause", back_populates="analysis")
    solutions = relationship("Solution", back_populates="analysis")
    comparisons = relationship("Comparison", back_populates="analysis")
    action_plans = relationship("ActionPlan", back_populates="analysis")


class RootCause(Base):
    __tablename__ = "root_causes"

    id = Column(Integer, primary_key=True, index=True)
    analysis_id = Column(Integer, ForeignKey("analyses.id"), nullable=False)
    description = Column(Text, nullable=False)
    confidence = Column(Float, default=0.0)
    evidence = Column(JSON, default=list)

    analysis = relationship("Analysis", back_populates="root_causes")


class Solution(Base):
    __tablename__ = "solutions"

    id = Column(Integer, primary_key=True, index=True)
    analysis_id = Column(Integer, ForeignKey("analyses.id"), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    solution_type = Column(String(100), nullable=False)
    estimated_cost = Column(Float, nullable=True)
    estimated_timeline_months = Column(Integer, nullable=True)
    confidence = Column(Float, default=0.0)
    # Extended comparison fields (nullable/backfilled for backward compatibility).
    difficulty = Column(String(20), default="medium")
    expected_effect = Column(Text, nullable=True)
    assumptions = Column(JSON, default=list)
    risks = Column(JSON, default=list)

    analysis = relationship("Analysis", back_populates="solutions")
    impact_estimates = relationship("ImpactEstimate", back_populates="solution")
    evidences = relationship("Evidence", back_populates="solution")
    action_plan = relationship("ActionPlan", back_populates="solution", uselist=False)


class ImpactEstimate(Base):
    __tablename__ = "impact_estimates"

    id = Column(Integer, primary_key=True, index=True)
    solution_id = Column(Integer, ForeignKey("solutions.id"), nullable=False)
    category = Column(String(100), nullable=False)
    label = Column(String(255), nullable=False)
    value = Column(Float, nullable=False)
    unit = Column(String(50), nullable=False)
    is_estimate = Column(Integer, default=1)
    assumptions = Column(JSON, default=list)
    low_bound = Column(Float, nullable=True)
    high_bound = Column(Float, nullable=True)

    solution = relationship("Solution", back_populates="impact_estimates")


class Comparison(Base):
    __tablename__ = "comparisons"

    id = Column(Integer, primary_key=True, index=True)
    analysis_id = Column(Integer, ForeignKey("analyses.id"), nullable=False)
    rankings = Column(JSON, nullable=False)
    recommendation = Column(Text, nullable=True)
    rationale = Column(Text, nullable=True)

    analysis = relationship("Analysis", back_populates="comparisons")


class Evidence(Base):
    __tablename__ = "evidence"

    id = Column(Integer, primary_key=True, index=True)
    solution_id = Column(Integer, ForeignKey("solutions.id"), nullable=False)
    source = Column(String(500), nullable=False)
    claim = Column(Text, nullable=False)
    confidence = Column(Float, default=0.0)
    is_verified = Column(Integer, default=0)
    # Extended evidence fields (nullable for backward compatibility).
    url = Column(String(1000), nullable=True)
    published_date = Column(String(50), nullable=True)
    summary = Column(Text, nullable=True)
    quality = Column(String(20), default="unassessed")
    quality_score = Column(Float, default=0.0)
    gaps = Column(JSON, default=list)
    is_demo = Column(Integer, default=0)

    solution = relationship("Solution", back_populates="evidences")


class ActionPlan(Base):
    __tablename__ = "action_plans"

    id = Column(Integer, primary_key=True, index=True)
    analysis_id = Column(Integer, ForeignKey("analyses.id"), nullable=False)
    solution_id = Column(Integer, ForeignKey("solutions.id"), nullable=False)
    steps = Column(JSON, nullable=False)
    timeline_months = Column(Integer, nullable=True)
    resources = Column(JSON, default=list)
    risks = Column(JSON, default=list)
    # Structured plan (phases with tasks/roles/dependencies; steps/risks
    # above are auto-derived legacy views kept for backward compatibility).
    phases = Column(JSON, default=list)
    success_metrics = Column(JSON, default=list)
    risk_register = Column(JSON, default=list)

    analysis = relationship("Analysis", back_populates="action_plans")
    solution = relationship("Solution", back_populates="action_plan")
    monitoring_entries = relationship("MonitoringEntry", back_populates="action_plan")


class MonitoringEntry(Base):
    __tablename__ = "monitoring_entries"

    id = Column(Integer, primary_key=True, index=True)
    action_plan_id = Column(Integer, ForeignKey("action_plans.id"), nullable=False)
    metric_name = Column(String(255), nullable=False)
    predicted_value = Column(Float, nullable=False)
    actual_value = Column(Float, nullable=True)
    unit = Column(String(50), nullable=False)
    recorded_at = Column(DateTime, default=datetime.datetime.utcnow)
    notes = Column(Text, nullable=True)

    action_plan = relationship("ActionPlan", back_populates="monitoring_entries")

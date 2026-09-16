from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.db import Analysis, Problem, Solution, ImpactEstimate, Evidence, RootCause, ActionPlan, MonitoringEntry
from app.calculator import simulate_portfolio
from app.calculator.ripple import build_ripple_graph
from app.routers.simulator import SimulateRequest

router = APIRouter(prefix="/api", tags=["ripple"])


class RippleGraphRequest(SimulateRequest):
    scenario_key: str = "hvac"


@router.post("/ripple-graph")
def get_ripple_graph(data: RippleGraphRequest):
    sim = simulate_portfolio(
        baseline_kwh=data.baseline_kwh,
        budget=data.budget,
        implementation_pct=data.implementation_pct,
        reduction_factor=data.reduction_factor,
        electricity_rate=data.electricity_rate,
        project_years=data.project_years,
        emission_factor=data.emission_factor,
    )
    match = [s for s in sim["scenarios"] if s["key"] == data.scenario_key]
    if not match:
        raise HTTPException(
            status_code=422,
            detail=f"Unknown scenario_key '{data.scenario_key}'. "
                   f"Valid: {', '.join(s['key'] for s in sim['scenarios'])}.",
        )
    graph = build_ripple_graph(match[0], {
        "baseline_kwh": data.baseline_kwh,
        "electricity_rate": data.electricity_rate,
        "project_years": data.project_years,
        "emission_factor": data.emission_factor,
        "implementation_pct": data.implementation_pct,
        "reduction_factor": data.reduction_factor,
    })
    return {
        **graph,
        "inputs": {
            "baseline_kwh": {"value": data.baseline_kwh, "unit": "kWh/year"},
            "electricity_rate": {"value": data.electricity_rate, "unit": "USD/kWh"},
            "project_years": {"value": data.project_years, "unit": "years"},
        },
        "scenarios": [{"key": s["key"], "name": s["name"]} for s in sim["scenarios"]],
    }


@router.get("/ripple/{analysis_id}")
def get_ripple_impact(analysis_id: int, db: Session = Depends(get_db)):
    analysis = db.query(Analysis).filter(Analysis.id == analysis_id).first()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")

    problem = db.query(Problem).filter(Problem.id == analysis.problem_id).first()
    solutions = db.query(Solution).filter(Solution.analysis_id == analysis_id).all()
    root_causes = db.query(RootCause).filter(RootCause.analysis_id == analysis_id).all()
    action_plans = db.query(ActionPlan).filter(ActionPlan.analysis_id == analysis_id).all()

    ripple_categories = [
        {
            "category": "Direct Energy",
            "description": "Immediate reduction in electricity consumption from implemented interventions",
            "estimated_impact": "60-80% of total savings",
            "timeframe": "Immediate - 6 months",
            "confidence": 0.90,
            "dependencies": [],
        },
        {
            "category": "Financial",
            "description": "Reduced operational costs and improved budget allocation for academic programs",
            "estimated_impact": "Cost savings redirected to academic initiatives",
            "timeframe": "6 months - 2 years",
            "confidence": 0.85,
            "dependencies": ["Direct Energy"],
        },
        {
            "category": "Environmental",
            "description": "Reduced carbon footprint and improved campus sustainability metrics",
            "estimated_impact": "Measurable CO2 reduction and improved ESG ratings",
            "timeframe": "1 - 5 years",
            "confidence": 0.80,
            "dependencies": ["Direct Energy"],
        },
        {
            "category": "Educational",
            "description": "Real-world sustainability data for curriculum integration and student research",
            "estimated_impact": "Enhanced STEM programs and sustainability education",
            "timeframe": "1 - 3 years",
            "confidence": 0.75,
            "dependencies": ["Direct Energy", "Environmental"],
        },
        {
            "category": "Community",
            "description": "Improved campus reputation and community engagement in sustainability",
            "estimated_impact": "Attract environmentally-conscious students and donors",
            "timeframe": "2 - 5 years",
            "confidence": 0.70,
            "dependencies": ["Environmental", "Educational"],
        },
        {
            "category": "Operational Resilience",
            "description": "Reduced dependency on grid electricity and improved energy security",
            "estimated_impact": "Greater resilience during power outages and rate fluctuations",
            "timeframe": "2 - 10 years",
            "confidence": 0.65,
            "dependencies": ["Direct Energy", "Financial"],
        },
    ]

    total_estimated_savings = 0.0
    for sol in solutions:
        est = db.query(ImpactEstimate).filter(ImpactEstimate.solution_id == sol.id).all()
        for e in est:
            if e.category == "financial":
                total_estimated_savings += e.value

    return {
        "analysis_id": analysis_id,
        "problem_title": problem.title if problem else "Unknown",
        "root_causes": [
            {"description": rc.description, "confidence": rc.confidence}
            for rc in root_causes
        ],
        "ripple_categories": ripple_categories,
        "financial_projection": {
            "total_investment": sum(sol.estimated_cost or 0 for sol in solutions),
            "annual_savings": total_estimated_savings,
            "5_year_net_value": total_estimated_savings * 5 - sum(sol.estimated_cost or 0 for sol in solutions),
            "payback_period_months": None,
        },
        "key_assumptions": [
            "Energy savings are estimated based on baseline consumption of 2M kWh/year",
            "Electricity rate assumed at $0.12/kWh",
            "Savings are not strictly additive (overlap between interventions possible)",
            "Environmental impact based on EPA eGRID national average emission factor",
            "Educational and community impacts are qualitative estimates",
        ],
    }

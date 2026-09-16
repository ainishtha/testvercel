from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from app.database import get_db
from app.db import Solution, ImpactEstimate, Analysis, Problem
from app.calculator import (
    CalculationResult,
    calculate_energy_savings,
    calculate_cost_savings,
    calculate_co2_reduction,
    calculate_payback,
    calculate_roi,
    score_solution,
    simulate_portfolio,
    sensitivity_table,
)

router = APIRouter(prefix="/api", tags=["simulator"])


@router.get("/simulator/{analysis_id}")
def get_simulation_data(analysis_id: int, db: Session = Depends(get_db)):
    analysis = db.query(Analysis).filter(Analysis.id == analysis_id).first()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")

    problem = db.query(Problem).filter(Problem.id == analysis.problem_id).first()
    solutions = db.query(Solution).filter(Solution.analysis_id == analysis_id).all()

    baseline_kwh = 2_000_000
    electricity_rate = 0.12
    emission_factor = 0.4

    results = []
    for sol in solutions:
        energy = calculate_energy_savings(baseline_kwh)
        cost = calculate_cost_savings(energy["total_savings_kwh"].value, electricity_rate)
        co2 = calculate_co2_reduction(energy["total_savings_kwh"].value, emission_factor)
        payback = calculate_payback(sol.estimated_cost or 0, cost.value)
        roi = calculate_roi(sol.estimated_cost or 0, cost.value)
        scores = score_solution(
            cost=sol.estimated_cost or 0,
            annual_savings=cost.value,
            co2_reduction_tons=co2.value,
            timeline_months=sol.estimated_timeline_months or 6,
            confidence=sol.confidence,
        )

        results.append({
            "solution_id": sol.id,
            "solution_name": sol.name,
            "description": sol.description,
            "solution_type": sol.solution_type,
            "estimated_cost": sol.estimated_cost,
            "estimated_timeline_months": sol.estimated_timeline_months,
            "confidence": sol.confidence,
            "energy_savings": {
                "value": energy["total_savings_kwh"].value,
                "unit": energy["total_savings_kwh"].unit,
                "low_bound": energy["total_savings_kwh"].low_bound,
                "high_bound": energy["total_savings_kwh"].high_bound,
                "assumptions": energy["total_savings_kwh"].assumptions,
            },
            "led_savings": {
                "value": energy["led_savings_kwh"].value,
                "unit": energy["led_savings_kwh"].unit,
            },
            "hvac_savings": {
                "value": energy["hvac_savings_kwh"].value,
                "unit": energy["hvac_savings_kwh"].unit,
            },
            "scheduling_savings": {
                "value": energy["scheduling_savings_kwh"].value,
                "unit": energy["scheduling_savings_kwh"].unit,
            },
            "cost_savings": {
                "value": cost.value,
                "unit": cost.unit,
                "low_bound": cost.low_bound,
                "high_bound": cost.high_bound,
                "assumptions": cost.assumptions,
            },
            "co2_reduction": {
                "value": co2.value,
                "unit": co2.unit,
                "low_bound": co2.low_bound,
                "high_bound": co2.high_bound,
                "assumptions": co2.assumptions,
            },
            "payback": {
                "value": payback.value,
                "unit": payback.unit,
                "low_bound": payback.low_bound,
                "high_bound": payback.high_bound,
                "assumptions": payback.assumptions,
            },
            "roi": {
                "value": roi.value,
                "unit": roi.unit,
                "assumptions": roi.assumptions,
            },
            "scores": scores,
        })

    return {
        "analysis_id": analysis_id,
        "baseline_kwh": baseline_kwh,
        "electricity_rate": electricity_rate,
        "emission_factor": emission_factor,
        "problem_title": problem.title if problem else "Unknown",
        "results": results,
    }


class SimulateRequest(BaseModel):
    baseline_kwh: float = Field(default=2_000_000, gt=0, le=1_000_000_000)
    budget: float = Field(default=1_280_000, ge=0, le=1_000_000_000)
    implementation_pct: float = Field(default=100, ge=0, le=100)
    reduction_factor: float = Field(default=1.0, ge=0, le=2.0)
    electricity_rate: float = Field(default=0.12, gt=0, le=5.0)
    project_years: int = Field(default=10, ge=1, le=50)
    emission_factor: float = Field(default=0.4, gt=0, le=2.0)


def _num(value):
    if isinstance(value, float) and (value != value or value in (float("inf"), float("-inf"))):
        return None
    return value


def _ser(result: CalculationResult) -> dict:
    return {
        "value": _num(result.value),
        "unit": result.unit,
        "assumptions": result.assumptions,
        "low_bound": _num(result.low_bound),
        "high_bound": _num(result.high_bound),
        "is_estimate": result.is_estimate,
    }


@router.post("/simulate")
def run_simulation(data: SimulateRequest):
    sim = simulate_portfolio(
        baseline_kwh=data.baseline_kwh,
        budget=data.budget,
        implementation_pct=data.implementation_pct,
        reduction_factor=data.reduction_factor,
        electricity_rate=data.electricity_rate,
        project_years=data.project_years,
        emission_factor=data.emission_factor,
    )
    sens = sensitivity_table(
        baseline_kwh=data.baseline_kwh,
        budget=data.budget,
        implementation_pct=data.implementation_pct,
        reduction_factor=data.reduction_factor,
        electricity_rate=data.electricity_rate,
        project_years=data.project_years,
        emission_factor=data.emission_factor,
    )
    totals = sim["totals"]
    totals["payback"] = _ser(totals["payback"])

    return {
        "is_estimate": True,
        "inputs": {
            "baseline_kwh": {"value": data.baseline_kwh, "unit": "kWh/year"},
            "budget": {"value": data.budget, "unit": "USD"},
            "implementation_pct": {"value": data.implementation_pct, "unit": "%"},
            "reduction_factor": {"value": data.reduction_factor, "unit": "multiplier"},
            "electricity_rate": {"value": data.electricity_rate, "unit": "USD/kWh"},
            "project_years": {"value": data.project_years, "unit": "years"},
            "emission_factor": {"value": data.emission_factor, "unit": "kg CO2/kWh"},
        },
        "units": {
            "energy": "kWh/year",
            "money": "USD",
            "co2": "metric tons CO2/year",
            "payback": "years",
        },
        "scenarios": [
            {
                "key": s["key"],
                "name": s["name"],
                "investment_cost": {
                    "value": s["investment_cost"]["value"], "unit": "USD",
                    "assumptions": s["investment_cost"]["assumptions"],
                },
                "energy_savings": _ser(s["energy_savings"]),
                "financial_savings_annual": _ser(s["financial_savings_annual"]),
                "financial_savings_lifetime": _ser(s["financial_savings_lifetime"]),
                "co2_reduction": _ser(s["co2_reduction"]),
                "payback": _ser(s["payback"]),
            }
            for s in sim["scenarios"]
        ],
        "totals": {
            "investment_cost": {"value": totals["investment_cost"], "unit": "USD"},
            "energy_savings": {"value": totals["energy_savings_kwh"], "unit": "kWh/year"},
            "financial_savings_annual": {"value": totals["annual_savings_usd"], "unit": "USD/year"},
            "financial_savings_lifetime": {"value": totals["lifetime_savings_usd"], "unit": "USD"},
            "co2_reduction": {"value": totals["co2_tons_per_year"], "unit": "metric tons CO2/year"},
            "payback": totals["payback"],
            "within_budget": totals["within_budget"],
            "budget_gap": {"value": totals["budget_gap"], "unit": "USD"},
        },
        "total_investment": totals["investment_cost"],
        "total_annual_savings": totals["annual_savings_usd"],
        "sensitivity": sens,
        "assumptions": [
            "All outputs are planning estimates, not measured results or quotes.",
            "Savings scale linearly with implementation %; partial rollout scales capex equally.",
            "Scenario savings summed for totals — overlap between interventions is possible, so totals may overstate.",
            "Flat electricity price over the project life (no escalation); no discounting applied.",
            "CO2 uses a national-average grid factor; your local grid may differ.",
        ],
    }

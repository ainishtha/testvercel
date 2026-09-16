"""Deterministic demo scenario seeder (no external APIs, no LLM calls).

Seeds the predefined campus-electricity workflow end to end:
Problem -> Discovery -> Research -> Solutions -> Simulation -> Decision ->
Verification inputs -> Action Plan -> Impact Report inputs.

Everything written is synthetic and labeled as such:
- problem title carries the ``[DEMO]`` prefix,
- every estimate assumption list ends with the ``DEMO_TAG``,
- every evidence row has ``is_demo=1`` and a ``DEMO``-prefixed source.

Seeding is idempotent: repeated calls return the existing demo analysis.
"""

from __future__ import annotations

import datetime
import math

from sqlalchemy.orm import Session

from app.calculator import simulate_portfolio
from app.db import (
    ActionPlan, Analysis, AnalysisStatus, Comparison, Evidence,
    ImpactEstimate, MonitoringEntry, Problem, RootCause, Solution,
)

DEMO_PROBLEM_TITLE = "[DEMO] Campus electricity consumption is too high"
DEMO_TAG = "DEMO: synthetic scenario data — not measured, not verified."

DEMO_INPUTS = dict(
    baseline_kwh=2_000_000,
    budget=1_280_000,
    implementation_pct=100,
    reduction_factor=1.0,
    electricity_rate=0.12,
    project_years=10,
    emission_factor=0.4,
)

DEMO_SOLUTIONS = [
    {
        "key": "led",
        "name": "LED Lighting Retrofit",
        "description": "Replace all incandescent and fluorescent lighting with LED fixtures across campus buildings",
        "solution_type": "technology_upgrade",
        "estimated_cost": 250000,
        "estimated_timeline_months": 6,
        "confidence": 0.9,
        "difficulty": "low",
        "expected_effect": "Estimated 60% reduction in lighting electricity load (estimate, verify with audit)",
        "assumptions": [
            "Lighting is an estimated 15% of campus load — confirm with sub-metering",
            "Cost estimate assumes standard commercial fixtures at bulk pricing, not a vendor quote",
        ],
        "risks": ["Actual lighting share of load may differ from the estimate", "Supply-chain delays for fixtures"],
        "score": {"cost_score": 85, "impact_score": 90, "feasibility_score": 95, "timeline_score": 90, "overall_score": 88},
    },
    {
        "key": "hvac",
        "name": "HVAC Smart Controls",
        "description": "Install occupancy sensors and programmable thermostats with AI-driven scheduling",
        "solution_type": "technology_upgrade",
        "estimated_cost": 180000,
        "estimated_timeline_months": 8,
        "confidence": 0.85,
        "difficulty": "medium",
        "expected_effect": "Estimated 12% reduction in HVAC electricity load (estimate, verify with BMS trends)",
        "assumptions": [
            "HVAC is an estimated 50% of campus load — confirm with BMS trend logs",
            "Cost estimate assumes retrofit of existing controls, not full replacement",
        ],
        "risks": ["Legacy BMS may need upgrades not included in the estimate", "Savings depend on enforcement of schedules"],
        "score": {"cost_score": 78, "impact_score": 85, "feasibility_score": 80, "timeline_score": 75, "overall_score": 82},
    },
    {
        "key": "scheduling",
        "name": "Smart Building Scheduling",
        "description": "Implement centralized scheduling system to optimize building usage hours and reduce idle consumption",
        "solution_type": "operational",
        "estimated_cost": 50000,
        "estimated_timeline_months": 3,
        "confidence": 0.75,
        "difficulty": "low",
        "expected_effect": "Estimated 8% reduction in non-HVAC, non-lighting loads (estimate, verify with meter data)",
        "assumptions": [
            "Miscellaneous loads are an estimated 35% of campus load",
            "Departments assumed cooperative with consolidated hours",
        ],
        "risks": ["Departmental resistance to schedule changes"],
        "score": {"cost_score": 95, "impact_score": 60, "feasibility_score": 85, "timeline_score": 95, "overall_score": 75},
    },
    {
        "key": "solar",
        "name": "Solar Panel Installation",
        "description": "Install photovoltaic panels on rooftops and parking structures to offset grid electricity",
        "solution_type": "renewable_energy",
        "estimated_cost": 800000,
        "estimated_timeline_months": 18,
        "confidence": 0.80,
        "difficulty": "high",
        "expected_effect": "Estimated offset of grid electricity subject to site survey (estimate only)",
        "assumptions": [
            "Cost estimate is a planning figure, not a vendor quote — requires site survey",
            "Roof condition, shading, and interconnection capacity not yet assessed",
        ],
        "risks": ["Roof structural or shading constraints may reduce viable capacity", "Highest upfront cost of all options"],
        "score": {"cost_score": 40, "impact_score": 95, "feasibility_score": 55, "timeline_score": 35, "overall_score": 70},
    },
]

DEMO_ROOT_CAUSES = [
    {"description": "Outdated lighting infrastructure using incandescent and fluorescent fixtures",
     "confidence": 0.85, "evidence": ["DEMO: assumed lighting audit finding — not measured"]},
    {"description": "Inefficient HVAC scheduling with no occupancy-based controls",
     "confidence": 0.80, "evidence": ["DEMO: assumed BMS review finding — not measured"]},
    {"description": "Lack of real-time energy monitoring and accountability systems",
     "confidence": 0.70, "evidence": ["DEMO: assumed metering gap — not measured"]},
]

DEMO_EVIDENCE = [
    {"source_title": "DEMO — Lighting retrofit planning illustration",
     "claim": "Lighting retrofits are a commonly audited first step for campus electricity reduction.",
     "summary": "Illustrative planning assumption, not a real citation.",
     "quality": "low", "quality_score": 0.3, "confidence": 0.5,
     "gaps": ["No site-specific lighting audit attached"]},
    {"source_title": "DEMO — HVAC scheduling illustration",
     "claim": "HVAC scheduling and controls are commonly investigated for campus savings.",
     "summary": "Illustrative planning assumption, not a real citation.",
     "quality": "low", "quality_score": 0.3, "confidence": 0.5,
     "gaps": ["No BMS trend logs attached"]},
    {"source_title": "DEMO — Solar potential illustration",
     "claim": "Rooftop solar potential must be confirmed by a site-specific survey.",
     "summary": "Illustrative planning assumption, not a real citation.",
     "quality": "low", "quality_score": 0.3, "confidence": 0.5,
     "gaps": ["No roof survey or shading analysis"]},
]

DEMO_PHASES = [
    {"order": 1, "name": "Audit", "objective": "Measure the baseline and confirm scope.",
     "duration_weeks": 4, "tasks": [
        {"id": "demo-1-1", "title": "Conduct baseline audit",
         "description": "DEMO task: survey buildings and collect meter data",
         "role": "Facilities Manager", "dependencies": [],
         "resources": ["Metering equipment"], "duration_weeks": 2},
        {"id": "demo-1-2", "title": "Confirm scope and success criteria",
         "description": "DEMO task: agree scope and decision gates with the sponsor",
         "role": "Project Sponsor", "dependencies": ["Conduct baseline audit"],
         "resources": ["Audit report"], "duration_weeks": 2},
    ]},
    {"order": 2, "name": "Pilot", "objective": "Prove the approach on a small scale.",
     "duration_weeks": 6, "tasks": [
        {"id": "demo-2-1", "title": "Install pilot and measure",
         "description": "DEMO task: install in one building and compare metered savings",
         "role": "Contractor / Vendor", "dependencies": ["Confirm scope and success criteria"],
         "resources": ["Sub-metering"], "duration_weeks": 6},
    ]},
    {"order": 3, "name": "Deployment", "objective": "Roll out across in-scope buildings.",
     "duration_weeks": 12, "tasks": [
        {"id": "demo-3-1", "title": "Phase rollout by building",
         "description": "DEMO task: deploy starting with highest usage",
         "role": "Facilities Manager", "dependencies": ["Install pilot and measure"],
         "resources": ["Installation crews"], "duration_weeks": 12},
    ]},
    {"order": 4, "name": "Measurement", "objective": "Verify savings and hand over.",
     "duration_weeks": 4, "tasks": [
        {"id": "demo-4-1", "title": "Verify and report savings",
         "description": "DEMO task: compare metered data to the baseline",
         "role": "Project Manager", "dependencies": ["Phase rollout by building"],
         "resources": ["Meter data"], "duration_weeks": 4},
    ]},
]

DEMO_SUCCESS_METRICS = [
    "Metered kWh reduction vs baseline (%) — DEMO target",
    "Actual spend vs estimated budget (%) — DEMO target",
]

DEMO_RISKS = [
    {"risk": "DEMO risk: supply chain delays", "mitigation": "Order long-lead items during Audit"},
    {"risk": "DEMO risk: savings differ from estimates", "mitigation": "Gate deployment on pilot measurement"},
]


def _demo_assumptions(extra: list[str]) -> list[str]:
    return [*extra, DEMO_TAG]


def seed_demo_analysis(db: Session) -> dict:
    """Create (or return) the predefined demo analysis. No external calls."""
    existing = db.query(Problem).filter(Problem.title == DEMO_PROBLEM_TITLE).first()
    if existing:
        latest = (
            db.query(Analysis).filter(Analysis.problem_id == existing.id)
            .order_by(Analysis.id.desc()).first()
        )
        if latest:
            return {"problem_id": existing.id, "analysis_id": latest.id, "created": False}

    now = datetime.datetime.utcnow()
    problem = Problem(
        title=DEMO_PROBLEM_TITLE,
        description=(
            "DEMO scenario: annual campus electricity costs rose 25% over three years. "
            "All data in this analysis is synthetic and for product evaluation only."
        ),
        domain="campus_sustainability",
    )
    db.add(problem)
    db.flush()

    analysis = Analysis(
        problem_id=problem.id, status=AnalysisStatus.COMPLETED,
        current_state="Demo seeding complete",
        summary=(
            "DEMO analysis complete. 4 solutions evaluated. "
            "Recommendation: LED Lighting Retrofit offers the best balance of cost, "
            "impact, and feasibility for immediate implementation. "
            "All figures are synthetic estimates."
        ),
        completed_at=now,
    )
    db.add(analysis)
    db.flush()

    for rc in DEMO_ROOT_CAUSES:
        db.add(RootCause(analysis_id=analysis.id, description=rc["description"],
                         confidence=rc["confidence"], evidence=rc["evidence"]))

    sim = simulate_portfolio(**DEMO_INPUTS)
    sim_by_key = {s["key"]: s for s in sim["scenarios"]}

    saved: list[Solution] = []
    for spec in DEMO_SOLUTIONS:
        sol = Solution(
            analysis_id=analysis.id, name=spec["name"], description=spec["description"],
            solution_type=spec["solution_type"], estimated_cost=spec["estimated_cost"],
            estimated_timeline_months=spec["estimated_timeline_months"],
            confidence=spec["confidence"], difficulty=spec["difficulty"],
            expected_effect=spec["expected_effect"],
            assumptions=_demo_assumptions(spec["assumptions"]), risks=spec["risks"],
        )
        db.add(sol)
        db.flush()
        saved.append(sol)

        s = sim_by_key[spec["key"]]
        rows = [
            ("energy", "Annual kWh Reduction", s["energy_savings"]),
            ("financial", "Annual Cost Savings", s["financial_savings_annual"]),
            ("environmental", "CO2 Reduction", s["co2_reduction"]),
            ("financial", "Simple Payback Period", s["payback"]),
        ]
        for category, label, calc in rows:
            if not math.isfinite(calc.value):
                continue  # never store inf/NaN; defaults keep all rows finite
            db.add(ImpactEstimate(
                solution_id=sol.id, category=category, label=label,
                value=calc.value, unit=calc.unit,
                is_estimate=1, assumptions=_demo_assumptions(list(calc.assumptions)),
                low_bound=calc.low_bound, high_bound=calc.high_bound,
            ))

    for ev in DEMO_EVIDENCE:
        db.add(Evidence(
            solution_id=saved[0].id, source=ev["source_title"], claim=ev["claim"],
            confidence=ev["confidence"], is_verified=0, url=None, published_date=None,
            summary=ev["summary"], quality=ev["quality"],
            quality_score=ev["quality_score"], gaps=ev["gaps"], is_demo=1,
        ))

    db.add(Comparison(
        analysis_id=analysis.id,
        rankings=[
            {"solution_id": s.id, "name": s.name, **next(
                spec["score"] for spec in DEMO_SOLUTIONS if spec["name"] == s.name)}
            for s in saved
        ],
        recommendation=(
            "DEMO recommendation: LED Lighting Retrofit offers the best balance of "
            "cost, impact, and feasibility for immediate implementation."
        ),
        rationale="DEMO rationale: ranked by the deterministic demo scoring of synthetic estimates.",
    ))

    flat_steps, order = [], 1
    for phase in DEMO_PHASES:
        for task in phase["tasks"]:
            flat_steps.append({"order": order, "title": task["title"],
                               "description": task["description"],
                               "duration_weeks": task["duration_weeks"]})
            order += 1
    plan = ActionPlan(
        analysis_id=analysis.id, solution_id=saved[0].id,
        steps=flat_steps, timeline_months=6,
        resources=["DEMO: Facilities team (2 FTE)", "DEMO: Electrical contractor"],
        risks=[r["risk"] for r in DEMO_RISKS],
        phases=DEMO_PHASES, success_metrics=DEMO_SUCCESS_METRICS,
        risk_register=DEMO_RISKS,
    )
    db.add(plan)
    db.flush()

    db.add(MonitoringEntry(action_plan_id=plan.id, metric_name="Monthly kWh (DEMO)",
                           predicted_value=150000, actual_value=None,
                           unit="kWh", notes="DEMO: synthetic prediction — record real measurements here."))
    db.add(MonitoringEntry(action_plan_id=plan.id, metric_name="Monthly cost (DEMO)",
                           predicted_value=18000, actual_value=None,
                           unit="USD", notes="DEMO: synthetic prediction — record real measurements here."))

    db.commit()
    return {"problem_id": problem.id, "analysis_id": analysis.id, "created": True}

import asyncio

import pytest
from fastapi.testclient import TestClient

from app.agents.verification import VerificationAgent
from app.database import SessionLocal, init_db
from app.db import Analysis, Comparison, Evidence, ImpactEstimate, Problem, Solution
from app.main import app
from app.verification import run_verification

client = TestClient(app)


def _good_payload():
    return {
        "solutions": [
            {"id": 1, "name": "LED Lighting Retrofit", "assumptions": ["Audit first"]},
            {"id": 2, "name": "HVAC Smart Controls", "assumptions": ["BMS logs first"]},
        ],
        "estimates": [
            {"id": 1, "solution_id": 1, "label": "Annual kWh Reduction",
             "value": 450000, "unit": "kWh/year",
             "low_bound": 350000, "high_bound": 550000,
             "assumptions": ["Baseline 2M kWh/year"]},
            {"id": 2, "solution_id": 2, "label": "Annual Cost Savings",
             "value": 54000, "unit": "USD/year",
             "low_bound": 42000, "high_bound": 66000,
             "assumptions": ["Rate $0.12/kWh"]},
        ],
        "evidence": [
            {"id": 1, "solution_id": 1, "source": "Campus metering report",
             "claim": "Lighting is 15% of load", "url": "https://example.edu/metering",
             "published_date": "2025-06-01", "is_demo": False},
            {"id": 2, "solution_id": 2, "source": "BMS trend export",
             "claim": "HVAC is 50% of load", "url": "https://example.edu/bms",
             "published_date": "2025-06-01", "is_demo": False},
        ],
        "comparison": {
            "rankings": [
                {"solution_id": 1, "name": "LED Lighting Retrofit", "overall_score": 88},
                {"solution_id": 2, "name": "HVAC Smart Controls", "overall_score": 82},
            ],
            "recommendation": "Proceed with LED Lighting Retrofit first.",
            "rationale": "Best modeled trade-off.",
        },
    }


def _statuses(report):
    return {c["key"]: c["status"] for c in report["checks"]}


def test_clean_analysis_passes_all_checks():
    report = run_verification(_good_payload())
    assert report["overall"] == "pass"
    assert report["overall_label"] == "PASS"
    assert report["counts"] == {"pass": 6, "warning": 0, "fail": 0}
    assert report["all_warnings"] == [] and report["all_missing"] == []
    for c in report["checks"]:
        assert c["checked"] is True


def test_missing_evidence_fails_availability():
    payload = _good_payload()
    payload["evidence"] = []
    report = run_verification(payload)
    assert _statuses(report)["evidence_availability"] == "fail"
    assert report["overall"] == "fail"
    assert report["overall_label"] == "FAIL"


def test_demo_evidence_warns_but_sourced_gap_fails():
    payload = _good_payload()
    payload["evidence"] = [
        {"id": 1, "solution_id": 1, "source": "DEMO illustration",
         "claim": "Demo", "url": None, "published_date": None, "is_demo": True},
        {"id": 2, "solution_id": 2, "source": "Vendor brochure",
         "claim": "Saves lots", "url": None, "published_date": None, "is_demo": False},
    ]
    statuses = _statuses(run_verification(payload))
    assert statuses["source_references"] == "fail"  # sourced claim, no URL
    report = run_verification({**payload, "evidence": [payload["evidence"][0]]})
    assert _statuses(report)["source_references"] == "warning"  # demo only


def test_out_of_bounds_estimate_and_bad_unit_fail():
    payload = _good_payload()
    payload["estimates"][0]["value"] = 999_999_999  # outside [350k, 550k]
    payload["estimates"][1]["unit"] = ""
    report = run_verification(payload)
    assert _statuses(report)["calculation_consistency"] == "fail"
    assert _statuses(report)["units"] == "fail"
    assert report["overall"] == "fail"


def test_missing_assumptions_and_comparison_warn():
    payload = _good_payload()
    payload["estimates"][0]["assumptions"] = []
    payload["solutions"][0]["assumptions"] = []
    payload["comparison"] = None
    report = run_verification(payload)
    assert _statuses(report)["assumptions"] == "warning"
    assert _statuses(report)["recommendation_consistency"] == "warning"
    assert report["overall"] == "warning"
    assert report["overall_label"] == "PASS WITH WARNINGS"
    assert len(report["all_missing"]) > 0


def test_unranked_recommendation_reference_fails():
    payload = _good_payload()
    payload["solutions"].append(
        {"id": 3, "name": "Solar installation", "assumptions": ["Survey first"]}
    )
    payload["comparison"]["recommendation"] = "Proceed with Solar installation immediately."
    report = run_verification(payload)
    assert _statuses(report)["recommendation_consistency"] == "fail"


def test_agent_runs_engine_on_context_pools():
    agent = VerificationAgent()
    result = asyncio.run(agent.run({
        "solutions": [{"id": 1, "name": "LED", "assumptions": ["A"]}],
        "estimates": [{"label": "kWh", "value": 100, "unit": "kWh/year",
                        "low_bound": 80, "high_bound": 120, "assumptions": ["B"]}],
        "evidence": [{"source": "S", "claim": "C", "url": None,
                      "published_date": None, "is_demo": True}],
        "comparison": None,
    }))
    assert result.success is True
    assert len(result.data["checks"]) == 6
    assert result.data["overall"] in {"pass", "warning", "fail"}


def _seed_db():
    init_db()
    db = SessionLocal()
    try:
        problem = Problem(title="Verification test problem", description="d")
        db.add(problem)
        db.commit()
        db.refresh(problem)
        analysis = Analysis(problem_id=problem.id, status="completed")
        db.add(analysis)
        db.commit()
        db.refresh(analysis)
        sol = Solution(analysis_id=analysis.id, name="LED Lighting Retrofit",
                       description="d", solution_type="technology_upgrade",
                       estimated_cost=100, estimated_timeline_months=6,
                       confidence=0.9, difficulty="low",
                       assumptions=["Audit first"], risks=[])
        db.add(sol)
        db.commit()
        db.refresh(sol)
        db.add(ImpactEstimate(solution_id=sol.id, category="energy",
                              label="Annual kWh Reduction", value=450000,
                              unit="kWh/year", is_estimate=1,
                              assumptions=["Baseline 2M"], low_bound=350000,
                              high_bound=550000))
        db.add(Evidence(solution_id=sol.id, source="Campus metering report",
                        claim="Lighting is 15%", confidence=0.8, is_verified=0,
                        url="https://example.edu/metering",
                        published_date="2025-06-01", quality="high",
                        quality_score=0.8, gaps=[], is_demo=0))
        db.add(Comparison(analysis_id=analysis.id,
                          rankings=[{"solution_id": sol.id, "name": "LED Lighting Retrofit",
                                     "overall_score": 88}],
                          recommendation="Proceed with LED Lighting Retrofit.",
                          rationale="Best trade-off."))
        db.commit()
        return problem.id, analysis.id, sol.id
    finally:
        db.close()


def _cleanup_db(problem_id, analysis_id, solution_id):
    db = SessionLocal()
    try:
        for model, filt in [
            (Comparison, Comparison.analysis_id == analysis_id),
            (Evidence, Evidence.solution_id == solution_id),
            (ImpactEstimate, ImpactEstimate.solution_id == solution_id),
            (Solution, Solution.id == solution_id),
            (Analysis, Analysis.id == analysis_id),
            (Problem, Problem.id == problem_id),
        ]:
            db.query(model).filter(filt).delete()
        db.commit()
    finally:
        db.close()


def test_endpoint_reports_pass_for_clean_analysis():
    problem_id, analysis_id, solution_id = _seed_db()
    try:
        r = client.get(f"/api/verification/{analysis_id}")
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["analysis_id"] == analysis_id
        assert body["overall"] == "pass"
        assert body["overall_label"] == "PASS"
        assert len(body["checks"]) == 6
        assert body["scope"] == {"solutions": 1, "estimates": 1, "evidence": 1, "comparison": True}
        assert "disclaimer" in body
    finally:
        _cleanup_db(problem_id, analysis_id, solution_id)


def test_endpoint_404_for_unknown_analysis():
    assert client.get("/api/verification/999999").status_code == 404

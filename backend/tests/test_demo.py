from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.db import (
    ActionPlan, Analysis, Comparison, Evidence, ImpactEstimate,
    MonitoringEntry, Problem, RootCause, Solution,
)
from app.demo import DEMO_PROBLEM_TITLE
from app.main import app

client = TestClient(app)


def _cleanup_demo():
    # Delete children before parents (entries before plans) so no orphan
    # rows survive to collide with reused ids in later tests.
    db = SessionLocal()
    try:
        problems = db.query(Problem).filter(Problem.title == DEMO_PROBLEM_TITLE).all()
        for problem in problems:
            for analysis in db.query(Analysis).filter(Analysis.problem_id == problem.id).all():
                for sol in db.query(Solution).filter(Solution.analysis_id == analysis.id).all():
                    db.query(ImpactEstimate).filter(ImpactEstimate.solution_id == sol.id).delete()
                    db.query(Evidence).filter(Evidence.solution_id == sol.id).delete()
                    for plan in db.query(ActionPlan).filter(ActionPlan.solution_id == sol.id).all():
                        db.query(MonitoringEntry).filter(
                            MonitoringEntry.action_plan_id == plan.id).delete()
                        db.query(ActionPlan).filter(ActionPlan.id == plan.id).delete()
                    db.query(Solution).filter(Solution.id == sol.id).delete()
                for plan in db.query(ActionPlan).filter(ActionPlan.analysis_id == analysis.id).all():
                    db.query(MonitoringEntry).filter(
                        MonitoringEntry.action_plan_id == plan.id).delete()
                    db.query(ActionPlan).filter(ActionPlan.id == plan.id).delete()
                db.query(Comparison).filter(Comparison.analysis_id == analysis.id).delete()
                db.query(RootCause).filter(RootCause.analysis_id == analysis.id).delete()
                db.query(Analysis).filter(Analysis.id == analysis.id).delete()
            db.query(Problem).filter(Problem.id == problem.id).delete()
        db.commit()
    finally:
        db.close()


def _demo_count():
    db = SessionLocal()
    try:
        return db.query(Problem).filter(Problem.title == DEMO_PROBLEM_TITLE).count()
    finally:
        db.close()


def test_status_reports_demo_mode():
    r = client.get("/api/demo/status")
    assert r.status_code == 200, r.text
    body = r.json()
    assert set(body) == {"demo_mode", "llm_configured", "research_provider", "demo_available"}
    assert body["demo_mode"] is True  # test env has no live keys
    assert body["demo_available"] is True


def test_seed_creates_full_labeled_workflow():
    _cleanup_demo()
    try:
        r = client.post("/api/demo/seed")
        assert r.status_code == 200, r.text
        first = r.json()
        assert first["created"] is True
        assert first["problem_id"] and first["analysis_id"]

        db = SessionLocal()
        try:
            problem = db.query(Problem).filter(Problem.id == first["problem_id"]).one()
            assert problem.title.startswith("[DEMO]")
            assert "synthetic" in problem.description.lower()

            analysis = db.query(Analysis).filter(Analysis.id == first["analysis_id"]).one()
            assert analysis.status.value == "completed"

            solutions = db.query(Solution).filter(
                Solution.analysis_id == analysis.id).all()
            assert len(solutions) == 4
            assert db.query(RootCause).filter(
                RootCause.analysis_id == analysis.id).count() == 3

            estimates = []
            for sol in solutions:
                estimates += db.query(ImpactEstimate).filter(
                    ImpactEstimate.solution_id == sol.id).all()
                assert sol.difficulty in {"low", "medium", "high"}
                assert sol.expected_effect
            assert len(estimates) == 16
            for e in estimates:
                assert e.is_estimate == 1
                assert any("DEMO" in a for a in (e.assumptions or [])), e.label

            comp = db.query(Comparison).filter(
                Comparison.analysis_id == analysis.id).one()
            assert len(comp.rankings) == 4
            assert "DEMO" in (comp.recommendation or "")

            evidence = db.query(Evidence).filter(
                Evidence.solution_id == solutions[0].id).all()
            assert len(evidence) == 3
            for v in evidence:
                assert v.is_demo == 1
                assert "DEMO" in v.source
                assert v.url is None  # never fabricated

            plan = db.query(ActionPlan).filter(
                ActionPlan.analysis_id == analysis.id).one()
            assert [p["name"] for p in plan.phases] == ["Audit", "Pilot", "Deployment", "Measurement"]
            assert len(plan.success_metrics) > 0 and len(plan.risk_register) > 0
            assert len(plan.steps) > 0  # legacy view derived

            entries = db.query(MonitoringEntry).filter(
                MonitoringEntry.action_plan_id == plan.id).all()
            assert len(entries) == 2
            assert all(e.actual_value is None for e in entries)  # predictions only
        finally:
            db.close()

        # Full workflow is consumable by downstream endpoints.
        assert client.get(f"/api/verification/{first['analysis_id']}").status_code == 200
        assert client.get(f"/api/reports/{first['analysis_id']}").status_code == 200
    finally:
        _cleanup_demo()


def test_seed_is_idempotent():
    _cleanup_demo()
    try:
        first = client.post("/api/demo/seed").json()
        assert _demo_count() == 1
        second = client.post("/api/demo/seed").json()
        assert second["created"] is False
        assert second["analysis_id"] == first["analysis_id"]
        assert _demo_count() == 1
    finally:
        _cleanup_demo()

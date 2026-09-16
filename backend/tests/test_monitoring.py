from fastapi.testclient import TestClient

from app.database import SessionLocal, init_db
from app.db import ActionPlan, Analysis, MonitoringEntry, Problem, Solution
from app.main import app

client = TestClient(app)


def _seed():
    init_db()
    db = SessionLocal()
    try:
        problem = Problem(title="Monitoring test problem", description="d")
        db.add(problem)
        db.commit()
        db.refresh(problem)
        analysis = Analysis(problem_id=problem.id, status="completed")
        db.add(analysis)
        db.commit()
        db.refresh(analysis)
        sol = Solution(analysis_id=analysis.id, name="LED Lighting Retrofit",
                       description="d", solution_type="technology_upgrade",
                       estimated_cost=250000, estimated_timeline_months=6,
                       confidence=0.9, difficulty="low", assumptions=[],
                       risks=[])
        db.add(sol)
        db.commit()
        db.refresh(sol)
        plan = ActionPlan(analysis_id=analysis.id, solution_id=sol.id,
                          steps=[], timeline_months=6, resources=[],
                          risks=[], phases=[], success_metrics=[],
                          risk_register=[])
        db.add(plan)
        db.commit()
        db.refresh(plan)
        return problem.id, analysis.id, sol.id, plan.id
    finally:
        db.close()


def _cleanup(problem_id, analysis_id, solution_id, plan_id):
    db = SessionLocal()
    try:
        db.query(MonitoringEntry).filter(MonitoringEntry.action_plan_id == plan_id).delete()
        db.query(ActionPlan).filter(ActionPlan.id == plan_id).delete()
        db.query(Solution).filter(Solution.id == solution_id).delete()
        db.query(Analysis).filter(Analysis.id == analysis_id).delete()
        db.query(Problem).filter(Problem.id == problem_id).delete()
        db.commit()
    finally:
        db.close()


def test_create_record_actual_and_list_roundtrip():
    problem_id, analysis_id, solution_id, plan_id = _seed()
    try:
        r = client.post("/api/monitoring", json={
            "action_plan_id": plan_id, "metric_name": "Monthly kWh",
            "predicted_value": 150000, "unit": "kWh", "notes": "simulated estimate",
        })
        assert r.status_code == 200, r.text
        entry = r.json()
        assert entry["actual_value"] is None
        assert entry["predicted_value"] == 150000

        r2 = client.put(f"/api/monitoring/{entry['id']}", json={"actual_value": 162000})
        assert r2.status_code == 200, r2.text
        updated = r2.json()
        assert updated["actual_value"] == 162000
        assert updated["predicted_value"] == 150000  # prediction untouched

        r3 = client.get(f"/api/monitoring/{analysis_id}")
        assert r3.status_code == 200
        assert len(r3.json()) == 1
    finally:
        _cleanup(problem_id, analysis_id, solution_id, plan_id)


def test_record_actual_rejects_bad_input():
    problem_id, analysis_id, solution_id, plan_id = _seed()
    try:
        entry_id = client.post("/api/monitoring", json={
            "action_plan_id": plan_id, "metric_name": "M",
            "predicted_value": 10, "unit": "kWh",
        }).json()["id"]
        assert client.put(f"/api/monitoring/{entry_id}", json={"actual_value": "lots"}).status_code == 422
        assert client.put("/api/monitoring/999999", json={"actual_value": 5}).status_code == 404
        assert client.post("/api/monitoring", json={
            "action_plan_id": 999999, "metric_name": "M",
            "predicted_value": 10, "unit": "kWh",
        }).status_code == 404
    finally:
        _cleanup(problem_id, analysis_id, solution_id, plan_id)

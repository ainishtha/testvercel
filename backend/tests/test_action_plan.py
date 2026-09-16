import asyncio

from fastapi.testclient import TestClient

from app.agents.action import ActionAgent, normalize_plan
from app.database import SessionLocal, init_db
from app.db import ActionPlan, Analysis, Problem, Solution
from app.main import app

client = TestClient(app)


def test_agent_returns_phased_plan_with_roles_and_mitigations():
    agent = ActionAgent()
    result = asyncio.run(agent.run({"selected_solution": {
        "name": "LED Lighting Retrofit", "description": "d",
        "estimated_cost": 250000, "estimated_timeline_months": 6,
    }, "estimates": []}))
    assert result.success is True
    data = result.data
    assert [p["name"] for p in data["phases"]] == ["Audit", "Pilot", "Deployment", "Measurement"]
    for phase in data["phases"]:
        assert phase["objective"] and phase["duration_weeks"] > 0
        assert len(phase["tasks"]) > 0
        for task in phase["tasks"]:
            assert task["title"] and task["role"]
            assert isinstance(task["dependencies"], list)
            assert isinstance(task["resources"], list)
    assert len(data["success_metrics"]) > 0
    assert len(data["risk_register"]) > 0
    for item in data["risk_register"]:
        assert item["risk"] and item["mitigation"]
    assert len(data["steps"]) > 0  # legacy view derived


def test_normalize_plan_wraps_legacy_steps():
    data = normalize_plan({"steps": [
        {"title": "Do X", "description": "d", "duration_weeks": 2},
    ], "timeline_months": 1, "resources": [], "risks": ["R1"]})
    assert len(data["phases"]) == 1
    assert data["phases"][0]["tasks"][0]["role"] == "Project Manager"
    assert data["risk_register"] == [{"risk": "R1", "mitigation": ""}]


def _seed():
    init_db()
    db = SessionLocal()
    try:
        problem = Problem(title="Action plan test problem", description="d")
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
        return problem.id, analysis.id, sol.id
    finally:
        db.close()


def _cleanup(problem_id, analysis_id, solution_id):
    db = SessionLocal()
    try:
        db.query(ActionPlan).filter(ActionPlan.analysis_id == analysis_id).delete()
        db.query(Solution).filter(Solution.id == solution_id).delete()
        db.query(Analysis).filter(Analysis.id == analysis_id).delete()
        db.query(Problem).filter(Problem.id == problem_id).delete()
        db.commit()
    finally:
        db.close()


def test_generate_upsert_and_edit_roundtrip():
    problem_id, analysis_id, solution_id = _seed()
    try:
        r = client.post("/api/action-plans/generate",
                        json={"analysis_id": analysis_id, "solution_id": solution_id})
        assert r.status_code == 200, r.text
        first = r.json()
        assert [p["name"] for p in first["phases"]] == ["Audit", "Pilot", "Deployment", "Measurement"]
        assert len(first["steps"]) > 0

        r2 = client.post("/api/action-plans/generate",
                         json={"analysis_id": analysis_id, "solution_id": solution_id})
        assert r2.status_code == 200
        assert r2.json()["id"] == first["id"]  # upsert, not duplicate

        phases = first["phases"]
        phases[0]["tasks"][0]["title"] = "Edited audit task"
        r3 = client.put(f"/api/action-plans/{first['id']}", json={"phases": phases})
        assert r3.status_code == 200, r3.text
        updated = r3.json()
        assert updated["phases"][0]["tasks"][0]["title"] == "Edited audit task"
        assert updated["steps"][0]["title"] == "Edited audit task"  # legacy view synced

        r4 = client.get(f"/api/action-plans/by-solution/{solution_id}")
        assert r4.status_code == 200
        assert r4.json()["id"] == first["id"]
    finally:
        _cleanup(problem_id, analysis_id, solution_id)


def test_generate_and_update_reject_bad_input():
    assert client.post("/api/action-plans/generate",
                       json={"analysis_id": 999999, "solution_id": 999999}).status_code == 404
    assert client.put("/api/action-plans/999999", json={"timeline_months": 3}).status_code == 404
    problem_id, analysis_id, solution_id = _seed()
    try:
        plan_id = client.post("/api/action-plans/generate",
                              json={"analysis_id": analysis_id, "solution_id": solution_id}).json()["id"]
        assert client.put(f"/api/action-plans/{plan_id}", json={"phases": "nope"}).status_code == 422
        assert client.put(f"/api/action-plans/{plan_id}",
                          json={"phases": [{"tasks": [{"title": ""}]}]}).status_code == 422
    finally:
        _cleanup(problem_id, analysis_id, solution_id)

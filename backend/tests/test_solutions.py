import asyncio

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.agents.solution import SolutionAgent
from app.database import Base
from app.db import Analysis, Problem
from app.orchestrator import AgentOrchestrator


def run(coro):
    return asyncio.run(coro)


def _agent_solutions():
    agent = SolutionAgent()
    result = run(agent.run({
        "problem": {"title": "Campus electricity consumption is too high"},
        "root_causes": [{"description": "Old lighting"}],
        "evidence": [],
    }))
    assert result.success is True
    return result.data["solutions"]


def test_agent_returns_three_to_five_interventions():
    solutions = _agent_solutions()
    assert 3 <= len(solutions) <= 5


def test_interventions_have_required_comparison_fields():
    for s in _agent_solutions():
        assert s["name"] and s["description"]
        assert s["solution_type"] in {
            "technology_upgrade", "operational", "renewable_energy",
            "behavioral", "policy",
        }
        assert isinstance(s["estimated_cost"], (int, float))
        assert isinstance(s["estimated_timeline_months"], int)
        assert 0 <= s["confidence"] <= 1
        assert s["difficulty"] in {"low", "medium", "high"}
        assert s["expected_effect"]
        assert isinstance(s["assumptions"], list) and len(s["assumptions"]) > 0
        assert isinstance(s["risks"], list) and len(s["risks"]) > 0


def test_demo_covers_campus_electricity_interventions():
    names = [s["name"] for s in _agent_solutions()]
    for expected in ["LED", "HVAC", "Schedul", "Solar"]:
        assert any(expected in n for n in names), f"missing {expected} in {names}"


def test_projections_labeled_as_estimates():
    for s in _agent_solutions():
        blob = " ".join(s["assumptions"] + [s["expected_effect"]]).lower()
        assert "estimat" in blob, f"{s['name']} has no estimate labeling"


def test_orchestrator_persists_comparison_fields():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    db = sessionmaker(bind=engine)()
    try:
        db.add(Problem(title="T", description="D"))
        db.commit()
        db.add(Analysis(problem_id=1))
        db.commit()

        orch = AgentOrchestrator(db)
        saved = orch._save_solutions(1, _agent_solutions())
        assert len(saved) >= 3
        first = saved[0]
        assert first.difficulty in {"low", "medium", "high"}
        assert first.expected_effect
        assert isinstance(first.assumptions, list) and len(first.assumptions) > 0
        assert isinstance(first.risks, list) and len(first.risks) > 0
    finally:
        db.close()

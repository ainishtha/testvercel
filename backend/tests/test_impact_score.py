import pytest
from fastapi.testclient import TestClient

from app.calculator.scoring import ScenarioInput, compute_impact_scores
from app.main import app

client = TestClient(app)


def _scenarios():
    return [
        ScenarioInput(name="LED replacement", annual_kwh=180000, annual_usd=21600, co2_tons=72, people=8000, cost_usd=250000, timeline_months=6, confidence=0.9, evidence_quality=0.6),
        ScenarioInput(name="HVAC optimization", annual_kwh=120000, annual_usd=14400, co2_tons=48, people=8000, cost_usd=180000, timeline_months=8, confidence=0.85, evidence_quality=0.5),
        ScenarioInput(name="Smart scheduling", annual_kwh=56000, annual_usd=6720, co2_tons=22.4, people=5000, cost_usd=50000, timeline_months=3, confidence=0.75, evidence_quality=0.4),
        ScenarioInput(name="Solar installation", annual_kwh=300000, annual_usd=36000, co2_tons=120, people=8000, cost_usd=800000, timeline_months=18, confidence=0.8, evidence_quality=0.5),
    ]


def test_scores_bounded_and_deterministic():
    first = compute_impact_scores(_scenarios())
    second = compute_impact_scores(_scenarios())
    assert first == second
    assert len(first["scenarios"]) == 4
    for s in first["scenarios"]:
        assert 0 <= s["overall"] <= 100
        assert len(s["factors"]) == 6
        for f in s["factors"]:
            assert 0 <= f["score"] <= 100
            assert f["explanation"]
    ranks = [s["rank"] for s in first["scenarios"]]
    assert sorted(ranks) == [1, 2, 3, 4]


def test_environmental_weight_only_ranks_by_co2():
    out = compute_impact_scores(_scenarios(), weights={
        "environmental": 100, "financial": 0, "people": 0,
        "feasibility": 0, "cost_efficiency": 0, "evidence_quality": 0,
    })
    order = [s["name"] for s in out["scenarios"]]
    assert order[0] == "Solar installation"
    assert all(f["key"] != "environmental" or f["weight"] == 100 for s in out["scenarios"] for f in s["factors"])


def test_weights_normalized_to_100():
    out = compute_impact_scores(_scenarios(), weights={"environmental": 1, "financial": 1, "people": 1, "feasibility": 1, "cost_efficiency": 1, "evidence_quality": 1})
    total = sum(out["weights_used"].values())
    assert abs(total - 100) < 0.2


def test_engine_rejects_bad_input():
    with pytest.raises(ValueError, match="At least one scenario"):
        compute_impact_scores([])
    with pytest.raises(ValueError, match="Unknown factor"):
        compute_impact_scores(_scenarios(), weights={"magic": 10})
    with pytest.raises(ValueError, match=">= 0"):
        compute_impact_scores(_scenarios(), weights={"environmental": -5})
    with pytest.raises(ValueError, match="At least one factor weight"):
        compute_impact_scores(_scenarios(), weights={k: 0 for k in ["environmental", "financial", "people", "feasibility", "cost_efficiency", "evidence_quality"]})


def _body():
    return {
        "scenarios": [
            {"name": "LED replacement", "annual_usd": 21600, "co2_tons": 72, "people": 8000, "cost_usd": 250000, "timeline_months": 6, "confidence": 0.9, "evidence_quality": 0.6},
            {"name": "Solar installation", "annual_usd": 36000, "co2_tons": 120, "people": 8000, "cost_usd": 800000, "timeline_months": 18, "confidence": 0.8, "evidence_quality": 0.5},
        ],
    }


def test_endpoint_returns_full_breakdown():
    r = client.post("/api/impact-score", json=_body())
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["framework"]["name"]
    assert len(body["scenarios"]) == 2
    assert len(body["assumptions"]) > 0
    top = body["scenarios"][0]
    assert {"name", "rank", "overall", "factors"} <= set(top)
    assert {f["key"] for f in top["factors"]} == {"environmental", "financial", "people", "feasibility", "cost_efficiency", "evidence_quality"}


def test_endpoint_rejects_unknown_factor_and_empty():
    r = client.post("/api/impact-score", json={**_body(), "weights": {"magic": 10}})
    assert r.status_code == 422
    assert client.post("/api/impact-score", json={"scenarios": []}).status_code == 422
    bad = _body()
    bad["scenarios"][0]["confidence"] = 2.0
    assert client.post("/api/impact-score", json=bad).status_code == 422

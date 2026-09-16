from fastapi.testclient import TestClient

from app.calculator import sensitivity_table, simulate_portfolio
from app.main import app

client = TestClient(app)

DEFAULTS = dict(
    baseline_kwh=2_000_000,
    budget=1_280_000,
    implementation_pct=100,
    reduction_factor=1.0,
    electricity_rate=0.12,
    project_years=10,
)


def test_portfolio_returns_four_scenarios_with_totals():
    sim = simulate_portfolio(**DEFAULTS)
    assert [s["key"] for s in sim["scenarios"]] == ["led", "hvac", "scheduling", "solar"]
    t = sim["totals"]
    assert t["within_budget"] is True
    assert t["investment_cost"] == sum(s["investment_cost"]["value"] for s in sim["scenarios"])
    assert t["energy_savings_kwh"] > 0
    assert t["annual_savings_usd"] > 0
    assert t["co2_tons_per_year"] > 0


def test_zero_implementation_gives_zero_savings():
    sim = simulate_portfolio(**{**DEFAULTS, "implementation_pct": 0})
    t = sim["totals"]
    assert t["energy_savings_kwh"] == 0
    assert t["annual_savings_usd"] == 0
    assert t["investment_cost"] == 0


def test_budget_flag_and_overrun_math():
    sim = simulate_portfolio(**{**DEFAULTS, "budget": 1})
    t = sim["totals"]
    assert t["within_budget"] is False
    assert t["budget_gap"] == round(t["investment_cost"] - 1, 2)


def test_sensitivity_sweeps_are_monotonic():
    sens = sensitivity_table(**DEFAULTS)
    assert len(sens["rate_sweep"]) == 5
    assert len(sens["reduction_sweep"]) == 5
    rates = [r["annual_savings_usd"] for r in sens["rate_sweep"]]
    assert rates == sorted(rates), "savings must rise with electricity price"
    reds = [r["annual_savings_usd"] for r in sens["reduction_sweep"]]
    assert reds == sorted(reds), "savings must rise with reduction factor"
    assert all("payback_years" in r for r in sens["rate_sweep"])


def test_simulate_endpoint_returns_full_contract():
    r = client.post("/api/simulate", json=DEFAULTS)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["is_estimate"] is True
    assert len(body["scenarios"]) == 4
    assert set(body["units"]) == {"energy", "money", "co2", "payback"}
    totals = body["totals"]
    assert totals["investment_cost"]["unit"] == "USD"
    assert totals["payback"]["unit"] == "years"
    assert len(body["sensitivity"]["rate_sweep"]) == 5
    assert len(body["assumptions"]) > 0


def test_simulate_endpoint_zero_implementation_serializes():
    r = client.post("/api/simulate", json={**DEFAULTS, "implementation_pct": 0})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["totals"]["payback"]["value"] is None
    assert body["totals"]["financial_savings_annual"]["value"] == 0


def test_simulate_endpoint_rejects_invalid_inputs():
    assert client.post("/api/simulate", json={**DEFAULTS, "implementation_pct": 150}).status_code == 422
    assert client.post("/api/simulate", json={**DEFAULTS, "electricity_rate": -1}).status_code == 422
    assert client.post("/api/simulate", json={**DEFAULTS, "project_years": 0}).status_code == 422

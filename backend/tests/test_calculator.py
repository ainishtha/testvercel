import pytest
from app.calculator import (
    calculate_energy_savings,
    calculate_cost_savings,
    calculate_co2_reduction,
    calculate_payback,
    calculate_roi,
    score_solution,
)


def test_energy_savings():
    result = calculate_energy_savings(baseline_kwh=2_000_000)
    assert "total_savings_kwh" in result
    total = result["total_savings_kwh"]
    assert total.value > 0
    assert total.unit == "kWh/year"
    assert total.low_bound < total.value < total.high_bound
    assert len(total.assumptions) > 0


def test_energy_savings_custom_params():
    r1 = calculate_energy_savings(baseline_kwh=1_000_000)
    r2 = calculate_energy_savings(baseline_kwh=2_000_000)
    assert r2["total_savings_kwh"].value == pytest.approx(r1["total_savings_kwh"].value * 2, rel=0.01)


def test_cost_savings():
    result = calculate_cost_savings(savings_kwh=450_000, electricity_rate=0.12)
    assert result.value == pytest.approx(54_000, rel=0.01)
    assert result.unit == "USD/year"
    assert result.low_bound < result.value < result.high_bound


def test_cost_savings_zero_rate():
    result = calculate_cost_savings(savings_kwh=100_000, electricity_rate=0.0)
    assert result.value == 0.0


def test_co2_reduction():
    result = calculate_co2_reduction(savings_kwh=450_000, emission_factor=0.4)
    assert result.value == pytest.approx(180.0, rel=0.01)
    assert "CO2" in result.unit


def test_payback_simple():
    result = calculate_payback(upfront_cost=250_000, annual_savings=54_000)
    assert result.value == pytest.approx(4.6, rel=0.1)
    assert result.unit == "years"


def test_payback_with_discount():
    result = calculate_payback(upfront_cost=250_000, annual_savings=54_000, discount_rate=0.05)
    assert result.value > 4.6


def test_payback_zero_savings():
    result = calculate_payback(upfront_cost=100_000, annual_savings=0)
    assert result.value == float("inf")


def test_roi():
    result = calculate_roi(upfront_cost=250_000, annual_savings=54_000, project_life_years=20)
    assert result.value > 0
    assert result.unit == "%"


def test_score_solution():
    scores = score_solution(
        cost=250_000,
        annual_savings=54_000,
        co2_reduction_tons=180,
        timeline_months=6,
        confidence=0.9,
    )
    assert 0 <= scores["overall_score"] <= 100
    assert all(k in scores for k in ["cost_score", "impact_score", "feasibility_score", "timeline_score"])


def test_score_solution_expensive():
    cheap = score_solution(cost=50_000, annual_savings=54_000, co2_reduction_tons=180, timeline_months=6, confidence=0.9)
    expensive = score_solution(cost=800_000, annual_savings=54_000, co2_reduction_tons=180, timeline_months=6, confidence=0.9)
    assert cheap["cost_score"] > expensive["cost_score"]

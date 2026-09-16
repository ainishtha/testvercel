from dataclasses import dataclass, field


@dataclass
class CalculationResult:
    value: float
    unit: str
    assumptions: list[str] = field(default_factory=list)
    low_bound: float | None = None
    high_bound: float | None = None
    is_estimate: bool = True


def calculate_energy_savings(
    baseline_kwh: float,
    led_reduction_pct: float = 0.60,
    hvac_reduction_pct: float = 0.12,
    scheduling_reduction_pct: float = 0.08,
    solar_offset_kwh: float = 0.0,
) -> dict[str, CalculationResult]:
    lighting_kwh = baseline_kwh * 0.15
    hvac_kwh = baseline_kwh * 0.50
    other_kwh = baseline_kwh * 0.35

    led_savings = lighting_kwh * led_reduction_pct
    hvac_savings = hvac_kwh * hvac_reduction_pct
    schedule_savings = other_kwh * scheduling_reduction_pct
    total_efficiency = led_savings + hvac_savings + schedule_savings
    total_with_solar = total_efficiency + solar_offset_kwh

    return {
        "led_savings_kwh": CalculationResult(
            value=round(led_savings, 2),
            unit="kWh/year",
            assumptions=[
                f"Lighting is {baseline_kwh * 0.15 / baseline_kwh * 100:.0f}% of total load",
                f"LED reduction: {led_reduction_pct * 100:.0f}%",
                f"Baseline: {baseline_kwh:,.0f} kWh/year",
            ],
            low_bound=round(led_savings * 0.8, 2),
            high_bound=round(led_savings * 1.2, 2),
        ),
        "hvac_savings_kwh": CalculationResult(
            value=round(hvac_savings, 2),
            unit="kWh/year",
            assumptions=[
                f"HVAC is {baseline_kwh * 0.50 / baseline_kwh * 100:.0f}% of total load",
                f"HVAC optimization reduction: {hvac_reduction_pct * 100:.0f}%",
            ],
            low_bound=round(hvac_savings * 0.8, 2),
            high_bound=round(hvac_savings * 1.2, 2),
        ),
        "scheduling_savings_kwh": CalculationResult(
            value=round(schedule_savings, 2),
            unit="kWh/year",
            assumptions=[
                f"Other loads are {baseline_kwh * 0.35 / baseline_kwh * 100:.0f}% of total",
                f"Scheduling reduction: {scheduling_reduction_pct * 100:.0f}%",
            ],
            low_bound=round(schedule_savings * 0.7, 2),
            high_bound=round(schedule_savings * 1.3, 2),
        ),
        "total_savings_kwh": CalculationResult(
            value=round(total_with_solar, 2),
            unit="kWh/year",
            assumptions=[
                "Sum of all intervention savings",
                "Savings are not strictly additive (overlap possible)",
            ],
            low_bound=round(total_with_solar * 0.75, 2),
            high_bound=round(total_with_solar * 1.25, 2),
        ),
    }


def calculate_cost_savings(
    savings_kwh: float,
    electricity_rate: float = 0.12,
) -> CalculationResult:
    annual_savings = savings_kwh * electricity_rate
    return CalculationResult(
        value=round(annual_savings, 2),
        unit="USD/year",
        assumptions=[
            f"Electricity rate: ${electricity_rate:.4f}/kWh",
            "Based on current rate only, no escalation assumed",
        ],
        low_bound=round(annual_savings * 0.8, 2),
        high_bound=round(annual_savings * 1.2, 2),
    )


def calculate_co2_reduction(
    savings_kwh: float,
    emission_factor: float = 0.4,
) -> CalculationResult:
    co2_tons = savings_kwh * emission_factor / 1000
    return CalculationResult(
        value=round(co2_tons, 2),
        unit="metric tons CO2/year",
        assumptions=[
            f"Emission factor: {emission_factor} kg CO2/kWh (EPA eGRID national avg)",
            "Scope 2 indirect emissions only",
        ],
        low_bound=round(co2_tons * 0.8, 2),
        high_bound=round(co2_tons * 1.2, 2),
    )


def calculate_payback(
    upfront_cost: float,
    annual_savings: float,
    discount_rate: float = 0.0,
) -> CalculationResult:
    if annual_savings <= 0:
        return CalculationResult(
            value=float("inf"),
            unit="years",
            assumptions=["No positive savings projected"],
        )

    if discount_rate == 0:
        payback = upfront_cost / annual_savings
    else:
        cumulative = 0.0
        year = 0
        while cumulative < upfront_cost:
            year += 1
            cumulative += annual_savings / ((1 + discount_rate) ** year)
        payback = year

    return CalculationResult(
        value=round(payback, 1),
        unit="years",
        assumptions=[
            f"Upfront cost: ${upfront_cost:,.0f}",
            f"Annual savings: ${annual_savings:,.0f}",
            f"Discount rate: {discount_rate * 100:.1f}%",
            "Simple payback" if discount_rate == 0 else "Discounted payback",
        ],
        low_bound=round(payback * 0.85, 1),
        high_bound=round(payback * 1.25, 1),
    )


def calculate_roi(
    upfront_cost: float,
    annual_savings: float,
    project_life_years: int = 20,
) -> CalculationResult:
    total_savings = annual_savings * project_life_years
    roi = ((total_savings - upfront_cost) / upfront_cost) * 100 if upfront_cost > 0 else 0
    return CalculationResult(
        value=round(roi, 1),
        unit="%",
        assumptions=[
            f"Project life: {project_life_years} years",
            f"Total savings: ${total_savings:,.0f}",
            f"Upfront cost: ${upfront_cost:,.0f}",
            "No discount rate applied",
        ],
    )


def score_solution(
    cost: float,
    annual_savings: float,
    co2_reduction_tons: float,
    timeline_months: int,
    confidence: float,
    max_cost: float = 1000000,
    max_timeline: int = 24,
) -> dict[str, float]:
    cost_score = max(0, 100 - (cost / max_cost * 100))
    impact_score = min(100, (annual_savings / 100000) * 50 + (co2_reduction_tons / 500) * 50)
    feasibility_score = confidence * 100
    timeline_score = max(0, 100 - (timeline_months / max_timeline * 100))
    overall = cost_score * 0.25 + impact_score * 0.30 + feasibility_score * 0.25 + timeline_score * 0.20
    return {
        "cost_score": round(cost_score, 1),
        "impact_score": round(impact_score, 1),
        "feasibility_score": round(feasibility_score, 1),
        "timeline_score": round(timeline_score, 1),
        "overall_score": round(overall, 1),
    }


# ---------------------------------------------------------------------------
# Portfolio simulation (deterministic; no LLM, no web calls).
# Used by POST /api/simulate. Every output is an estimate with assumptions.
# ---------------------------------------------------------------------------

INTERVENTION_CATALOG: list[dict] = [
    {
        "key": "led",
        "name": "LED replacement",
        "cost": 250000,
        "load_share": 0.15,
        "reduction_pct": 0.60,
        "band": 0.20,
    },
    {
        "key": "hvac",
        "name": "HVAC optimization",
        "cost": 180000,
        "load_share": 0.50,
        "reduction_pct": 0.12,
        "band": 0.20,
    },
    {
        "key": "scheduling",
        "name": "Smart scheduling",
        "cost": 50000,
        "load_share": 0.35,
        "reduction_pct": 0.08,
        "band": 0.30,
    },
    {
        "key": "solar",
        "name": "Solar installation",
        "cost": 800000,
        "load_share": None,  # offset model, not a load share
        "reduction_pct": 0.15,  # fraction of baseline offset at factor 1.0
        "band": 0.25,
    },
]


def _clamp_pct(value: float, cap: float = 0.95) -> float:
    return max(0.0, min(cap, value))


def simulate_portfolio(
    baseline_kwh: float,
    budget: float,
    implementation_pct: float,
    reduction_factor: float,
    electricity_rate: float,
    project_years: int,
    emission_factor: float = 0.4,
) -> dict:
    """Deterministically simulate all catalog interventions.

    - ``implementation_pct`` (0-100) scales both savings and capex (partial rollout).
    - ``reduction_factor`` scales every engineering reduction assumption.
    - ``budget`` is reported against, not silently enforced (see ``within_budget``).
    """
    impl = implementation_pct / 100.0
    scenarios = []
    for item in INTERVENTION_CATALOG:
        if item["load_share"] is None:
            base_kwh = baseline_kwh * _clamp_pct(item["reduction_pct"] * reduction_factor, cap=1.0)
        else:
            base_kwh = (
                baseline_kwh
                * item["load_share"]
                * _clamp_pct(item["reduction_pct"] * reduction_factor)
            )
        band = item["band"]
        energy = CalculationResult(
            value=round(base_kwh * impl, 2),
            unit="kWh/year",
            assumptions=[
                f"Baseline: {baseline_kwh:,.0f} kWh/year (user input)",
                f"Reduction assumption scaled by factor {reduction_factor}",
                f"Implementation at {implementation_pct:g}% of full rollout",
            ],
            low_bound=round(base_kwh * impl * (1 - band), 2),
            high_bound=round(base_kwh * impl * (1 + band), 2),
        )
        cost = calculate_cost_savings(energy.value, electricity_rate)
        co2 = calculate_co2_reduction(energy.value, emission_factor)
        investment = round(item["cost"] * impl, 2)
        lifetime = round(cost.value * project_years, 2)
        payback = calculate_payback(investment, cost.value)

        scenarios.append({
            "key": item["key"],
            "name": item["name"],
            "investment_cost": {
                "value": investment, "unit": "USD",
                "assumptions": [
                    f"Catalog capex ${item['cost']:,.0f} scaled to {implementation_pct:g}% implementation",
                    "Planning figure, not a vendor quote",
                ],
            },
            "energy_savings": energy,
            "financial_savings_annual": cost,
            "financial_savings_lifetime": CalculationResult(
                value=lifetime, unit="USD",
                assumptions=[
                    f"Annual savings x {project_years} years, no escalation, no discounting",
                ],
                low_bound=round(cost.low_bound * project_years, 2) if cost.low_bound else None,
                high_bound=round(cost.high_bound * project_years, 2) if cost.high_bound else None,
            ),
            "co2_reduction": co2,
            "payback": payback,
        })

    total_investment = round(sum(s["investment_cost"]["value"] for s in scenarios), 2)
    total_kwh = round(sum(s["energy_savings"].value for s in scenarios), 2)
    total_annual = round(sum(s["financial_savings_annual"].value for s in scenarios), 2)
    total_co2 = round(sum(s["co2_reduction"].value for s in scenarios), 2)
    totals = {
        "investment_cost": total_investment,
        "energy_savings_kwh": total_kwh,
        "annual_savings_usd": total_annual,
        "lifetime_savings_usd": round(total_annual * project_years, 2),
        "co2_tons_per_year": total_co2,
        "payback": calculate_payback(total_investment, total_annual),
        "within_budget": total_investment <= budget,
        "budget": budget,
        "budget_gap": round(total_investment - budget, 2),
    }
    return {"scenarios": scenarios, "totals": totals}


def sensitivity_table(
    baseline_kwh: float,
    budget: float,
    implementation_pct: float,
    reduction_factor: float,
    electricity_rate: float,
    project_years: int,
    emission_factor: float = 0.4,
    steps: int = 5,
) -> dict:
    """Sweep electricity price (±40%) and reduction factor (0.5x-1.5x).

    Pure arithmetic on top of ``simulate_portfolio`` — same assumptions.
    """
    def _totals(rate: float, factor: float) -> dict:
        sim = simulate_portfolio(
            baseline_kwh, budget, implementation_pct, factor,
            rate, project_years, emission_factor,
        )
        t = sim["totals"]
        pb = t["payback"].value
        return {
            "annual_savings_usd": t["annual_savings_usd"],
            "lifetime_savings_usd": t["lifetime_savings_usd"],
            "payback_years": None if pb == float("inf") else pb,
        }

    low, high = electricity_rate * 0.6, electricity_rate * 1.4
    rate_sweep = []
    for i in range(steps):
        rate = low if steps == 1 else low + (high - low) * i / (steps - 1)
        rate_sweep.append({"electricity_rate": round(rate, 4), **_totals(rate, reduction_factor)})

    reduction_sweep = []
    for i in range(steps):
        factor = 0.5 if steps == 1 else 0.5 + (1.5 - 0.5) * i / (steps - 1)
        reduction_sweep.append({"reduction_factor": round(factor, 2), **_totals(electricity_rate, factor)})

    return {"rate_sweep": rate_sweep, "reduction_sweep": reduction_sweep}

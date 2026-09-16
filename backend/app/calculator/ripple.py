"""Ripple-graph builder (deterministic, no LLM, no web calls).

Builds a node-and-edge impact chain for one intervention scenario, using ONLY
values already produced by ``simulate_portfolio``. Every edge corresponds to
an arithmetic step in the impact model — no causal relationships are invented:

    intervention --capex--> energy --(kWh x rate)--> cost --(annual x yrs)--> lifetime
         |                         \--(kWh x factor)--> co2
         \--(minus capex)--> net <--(minus capex)-- lifetime

Each node carries metric, value, unit, assumptions, and the exact calculation
string so users can inspect how every value was derived.
"""

from __future__ import annotations


def _fmt(value, digits: int = 0) -> str:
    if value is None:
        return "n/a"
    if digits == 0:
        return f"{value:,.0f}"
    return f"{value:,.{digits}f}"


def build_ripple_graph(scenario: dict, inputs: dict) -> dict:
    """Build the impact chain for a single ``simulate_portfolio`` scenario.

    ``scenario`` is one entry of ``simulate_portfolio(...)["scenarios"]``
    (values are ``CalculationResult`` objects, except ``investment_cost``
    which is a plain dict); ``inputs`` echoes the simulation inputs
    (baseline_kwh, electricity_rate, project_years, emission_factor,
    implementation_pct, reduction_factor).
    """
    name = scenario["name"]
    inv = scenario["investment_cost"]["value"]
    energy = scenario["energy_savings"]
    annual = scenario["financial_savings_annual"]
    lifetime = scenario["financial_savings_lifetime"]
    co2 = scenario["co2_reduction"]

    baseline = inputs["baseline_kwh"]
    rate = inputs["electricity_rate"]
    years = inputs["project_years"]
    ef = inputs["emission_factor"]
    impl = inputs["implementation_pct"]

    net_value = round(lifetime.value - inv, 2)

    nodes = [
        {
            "id": "intervention",
            "label": name,
            "kind": "intervention",
            "metric": "Investment cost",
            "value": inv,
            "unit": "USD",
            "low_bound": None,
            "high_bound": None,
            "assumptions": scenario["investment_cost"].get("assumptions", []),
            "calculation": (
                f"Catalog capex scaled to {impl:g}% implementation "
                f"(planning figure, not a vendor quote)."
            ),
            "is_estimate": True,
        },
        {
            "id": "energy",
            "label": "Lower Energy Consumption",
            "kind": "energy",
            "metric": "Energy savings",
            "value": energy.value,
            "unit": energy.unit,
            "low_bound": energy.low_bound,
            "high_bound": energy.high_bound,
            "assumptions": energy.assumptions,
            "calculation": (
                f"{_fmt(baseline)} kWh/yr baseline x intervention load share x "
                f"reduction assumption x {impl:g}% implementation = "
                f"{_fmt(energy.value)} {energy.unit}."
            ),
            "is_estimate": True,
        },
        {
            "id": "cost",
            "label": "Lower Electricity Cost",
            "kind": "financial",
            "metric": "Annual cost savings",
            "value": annual.value,
            "unit": annual.unit,
            "low_bound": annual.low_bound,
            "high_bound": annual.high_bound,
            "assumptions": annual.assumptions,
            "calculation": (
                f"{_fmt(energy.value)} kWh/yr x ${rate:.4f}/kWh = "
                f"${_fmt(annual.value)} {annual.unit}."
            ),
            "is_estimate": True,
        },
        {
            "id": "co2",
            "label": "Estimated CO2e Reduction",
            "kind": "environmental",
            "metric": "Emissions avoided",
            "value": co2.value,
            "unit": co2.unit,
            "low_bound": co2.low_bound,
            "high_bound": co2.high_bound,
            "assumptions": co2.assumptions,
            "calculation": (
                f"{_fmt(energy.value)} kWh/yr x {ef} kg CO2/kWh / 1000 = "
                f"{_fmt(co2.value, 2)} {co2.unit}."
            ),
            "is_estimate": True,
        },
        {
            "id": "lifetime",
            "label": "Lifetime Savings",
            "kind": "financial",
            "metric": "Cumulative savings",
            "value": lifetime.value,
            "unit": lifetime.unit,
            "low_bound": lifetime.low_bound,
            "high_bound": lifetime.high_bound,
            "assumptions": lifetime.assumptions,
            "calculation": (
                f"${_fmt(annual.value)}/yr x {years} yrs = "
                f"${_fmt(lifetime.value)} (flat rate, no discounting)."
            ),
            "is_estimate": True,
        },
        {
            "id": "net",
            "label": "Budget Saved (net)",
            "kind": "financial",
            "metric": "Net budget impact",
            "value": net_value,
            "unit": "USD",
            "low_bound": None,
            "high_bound": None,
            "assumptions": [
                "Net of lifetime savings minus investment cost.",
                "Positive means the intervention pays for itself in the model; "
                "negative means it does not within the project horizon.",
            ],
            "calculation": (
                f"${_fmt(lifetime.value)} lifetime savings - "
                f"${_fmt(inv)} investment = ${_fmt(net_value)}."
            ),
            "is_estimate": True,
        },
    ]

    edges = [
        {
            "from": "intervention", "to": "energy",
            "formula": "baseline x share x reduction x implementation",
            "description": "The intervention drives the modeled energy reduction.",
        },
        {
            "from": "energy", "to": "cost",
            "formula": "kWh/yr x USD/kWh",
            "description": "Each saved kWh avoids spend at the electricity price.",
        },
        {
            "from": "energy", "to": "co2",
            "formula": "kWh/yr x kg CO2/kWh / 1000",
            "description": "Each saved kWh avoids grid emissions at the emission factor.",
        },
        {
            "from": "cost", "to": "lifetime",
            "formula": "USD/yr x years",
            "description": "Annual savings accumulate over the project horizon.",
        },
        {
            "from": "lifetime", "to": "net",
            "formula": "lifetime USD - capex USD",
            "description": "Net budget impact after recovering the investment.",
        },
        {
            "from": "intervention", "to": "net",
            "formula": "minus capex USD",
            "description": "The upfront investment offsets lifetime savings.",
        },
    ]

    return {
        "is_estimate": True,
        "scenario": scenario["name"],
        "scenario_key": scenario["key"],
        "nodes": nodes,
        "edges": edges,
        "assumptions": [
            "Every node value is a planning estimate from the deterministic impact model.",
            "Edges represent arithmetic derivations only — not independent causal claims.",
            "Scenario savings are modeled in isolation; combined portfolios may overlap.",
        ],
    }

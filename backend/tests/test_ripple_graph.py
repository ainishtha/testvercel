from fastapi.testclient import TestClient

from app.calculator import simulate_portfolio
from app.calculator.ripple import build_ripple_graph
from app.main import app

client = TestClient(app)

DEFAULTS = dict(
    baseline_kwh=2_000_000,
    budget=1_280_000,
    implementation_pct=100,
    reduction_factor=1.0,
    electricity_rate=0.12,
    project_years=10,
    emission_factor=0.4,
    scenario_key="hvac",
)

EXPECTED_EDGES = {
    ("intervention", "energy"),
    ("energy", "cost"),
    ("energy", "co2"),
    ("cost", "lifetime"),
    ("lifetime", "net"),
    ("intervention", "net"),
}


def _graph(key="hvac"):
    sim = simulate_portfolio(**{k: v for k, v in DEFAULTS.items() if k != "scenario_key"})
    scenario = next(s for s in sim["scenarios"] if s["key"] == key)
    return build_ripple_graph(scenario, {k: DEFAULTS[k] for k in (
        "baseline_kwh", "electricity_rate", "project_years",
        "emission_factor", "implementation_pct", "reduction_factor",
    )}), scenario


def test_graph_has_only_model_supported_edges():
    graph, _ = _graph()
    edges = {(e["from"], e["to"]) for e in graph["edges"]}
    assert edges == EXPECTED_EDGES, "no invented causal links allowed"
    node_ids = {n["id"] for n in graph["nodes"]}
    assert node_ids == {"intervention", "energy", "cost", "co2", "lifetime", "net"}
    for e in graph["edges"]:
        assert e["from"] in node_ids and e["to"] in node_ids
        assert e["formula"]


def test_nodes_carry_metric_value_unit_assumptions_calculation():
    graph, _ = _graph()
    for n in graph["nodes"]:
        assert n["metric"] and n["unit"]
        assert isinstance(n["value"], (int, float))
        assert isinstance(n["assumptions"], list) and len(n["assumptions"]) > 0
        assert n["calculation"]
        assert n["is_estimate"] is True
    assert len(graph["assumptions"]) > 0


def test_node_values_match_portfolio_math():
    graph, scenario = _graph("led")
    by_id = {n["id"]: n for n in graph["nodes"]}
    assert by_id["energy"]["value"] == scenario["energy_savings"].value
    assert by_id["cost"]["value"] == scenario["financial_savings_annual"].value
    assert by_id["co2"]["value"] == scenario["co2_reduction"].value
    assert by_id["net"]["value"] == round(
        scenario["financial_savings_lifetime"].value
        - scenario["investment_cost"]["value"], 2)


def test_endpoint_returns_graph_for_each_scenario():
    for key in ["led", "hvac", "scheduling", "solar"]:
        r = client.post("/api/ripple-graph", json={**DEFAULTS, "scenario_key": key})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["scenario_key"] == key
        assert len(body["nodes"]) == 6 and len(body["edges"]) == 6
        assert len(body["scenarios"]) == 4


def test_endpoint_rejects_unknown_scenario():
    r = client.post("/api/ripple-graph", json={**DEFAULTS, "scenario_key": "moon-base"})
    assert r.status_code == 422

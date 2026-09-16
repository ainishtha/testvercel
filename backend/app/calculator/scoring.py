"""Transparent Impact Score engine (deterministic, no LLM, no web calls).

A project-defined decision-support framework — NOT a scientific truth.
Six factors, configurable weights, every number traceable to an input:

- environmental .... CO2e avoided (metric tons/year), relative min-max
- financial ......... annual savings (USD/year), relative min-max
- people ............ people benefited (count), relative min-max
- feasibility ....... from confidence + timeline, absolute formula
- cost_efficiency ... lifetime savings per USD invested, relative min-max
- evidence_quality .. assessed evidence score 0-1, absolute (x100)

Relative factors use min-max normalization across the scored set so scores
are comparable *within one scoring run*; they are meaningless across runs
with different sets. This is disclosed in the response assumptions.
"""

from __future__ import annotations

from dataclasses import dataclass, field

FRAMEWORK_NAME = "Impactus Impact Score"
FRAMEWORK_VERSION = "1.0"
FRAMEWORK_NOTE = (
    "A project-defined decision-support framework, not a scientific truth. "
    "Scores rank the given interventions against each other and change if the "
    "set, inputs, or weights change."
)

DEFAULT_WEIGHTS: dict[str, float] = {
    "environmental": 20,
    "financial": 20,
    "people": 15,
    "feasibility": 15,
    "cost_efficiency": 15,
    "evidence_quality": 15,
}

FACTOR_LABELS: dict[str, str] = {
    "environmental": "Environmental Benefit",
    "financial": "Financial Benefit",
    "people": "People Benefited",
    "feasibility": "Feasibility",
    "cost_efficiency": "Cost Efficiency",
    "evidence_quality": "Evidence Quality",
}

REFERENCE_PAYBACK_YEARS = 10.0
REFERENCE_TIMELINE_MONTHS = 24.0


@dataclass
class ScenarioInput:
    name: str
    annual_kwh: float = 0.0
    annual_usd: float = 0.0
    co2_tons: float = 0.0
    people: float = 0.0
    cost_usd: float = 0.0
    timeline_months: float = 12.0
    confidence: float = 0.5
    evidence_quality: float = 0.5
    evidence_source: str = "default"


@dataclass
class FactorScore:
    key: str
    label: str
    score: float
    weight: float
    input_value: float | None
    input_unit: str
    explanation: str


def normalize_weights(weights: dict[str, float] | None) -> dict[str, float]:
    merged = {**DEFAULT_WEIGHTS, **(weights or {})}
    unknown = set(merged) - set(DEFAULT_WEIGHTS)
    if unknown:
        raise ValueError(f"Unknown factor(s): {sorted(unknown)}")
    for key, value in merged.items():
        if value < 0:
            raise ValueError(f"Weight for '{key}' must be >= 0")
    total = sum(merged.values())
    if total <= 0:
        raise ValueError("At least one factor weight must be > 0")
    return {key: round(value / total * 100, 1) for key, value in merged.items()}


def _minmax(values: list[float]) -> tuple[float, float]:
    return (min(values), max(values)) if values else (0.0, 0.0)


def _relative(value: float, lo: float, hi: float) -> float:
    if hi <= lo:
        return 50.0  # no variation in set: neutral, disclosed in explanation
    return round((value - lo) / (hi - lo) * 100, 1)


def compute_impact_scores(
    scenarios: list[ScenarioInput],
    weights: dict[str, float] | None = None,
) -> dict:
    if not scenarios:
        raise ValueError("At least one scenario is required")
    weights_used = normalize_weights(weights)

    co2_vals = [max(0.0, s.co2_tons) for s in scenarios]
    usd_vals = [max(0.0, s.annual_usd) for s in scenarios]
    people_vals = [max(0.0, s.people) for s in scenarios]
    ratios = [
        (s.annual_usd * REFERENCE_PAYBACK_YEARS / s.cost_usd) if s.cost_usd > 0 else 0.0
        for s in scenarios
    ]
    lo_c, hi_c = _minmax(co2_vals)
    lo_u, hi_u = _minmax(usd_vals)
    lo_p, hi_p = _minmax(people_vals)
    lo_r, hi_r = _minmax(ratios)

    ranked = []
    for s in scenarios:
        confidence = max(0.0, min(1.0, s.confidence))
        timeline = max(0.0, s.timeline_months)
        ev_q = max(0.0, min(1.0, s.evidence_quality))

        env = _relative(max(0.0, s.co2_tons), lo_c, hi_c)
        fin = _relative(max(0.0, s.annual_usd), lo_u, hi_u)
        people = _relative(max(0.0, s.people), lo_p, hi_p)
        feasibility = round(
            100 * (0.6 * confidence + 0.4 * max(0.0, 1 - timeline / REFERENCE_TIMELINE_MONTHS)), 1
        )
        ratio = (s.annual_usd * REFERENCE_PAYBACK_YEARS / s.cost_usd) if s.cost_usd > 0 else 0.0
        cost_eff = _relative(ratio, lo_r, hi_r)
        ev_score = round(ev_q * 100, 1)

        factors = [
            FactorScore(
                key="environmental", label=FACTOR_LABELS["environmental"],
                score=env, weight=weights_used["environmental"],
                input_value=round(s.co2_tons, 2), input_unit="t CO2/yr",
                explanation=(
                    f"{s.co2_tons:,.1f} t CO2/yr vs set range {lo_c:,.1f}-{hi_c:,.1f}; "
                    f"min-max normalized{'' if hi_c > lo_c else ' (no variation: neutral 50)'}."
                ),
            ),
            FactorScore(
                key="financial", label=FACTOR_LABELS["financial"],
                score=fin, weight=weights_used["financial"],
                input_value=round(s.annual_usd, 2), input_unit="USD/yr",
                explanation=(
                    f"${s.annual_usd:,.0f}/yr vs set range ${lo_u:,.0f}-${hi_u:,.0f}; "
                    f"min-max normalized{'' if hi_u > lo_u else ' (no variation: neutral 50)'}."
                ),
            ),
            FactorScore(
                key="people", label=FACTOR_LABELS["people"],
                score=people, weight=weights_used["people"],
                input_value=round(s.people, 1), input_unit="people",
                explanation=(
                    f"{s.people:,.0f} people vs set range {lo_p:,.0f}-{hi_p:,.0f}; "
                    f"min-max normalized{'' if hi_p > lo_p else ' (no variation: neutral 50)'}."
                ),
            ),
            FactorScore(
                key="feasibility", label=FACTOR_LABELS["feasibility"],
                score=feasibility, weight=weights_used["feasibility"],
                input_value=None, input_unit="0-100",
                explanation=(
                    f"100 x (0.6 x confidence {confidence:.2f} + 0.4 x (1 - {timeline:g}/"
                    f"{REFERENCE_TIMELINE_MONTHS:g} mo timeline)). Absolute formula, not relative."
                ),
            ),
            FactorScore(
                key="cost_efficiency", label=FACTOR_LABELS["cost_efficiency"],
                score=cost_eff, weight=weights_used["cost_efficiency"],
                input_value=round(ratio, 2), input_unit="lifetime USD per 1 USD",
                explanation=(
                    f"${s.annual_usd:,.0f}/yr x {REFERENCE_PAYBACK_YEARS:g} yrs / "
                    f"${s.cost_usd:,.0f} = {ratio:.2f}; min-max normalized across set."
                ),
            ),
            FactorScore(
                key="evidence_quality", label=FACTOR_LABELS["evidence_quality"],
                score=ev_score, weight=weights_used["evidence_quality"],
                input_value=round(ev_q, 2), input_unit="0-1 score",
                explanation=(
                    f"Assessed evidence score {ev_q:.2f} x 100 (source: {s.evidence_source}). "
                    "Absolute scale, not relative."
                ),
            ),
        ]
        overall = round(sum(f.score * f.weight for f in factors) / 100, 1)
        ranked.append({"name": s.name, "overall": overall, "factors": factors})

    ranked.sort(key=lambda r: r["overall"], reverse=True)
    for i, r in enumerate(ranked):
        r["rank"] = i + 1

    return {
        "framework": {
            "name": FRAMEWORK_NAME,
            "version": FRAMEWORK_VERSION,
            "note": FRAMEWORK_NOTE,
        },
        "weights_used": weights_used,
        "scenarios": [
            {
                "name": r["name"],
                "rank": r["rank"],
                "overall": r["overall"],
                "factors": [
                    {
                        "key": f.key, "label": f.label, "score": f.score,
                        "weight": f.weight, "input_value": f.input_value,
                        "input_unit": f.input_unit, "explanation": f.explanation,
                    }
                    for f in r["factors"]
                ],
            }
            for r in ranked
        ],
        "assumptions": [
            "Relative factors (environmental, financial, people, cost efficiency) use min-max "
            "normalization across this scored set only; scores are not comparable across runs.",
            f"Feasibility = 100 x (0.6 x confidence + 0.4 x (1 - timeline/{REFERENCE_TIMELINE_MONTHS:g} mo)).",
            f"Cost efficiency uses a {REFERENCE_PAYBACK_YEARS:g}-year savings horizon per 1 USD invested.",
            "Evidence quality is an assessed 0-1 input, shown as-is (x100).",
            FRAMEWORK_NOTE,
        ],
    }

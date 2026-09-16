"""Deterministic verification engine (no LLM, no web calls).

Six checks over an analysis' stored data. Statuses:
- ``pass``    — check ran, nothing wrong found
- ``warning`` — check ran, found issues or missing information
- ``fail``    — check found a contradiction or structural defect

Overall: FAIL if any check fails, PASS WITH WARNINGS if any warns,
otherwise PASS. These checks validate internal consistency and provenance —
they do NOT verify real-world truth, and nothing is reported as "verified"
unless its checks actually ran (see ``checked`` per check).
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field

ENGINE_VERSION = "1.0"

KNOWN_UNITS = {
    "kwh/year", "kwh", "usd/year", "usd", "$/kwh",
    "metric tons co2/year", "t co2/yr", "tons co2/year",
    "years", "year", "months", "%", "percent", "people",
    "score", "ratio", "multiplier",
}


@dataclass
class CheckResult:
    key: str
    label: str
    status: str  # pass | warning | fail
    checked: bool
    summary: str
    details: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    missing: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "key": self.key, "label": self.label, "status": self.status,
            "checked": self.checked, "summary": self.summary,
            "details": self.details, "warnings": self.warnings,
            "missing": self.missing,
        }


def _is_finite(value) -> bool:
    return isinstance(value, (int, float)) and math.isfinite(value)


def check_evidence_availability(solutions: list[dict], evidence: list[dict]) -> CheckResult:
    if not evidence:
        return CheckResult(
            key="evidence_availability", label="Evidence availability",
            status="fail", checked=True,
            summary="No evidence items collected for this analysis.",
            missing=["No evidence items collected for this analysis"],
        )
    sol_ids = {s.get("id") for s in solutions}
    linked: dict = {s.get("id"): 0 for s in solutions}
    unattributed = 0
    for e in evidence:
        sid = e.get("solution_id")
        if sid in linked:
            linked[sid] += 1
        else:
            unattributed += 1
    uncovered = [s.get("name", f"#{s.get('id')}") for s in solutions if linked.get(s.get("id"), 0) == 0]
    if not uncovered:
        return CheckResult(
            key="evidence_availability", label="Evidence availability",
            status="pass", checked=True,
            summary=f"{len(evidence)} evidence items cover all {len(solutions)} interventions.",
            details=[f"{len(evidence)} items across {len(solutions)} interventions"],
        )
    if unattributed:
        return CheckResult(
            key="evidence_availability", label="Evidence availability",
            status="warning", checked=True,
            summary=f"{unattributed} evidence items are not attributed to a specific intervention.",
            warnings=[f"'{name}' has no directly linked evidence" for name in uncovered],
            missing=[f"Attribution for {unattributed} unattributed evidence items"],
        )
    return CheckResult(
        key="evidence_availability", label="Evidence availability",
        status="warning", checked=True,
        summary=f"{len(uncovered)} of {len(solutions)} interventions have no linked evidence.",
        warnings=[f"'{name}' has no linked evidence" for name in uncovered],
        missing=[f"Evidence for: {', '.join(uncovered)}"],
    )


def check_source_references(evidence: list[dict]) -> CheckResult:
    if not evidence:
        return CheckResult(
            key="source_references", label="Source references",
            status="warning", checked=True,
            summary="No evidence to check references for.",
            missing=["No evidence items to reference-check"],
        )
    failures, warnings, missing, sourced = [], [], [], 0
    for e in evidence:
        src = (e.get("source") or "").strip()
        if not src or not (e.get("claim") or "").strip():
            failures.append(f"Evidence #{e.get('id', '?')} has an empty source or claim")
            continue
        if e.get("is_demo"):
            warnings.append(f"'{src}' is demo-labeled: illustration, not citable")
            continue
        if not (e.get("url") or "").strip():
            failures.append(f"'{src}' is presented as sourced but has no retrievable URL")
            missing.append(f"Retrievable URL for '{src}'")
        else:
            sourced += 1
        if not (e.get("published_date") or ""):
            warnings.append(f"'{src}' has no publication date")
            missing.append(f"Publication date for '{src}'")
    if failures:
        return CheckResult(
            key="source_references", label="Source references",
            status="fail", checked=True,
            summary=f"{len(failures)} reference problem(s) found.",
            details=[f"{sourced} sourced items have retrievable URLs"] if sourced else [],
            warnings=warnings, missing=missing,
        )
    if warnings:
        return CheckResult(
            key="source_references", label="Source references",
            status="warning", checked=True,
            summary=f"{sourced} sourced items OK; {len(warnings)} advisory note(s).",
            warnings=warnings, missing=missing,
        )
    return CheckResult(
        key="source_references", label="Source references",
        status="pass", checked=True,
        summary=f"All {sourced} sourced items have retrievable URLs.",
    )


def check_calculation_consistency(estimates: list[dict]) -> CheckResult:
    if not estimates:
        return CheckResult(
            key="calculation_consistency", label="Calculation consistency",
            status="warning", checked=True,
            summary="No estimates to consistency-check.",
            missing=["No impact estimates produced yet"],
        )
    failures, warnings, missing, ok = [], [], [], 0
    for e in estimates:
        label = e.get("label", f"#{e.get('id', '?')}")
        value = e.get("value")
        if not _is_finite(value):
            failures.append(f"'{label}' has a non-numeric value ({value})")
            continue
        if value < 0:
            warnings.append(f"'{label}' is negative ({value}) — confirm this is intended")
        lo, hi = e.get("low_bound"), e.get("high_bound")
        if lo is None or hi is None:
            warnings.append(f"'{label}' has no uncertainty bounds")
            missing.append(f"Low/high bounds for '{label}'")
        elif not (lo <= value <= hi):
            failures.append(
                f"'{label}' value {value} lies outside its bounds [{lo}, {hi}]"
            )
        else:
            ok += 1
    if failures:
        return CheckResult(
            key="calculation_consistency", label="Calculation consistency",
            status="fail", checked=True,
            summary=f"{len(failures)} inconsistenc(ies) found across {len(estimates)} estimates.",
            warnings=warnings, missing=missing,
        )
    if warnings:
        return CheckResult(
            key="calculation_consistency", label="Calculation consistency",
            status="warning", checked=True,
            summary=f"{ok} of {len(estimates)} estimates fully within bounds; advisories remain.",
            warnings=warnings, missing=missing,
        )
    return CheckResult(
        key="calculation_consistency", label="Calculation consistency",
        status="pass", checked=True,
        summary=f"All {len(estimates)} estimates within their stated bounds.",
    )


def check_units(estimates: list[dict]) -> CheckResult:
    if not estimates:
        return CheckResult(
            key="units", label="Units",
            status="warning", checked=True,
            summary="No estimates to check units for.",
            missing=["No impact estimates produced yet"],
        )
    failures, warnings, missing = [], [], []
    for e in estimates:
        label = e.get("label", f"#{e.get('id', '?')}")
        unit = (e.get("unit") or "").strip()
        if not unit:
            failures.append(f"'{label}' has no unit")
            missing.append(f"Unit for '{label}'")
        elif unit.lower() not in KNOWN_UNITS:
            warnings.append(f"'{label}' uses unrecognized unit '{unit}' — confirm it is correct")
    if failures:
        return CheckResult(
            key="units", label="Units",
            status="fail", checked=True,
            summary=f"{len(failures)} estimate(s) missing units.",
            warnings=warnings, missing=missing,
        )
    if warnings:
        return CheckResult(
            key="units", label="Units",
            status="warning", checked=True,
            summary="All estimates have units; some are unrecognized.",
            warnings=warnings, missing=missing,
        )
    return CheckResult(
        key="units", label="Units",
        status="pass", checked=True,
        summary=f"All {len(estimates)} estimates carry recognized units.",
    )


def check_assumptions(solutions: list[dict], estimates: list[dict]) -> CheckResult:
    warnings, missing = [], []
    for e in estimates:
        if not e.get("assumptions"):
            label = e.get("label", f"#{e.get('id', '?')}")
            warnings.append(f"Estimate '{label}' discloses no assumptions")
            missing.append(f"Assumptions for estimate '{label}'")
    for s in solutions:
        if not s.get("assumptions"):
            warnings.append(f"Intervention '{s.get('name', s.get('id'))}' discloses no assumptions")
            missing.append(f"Assumptions for '{s.get('name', s.get('id'))}'")
    if warnings:
        return CheckResult(
            key="assumptions", label="Assumptions",
            status="warning", checked=True,
            summary=f"{len(warnings)} assumption gap(s) found.",
            warnings=warnings, missing=missing,
        )
    total = len(estimates) + len(solutions)
    return CheckResult(
        key="assumptions", label="Assumptions",
        status="pass", checked=True,
        summary=f"All {total} estimates and interventions disclose assumptions.",
    )


def check_recommendation_consistency(
    solutions: list[dict], comparison: dict | None
) -> CheckResult:
    names = {str(s.get("name", "")).lower(): s.get("name", "") for s in solutions}
    ids = {s.get("id") for s in solutions}
    if not comparison:
        return CheckResult(
            key="recommendation_consistency", label="Recommendation consistency",
            status="warning", checked=True,
            summary="No comparison produced yet — nothing to check the recommendation against.",
            missing=["Decision comparison (rankings + recommendation)"],
        )
    rankings = comparison.get("rankings") or []
    recommendation = (comparison.get("recommendation") or "").strip()
    rationale = (comparison.get("rationale") or "").strip()
    failures, warnings, missing = [], [], []
    if not rankings:
        warnings.append("Comparison has no rankings")
        missing.append("Ranked alternatives in the comparison")
    else:
        for r in rankings:
            rname = str(r.get("name", ""))
            if rname.lower() not in names and r.get("solution_id") not in ids:
                failures.append(f"Ranking references unknown intervention '{rname}'")
    if not recommendation:
        warnings.append("Comparison has no recommendation text")
        missing.append("Recommendation text")
    if not rationale:
        warnings.append("Comparison has no rationale")
        missing.append("Rationale for the recommendation")
    top_name = ""
    if rankings:
        top = sorted(rankings, key=lambda r: r.get("overall_score", 0), reverse=True)[0]
        top_name = str(top.get("name", ""))
    if recommendation and top_name:
        rec_low = recommendation.lower()
        if top_name.lower() not in rec_low and rec_low not in top_name.lower():
            warnings.append(
                f"Recommendation does not name the top-ranked intervention '{top_name}' — confirm alignment"
            )
        for sol_name in names.values():
            if sol_name.lower() in rec_low and sol_name.lower() not in {n.lower() for n in [r.get("name", "") for r in rankings]}:
                failures.append(f"Recommendation references '{sol_name}', which is not a ranked alternative")
    if failures:
        return CheckResult(
            key="recommendation_consistency", label="Recommendation consistency",
            status="fail", checked=True,
            summary=f"{len(failures)} reference contradiction(s) in the recommendation.",
            warnings=warnings, missing=missing,
        )
    if warnings:
        return CheckResult(
            key="recommendation_consistency", label="Recommendation consistency",
            status="warning", checked=True,
            summary="Comparison exists; alignment advisories remain.",
            warnings=warnings, missing=missing,
        )
    return CheckResult(
        key="recommendation_consistency", label="Recommendation consistency",
        status="pass", checked=True,
        summary=f"Recommendation aligns with top-ranked '{top_name}' and all references resolve.",
    )


def run_verification(payload: dict) -> dict:
    solutions = payload.get("solutions", [])
    estimates = payload.get("estimates", [])
    evidence = payload.get("evidence", [])
    comparison = payload.get("comparison")

    checks = [
        check_evidence_availability(solutions, evidence),
        check_source_references(evidence),
        check_calculation_consistency(estimates),
        check_units(estimates),
        check_assumptions(solutions, estimates),
        check_recommendation_consistency(solutions, comparison),
    ]
    statuses = [c.status for c in checks]
    overall = "fail" if "fail" in statuses else ("warning" if "warning" in statuses else "pass")
    return {
        "engine": {"name": "Impactus Verification Engine", "version": ENGINE_VERSION},
        "overall": overall,
        "overall_label": {"pass": "PASS", "warning": "PASS WITH WARNINGS", "fail": "FAIL"}[overall],
        "counts": {
            "pass": statuses.count("pass"),
            "warning": statuses.count("warning"),
            "fail": statuses.count("fail"),
        },
        "checks": [c.to_dict() for c in checks],
        "all_warnings": [w for c in checks for w in c.warnings],
        "all_missing": [m for c in checks for m in c.missing],
        "scope": {
            "solutions": len(solutions),
            "estimates": len(estimates),
            "evidence": len(evidence),
            "comparison": comparison is not None,
        },
        "disclaimer": (
            "These checks validate internal consistency and provenance of AI-generated "
            "results. They do not verify real-world truth. Nothing is reported as verified "
            "unless its checks actually ran — see each check's 'checked' flag."
        ),
    }

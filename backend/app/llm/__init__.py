import json
import httpx
from app.config import settings


async def llm_complete(
    system_prompt: str,
    user_prompt: str,
    response_format: dict | None = None,
) -> dict | str:
    if not settings.LLM_API_KEY:
        return _fallback_response(system_prompt, user_prompt)

    headers = {
        "Authorization": f"Bearer {settings.LLM_API_KEY}",
        "Content-Type": "application/json",
    }

    body: dict = {
        "model": settings.LLM_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.3,
    }

    if response_format:
        body["response_format"] = response_format

    base_url = settings.LLM_BASE_URL or "https://api.openai.com/v1"

    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            f"{base_url}/chat/completions",
            headers=headers,
            json=body,
        )
        resp.raise_for_status()
        data = resp.json()

    content = data["choices"][0]["message"]["content"]

    if response_format and response_format.get("type") == "json_object":
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            return {"raw": content}

    return content


def _fallback_response(system_prompt: str, user_prompt: str) -> dict:
    lower = system_prompt.lower() + "\n" + user_prompt.lower()

    # Match on distinctive user-prompt phrases first (agent-specific).
    # Generic keyword matching breaks because prompts reference each other
    # (e.g. the solution prompt mentions "root causes").
    if "identify the root causes" in lower:
        return {
            "root_causes": [
                {
                    "description": "Outdated lighting infrastructure using incandescent and fluorescent fixtures",
                    "confidence": 0.85,
                    "evidence": ["Industry standard lighting audits show 30-50% savings from LED conversion"],
                },
                {
                    "description": "Inefficient HVAC scheduling with no occupancy-based controls",
                    "confidence": 0.80,
                    "evidence": ["HVAC typically accounts for 40-60% of campus energy usage"],
                },
                {
                    "description": "Lack of real-time energy monitoring and accountability systems",
                    "confidence": 0.70,
                    "evidence": ["Smart metering programs typically reduce consumption by 5-15%"],
                },
            ]
        }

    if "generate practical intervention" in lower:
        # Demo interventions for campus electricity optimization. All figures
        # are planning estimates with disclosed assumptions — not quotes,
        # not measured results, not research findings.
        return {
            "solutions": [
                {
                    "name": "LED Lighting Retrofit",
                    "description": "Replace all incandescent and fluorescent lighting with LED fixtures across campus buildings",
                    "solution_type": "technology_upgrade",
                    "estimated_cost": 250000,
                    "estimated_timeline_months": 6,
                    "confidence": 0.9,
                    "difficulty": "low",
                    "expected_effect": "Estimated 60% reduction in lighting electricity load (estimate, verify with audit)",
                    "assumptions": [
                        "Lighting is an estimated 15% of campus load — confirm with sub-metering",
                        "Cost estimate assumes standard commercial fixtures at bulk pricing, not a vendor quote",
                        "No rebate or incentive income included",
                    ],
                    "risks": [
                        "Actual lighting share of load may differ from the estimate",
                        "Supply-chain delays for fixtures",
                        "Disruption to classes during installation",
                    ],
                },
                {
                    "name": "HVAC Smart Controls",
                    "description": "Install occupancy sensors and programmable thermostats with AI-driven scheduling",
                    "solution_type": "technology_upgrade",
                    "estimated_cost": 180000,
                    "estimated_timeline_months": 8,
                    "confidence": 0.85,
                    "difficulty": "medium",
                    "expected_effect": "Estimated 12% reduction in HVAC electricity load (estimate, verify with BMS trends)",
                    "assumptions": [
                        "HVAC is an estimated 50% of campus load — confirm with BMS trend logs",
                        "Cost estimate assumes retrofit of existing controls, not full replacement",
                        "Occupancy patterns assumed stable year over year",
                    ],
                    "risks": [
                        "Legacy BMS may need upgrades not included in the estimate",
                        "Occupant comfort complaints during tuning",
                        "Savings depend on enforcement of schedules",
                    ],
                },
                {
                    "name": "Smart Building Scheduling",
                    "description": "Implement centralized scheduling system to optimize building usage hours and reduce idle consumption",
                    "solution_type": "operational",
                    "estimated_cost": 50000,
                    "estimated_timeline_months": 3,
                    "confidence": 0.75,
                    "difficulty": "low",
                    "expected_effect": "Estimated 8% reduction in non-HVAC, non-lighting loads (estimate, verify with meter data)",
                    "assumptions": [
                        "Miscellaneous loads are an estimated 35% of campus load",
                        "Cost estimate covers software and coordination time only",
                        "Departments assumed cooperative with consolidated hours",
                    ],
                    "risks": [
                        "Departmental resistance to schedule changes",
                        "Savings erode if exceptions become routine",
                    ],
                },
                {
                    "name": "Solar Panel Installation",
                    "description": "Install photovoltaic panels on rooftops and parking structures to offset grid electricity",
                    "solution_type": "renewable_energy",
                    "estimated_cost": 800000,
                    "estimated_timeline_months": 18,
                    "confidence": 0.80,
                    "difficulty": "high",
                    "expected_effect": "Estimated offset of grid electricity subject to site survey (estimate only)",
                    "assumptions": [
                        "Cost estimate is a planning figure, not a vendor quote — requires site survey",
                        "Roof condition, shading, and interconnection capacity not yet assessed",
                        "No tax-credit or incentive income included",
                    ],
                    "risks": [
                        "Roof structural or shading constraints may reduce viable capacity",
                        "Permitting and interconnection timelines vary",
                        "Highest upfront cost of all options",
                    ],
                },
            ]
        }

    if "research relevant evidence" in lower:
        # Defense in depth: the ResearchAgent now uses the research service,
        # but any legacy caller hitting this fallback must still never receive
        # citations that look real. Demo-only, no URLs or dates.
        return {
            "evidence": [
                {
                    "source": "DEMO — Illustrative example (not a real citation)",
                    "claim": "Demo placeholder: replace with evidence from a configured research provider.",
                    "confidence": 0.3,
                    "quality": "low",
                    "quality_score": 0.3,
                    "gaps": ["No live research provider configured"],
                    "is_demo": True,
                    "url": None,
                    "published_date": None,
                },
            ]
        }

    if "verify these estimates" in lower:
        return {
            "verified_estimates": [],
            "evidence_quality": [],
            "assumption_check": [],
            "overall_confidence": 0.82,
            "warnings": ["Fallback demo data in use — connect an LLM provider for live verification."],
        }

    if "compare these solutions" in lower:
        return {
            "rankings": [
                {
                    "solution_id": 1,
                    "name": "LED Lighting Retrofit",
                    "overall_score": 88,
                    "cost_score": 85,
                    "impact_score": 90,
                    "feasibility_score": 95,
                    "timeline_score": 90,
                },
                {
                    "solution_id": 2,
                    "name": "HVAC Smart Controls",
                    "overall_score": 82,
                    "cost_score": 78,
                    "impact_score": 85,
                    "feasibility_score": 80,
                    "timeline_score": 75,
                },
                {
                    "solution_id": 3,
                    "name": "Smart Building Scheduling",
                    "overall_score": 75,
                    "cost_score": 95,
                    "impact_score": 60,
                    "feasibility_score": 85,
                    "timeline_score": 95,
                },
                {
                    "solution_id": 4,
                    "name": "Solar Panel Installation",
                    "overall_score": 70,
                    "cost_score": 40,
                    "impact_score": 95,
                    "feasibility_score": 55,
                    "timeline_score": 35,
                },
            ],
            "recommendation": "LED Lighting Retrofit offers the best balance of cost, impact, and feasibility for immediate implementation.",
            "rationale": "High confidence in projected savings, proven technology, shortest payback period, and minimal operational disruption.",
        }

    if "create a detailed implementation" in lower:
        # Demo phased plan with generic roles. Timelines are estimates.
        phases = [
            {
                "order": 1, "name": "Audit",
                "objective": "Measure the baseline and confirm the intervention scope.",
                "duration_weeks": 4,
                "tasks": [
                    {"id": "task-1-1", "title": "Conduct baseline audit",
                     "description": "Survey buildings and collect meter data to confirm the baseline",
                     "role": "Facilities Manager", "dependencies": [],
                     "resources": ["Metering equipment", "Building access"], "duration_weeks": 2},
                    {"id": "task-1-2", "title": "Confirm scope and success criteria",
                     "description": "Agree scope, metrics, and decision gates with the sponsor",
                     "role": "Project Sponsor", "dependencies": ["Conduct baseline audit"],
                     "resources": ["Audit report"], "duration_weeks": 2},
                ],
            },
            {
                "order": 2, "name": "Pilot",
                "objective": "Prove the approach on a small scale before full rollout.",
                "duration_weeks": 6,
                "tasks": [
                    {"id": "task-2-1", "title": "Select pilot site and procure",
                     "description": "Choose one representative building and issue a small procurement",
                     "role": "Project Manager", "dependencies": ["Confirm scope and success criteria"],
                     "resources": ["Procurement budget"], "duration_weeks": 2},
                    {"id": "task-2-2", "title": "Install pilot and measure",
                     "description": "Install in the pilot site and compare metered savings to estimates",
                     "role": "Contractor / Vendor", "dependencies": ["Select pilot site and procure"],
                     "resources": ["Sub-metering"], "duration_weeks": 4},
                ],
            },
            {
                "order": 3, "name": "Deployment",
                "objective": "Roll out across all in-scope buildings.",
                "duration_weeks": 12,
                "tasks": [
                    {"id": "task-3-1", "title": "Phase rollout by building",
                     "description": "Deploy building by building, starting with highest usage",
                     "role": "Facilities Manager", "dependencies": ["Install pilot and measure"],
                     "resources": ["Installation crews", "Building access schedule"], "duration_weeks": 10},
                    {"id": "task-3-2", "title": "Track spend vs budget",
                     "description": "Reconcile actual spend against the estimated budget monthly",
                     "role": "Finance Lead", "dependencies": ["Phase rollout by building"],
                     "resources": ["Budget tracker"], "duration_weeks": 2},
                ],
            },
            {
                "order": 4, "name": "Measurement",
                "objective": "Verify savings and hand over to operations.",
                "duration_weeks": 4,
                "tasks": [
                    {"id": "task-4-1", "title": "Verify and report savings",
                     "description": "Compare 3 months of metered data to the baseline and publish results",
                     "role": "Project Manager", "dependencies": ["Track spend vs budget"],
                     "resources": ["Meter data", "Report template"], "duration_weeks": 3},
                    {"id": "task-4-2", "title": "Hand over to operations",
                     "description": "Document maintenance and monitoring responsibilities",
                     "role": "Occupant Representative", "dependencies": ["Verify and report savings"],
                     "resources": ["O&M manual"], "duration_weeks": 1},
                ],
            },
        ]
        flat = [t for p in phases for t in p["tasks"]]
        return {
            "phases": phases,
            "timeline_months": 6,
            "resources": ["Facilities team (2 FTE)", "Electrical contractor", "Lighting vendor", "Project manager"],
            "success_metrics": [
                "Metered kWh reduction vs baseline (%)",
                "Actual spend vs estimated budget (%)",
                "Milestone completion on schedule (%)",
            ],
            "risk_register": [
                {"risk": "Supply chain delays for equipment",
                 "mitigation": "Order long-lead items during the Audit phase"},
                {"risk": "Disruption to classes during installation",
                 "mitigation": "Schedule work outside teaching hours per building"},
                {"risk": "Actual savings differ from estimates",
                 "mitigation": "Gate full deployment on pilot measurement results"},
            ],
            "steps": [
                {"order": n + 1, "title": t["title"], "description": t["description"],
                 "duration_weeks": t["duration_weeks"]}
                for n, t in enumerate(flat)
            ],
            "risks": ["Supply chain delays for equipment", "Disruption to classes during installation", "Actual savings differ from estimates"],
        }

    if "estimate the impact" in lower:
        return {
            "estimates": [
                {
                    "category": "energy",
                    "label": "Annual kWh Reduction",
                    "value": 450000,
                    "unit": "kWh/year",
                    "is_estimate": 1,
                    "assumptions": ["Based on 12-month baseline of 2M kWh/year", "LED savings assumes 60% reduction in lighting load", "Industry average applied"],
                    "low_bound": 350000,
                    "high_bound": 550000,
                },
                {
                    "category": "financial",
                    "label": "Annual Cost Savings",
                    "value": 54000,
                    "unit": "USD/year",
                    "is_estimate": 1,
                    "assumptions": ["Electricity rate of $0.12/kWh", "Does not include maintenance savings", "Simple payback calculation"],
                    "low_bound": 42000,
                    "high_bound": 66000,
                },
                {
                    "category": "environmental",
                    "label": "CO2 Reduction",
                    "value": 180,
                    "unit": "metric tons CO2/year",
                    "is_estimate": 1,
                    "assumptions": ["EPA eGRID national average emission factor: 0.4 kg CO2/kWh", "Scope 2 indirect emissions only"],
                    "low_bound": 140,
                    "high_bound": 220,
                },
                {
                    "category": "financial",
                    "label": "Simple Payback Period",
                    "value": 4.6,
                    "unit": "years",
                    "is_estimate": 1,
                    "assumptions": ["Upfront cost $250,000", "Annual savings $54,000", "No discount rate applied", "Excludes incentive rebates"],
                    "low_bound": 3.8,
                    "high_bound": 6.0,
                },
            ]
        }

    return {"message": "No specific handler matched. Provide a general response."}

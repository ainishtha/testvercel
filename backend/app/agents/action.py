from app.agents import BaseAgent, AgentResult
from app.llm import llm_complete

GENERIC_ROLES = [
    "Project Sponsor", "Project Manager", "Facilities Manager",
    "Contractor / Vendor", "Finance Lead", "Occupant Representative",
]

PHASE_NAMES = ["Audit", "Pilot", "Deployment", "Measurement"]


class ActionAgent(BaseAgent):
    name = "action"
    description = "Creates phased implementation plans for selected solutions"

    SYSTEM_PROMPT = """You are an implementation planning expert for campus projects.
Given a selected solution and its analysis, create a phased action plan.
Use generic roles only (Project Sponsor, Project Manager, Facilities Manager,
Contractor / Vendor, Finance Lead, Occupant Representative) unless the prompt
provides actual organizational details.

Return JSON with:
- "phases": array of 4 phases named Audit, Pilot, Deployment, Measurement.
  Each phase has: order (int), name (string), objective (string),
  duration_weeks (int), and "tasks" array.
  Each task has: title, description, role (generic role), dependencies
  (list of task titles it waits on), resources (list[string]), duration_weeks (int).
- "timeline_months": int total horizon
- "resources": list[string] of overall required resources
- "success_metrics": list[string] of measurable success criteria with units
- "risk_register": array of {risk, mitigation}

Tasks must be concrete, actionable, and ordered chronologically. Every risk
needs a mitigation. Timelines are estimates."""

    async def run(self, context: dict) -> AgentResult:
        solution = context.get("selected_solution", {})
        estimates = context.get("estimates", [])

        est_text = "\n".join(
            f"- {e.get('label', '')}: {e.get('value', 0)} {e.get('unit', '')}"
            for e in estimates
        )

        user_prompt = (
            f"Selected Solution: {solution.get('name', '')}\n"
            f"Description: {solution.get('description', '')}\n"
            f"Estimated Cost: ${solution.get('estimated_cost', 0):,.0f}\n"
            f"Timeline: {solution.get('estimated_timeline_months', 0)} months\n\n"
            f"Impact Estimates:\n{est_text}\n\n"
            "Create a detailed implementation action plan."
        )

        try:
            result = await llm_complete(self.SYSTEM_PROMPT, user_prompt)
            if isinstance(result, dict):
                return AgentResult(success=True, data=normalize_plan(result))
            return AgentResult(success=True, data=normalize_plan({}))
        except Exception as e:
            return self._error_result(str(e))


def normalize_plan(data: dict) -> dict:
    """Accept phased or legacy step output; always return the phased shape.

    Legacy ``steps`` output is wrapped into a single Deployment phase so old
    callers and stored rows keep working.
    """
    phases = data.get("phases") or []
    if not phases and data.get("steps"):
        phases = [{
            "order": 1, "name": "Deployment",
            "objective": "Execute the intervention.",
            "duration_weeks": sum(s.get("duration_weeks", 0) for s in data["steps"]),
            "tasks": [
                {
                    "title": s.get("title", ""),
                    "description": s.get("description", ""),
                    "role": "Project Manager",
                    "dependencies": [],
                    "resources": [],
                    "duration_weeks": s.get("duration_weeks", 0),
                }
                for s in data["steps"]
            ],
        }]
    norm_phases = []
    for i, p in enumerate(phases):
        tasks = []
        for j, t in enumerate(p.get("tasks", [])):
            tasks.append({
                "id": t.get("id") or f"task-{i + 1}-{j + 1}",
                "title": t.get("title", ""),
                "description": t.get("description", ""),
                "role": t.get("role") or "Project Manager",
                "dependencies": t.get("dependencies", []) or [],
                "resources": t.get("resources", []) or [],
                "duration_weeks": t.get("duration_weeks", 0) or 0,
            })
        norm_phases.append({
            "order": p.get("order", i + 1),
            "name": p.get("name", PHASE_NAMES[i] if i < len(PHASE_NAMES) else f"Phase {i + 1}"),
            "objective": p.get("objective", ""),
            "duration_weeks": p.get("duration_weeks", 0) or 0,
            "tasks": tasks,
        })

    risks = data.get("risk_register") or []
    norm_risks = [
        {"risk": r.get("risk", r) if isinstance(r, dict) else r,
         "mitigation": r.get("mitigation", "") if isinstance(r, dict) else ""}
        for r in (risks or data.get("risks", []) or [])
    ]
    return {
        "phases": norm_phases,
        "timeline_months": data.get("timeline_months", 0) or 0,
        "resources": data.get("resources", []) or [],
        "success_metrics": data.get("success_metrics", []) or [],
        "risk_register": norm_risks,
        # Legacy views, auto-derived for backward compatibility.
        "steps": [
            {"order": n + 1, "title": t["title"], "description": t["description"],
             "duration_weeks": t["duration_weeks"]}
            for n, t in enumerate([t for p in norm_phases for t in p["tasks"]])
        ],
        "risks": [r["risk"] for r in norm_risks],
    }

from app.agents import BaseAgent, AgentResult
from app.verification import run_verification


class VerificationAgent(BaseAgent):
    name = "verification"
    description = "Runs deterministic verification checks (single source of truth with the dashboard)"

    async def run(self, context: dict) -> AgentResult:
        # Same engine as GET /api/verification/{id}; here inputs come from the
        # pipeline context (estimates/evidence not yet attributed to solutions).
        try:
            report = run_verification({
                "solutions": [
                    {"id": s.get("id"), "name": s.get("name", ""),
                     "assumptions": s.get("assumptions", [])}
                    for s in context.get("solutions", [])
                ],
                "estimates": [
                    {"id": i, "solution_id": e.get("solution_id"),
                     "label": e.get("label", ""), "value": e.get("value"),
                     "unit": e.get("unit", ""), "low_bound": e.get("low_bound"),
                     "high_bound": e.get("high_bound"),
                     "assumptions": e.get("assumptions", [])}
                    for i, e in enumerate(context.get("estimates", []))
                ],
                "evidence": [
                    {"id": i, "solution_id": e.get("solution_id"),
                     "source": e.get("source", e.get("source_title", "")),
                     "claim": e.get("claim", ""), "url": e.get("url"),
                     "published_date": e.get("published_date"),
                     "is_demo": bool(e.get("is_demo"))}
                    for i, e in enumerate(context.get("evidence", []))
                ],
                "comparison": context.get("comparison"),
            })
            return AgentResult(success=True, data=report)
        except Exception as e:
            return self._error_result(str(e))

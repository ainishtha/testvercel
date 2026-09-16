from app.agents import BaseAgent, AgentResult
from app.llm import llm_complete


class ImpactAgent(BaseAgent):
    name = "impact"
    description = "Estimates consequences and impact of solutions"

    SYSTEM_PROMPT = """You are an impact estimation expert for sustainability projects.
Given solutions, estimate their environmental, financial, and operational impact.
Return JSON with an "estimates" array. Each item has:
- category (string): "energy", "financial", "environmental", or "operational"
- label (string): descriptive metric name
- value (float): estimated value
- unit (string): unit of measurement
- is_estimate (int): always 1
- assumptions (list[string]): all assumptions behind this number
- low_bound (float): conservative estimate
- high_bound (float): optimistic estimate

All projections MUST be labeled as estimates. Expose every assumption."""

    async def run(self, context: dict) -> AgentResult:
        solutions = context.get("solutions", [])

        sol_text = "\n".join(
            f"- {s.get('name', '')}: {s.get('description', '')} "
            f"(Cost: ${s.get('estimated_cost', 0):,.0f}, Timeline: {s.get('estimated_timeline_months', 0)} months)"
            for s in solutions
        )

        user_prompt = (
            f"Solutions to analyze:\n{sol_text}\n\n"
            "Estimate the impact of each solution across energy, financial, and environmental dimensions."
        )

        try:
            result = await llm_complete(self.SYSTEM_PROMPT, user_prompt)
            if isinstance(result, dict) and "estimates" in result:
                return AgentResult(success=True, data=result)
            return AgentResult(success=True, data={"estimates": []})
        except Exception as e:
            return self._error_result(str(e))

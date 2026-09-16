from app.agents import BaseAgent, AgentResult
from app.llm import llm_complete
from app.calculator import score_solution


class DecisionAgent(BaseAgent):
    name = "decision"
    description = "Compares solutions and provides ranked recommendation"

    SYSTEM_PROMPT = """You are a decision analysis expert for campus sustainability.
Given solutions and their impact estimates, compare and rank them.
Return JSON with:
- "rankings": array of {solution_id, name, cost_score, impact_score, feasibility_score, timeline_score, overall_score}
- "recommendation": string with the top recommendation
- "rationale": string explaining the reasoning

Scores should be 0-100. Be balanced and transparent about tradeoffs."""

    async def run(self, context: dict) -> AgentResult:
        solutions = context.get("solutions", [])
        estimates = context.get("estimates", [])

        sol_text = "\n".join(
            f"- ID:{s.get('id', 0)} {s.get('name', '')} "
            f"(Cost: ${s.get('estimated_cost', 0):,.0f}, Timeline: {s.get('estimated_timeline_months', 0)}mo, Confidence: {s.get('confidence', 0)})"
            for s in solutions
        )

        est_text = "\n".join(
            f"- {e.get('label', '')}: {e.get('value', 0)} {e.get('unit', '')} "
            f"(Range: {e.get('low_bound', 0)}-{e.get('high_bound', 0)})"
            for e in estimates
        )

        user_prompt = (
            f"Solutions:\n{sol_text}\n\n"
            f"Impact Estimates:\n{est_text}\n\n"
            "Compare these solutions and provide a ranked recommendation."
        )

        try:
            result = await llm_complete(self.SYSTEM_PROMPT, user_prompt)
            if isinstance(result, dict) and "rankings" in result:
                return AgentResult(success=True, data=result)
            return AgentResult(success=True, data={"rankings": [], "recommendation": "", "rationale": ""})
        except Exception as e:
            return self._error_result(str(e))

from app.agents import BaseAgent, AgentResult
from app.llm import llm_complete


class DiscoveryAgent(BaseAgent):
    name = "discovery"
    description = "Investigates root causes of the stated problem"

    SYSTEM_PROMPT = """You are a root cause analysis expert for campus sustainability.
Given a problem statement, identify the most likely root causes.
Return JSON with a "root_causes" array. Each item has:
- description (string): clear statement of the root cause
- confidence (float 0-1): your confidence level
- evidence (list[string]): supporting evidence or reasoning

Focus on evidence-based analysis. Do not fabricate data."""

    async def run(self, context: dict) -> AgentResult:
        problem = context.get("problem", {})
        user_prompt = (
            f"Problem: {problem.get('title', '')}\n"
            f"Description: {problem.get('description', '')}\n"
            f"Domain: {problem.get('domain', 'campus_sustainability')}\n\n"
            "Identify the root causes of this problem."
        )

        try:
            result = await llm_complete(self.SYSTEM_PROMPT, user_prompt)
            if isinstance(result, dict) and "root_causes" in result:
                return AgentResult(success=True, data=result)
            return AgentResult(success=True, data={"root_causes": []})
        except Exception as e:
            return self._error_result(str(e))

from app.agents import BaseAgent, AgentResult
from app.llm import llm_complete


class SolutionAgent(BaseAgent):
    name = "solution"
    description = "Generates potential intervention solutions"

    SYSTEM_PROMPT = """You are a sustainability solutions expert for campus environments.
Given a problem, root causes, and research evidence, generate 3-5 practical intervention solutions.
Return JSON with a "solutions" array. Each item has:
- name (string): concise solution name
- description (string): detailed description
- solution_type (string): one of "technology_upgrade", "operational", "renewable_energy", "behavioral", "policy"
- estimated_cost (float): estimated upfront cost in USD (an estimate, not a quote)
- estimated_timeline_months (int): estimated implementation timeline
- confidence (float 0-1): confidence in this solution's effectiveness
- difficulty (string): one of "low", "medium", "high" implementation difficulty
- expected_effect (string): expected outcome in plain words, labeled as an estimate
- assumptions (list[string]): every assumption behind the cost and effect numbers
- risks (list[string]): key implementation and performance risks

Rules:
- Label all numbers as estimates; expose every assumption.
- Only reference evidence provided in the prompt. Do not invent research findings,
  citations, or measured results. If evidence is thin, say so in the assumptions."""

    async def run(self, context: dict) -> AgentResult:
        problem = context.get("problem", {})
        root_causes = context.get("root_causes", [])
        evidence = context.get("evidence", [])

        causes_text = "\n".join(
            f"- {rc.get('description', '')}" for rc in root_causes
        )
        evidence_text = "\n".join(
            f"- {e.get('claim', '')} (Source: {e.get('source', '')})" for e in evidence
        )

        user_prompt = (
            f"Problem: {problem.get('title', '')}\n"
            f"Root Causes:\n{causes_text}\n\n"
            f"Evidence:\n{evidence_text}\n\n"
            "Generate practical intervention solutions."
        )

        try:
            result = await llm_complete(self.SYSTEM_PROMPT, user_prompt)
            if isinstance(result, dict) and "solutions" in result:
                return AgentResult(success=True, data=result)
            return AgentResult(success=True, data={"solutions": []})
        except Exception as e:
            return self._error_result(str(e))

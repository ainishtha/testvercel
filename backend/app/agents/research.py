from app.agents import BaseAgent, AgentResult
from app.research import get_research_provider


class ResearchAgent(BaseAgent):
    name = "research"
    description = "Collects evidence via the modular research service (never fabricates citations)"

    async def run(self, context: dict) -> AgentResult:
        problem = context.get("problem", {})
        root_causes = context.get("root_causes", [])

        cause_snippets = "; ".join(
            rc.get("description", "") for rc in root_causes[:3]
        )
        query = problem.get("title", "")
        if cause_snippets:
            query = f"{query}. Suspected causes: {cause_snippets}"

        try:
            provider = get_research_provider()
        except ValueError as e:
            return self._error_result(str(e))

        try:
            result = await provider.search(query, {
                "problem": problem,
                "root_causes": root_causes,
            })
        except Exception as e:
            return self._error_result(f"research provider failed: {e}")

        evidence = []
        for item in result.items:
            d = item.to_dict()
            # Legacy aliases kept for downstream consumers (orchestrator, solution agent).
            d["source"] = d["source_title"]
            evidence.append(d)

        return AgentResult(success=True, data={
            "evidence": evidence,
            "provider": result.provider,
            "is_demo": result.is_demo,
            "unavailable": result.unavailable_reason,
            "gaps": result.gaps,
        })

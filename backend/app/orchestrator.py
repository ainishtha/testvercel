import datetime
from sqlalchemy.orm import Session
from app.db import (
    Problem, Analysis, AnalysisStatus, RootCause, Solution,
    ImpactEstimate, Comparison, Evidence, ActionPlan, MonitoringEntry,
)
from app.agents.discovery import DiscoveryAgent
from app.agents.research import ResearchAgent
from app.agents.solution import SolutionAgent
from app.agents.impact import ImpactAgent
from app.agents.decision import DecisionAgent
from app.agents.verification import VerificationAgent
from app.agents.action import ActionAgent
from app.agents.monitoring import MonitoringAgent


class AgentOrchestrator:
    def __init__(self, db: Session):
        self.db = db
        self.discovery = DiscoveryAgent()
        self.research = ResearchAgent()
        self.solution = SolutionAgent()
        self.impact = ImpactAgent()
        self.decision = DecisionAgent()
        self.verification = VerificationAgent()
        self.action = ActionAgent()
        self.monitoring = MonitoringAgent()

    async def run_full_analysis(self, analysis_id: int) -> dict:
        analysis = self.db.query(Analysis).filter(Analysis.id == analysis_id).first()
        if not analysis:
            return {"error": "Analysis not found"}

        problem = self.db.query(Problem).filter(Problem.id == analysis.problem_id).first()
        context = {"problem": {"title": problem.title, "description": problem.description, "domain": problem.domain}}

        try:
            self._update_status(analysis, AnalysisStatus.DISCOVERING)
            discovery_result = await self.discovery.run(context)
            root_causes = discovery_result.data.get("root_causes", [])
            self._save_root_causes(analysis.id, root_causes)
            context["root_causes"] = root_causes

            self._update_status(analysis, AnalysisStatus.RESEARCHING)
            research_result = await self.research.run(context)
            evidence_list = research_result.data.get("evidence", [])
            context["evidence"] = evidence_list

            self._update_status(analysis, AnalysisStatus.GENERATING_SOLUTIONS)
            solution_result = await self.solution.run(context)
            solutions = solution_result.data.get("solutions", [])
            saved_solutions = self._save_solutions(analysis.id, solutions)
            context["solutions"] = [
                {"id": s.id, "name": s.name, "description": s.description,
                 "solution_type": s.solution_type, "estimated_cost": s.estimated_cost,
                 "estimated_timeline_months": s.estimated_timeline_months, "confidence": s.confidence,
                 "assumptions": s.assumptions or []}
                for s in saved_solutions
            ]

            self._update_status(analysis, AnalysisStatus.SIMULATING)
            impact_result = await self.impact.run(context)
            estimates = impact_result.data.get("estimates", [])
            saved_estimates = self._save_estimates(saved_solutions, estimates)
            context["estimates"] = [
                {"solution_id": e.solution_id, "label": e.label, "value": e.value, "unit": e.unit,
                 "low_bound": e.low_bound, "high_bound": e.high_bound, "assumptions": e.assumptions}
                for e in saved_estimates
            ]

            self._update_status(analysis, AnalysisStatus.COMPARING)
            decision_result = await self.decision.run(context)
            ranking_data = decision_result.data
            self._save_comparison(analysis.id, ranking_data)

            self._update_status(analysis, AnalysisStatus.VERIFYING)
            verification_context = {
                **context,
                "estimates": context["estimates"],
                "evidence": evidence_list,
                "comparison": {
                    "rankings": ranking_data.get("rankings", []),
                    "recommendation": ranking_data.get("recommendation", ""),
                    "rationale": ranking_data.get("rationale", ""),
                },
            }
            await self.verification.run(verification_context)

            self._update_status(analysis, AnalysisStatus.PLANNING)
            best_solution = saved_solutions[0] if saved_solutions else None
            if best_solution:
                action_context = {
                    "selected_solution": {
                        "id": best_solution.id, "name": best_solution.name,
                        "description": best_solution.description,
                        "estimated_cost": best_solution.estimated_cost,
                        "estimated_timeline_months": best_solution.estimated_timeline_months,
                    },
                    "estimates": context["estimates"],
                }
                action_result = await self.action.run(action_context)
                self._save_action_plan(analysis.id, best_solution.id, action_result.data)

            self._update_status(analysis, AnalysisStatus.REPORTING)
            self._save_evidence(analysis.id, evidence_list)

            analysis.summary = self._build_summary(context, ranking_data)
            self._update_status(analysis, AnalysisStatus.COMPLETED)
            analysis.completed_at = datetime.datetime.utcnow()
            self.db.commit()

            return {"analysis_id": analysis.id, "status": "completed"}

        except Exception as e:
            self._update_status(analysis, AnalysisStatus.FAILED)
            self.db.commit()
            return {"error": str(e)}

    def _update_status(self, analysis: Analysis, status: AnalysisStatus):
        analysis.status = status
        analysis.current_state = f"Agent running: {status.value}"
        self.db.commit()

    def _save_root_causes(self, analysis_id: int, root_causes: list[dict]):
        for rc in root_causes:
            self.db.add(RootCause(
                analysis_id=analysis_id,
                description=rc.get("description", ""),
                confidence=rc.get("confidence", 0.0),
                evidence=rc.get("evidence", []),
            ))
        self.db.commit()

    def _save_solutions(self, analysis_id: int, solutions: list[dict]) -> list[Solution]:
        saved = []
        for s in solutions:
            sol = Solution(
                analysis_id=analysis_id,
                name=s.get("name", ""),
                description=s.get("description", ""),
                solution_type=s.get("solution_type", "operational"),
                estimated_cost=s.get("estimated_cost"),
                estimated_timeline_months=s.get("estimated_timeline_months"),
                confidence=s.get("confidence", 0.0),
                difficulty=s.get("difficulty", "medium"),
                expected_effect=s.get("expected_effect"),
                assumptions=s.get("assumptions", []),
                risks=s.get("risks", []),
            )
            self.db.add(sol)
            self.db.flush()
            saved.append(sol)
        self.db.commit()
        return saved

    def _save_estimates(self, solutions: list[Solution], estimates: list[dict]) -> list[ImpactEstimate]:
        saved = []
        solution_map = {s.name: s.id for s in solutions}
        for e in estimates:
            sol_name = e.get("solution_name")
            sol_id = solution_map.get(sol_name, solutions[0].id if solutions else None)
            if sol_id is None:
                continue
            est = ImpactEstimate(
                solution_id=sol_id,
                category=e.get("category", "general"),
                label=e.get("label", ""),
                value=e.get("value", 0),
                unit=e.get("unit", ""),
                is_estimate=e.get("is_estimate", 1),
                assumptions=e.get("assumptions", []),
                low_bound=e.get("low_bound"),
                high_bound=e.get("high_bound"),
            )
            self.db.add(est)
            saved.append(est)
        self.db.commit()
        return saved

    def _save_comparison(self, analysis_id: int, data: dict):
        self.db.add(Comparison(
            analysis_id=analysis_id,
            rankings=data.get("rankings", []),
            recommendation=data.get("recommendation", ""),
            rationale=data.get("rationale", ""),
        ))
        self.db.commit()

    def _save_evidence(self, analysis_id: int, evidence_list: list[dict]):
        analysis = self.db.query(Analysis).filter(Analysis.id == analysis_id).first()
        solutions = self.db.query(Solution).filter(Solution.analysis_id == analysis_id).all()
        if not solutions:
            return
        for ev in evidence_list:
            self.db.add(Evidence(
                solution_id=solutions[0].id,
                source=ev.get("source") or ev.get("source_title", ""),
                claim=ev.get("claim", ""),
                confidence=ev.get("confidence", 0.0),
                is_verified=0,
                url=ev.get("url"),
                published_date=ev.get("published_date"),
                summary=ev.get("summary"),
                quality=ev.get("quality", "unassessed"),
                quality_score=ev.get("quality_score", 0.0),
                gaps=ev.get("gaps", []),
                is_demo=1 if ev.get("is_demo") else 0,
            ))
        self.db.commit()

    def _save_action_plan(self, analysis_id: int, solution_id: int, data: dict):
        from app.agents.action import normalize_plan
        plan = normalize_plan(data)
        self.db.add(ActionPlan(
            analysis_id=analysis_id,
            solution_id=solution_id,
            steps=plan["steps"],
            timeline_months=plan["timeline_months"],
            resources=plan["resources"],
            risks=plan["risks"],
            phases=plan["phases"],
            success_metrics=plan["success_metrics"],
            risk_register=plan["risk_register"],
        ))
        self.db.commit()

    def _build_summary(self, context: dict, ranking_data: dict) -> str:
        num_solutions = len(context.get("solutions", []))
        recommendation = ranking_data.get("recommendation", "No recommendation available")
        return (
            f"Analysis complete. {num_solutions} solutions evaluated. "
            f"Recommendation: {recommendation}"
        )

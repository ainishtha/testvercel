from app.agents import BaseAgent, AgentResult


class MonitoringAgent(BaseAgent):
    name = "monitoring"
    description = "Tracks predicted vs actual impact over time"

    async def run(self, context: dict) -> AgentResult:
        action_plan = context.get("action_plan", {})
        monitoring_data = context.get("monitoring_data", [])

        if not monitoring_data:
            return AgentResult(
                success=True,
                data={
                    "status": "awaiting_data",
                    "message": "No monitoring data recorded yet. Begin tracking once implementation starts.",
                    "metrics_to_track": self._suggest_metrics(action_plan),
                },
            )

        analysis = self._analyze_variance(monitoring_data)
        return AgentResult(success=True, data=analysis)

    def _suggest_metrics(self, action_plan: dict) -> list[dict]:
        return [
            {"metric": "Energy consumption (kWh)", "frequency": "monthly", "source": "Utility bills / smart meters"},
            {"metric": "Cost savings ($)", "frequency": "monthly", "source": "Financial records"},
            {"metric": "CO2 emissions (tons)", "frequency": "quarterly", "source": "Calculated from energy data"},
            {"metric": "Implementation milestone completion", "frequency": "weekly", "source": "Project management tracker"},
        ]

    def _analyze_variance(self, monitoring_data: list[dict]) -> dict:
        results = []
        for entry in monitoring_data:
            predicted = entry.get("predicted_value", 0)
            actual = entry.get("actual_value")
            if actual is None:
                variance_pct = None
                status = "pending"
            else:
                variance_pct = ((actual - predicted) / predicted * 100) if predicted != 0 else 0
                if abs(variance_pct) <= 10:
                    status = "on_track"
                elif abs(variance_pct) <= 25:
                    status = "minor_variance"
                else:
                    status = "significant_variance"

            results.append({
                "metric": entry.get("metric_name", ""),
                "predicted": predicted,
                "actual": actual,
                "variance_pct": round(variance_pct, 1) if variance_pct is not None else None,
                "status": status,
                "unit": entry.get("unit", ""),
            })

        on_track = sum(1 for r in results if r["status"] == "on_track")
        total = len([r for r in results if r["status"] != "pending"])

        return {
            "results": results,
            "summary": {
                "total_metrics": total,
                "on_track": on_track,
                "variances": total - on_track,
                "accuracy_score": round(on_track / total * 100, 1) if total > 0 else None,
            },
        }

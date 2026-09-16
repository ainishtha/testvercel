from abc import ABC, abstractmethod
from pydantic import BaseModel


class AgentResult(BaseModel):
    success: bool
    data: dict
    error: str | None = None


class BaseAgent(ABC):
    name: str = "base"
    description: str = "Base agent"

    @abstractmethod
    async def run(self, context: dict) -> AgentResult:
        pass

    def _error_result(self, error: str) -> AgentResult:
        return AgentResult(success=False, data={}, error=f"[{self.name}] {error}")

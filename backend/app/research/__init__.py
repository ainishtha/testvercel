"""Modular research service.

The ResearchAgent collects evidence through this service — never by inventing
citations. A *provider* is any class implementing ``ResearchProvider.search``.

Built-in providers
------------------
- ``demo``  — clearly-labeled illustrative evidence. No URLs, no publication
  dates, ``is_demo=True``. Used when no search API is configured.
- ``none``  — research disabled. Returns an ``unavailable_reason`` so the UI
  can show an honest "unavailable" state instead of fake data.
- ``tavily`` — live web search via the Tavily API. Requires ``SEARCH_API_KEY``.
  Only URLs/dates returned by the API are stored; nothing is fabricated.

Adding a real provider later
----------------------------
1. Subclass ``ResearchProvider`` in ``app/research/providers.py``.
2. Give it a unique ``name`` and register it in ``_PROVIDERS`` below.
3. Set ``RESEARCH_PROVIDER=<name>`` in ``.env``. No agent code changes needed.
"""

from app.research.providers import (
    DemoResearchProvider,
    DisabledResearchProvider,
    EvidenceItem,
    ResearchProvider,
    ResearchResult,
    TavilyResearchProvider,
)

_PROVIDERS: dict[str, type[ResearchProvider]] = {
    DemoResearchProvider.name: DemoResearchProvider,
    DisabledResearchProvider.name: DisabledResearchProvider,
    TavilyResearchProvider.name: TavilyResearchProvider,
}


def get_research_provider(name: str | None = None) -> ResearchProvider:
    """Return a provider instance by name (defaults to settings)."""
    from app.config import settings

    key = (name or settings.RESEARCH_PROVIDER or "demo").strip().lower()
    if key not in _PROVIDERS:
        raise ValueError(
            f"Unknown research provider '{key}'. "
            f"Available: {', '.join(sorted(_PROVIDERS))}."
        )
    return _PROVIDERS[key]()


def available_providers() -> list[str]:
    return sorted(_PROVIDERS)


__all__ = [
    "EvidenceItem",
    "ResearchProvider",
    "ResearchResult",
    "get_research_provider",
    "available_providers",
]

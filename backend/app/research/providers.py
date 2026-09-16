"""Research provider implementations.

Contract for every provider: return only evidence you actually retrieved.
Never invent source titles, URLs, or publication dates. When nothing real is
available, return demo-labeled items (``is_demo=True``, no URL/date) or an
``unavailable_reason`` — never a fabricated citation.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import asdict, dataclass, field


@dataclass
class EvidenceItem:
    source_title: str
    url: str | None = None
    published_date: str | None = None
    summary: str = ""
    claim: str = ""
    quality: str = "unassessed"  # high | medium | low | unassessed
    quality_score: float = 0.0  # 0-1, 0 when not scored
    confidence: float = 0.0  # 0-1
    gaps: list[str] = field(default_factory=list)
    is_demo: bool = False

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class ResearchResult:
    items: list[EvidenceItem]
    provider: str
    is_demo: bool = False
    unavailable_reason: str | None = None
    gaps: list[str] = field(default_factory=list)


class ResearchProvider(ABC):
    name: str = "base"

    @abstractmethod
    async def search(
        self, query: str, context: dict | None = None
    ) -> ResearchResult:
        """Collect evidence for *query*. Must not fabricate citations."""
        raise NotImplementedError


def _score_to_quality(score: float) -> str:
    if score >= 0.8:
        return "high"
    if score >= 0.5:
        return "medium"
    if score > 0:
        return "low"
    return "unassessed"


class DemoResearchProvider(ResearchProvider):
    """Illustrative evidence for demos. Clearly labeled, no URLs or dates."""

    name = "demo"

    async def search(
        self, query: str, context: dict | None = None
    ) -> ResearchResult:
        items = [
            EvidenceItem(
                source_title="DEMO — Lighting retrofit planning illustration",
                summary=(
                    "Illustrative planning assumption (not a real citation): lighting "
                    "typically represents a meaningful share of campus electricity use, "
                    "so a lighting retrofit is worth auditing. Replace with metered data."
                ),
                claim="Lighting retrofits are a commonly audited first step for campus electricity reduction.",
                quality="low",
                quality_score=0.3,
                confidence=0.5,
                gaps=[
                    "No site-specific lighting audit attached",
                    "No metered baseline for lighting load",
                ],
                is_demo=True,
            ),
            EvidenceItem(
                source_title="DEMO — HVAC scheduling illustration",
                summary=(
                    "Illustrative planning assumption (not a real citation): HVAC is "
                    "often the largest campus load, so scheduling and controls are "
                    "worth investigating. Replace with BMS trend logs."
                ),
                claim="HVAC scheduling and controls are commonly investigated for campus savings.",
                quality="low",
                quality_score=0.3,
                confidence=0.5,
                gaps=[
                    "No BMS trend logs attached",
                    "Occupancy patterns not measured",
                ],
                is_demo=True,
            ),
            EvidenceItem(
                source_title="DEMO — Solar potential illustration",
                summary=(
                    "Illustrative planning assumption (not a real citation): rooftop "
                    "solar can offset a share of grid electricity subject to roof "
                    "condition, shading, and interconnection. Replace with a site survey."
                ),
                claim="Rooftop solar potential must be confirmed by a site-specific survey.",
                quality="low",
                quality_score=0.3,
                confidence=0.5,
                gaps=[
                    "No roof survey or shading analysis",
                    "No interconnection / tariff review",
                ],
                is_demo=True,
            ),
        ]
        return ResearchResult(
            items=items,
            provider=self.name,
            is_demo=True,
            gaps=[
                "No live web search configured — set RESEARCH_PROVIDER=tavily and SEARCH_API_KEY to enable sourced research.",
                "No site-specific meter data attached to this analysis.",
                "Demo items are planning illustrations, not citable sources.",
            ],
        )


class DisabledResearchProvider(ResearchProvider):
    """Research explicitly disabled — yields an honest unavailable state."""

    name = "none"

    async def search(
        self, query: str, context: dict | None = None
    ) -> ResearchResult:
        return ResearchResult(
            items=[],
            provider=self.name,
            unavailable_reason=(
                "Live web research is not configured (RESEARCH_PROVIDER=none). "
                "No evidence was collected. Configure a search provider "
                "(e.g. RESEARCH_PROVIDER=tavily with SEARCH_API_KEY) to enable "
                "sourced evidence collection."
            ),
            gaps=[
                "Evidence collection is disabled — no sources were consulted.",
            ],
        )


class TavilyResearchProvider(ResearchProvider):
    """Live web search via the Tavily API.

    Requires ``SEARCH_API_KEY``. Only titles, URLs, dates, and snippets
    returned by the API are stored — nothing is invented. Optional override:
    ``SEARCH_BASE_URL`` (defaults to https://api.tavily.com/search).
    """

    name = "tavily"
    DEFAULT_ENDPOINT = "https://api.tavily.com/search"

    async def search(
        self, query: str, context: dict | None = None
    ) -> ResearchResult:
        from app.config import settings

        if not settings.SEARCH_API_KEY:
            return ResearchResult(
                items=[],
                provider=self.name,
                unavailable_reason=(
                    "Tavily research selected but SEARCH_API_KEY is not set. "
                    "Add it to .env to enable live web research."
                ),
                gaps=["Search API key missing — no live sources consulted."],
            )

        import httpx

        endpoint = settings.SEARCH_BASE_URL or self.DEFAULT_ENDPOINT
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(
                    endpoint,
                    json={
                        "api_key": settings.SEARCH_API_KEY,
                        "query": query,
                        "search_depth": "advanced",
                        "max_results": 5,
                    },
                )
                resp.raise_for_status()
                data = resp.json()
        except Exception as e:
            return ResearchResult(
                items=[],
                provider=self.name,
                unavailable_reason=f"Search provider request failed: {e}",
                gaps=["Live search request failed — no sources retrieved."],
            )

        items: list[EvidenceItem] = []
        for r in data.get("results", []):
            content = (r.get("content") or "").strip()
            score = float(r.get("score") or 0.0)
            items.append(
                EvidenceItem(
                    source_title=(r.get("title") or r.get("url") or "Untitled source").strip(),
                    url=r.get("url"),
                    published_date=r.get("published_date"),
                    summary=content[:500],
                    claim=content[:280],
                    quality=_score_to_quality(score),
                    quality_score=round(max(0.0, min(1.0, score)), 2),
                    confidence=round(max(0.0, min(1.0, score)), 2),
                    gaps=[
                        "Verify methodology and date at the source before citing in decisions.",
                    ],
                    is_demo=False,
                )
            )

        return ResearchResult(
            items=items,
            provider=self.name,
            gaps=[
                "Web results vary in rigor — verify methodology at each source.",
                "No site-specific meter data attached to this analysis.",
            ],
        )

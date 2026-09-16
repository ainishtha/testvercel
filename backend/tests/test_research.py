import asyncio

import pytest

from app import config as config_module
from app.agents.research import ResearchAgent
from app.research import available_providers, get_research_provider
from app.research.providers import (
    DemoResearchProvider,
    DisabledResearchProvider,
    TavilyResearchProvider,
)


def run(coro):
    return asyncio.run(coro)


def test_factory_defaults_to_demo():
    provider = get_research_provider()
    assert isinstance(provider, DemoResearchProvider)


def test_factory_rejects_unknown_provider():
    with pytest.raises(ValueError, match="Unknown research provider"):
        get_research_provider("nonexistent-xyz")


def test_available_providers_lists_all():
    assert set(available_providers()) == {"demo", "none", "tavily"}


def test_demo_items_are_labeled_and_citation_free():
    result = run(DemoResearchProvider().search("campus electricity too high"))
    assert result.is_demo is True
    assert len(result.items) > 0
    assert len(result.gaps) > 0
    for item in result.items:
        assert item.is_demo is True
        # Never fabricate citable references in demo mode.
        assert item.url is None
        assert item.published_date is None
        assert "DEMO" in item.source_title
        assert item.claim
        assert item.quality in {"high", "medium", "low", "unassessed"}
        assert isinstance(item.gaps, list) and len(item.gaps) > 0


def test_disabled_provider_reports_unavailable():
    result = run(DisabledResearchProvider().search("anything"))
    assert result.items == []
    assert result.unavailable_reason
    assert "not configured" in result.unavailable_reason


def test_tavily_without_key_reports_unavailable(monkeypatch):
    monkeypatch.setattr(config_module.settings, "SEARCH_API_KEY", "")
    result = run(TavilyResearchProvider().search("campus solar"))
    assert result.items == []
    assert result.unavailable_reason
    assert "SEARCH_API_KEY" in result.unavailable_reason


def test_agent_returns_evidence_without_fabricated_urls():
    agent = ResearchAgent()
    result = run(agent.run({
        "problem": {"title": "Campus electricity consumption is too high"},
        "root_causes": [{"description": "Old lighting"}],
    }))
    assert result.success is True
    assert "evidence" in result.data
    assert len(result.data["evidence"]) > 0
    for ev in result.data["evidence"]:
        # Legacy aliases for downstream consumers.
        assert ev["source"] and ev["claim"]
        assert 0 <= ev["confidence"] <= 1
        # Honesty guarantees.
        assert ev.get("url") is None
        assert ev.get("published_date") is None
        assert ev.get("is_demo") is True


def test_agent_surfaces_unavailable_state(monkeypatch):
    monkeypatch.setattr(config_module.settings, "RESEARCH_PROVIDER", "none")
    try:
        agent = ResearchAgent()
        result = run(agent.run({"problem": {"title": "Test"}}))
        assert result.success is True
        assert result.data["evidence"] == []
        assert result.data["unavailable"]
    finally:
        monkeypatch.setattr(config_module.settings, "RESEARCH_PROVIDER", "demo")

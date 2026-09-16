from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.demo import seed_demo_analysis

router = APIRouter(prefix="/api", tags=["demo"])


def _provider_state() -> dict:
    llm_live = bool(settings.LLM_API_KEY)
    search_live = settings.RESEARCH_PROVIDER == "tavily" and bool(settings.SEARCH_API_KEY)
    return {
        "demo_mode": not (llm_live or search_live),
        "llm_configured": llm_live,
        "research_provider": settings.RESEARCH_PROVIDER,
        "demo_available": True,
    }


@router.get("/demo/status")
def demo_status():
    """Report whether the app is running on demo/synthetic providers.

    Demo Mode is on when no live LLM key and no live search provider are
    configured — i.e. every AI result is deterministic demo output.
    """
    return _provider_state()


@router.post("/demo/seed")
def seed_demo(db: Session = Depends(get_db)):
    """Seed the predefined campus-electricity demo workflow (idempotent).

    Pure database inserts — never calls external APIs or the LLM.
    """
    return {**seed_demo_analysis(db), **_provider_state()}

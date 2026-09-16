from app.routers.problems import router as problems_router
from app.routers.analyses import router as analyses_router
from app.routers.solutions import router as solutions_router
from app.routers.reports import router as reports_router
from app.routers.monitoring import router as monitoring_router
from app.routers.simulator import router as simulator_router
from app.routers.scoring import router as scoring_router
from app.routers.verification import router as verification_router
from app.routers.ripple import router as ripple_router
from app.routers.demo import router as demo_router

all_routers = [
    problems_router,
    analyses_router,
    solutions_router,
    reports_router,
    monitoring_router,
    simulator_router,
    scoring_router,
    verification_router,
    ripple_router,
    demo_router,
]

"""Verification package: deterministic analysis checks.

Single source of truth used both by the VerificationAgent (pipeline) and the
GET /api/verification/{analysis_id} endpoint (dashboard).
"""

from app.verification.checks import ENGINE_VERSION, run_verification

__all__ = ["ENGINE_VERSION", "run_verification"]

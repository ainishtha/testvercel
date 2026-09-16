from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from app.config import settings

engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False},
    echo=settings.DEBUG,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    Base.metadata.create_all(bind=engine)
    _ensure_columns("evidence", {
        "url": "VARCHAR(1000)",
        "published_date": "VARCHAR(50)",
        "summary": "TEXT",
        "quality": "VARCHAR(20)",
        "quality_score": "FLOAT",
        "gaps": "JSON",
        "is_demo": "INTEGER",
    }, backfill={
        "quality": "'unassessed'",
        "quality_score": "0.0",
        "gaps": "'[]'",
        "is_demo": "0",
    })
    _ensure_columns("solutions", {
        "difficulty": "VARCHAR(20)",
        "expected_effect": "TEXT",
        "assumptions": "JSON",
        "risks": "JSON",
    }, backfill={
        "difficulty": "'medium'",
        "assumptions": "'[]'",
        "risks": "'[]'",
    })
    _ensure_columns("action_plans", {
        "phases": "JSON",
        "success_metrics": "JSON",
        "risk_register": "JSON",
    }, backfill={
        "phases": "'[]'",
        "success_metrics": "'[]'",
        "risk_register": "'[]'",
    })


def _ensure_columns(table: str, wanted: dict[str, str], backfill: dict[str, str] | None = None):
    """Lightweight migration: add newer columns to existing DBs.

    ``create_all`` never alters existing tables, so deployments that already
    have the table would otherwise fail on insert. All added columns are
    nullable; ``backfill`` supplies SQL literals for pre-existing NULL rows so
    response schemas with non-nullable defaults keep validating.
    """
    from sqlalchemy import inspect, text

    try:
        existing = {c["name"] for c in inspect(engine).get_columns(table)}
    except Exception:
        return
    missing = [name for name in wanted if name not in existing]
    with engine.begin() as conn:
        for name in missing:
            conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {wanted[name]}"))
        for name, literal in (backfill or {}).items():
            conn.execute(text(f"UPDATE {table} SET {name} = {literal} WHERE {name} IS NULL"))

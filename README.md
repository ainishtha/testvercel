# Impactus — AI That Optimizes for Impact

An agentic AI decision-support platform for campus sustainability. Analyzes problems, researches evidence, generates interventions, estimates impact, and compares alternatives.

## Quick Start

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env      # Add your LLM API key (optional — runs with demo data without one)
uvicorn app.main:app --reload
```

API runs at `http://localhost:8000`. Docs at `http://localhost:8000/docs`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

App runs at `http://localhost:5173`.

## Architecture

```
React SPA → FastAPI → Agent Orchestrator → 8 Specialized Agents → Calculator Engine → SQLite
```

**Agents:** Discovery → Research → Solutions → Impact → Decision → Verification → Action → Monitoring

## Tech Stack

- **Frontend:** React 18, TypeScript, Tailwind CSS, Recharts
- **Backend:** Python, FastAPI, SQLAlchemy, Pydantic
- **Database:** SQLite
- **AI:** Provider-agnostic LLM (OpenAI-compatible, with fallback demo data)

## Testing

```bash
cd backend
pytest tests/
```

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `LLM_API_KEY` | API key for LLM provider | (empty — uses demo fallback) |
| `LLM_MODEL` | Model name | `gpt-4o-mini` |
| `LLM_PROVIDER` | Provider name | `openai` |
| `DATABASE_URL` | SQLite path | `sqlite:///impactus.db` |

## Project Structure

```
impactus/
├── backend/
│   ├── app/
│   │   ├── main.py           # FastAPI entry
│   │   ├── config.py         # Settings
│   │   ├── database.py       # SQLAlchemy setup
│   │   ├── db/               # SQLAlchemy models
│   │   ├── models/           # Pydantic schemas
│   │   ├── agents/           # 8 agent modules
│   │   ├── orchestrator.py   # Agent coordinator
│   │   ├── calculator/       # Deterministic calculations
│   │   ├── llm/              # LLM service
│   │   └── routers/          # API endpoints
│   └── tests/
├── frontend/
│   ├── src/
│   │   ├── components/       # Reusable UI
│   │   ├── pages/            # Route pages
│   │   ├── services/         # API client
│   │   └── types/            # TypeScript types
│   └── package.json
└── README.md
```

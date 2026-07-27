# Guest House Backend

Minimal FastAPI foundation for The Guest House Café & Pantry preorder
application.

Phase 1A provides only:

- a FastAPI application factory
- an ASGI application entry point
- `GET /health/live`
- one automated liveness test

Phase 1B adds:

- PostgreSQL connectivity through SQLAlchemy
- request-scoped database sessions
- an empty Alembic migration framework
- `GET /health/ready`
- PostgreSQL integration tests

## Requirements

- Python 3.12

## Local setup

Run these commands from the `backend` directory:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -e ".[test]"
```

## Start the backend

Set a PostgreSQL connection URL before starting:

```bash
export DATABASE_URL="postgresql+psycopg://guesthouse:password@127.0.0.1:5432/guesthouse"
```

The database must already exist. Phase 1B does not create application tables.

```bash
uvicorn app.main:app --reload
```

The backend is available at `http://127.0.0.1:8000`.

Check liveness:

```bash
curl http://127.0.0.1:8000/health/live
```

Expected response:

```json
{
  "status": "ok",
  "service": "guesthouse-backend",
  "version": "0.1.0"
}
```

Check readiness:

```bash
curl http://127.0.0.1:8000/health/ready
```

Expected response with PostgreSQL available:

```json
{
  "status": "ready",
  "database": "ok"
}
```

Readiness returns HTTP `503` when `DATABASE_URL` is missing or PostgreSQL
cannot be reached.

## Alembic

Set `DATABASE_URL`, then run:

```bash
alembic upgrade head
alembic current
```

The Phase 1B migration history is intentionally empty. These commands verify
the migration environment without creating business tables.

## Run tests

Tests require an isolated PostgreSQL database. Destructive application-table
operations are not performed in Phase 1B, but the database must not be shared
with staging or production.

```bash
export TEST_DATABASE_URL="postgresql+psycopg://guesthouse:password@127.0.0.1:5432/guesthouse_test"
pytest
```

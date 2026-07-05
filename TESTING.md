# Testing Guide

## Overview

The backend test suite covers the settlement calculation logic — the financial math that directly affects users' debt settlement numbers. There are 36 tests split across two files.

## What's Covered

**`backend/tests/test_calculations.py`** — Pure unit tests for `utils/calculations.py`:
- `compute_stress_level`: all boundary values (Low/Medium/High/Critical thresholds)
- `compute_settlement_metrics`: realistic cases (Arjun Mehta persona), edge cases including zero income, zero EMI, overdue days capping at 180, stress score clamping at 0 and 100, large (millions-scale) values, and verification that `settlement_amount` uses the unrounded internal percentage

**`backend/tests/test_settlement_api.py`** — Integration tests for the settlement API:
- `POST /settlement/{loan_id}`: auth required, 404 on missing/other-user loans, correct response shape and verified math, snapshot auto-creation, 5-minute deduplication window
- `GET /snapshots`: auth required, empty initially, populated after settlement, correct shape, user isolation
- `GET /snapshots/{loan_id}`: auth required, 404 on missing loan, correct results per loan

## Test Database

Tests use an isolated SQLite database (`backend/tests/test_finrelief.db`). It is created fresh before each test and dropped after — the real Neon/PostgreSQL database is never touched. The rate limiter is disabled during integration tests (it has its own manual verification from the rate-limiting PR).

## Setup

Dependencies are already in `backend/requirements.txt`. To install:

```bash
cd Fin-track-prototype
.venv\Scripts\pip install -r backend/requirements.txt
```

## Running Tests

From the backend directory:

```bash
cd Fin-track-prototype/backend
..\.venv\Scripts\pytest tests/ -v
```

Or from the repo root:

```bash
cd Fin-track-prototype
.venv\Scripts\pytest backend/tests/ -v
```

Expected output: `36 passed` with no failures.

## Adding New Tests

- Unit tests for pure functions go in `test_calculations.py`
- API endpoint tests go in `test_settlement_api.py` (or a new `test_<router>.py` file)
- Use the `client`, `auth_headers`, and `test_loan` fixtures from `conftest.py`
- Always hand-verify expected values against the formula — do not assert `result == function(input)` without an independent calculation

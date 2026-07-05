# Testing Guide

## Overview

The backend test suite covers settlement calculation logic, Gemini AI fallback behaviour, and settlement API endpoints. There are **65 tests** across three files.

## What's Covered

### `backend/tests/test_calculations.py` — Pure unit tests for `utils/calculations.py`

**`TestComputeStressLevel`** — 8 boundary tests:
- Verifies the correct label (Low / Medium / High / Critical) at each threshold: 0, 25, 25.1, 50, 50.1, 75, 75.1, 100

**`TestComputeSettlementMetricsRealistic`** — 3 realistic persona cases:
- Arjun Mehta (standard case with hand-verified numbers)
- Explicit monthly expenses provided
- Negative surplus / critical stress

**`TestComputeSettlementMetricsEdgeCases`** — 10 edge cases:
- Zero overdue days
- Zero income guard (avoids division by zero)
- Zero EMI guard
- Overdue days capped at 180
- Stress score clamped at 100
- Stress score floored at 0
- Large (millions-scale) values with no overflow
- Default expenses equals explicit 40% of income
- Months to clear minimum of 1
- Settlement amount uses the rounded settlement percentage (consistent with what the UI displays)

---

### `backend/tests/test_gemini_fallback.py` — Unit tests for all Gemini failure scenarios

All tests mock `_client` — no real API calls are made.

**`TestGeminiHappyPath`** — 2 tests:
- Successful Gemini response returns `source: "gemini"`
- Returned text is not the fallback template

**`TestScenarioAQuota`** — 2 tests: daily quota exhausted (429), per-minute rate limit (429)

**`TestScenarioBAuth`** — 2 tests: invalid key (401), revoked key (403)

**`TestScenarioCNetwork`** — 3 tests: timeout, connect error, read timeout

**`TestScenarioDEmpty`** — 3 tests: None text, whitespace-only text, no candidates in response

**`TestScenarioESafety`** — 6 tests: parametrized across SAFETY, BLOCKLIST, PROHIBITED_CONTENT, SPII, RECITATION, LANGUAGE finish reasons

**`TestScenarioFMalformed`** — 3 tests: AttributeError, RuntimeError, ValueError from the SDK

**`TestScenarioGTruncated`** — 1 test: MAX_TOKENS finish reason falls back to template

**`TestScenarioHTimeout`** — 2 tests: connect timeout, pool timeout

**`TestFallbackTemplateQuality`** — 5 tests:
- Template contains correct borrower name, lender, Rs. amounts, structural elements (OTS, 15 working days, credit bureau, Settled)
- Settlement amount in the template is consistent with the rounded settlement percentage
- Figures are consistent for small amounts
- No Gemini client always uses fallback
- 500 server error falls back to template

---

### `backend/tests/test_settlement_api.py` — Integration tests for settlement endpoints

**`TestSettlementCalculate`** — 7 tests:
- Auth required
- 404 for missing loan
- 404 for another user's loan
- Correct response shape
- Hand-verified math (Arjun Mehta case)
- Snapshot auto-created after settlement
- 5-minute deduplication window

**`TestSnapshotsList`** — 5 tests:
- Auth required
- Empty initially
- Populated after settlement
- Correct snapshot shape
- User isolation (only own snapshots returned)

**`TestSnapshotsByLoan`** — 3 tests:
- Auth required
- 404 for missing loan
- Returns correct snapshots for the specified loan

---

## Test Database

Tests use an isolated SQLite database (`backend/tests/test_finrelief.db`). It is fully dropped and recreated before each test via an `autouse` fixture — the real Neon PostgreSQL database is never touched. The rate limiter is also disabled during tests.

---

## Setup

Dependencies are already in `backend/requirements.txt`. Install them:

```bash
pip install -r backend/requirements.txt
```

---

## Running Tests

From the repo root:

```bash
python -m pytest backend/tests/ -v
```

From the backend directory:

```bash
python -m pytest tests/ -v
```

Expected output: **65 passed** with no failures (deprecation warnings from Pydantic v2 and FastAPI's `on_event` are expected and do not affect functionality).

---

## Adding New Tests

- Unit tests for pure functions go in `test_calculations.py`
- Gemini client failure scenarios go in `test_gemini_fallback.py`
- API endpoint tests go in `test_settlement_api.py` or a new `test_<router>.py` file
- Use the `client`, `auth_headers`, and `test_loan` fixtures from `conftest.py`
- Always hand-verify expected values against the formula — do not assert `result == function(input)` without an independent calculation

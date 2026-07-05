"""
Test configuration and shared fixtures.

IMPORTANT: DATABASE_URL must be set BEFORE any app module is imported,
because database.py reads it at module-load time.
"""
import os
import pytest

# Override database before any app imports
TEST_DB_PATH = os.path.join(os.path.dirname(__file__), "test_finrelief.db")
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB_PATH}"

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient

# Now safe to import app modules
from database import Base, get_db
from main import app
from limiter import limiter

# Build a dedicated test engine (file-based SQLite, check_same_thread for pytest)
TEST_ENGINE = create_engine(
    f"sqlite:///{TEST_DB_PATH}",
    connect_args={"check_same_thread": False},
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=TEST_ENGINE)


@pytest.fixture(autouse=True)
def reset_db():
    """Drop and recreate all tables before every test for full isolation."""
    Base.metadata.drop_all(bind=TEST_ENGINE)
    Base.metadata.create_all(bind=TEST_ENGINE)
    yield
    Base.metadata.drop_all(bind=TEST_ENGINE)


@pytest.fixture()
def db_session(reset_db):
    """Yield a test DB session."""
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture()
def client(reset_db):
    """FastAPI TestClient wired to the isolated test database.

    The slowapi rate limiter is disabled for the duration of each test so
    that fixture setup (registering users, creating loans) never hits 429s.
    The rate-limiting behaviour itself is verified separately via manual
    testing (confirmed in the rate-limit fix PR).
    """
    app.dependency_overrides[get_db] = override_get_db

    # Disable rate limiting for integration tests
    limiter.enabled = False
    try:
        with TestClient(app, raise_server_exceptions=False) as c:
            yield c
    finally:
        limiter.enabled = True
        app.dependency_overrides.clear()


@pytest.fixture()
def auth_headers(client):
    """Register a test user and return Bearer token headers."""
    resp = client.post("/auth/register", json={
        "name": "Test User",
        "email": "testuser@example.com",
        "password": "TestPass123!",
    })
    assert resp.status_code == 201, f"Registration failed: {resp.text}"
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def test_loan(client, auth_headers):
    """Create a loan with Arjun Mehta-style values and return its id."""
    resp = client.post("/loans", json={
        "lender": "HDFC Bank",
        "loan_type": "Personal loan",
        "amount": 500000,
        "emi": 25000,
        "overdue_days": 90,
        "income": 75000,
    }, headers=auth_headers)
    assert resp.status_code == 201, f"Loan creation failed: {resp.text}"
    return resp.json()["id"]

import os
import logging
from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from slowapi import _rate_limit_exceeded_handler
from slowapi.middleware import SlowAPIMiddleware
from slowapi.errors import RateLimitExceeded
from limiter import limiter

from database import engine, Base
from auth import router as auth_router
from routers.loans import router as loans_router
from routers.settlement import router as settlement_router
from routers.letters import router as letters_router
from routers.dashboard import router as dashboard_router
from routers.demo import router as demo_router
from utils.gemini_client import verify_gemini_config

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("finrelief")

app = FastAPI(
    title="FinRelief AI Production API",
    version="3.0.0",
    description="Backend JSON API for the FinRelief AI Debt Settlement platform"
)
app.state.limiter = limiter

# Startup verification & migration
@app.on_event("startup")
def startup_event():
    logger.info("Initializing database migrations...")
    Base.metadata.create_all(bind=engine)
    logger.info("Database migration complete.")
    
    logger.info("Running Gemini API integration check...")
    verify_gemini_config()

# CORS configuration
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:5173")
origins = [
    FRONTEND_URL,
    "http://localhost:5173", # Vite local dev default
    "http://127.0.0.1:5173"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(SlowAPIMiddleware)

# Include Routers
app.include_router(auth_router)
app.include_router(loans_router)
app.include_router(settlement_router)
app.include_router(letters_router)
app.include_router(dashboard_router)
app.include_router(demo_router)

# Global Exception Handlers
@app.exception_handler(RequestValidationError)
def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Clean validation error format: {"detail": "message"}"""
    errors = exc.errors()
    # Construct a clean single-string detail message from the list of validation errors
    error_msgs = []
    for err in errors:
        loc = " -> ".join(str(loc_part) for loc_part in err.get("loc", []))
        msg = err.get("msg", "Validation error")
        error_msgs.append(f"{loc}: {msg}")
    
    clean_msg = "; ".join(error_msgs)
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={"detail": clean_msg}
    )

@app.exception_handler(StarletteHTTPException)
def http_exception_handler(request: Request, exc: StarletteHTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail}
    )

@app.exception_handler(RateLimitExceeded)
def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return _rate_limit_exceeded_handler(request, exc)

@app.exception_handler(Exception)
def general_exception_handler(request: Request, exc: Exception):
    # Log the full stack trace internally
    logger.error(f"Unhandled system error: {exc}", exc_info=True)
    # Hide details from client in production
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An unexpected error occurred. Please contact support."}
    )

# Health endpoint
@app.get("/health", tags=["health"])
def health_check():
    gemini_status = verify_gemini_config()
    return {
        "status": "healthy",
        "database": "connected",
        "gemini_api": "configured" if gemini_status else "using fallback templates"
    }

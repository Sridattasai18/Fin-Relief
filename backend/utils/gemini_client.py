"""
Gemini API client for OTS letter generation.

Failure handling strategy
─────────────────────────
Every failure mode falls back to the plain-text template so the user always
gets a usable letter.  Each failure category is caught separately so logs are
actionable.

Failure categories (see _generate_with_gemini):
  QUOTA     – 429 RESOURCE_EXHAUSTED (daily or per-minute)
  AUTH      – 401/403 invalid / revoked API key  → logged at ERROR level
               because the whole Gemini feature is broken until the key is fixed
  SERVER    – 5xx from the Gemini backend
  NETWORK   – timeout, connection refused, DNS failure
  SAFETY    – Gemini refused the prompt (FinishReason SAFETY / BLOCKLIST /
               PROHIBITED_CONTENT / SPII / RECITATION / LANGUAGE / OTHER)
  TRUNCATED – response cut off mid-generation (FinishReason MAX_TOKENS)
  EMPTY     – 200 OK but no candidates or empty text
  UNEXPECTED– any other exception (SDK version mismatch, unexpected field, etc.)

The `source` field returned by generate_letter_body() is already stored in
the Letter DB row and surfaced in LetterOut as `source: "gemini" | "fallback"`,
giving the frontend full transparency without exposing internals.
"""

import os
import logging
from collections import Counter

import httpx

logger = logging.getLogger("finrelief")

# ── SDK import ─────────────────────────────────────────────────────────────────
try:
    from google import genai
    from google.genai import types as genai_types
    from google.genai.errors import ClientError, ServerError
    _GENAI_AVAILABLE = True
except ImportError:
    _GENAI_AVAILABLE = False

# ── Key validation ─────────────────────────────────────────────────────────────
_RAW_GEMINI_KEY = os.environ.get("GEMINI_API_KEY", "")
GEMINI_API_KEY = (
    _RAW_GEMINI_KEY
    if _RAW_GEMINI_KEY and _RAW_GEMINI_KEY not in ("paste_your_gemini_api_key_here", "your_gemini_api_key_here")
    else ""
)

# ── Client (one instance, no global state) ─────────────────────────────────────
_client = None
if _GENAI_AVAILABLE and GEMINI_API_KEY:
    try:
        _client = genai.Client(api_key=GEMINI_API_KEY)
    except Exception as e:
        logger.warning(f"[gemini] Failed to initialise client: {e}")

_MODEL = "gemini-2.0-flash"

# Request timeout in seconds — don't let a hung Gemini call block the request
_TIMEOUT_SECONDS = 20

# ── Fallback frequency counter (in-process, resets on restart) ────────────────
# Lets you spot patterns like "90% of requests are falling back" in logs.
_fallback_reasons: Counter = Counter()

# ── Startup health check ───────────────────────────────────────────────────────
_GEMINI_API_STATUS = None


def verify_gemini_config() -> bool:
    """
    Startup check. Logs a warning if the key is missing or the API is
    unreachable.  Uses the same timeout and error handling as live calls.
    """
    global _GEMINI_API_STATUS
    if _GEMINI_API_STATUS is not None:
        return _GEMINI_API_STATUS

    if not _GENAI_AVAILABLE:
        logger.warning(
            "[gemini] google-genai package not installed — "
            "letter generation will use fallback templates."
        )
        _GEMINI_API_STATUS = False
        return False

    if not GEMINI_API_KEY or _client is None:
        logger.warning(
            "[gemini] GEMINI_API_KEY not configured — "
            "letter generation will use fallback templates."
        )
        _GEMINI_API_STATUS = False
        return False

    try:
        response = _client.models.generate_content(
            model=_MODEL,
            contents="Ping",
            config=genai_types.GenerateContentConfig(
                max_output_tokens=5,
                http_options=genai_types.HttpOptions(timeout=_TIMEOUT_SECONDS * 1000),
            ),
        )
        if response.text:
            logger.info("[gemini] API connection test: SUCCESS")
            _GEMINI_API_STATUS = True
            return True
        _GEMINI_API_STATUS = False
        return False
    except ClientError as e:
        if e.code == 429:
            logger.warning(
                f"[gemini] Startup check: quota exhausted (429) — "
                f"letters will fall back to template until quota resets. detail={e.message}"
            )
        elif e.code in (401, 403):
            logger.error(
                f"[gemini] Startup check: authentication failure ({e.code}) — "
                f"GEMINI_API_KEY is invalid or revoked. "
                f"The Gemini feature will be disabled until the key is fixed."
            )
        else:
            logger.warning(f"[gemini] Startup check: client error {e.code}: {e.message}")
        _GEMINI_API_STATUS = False
        return False
    except Exception as e:
        logger.warning(f"[gemini] Startup check failed: {type(e).__name__}: {e}")
        _GEMINI_API_STATUS = False
        return False


# ── Internal: single attempt at Gemini generation ─────────────────────────────

# FinishReasons that mean the output is unusable and we should fall back
_SAFETY_FINISH_REASONS = {
    "SAFETY", "BLOCKLIST", "PROHIBITED_CONTENT",
    "SPII", "RECITATION", "LANGUAGE", "OTHER",
}
_TRUNCATED_FINISH_REASONS = {"MAX_TOKENS"}


def _generate_with_gemini(prompt: str) -> tuple[str, str]:
    """
    Attempt to generate text with Gemini.

    Returns (text, "gemini") on success, or ("", failure_category) on any failure.
    failure_category is one of: QUOTA AUTH SERVER NETWORK SAFETY TRUNCATED EMPTY UNEXPECTED
    Never raises.
    """
    try:
        response = _client.models.generate_content(
            model=_MODEL,
            contents=prompt,
            config=genai_types.GenerateContentConfig(
                max_output_tokens=512,
                http_options=genai_types.HttpOptions(timeout=_TIMEOUT_SECONDS * 1000),
            ),
        )

        # ── Check finish_reason before trusting the text ───────────────────
        if response.candidates:
            candidate = response.candidates[0]
            finish_reason = candidate.finish_reason

            if finish_reason is not None:
                reason_name = finish_reason.value if hasattr(finish_reason, "value") else str(finish_reason)

                if reason_name in _SAFETY_FINISH_REASONS:
                    logger.warning(
                        f"[gemini] Safety/content filter triggered: finish_reason={reason_name}. "
                        "Falling back to template."
                    )
                    return "", "SAFETY"

                if reason_name in _TRUNCATED_FINISH_REASONS:
                    logger.warning(
                        "[gemini] Response truncated (MAX_TOKENS reached mid-generation). "
                        "A partial letter is worse than a template — falling back."
                    )
                    return "", "TRUNCATED"

        # ── Extract text ───────────────────────────────────────────────────
        text = response.text.strip() if response.text else ""
        if not text:
            logger.warning("[gemini] Response returned 200 but contained no text. Falling back.")
            return "", "EMPTY"

        return text, "gemini"

    # ── 4xx client errors ──────────────────────────────────────────────────
    except ClientError as e:
        if e.code == 429:
            logger.warning(
                f"[gemini] Rate limited (429 RESOURCE_EXHAUSTED) — "
                f"quota exhausted. Falling back to template."
            )
            return "", "QUOTA"
        elif e.code in (401, 403):
            # Log at ERROR — the whole feature is broken until the key is fixed
            logger.error(
                f"[gemini] Authentication failure ({e.code}) — "
                f"GEMINI_API_KEY is invalid or revoked. "
                f"All letter generation will use templates until key is fixed."
            )
            return "", "AUTH"
        else:
            logger.warning(f"[gemini] Client error {e.code}: {e.message}. Falling back.")
            return "", "CLIENT_ERROR"

    # ── 5xx server errors ──────────────────────────────────────────────────
    except ServerError as e:
        logger.warning(
            f"[gemini] Gemini server error ({e.code}). Falling back to template."
        )
        return "", "SERVER"

    # ── Network / timeout ──────────────────────────────────────────────────
    except httpx.TimeoutException:
        logger.warning(
            f"[gemini] Request timed out after {_TIMEOUT_SECONDS}s. Falling back to template."
        )
        return "", "NETWORK"

    except httpx.NetworkError as e:
        logger.warning(
            f"[gemini] Network error ({type(e).__name__}). Falling back to template."
        )
        return "", "NETWORK"

    # ── Anything else (SDK changes, unexpected fields, etc.) ───────────────
    except Exception as e:
        logger.warning(
            f"[gemini] Unexpected error ({type(e).__name__}): {e}. Falling back to template."
        )
        return "", "UNEXPECTED"


# ── Public interface ───────────────────────────────────────────────────────────

def generate_letter_body(
    user_name: str,
    user_email: str,
    lender: str,
    loan_type: str,
    amount: float,
    emi: float,
    overdue_days: int,
    settlement_pct: float,
) -> tuple[str, str]:
    """
    Generate an OTS negotiation letter.

    Returns (body, source) where source is 'gemini' or 'fallback'.

    settlement_pct MUST be the rounded value already returned by
    compute_settlement_metrics() so the rupee amount in the letter matches
    what the UI shows (i.e. amount × settlement_pct% == settlement_amount).

    The `source` value is stored in the Letter row and returned in the API
    response as `source`, giving the frontend full transparency:
      "source": "gemini"   → AI-generated letter
      "source": "fallback" → professional template (any failure mode)
    """
    # Compute once — used by both Gemini prompt and the fallback template.
    # Rounded to whole rupees (no paise) for readability in a formal letter.
    settlement_amount = round(amount * settlement_pct / 100.0)

    if _client is not None:
        prompt = f"""You are a financial advisor drafting a professional One Time Settlement (OTS) negotiation letter on behalf of a borrower in India.

Borrower: {user_name} ({user_email})
Lender: {lender}
Loan type: {loan_type}
Outstanding balance: Rs. {amount:,.0f}
Monthly EMI: Rs. {emi:,.0f}
Overdue days: {overdue_days}
Proposed settlement: Rs. {settlement_amount:,.0f} ({settlement_pct:.0f}% of outstanding)

Write a formal, empathetic, and concise OTS letter (200–280 words). Use a professional tone. Include:
1. Salutation to the Loan Recovery Department
2. Subject line about OTS request
3. Brief explanation of financial hardship without excessive detail
4. Clear settlement proposal with amount and timeline (15 working days)
5. Request for credit bureau reporting as "Settled"
6. Professional sign-off

Do NOT include markdown formatting. Output plain text only."""

        text, category = _generate_with_gemini(prompt)

        if category == "gemini":
            return text, "gemini"

        # Track fallback frequency (in-process counter visible in metrics/logs)
        _fallback_reasons[category] += 1
        total_fallbacks = sum(_fallback_reasons.values())
        logger.info(
            f"[gemini] Fallback #{total_fallbacks} — reason={category} "
            f"breakdown={dict(_fallback_reasons)}"
        )

    # ── Professional template fallback ────────────────────────────────────────
    # Uses the same rounded settlement_pct and settlement_amount as the API
    # response, so every number in the letter is self-consistent and verifiable.
    body = f"""To,
The Manager - Loan Recovery Department
{lender}

Subject: Request for One Time Settlement (OTS) on Loan Account

Dear Sir/Madam,

I am writing regarding my outstanding {loan_type.lower()} with {lender}, currently overdue by {overdue_days} days, with an outstanding balance of Rs. {amount:,.0f}.

Due to a temporary but significant financial constraint, I have been unable to maintain regular EMI payments of Rs. {emi:,.0f}. After careful assessment of my financial situation, I would like to propose a One Time Settlement of Rs. {settlement_amount:,.0f} (approximately {settlement_pct:.0f}% of the outstanding amount), payable in full within 15 working days of your written approval.

I believe this settlement would be mutually beneficial — it allows you to recover a substantial portion of the outstanding balance while helping me avoid further financial distress. I am committed to honouring this agreement promptly upon your approval.

I sincerely request you to consider this proposal favourably. Upon settlement, I kindly request that you report my account status to the credit bureau as "Settled."

I am available for any discussion or documentation required and can be reached at {user_email}.

Yours sincerely,
{user_name}
{user_email}"""

    return body, "fallback"

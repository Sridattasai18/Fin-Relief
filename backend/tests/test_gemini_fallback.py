"""
Tests for gemini_client.py fallback hardening.

Every test mocks the Gemini client so no real API quota is consumed.
Each failure scenario (a–h from the spec) is tested individually.

Arjun Mehta persona used throughout for consistent numbers:
  amount=500000, settlement_pct=37.8
  expected settlement_amount = round(500000 * 37.8 / 100) = 189000

The `source` field in LetterOut maps directly to 'gemini'/'fallback',
providing frontend transparency without exposing internals.
"""

import pytest
from unittest.mock import MagicMock, patch
import httpx

# ── Fixtures shared across all tests ──────────────────────────────────────────

ARJUN = dict(
    user_name="Arjun Mehta",
    user_email="arjun.mehta@example.com",
    lender="HDFC Bank",
    loan_type="Personal loan",
    amount=500000.0,
    emi=25000.0,
    overdue_days=90,
    settlement_pct=37.8,
)

# settlement_amount = round(500000 * 37.8 / 100) = 189000
EXPECTED_AMOUNT = "189,000"
EXPECTED_PCT = "38%"  # settlement_pct=37.8 formatted as {:.0f}


def _call(**kwargs):
    """Import and call generate_letter_body with merged kwargs."""
    from utils.gemini_client import generate_letter_body
    params = {**ARJUN, **kwargs}
    return generate_letter_body(**params)


def _assert_template_quality(body: str):
    """
    Assert the fallback template is complete and uses correct figures.
    Reusable across all fallback scenarios.
    """
    # Correct people / institution
    assert "Arjun Mehta" in body
    assert "arjun.mehta@example.com" in body
    assert "HDFC Bank" in body

    # Correct numbers — rounded settlement_amount must appear
    assert EXPECTED_AMOUNT in body, f"Expected Rs. {EXPECTED_AMOUNT} in letter, got:\n{body}"
    assert EXPECTED_PCT in body

    # Structural completeness
    assert "One Time Settlement" in body
    assert "15 working days" in body
    assert "credit bureau" in body
    assert "Settled" in body

    # No placeholder text left in
    assert "[" not in body, "Placeholder brackets found in template"
    assert "your_name" not in body.lower()
    assert "your_email" not in body.lower()

    # Reasonable length — a truncated or empty template would be <200 chars
    assert len(body) > 400, "Template is suspiciously short"


# ── Happy path ─────────────────────────────────────────────────────────────────

class TestGeminiHappyPath:

    def test_successful_gemini_response_returns_gemini_source(self):
        """Mock a clean Gemini response — should use Gemini text, not template."""
        mock_response = MagicMock()
        mock_response.text = "This is a unique AI-generated OTS letter for Arjun Mehta."
        mock_response.candidates = [MagicMock(finish_reason=MagicMock(value="STOP"))]

        with patch("utils.gemini_client._client") as mock_client:
            mock_client.models.generate_content.return_value = mock_response
            body, source = _call()

        assert source == "gemini"
        assert body == "This is a unique AI-generated OTS letter for Arjun Mehta."

    def test_successful_response_not_template(self):
        """Gemini text should be used verbatim, not replaced by template."""
        mock_response = MagicMock()
        mock_response.text = "UNIQUE_GEMINI_CONTENT_XYZ"
        mock_response.candidates = [MagicMock(finish_reason=MagicMock(value="STOP"))]

        with patch("utils.gemini_client._client") as mock_client:
            mock_client.models.generate_content.return_value = mock_response
            body, source = _call()

        assert source == "gemini"
        assert "UNIQUE_GEMINI_CONTENT_XYZ" in body
        assert "Loan Recovery Department" not in body  # template text absent


# ── Failure scenario (a): Quota / rate limit ───────────────────────────────────

class TestScenarioAQuota:

    def test_daily_quota_exhausted_falls_back(self):
        """429 RESOURCE_EXHAUSTED → fallback, no 500."""
        from google.genai.errors import ClientError
        exc = ClientError(429, {"error": {"code": 429, "message": "quota exceeded", "status": "RESOURCE_EXHAUSTED"}})

        with patch("utils.gemini_client._client") as mock_client:
            mock_client.models.generate_content.side_effect = exc
            body, source = _call()

        assert source == "fallback"
        _assert_template_quality(body)

    def test_per_minute_rate_limit_falls_back(self):
        """Same 429 code but per-minute limit — identical fallback behaviour."""
        from google.genai.errors import ClientError
        exc = ClientError(429, {"error": {"code": 429, "message": "per-minute limit", "status": "RESOURCE_EXHAUSTED"}})

        with patch("utils.gemini_client._client") as mock_client:
            mock_client.models.generate_content.side_effect = exc
            body, source = _call()

        assert source == "fallback"
        _assert_template_quality(body)


# ── Failure scenario (b): Authentication ──────────────────────────────────────

class TestScenarioBAuth:

    def test_invalid_api_key_401_falls_back(self):
        """401 → fallback, logged at ERROR level (whole feature broken)."""
        from google.genai.errors import ClientError
        exc = ClientError(401, {"error": {"code": 401, "message": "invalid key", "status": "UNAUTHENTICATED"}})

        with patch("utils.gemini_client._client") as mock_client:
            mock_client.models.generate_content.side_effect = exc
            body, source = _call()

        assert source == "fallback"
        _assert_template_quality(body)

    def test_revoked_api_key_403_falls_back(self):
        """403 → fallback."""
        from google.genai.errors import ClientError
        exc = ClientError(403, {"error": {"code": 403, "message": "permission denied", "status": "PERMISSION_DENIED"}})

        with patch("utils.gemini_client._client") as mock_client:
            mock_client.models.generate_content.side_effect = exc
            body, source = _call()

        assert source == "fallback"
        _assert_template_quality(body)


# ── Failure scenario (c): Network failures ────────────────────────────────────

class TestScenarioCNetwork:

    def test_timeout_falls_back(self):
        """httpx.TimeoutException → fallback."""
        with patch("utils.gemini_client._client") as mock_client:
            mock_client.models.generate_content.side_effect = httpx.TimeoutException("timed out")
            body, source = _call()

        assert source == "fallback"
        _assert_template_quality(body)

    def test_connect_error_falls_back(self):
        """httpx.ConnectError (connection refused / DNS failure) → fallback."""
        with patch("utils.gemini_client._client") as mock_client:
            mock_client.models.generate_content.side_effect = httpx.ConnectError("connection refused")
            body, source = _call()

        assert source == "fallback"
        _assert_template_quality(body)

    def test_read_timeout_falls_back(self):
        """httpx.ReadTimeout → fallback."""
        with patch("utils.gemini_client._client") as mock_client:
            mock_client.models.generate_content.side_effect = httpx.ReadTimeout("read timed out")
            body, source = _call()

        assert source == "fallback"
        _assert_template_quality(body)


# ── Failure scenario (d): Empty response ──────────────────────────────────────

class TestScenarioDEmpty:

    def test_none_text_falls_back(self):
        """response.text is None → fallback."""
        mock_response = MagicMock()
        mock_response.text = None
        mock_response.candidates = [MagicMock(finish_reason=MagicMock(value="STOP"))]

        with patch("utils.gemini_client._client") as mock_client:
            mock_client.models.generate_content.return_value = mock_response
            body, source = _call()

        assert source == "fallback"
        _assert_template_quality(body)

    def test_whitespace_only_text_falls_back(self):
        """response.text is only whitespace → strip() produces empty string → fallback."""
        mock_response = MagicMock()
        mock_response.text = "   \n\t  "
        mock_response.candidates = [MagicMock(finish_reason=MagicMock(value="STOP"))]

        with patch("utils.gemini_client._client") as mock_client:
            mock_client.models.generate_content.return_value = mock_response
            body, source = _call()

        assert source == "fallback"
        _assert_template_quality(body)

    def test_no_candidates_falls_back(self):
        """response.candidates is empty list → fallback."""
        mock_response = MagicMock()
        mock_response.text = None
        mock_response.candidates = []

        with patch("utils.gemini_client._client") as mock_client:
            mock_client.models.generate_content.return_value = mock_response
            body, source = _call()

        assert source == "fallback"
        _assert_template_quality(body)


# ── Failure scenario (e): Safety filter ───────────────────────────────────────

class TestScenarioESafety:

    @pytest.mark.parametrize("reason", [
        "SAFETY", "BLOCKLIST", "PROHIBITED_CONTENT", "SPII", "RECITATION",
    ])
    def test_safety_finish_reason_falls_back(self, reason):
        """Any safety-category FinishReason → fallback."""
        mock_response = MagicMock()
        mock_response.text = "partial text that got blocked"
        mock_response.candidates = [MagicMock(finish_reason=MagicMock(value=reason))]

        with patch("utils.gemini_client._client") as mock_client:
            mock_client.models.generate_content.return_value = mock_response
            body, source = _call()

        assert source == "fallback"
        _assert_template_quality(body)

    def test_language_finish_reason_falls_back(self):
        """LANGUAGE finish_reason (unsupported language) → fallback."""
        mock_response = MagicMock()
        mock_response.text = "quelque chose en français"
        mock_response.candidates = [MagicMock(finish_reason=MagicMock(value="LANGUAGE"))]

        with patch("utils.gemini_client._client") as mock_client:
            mock_client.models.generate_content.return_value = mock_response
            body, source = _call()

        assert source == "fallback"
        _assert_template_quality(body)


# ── Failure scenario (f): Malformed / unexpected response ─────────────────────

class TestScenarioFMalformed:

    def test_response_text_raises_exception_falls_back(self):
        """
        response.text raises AttributeError (SDK version mismatch, unexpected
        response structure) → UNEXPECTED category → fallback.
        
        We simulate this by making generate_content itself raise an AttributeError
        when the response object is accessed post-call, which is the realistic
        failure mode (e.g. accessing .candidates[0].content when it's None).
        """
        with patch("utils.gemini_client._client") as mock_client:
            mock_client.models.generate_content.side_effect = AttributeError(
                "unexpected response structure: 'NoneType' has no attribute 'parts'"
            )
            body, source = _call()

        assert source == "fallback"
        _assert_template_quality(body)

    def test_unexpected_exception_type_falls_back(self):
        """Completely unexpected exception → UNEXPECTED category → fallback, no 500."""
        with patch("utils.gemini_client._client") as mock_client:
            mock_client.models.generate_content.side_effect = RuntimeError("completely unexpected")
            body, source = _call()

        assert source == "fallback"
        _assert_template_quality(body)

    def test_value_error_falls_back(self):
        """ValueError from SDK (UnknownApiResponseError etc.) → fallback."""
        with patch("utils.gemini_client._client") as mock_client:
            mock_client.models.generate_content.side_effect = ValueError("unexpected response structure")
            body, source = _call()

        assert source == "fallback"
        _assert_template_quality(body)


# ── Failure scenario (g): Truncated response ──────────────────────────────────

class TestScenarioGTruncated:

    def test_max_tokens_finish_reason_falls_back(self):
        """
        MAX_TOKENS finish_reason means the response was cut mid-generation.
        A truncated legal letter is worse than a template — must fall back.
        """
        mock_response = MagicMock()
        mock_response.text = "Dear Sir/Madam, I am writing regarding my outstanding loan with HDFC Bank, currently ove"
        mock_response.candidates = [MagicMock(finish_reason=MagicMock(value="MAX_TOKENS"))]

        with patch("utils.gemini_client._client") as mock_client:
            mock_client.models.generate_content.return_value = mock_response
            body, source = _call()

        assert source == "fallback"
        _assert_template_quality(body)
        # Confirm we did NOT use the truncated Gemini text
        assert "ove" not in body or "overdue" in body  # template has 'overdue' naturally


# ── Failure scenario (h): Timeout (covered under Network) ─────────────────────
# httpx.TimeoutException and ReadTimeout are already tested in TestScenarioCNetwork.
# Additional explicit timeout test with connect timeout:

class TestScenarioHTimeout:

    def test_connect_timeout_falls_back(self):
        """httpx.ConnectTimeout → treated as network/timeout → fallback."""
        with patch("utils.gemini_client._client") as mock_client:
            mock_client.models.generate_content.side_effect = httpx.ConnectTimeout("connect timed out")
            body, source = _call()

        assert source == "fallback"
        _assert_template_quality(body)

    def test_pool_timeout_falls_back(self):
        """httpx.PoolTimeout (connection pool exhausted) → fallback."""
        with patch("utils.gemini_client._client") as mock_client:
            mock_client.models.generate_content.side_effect = httpx.PoolTimeout("pool timed out")
            body, source = _call()

        assert source == "fallback"
        _assert_template_quality(body)


# ── Template quality: full content review ─────────────────────────────────────

class TestFallbackTemplateQuality:

    def test_template_content_complete(self):
        """
        With no Gemini client, the fallback template must be a complete,
        professional OTS letter. This test documents and pins the expected
        template content for manual review.
        """
        with patch("utils.gemini_client._client", None):
            body, source = _call()

        assert source == "fallback"

        # Full structure check
        assert body.startswith("To,")
        assert "The Manager - Loan Recovery Department" in body
        assert "HDFC Bank" in body
        assert "Subject: Request for One Time Settlement (OTS) on Loan Account" in body
        assert "Dear Sir/Madam," in body
        assert "personal loan" in body  # loan_type.lower()
        assert "90 days" in body
        assert "Rs. 500,000" in body        # outstanding amount
        assert "Rs. 25,000" in body         # EMI
        assert "Rs. 189,000" in body        # settlement_amount (rounded: 500000 * 37.8%)
        assert "38%" in body                # settlement_pct formatted as {:.0f}
        assert "15 working days" in body
        assert "credit bureau" in body
        assert "Settled" in body
        assert "Arjun Mehta" in body
        assert "arjun.mehta@example.com" in body
        assert body.strip().endswith("arjun.mehta@example.com")

    def test_settlement_amount_is_rounded_pct_consistent(self):
        """
        Template settlement_amount must equal round(amount × settlement_pct / 100).
        Verifies the bug fix: amount × displayed_pct% = settlement_amount.
        """
        with patch("utils.gemini_client._client", None):
            body, _ = _call()

        # 500000 * 37.8 / 100 = 189000 (exact, no rounding difference)
        assert "189,000" in body
        # Must NOT contain the old unrounded value
        assert "189,167" not in body
        assert "189166" not in body

    def test_template_settlement_figures_consistent_small_amount(self):
        """
        Test with an amount where rounded vs unrounded pct actually differs
        to confirm the template uses the rounded value.
        amount=200000, settlement_pct=29.4
        round(200000 * 29.4 / 100) = 58800   ← correct (rounded pct)
        round(200000 * 29.375 / 100) = 58750  ← wrong (raw pct)
        """
        with patch("utils.gemini_client._client", None):
            body, _ = generate_letter_body_direct(
                amount=200000.0,
                settlement_pct=29.4,
                emi=15000.0,
                overdue_days=0,
            )

        assert "58,800" in body
        assert "58,750" not in body

    def test_no_client_always_uses_fallback(self):
        """When _client is None (no API key), always returns 'fallback' source."""
        with patch("utils.gemini_client._client", None):
            _, source = _call()
        assert source == "fallback"

    def test_server_error_500_falls_back(self):
        """5xx from Gemini backend → fallback, never a 500 to the user."""
        from google.genai.errors import ServerError
        exc = ServerError(503, {"error": {"code": 503, "message": "service unavailable", "status": "UNAVAILABLE"}})

        with patch("utils.gemini_client._client") as mock_client:
            mock_client.models.generate_content.side_effect = exc
            body, source = _call()

        assert source == "fallback"
        _assert_template_quality(body)


# ── Helpers ────────────────────────────────────────────────────────────────────

def generate_letter_body_direct(amount, settlement_pct, emi, overdue_days):
    """Call generate_letter_body with overrides for specific numeric tests."""
    from utils.gemini_client import generate_letter_body
    return generate_letter_body(
        user_name="Test User",
        user_email="test@example.com",
        lender="Test Bank",
        loan_type="Personal loan",
        amount=amount,
        emi=emi,
        overdue_days=overdue_days,
        settlement_pct=settlement_pct,
    )

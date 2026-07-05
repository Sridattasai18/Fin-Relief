"""
Unit tests for backend/utils/calculations.py

All expected values are hand-verified against the formulas in calculations.py.
Formula reference:
  dti          = min(100, emi / max(income, 1) * 100)
  expenses     = monthly_expenses if given else income * 0.4
  surplus      = income - emi - expenses
  stress_score = min(100, max(0,
                   dti*0.5
                   + min(overdue_days, 180)/180 * 40
                   + (10 if surplus < 0 else 0)))
  settle_pct   = min(70, max(20, 25 + stress_score * 0.35))   → rounded to 1dp
  settlement_amount = round(amount * round(settle_pct, 1) / 100, 2)  [uses rounded pct]
  months_to_clear = max(1, int(amount / max(emi, 1)))
"""
import pytest
from utils.calculations import compute_stress_level, compute_settlement_metrics


# ---------------------------------------------------------------------------
# compute_stress_level — boundary tests
# ---------------------------------------------------------------------------

class TestComputeStressLevel:
    def test_zero_is_low(self):
        assert compute_stress_level(0.0) == "Low"

    def test_boundary_25_is_low(self):
        # exactly 25.0 → Low (condition: score <= 25.0)
        assert compute_stress_level(25.0) == "Low"

    def test_just_above_25_is_medium(self):
        assert compute_stress_level(25.1) == "Medium"

    def test_boundary_50_is_medium(self):
        # exactly 50.0 → Medium
        assert compute_stress_level(50.0) == "Medium"

    def test_just_above_50_is_high(self):
        assert compute_stress_level(50.1) == "High"

    def test_boundary_75_is_high(self):
        # exactly 75.0 → High
        assert compute_stress_level(75.0) == "High"

    def test_just_above_75_is_critical(self):
        assert compute_stress_level(75.1) == "Critical"

    def test_100_is_critical(self):
        assert compute_stress_level(100.0) == "Critical"


# ---------------------------------------------------------------------------
# compute_settlement_metrics — realistic cases
# ---------------------------------------------------------------------------

class TestComputeSettlementMetricsRealistic:

    def test_arjun_mehta_case(self):
        """
        Arjun Mehta persona: income=75000, emi=25000, overdue=90, amount=500000
        Hand calculation:
          dti          = min(100, 25000/75000*100) = 33.333... → 33.3
          expenses     = 75000 * 0.4 = 30000
          surplus      = 75000 - 25000 - 30000 = 20000
          stress_raw   = 33.333*0.5 + 90/180*40 + 0 = 16.667 + 20.0 = 36.667 → 36.7
          stress_level = Medium (36.7 ≤ 50)
          settle_pct   = min(70, max(20, 25 + 36.667*0.35)) = 37.833 → rounded to 37.8
          settlement_amount = round(500000 * 37.8/100, 2) = 189000.0
          months       = max(1, int(500000/25000)) = 20
        """
        result = compute_settlement_metrics(
            income=75000, emi=25000, overdue_days=90, amount=500000
        )
        assert result["dti_ratio"] == 33.3
        assert result["monthly_surplus"] == 20000.0
        assert result["stress_score"] == 36.7
        assert result["stress_level"] == "Medium"
        assert result["settlement_percentage"] == 37.8
        assert result["settlement_amount"] == 189000.0  # 500000 * 37.8% = 189000
        assert result["outstanding_amount"] == 500000
        assert result["months_to_clear_debt"] == 20

    def test_explicit_monthly_expenses(self):
        """
        income=60000, emi=15000, overdue=0, amount=200000, expenses=20000
          dti          = 15000/60000*100 = 25.0
          surplus      = 60000 - 15000 - 20000 = 25000
          stress_raw   = 25*0.5 + 0 + 0 = 12.5 → 12.5
          stress_level = Low
          settle_pct   = 25 + 12.5*0.35 = 29.375 → rounded to 29.4
          settlement_amount = round(200000 * 29.4/100, 2) = 58800.0
          months       = max(1, int(200000/15000)) = 13
        """
        result = compute_settlement_metrics(
            income=60000, emi=15000, overdue_days=0, amount=200000, monthly_expenses=20000
        )
        assert result["dti_ratio"] == 25.0
        assert result["monthly_surplus"] == 25000.0
        assert result["stress_score"] == 12.5
        assert result["stress_level"] == "Low"
        assert result["settlement_percentage"] == 29.4
        assert result["settlement_amount"] == 58800.0  # 200000 * 29.4% = 58800
        assert result["outstanding_amount"] == 200000
        assert result["months_to_clear_debt"] == 13

    def test_negative_surplus_critical_stress(self):
        """
        income=30000, emi=28000, overdue=180, amount=100000, expenses=None
          dti          = min(100, 28000/30000*100) = 93.333... → 93.3
          expenses     = 30000 * 0.4 = 12000
          surplus      = 30000 - 28000 - 12000 = -10000  (negative → +10 penalty)
          stress_raw   = 93.333*0.5 + 180/180*40 + 10 = 46.667 + 40 + 10 = 96.667 → 96.7
          stress_level = Critical
          settle_pct   = min(70, max(20, 25 + 96.667*0.35)) = min(70, 58.833) → rounded to 58.8
          settlement_amount = round(100000 * 58.8/100, 2) = 58800.0
          months       = max(1, int(100000/28000)) = 3
        """
        result = compute_settlement_metrics(
            income=30000, emi=28000, overdue_days=180, amount=100000
        )
        assert result["dti_ratio"] == 93.3
        assert result["monthly_surplus"] == -10000.0
        assert result["stress_score"] == 96.7
        assert result["stress_level"] == "Critical"
        assert result["settlement_percentage"] == 58.8
        assert result["settlement_amount"] == 58800.0  # 100000 * 58.8% = 58800
        assert result["months_to_clear_debt"] == 3


# ---------------------------------------------------------------------------
# compute_settlement_metrics — edge cases
# ---------------------------------------------------------------------------

class TestComputeSettlementMetricsEdgeCases:

    def test_zero_overdue_days(self):
        """
        income=50000, emi=10000, overdue=0, amount=300000
          dti          = 10000/50000*100 = 20.0
          expenses     = 50000*0.4 = 20000
          surplus      = 50000-10000-20000 = 20000
          stress_raw   = 20*0.5 + 0 + 0 = 10.0
          stress_level = Low
          settle_pct   = 25 + 10*0.35 = 28.5
          settlement_amount = 300000*28.5/100 = 85500.0
          months       = int(300000/10000) = 30
        """
        result = compute_settlement_metrics(
            income=50000, emi=10000, overdue_days=0, amount=300000
        )
        assert result["dti_ratio"] == 20.0
        assert result["monthly_surplus"] == 20000.0
        assert result["stress_score"] == 10.0
        assert result["stress_level"] == "Low"
        assert result["settlement_percentage"] == 28.5
        assert result["settlement_amount"] == 85500.0
        assert result["months_to_clear_debt"] == 30

    def test_zero_income_guard(self):
        """
        income=0 — must not crash. max(income, 1) guard kicks in.
          dti          = min(100, 5000/1*100) = 100.0 (clamped)
          expenses     = 0 * 0.4 = 0.0
          surplus      = 0 - 5000 - 0 = -5000  (negative → +10)
          stress_raw   = 100*0.5 + 0 + 10 = 60.0
          stress_level = High
          settle_pct   = min(70, max(20, 25 + 60*0.35)) = min(70, 46.0) = 46.0
          settlement_amount = 100000*46/100 = 46000.0
          months       = max(1, int(100000/5000)) = 20
        """
        result = compute_settlement_metrics(
            income=0, emi=5000, overdue_days=0, amount=100000
        )
        assert result["dti_ratio"] == 100.0
        assert result["monthly_surplus"] == -5000.0
        assert result["stress_score"] == 60.0
        assert result["stress_level"] == "High"
        assert result["settlement_percentage"] == 46.0
        assert result["settlement_amount"] == 46000.0
        assert result["months_to_clear_debt"] == 20

    def test_zero_emi_guard(self):
        """
        income=50000, emi=0 — max(emi, 1) prevents division by zero in months calc.
          dti          = 0/50000*100 = 0.0
          expenses     = 50000*0.4 = 20000
          surplus      = 50000-0-20000 = 30000
          stress_raw   = 0 + 0 + 0 = 0.0
          stress_level = Low
          settle_pct   = min(70, max(20, 25+0)) = 25.0
          settlement_amount = 100000*25/100 = 25000.0
          months       = max(1, int(100000/1)) = 100000
        """
        result = compute_settlement_metrics(
            income=50000, emi=0, overdue_days=0, amount=100000
        )
        assert result["dti_ratio"] == 0.0
        assert result["monthly_surplus"] == 30000.0
        assert result["stress_score"] == 0.0
        assert result["stress_level"] == "Low"
        assert result["settlement_percentage"] == 25.0
        assert result["settlement_amount"] == 25000.0
        assert result["months_to_clear_debt"] == 100000

    def test_overdue_days_capped_at_180(self):
        """
        overdue_days=365 should behave identically to overdue_days=180 in the formula.
        (min(overdue_days, 180) is applied)
        """
        result_365 = compute_settlement_metrics(
            income=50000, emi=10000, overdue_days=365, amount=100000
        )
        result_180 = compute_settlement_metrics(
            income=50000, emi=10000, overdue_days=180, amount=100000
        )
        assert result_365["stress_score"] == result_180["stress_score"]
        assert result_365["settlement_percentage"] == result_180["settlement_percentage"]

    def test_stress_score_clamped_at_100(self):
        """
        Force maximum possible stress: high DTI + max overdue + negative surplus.
        income=1, emi=1000000, overdue=180, expenses=0
          dti          = min(100, 1000000/1*100) = 100.0
          expenses     = 0 (provided)
          surplus      = 1-1000000-0 = -999999 (negative → +10)
          stress_raw   = 50 + 40 + 10 = 100.0  → clamped at 100
          settle_pct   = min(70, max(20, 25+35)) = min(70, 60) = 60.0
          → confirms 70% cap is never reached with current formula
        """
        result = compute_settlement_metrics(
            income=1, emi=1000000, overdue_days=180, amount=100000, monthly_expenses=0
        )
        assert result["stress_score"] == 100.0
        assert result["stress_level"] == "Critical"
        assert result["settlement_percentage"] == 60.0  # NOT 70 — max formula output is 60

    def test_stress_score_floor_at_zero(self):
        """
        Very low stress — score cannot go negative.
        income=100000, emi=1000, overdue=0, expenses=1000
          dti    = 1000/100000*100 = 1.0
          surplus = 100000-1000-1000 = 98000
          stress  = max(0, 0.5 + 0 + 0) = 0.5
        """
        result = compute_settlement_metrics(
            income=100000, emi=1000, overdue_days=0, amount=500000, monthly_expenses=1000
        )
        assert result["stress_score"] == 0.5
        assert result["stress_level"] == "Low"

    def test_large_values_no_overflow(self):
        """
        Millions-scale debt — check no float overflow or precision loss.
        income=5000000, emi=1000000, overdue=365, amount=50000000
          dti          = 1000000/5000000*100 = 20.0
          expenses     = 5000000*0.4 = 2000000
          surplus      = 5000000-1000000-2000000 = 2000000
          stress_raw   = 20*0.5 + 180/180*40 + 0 = 10 + 40 + 0 = 50.0
          stress_level = Medium (exactly 50)
          settle_pct   = 25 + 50*0.35 = 42.5
          settlement_amount = 50000000*42.5/100 = 21250000.0
          months       = int(50000000/1000000) = 50
        """
        result = compute_settlement_metrics(
            income=5000000, emi=1000000, overdue_days=365, amount=50000000
        )
        assert result["dti_ratio"] == 20.0
        assert result["stress_score"] == 50.0
        assert result["stress_level"] == "Medium"
        assert result["settlement_percentage"] == 42.5
        assert result["settlement_amount"] == 21250000.0
        assert result["months_to_clear_debt"] == 50

    def test_expenses_default_equals_explicit_40pct(self):
        """
        Passing monthly_expenses=income*0.4 explicitly must produce
        identical results to passing monthly_expenses=None.
        """
        income = 80000
        result_default = compute_settlement_metrics(
            income=income, emi=20000, overdue_days=60, amount=400000,
            monthly_expenses=None
        )
        result_explicit = compute_settlement_metrics(
            income=income, emi=20000, overdue_days=60, amount=400000,
            monthly_expenses=income * 0.4
        )
        assert result_default == result_explicit

    def test_months_to_clear_minimum_one(self):
        """
        If amount < emi, int(amount/emi) = 0, but max(1, ...) ensures minimum 1.
        """
        result = compute_settlement_metrics(
            income=100000, emi=500000, overdue_days=0, amount=100000
        )
        assert result["months_to_clear_debt"] == 1

    def test_settlement_amount_uses_rounded_pct(self):
        """
        settlement_amount must derive from the rounded settlement_percentage,
        not the raw internal value — so the user can verify the math themselves:
        displayed_pct% × outstanding_amount = settlement_amount.

        For income=60000, emi=15000, overdue=0, amount=200000, expenses=20000:
          settle_pct_raw     = 29.375
          settle_pct_rounded = 29.4  (shown to user)
          settlement_amount  = round(200000 * 29.4/100, 2) = 58800.0  ✓ verifiable
          NOT 58750.0        = round(200000 * 29.375/100, 2)           ✗ doesn't match display
        """
        result = compute_settlement_metrics(
            income=60000, emi=15000, overdue_days=0, amount=200000, monthly_expenses=20000
        )
        assert result["settlement_percentage"] == 29.4
        assert result["settlement_amount"] == 58800.0  # from rounded 29.4%, not raw 29.375%
        # Verify the user can reproduce this: 200000 × 29.4% = 58800
        assert result["settlement_amount"] == round(result["outstanding_amount"] * result["settlement_percentage"] / 100, 2)

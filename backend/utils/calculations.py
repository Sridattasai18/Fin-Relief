def compute_stress_level(stress_score: float) -> str:
    """Map numeric stress score to textual level."""
    if stress_score <= 25.0:
        return "Low"
    elif stress_score <= 50.0:
        return "Medium"
    elif stress_score <= 75.0:
        return "High"
    else:
        return "Critical"

def compute_settlement_metrics(
    income: float,
    emi: float,
    overdue_days: int,
    amount: float,
    monthly_expenses: float = None
) -> dict:
    """
    Core formulas for DTI, surplus, stress score, stress level,
    recommended settlement percentage, and months to clear debt.
    """
    dti = min(100.0, (emi / max(income, 1.0)) * 100.0)
    
    # Use actual monthly expenses if provided, otherwise default to 40% of income
    expenses_value = monthly_expenses if monthly_expenses is not None else (income * 0.4)
    surplus = income - emi - expenses_value
    
    stress_score = min(
        100.0,
        max(
            0.0,
            (dti * 0.5) + (min(overdue_days, 180) / 180.0 * 40.0) + (10.0 if surplus < 0 else 0.0)
        )
    )
    
    settle_pct = min(70.0, max(20.0, 25.0 + (stress_score * 0.35)))
    # Round once — both the displayed percentage and the rupee amount derive
    # from the same value so a user can verify: amount × pct% = settlement_amount.
    settle_pct_rounded = round(settle_pct, 1)
    stress_level = compute_stress_level(stress_score)
    
    # Months to clear debt remaining
    months_to_clear = int(amount / max(emi, 1.0))
    
    return {
        "dti_ratio": round(dti, 1),
        "monthly_surplus": round(surplus, 2),
        "stress_score": round(stress_score, 1),
        "stress_level": stress_level,
        "settlement_percentage": settle_pct_rounded,
        "settlement_amount": round(amount * settle_pct_rounded / 100.0, 2),
        "outstanding_amount": amount,
        "months_to_clear_debt": max(1, months_to_clear)
    }

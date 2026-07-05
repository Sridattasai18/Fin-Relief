from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from models import Loan, User, Letter
from schemas import DashboardOut
from auth import get_current_user
from utils.calculations import compute_settlement_metrics

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

@router.get("", response_model=DashboardOut)
def get_dashboard_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Computes aggregate stats across all user loans: DTI, surplus, stress score,
    and total letters generated.
    """
    loans = db.query(Loan).filter(Loan.owner_id == current_user.id).all()
    letter_count = db.query(Letter).filter(Letter.owner_id == current_user.id).count()

    if not loans:
        return {
            "loan_count": 0,
            "total_debt": 0.0,
            "total_emi": 0.0,
            "avg_dti": 0.0,
            "overall_stress": 0.0,
            "recommended_settlement_pct": 0.0,
            "monthly_surplus": 0.0,
            "letter_count": 0
        }

    total_debt = sum(loan.amount for loan in loans)
    total_emi = sum(loan.emi for loan in loans)
    
    # Compute per-loan metrics
    metrics_list = []
    for loan in loans:
        m = compute_settlement_metrics(
            income=loan.income,
            emi=loan.emi,
            overdue_days=loan.overdue_days,
            amount=loan.amount,
            monthly_expenses=loan.monthly_expenses
        )
        metrics_list.append((loan, m))

    avg_dti = sum(m["dti_ratio"] for _loan, m in metrics_list) / len(metrics_list)
    overall_stress = sum(m["stress_score"] for _loan, m in metrics_list) / len(metrics_list)
    recommended_settlement_pct = sum(m["settlement_percentage"] for _loan, m in metrics_list) / len(metrics_list)

    # Determine monthly surplus using the loan with the highest income as the proxy
    loan_with_max_income = max(loans, key=lambda ln: ln.income)
    max_income = loan_with_max_income.income
    
    expenses_value = (
        loan_with_max_income.monthly_expenses 
        if loan_with_max_income.monthly_expenses is not None 
        else (max_income * 0.4)
    )
    
    monthly_surplus = max_income - total_emi - expenses_value

    return {
        "loan_count": len(loans),
        "total_debt": round(total_debt, 2),
        "total_emi": round(total_emi, 2),
        "avg_dti": round(avg_dti, 1),
        "overall_stress": round(overall_stress, 1),
        "recommended_settlement_pct": round(recommended_settlement_pct, 1),
        "monthly_surplus": round(monthly_surplus, 2),
        "letter_count": letter_count
    }

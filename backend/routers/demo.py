from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from models import Loan, User
from auth import get_current_user
from schemas import LoanOut
from typing import List

router = APIRouter(prefix="/demo", tags=["demo"])

@router.post("/seed", response_model=List[LoanOut], status_code=201)
def seed_demo_data(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Seeds 3 realistic sample loans for the authenticated user to facilitate
    quick evaluation without manual entry.
    """
    # Delete existing loans for a clean demo slate (optional, but very helpful for testing)
    db.query(Loan).filter(Loan.owner_id == current_user.id).delete()
    db.commit()

    sample_loans = [
        Loan(
            owner_id=current_user.id,
            lender="HDFC Bank",
            loan_type="Personal loan",
            amount=150000.0,
            emi=6500.0,
            overdue_days=45,
            income=35000.0,
            monthly_expenses=12000.0
        ),
        Loan(
            owner_id=current_user.id,
            lender="SBI Card",
            loan_type="Credit card",
            amount=80000.0,
            emi=4000.0,
            overdue_days=15,
            income=35000.0,
            monthly_expenses=12000.0
        ),
        Loan(
            owner_id=current_user.id,
            lender="KreditBee",
            loan_type="Digital lending app",
            amount=25000.0,
            emi=3000.0,
            overdue_days=90,
            income=35000.0,
            monthly_expenses=12000.0
        )
    ]

    db.add_all(sample_loans)
    db.commit()

    # Refresh instances
    for loan in sample_loans:
        db.refresh(loan)
        
    return sample_loans

import datetime
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from models import Loan, User, StressSnapshot
from schemas import SettlementOut, SnapshotOut
from auth import get_current_user
from utils.calculations import compute_settlement_metrics

router = APIRouter(prefix="", tags=["settlement"])

@router.post("/settlement/{loan_id}", response_model=SettlementOut)
def compute_settlement(
    loan_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Computes settlement parameters for a loan and automatically
    persists a StressSnapshot to the database (with 5-minute deduplication).
    """
    loan = db.query(Loan).filter(Loan.id == loan_id, Loan.owner_id == current_user.id).first()
    if not loan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Loan not found."
        )

    # Calculate metrics
    m = compute_settlement_metrics(
        income=loan.income,
        emi=loan.emi,
        overdue_days=loan.overdue_days,
        amount=loan.amount,
        monthly_expenses=loan.monthly_expenses
    )

    # Persist snapshot if no snapshot exists for this loan in the last 5 minutes
    recent_cutoff = datetime.datetime.utcnow() - datetime.timedelta(minutes=5)
    recent = db.query(StressSnapshot).filter(
        StressSnapshot.loan_id == loan_id,
        StressSnapshot.owner_id == current_user.id,
        StressSnapshot.created_at >= recent_cutoff
    ).first()

    if not recent:
        snap = StressSnapshot(
            owner_id=current_user.id,
            loan_id=loan.id,
            lender=loan.lender,
            dti_ratio=m["dti_ratio"],
            stress_score=m["stress_score"],
            stress_level=m["stress_level"],
            settlement_percentage=m["settlement_percentage"],
            monthly_surplus=m["monthly_surplus"],
            months_to_clear_debt=m["months_to_clear_debt"]
        )
        db.add(snap)
        db.commit()

    return {
        "loan_id": loan.id,
        "lender": loan.lender,
        "dti_ratio": m["dti_ratio"],
        "stress_score": m["stress_score"],
        "stress_level": m["stress_level"],
        "settlement_percentage": m["settlement_percentage"],
        "settlement_amount": m["settlement_amount"],
        "outstanding_amount": m["outstanding_amount"],
        "monthly_surplus": m["monthly_surplus"],
        "months_to_clear_debt": m["months_to_clear_debt"],
        "is_estimated": True
    }

@router.get("/snapshots", response_model=List[SnapshotOut])
def list_all_snapshots(
    limit: int = 30,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieve all snapshots for the logged-in user (useful for dashboard trend charts)."""
    return (
        db.query(StressSnapshot)
        .filter(StressSnapshot.owner_id == current_user.id)
        .order_by(StressSnapshot.created_at.asc())
        .limit(limit)
        .all()
    )

@router.get("/snapshots/{loan_id}", response_model=List[SnapshotOut])
def list_loan_snapshots(
    loan_id: int,
    limit: int = 30,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieve snapshots specific to a given loan."""
    # Verify loan ownership
    loan = db.query(Loan).filter(Loan.id == loan_id, Loan.owner_id == current_user.id).first()
    if not loan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Loan not found or unauthorized access."
        )
    return (
        db.query(StressSnapshot)
        .filter(StressSnapshot.owner_id == current_user.id, StressSnapshot.loan_id == loan_id)
        .order_by(StressSnapshot.created_at.asc())
        .limit(limit)
        .all()
    )

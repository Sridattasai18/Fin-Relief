import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field

# User auth schemas
class UserRegister(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=8)

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserOut(BaseModel):
    id: int
    name: str
    email: EmailStr
    created_at: datetime.datetime

    class Config:
        from_attributes = True

class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut

# Loan schemas
class LoanCreate(BaseModel):
    lender: str = Field(..., min_length=1)
    loan_type: str = "Personal loan"
    amount: float = Field(..., gt=0)
    emi: float = Field(..., gt=0)
    overdue_days: int = Field(0, ge=0)
    income: float = Field(..., gt=0)
    monthly_expenses: Optional[float] = Field(None, gt=0)

class LoanPatch(BaseModel):
    lender: Optional[str] = None
    loan_type: Optional[str] = None
    amount: Optional[float] = Field(None, gt=0)
    emi: Optional[float] = Field(None, gt=0)
    overdue_days: Optional[int] = Field(None, ge=0)
    income: Optional[float] = Field(None, gt=0)
    monthly_expenses: Optional[float] = Field(None, gt=0)

class LoanOut(BaseModel):
    id: int
    owner_id: int
    lender: str
    loan_type: str
    amount: float
    emi: float
    overdue_days: int
    income: float
    monthly_expenses: Optional[float] = None
    created_at: datetime.datetime
    updated_at: datetime.datetime

    class Config:
        from_attributes = True

# Settlement and snapshot schemas
class SettlementOut(BaseModel):
    loan_id: int
    lender: str
    dti_ratio: float
    stress_score: float
    stress_level: str
    settlement_percentage: float
    settlement_amount: float
    outstanding_amount: float
    monthly_surplus: float
    months_to_clear_debt: int
    is_estimated: bool = True

class SnapshotOut(BaseModel):
    id: int
    loan_id: int
    lender: str
    dti_ratio: float
    stress_score: float
    stress_level: str
    settlement_percentage: float
    monthly_surplus: float
    months_to_clear_debt: int
    created_at: datetime.datetime

    class Config:
        from_attributes = True

# Letter schemas
class LetterCreate(BaseModel):
    # Usually generated automatically, but client can specify loan_id
    loan_id: int

class LetterUpdate(BaseModel):
    letter_text: str

class LetterOut(BaseModel):
    id: int
    loan_id: int
    lender: str
    settlement_pct: float
    letter_text: str
    source: str
    version: int
    created_at: datetime.datetime

    class Config:
        from_attributes = True

# Dashboard schemas
class DashboardOut(BaseModel):
    loan_count: int
    total_debt: float
    total_emi: float
    avg_dti: float
    overall_stress: float
    recommended_settlement_pct: float
    monthly_surplus: float
    letter_count: int

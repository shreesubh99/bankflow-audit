from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.schema import AppSetting, DailySummary
from app.schemas.dtos import OpeningBalanceUpdate

router = APIRouter(prefix="/api/settings", tags=["Settings"])

def get_initial_opening_balance_val(db: Session) -> float:
    setting = db.query(AppSetting).filter(AppSetting.key == "initial_opening_balance").first()
    if setting:
        try:
            return float(setting.value)
        except ValueError:
            return 0.0
    return 0.0

@router.get("/opening-balance")
def get_opening_balance(db: Session = Depends(get_db)):
    val = get_initial_opening_balance_val(db)
    # Also fetch latest closing balance
    latest = db.query(DailySummary).order_by(DailySummary.summary_date.desc()).first()
    current_closing = latest.closing_balance if latest else val
    return {
        "initial_opening_balance": val,
        "current_closing_balance": current_closing
    }

@router.post("/opening-balance")
def set_opening_balance(req: OpeningBalanceUpdate, db: Session = Depends(get_db)):
    setting = db.query(AppSetting).filter(AppSetting.key == "initial_opening_balance").first()
    if not setting:
        setting = AppSetting(key="initial_opening_balance", value=str(req.amount))
        db.add(setting)
    else:
        setting.value = str(req.amount)
    db.commit()

    # Recalculate all daily summaries in chronological order
    summaries = db.query(DailySummary).order_by(DailySummary.summary_date.asc()).all()
    running = round(req.amount, 2)
    for s in summaries:
        s.opening_balance = running
        s.closing_balance = round(running + (s.bank_credits or 0.0) - (s.bank_debits or 0.0), 2)
        running = s.closing_balance
    db.commit()

    return {
        "status": "SUCCESS",
        "initial_opening_balance": req.amount,
        "current_closing_balance": running,
        "message": f"Updated opening balance to ₹{req.amount:,.2f} and recalculated {len(summaries)} daily bank ledger records."
    }

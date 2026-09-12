from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.schema import Fund, FundAllocation, Transaction
from app.schemas.dtos import FundDTO, FundTreeNode, FundAllocationRequest, AutoAllocateRequest
from app.engine.fund_tracker import FundTrackerEngine

router = APIRouter(prefix="/api/funds", tags=["Funds"])

@router.get("", response_model=List[FundDTO])
def get_funds_ledger(
    sector: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(Fund)
    if sector:
        query = query.filter(Fund.source_sector == sector)
    if status:
        query = query.filter(Fund.status == status)

    funds = query.order_by(Fund.source_date.desc()).all()
    return [FundDTO.model_validate(f) for f in funds]

@router.get("/{fund_id}/trace", response_model=FundTreeNode)
def get_fund_trace(fund_id: str, db: Session = Depends(get_db)):
    fund = db.query(Fund).filter(Fund.id == fund_id).first()
    if not fund:
        raise HTTPException(status_code=404, detail="Fund not found")

    allocations = db.query(FundAllocation).filter(FundAllocation.fund_id == fund_id).all()
    expense_ids = [a.expense_txn_id for a in allocations]
    expenses = db.query(Transaction).filter(Transaction.id.in_(expense_ids)).all() if expense_ids else []

    exp_map = {e.id: {
        "party_name": e.party_name,
        "expense_sector": e.expense_sector,
        "category": e.category,
        "txn_reference": e.txn_reference
    } for e in expenses}

    fund_dict = {
        "id": fund.id,
        "fund_code": fund.fund_code,
        "source_date": fund.source_date,
        "source_sector": fund.source_sector,
        "original_amount": fund.original_amount,
        "spent_amount": fund.spent_amount,
        "remaining_amount": fund.remaining_amount,
        "status": fund.status
    }

    alloc_dicts = [{
        "id": a.id,
        "fund_id": a.fund_id,
        "expense_txn_id": a.expense_txn_id,
        "amount_allocated": a.amount_allocated,
        "allocation_date": a.allocation_date
    } for a in allocations]

    tree = FundTrackerEngine.build_fund_trace_tree(fund_dict, alloc_dicts, exp_map)
    return tree

@router.get("/reverse-trace/{expense_txn_id}")
def get_reverse_trace(expense_txn_id: str, db: Session = Depends(get_db)):
    expense = db.query(Transaction).filter(Transaction.id == expense_txn_id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense transaction not found")

    allocations = db.query(FundAllocation).filter(FundAllocation.expense_txn_id == expense_txn_id).all()
    fund_ids = [a.fund_id for a in allocations]
    funds = db.query(Fund).filter(Fund.id.in_(fund_ids)).all() if fund_ids else []

    funds_map = {f.id: {
        "id": f.id,
        "fund_code": f.fund_code,
        "source_sector": f.source_sector,
        "source_date": f.source_date
    } for f in funds}

    exp_dict = {
        "id": expense.id,
        "party_name": expense.party_name,
        "expense_sector": expense.expense_sector,
        "amount": expense.amount,
        "txn_date": expense.txn_date
    }

    alloc_dicts = [{
        "fund_id": a.fund_id,
        "expense_txn_id": a.expense_txn_id,
        "amount_allocated": a.amount_allocated,
        "allocation_method": a.allocation_method
    } for a in allocations]

    return FundTrackerEngine.build_reverse_trace(exp_dict, alloc_dicts, funds_map)

@router.post("/allocate")
def allocate_fund(req: FundAllocationRequest, db: Session = Depends(get_db)):
    fund = db.query(Fund).filter(Fund.id == req.fund_id).first()
    if not fund:
        raise HTTPException(status_code=404, detail="Fund not found")
    expense = db.query(Transaction).filter(Transaction.id == req.expense_txn_id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense transaction not found")

    if req.amount > fund.remaining_amount:
        raise HTTPException(status_code=400, detail=f"Allocated amount ₹{req.amount} exceeds fund remaining balance ₹{fund.remaining_amount}")

    alloc = FundAllocation(
        fund_id=req.fund_id,
        expense_txn_id=req.expense_txn_id,
        amount_allocated=req.amount,
        allocation_date=expense.txn_date,
        allocation_method=req.allocation_method,
        notes=req.notes
    )
    db.add(alloc)

    fund.allocated_amount = round(fund.allocated_amount + req.amount, 2)
    fund.spent_amount = round(fund.spent_amount + req.amount, 2)
    fund.remaining_amount = round(fund.original_amount - fund.spent_amount, 2)
    if fund.remaining_amount <= 0.01:
        fund.status = "FULLY USED"
    else:
        fund.status = "PARTIALLY USED"

    db.commit()
    return {"status": "SUCCESS", "message": f"Allocated ₹{req.amount:,.2f} from {fund.fund_code} to {expense.party_name or 'Expense'}"}

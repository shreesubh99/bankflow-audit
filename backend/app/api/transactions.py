import csv
import io
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.core.database import get_db
from app.models.schema import Transaction, ClassificationHistory, TransactionLink
from app.schemas.dtos import TransactionDTO, TransactionListResponse, TransactionUpdate

router = APIRouter(prefix="/api/transactions", tags=["Transactions"])

@router.get("", response_model=TransactionListResponse)
def list_transactions(
    search: Optional[str] = Query(None),
    direction: Optional[str] = Query(None),
    nature: Optional[str] = Query(None),
    channel: Optional[str] = Query(None),
    sector: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    has_flag: Optional[bool] = Query(None),
    is_duplicate: Optional[bool] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    sort_by: str = Query("txn_date"),
    order: str = Query("desc"),
    db: Session = Depends(get_db)
):
    query = db.query(Transaction)

    if search:
        s = f"%{search}%"
        query = query.filter(
            or_(
                Transaction.party_name.ilike(s),
                Transaction.description.ilike(s),
                Transaction.bank_ref_utr.ilike(s),
                Transaction.txn_reference.ilike(s),
                Transaction.source_sheet.ilike(s)
            )
        )

    if direction:
        query = query.filter(Transaction.direction == direction)
    if nature:
        query = query.filter(Transaction.transaction_nature == nature)
    if channel:
        query = query.filter(Transaction.payment_channel == channel)
    if sector:
        query = query.filter(
            or_(Transaction.source_sector == sector, Transaction.expense_sector == sector)
        )
    if start_date:
        query = query.filter(Transaction.txn_date >= start_date)
    if end_date:
        query = query.filter(Transaction.txn_date <= end_date)
    if has_flag is True:
        query = query.filter(Transaction.audit_flag.isnot(None))
    elif has_flag is False:
        query = query.filter(Transaction.audit_flag.is_(None))
    if is_duplicate is not None:
        query = query.filter(Transaction.is_duplicate == is_duplicate)

    total = query.count()

    # Sort
    col = getattr(Transaction, sort_by, Transaction.txn_date)
    if order.lower() == "desc":
        query = query.order_by(col.desc())
    else:
        query = query.order_by(col.asc())

    txns = query.offset((page - 1) * page_size).limit(page_size).all()

    return TransactionListResponse(
        total=total,
        page=page,
        page_size=page_size,
        transactions=[TransactionDTO.model_validate(t) for t in txns]
    )

@router.get("/export/csv")
def export_transactions_csv(
    search: Optional[str] = Query(None),
    direction: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(Transaction)
    if search:
        s = f"%{search}%"
        query = query.filter(
            or_(
                Transaction.party_name.ilike(s),
                Transaction.description.ilike(s),
                Transaction.bank_ref_utr.ilike(s)
            )
        )
    if direction:
        query = query.filter(Transaction.direction == direction)
    if start_date:
        query = query.filter(Transaction.txn_date >= start_date)
    if end_date:
        query = query.filter(Transaction.txn_date <= end_date)

    txns = query.order_by(Transaction.txn_date.asc()).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Transaction ID", "Date", "Time", "Sheet", "Table", "Direction", "Nature",
        "Channel", "Party", "Amount", "Source Sector", "Expense Sector", "Category",
        "UTR/Ref", "Description", "Status", "Confidence", "Audit Flag", "Original Row"
    ])

    for t in txns:
        writer.writerow([
            t.id, t.txn_date, t.txn_time or "", t.source_sheet, t.source_table,
            t.direction, t.transaction_nature, t.payment_channel, t.party_name or "",
            t.amount, t.source_sector or "", t.expense_sector or "", t.category or "",
            t.bank_ref_utr or "", t.description or "", t.status, f"{t.confidence_score}%",
            t.audit_flag or "", t.original_row
        ])

    response = Response(content=output.getvalue(), media_type="text/csv")
    response.headers["Content-Disposition"] = "attachment; filename=transactions_export.csv"
    return response

@router.get("/{txn_id}")
def get_transaction_detail(txn_id: str, db: Session = Depends(get_db)):
    t = db.query(Transaction).filter(Transaction.id == txn_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Transaction not found")

    history = db.query(ClassificationHistory).filter(ClassificationHistory.txn_id == txn_id).all()
    links = db.query(TransactionLink).filter(
        or_(TransactionLink.source_txn_id == txn_id, TransactionLink.target_txn_id == txn_id)
    ).all()

    return {
        "transaction": TransactionDTO.model_validate(t),
        "history": [{
            "id": h.id,
            "old_nature": h.old_nature,
            "new_nature": h.new_nature,
            "old_sector": h.old_sector,
            "new_sector": h.new_sector,
            "old_category": h.old_category,
            "new_category": h.new_category,
            "changed_by": h.changed_by,
            "reason": h.reason,
            "created_at": h.created_at.isoformat() if h.created_at else None
        } for h in history],
        "links": [{
            "source_txn_id": l.source_txn_id,
            "target_txn_id": l.target_txn_id,
            "link_type": l.link_type,
            "notes": l.notes
        } for l in links]
    }

@router.patch("/{txn_id}", response_model=TransactionDTO)
def update_transaction(txn_id: str, req: TransactionUpdate, db: Session = Depends(get_db)):
    t = db.query(Transaction).filter(Transaction.id == txn_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Transaction not found")

    # Record history
    hist = ClassificationHistory(
        txn_id=txn_id,
        old_nature=t.transaction_nature,
        new_nature=req.transaction_nature or t.transaction_nature,
        old_sector=t.source_sector or t.expense_sector,
        new_sector=req.source_sector or req.expense_sector or t.source_sector,
        old_category=t.category,
        new_category=req.category or t.category,
        changed_by="USER",
        reason=req.reason
    )
    db.add(hist)

    if req.transaction_nature:
        t.transaction_nature = req.transaction_nature
        if req.transaction_nature in ("SELF TRANSFER", "UPI SETTLEMENT"):
            if t.source_table == "ONLINE_PAYMENT":
                t.direction = "OUT"
            else:
                t.direction = "INTERNAL"
        elif req.transaction_nature in ("CUSTOMER RECEIPT", "BANK DEPOSIT", "UPI QR COLLECTION"):
            t.direction = "IN"
        elif req.transaction_nature in ("EXPENSE", "CARD PAYMENT", "BANK CHARGE", "PERSONAL EXPENSE"):
            t.direction = "OUT"

    if req.source_sector:
        t.source_sector = req.source_sector
    if req.expense_sector:
        t.expense_sector = req.expense_sector
    if req.category:
        t.category = req.category
    if req.fund_id:
        t.fund_id = req.fund_id

    t.status = "USER CLASSIFIED"
    t.confidence_score = 100.0

    db.commit()
    db.refresh(t)
    return TransactionDTO.model_validate(t)

from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.core.database import get_db
from app.models.schema import Transaction, Fund, AuditFlag, DailySummary, FundAllocation
from app.schemas.dtos import DashboardSummaryDTO, DashboardChartsDTO

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])

@router.get("/summary", response_model=DashboardSummaryDTO)
def get_dashboard_summary(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(Transaction)
    if start_date:
        query = query.filter(Transaction.txn_date >= start_date)
    if end_date:
        query = query.filter(Transaction.txn_date <= end_date)

    txns = query.all()

    total_receipts = sum(t.amount for t in txns if t.direction == "IN")
    total_expenses = sum(t.amount for t in txns if t.direction == "OUT")
    net_operating = total_receipts - total_expenses

    upi_collections = sum(t.amount for t in txns if t.source_table == "UPI_QR" and t.direction == "IN")
    
    cash_keywords = ("CASH", "CARDLESS", "CARDLESH", "CDM", "CURRENCY")
    cash_deposits = 0.0
    bank_transfer_deposits = 0.0
    
    for t in txns:
        if t.source_table == "BANK_DEPOSIT":
            text = f"{t.party_name or ''} {t.description or ''}".upper()
            if any(k in text for k in cash_keywords):
                cash_deposits += t.amount
            else:
                bank_transfer_deposits += t.amount

    # Direct Bank Deposits = Full Table 1 Sum (all rows in Table 1)
    direct_bank_deposits = sum(t.amount for t in txns if t.source_table == "BANK_DEPOSIT")
    # Total Bank Deposits = Table 1 Sum + Table 2 Sum (UPI QR)
    total_bank_deposits = direct_bank_deposits + upi_collections
    internal_transfers = sum(t.amount for t in txns if t.direction == "INTERNAL")
    # Total Bank Inflows/Credits = Total Bank Deposits (Table 1 + Table 2)
    total_bank_credits = total_bank_deposits
    total_bank_debits = sum(t.amount for t in txns if t.source_table == "ONLINE_PAYMENT")
    total_turnover = total_bank_deposits

    # Opening & Closing Bank Balance
    from app.api.settings import get_initial_opening_balance_val
    initial_opening_bal = get_initial_opening_balance_val(db)
    latest_daily = db.query(DailySummary).order_by(DailySummary.summary_date.desc()).first()
    current_closing_bal = latest_daily.closing_balance if latest_daily else initial_opening_bal

    # Unallocated funds
    funds = db.query(Fund).all()
    unallocated_funds = sum(f.remaining_amount for f in funds)

    exceptions_count = db.query(AuditFlag).filter(AuditFlag.status == "OPEN").count()

    dates = [t.txn_date for t in txns if t.txn_date]
    p_start = min(dates) if dates else None
    p_end = max(dates) if dates else None

    return DashboardSummaryDTO(
        initial_opening_balance=round(initial_opening_bal, 2),
        current_closing_balance=round(current_closing_bal, 2),
        total_turnover=round(total_turnover, 2),
        total_receipts=round(total_receipts, 2),
        total_expenses=round(total_expenses, 2),
        net_operating_movement=round(net_operating, 2),
        total_bank_credits=round(total_bank_credits, 2),
        total_bank_debits=round(total_bank_debits, 2),
        upi_collections=round(upi_collections, 2),
        bank_deposits=round(total_bank_deposits, 2),
        direct_bank_deposits=round(direct_bank_deposits, 2),
        cash_deposits=round(cash_deposits, 2),
        bank_transfer_deposits=round(bank_transfer_deposits, 2),
        internal_transfers=round(internal_transfers, 2),
        unallocated_funds=round(unallocated_funds, 2),
        audit_exceptions_count=exceptions_count,
        total_transactions=len(txns),
        period_start=p_start,
        period_end=p_end
    )

@router.get("/charts", response_model=DashboardChartsDTO)
def get_dashboard_charts(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    ds_query = db.query(DailySummary).order_by(DailySummary.summary_date.asc())
    if start_date:
        ds_query = ds_query.filter(DailySummary.summary_date >= start_date)
    if end_date:
        ds_query = ds_query.filter(DailySummary.summary_date <= end_date)

    daily_rows = ds_query.all()

    daily_timeline = [{
        "date": r.summary_date,
        "receipts": r.total_customer_receipts,
        "expenses": r.actual_expenses,
        "net": r.net_operating_movement,
        "internal": r.internal_transfers
    } for r in daily_rows]

    # Monthly aggregation
    monthly_map = {}
    for r in daily_rows:
        m_key = r.summary_date[:7] # YYYY-MM
        monthly_map.setdefault(m_key, {"month": m_key, "receipts": 0.0, "expenses": 0.0, "net": 0.0})
        monthly_map[m_key]["receipts"] += r.total_customer_receipts
        monthly_map[m_key]["expenses"] += r.actual_expenses
        monthly_map[m_key]["net"] += r.net_operating_movement

    monthly_timeline = list(monthly_map.values())

    # Sector Receipts
    receipt_txns = db.query(
        Transaction.source_sector,
        func.sum(Transaction.amount).label("total")
    ).filter(Transaction.direction == "IN").group_by(Transaction.source_sector).all()

    sector_receipts = [{
        "sector": r[0] or "UNCLASSIFIED",
        "amount": round(r[1] or 0.0, 2)
    } for r in receipt_txns]

    # Sector Expenses
    expense_txns = db.query(
        Transaction.expense_sector,
        func.sum(Transaction.amount).label("total")
    ).filter(Transaction.direction == "OUT").group_by(Transaction.expense_sector).all()

    sector_expenses = [{
        "sector": r[0] or "UNCLASSIFIED",
        "amount": round(r[1] or 0.0, 2)
    } for r in expense_txns]

    # Source to Expense Flows from allocations
    flows = db.query(
        Fund.source_sector,
        Transaction.expense_sector,
        func.sum(FundAllocation.amount_allocated).label("allocated_sum")
    ).join(Fund, FundAllocation.fund_id == Fund.id)\
     .join(Transaction, FundAllocation.expense_txn_id == Transaction.id)\
     .group_by(Fund.source_sector, Transaction.expense_sector).all()

    flow_list = [{
        "source": f[0] or "GENERAL POOL",
        "target": f[1] or "OTHER",
        "value": round(f[2] or 0.0, 2)
    } for f in flows]

    # Exception Breakdown
    exc_counts = db.query(
        AuditFlag.flag_type,
        func.count(AuditFlag.id).label("cnt")
    ).group_by(AuditFlag.flag_type).all()

    exception_breakdown = [{
        "flag_type": e[0],
        "count": e[1]
    } for e in exc_counts]

    return DashboardChartsDTO(
        daily_timeline=daily_timeline,
        monthly_timeline=monthly_timeline,
        sector_receipts=sector_receipts,
        sector_expenses=sector_expenses,
        source_to_expense_flows=flow_list,
        exception_breakdown=exception_breakdown
    )

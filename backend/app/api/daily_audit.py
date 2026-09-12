from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.schema import DailySummary, Transaction, ReconciliationReport, AuditFlag
from app.schemas.dtos import DailyAuditSummaryDTO, DailyAuditDetailDTO, TransactionDTO, SettlementMatchItemDTO

router = APIRouter(prefix="/api/daily-audit", tags=["Daily Audit"])

@router.get("", response_model=List[DailyAuditSummaryDTO])
def get_daily_audit_list(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    sort_by: str = Query("summary_date"),
    order: str = Query("asc"),
    db: Session = Depends(get_db)
):
    query = db.query(DailySummary)
    if start_date:
        query = query.filter(DailySummary.summary_date >= start_date)
    if end_date:
        query = query.filter(DailySummary.summary_date <= end_date)

    if order.lower() == "desc":
        query = query.order_by(getattr(DailySummary, sort_by).desc())
    else:
        query = query.order_by(getattr(DailySummary, sort_by).asc())

    records = query.all()
    results = []

    # Map previous day QR collections for cross-day settlement audit
    all_dates_ordered = [rec.summary_date for rec in db.query(DailySummary.summary_date).order_by(DailySummary.summary_date.asc()).all()]
    date_to_idx = {d: i for i, d in enumerate(all_dates_ordered)}
    qr_by_date = {rec.summary_date: (rec.upi_qr_collections or 0.0) for rec in db.query(DailySummary.summary_date, DailySummary.upi_qr_collections).all()}

    for r in records:
        # Check if there is any reconciliation mismatch for this date
        mismatch_count = db.query(ReconciliationReport).filter(
            ReconciliationReport.report_date == r.summary_date,
            ReconciliationReport.status == "MISMATCH"
        ).count()
        raw_dep = r.bank_deposits or 0.0
        upi_c = r.upi_qr_collections or 0.0
        dir_dep = getattr(r, 'direct_bank_deposits', 0.0) or 0.0
        cash_dep = getattr(r, 'cash_deposits', 0.0) or 0.0
        bank_tr_dep = getattr(r, 'bank_transfer_deposits', 0.0) or 0.0
        if dir_dep == 0.0 and (cash_dep > 0 or bank_tr_dep > 0):
            dir_dep = cash_dep + bank_tr_dep
        if dir_dep == 0.0 and raw_dep > 0:
            dir_dep = raw_dep
        # Total Bank Deposits = Direct Bank Deposits + UPI QR Collections
        total_dep = round(dir_dep + upi_c, 2) if (dir_dep > 0 or upi_c > 0) else raw_dep

        # Previous day QR for settlement audit subtraction
        idx = date_to_idx.get(r.summary_date)
        prev_d = all_dates_ordered[idx - 1] if idx is not None and idx > 0 else None
        prev_qr = qr_by_date.get(prev_d, 0.0) if prev_d else 0.0
        settle_amt = r.upi_settlements or 0.0
        settle_diff = round(prev_qr - settle_amt, 2) if settle_amt > 0 else None

        matched_deducted = getattr(r, 'matched_settlement_deducted', 0.0) or 0.0
        close_b = r.closing_balance if r.closing_balance is not None else round((r.opening_balance or 0.0) + total_dep - (r.bank_debits or 0.0) - matched_deducted, 2)

        results.append(DailyAuditSummaryDTO(
            summary_date=r.summary_date,
            total_customer_receipts=r.total_customer_receipts or 0.0,
            bank_deposits=total_dep, # Total Bank Deposits (Direct + UPI QR)
            direct_bank_deposits=round(dir_dep, 2), # Direct Table 1 Bank Deposits
            cash_deposits=round(cash_dep, 2),
            bank_transfer_deposits=round(bank_tr_dep, 2),
            upi_qr_collections=upi_c,
            upi_settlements=settle_amt,
            actual_expenses=r.actual_expenses or 0.0,
            business_expenses=getattr(r, 'business_expenses', 0.0) or ((r.actual_expenses or 0.0) - (getattr(r, 'personal_expenses', 0.0) or 0.0)),
            personal_expenses=getattr(r, 'personal_expenses', 0.0) or 0.0,
            internal_transfers=r.internal_transfers or 0.0,
            net_operating_movement=r.net_operating_movement or 0.0,
            gross_turnover=total_dep,
            opening_balance=r.opening_balance or 0.0,
            bank_credits=total_dep,
            bank_debits=r.bank_debits or 0.0,
            closing_balance=close_b,
            matched_settlement_deducted=matched_deducted,
            txn_count=r.txn_count or 0,
            unclassified_count=r.unclassified_count or 0,
            audit_flag_count=r.audit_flag_count or 0,
            reconciliation_match=(mismatch_count == 0),
            prev_day_qr_total=prev_qr,
            settlement_audit_diff=settle_diff
        ))
    return results

@router.get("/{audit_date}", response_model=DailyAuditDetailDTO)
def get_daily_audit_detail(audit_date: str, db: Session = Depends(get_db)):
    summary = db.query(DailySummary).filter(DailySummary.summary_date == audit_date).first()
    if not summary:
        raise HTTPException(status_code=404, detail=f"No audit summary found for date '{audit_date}'")

    # Fetch all transactions on this date
    all_txns = db.query(Transaction).filter(Transaction.txn_date == audit_date).all()
    # All BANK_DEPOSIT rows are bank receipts/deposits into this account
    receipts = [TransactionDTO.model_validate(t) for t in all_txns if t.direction == "IN" or t.source_table == "BANK_DEPOSIT"]
    expenses = [TransactionDTO.model_validate(t) for t in all_txns if t.direction == "OUT" or t.source_table == "ONLINE_PAYMENT"]
    internal = [TransactionDTO.model_validate(t) for t in all_txns if t.direction == "INTERNAL" and t.source_table != "BANK_DEPOSIT" and t.source_table != "ONLINE_PAYMENT"]

    # Settlement cross-day verification check: ONLY where specific keyword 'UPI SETTLEMENT' is present and amount > 0
    settlement_txns = [
        t for t in all_txns
        if t.source_table == "BANK_DEPOSIT"
        and (t.amount or 0) > 0
        and (
            "UPI SETTLEMENT" in (t.party_name or "").upper()
            or "UPI SETTELMENT" in (t.party_name or "").upper()
            or "UPI SETTLEMENT" in (t.description or "").upper()
            or "UPI SETTELMENT" in (t.description or "").upper()
        )
    ]
    total_settlements_today = round(sum(s.amount or 0.0 for s in settlement_txns), 2)

    # Find previous active date with transactions in DB
    prev_date_row = db.query(Transaction.txn_date)\
        .filter(Transaction.txn_date < audit_date)\
        .order_by(desc(Transaction.txn_date))\
        .first()
    prev_date = prev_date_row[0] if prev_date_row else None

    prev_qr_txns = []
    prev_qr_total = 0.0
    if prev_date:
        prev_qr_txns = db.query(Transaction).filter(
            Transaction.txn_date == prev_date,
            Transaction.source_table == "UPI_QR"
        ).all()
        prev_qr_total = round(sum(t.amount or 0.0 for t in prev_qr_txns), 2)

    settle_diff = round(prev_qr_total - total_settlements_today, 2) if settlement_txns else 0.0

    # Fetch reconciliations
    reconciles = db.query(ReconciliationReport).filter(ReconciliationReport.report_date == audit_date).all()
    rec_list = [{
        "section_name": r.section_name,
        "reported_total": r.reported_total,
        "parsed_total": r.parsed_total,
        "difference": r.difference,
        "status": r.status,
        "notes": r.notes
    } for r in reconciles]

    # If date has settlements, add proper audit report row: Prev Day Table 2 QR - Today Table 1 Settlement
    if settlement_txns and prev_date:
        rec_list.append({
            "section_name": "UPI Settlement Audit (Kal ka Table 2 QR − Aaj ka Table 1 Settlement)",
            "reported_total": prev_qr_total,
            "parsed_total": total_settlements_today,
            "difference": settle_diff,
            "status": "MATCH" if abs(settle_diff) < 0.01 else "MISMATCH",
            "notes": f"Pichle din ({prev_date}) Table 2 QR (Rs {prev_qr_total:,.2f}) − Aaj Table 1 Settlement (Rs {total_settlements_today:,.2f}) = Rs {settle_diff:,.2f}"
        })

    # Fetch flags for this date
    flags = db.query(AuditFlag).filter(
        AuditFlag.txn_id.in_([t.id for t in all_txns])
    ).all() if all_txns else []
    flag_list = [{
        "id": f.id,
        "txn_id": f.txn_id,
        "flag_type": f.flag_type,
        "severity": f.severity,
        "description": f.description,
        "status": f.status
    } for f in flags]

    raw_dep = summary.bank_deposits or 0.0
    upi_c = summary.upi_qr_collections or 0.0
    dir_dep = getattr(summary, 'direct_bank_deposits', 0.0) or 0.0
    cash_dep = getattr(summary, 'cash_deposits', 0.0) or 0.0
    bank_tr_dep = getattr(summary, 'bank_transfer_deposits', 0.0) or 0.0
    if dir_dep == 0.0 and (cash_dep > 0 or bank_tr_dep > 0):
        dir_dep = cash_dep + bank_tr_dep
    if dir_dep == 0.0 and raw_dep > 0:
        dir_dep = raw_dep
    total_dep = round(dir_dep + upi_c, 2) if (dir_dep > 0 or upi_c > 0) else raw_dep

    matched_deducted = getattr(summary, 'matched_settlement_deducted', 0.0) or 0.0
    close_b = summary.closing_balance if summary.closing_balance is not None else round((summary.opening_balance or 0.0) + total_dep - (summary.bank_debits or 0.0) - matched_deducted, 2)

    summary_dto = DailyAuditSummaryDTO(
        summary_date=summary.summary_date,
        total_customer_receipts=summary.total_customer_receipts or 0.0,
        bank_deposits=total_dep, # Total Bank Deposits (Direct + UPI QR)
        direct_bank_deposits=round(dir_dep, 2),
        cash_deposits=round(cash_dep, 2),
        bank_transfer_deposits=round(bank_tr_dep, 2),
        upi_qr_collections=upi_c,
        upi_settlements=summary.upi_settlements or 0.0,
        actual_expenses=summary.actual_expenses or 0.0,
        business_expenses=getattr(summary, 'business_expenses', 0.0) or ((summary.actual_expenses or 0.0) - (getattr(summary, 'personal_expenses', 0.0) or 0.0)),
        personal_expenses=getattr(summary, 'personal_expenses', 0.0) or 0.0,
        internal_transfers=summary.internal_transfers or 0.0,
        net_operating_movement=summary.net_operating_movement or 0.0,
        gross_turnover=total_dep,
        opening_balance=summary.opening_balance or 0.0,
        bank_credits=total_dep,
        bank_debits=summary.bank_debits or 0.0,
        closing_balance=close_b,
        matched_settlement_deducted=matched_deducted,
        txn_count=summary.txn_count or 0,
        unclassified_count=summary.unclassified_count or 0,
        audit_flag_count=summary.audit_flag_count or 0,
        reconciliation_match=not any(r.status == "MISMATCH" for r in reconciles),
        prev_day_qr_total=prev_qr_total,
        settlement_audit_diff=settle_diff if settlement_txns else None
    )

    settlement_verifications: List[SettlementMatchItemDTO] = []
    if settlement_txns:

        # Check also T-2 date in case of Sunday / 2-day bank delay
        prev2_date_row = db.query(Transaction.txn_date)\
            .filter(Transaction.txn_date < prev_date)\
            .order_by(desc(Transaction.txn_date))\
            .first() if prev_date else None
        prev2_date = prev2_date_row[0] if prev2_date_row else None
        prev2_qr_txns = db.query(Transaction).filter(
            Transaction.txn_date == prev2_date,
            Transaction.source_table == "UPI_QR"
        ).all() if prev2_date else []
        prev2_qr_total = round(sum(t.amount or 0.0 for t in prev2_qr_txns), 2)

        matched_prev_ids = set()

        for s in settlement_txns:
            s_amt = round(s.amount or 0.0, 2)
            s_party = s.party_name or "UPI SETTLEMENT"

            # 1. Exact Day Total Match with T-1 QR Total
            if prev_qr_total > 0 and abs(s_amt - prev_qr_total) < 0.01:
                settlement_verifications.append(SettlementMatchItemDTO(
                    settlement_party=s_party,
                    settlement_amount=s_amt,
                    settlement_date=audit_date,
                    prev_date=prev_date,
                    prev_qr_total=prev_qr_total,
                    match_type="EXACT_DAY_TOTAL",
                    difference=0.0,
                    message=f"Exact 100% Match: This Rs {s_amt:,.2f} settlement matches the entire QR collection of yesterday ({prev_date})."
                ))
            else:
                # 2. Row Match with individual customer in T-1
                row_match = next((t for t in prev_qr_txns if abs((t.amount or 0.0) - s_amt) < 0.01 and t.id not in matched_prev_ids), None)
                if row_match:
                    matched_prev_ids.add(row_match.id)
                    settlement_verifications.append(SettlementMatchItemDTO(
                        settlement_party=s_party,
                        settlement_amount=s_amt,
                        settlement_date=audit_date,
                        prev_date=prev_date,
                        prev_qr_total=prev_qr_total,
                        match_type="ROW_MATCH",
                        matched_entry_party=row_match.party_name,
                        matched_entry_amount=row_match.amount,
                        difference=0.0,
                        message=f"Matched Customer Payment: Rs {s_amt:,.2f} exactly matches customer '{row_match.party_name}' from yesterday ({prev_date})."
                    ))
                # 3. Sum Match (if multiple settlements today sum up to prev day QR total)
                elif len(settlement_txns) > 1 and abs(total_settlements_today - prev_qr_total) < 0.01:
                    settlement_verifications.append(SettlementMatchItemDTO(
                        settlement_party=s_party,
                        settlement_amount=s_amt,
                        settlement_date=audit_date,
                        prev_date=prev_date,
                        prev_qr_total=prev_qr_total,
                        match_type="SUM_MATCH",
                        difference=0.0,
                        message=f"Part of Multi-Batch Match: Combined settlements today total Rs {total_settlements_today:,.2f}, matching yesterday's ({prev_date}) QR collection."
                    ))
                # 4. Gateway Fee / MDR adjusted match (within 2.5% difference of T-1 total)
                elif prev_qr_total > 0 and 0 < (prev_qr_total - total_settlements_today) < (prev_qr_total * 0.025):
                    diff = round(prev_qr_total - total_settlements_today, 2)
                    settlement_verifications.append(SettlementMatchItemDTO(
                        settlement_party=s_party,
                        settlement_amount=s_amt,
                        settlement_date=audit_date,
                        prev_date=prev_date,
                        prev_qr_total=prev_qr_total,
                        match_type="MDR_FEE_ADJUSTED",
                        difference=diff,
                        message=f"Settlement Rs {s_amt:,.2f} matches yesterday's QR (Rs {prev_qr_total:,.2f}) after small gateway fee deduction of Rs {diff:,.2f}."
                    ))
                # 5. Row Match with T-2 (2 days ago, e.g. weekend)
                else:
                    row_match_t2 = next((t for t in prev2_qr_txns if abs((t.amount or 0.0) - s_amt) < 0.01), None)
                    if row_match_t2:
                        settlement_verifications.append(SettlementMatchItemDTO(
                            settlement_party=s_party,
                            settlement_amount=s_amt,
                            settlement_date=audit_date,
                            prev_date=prev2_date,
                            prev_qr_total=prev2_qr_total,
                            match_type="ROW_MATCH_T2",
                            matched_entry_party=row_match_t2.party_name,
                            matched_entry_amount=row_match_t2.amount,
                            difference=0.0,
                            message=f"Matched Customer Payment: Rs {s_amt:,.2f} matches customer '{row_match_t2.party_name}' from 2 days ago ({prev2_date})."
                        ))
                    elif prev2_qr_total > 0 and abs(s_amt - prev2_qr_total) < 0.01:
                        settlement_verifications.append(SettlementMatchItemDTO(
                            settlement_party=s_party,
                            settlement_amount=s_amt,
                            settlement_date=audit_date,
                            prev_date=prev2_date,
                            prev_qr_total=prev2_qr_total,
                            match_type="EXACT_DAY_TOTAL_T2",
                            difference=0.0,
                            message=f"Weekend/Holiday Match: Rs {s_amt:,.2f} matches entire QR total of 2 days ago ({prev2_date})."
                        ))
                    else:
                        diff = round(s_amt - prev_qr_total, 2)
                        settlement_verifications.append(SettlementMatchItemDTO(
                            settlement_party=s_party,
                            settlement_amount=s_amt,
                            settlement_date=audit_date,
                            prev_date=prev_date,
                            prev_qr_total=prev_qr_total,
                            match_type="UNMATCHED_OR_BATCH",
                            difference=diff,
                            message=f"Multi-Day/Batch: Settlement Rs {s_amt:,.2f} vs yesterday's QR Rs {prev_qr_total:,.2f} (Difference: Rs {diff:+,.2f})."
                        ))

    return DailyAuditDetailDTO(
        summary=summary_dto,
        receipts=receipts,
        expenses=expenses,
        internal_movements=internal,
        reconciliations=rec_list,
        flags=flag_list,
        settlement_verifications=settlement_verifications
    )

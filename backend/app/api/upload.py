import os
import shutil
from typing import List, Optional, Dict, Any, Set
from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.core.database import get_db, SessionLocal
from app.core.config import UPLOAD_DIR
from app.models.schema import (
    Import, SourceSheet, RawRow, Transaction, TransactionLink,
    Fund, FundAllocation, ReconciliationReport, AuditFlag, DailySummary,
    ClassificationRule, Sector
)
from app.schemas.dtos import ScanResult, ImportResponse
from app.engine.scanner import WorkbookScanner
from app.engine.parser import WorkbookParser
from app.engine.normalizer import TransactionNormalizer
from app.engine.self_transfer import SelfTransferEngine
from app.engine.double_count import DoubleCountEngine
from app.engine.classifier import SmartClassifier, DEFAULT_RULES
from app.engine.duplicate import DuplicateDetector
from app.engine.fund_tracker import FundTrackerEngine
from app.engine.audit_engine import AuditEngine

router = APIRouter(prefix="/api", tags=["Imports & Upload"])

def get_existing_dataset_state(db: Session) -> Dict[str, Any]:
    """
    Checks the currently active dataset in the database to enable incremental
    continuation without breaking the running audit rhythm or double-importing dates.
    """
    last_summary = db.query(DailySummary).order_by(DailySummary.summary_date.desc()).first()
    if not last_summary:
        return {
            "has_existing_data": False,
            "max_date": None,
            "existing_dates": set(),
            "existing_date_count": 0,
            "last_closing_balance": 0.0,
            "last_upi_qr_total": 0.0,
            "last_qr_amounts": [],
            "max_fund_num": 0
        }

    dates = [r[0] for r in db.query(DailySummary.summary_date).all() if r[0]]
    dates_set = set(dates)

    # Find highest fund number
    funds_codes = db.query(Fund.fund_code).all()
    max_fund_num = 0
    for (fc,) in funds_codes:
        if fc:
            parts = fc.split("-")
            if parts and parts[-1].isdigit():
                max_fund_num = max(max_fund_num, int(parts[-1]))

    # Last QR transactions to calculate last_upi_qr_total for UPI settlement difference continuity
    last_qr_txns = db.query(Transaction).filter(
        Transaction.txn_date == last_summary.summary_date,
        Transaction.source_table == "UPI_QR"
    ).all()
    last_upi_qr = round(sum(t.amount or 0.0 for t in last_qr_txns), 2)
    last_qr_amounts = [t.amount for t in last_qr_txns if (t.amount or 0.0) > 0]

    return {
        "has_existing_data": True,
        "max_date": last_summary.summary_date,
        "existing_dates": dates_set,
        "existing_date_count": len(dates_set),
        "last_closing_balance": round(last_summary.closing_balance or 0.0, 2),
        "last_upi_qr_total": last_upi_qr,
        "last_qr_amounts": last_qr_amounts,
        "max_fund_num": max_fund_num
    }

def cleanup_active_dataset(db: Session):
    """
    Clears current active transactional data when user explicitly requests
    a full replacement / fresh start.
    """
    db.query(TransactionLink).delete()
    db.query(FundAllocation).delete()
    db.query(Fund).delete()
    db.query(Transaction).delete()
    db.query(DailySummary).delete()
    db.query(ReconciliationReport).delete()
    db.query(AuditFlag).delete()
    db.query(RawRow).delete()
    db.query(SourceSheet).delete()
    # Mark previously active completed imports as ARCHIVED
    db.query(Import).filter(Import.status == "COMPLETED").update({"status": "ARCHIVED"})
    db.commit()

@router.post("/upload/scan", response_model=ScanResult)
async def scan_workbook(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.endswith(('.xlsx', '.xls', '.csv')):
        raise HTTPException(status_code=400, detail="Only Excel (.xlsx, .xls) and CSV (.csv) files are supported.")

    temp_path = UPLOAD_DIR / f"temp_{file.filename}"
    with open(temp_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        scanner = WorkbookScanner(str(temp_path))
        scan_data = scanner.scan()

        # Check existing dataset state for incremental continuation
        existing = get_existing_dataset_state(db)
        if existing["has_existing_data"]:
            scan_data["has_existing_data"] = True
            scan_data["existing_max_date"] = existing["max_date"]
            scan_data["existing_date_count"] = existing["existing_date_count"]
            scan_data["last_closing_balance"] = existing["last_closing_balance"]

            # Filter candidate sheets that are strictly NEW
            new_sheets = [
                s for s in scan_data["sheets"]
                if s["detected_date"] and (s["detected_date"] > existing["max_date"] or s["detected_date"] not in existing["existing_dates"])
            ]
            scan_data["new_dates_count"] = len(new_sheets)
            if new_sheets:
                new_dates = [s["detected_date"] for s in new_sheets]
                scan_data["new_period_start"] = min(new_dates)
                scan_data["new_period_end"] = max(new_dates)

        return scan_data
    finally:
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass

@router.post("/upload/import", response_model=ImportResponse)
async def import_workbook(
    file: Optional[UploadFile] = File(None),
    use_demo_fixture: bool = Form(False),
    force_reimport: bool = Form(False),
    import_mode: str = Form("auto"),  # "auto", "append", "replace"
    db: Session = Depends(get_db)
):
    # Determine file path
    if use_demo_fixture or not file:
        fixture_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "test_data", "HDFC BANK RECORD BOOK.xlsx")
        if not os.path.exists(fixture_path):
            raise HTTPException(status_code=404, detail="Demo fixture HDFC BANK RECORD BOOK.xlsx not found.")
        filepath = fixture_path
        filename = "HDFC BANK RECORD BOOK.xlsx"
    else:
        filename = file.filename
        filepath = os.path.join(UPLOAD_DIR, filename)
        with open(filepath, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

    # 1. Scanner
    scanner = WorkbookScanner(filepath)
    scan_info = scanner.scan()
    file_hash = scan_info["file_hash"]

    # Check for existing import with same hash
    existing_imp = db.query(Import).filter(Import.file_hash == file_hash).first()

    # If user used demo fixture and it's already completed and has data, return it
    if existing_imp and existing_imp.status == "COMPLETED" and use_demo_fixture and not force_reimport:
        txn_count = db.query(Transaction).filter(Transaction.import_id == existing_imp.id).count()
        if txn_count > 0:
            return ImportResponse(
                import_id=existing_imp.id,
                file_name=existing_imp.file_name,
                status=existing_imp.status,
                sheet_count=existing_imp.sheet_count,
                date_sheet_count=existing_imp.date_sheet_count,
                transaction_count=existing_imp.transaction_count,
                warnings_count=existing_imp.warnings_count,
                period_start=existing_imp.period_start,
                period_end=existing_imp.period_end
            )

    # Check database state to determine if we should incrementally append or replace
    existing_state = get_existing_dataset_state(db)
    is_incremental = existing_state["has_existing_data"] and (import_mode in ("auto", "append")) and not force_reimport and not use_demo_fixture

    if not is_incremental:
        # Full replace mode: clean previous active dataset
        if existing_imp:
            db.delete(existing_imp)
            db.commit()
        cleanup_active_dataset(db)

    # 2. Create Import record
    import_rec = Import(
        file_name=filename,
        file_hash=file_hash,
        file_size=os.path.getsize(filepath),
        sheet_count=scan_info["total_sheets"],
        date_sheet_count=scan_info["date_sheets_count"],
        warnings_count=len(scan_info["warnings"]),
        status="PROCESSING"
    )
    db.add(import_rec)
    db.commit()
    db.refresh(import_rec)
    import_id = import_rec.id

    try:
        # 3. Parser (with date filtering for incremental append)
        if is_incremental:
            parser = WorkbookParser(
                filepath, 
                min_date=existing_state["max_date"], 
                exclude_dates=existing_state["existing_dates"]
            )
        else:
            parser = WorkbookParser(filepath)

        parsed_data = parser.parse()
        raw_txns = parsed_data["transactions"]
        reconciles = parsed_data["reconciliations"]
        raw_rows_data = parsed_data["raw_rows"]
        sheet_summaries = parsed_data["sheet_summaries"]

        if is_incremental and len(sheet_summaries) == 0:
            raise HTTPException(
                status_code=400, 
                detail=f"All sheets in this file (up to {existing_state['max_date']}) are already uploaded. No new dates found to append."
            )

        # 4. Save Source Sheets
        for s in sheet_summaries:
            db.add(SourceSheet(
                import_id=import_id,
                sheet_name=s["sheet_name"],
                is_date_sheet=True,
                detected_date=s["detected_date"],
                section_count=s["section_count"],
                parsed_txn_count=s["parsed_count"]
            ))

        # 5. Save Raw Rows
        for rr in raw_rows_data:
            db.add(RawRow(
                import_id=import_id,
                sheet_name=rr["sheet_name"],
                row_number=rr["row_number"],
                section_name=rr["section_name"],
                raw_data_json=rr["raw_data_json"]
            ))

        # 6. Normalization
        norm_txns = [TransactionNormalizer.normalize(t, import_id) for t in raw_txns]

        # 7. Self Transfers & Internal Movements
        norm_txns = SelfTransferEngine.apply(norm_txns)

        # 8. Classification Rules
        db_rules = db.query(ClassificationRule).filter(ClassificationRule.is_active == True).all()
        rules_list = [{
            "pattern": r.pattern, "match_field": r.match_field,
            "target_nature": r.target_nature, "target_sector": r.target_sector,
            "target_category": r.target_category, "confidence_score": r.confidence_score,
            "priority": r.priority, "is_active": r.is_active
        } for r in db_rules] if db_rules else DEFAULT_RULES

        classifier = SmartClassifier(rules_list)
        norm_txns = classifier.classify_all(norm_txns)

        # 9. Double-Counting & UPI Settlements
        norm_txns, settle_links = DoubleCountEngine.process_settlements(norm_txns)

        # 10. Duplicate Detection
        norm_txns, dup_flags = DuplicateDetector.detect(norm_txns)

        # 11. Fund Tracking & Ledger
        if is_incremental:
            # Continuing from previous funds with continuing fund counter
            new_funds, norm_txns = FundTrackerEngine.generate_funds_from_receipts(
                norm_txns,
                import_id=import_id,
                start_fund_counter=existing_state["max_fund_num"] + 1
            )

            # Fetch open previous funds from DB
            db_open_funds = db.query(Fund).filter(Fund.status.in_(["OPEN", "PARTIALLY USED"])).all()
            open_funds_pool = []
            for f in db_open_funds:
                open_funds_pool.append({
                    "id": f.id,
                    "fund_code": f.fund_code,
                    "source_date": f.source_date,
                    "source_sector": f.source_sector,
                    "source_txn_id": f.source_txn_id,
                    "original_amount": f.original_amount,
                    "allocated_amount": f.allocated_amount or 0.0,
                    "spent_amount": f.spent_amount or 0.0,
                    "remaining_amount": f.remaining_amount or 0.0,
                    "status": f.status,
                    "notes": f.notes,
                    "_is_existing": True
                })

            combined_funds = open_funds_pool + new_funds
            new_expenses = [t for t in norm_txns if t["direction"] == "OUT"]
            allocations = FundTrackerEngine.auto_allocate_fifo(combined_funds, new_expenses)

            # Update modified existing funds in DB
            for f_dict in open_funds_pool:
                orig = next((x for x in db_open_funds if x.id == f_dict["id"]), None)
                if orig:
                    orig.allocated_amount = f_dict["allocated_amount"]
                    orig.spent_amount = f_dict["spent_amount"]
                    orig.remaining_amount = f_dict["remaining_amount"]
                    orig.status = f_dict["status"]
            funds_to_save = new_funds
        else:
            from app.api.settings import get_initial_opening_balance_val
            initial_opening_bal = get_initial_opening_balance_val(db)
            earliest_date = min((t["txn_date"] for t in norm_txns if t.get("txn_date")), default=None)
            funds, norm_txns = FundTrackerEngine.generate_funds_from_receipts(
                norm_txns,
                import_id=import_id,
                initial_opening_balance=initial_opening_bal,
                opening_date=earliest_date
            )
            expenses = [t for t in norm_txns if t["direction"] == "OUT"]
            allocations = FundTrackerEngine.auto_allocate_fifo(funds, expenses)
            funds_to_save = funds

        # 12. Daily Audit Rollups & Flags
        if is_incremental:
            # Maintain the continuous rhythm from the previous day's closing balance and QR total!
            daily_summaries = AuditEngine.compute_daily_summaries(
                norm_txns, 
                import_id, 
                initial_opening_balance=existing_state["last_closing_balance"],
                initial_prev_upi_qr=existing_state["last_upi_qr_total"],
                initial_prev_qr_amounts=existing_state.get("last_qr_amounts")
            )
        else:
            from app.api.settings import get_initial_opening_balance_val
            initial_opening_bal = get_initial_opening_balance_val(db)
            daily_summaries = AuditEngine.compute_daily_summaries(norm_txns, import_id, initial_opening_bal)

        engine_flags = AuditEngine.generate_all_audit_flags(norm_txns, reconciles, import_id)
        all_flags = engine_flags + dup_flags

        # 13. Persist Funds
        for f in funds_to_save:
            db.add(Fund(
                id=f["id"],
                fund_code=f["fund_code"],
                source_date=f["source_date"],
                source_sector=f["source_sector"],
                source_txn_id=f.get("source_txn_id"),
                original_amount=f["original_amount"],
                allocated_amount=f["allocated_amount"],
                spent_amount=f["spent_amount"],
                remaining_amount=f["remaining_amount"],
                status=f["status"],
                notes=f["notes"]
            ))
        db.flush()

        # 14. Persist Transactions
        for t in norm_txns:
            db.add(Transaction(
                id=t["id"],
                import_id=import_id,
                txn_id_extracted=t.get("txn_id_extracted"),
                txn_date=t["txn_date"],
                txn_time=t.get("txn_time"),
                value_date=t.get("value_date"),
                source_sheet=t["source_sheet"],
                source_table=t["source_table"],
                transaction_type=t.get("transaction_type", "TRANSFER"),
                transaction_nature=t["transaction_nature"],
                payment_channel=t.get("payment_channel", "OTHER"),
                party_name=t.get("party_name"),
                bank_ref_utr=t.get("bank_ref_utr"),
                txn_reference=t.get("txn_reference"),
                description=t.get("description"),
                amount=t["amount"],
                fee_amount=t.get("fee_amount", 0.0),
                direction=t["direction"],
                source_sector=t.get("source_sector"),
                expense_sector=t.get("expense_sector"),
                category=t.get("category"),
                fund_id=t.get("fund_id"),
                settlement_group_id=t.get("settlement_group_id"),
                status=t.get("status", "AUTO CLASSIFIED"),
                confidence_score=t.get("confidence_score", 0.0),
                audit_flag=t.get("audit_flag"),
                is_duplicate=t.get("is_duplicate", False),
                duplicate_of_id=t.get("duplicate_of_id"),
                original_row=t["original_row"],
                original_sheet=t["original_sheet"],
                original_raw_data=t.get("original_raw_data")
            ))

        # 15. Persist Fund Allocations
        for a in allocations:
            db.add(FundAllocation(
                expense_txn_id=a["expense_txn_id"],
                fund_id=a["fund_id"],
                amount_allocated=a["amount_allocated"],
                allocation_date=a["allocation_date"],
                allocation_method=a["allocation_method"],
                notes=a.get("notes")
            ))

        # 16. Persist Transaction Links
        for link in settle_links:
            db.add(TransactionLink(
                source_txn_id=link["source_txn_id"],
                target_txn_id=link["target_txn_id"],
                link_type=link["link_type"],
                notes=link.get("notes")
            ))

        # 17. Persist Reconciliation Reports
        for r in reconciles:
            db.add(ReconciliationReport(
                import_id=import_id,
                sheet_name=r["sheet_name"],
                report_date=r["report_date"],
                section_name=r["section_name"],
                reported_total=r["reported_total"],
                parsed_total=r["parsed_total"],
                difference=r["difference"],
                status=r["status"],
                notes=r.get("notes")
            ))

        # 18. Persist Daily Summaries
        for ds in daily_summaries:
            db.add(DailySummary(
                import_id=import_id,
                summary_date=ds["summary_date"],
                gross_turnover=ds.get("gross_turnover", 0.0),
                total_customer_receipts=ds["total_customer_receipts"],
                bank_deposits=ds["bank_deposits"],
                direct_bank_deposits=ds.get("direct_bank_deposits", 0.0),
                cash_deposits=ds.get("cash_deposits", 0.0),
                bank_transfer_deposits=ds.get("bank_transfer_deposits", 0.0),
                upi_qr_collections=ds["upi_qr_collections"],
                upi_settlements=ds["upi_settlements"],
                actual_expenses=ds["actual_expenses"],
                business_expenses=ds.get("business_expenses", 0.0),
                personal_expenses=ds.get("personal_expenses", 0.0),
                internal_transfers=ds["internal_transfers"],
                net_operating_movement=ds["net_operating_movement"],
                opening_balance=ds.get("opening_balance", 0.0),
                bank_credits=ds.get("bank_credits", 0.0),
                bank_debits=ds.get("bank_debits", 0.0),
                closing_balance=ds.get("closing_balance", 0.0),
                txn_count=ds["txn_count"],
                unclassified_count=ds["unclassified_count"],
                audit_flag_count=ds["audit_flag_count"]
            ))

        # 19. Persist Audit Flags
        for f in all_flags:
            db.add(AuditFlag(
                import_id=import_id,
                txn_id=f.get("txn_id"),
                sheet_name=f.get("sheet_name"),
                flag_type=f["flag_type"],
                severity=f.get("severity", "MEDIUM"),
                description=f["description"],
                status="OPEN"
            ))

        # Update import record
        dates = [t["txn_date"] for t in norm_txns if t.get("txn_date")]
        p_start = min(dates) if dates else None
        p_end = max(dates) if dates else None

        import_rec.status = "COMPLETED"
        import_rec.transaction_count = len(norm_txns)
        import_rec.period_start = p_start
        import_rec.period_end = p_end
        db.commit()

        # Seed sectors from discovered source and expense sectors
        all_discovered_sectors = set(
            [t.get("source_sector") for t in norm_txns if t.get("source_sector")] +
            [t.get("expense_sector") for t in norm_txns if t.get("expense_sector")]
        )
        for s_code in all_discovered_sectors:
            if s_code and not db.query(Sector).filter(Sector.code == s_code).first():
                db.add(Sector(
                    code=s_code,
                    name=s_code.title(),
                    subsectors_json="[]",
                    purpose=f"Auto-discovered sector {s_code}",
                    is_active=True
                ))
        db.commit()

        total_active_dates = db.query(DailySummary.summary_date).distinct().count()

        return ImportResponse(
            import_id=import_id,
            file_name=filename,
            status="COMPLETED",
            sheet_count=scan_info["total_sheets"],
            date_sheet_count=len(sheet_summaries),
            transaction_count=len(norm_txns),
            warnings_count=len(all_flags),
            period_start=p_start,
            period_end=p_end,
            is_incremental=is_incremental,
            appended_dates_count=len(sheet_summaries) if is_incremental else 0,
            total_active_dates_count=total_active_dates,
            continuation_from_date=existing_state.get("max_date") if is_incremental else None,
            opening_balance_applied=existing_state.get("last_closing_balance", 0.0) if is_incremental else 0.0
        )

    except Exception as e:
        db.rollback()
        try:
            failed_rec = db.query(Import).filter(Import.id == import_id).first()
            if failed_rec:
                failed_rec.status = "FAILED"
                db.commit()
        except Exception:
            pass
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")

@router.get("/imports")
def get_import_history(db: Session = Depends(get_db)):
    imports = db.query(Import).order_by(Import.upload_date.desc()).all()
    return [{
        "id": imp.id,
        "file_name": imp.file_name,
        "file_size": imp.file_size,
        "upload_date": imp.upload_date.isoformat() if imp.upload_date else None,
        "period_start": imp.period_start,
        "period_end": imp.period_end,
        "sheet_count": imp.sheet_count,
        "date_sheet_count": imp.date_sheet_count,
        "transaction_count": imp.transaction_count,
        "warnings_count": imp.warnings_count,
        "status": imp.status
    } for imp in imports]

@router.delete("/imports/{import_id}")
def delete_import(import_id: int, db: Session = Depends(get_db)):
    imp = db.query(Import).filter(Import.id == import_id).first()
    if not imp:
        raise HTTPException(status_code=404, detail="Import not found")
    
    # Cascade delete any associated items
    db.query(TransactionLink).filter(
        TransactionLink.source_txn_id.in_(
            db.query(Transaction.id).filter(Transaction.import_id == import_id)
        )
    ).delete(synchronize_session=False)

    db.query(FundAllocation).filter(
        FundAllocation.expense_txn_id.in_(
            db.query(Transaction.id).filter(Transaction.import_id == import_id)
        )
    ).delete(synchronize_session=False)

    db.query(Fund).filter(
        Fund.source_txn_id.in_(
            db.query(Transaction.id).filter(Transaction.import_id == import_id)
        )
    ).delete(synchronize_session=False)

    db.query(Transaction).filter(Transaction.import_id == import_id).delete(synchronize_session=False)
    db.query(DailySummary).filter(DailySummary.import_id == import_id).delete(synchronize_session=False)
    db.query(ReconciliationReport).filter(ReconciliationReport.import_id == import_id).delete(synchronize_session=False)
    db.query(AuditFlag).filter(AuditFlag.import_id == import_id).delete(synchronize_session=False)
    db.query(RawRow).filter(RawRow.import_id == import_id).delete(synchronize_session=False)
    db.query(SourceSheet).filter(SourceSheet.import_id == import_id).delete(synchronize_session=False)
    
    db.delete(imp)
    db.commit()
    return {"message": f"Import #{import_id} deleted successfully"}

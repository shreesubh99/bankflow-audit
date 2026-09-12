import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from app.core.database import SessionLocal, engine, Base
from app.models.schema import (
    Import, SourceSheet, RawRow, Transaction, TransactionLink,
    Fund, FundAllocation, ReconciliationReport, AuditFlag, DailySummary,
    ClassificationRule, Sector, AppSetting
)
from app.engine.scanner import WorkbookScanner
from app.engine.parser import WorkbookParser
from app.engine.normalizer import TransactionNormalizer
from app.engine.self_transfer import SelfTransferEngine
from app.engine.double_count import DoubleCountEngine
from app.engine.classifier import SmartClassifier, DEFAULT_RULES
from app.engine.duplicate import DuplicateDetector
from app.engine.fund_tracker import FundTrackerEngine
from app.engine.audit_engine import AuditEngine

def seed_hdfc_fixture(force_reseed: bool = False):
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    fixture_path = os.path.join(os.path.dirname(__file__), "test_data", "HDFC BANK RECORD BOOK.xlsx")
    if not os.path.exists(fixture_path):
        print(f"Fixture not found at {fixture_path}")
        return

    scanner = WorkbookScanner(fixture_path)
    scan_info = scanner.scan()
    file_hash = scan_info["file_hash"]

    existing = db.query(Import).filter(Import.file_hash == file_hash).first()
    if existing:
        if not force_reseed:
            print(f"Fixture already imported with ID {existing.id}. Use force_reseed=True to refresh.")
            db.close()
            return
        else:
            print(f"Force reseed requested. Clearing previous import {existing.id}...")
            # Cascade clean
            db.query(TransactionLink).filter(
                TransactionLink.source_txn_id.in_(
                    db.query(Transaction.id).filter(Transaction.import_id == existing.id)
                )
            ).delete(synchronize_session=False)
            db.query(FundAllocation).filter(
                FundAllocation.expense_txn_id.in_(
                    db.query(Transaction.id).filter(Transaction.import_id == existing.id)
                )
            ).delete(synchronize_session=False)
            db.query(Fund).filter(
                Fund.source_txn_id.in_(
                    db.query(Transaction.id).filter(Transaction.import_id == existing.id)
                )
            ).delete(synchronize_session=False)
            db.query(Transaction).filter(Transaction.import_id == existing.id).delete(synchronize_session=False)
            db.query(DailySummary).delete(synchronize_session=False)
            db.query(AuditFlag).filter(AuditFlag.import_id == existing.id).delete(synchronize_session=False)
            db.query(ReconciliationReport).filter(ReconciliationReport.import_id == existing.id).delete(synchronize_session=False)
            db.query(RawRow).filter(RawRow.import_id == existing.id).delete(synchronize_session=False)
            db.query(SourceSheet).filter(SourceSheet.import_id == existing.id).delete(synchronize_session=False)
            db.delete(existing)
            db.commit()

    print("Importing HDFC demo fixture into database...")
    import_rec = Import(
        file_name="HDFC BANK RECORD BOOK.xlsx",
        file_hash=file_hash,
        file_size=os.path.getsize(fixture_path),
        sheet_count=scan_info["total_sheets"],
        date_sheet_count=scan_info["date_sheets_count"],
        warnings_count=len(scan_info["warnings"]),
        status="PROCESSING"
    )
    db.add(import_rec)
    db.commit()
    db.refresh(import_rec)
    import_id = import_rec.id

    parser = WorkbookParser(fixture_path)
    parsed_data = parser.parse()
    raw_txns = parsed_data["transactions"]
    reconciles = parsed_data["reconciliations"]
    raw_rows_data = parsed_data["raw_rows"]
    sheet_summaries = parsed_data["sheet_summaries"]

    for s in sheet_summaries:
        db.add(SourceSheet(
            import_id=import_id,
            sheet_name=s["sheet_name"],
            is_date_sheet=True,
            detected_date=s["detected_date"],
            section_count=s["section_count"],
            parsed_txn_count=s["parsed_count"]
        ))

    for rr in raw_rows_data:
        db.add(RawRow(
            import_id=import_id,
            sheet_name=rr["sheet_name"],
            row_number=rr["row_number"],
            section_name=rr["section_name"],
            raw_data_json=rr["raw_data_json"]
        ))

    norm_txns = [TransactionNormalizer.normalize(t, import_id) for t in raw_txns]
    norm_txns = SelfTransferEngine.apply(norm_txns)
    classifier = SmartClassifier(DEFAULT_RULES)
    norm_txns = classifier.classify_all(norm_txns)
    norm_txns, settle_links = DoubleCountEngine.process_settlements(norm_txns)
    norm_txns, dup_flags = DuplicateDetector.detect(norm_txns)

    initial_opening_bal = 0.0
    setting = db.query(AppSetting).filter(AppSetting.key == "initial_opening_balance").first()
    if setting:
        try:
            initial_opening_bal = float(setting.value)
        except ValueError:
            pass
    else:
        # Default initial opening balance to 0.0
        db.add(AppSetting(key="initial_opening_balance", value="0.0"))
        db.commit()

    earliest_date = min((t["txn_date"] for t in norm_txns if t.get("txn_date")), default=None)
    funds, norm_txns = FundTrackerEngine.generate_funds_from_receipts(
        norm_txns, 
        import_id=import_id,
        initial_opening_balance=initial_opening_bal,
        opening_date=earliest_date
    )
    expenses = [t for t in norm_txns if t["direction"] == "OUT"]
    allocations = FundTrackerEngine.auto_allocate_fifo(funds, expenses)

    daily_summaries = AuditEngine.compute_daily_summaries(norm_txns, import_id, initial_opening_balance=initial_opening_bal)
    engine_flags = AuditEngine.generate_all_audit_flags(norm_txns, reconciles, import_id)
    all_flags = engine_flags + dup_flags

    for f in funds:
        db.add(Fund(
            id=f["id"],
            fund_code=f["fund_code"],
            source_date=f["source_date"],
            source_sector=f["source_sector"],
            source_txn_id=f["source_txn_id"],
            original_amount=f["original_amount"],
            allocated_amount=f["allocated_amount"],
            spent_amount=f["spent_amount"],
            remaining_amount=f["remaining_amount"],
            status=f["status"],
            notes=f["notes"]
        ))

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

    for a in allocations:
        db.add(FundAllocation(
            expense_txn_id=a["expense_txn_id"],
            fund_id=a["fund_id"],
            amount_allocated=a["amount_allocated"],
            allocation_date=a["allocation_date"],
            allocation_method=a["allocation_method"],
            notes=a.get("notes")
        ))

    for link in settle_links:
        db.add(TransactionLink(
            source_txn_id=link["source_txn_id"],
            target_txn_id=link["target_txn_id"],
            link_type=link["link_type"],
            notes=link.get("notes")
        ))

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

    db.query(DailySummary).delete(synchronize_session=False)
    for ds in daily_summaries:
        db.add(DailySummary(
            import_id=import_id,
            summary_date=ds["summary_date"],
            gross_turnover=ds.get("gross_turnover", 0.0),
            opening_balance=ds.get("opening_balance", 0.0),
            bank_credits=ds.get("bank_credits", 0.0),
            bank_debits=ds.get("bank_debits", 0.0),
            closing_balance=ds.get("closing_balance", 0.0),
            total_customer_receipts=ds["total_customer_receipts"],
            bank_deposits=ds["bank_deposits"],
            direct_bank_deposits=ds.get("direct_bank_deposits", 0.0),
            cash_deposits=ds.get("cash_deposits", 0.0),
            bank_transfer_deposits=ds.get("bank_transfer_deposits", 0.0),
            upi_qr_collections=ds["upi_qr_collections"],
            upi_settlements=ds["upi_settlements"],
            actual_expenses=ds["actual_expenses"],
            internal_transfers=ds["internal_transfers"],
            net_operating_movement=ds["net_operating_movement"],
            matched_settlement_deducted=ds.get("matched_settlement_deducted", 0.0),
            txn_count=ds["txn_count"],
            unclassified_count=ds["unclassified_count"],
            audit_flag_count=ds["audit_flag_count"]
        ))

    for flg in all_flags:
        db.add(AuditFlag(
            import_id=import_id,
            txn_id=flg.get("txn_id"),
            sheet_name=flg.get("sheet_name"),
            flag_type=flg["flag_type"],
            severity=flg.get("severity", "MEDIUM"),
            description=flg["description"],
            status="OPEN"
        ))

    # Seed dynamic sectors
    all_sectors = set(
        [t.get("source_sector") for t in norm_txns if t.get("source_sector")] +
        [t.get("expense_sector") for t in norm_txns if t.get("expense_sector")]
    )
    for s_code in all_sectors:
        if s_code and not db.query(Sector).filter(Sector.code == s_code).first():
            db.add(Sector(
                code=s_code,
                name=s_code.title(),
                subsectors_json="[]",
                purpose=f"Auto-discovered sector {s_code}",
                is_active=True
            ))

    # Seed rules
    for r in DEFAULT_RULES:
        if not db.query(ClassificationRule).filter(ClassificationRule.name == r["name"]).first():
            db.add(ClassificationRule(
                name=r["name"],
                pattern=r["pattern"],
                match_field=r["match_field"],
                target_nature=r["target_nature"],
                target_sector=r["target_sector"],
                target_category=r["target_category"],
                confidence_score=r["confidence_score"],
                priority=r["priority"],
                is_active=r.get("is_active", True)
            ))

    dates = [t["txn_date"] for t in norm_txns if t.get("txn_date")]
    import_rec.status = "COMPLETED"
    import_rec.transaction_count = len(norm_txns)
    import_rec.period_start = min(dates) if dates else None
    import_rec.period_end = max(dates) if dates else None

    db.commit()
    print(f"Seeding completed successfully! Imported {len(norm_txns)} transactions across {len(daily_summaries)} daily sheets.")
    db.close()

if __name__ == "__main__":
    force = "--force" in sys.argv or "-f" in sys.argv
    seed_hdfc_fixture(force_reseed=force)

from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime, Date, Text,
    ForeignKey, Index
)
from sqlalchemy.orm import relationship
from app.core.database import Base

class Import(Base):
    __tablename__ = "imports"

    id = Column(Integer, primary_key=True, autoincrement=True)
    file_name = Column(String(255), nullable=False)
    file_hash = Column(String(64), nullable=False, index=True)
    file_size = Column(Integer, default=0)
    upload_date = Column(DateTime, default=datetime.utcnow)
    period_start = Column(String(50), nullable=True)
    period_end = Column(String(50), nullable=True)
    sheet_count = Column(Integer, default=0)
    date_sheet_count = Column(Integer, default=0)
    transaction_count = Column(Integer, default=0)
    warnings_count = Column(Integer, default=0)
    status = Column(String(50), default="COMPLETED") # COMPLETED, FAILED, ARCHIVED

    sheets = relationship("SourceSheet", back_populates="import_rel", cascade="all, delete-orphan")
    transactions = relationship("Transaction", back_populates="import_rel", cascade="all, delete-orphan")
    reconciliations = relationship("ReconciliationReport", back_populates="import_rel", cascade="all, delete-orphan")
    audit_flags = relationship("AuditFlag", back_populates="import_rel", cascade="all, delete-orphan")


class SourceSheet(Base):
    __tablename__ = "source_sheets"

    id = Column(Integer, primary_key=True, autoincrement=True)
    import_id = Column(Integer, ForeignKey("imports.id", ondelete="CASCADE"), nullable=False)
    sheet_name = Column(String(100), nullable=False)
    sheet_index = Column(Integer, default=0)
    is_date_sheet = Column(Boolean, default=False)
    detected_date = Column(String(50), nullable=True)
    section_count = Column(Integer, default=0)
    raw_row_count = Column(Integer, default=0)
    parsed_txn_count = Column(Integer, default=0)

    import_rel = relationship("Import", back_populates="sheets")


class RawRow(Base):
    __tablename__ = "raw_rows"

    id = Column(Integer, primary_key=True, autoincrement=True)
    import_id = Column(Integer, ForeignKey("imports.id", ondelete="CASCADE"), nullable=False)
    sheet_name = Column(String(100), nullable=False)
    row_number = Column(Integer, nullable=False)
    section_name = Column(String(100), nullable=True)
    raw_data_json = Column(Text, nullable=False)


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(String(64), primary_key=True) # UUID
    import_id = Column(Integer, ForeignKey("imports.id", ondelete="CASCADE"), nullable=False)
    txn_id_extracted = Column(String(100), nullable=True)
    txn_date = Column(String(20), nullable=False, index=True) # YYYY-MM-DD
    txn_time = Column(String(20), nullable=True)
    value_date = Column(String(20), nullable=True)
    source_sheet = Column(String(100), nullable=False, index=True)
    source_table = Column(String(100), nullable=False) # BANK_DEPOSIT, UPI_QR, ONLINE_PAYMENT
    transaction_type = Column(String(50), default="UNKNOWN") # NEFT, UPI, CASH, CARD, etc.
    transaction_nature = Column(String(50), nullable=False, index=True)
    # CUSTOMER RECEIPT, BANK DEPOSIT, UPI QR COLLECTION, UPI SETTLEMENT, EXPENSE,
    # SELF TRANSFER, BANK CHARGE, GATEWAY CHARGE, CARD PAYMENT, REFUND, REVERSAL, OTHER
    payment_channel = Column(String(50), default="OTHER") # BANK, UPI, QR, GATEWAY, CASH
    bank_account = Column(String(100), nullable=True)
    party_name = Column(String(255), nullable=True, index=True)
    party_account = Column(String(100), nullable=True)
    ifsc = Column(String(50), nullable=True)
    upi_id = Column(String(100), nullable=True)
    bank_ref_utr = Column(String(100), nullable=True, index=True)
    txn_reference = Column(String(100), nullable=True)
    description = Column(Text, nullable=True)
    amount = Column(Float, nullable=False, default=0.0)
    fee_amount = Column(Float, default=0.0)
    direction = Column(String(10), nullable=False, index=True) # IN, OUT, INTERNAL
    source_sector = Column(String(100), nullable=True, index=True)
    expense_sector = Column(String(100), nullable=True, index=True)
    category = Column(String(100), nullable=True, index=True)
    subcategory = Column(String(100), nullable=True)
    fund_id = Column(String(64), ForeignKey("funds.id", ondelete="SET NULL"), nullable=True, index=True)
    parent_txn_id = Column(String(64), nullable=True)
    linked_txn_id = Column(String(64), nullable=True)
    settlement_group_id = Column(String(64), nullable=True, index=True)
    status = Column(String(50), default="AUTO CLASSIFIED")
    # AUTO CLASSIFIED, USER CLASSIFIED, INFERRED, CONFIRMED, UNKNOWN
    confidence_score = Column(Float, default=0.0)
    audit_flag = Column(String(100), nullable=True, index=True)
    is_duplicate = Column(Boolean, default=False)
    duplicate_of_id = Column(String(64), nullable=True)
    original_row = Column(Integer, nullable=False)
    original_sheet = Column(String(100), nullable=False)
    original_raw_data = Column(Text, nullable=True) # JSON representation
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    import_rel = relationship("Import", back_populates="transactions")
    fund_rel = relationship("Fund", back_populates="transactions")
    allocations = relationship("FundAllocation", back_populates="expense_txn", cascade="all, delete-orphan")


class TransactionLink(Base):
    __tablename__ = "transaction_links"

    id = Column(Integer, primary_key=True, autoincrement=True)
    source_txn_id = Column(String(64), nullable=False, index=True)
    target_txn_id = Column(String(64), nullable=False, index=True)
    link_type = Column(String(50), nullable=False) # UPI_TO_SETTLEMENT, REFUND_TO_PAYMENT, PARENT_CHILD
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Sector(Base):
    __tablename__ = "sectors"

    id = Column(Integer, primary_key=True, autoincrement=True)
    code = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(100), nullable=False)
    subsectors_json = Column(Text, default="[]") # JSON list of strings/objects
    purpose = Column(String(255), nullable=True)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), unique=True, nullable=False)
    category_type = Column(String(20), default="EXPENSE") # RECEIPT, EXPENSE, INTERNAL
    sector_id = Column(Integer, ForeignKey("sectors.id", ondelete="SET NULL"), nullable=True)
    description = Column(Text, nullable=True)


class Fund(Base):
    __tablename__ = "funds"

    id = Column(String(64), primary_key=True) # e.g. FUND-000001
    fund_code = Column(String(50), unique=True, nullable=False, index=True)
    source_date = Column(String(20), nullable=False, index=True)
    source_sector = Column(String(100), nullable=False, index=True)
    source_txn_id = Column(String(64), nullable=True)
    original_amount = Column(Float, nullable=False, default=0.0)
    allocated_amount = Column(Float, default=0.0)
    spent_amount = Column(Float, default=0.0)
    remaining_amount = Column(Float, default=0.0)
    status = Column(String(50), default="OPEN") # OPEN, PARTIALLY USED, FULLY USED, OVERSPENT, UNALLOCATED, REVIEW REQUIRED
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    transactions = relationship("Transaction", back_populates="fund_rel")
    allocations = relationship("FundAllocation", back_populates="fund", cascade="all, delete-orphan")


class FundAllocation(Base):
    __tablename__ = "fund_allocations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    expense_txn_id = Column(String(64), ForeignKey("transactions.id", ondelete="CASCADE"), nullable=False, index=True)
    fund_id = Column(String(64), ForeignKey("funds.id", ondelete="CASCADE"), nullable=False, index=True)
    amount_allocated = Column(Float, nullable=False)
    allocation_date = Column(String(20), nullable=False)
    allocation_method = Column(String(50), default="AUTOMATIC") # MANUAL, FIFO, PRO_RATA, AUTOMATIC, OVERRIDE
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    fund = relationship("Fund", back_populates="allocations")
    expense_txn = relationship("Transaction", back_populates="allocations")


class ReconciliationReport(Base):
    __tablename__ = "reconciliation_reports"

    id = Column(Integer, primary_key=True, autoincrement=True)
    import_id = Column(Integer, ForeignKey("imports.id", ondelete="CASCADE"), nullable=False)
    sheet_name = Column(String(100), nullable=False)
    report_date = Column(String(20), nullable=False, index=True)
    section_name = Column(String(100), nullable=False)
    reported_total = Column(Float, default=0.0)
    parsed_total = Column(Float, default=0.0)
    difference = Column(Float, default=0.0)
    status = Column(String(50), nullable=False) # MATCH, MISMATCH, MISSING DATA, INVALID ROW
    notes = Column(Text, nullable=True)

    import_rel = relationship("Import", back_populates="reconciliations")


class AuditFlag(Base):
    __tablename__ = "audit_flags"

    id = Column(Integer, primary_key=True, autoincrement=True)
    import_id = Column(Integer, ForeignKey("imports.id", ondelete="CASCADE"), nullable=False)
    txn_id = Column(String(64), nullable=True, index=True)
    sheet_name = Column(String(100), nullable=True)
    flag_type = Column(String(100), nullable=False, index=True)
    # Duplicate Transaction, Missing Amount, Missing Date, Invalid Reference,
    # Duplicate UTR, Duplicate Transaction ID, Date Conflict, Unclassified Transaction,
    # Unallocated Receipt, Untracked Expense, Overallocated Fund, Overspent Fund,
    # Possible Self Transfer, Possible UPI Settlement, Possible Duplicate Settlement,
    # Source Total Mismatch
    severity = Column(String(20), default="MEDIUM") # HIGH, MEDIUM, LOW, INFO
    description = Column(Text, nullable=False)
    status = Column(String(50), default="OPEN") # OPEN, RESOLVED, IGNORED, MERGED
    resolved_at = Column(DateTime, nullable=True)
    resolved_by = Column(String(100), nullable=True)
    resolution_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    import_rel = relationship("Import", back_populates="audit_flags")


class ClassificationRule(Base):
    __tablename__ = "classification_rules"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    pattern = Column(String(255), nullable=False)
    match_field = Column(String(50), default="description") # description, party_name, comment, all
    target_nature = Column(String(50), nullable=True)
    target_sector = Column(String(100), nullable=True)
    target_category = Column(String(100), nullable=True)
    confidence_score = Column(Float, default=90.0)
    priority = Column(Integer, default=10)
    is_active = Column(Boolean, default=True)


class ClassificationHistory(Base):
    __tablename__ = "classification_history"

    id = Column(Integer, primary_key=True, autoincrement=True)
    txn_id = Column(String(64), nullable=False, index=True)
    old_nature = Column(String(50), nullable=True)
    new_nature = Column(String(50), nullable=True)
    old_sector = Column(String(100), nullable=True)
    new_sector = Column(String(100), nullable=True)
    old_category = Column(String(100), nullable=True)
    new_category = Column(String(100), nullable=True)
    changed_by = Column(String(100), default="SYSTEM")
    reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class DailySummary(Base):
    __tablename__ = "daily_summaries"

    id = Column(Integer, primary_key=True, autoincrement=True)
    import_id = Column(Integer, ForeignKey("imports.id", ondelete="CASCADE"), nullable=False)
    summary_date = Column(String(20), nullable=False, unique=True, index=True)
    
    # Financial metrics
    gross_turnover = Column(Float, default=0.0) # Total UPI QR + Bank Deposits
    total_customer_receipts = Column(Float, default=0.0) # Operating Income
    bank_deposits = Column(Float, default=0.0) # Total Bank Deposits (Direct + UPI QR)
    direct_bank_deposits = Column(Float, default=0.0) # Direct Bank Deposits (Table 1 = Cash + Bank Transfers)
    cash_deposits = Column(Float, default=0.0) # Cash / CDM / Cardless deposits
    bank_transfer_deposits = Column(Float, default=0.0) # NEFT / RTGS / Cheques / Self deposits
    upi_qr_collections = Column(Float, default=0.0)
    upi_settlements = Column(Float, default=0.0)
    actual_expenses = Column(Float, default=0.0)
    business_expenses = Column(Float, default=0.0)
    personal_expenses = Column(Float, default=0.0)
    internal_transfers = Column(Float, default=0.0)
    net_operating_movement = Column(Float, default=0.0)
    
    # Bank Account Balance Flow (Opening -> Inflows -> Outflows -> Expected Closing)
    opening_balance = Column(Float, default=0.0)
    bank_credits = Column(Float, default=0.0) # Total Table 1 bank inflows
    bank_debits = Column(Float, default=0.0)  # Total Table 3 bank outflows
    matched_settlement_deducted = Column(Float, default=0.0) # Deducted to prevent double counting
    closing_balance = Column(Float, default=0.0) # Expected Bank Balance
    
    txn_count = Column(Integer, default=0)
    unclassified_count = Column(Integer, default=0)
    audit_flag_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class AppSetting(Base):
    __tablename__ = "app_settings"

    key = Column(String(100), primary_key=True)
    value = Column(Text, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# Indexing for performance on 100,000+ records
Index("idx_txn_date_dir", Transaction.txn_date, Transaction.direction)
Index("idx_txn_nature_sec", Transaction.transaction_nature, Transaction.source_sector)
Index("idx_reconcile_date_sec", ReconciliationReport.report_date, ReconciliationReport.section_name)

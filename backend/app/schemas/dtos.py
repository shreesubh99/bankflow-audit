from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

# --- Import DTOs ---
class SheetScanInfo(BaseModel):
    sheet_name: str
    is_date_sheet: bool
    detected_date: Optional[str] = None
    section_count: int = 0
    candidate_txns: int = 0
    sections_found: List[str] = []

class ScanResult(BaseModel):
    file_name: str
    file_hash: str
    total_sheets: int
    date_sheets_count: int
    transaction_sections_count: int
    candidate_transactions_count: int
    warnings: List[str] = []
    sheets: List[SheetScanInfo] = []
    # Incremental continuation metadata
    has_existing_data: bool = False
    existing_max_date: Optional[str] = None
    existing_date_count: int = 0
    new_dates_count: int = 0
    new_period_start: Optional[str] = None
    new_period_end: Optional[str] = None
    last_closing_balance: float = 0.0

class ImportResponse(BaseModel):
    import_id: int
    file_name: str
    status: str
    sheet_count: int
    date_sheet_count: int
    transaction_count: int
    warnings_count: int
    period_start: Optional[str] = None
    period_end: Optional[str] = None
    is_incremental: bool = False
    appended_dates_count: int = 0
    total_active_dates_count: int = 0
    continuation_from_date: Optional[str] = None
    opening_balance_applied: float = 0.0

# --- Transaction DTOs ---
class TransactionDTO(BaseModel):
    id: str
    import_id: int
    txn_id_extracted: Optional[str] = None
    txn_date: str
    txn_time: Optional[str] = None
    value_date: Optional[str] = None
    source_sheet: str
    source_table: str
    transaction_type: str
    transaction_nature: str
    payment_channel: str
    bank_account: Optional[str] = None
    party_name: Optional[str] = None
    party_account: Optional[str] = None
    ifsc: Optional[str] = None
    upi_id: Optional[str] = None
    bank_ref_utr: Optional[str] = None
    txn_reference: Optional[str] = None
    description: Optional[str] = None
    amount: float
    fee_amount: float = 0.0
    direction: str
    source_sector: Optional[str] = None
    expense_sector: Optional[str] = None
    category: Optional[str] = None
    subcategory: Optional[str] = None
    fund_id: Optional[str] = None
    parent_txn_id: Optional[str] = None
    linked_txn_id: Optional[str] = None
    settlement_group_id: Optional[str] = None
    status: str
    confidence_score: float
    audit_flag: Optional[str] = None
    is_duplicate: bool = False
    original_row: int
    original_sheet: str
    original_raw_data: Optional[str] = None

    model_config = {"from_attributes": True}

class TransactionUpdate(BaseModel):
    category: Optional[str] = None
    source_sector: Optional[str] = None
    expense_sector: Optional[str] = None
    transaction_nature: Optional[str] = None
    fund_id: Optional[str] = None
    reason: Optional[str] = "Manual user override"

class TransactionListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    transactions: List[TransactionDTO]

# --- Daily Audit DTOs ---
class DailyAuditSummaryDTO(BaseModel):
    summary_date: str
    total_customer_receipts: float
    bank_deposits: float
    direct_bank_deposits: Optional[float] = 0.0
    cash_deposits: Optional[float] = 0.0
    bank_transfer_deposits: Optional[float] = 0.0
    upi_qr_collections: float
    upi_settlements: float
    actual_expenses: float
    business_expenses: Optional[float] = 0.0
    personal_expenses: Optional[float] = 0.0
    internal_transfers: float
    net_operating_movement: float
    gross_turnover: float = 0.0
    opening_balance: float = 0.0
    bank_credits: float = 0.0
    bank_debits: float = 0.0
    closing_balance: float = 0.0
    txn_count: int
    unclassified_count: int
    audit_flag_count: int
    reconciliation_match: bool = True
    prev_day_qr_total: Optional[float] = 0.0
    settlement_audit_diff: Optional[float] = None
    matched_settlement_deducted: Optional[float] = 0.0

class SettlementMatchItemDTO(BaseModel):
    settlement_party: str
    settlement_amount: float
    settlement_date: str
    prev_date: Optional[str] = None
    prev_qr_total: float = 0.0
    match_type: str  # 'EXACT_DAY_TOTAL', 'ROW_MATCH', 'SUM_MATCH', 'UNMATCHED'
    matched_entry_party: Optional[str] = None
    matched_entry_amount: Optional[float] = None
    difference: float = 0.0
    message: str

class DailyAuditDetailDTO(BaseModel):
    summary: DailyAuditSummaryDTO
    receipts: List[TransactionDTO]
    expenses: List[TransactionDTO]
    internal_movements: List[TransactionDTO]
    reconciliations: List[Dict[str, Any]]
    flags: List[Dict[str, Any]]
    settlement_verifications: List[SettlementMatchItemDTO] = []

# --- Fund DTOs ---
class FundDTO(BaseModel):
    id: str
    fund_code: str
    source_date: str
    source_sector: str
    source_txn_id: Optional[str] = None
    original_amount: float
    allocated_amount: float
    spent_amount: float
    remaining_amount: float
    status: str
    notes: Optional[str] = None

    model_config = {"from_attributes": True}

class FundAllocationRequest(BaseModel):
    fund_id: str
    expense_txn_id: str
    amount: float
    allocation_method: str = "MANUAL"
    notes: Optional[str] = None

class AutoAllocateRequest(BaseModel):
    method: str = "FIFO" # FIFO or PRO_RATA

class FundTreeNode(BaseModel):
    id: str
    name: str
    type: str # sector, fund, expense, remaining
    amount: float
    date: Optional[str] = None
    details: Optional[Dict[str, Any]] = None
    children: List["FundTreeNode"] = []

FundTreeNode.model_rebuild()

# --- Sector & Flow Matrix DTOs ---
class SectorDTO(BaseModel):
    id: int
    code: str
    name: str
    subsectors: List[str] = []
    purpose: Optional[str] = None
    description: Optional[str] = None
    is_active: bool = True

class SectorCreate(BaseModel):
    code: str
    name: str
    subsectors: List[str] = []
    purpose: Optional[str] = None
    description: Optional[str] = None

class SectorFlowMatrixResponse(BaseModel):
    source_sectors: List[str]
    expense_sectors: List[str]
    matrix: Dict[str, Dict[str, float]] # source_sec -> expense_sec -> amount
    totals_by_source: Dict[str, float]
    totals_by_expense: Dict[str, float]

# --- Reconciliation DTOs ---
class ReconciliationReportDTO(BaseModel):
    id: int
    sheet_name: str
    report_date: str
    section_name: str
    reported_total: float
    parsed_total: float
    difference: float
    status: str
    notes: Optional[str] = None

# --- Exceptions DTOs ---
class AuditFlagDTO(BaseModel):
    id: int
    import_id: int
    txn_id: Optional[str] = None
    sheet_name: Optional[str] = None
    flag_type: str
    severity: str
    description: str
    status: str
    created_at: Any
    resolved_at: Optional[Any] = None
    resolved_by: Optional[str] = None
    resolution_notes: Optional[str] = None
    txn_details: Optional[TransactionDTO] = None

class ResolveExceptionRequest(BaseModel):
    action: str # KEEP, IGNORE, MERGE, OVERRIDE, MARK_VALID
    notes: Optional[str] = None
    target_txn_id: Optional[str] = None

# --- Rules DTOs ---
class ClassificationRuleDTO(BaseModel):
    id: int
    name: str
    pattern: str
    match_field: str
    target_nature: Optional[str] = None
    target_sector: Optional[str] = None
    target_category: Optional[str] = None
    confidence_score: float = 90.0
    priority: int = 10
    is_active: bool = True

class RuleCreate(BaseModel):
    name: str
    pattern: str
    match_field: str = "description"
    target_nature: Optional[str] = None
    target_sector: Optional[str] = None
    target_category: Optional[str] = None
    confidence_score: float = 90.0
    priority: int = 10

# --- Dashboard DTOs ---
class DashboardSummaryDTO(BaseModel):
    initial_opening_balance: float = 0.0
    current_closing_balance: float = 0.0
    total_turnover: float = 0.0
    total_receipts: float # Operating Income
    total_expenses: float
    net_operating_movement: float
    total_bank_credits: float = 0.0
    total_bank_debits: float = 0.0
    upi_collections: float
    bank_deposits: float
    direct_bank_deposits: Optional[float] = 0.0
    cash_deposits: Optional[float] = 0.0
    bank_transfer_deposits: Optional[float] = 0.0
    internal_transfers: float
    unallocated_funds: float
    audit_exceptions_count: int
    total_transactions: int
    period_start: Optional[str] = None
    period_end: Optional[str] = None

class OpeningBalanceUpdate(BaseModel):
    amount: float

class DashboardChartsDTO(BaseModel):
    daily_timeline: List[Dict[str, Any]]
    monthly_timeline: List[Dict[str, Any]]
    sector_receipts: List[Dict[str, Any]]
    sector_expenses: List[Dict[str, Any]]
    source_to_expense_flows: List[Dict[str, Any]]
    exception_breakdown: List[Dict[str, Any]]

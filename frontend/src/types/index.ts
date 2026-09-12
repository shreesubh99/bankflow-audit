export interface DashboardSummary {
  initial_opening_balance?: number;
  current_closing_balance?: number;
  total_turnover?: number;
  total_bank_credits?: number;
  total_bank_debits?: number;
  total_receipts: number;
  total_expenses: number;
  net_operating_movement: number;
  upi_collections: number;
  bank_deposits: number;
  direct_bank_deposits?: number;
  cash_deposits?: number;
  bank_transfer_deposits?: number;
  internal_transfers: number;
  unallocated_funds: number;
  audit_exceptions_count: number;
  total_transactions: number;
  period_start?: string;
  period_end?: string;
}

export interface DailySummaryItem {
  summary_date: string;
  gross_turnover: number;
  opening_balance: number;
  bank_credits: number;
  bank_debits: number;
  closing_balance: number;
  total_customer_receipts: number;
  bank_deposits: number;
  direct_bank_deposits?: number;
  cash_deposits?: number;
  bank_transfer_deposits?: number;
  upi_qr_collections: number;
  upi_settlements: number;
  actual_expenses: number;
  business_expenses?: number;
  personal_expenses?: number;
  internal_transfers: number;
  net_operating_movement: number;
  txn_count: number;
  unclassified_count: number;
  audit_flag_count: number;
  reconciliation_match: boolean;
  prev_day_qr_total?: number;
  settlement_audit_diff?: number;
  matched_settlement_deducted?: number;
}

export interface SettlementVerificationItem {
  settlement_party: string;
  settlement_amount: number;
  settlement_date: string;
  prev_date?: string;
  prev_qr_total: number;
  match_type: 'EXACT_DAY_TOTAL' | 'ROW_MATCH' | 'SUM_MATCH' | 'GATEWAY_FEE_DIFF' | 'UNMATCHED_OR_MULTI_DAY' | string;
  matched_entry_party?: string;
  matched_entry_amount?: number;
  difference: number;
  message: string;
}

export interface Transaction {
  id: string;
  import_id: number;
  txn_id_extracted?: string;
  txn_date: string;
  txn_time?: string;
  value_date?: string;
  source_sheet: string;
  source_table: string;
  transaction_type: string;
  transaction_nature: string;
  payment_channel: string;
  bank_account?: string;
  party_name?: string;
  bank_ref_utr?: string;
  txn_reference?: string;
  description?: string;
  amount: number;
  fee_amount: number;
  direction: 'IN' | 'OUT' | 'INTERNAL';
  source_sector?: string;
  expense_sector?: string;
  category?: string;
  subcategory?: string;
  fund_id?: string;
  settlement_group_id?: string;
  status: string;
  confidence_score: number;
  audit_flag?: string;
  is_duplicate: boolean;
  original_row: number;
  original_sheet: string;
  original_raw_data?: string;
}

export interface FundItem {
  id: string;
  fund_code: string;
  source_date: string;
  source_sector: string;
  source_txn_id?: string;
  original_amount: number;
  allocated_amount: number;
  spent_amount: number;
  remaining_amount: number;
  status: 'OPEN' | 'PARTIALLY USED' | 'FULLY USED' | 'OVERSPENT' | 'UNALLOCATED' | 'REVIEW REQUIRED';
  notes?: string;
}

export interface FundTreeNode {
  id: string;
  name: string;
  type: 'sector' | 'fund' | 'expense' | 'remaining';
  amount: number;
  date?: string;
  details?: Record<string, any>;
  children: FundTreeNode[];
}

export interface ReverseTraceResponse {
  expense_id: string;
  party_name?: string;
  expense_sector?: string;
  total_expense_amount: number;
  date: string;
  funding_sources: Array<{
    fund_id: string;
    fund_code: string;
    source_sector: string;
    source_date: string;
    amount_allocated: number;
    allocation_method: string;
  }>;
  funded_amount: number;
  unfunded_amount: number;
}

export interface SectorItem {
  id: number;
  code: string;
  name: string;
  subsectors: string[];
  purpose?: string;
  description?: string;
  is_active: boolean;
}

export interface SectorFlowMatrix {
  source_sectors: string[];
  expense_sectors: string[];
  matrix: Record<string, Record<string, number>>;
  totals_by_source: Record<string, number>;
  totals_by_expense: Record<string, number>;
}

export interface ReconciliationItem {
  id: number;
  sheet_name: string;
  report_date: string;
  section_name: string;
  reported_total: number;
  parsed_total: number;
  difference: number;
  status: 'MATCH' | 'MISMATCH' | 'MISSING DATA' | 'INVALID ROW';
  notes?: string;
}

export interface AuditExceptionItem {
  id: number;
  import_id: number;
  txn_id?: string;
  sheet_name?: string;
  flag_type: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  description: string;
  status: 'OPEN' | 'RESOLVED' | 'IGNORED' | 'MERGED';
  created_at: string;
  resolved_at?: string;
  resolved_by?: string;
  resolution_notes?: string;
  txn_details?: Transaction;
}

export interface ClassificationRuleItem {
  id: number;
  name: string;
  pattern: string;
  match_field: string;
  target_nature?: string;
  target_sector?: string;
  target_category?: string;
  confidence_score: number;
  priority: number;
  is_active: boolean;
}

export interface ImportItem {
  id: number;
  file_name: string;
  file_size: number;
  upload_date: string;
  period_start?: string;
  period_end?: string;
  sheet_count: number;
  date_sheet_count: number;
  transaction_count: number;
  warnings_count: number;
  status: string;
}

export interface SettlementVerificationItem {
  settlement_party: string;
  settlement_amount: number;
  settlement_date: string;
  prev_date?: string;
  prev_qr_total: number;
  match_type: string;
  matched_entry_party?: string;
  matched_entry_amount?: number;
  difference: number;
  message: string;
}


import axios from 'axios';
import {
  DashboardSummary, DailySummaryItem, Transaction,
  FundItem, FundTreeNode, ReverseTraceResponse, SectorItem,
  SectorFlowMatrix, ReconciliationItem, AuditExceptionItem,
  ClassificationRuleItem, ImportItem
} from '../types';

const api = axios.create({
  baseURL: '/api',
  timeout: 60000,
});

export const apiClient = {
  // Dashboard
  getDashboardSummary: (startDate?: string, endDate?: string) =>
    api.get<DashboardSummary>('/dashboard/summary', { params: { start_date: startDate, end_date: endDate } }).then(r => r.data),

  getDashboardCharts: (startDate?: string, endDate?: string) =>
    api.get<any>('/dashboard/charts', { params: { start_date: startDate, end_date: endDate } }).then(r => r.data),

  // Daily Audit
  getDailyAuditList: (startDate?: string, endDate?: string, sortBy: string = 'summary_date', order: string = 'desc') =>
    api.get<DailySummaryItem[]>('/daily-audit', { params: { start_date: startDate, end_date: endDate, sort_by: sortBy, order } }).then(r => r.data),

  getDailyAuditDetail: (date: string) =>
    api.get<any>(`/daily-audit/${date}`).then(r => r.data),

  // Transactions
  getTransactions: (params: Record<string, any>) =>
    api.get<{ total: number; page: number; page_size: number; transactions: Transaction[] }>('/transactions', { params }).then(r => r.data),

  getTransactionDetail: (id: string) =>
    api.get<any>(`/transactions/${id}`).then(r => r.data),

  updateTransaction: (id: string, data: Record<string, any>) =>
    api.patch<Transaction>(`/transactions/${id}`, data).then(r => r.data),

  exportTransactionsUrl: (params: Record<string, any>) => {
    const qs = new URLSearchParams(params).toString();
    return `/api/transactions/export/csv?${qs}`;
  },

  // Funds
  getFunds: (sector?: string, status?: string) =>
    api.get<FundItem[]>('/funds', { params: { sector, status } }).then(r => r.data),

  getFundTrace: (fundId: string) =>
    api.get<FundTreeNode>(`/funds/${fundId}/trace`).then(r => r.data),

  getReverseTrace: (expenseTxnId: string) =>
    api.get<ReverseTraceResponse>(`/funds/reverse-trace/${expenseTxnId}`).then(r => r.data),

  allocateFund: (data: { fund_id: string; expense_txn_id: string; amount: number; allocation_method?: string; notes?: string }) =>
    api.post<any>('/funds/allocate', data).then(r => r.data),

  // Sectors & Flow Matrix
  getSectors: () =>
    api.get<SectorItem[]>('/sectors').then(r => r.data),

  createSector: (data: { code: string; name: string; subsectors?: string[]; purpose?: string; description?: string }) =>
    api.post<SectorItem>('/sectors', data).then(r => r.data),

  getSectorFlowMatrix: () =>
    api.get<SectorFlowMatrix>('/sectors/flow-matrix').then(r => r.data),

  // Reconciliation
  getReconciliations: (status?: string, reportDate?: string, sheetName?: string) =>
    api.get<ReconciliationItem[]>('/reconciliation', { params: { status, report_date: reportDate, sheet_name: sheetName } }).then(r => r.data),

  // Audit Exceptions
  getExceptions: (status: string = 'OPEN', flagType?: string, severity?: string) =>
    api.get<AuditExceptionItem[]>('/exceptions', { params: { status, flag_type: flagType, severity } }).then(r => r.data),

  resolveException: (id: number, data: { action: string; notes?: string }) =>
    api.post<any>(`/exceptions/${id}/resolve`, data).then(r => r.data),

  // Rules
  getRules: () =>
    api.get<ClassificationRuleItem[]>('/rules').then(r => r.data),

  createRule: (data: any) =>
    api.post<ClassificationRuleItem>('/rules', data).then(r => r.data),

  deleteRule: (id: number) =>
    api.delete<any>(`/rules/${id}`).then(r => r.data),

  // Imports
  getImports: () =>
    api.get<ImportItem[]>('/imports').then(r => r.data),

  scanWorkbook: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post<any>('/upload/scan', fd, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data);
  },

  importWorkbook: (
    file?: File, 
    useDemoFixture: boolean = false, 
    importMode: string = 'auto', 
    forceReimport: boolean = false
  ) => {
    const fd = new FormData();
    if (file) fd.append('file', file);
    fd.append('use_demo_fixture', String(useDemoFixture));
    fd.append('import_mode', importMode);
    fd.append('force_reimport', String(forceReimport));
    return api.post<any>('/upload/import', fd, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data);
  },

  deleteImport: (id: number) =>
    api.delete<any>(`/imports/${id}`).then(r => r.data),

  // Settings: Opening Bank Balance
  getOpeningBalance: () =>
    api.get<{ initial_opening_balance: number }>('/settings/opening-balance').then(r => r.data),

  setOpeningBalance: (amount: number) =>
    api.post<{ message: string; initial_opening_balance: number }>('/settings/opening-balance', { amount }).then(r => r.data),
};

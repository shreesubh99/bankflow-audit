import React, { useEffect, useState } from 'react';
import {
  Calendar, CheckCircle2, AlertCircle, ArrowLeft,
  ChevronRight, Download, Filter, ArrowDownUp, Wallet, Check, Edit3, RefreshCw, Landmark,
  QrCode, ArrowDownRight, ArrowUpRight, Repeat, Scale, LayoutGrid, Table, Link2
} from 'lucide-react';
import { apiClient } from '../../api/client';
import { DailySummaryItem, Transaction, SettlementVerificationItem } from '../../types';
import { formatINR, getDirectionBadge, getStatusBadge } from '../../utils/formatters';

interface DailyAuditViewProps {
  initialDate?: string;
  onSelectTransaction?: (txnId: string) => void;
}

export const DailyAuditView: React.FC<DailyAuditViewProps> = ({ initialDate, onSelectTransaction }) => {
  const [summaries, setSummaries] = useState<DailySummaryItem[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(initialDate || null);
  const [dateDetail, setDateDetail] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc'); // Default serial-wise
  const [viewMode, setViewMode] = useState<'matrix' | 'table'>('matrix'); // Matrix cards by default
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [activeDetailTab, setActiveDetailTab] = useState<'matrix' | 'reconciliation' | 'flags'>('matrix');
  const [expenseTab, setExpenseTab] = useState<'ALL' | 'BUSINESS' | 'PERSONAL'>('ALL');
  
  // Opening Balance state
  const [openingBalance, setOpeningBalance] = useState<number>(0);
  const [openingInput, setOpeningInput] = useState<string>('0');
  const [isEditingOpening, setIsEditingOpening] = useState<boolean>(false);
  const [savingBalance, setSavingBalance] = useState<boolean>(false);
  const [balanceSaved, setBalanceSaved] = useState<boolean>(false);

  useEffect(() => {
    loadSummaries(sortOrder);
    loadOpeningBal();
  }, []);

  const loadOpeningBal = async () => {
    try {
      const res = await apiClient.getOpeningBalance();
      setOpeningBalance(res.initial_opening_balance || 0);
      setOpeningInput(String(res.initial_opening_balance || 0));
    } catch (err) {
      console.error("Failed to fetch opening balance", err);
    }
  };

  const handleSaveOpening = async () => {
    const num = parseFloat(openingInput);
    if (isNaN(num)) return;
    setSavingBalance(true);
    try {
      await apiClient.setOpeningBalance(num);
      setOpeningBalance(num);
      setIsEditingOpening(false);
      setBalanceSaved(true);
      setTimeout(() => setBalanceSaved(false), 3000);
      await loadSummaries(sortOrder);
      if (selectedDate) {
        await loadDateDetail(selectedDate);
      }
    } catch (err) {
      console.error("Failed to set opening balance", err);
      alert("Failed to update opening balance.");
    } finally {
      setSavingBalance(false);
    }
  };

  useEffect(() => {
    if (selectedDate) {
      loadDateDetail(selectedDate);
    } else {
      setDateDetail(null);
    }
  }, [selectedDate]);

  const loadSummaries = async (order: 'asc' | 'desc' = sortOrder) => {
    setLoading(true);
    try {
      // By default order='asc' for strict serial chronological sequence
      const data = await apiClient.getDailyAuditList(undefined, undefined, 'summary_date', order);
      setSummaries(data);
      if (initialDate) {
        setSelectedDate(initialDate);
      }
    } catch (err) {
      console.error("Failed to load daily audits", err);
    } finally {
      setLoading(false);
    }
  };

  const toggleSortOrder = () => {
    const nextOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    setSortOrder(nextOrder);
    loadSummaries(nextOrder);
  };

  const loadDateDetail = async (d: string) => {
    setDetailLoading(true);
    try {
      const detail = await apiClient.getDailyAuditDetail(d);
      setDateDetail(detail);
    } catch (err) {
      console.error("Failed to load date detail", err);
    } finally {
      setDetailLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500"></div>
      </div>
    );
  }

  // --- Single Date Drilldown View ---
  // --- Single Date Drilldown View: HEAD-WISE MATRIX ---
  if (selectedDate && dateDetail) {
    const s = dateDetail.summary;
    const totalBankInflows = s.bank_deposits || s.bank_credits || 0;
    const matchedDeducted = s.matched_settlement_deducted || 0;
    const dayClosing = s.closing_balance ?? (s.opening_balance + totalBankInflows - s.bank_debits - matchedDeducted);
    const dayTurnover = s.gross_turnover || totalBankInflows;

    // Group transactions by Head Section
    const allDateTransactions = [
      ...(dateDetail.receipts || []),
      ...(dateDetail.expenses || []),
      ...(dateDetail.internal_movements || []),
    ];
    const seenTxnIds = new Set<string>();
    const uniqueDateTxns = allDateTransactions.filter((t: Transaction) => {
      const key = t.id || `${t.source_table}-${t.party_name}-${t.amount}-${t.original_row}`;
      if (seenTxnIds.has(key)) return false;
      seenTxnIds.add(key);
      return true;
    });

    const bankDepositTxns = uniqueDateTxns.filter(
      (t: Transaction) => t.source_table === 'BANK_DEPOSIT' || t.transaction_type === 'BANK_DEPOSIT'
    );
    const upiQrTxns = uniqueDateTxns.filter(
      (t: Transaction) => t.source_table === 'UPI_QR' || t.payment_channel === 'UPI_QR'
    );
    const expenseTxns = uniqueDateTxns.filter(
      (t: Transaction) => t.source_table === 'ONLINE_PAYMENT' || t.direction === 'OUT'
    );
    const internalTxns = uniqueDateTxns.filter(
      (t: Transaction) => t.direction === 'INTERNAL' && t.source_table !== 'BANK_DEPOSIT' && t.source_table !== 'ONLINE_PAYMENT'
    );

    const isPersonalTxn = (t: Transaction) => (
      t.category === 'PERSONAL EXPENSES' ||
      t.transaction_nature === 'PERSONAL EXPENSE' ||
      (t.party_name && /SELF|SHUBH/i.test(t.party_name)) ||
      (t.description && /SELF\s*TR|SELF|OWN\s*ACCOUNT/i.test(t.description))
    );

    const businessExpenseTxns = expenseTxns.filter((t) => !isPersonalTxn(t));
    const personalExpenseTxns = expenseTxns.filter((t) => isPersonalTxn(t));
    const businessSum = businessExpenseTxns.reduce((acc, t) => acc + (t.amount || 0), 0);
    const personalSum = personalExpenseTxns.reduce((acc, t) => acc + (t.amount || 0), 0);

    const filterTxn = (t: Transaction) => {
      if (!searchFilter) return true;
      const q = searchFilter.toLowerCase();
      return (
        (t.party_name && t.party_name.toLowerCase().includes(q)) ||
        (t.description && t.description.toLowerCase().includes(q)) ||
        (t.source_sector && t.source_sector.toLowerCase().includes(q)) ||
        (t.bank_ref_utr && t.bank_ref_utr.toLowerCase().includes(q)) ||
        String(t.amount).includes(q)
      );
    };

    const displayedExpenseTxns = (
      expenseTab === 'BUSINESS'
        ? businessExpenseTxns
        : expenseTab === 'PERSONAL'
        ? personalExpenseTxns
        : expenseTxns
    ).filter(filterTxn);

    return (
      <div className="space-y-6">
        {/* Navigation & Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setSelectedDate(null)}
            className="flex items-center gap-2 text-xs text-blue-600 hover:text-blue-800 bg-white border border-gray-300 px-3.5 py-2 rounded-xl transition-colors cursor-pointer shadow-xs font-semibold"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to All Dates</span>
          </button>

          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500 font-medium">Jump to Date:</span>
            <select
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-white border border-gray-300 text-gray-800 text-xs px-3 py-1.5 rounded-xl font-medium focus:outline-none focus:border-blue-500 shadow-xs"
            >
              {summaries.map((item) => (
                <option key={item.summary_date} value={item.summary_date}>
                  {item.summary_date}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Date Title Banner */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4 shadow-xs">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shadow-xs">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-xl font-black text-gray-900 tracking-tight">{s.summary_date}</h2>
                <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-md ${
                  s.reconciliation_match
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-300'
                    : 'bg-rose-50 text-rose-700 border border-rose-300'
                }`}>
                  {s.reconciliation_match ? '✓ MATCHED WITH SHEET' : '⚠ DIFFERENCE DETECTED'}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                {s.txn_count} Total Entries &bull; {s.audit_flag_count} Review Alerts
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-right">
              <span className="text-xs text-gray-500 font-medium">Day's Total Turnover</span>
              <div className="text-xl font-black font-mono text-gray-900">
                {formatINR(dayTurnover)}
              </div>
            </div>
            <div className="text-right border-l border-gray-200 pl-6">
              <span className="text-xs text-indigo-700 font-bold uppercase tracking-wider">Day Closing Bank Balance</span>
              <div className={`text-2xl font-black font-mono ${dayClosing >= 0 ? 'text-indigo-700' : 'text-amber-600'}`}>
                {formatINR(dayClosing)}
              </div>
            </div>
          </div>
        </div>

        {/* Bank Balance Running Matrix Card */}
        <div className="bg-gradient-to-r from-blue-50/60 via-indigo-50/40 to-white border border-blue-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <Landmark className="w-4 h-4 text-indigo-600" />
              <h3 className="text-xs font-bold text-indigo-900 uppercase tracking-wider">
                Bank Balance Calculation for {s.summary_date}
              </h3>
            </div>
            <span className="text-[11px] text-gray-500">Passbook Calculation</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="bg-white border border-gray-200 p-3 rounded-xl shadow-xs">
              <span className="text-gray-500 block mb-1 font-medium">Day Starting Balance</span>
              <span className="font-mono text-sm font-bold text-gray-800">{formatINR(s.opening_balance || 0)}</span>
            </div>
            <div className="bg-white border border-emerald-200 p-3 rounded-xl shadow-xs">
              <span className="text-emerald-700 block mb-1 font-semibold">+ Bank Deposits (Inflows)</span>
              <span className="font-mono text-sm font-bold text-emerald-700">{formatINR(totalBankInflows)}</span>
              <span className="text-[10px] text-emerald-800/80 block mt-0.5 font-medium">
                Table 1 (Bank Dep): {formatINR(s.direct_bank_deposits ?? (totalBankInflows - s.upi_qr_collections), true)} + Table 2 (QR): {formatINR(s.upi_qr_collections, true)}
              </span>
            </div>
            <div className="bg-white border border-rose-200 p-3 rounded-xl shadow-xs">
              <span className="text-rose-700 block mb-1 font-semibold">− Bank Payments (Outflows)</span>
              <span className="font-mono text-sm font-bold text-rose-700">{formatINR(s.bank_debits || 0)}</span>
              <span className="text-[10px] text-rose-800/80 block mt-0.5 font-medium font-mono">
                Business: {formatINR(s.business_expenses ?? businessSum, true)} + Personal: {formatINR(s.personal_expenses ?? personalSum, true)}
              </span>
            </div>
            <div className="bg-indigo-50 border border-indigo-300 p-3 rounded-xl shadow-xs">
              <div className="flex items-center justify-between mb-1">
                <span className="text-indigo-900 font-bold block">= Day Closing Balance</span>
                {matchedDeducted > 0 && (
                  <span className="text-[9px] font-black bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded border border-emerald-300">
                    −{formatINR(matchedDeducted, true)} NO DOUBLE ENTRY
                  </span>
                )}
              </div>
              <span className={`font-mono text-sm font-black ${dayClosing >= 0 ? 'text-indigo-800' : 'text-amber-700'}`}>
                {formatINR(dayClosing)}
              </span>
              <span className="text-[10px] text-indigo-700/80 block mt-0.5 font-medium font-mono">
                {formatINR(s.opening_balance || 0, true)} + {formatINR(totalBankInflows, true)} − {formatINR(s.bank_debits || 0, true)}
                {matchedDeducted > 0 ? ` − ${formatINR(matchedDeducted, true)} (Settlement)` : ''}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Search inside Day's entries */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-gray-900">Day's Head-Wise Entry Matrix</h3>
            <p className="text-xs text-gray-500">Every entry of this date grouped by its financial Head Section</p>
          </div>
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Search party name, ref, amount..."
            className="bg-white border border-gray-300 text-xs px-3 py-1.5 rounded-xl w-64 text-gray-800 focus:outline-none focus:border-blue-500 shadow-xs"
          />
        </div>

        {/* Total Bank Deposits Inflow Summary Banner */}
        <div className="bg-gradient-to-r from-blue-50/80 via-indigo-50/50 to-white border border-blue-200 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700">
              <Landmark className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-gray-900 text-xs">
                Total Bank Deposits (कुल बैंक जमा = Table 1 Bank Deposit + Table 2 UPI QR)
              </span>
              <p className="text-[11px] text-gray-500">
                Table 1 (Bank Deposit): <strong className="font-mono text-gray-800">{formatINR(s.direct_bank_deposits ?? (s.bank_deposits - s.upi_qr_collections))}</strong> &bull; Table 2 (UPI / QR Collections): <strong className="font-mono text-cyan-800">{formatINR(s.upi_qr_collections)}</strong>
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-gray-500 uppercase font-semibold block">Total Deposited in Bank</span>
            <span className="font-mono font-black text-base text-blue-700">
              {formatINR(s.bank_deposits)}
            </span>
          </div>
        </div>

        {/* UPI / Card Settlement Cross-Day Match Verification Card */}
        {dateDetail.settlement_verifications && dateDetail.settlement_verifications.length > 0 && (
          <div className="bg-white border border-indigo-200 rounded-xl p-4 shadow-xs space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
                  <Link2 className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                    UPI Settlement Cross-Day Verification (कल के QR से UPI Settlement मिलान)
                  </h4>
                  <p className="text-[11px] text-gray-500">
                    Table 1 me specific keyword 'UPI SETTLEMENT' amount ka pichhle din ke Table 2 (QR) entries se cross verification
                  </p>
                </div>
              </div>
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200">
                {dateDetail.settlement_verifications.length} Settlement {dateDetail.settlement_verifications.length === 1 ? 'Entry' : 'Entries'}
              </span>
            </div>

            {/* Mathematical Subtraction Banner: Prev Day QR - Today Settlement */}
            {(() => {
              const prevQr = dateDetail.settlement_verifications[0]?.prev_qr_total || 0;
              const prevDateStr = dateDetail.settlement_verifications[0]?.prev_date || 'Previous Day';
              const settleSum = s.upi_settlements || 0;
              const diffVal = Math.round((prevQr - settleSum) * 100) / 100;
              const isPerfectZero = Math.abs(diffVal) < 0.01;

              return (
                <div className="bg-gradient-to-r from-blue-50/90 via-indigo-50/70 to-white border border-blue-200 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs shadow-2xs">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-black uppercase tracking-wider text-indigo-800 bg-indigo-100 px-2 py-0.5 rounded">
                        AUDIT FORMULA (ऑडिट फॉर्मूला: कल का QR − आज का सेटलमेंट)
                      </span>
                      <span className="text-[11px] text-gray-500">
                        Pichle Din ({prevDateStr}) Table 2 QR − Aaj Ka Table 1 Settlement
                      </span>
                    </div>
                    <div className="font-mono text-sm font-black text-gray-900 flex items-center gap-1.5 flex-wrap">
                      <span className="text-blue-700">{formatINR(prevQr)}</span>
                      <span className="text-gray-400 font-normal">(कल का QR)</span>
                      <span className="text-rose-600 font-bold">−</span>
                      <span className="text-indigo-700">{formatINR(settleSum)}</span>
                      <span className="text-gray-400 font-normal">(आज का Settlement)</span>
                      <span className="text-gray-500 font-bold">=</span>
                      <span className={isPerfectZero ? 'text-emerald-700 font-black' : 'text-amber-700 font-black'}>
                        {formatINR(diffVal)}
                      </span>
                    </div>
                    {matchedDeducted > 0 && (
                      <p className="text-[11px] text-emerald-800 font-semibold mt-1.5 flex items-center gap-1">
                        <span>✓ Double Entry Fixed:</span>
                        <span className="font-normal text-gray-600">
                          Kal ka QR paisa already balance me tha, isliye matched settlement ({formatINR(matchedDeducted)}) closing balance se minus kar diya gaya hai.
                        </span>
                      </p>
                    )}
                  </div>
                  <div>
                    <span className={`px-3 py-1.5 rounded-lg text-xs font-bold font-sans border inline-flex items-center gap-1.5 ${
                      isPerfectZero
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        : 'bg-amber-50 text-amber-800 border-amber-300'
                    }`}>
                      {isPerfectZero ? '✓ 100% RECONCILED (Diff = ₹0.00)' : `VARIANCE: ${formatINR(diffVal)}`}
                    </span>
                  </div>
                </div>
              );
            })()}

            <div className="space-y-2.5">
              {dateDetail.settlement_verifications.map((item: SettlementVerificationItem, idx: number) => {
                const isExactMatch = item.match_type === 'EXACT_DAY_TOTAL' || item.match_type === 'EXACT_DAY_TOTAL_T2';
                const isRowMatch = item.match_type === 'ROW_MATCH' || item.match_type === 'ROW_MATCH_T2';
                const isSumMatch = item.match_type === 'SUM_MATCH' || item.match_type === 'MDR_FEE_ADJUSTED';

                let badgeBg = 'bg-amber-50 text-amber-700 border-amber-300';
                let badgeLabel = 'BATCH / MULTI-DAY';
                if (isExactMatch) {
                  badgeBg = 'bg-emerald-50 text-emerald-700 border-emerald-300';
                  badgeLabel = '✓ 100% EXACT DAY MATCH';
                } else if (isRowMatch) {
                  badgeBg = 'bg-blue-50 text-blue-700 border-blue-300';
                  badgeLabel = '✓ MATCHED CUSTOMER ROW';
                } else if (isSumMatch) {
                  badgeBg = 'bg-indigo-50 text-indigo-700 border-indigo-300';
                  badgeLabel = '✓ BATCH SUM MATCH';
                }

                return (
                  <div
                    key={idx}
                    className={`p-3.5 rounded-xl border transition-all ${
                      isExactMatch
                        ? 'bg-emerald-50/40 border-emerald-200'
                        : isRowMatch
                        ? 'bg-blue-50/40 border-blue-200'
                        : isSumMatch
                        ? 'bg-indigo-50/40 border-indigo-200'
                        : 'bg-amber-50/30 border-amber-200'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border ${badgeBg}`}>
                          {badgeLabel}
                        </span>
                        <span className="text-xs font-bold text-gray-900">
                          {item.settlement_party}
                        </span>
                      </div>
                      <div className="text-right font-mono">
                        <span className="text-xs text-gray-500 mr-2">Settlement Amount:</span>
                        <span className="text-sm font-black text-gray-900">{formatINR(item.settlement_amount)}</span>
                      </div>
                    </div>

                    <div className="mt-2 text-xs text-gray-700 flex flex-wrap items-center justify-between gap-2 bg-white/80 p-2.5 rounded-lg border border-gray-200/80">
                      <div>
                        <p className="font-medium text-gray-800">{item.message}</p>
                        {item.matched_entry_party && (
                          <p className="text-[11px] text-blue-700 font-semibold mt-0.5">
                            Matched Entry: <span className="font-bold">{item.matched_entry_party}</span> ({formatINR(item.matched_entry_amount || 0)})
                          </p>
                        )}
                      </div>
                      {item.prev_date && (
                        <div className="text-[11px] text-gray-500 font-mono text-right">
                          Yesterday ({item.prev_date}) QR Total: <strong className="text-gray-900">{formatINR(item.prev_qr_total)}</strong>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 4 HEAD-WISE SECTIONS MATRIX (Grid Layout) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* HEAD 1: Bank Deposits (Table 1) */}
          <HeadMatrixSection
            title="Head 1: Bank Deposits (Table 1 - बैंक जमा)"
            subtitle="All entries from Excel Table 1: Cash deposits, Cheques, NEFT/RTGS, Self deposits & settlements"
            icon={Landmark}
            headerColor="bg-blue-50 border-blue-200 text-blue-900"
            subtotal={s.direct_bank_deposits ?? (s.bank_deposits - s.upi_qr_collections)}
            txns={bankDepositTxns.filter(filterTxn)}
            onSelect={onSelectTransaction}
          />

          {/* HEAD 2: UPI / QR Collections */}
          <HeadMatrixSection
            title="Head 2: UPI / QR Collections (QR से प्राप्त)"
            subtitle="Customer SmartHub & PayZapp QR collections (settled into bank)"
            icon={QrCode}
            headerColor="bg-cyan-50 border-cyan-200 text-cyan-900"
            subtotal={s.upi_qr_collections}
            txns={upiQrTxns.filter(filterTxn)}
            onSelect={onSelectTransaction}
          />

          {/* HEAD 3: Online Payments / Expenses */}
          <HeadMatrixSection
            title="Head 3: Online Payments & Expenses (बैंक से भुगतान)"
            subtitle="Online disbursements: Business vendor expenses + Personal expenses / self transfers"
            icon={ArrowDownRight}
            headerColor="bg-rose-50 border-rose-200 text-rose-900"
            subtotal={s.actual_expenses || (businessSum + personalSum)}
            txns={displayedExpenseTxns}
            onSelect={onSelectTransaction}
            breakdown={[
              {
                label: 'Business Expenses',
                amount: s.business_expenses ?? businessSum,
                count: businessExpenseTxns.length,
                dotColor: 'bg-rose-500',
                textColor: 'text-rose-900'
              },
              {
                label: 'Personal Expenses',
                amount: s.personal_expenses ?? personalSum,
                count: personalExpenseTxns.length,
                dotColor: 'bg-purple-600',
                textColor: 'text-purple-900'
              }
            ]}
            categoryTabs={[
              { id: 'ALL', label: 'All Payments', count: expenseTxns.length },
              { id: 'BUSINESS', label: 'Business Expenses', count: businessExpenseTxns.length },
              { id: 'PERSONAL', label: 'Personal Expenses', count: personalExpenseTxns.length }
            ]}
            activeTab={expenseTab}
            onTabChange={setExpenseTab}
          />

          {/* HEAD 4: Internal Transfers & Settlements */}
          <HeadMatrixSection
            title="Head 4: Internal Transfers (आपसी ट्रांसफर)"
            subtitle="QR settlements to bank & self-transfers (excluded from income)"
            icon={Repeat}
            headerColor="bg-amber-50 border-amber-200 text-amber-900"
            subtotal={s.internal_transfers}
            txns={internalTxns.filter(filterTxn)}
            onSelect={onSelectTransaction}
          />
        </div>

        {/* HEAD 5: Sheet Total Match & Verification */}
        {dateDetail.reconciliations && dateDetail.reconciliations.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-xs">
            <div className="flex items-center gap-2 mb-3">
              <Scale className="w-4 h-4 text-blue-600" />
              <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                Excel Sheet Total vs Calculated Sum Verification
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 text-gray-600 uppercase text-[10px] tracking-wider border-b border-gray-200">
                  <tr>
                    <th className="py-2 px-3 font-bold">Section Name</th>
                    <th className="py-2 px-3 font-bold">Excel Sheet Total</th>
                    <th className="py-2 px-3 font-bold">Calculated Sum</th>
                    <th className="py-2 px-3 font-bold">Difference</th>
                    <th className="py-2 px-3 font-bold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-mono">
                  {dateDetail.reconciliations.map((r: any, idx: number) => (
                    <tr key={idx}>
                      <td className="py-2 px-3 font-sans font-medium text-gray-800">{r.section_name}</td>
                      <td className="py-2 px-3 font-bold text-gray-700">{formatINR(r.reported_total)}</td>
                      <td className="py-2 px-3 font-bold text-gray-700">{formatINR(r.parsed_total)}</td>
                      <td className={`py-2 px-3 font-bold ${r.difference === 0 ? 'text-gray-400' : 'text-rose-600'}`}>
                        {formatINR(r.difference)}
                      </td>
                      <td className="py-2 px-3 font-sans">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${getStatusBadge(r.status)}`}>
                          {r.status === 'MATCH' ? 'MATCHED' : r.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- Day-Wise Master View (Cards Matrix or Spreadsheet Matrix Table) ---
  return (
    <div className="space-y-6">
      {/* Header & Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <span>Day-Wise Bank Ledger</span>
            <span className="text-xs bg-blue-100 text-blue-800 border border-blue-200 px-2 py-0.5 rounded-md font-semibold">
              {summaries.length} Serial Days ({sortOrder === 'asc' ? '02-MAY ➔ 05-SEP' : '05-SEP ➔ 02-MAY'})
            </span>
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Full chronological audit with running bank balance, turnover, real income, and expenses.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* View Mode Toggle: Matrix Cards vs Matrix Table */}
          <div className="flex items-center bg-white border border-gray-300 p-1 rounded-xl shadow-xs text-xs">
            <button
              onClick={() => setViewMode('matrix')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                viewMode === 'matrix' ? 'bg-blue-600 text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Matrix Cards</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                viewMode === 'table' ? 'bg-blue-600 text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Table className="w-3.5 h-3.5" />
              <span>Matrix Table</span>
            </button>
          </div>

          {/* Sort Order Toggle */}
          <button
            onClick={toggleSortOrder}
            className="flex items-center gap-1.5 text-xs bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 px-3 py-2 rounded-xl transition-colors font-semibold cursor-pointer shadow-xs"
            title="Toggle between Serial Ascending and Descending"
          >
            <ArrowDownUp className="w-3.5 h-3.5 text-blue-600" />
            <span>Order: {sortOrder === 'asc' ? 'Serial Wise (Ascending)' : 'Newest First (Descending)'}</span>
          </button>
        </div>
      </div>

      {/* Opening Balance Quick-Adjust Bar */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shadow-xs">
            <Wallet className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-gray-800 flex items-center gap-2">
              <span>Initial Opening Bank Balance:</span>
              <span className="font-mono text-emerald-700 font-black text-sm">{formatINR(openingBalance)}</span>
              {balanceSaved && (
                <span className="text-[10px] text-emerald-700 bg-emerald-100 border border-emerald-300 px-1.5 py-0.5 rounded flex items-center gap-0.5 font-semibold">
                  <Check className="w-2.5 h-2.5" /> Updated
                </span>
              )}
            </div>
            <p className="text-[11px] text-gray-500">
              All 118 daily opening and closing balances are calculated automatically from this starting amount.
            </p>
          </div>
        </div>

        <div>
          {!isEditingOpening ? (
            <button
              onClick={() => setIsEditingOpening(true)}
              className="text-xs bg-gray-50 hover:bg-gray-100 text-blue-600 font-semibold border border-gray-300 px-3.5 py-1.5 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Change Opening Balance</span>
            </button>
          ) : (
            <div className="flex items-center gap-2 bg-white border border-blue-400 p-1.5 rounded-xl shadow-md">
              <span className="text-xs text-gray-500 font-bold pl-1">₹</span>
              <input
                type="number"
                step="any"
                value={openingInput}
                onChange={(e) => setOpeningInput(e.target.value)}
                className="bg-gray-50 border border-gray-300 text-gray-900 font-mono text-xs px-2.5 py-1 rounded-lg w-32 focus:outline-none focus:border-blue-500"
                autoFocus
              />
              <button
                onClick={handleSaveOpening}
                disabled={savingBalance}
                className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors cursor-pointer shadow-xs"
              >
                {savingBalance ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                <span>Save</span>
              </button>
              <button
                onClick={() => {
                  setIsEditingOpening(false);
                  setOpeningInput(String(openingBalance));
                }}
                className="text-xs text-gray-500 hover:text-gray-800 px-2 py-1 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {/* MATRIX CARDS VIEW */}
      {viewMode === 'matrix' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {summaries.map((item) => {
            const dayClosing = item.closing_balance ?? (item.opening_balance + item.bank_credits - item.bank_debits);
            const dayTurnover = item.gross_turnover || (item.upi_qr_collections + item.bank_deposits);

            return (
              <div
                key={item.summary_date}
                onClick={() => setSelectedDate(item.summary_date)}
                className="bg-white border border-gray-200 hover:border-blue-400 hover:shadow-md transition-all rounded-xl p-4 cursor-pointer group shadow-xs flex flex-col justify-between"
              >
                <div>
                  {/* Card Header: Date & Status */}
                  <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-blue-600" />
                      <span className="font-bold text-gray-900 text-sm group-hover:text-blue-600 transition-colors">
                        {item.summary_date}
                      </span>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      item.reconciliation_match ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}>
                      {item.reconciliation_match ? 'MATCHED' : 'DIFF'}
                    </span>
                  </div>

                  {/* Head Section 1: Running Bank Balance Matrix */}
                  <div className="bg-gray-50/70 border border-gray-200/80 rounded-xl p-2.5 my-3 text-xs">
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                      Bank Balance Matrix
                    </div>
                    <div className="grid grid-cols-3 gap-1 font-mono text-[11px] mb-1 text-center">
                      <div className="bg-white border border-gray-200 p-1 rounded">
                        <span className="text-gray-400 block text-[9px]">Open</span>
                        <span className="font-semibold text-gray-700">{formatINR(item.opening_balance || 0, true)}</span>
                      </div>
                      <div className="bg-white border border-emerald-200 p-1 rounded">
                        <span className="text-emerald-600 block text-[9px]">+ Inflow</span>
                        <span className="font-bold text-emerald-700">{formatINR(item.bank_credits || 0, true)}</span>
                      </div>
                      <div className="bg-white border border-rose-200 p-1 rounded">
                        <span className="text-rose-600 block text-[9px]">− Outflow</span>
                        <span className="font-bold text-rose-700">{formatINR(item.bank_debits || 0, true)}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-gray-200 text-xs">
                      <span className="text-gray-600 font-semibold">Expected Closing:</span>
                      <span className={`font-mono font-bold ${dayClosing >= 0 ? 'text-indigo-700' : 'text-amber-700'}`}>
                        {formatINR(dayClosing)}
                      </span>
                    </div>
                  </div>

                  {/* Head Section 2: Financial Matrix Totals */}
                  <div className="space-y-1 text-xs text-gray-600">
                    <div className="flex justify-between">
                      <span className="text-gray-700 font-medium">Total Bank Deposits:</span>
                      <span className="font-mono font-bold text-blue-700">{formatINR(item.bank_deposits)}</span>
                    </div>
                    <div className="flex justify-between text-[11px] text-gray-400 pl-1 font-mono">
                      <span>• Direct Bank: {formatINR(item.direct_bank_deposits || 0, true)}</span>
                      <span>• UPI QR: {formatINR(item.upi_qr_collections || 0, true)}</span>
                    </div>
                    <div className="flex justify-between pt-0.5">
                      <span className="text-gray-500">Customer Receipts:</span>
                      <span className="font-mono text-emerald-700 font-semibold">{formatINR(item.total_customer_receipts)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Expenses / Payments:</span>
                      <span className="font-mono text-rose-700 font-semibold">{formatINR(item.actual_expenses)}</span>
                    </div>
                    {(item.personal_expenses || 0) > 0 && (
                      <div className="flex justify-between text-[11px] text-gray-400 pl-1 font-mono">
                        <span>• Business: {formatINR(item.business_expenses ?? (item.actual_expenses - (item.personal_expenses || 0)), true)}</span>
                        <span>• Personal: {formatINR(item.personal_expenses || 0, true)}</span>
                      </div>
                    )}
                    {item.upi_settlements > 0 && (
                      <div className="mt-2 bg-indigo-50/70 border border-indigo-200 rounded-lg p-2 text-[11px] font-mono">
                        <div className="flex items-center justify-between text-indigo-900 font-sans font-bold text-[10px] mb-0.5">
                          <span>UPI Settlement Audit:</span>
                          <span className={item.settlement_audit_diff === 0 ? 'text-emerald-700 font-bold' : 'text-amber-700 font-bold'}>
                            {item.settlement_audit_diff === 0 ? '✓ MATCHED' : `Diff: ${formatINR(item.settlement_audit_diff || 0, true)}`}
                          </span>
                        </div>
                        <div className="text-gray-600 text-[10px]">
                          QR {formatINR(item.prev_day_qr_total || 0, true)} − Settle {formatINR(item.upi_settlements, true)} = {formatINR(item.settlement_audit_diff || 0, true)}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center justify-between text-xs text-blue-600 font-semibold group-hover:text-blue-800">
                  <span className="text-gray-400 font-normal">{item.txn_count} entries recorded</span>
                  <div className="flex items-center gap-0.5">
                    <span>View Head Matrix</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* DETAILED MATRIX TABLE VIEW */}
      {viewMode === 'table' && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-700 uppercase text-[10px] tracking-wider border-b border-gray-200">
                <tr>
                  <th className="py-3 px-3 font-bold">Date</th>
                  <th className="py-3 px-3 font-bold text-gray-500">Day Open</th>
                  <th className="py-3 px-3 font-bold text-emerald-700">Bank In (+)</th>
                  <th className="py-3 px-3 font-bold text-rose-700">Bank Out (−)</th>
                  <th className="py-3 px-3 font-bold text-indigo-700">Expected Closing</th>
                  <th className="py-3 px-3 font-bold text-blue-700">Total Bank Deposits (Bank + QR)</th>
                  <th className="py-3 px-3 font-bold text-emerald-700">Real Receipts</th>
                  <th className="py-3 px-3 font-bold text-rose-700">Expenses</th>
                  <th className="py-3 px-3 font-bold">Entries</th>
                  <th className="py-3 px-3 font-bold">Sheet Match</th>
                  <th className="py-3 px-3 font-bold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-mono">
                {summaries.map((item) => {
                  const dayClosing = item.closing_balance ?? (item.opening_balance + item.bank_credits - item.bank_debits);

                  return (
                    <tr
                      key={item.summary_date}
                      onClick={() => setSelectedDate(item.summary_date)}
                      className="hover:bg-blue-50/50 transition-colors cursor-pointer group"
                    >
                      <td className="py-2.5 px-3 font-sans font-semibold text-gray-900 group-hover:text-blue-600 whitespace-nowrap">
                        {item.summary_date}
                      </td>
                      <td className="py-2.5 px-3 text-gray-500">{formatINR(item.opening_balance || 0)}</td>
                      <td className="py-2.5 px-3 font-bold text-emerald-700">
                        +{formatINR(item.bank_credits || 0)}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-rose-700">
                        −{formatINR(item.bank_debits || 0)}
                      </td>
                      <td className={`py-2.5 px-3 font-black ${dayClosing >= 0 ? 'text-indigo-700' : 'text-amber-700'}`}>
                        {formatINR(dayClosing)}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="font-bold text-blue-700 block">{formatINR(item.bank_deposits)}</span>
                        <span className="text-[10px] text-gray-400 font-normal font-sans block">
                          Direct {formatINR(item.direct_bank_deposits || 0, true)} + QR {formatINR(item.upi_qr_collections || 0, true)}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="font-bold text-rose-700 block">{formatINR(item.actual_expenses)}</span>
                        {(item.personal_expenses || 0) > 0 ? (
                          <span className="text-[10px] text-gray-400 font-normal font-sans block">
                            Biz {formatINR(item.business_expenses ?? (item.actual_expenses - (item.personal_expenses || 0)), true)} + Pers {formatINR(item.personal_expenses || 0, true)}
                          </span>
                        ) : (
                          <span className="text-[10px] text-gray-400 font-normal font-sans block">Biz: {formatINR(item.actual_expenses, true)}</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-sans">
                        <div className="flex flex-col gap-1">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            item.reconciliation_match ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}>
                            {item.reconciliation_match ? 'MATCHED' : 'DIFF'}
                          </span>
                          {item.upi_settlements > 0 && (
                            <span
                              className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
                                item.settlement_audit_diff === 0
                                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                  : 'bg-amber-50 text-amber-700 border-amber-200'
                              }`}
                              title={`Prev QR ${formatINR(item.prev_day_qr_total || 0, true)} - Settlement ${formatINR(item.upi_settlements, true)} = Diff ${formatINR(item.settlement_audit_diff || 0, true)}`}
                            >
                              {item.settlement_audit_diff === 0
                                ? 'Settle: 0'
                                : `Diff: ${formatINR(item.settlement_audit_diff || 0, true)}`}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-sans">
                        <button className="text-xs text-blue-600 group-hover:text-blue-800 flex items-center justify-end gap-1 ml-auto font-semibold">
                          <span>Matrix</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

interface SectionBreakdownItem {
  label: string;
  amount: number;
  count?: number;
  dotColor?: string;
  textColor?: string;
}

interface HeadMatrixSectionProps {
  title: string;
  subtitle: string;
  icon: any;
  headerColor: string;
  subtotal: number;
  txns: Transaction[];
  onSelect?: (id: string) => void;
  breakdown?: SectionBreakdownItem[];
  categoryTabs?: { id: string; label: string; count: number }[];
  activeTab?: string;
  onTabChange?: (tabId: any) => void;
}

const HeadMatrixSection: React.FC<HeadMatrixSectionProps> = ({
  title,
  subtitle,
  icon: Icon,
  headerColor,
  subtotal,
  txns,
  onSelect,
  breakdown,
  categoryTabs,
  activeTab,
  onTabChange
}) => {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-xs flex flex-col justify-between">
      <div>
        {/* Section Header */}
        <div className={`p-3.5 border-b border-gray-200 flex items-center justify-between ${headerColor}`}>
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-white/80 rounded-lg shadow-xs">
              <Icon className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-bold text-xs tracking-tight">{title}</h4>
              <p className="text-[10px] text-gray-500 opacity-90">{subtitle}</p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] uppercase font-bold text-gray-500 block">Subtotal</span>
            <span className="font-mono text-sm font-black">{formatINR(subtotal)}</span>
          </div>
        </div>

        {/* Breakdown Banner (e.g. Business vs Personal) */}
        {breakdown && breakdown.length > 0 && (
          <div className="bg-slate-50/90 border-b border-gray-200 px-3.5 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
            {breakdown.map((b, idx) => (
              <div key={idx} className="flex items-center gap-1.5 font-mono text-[11px]">
                <span className={`w-2 h-2 rounded-full shrink-0 ${b.dotColor || 'bg-gray-400'}`} />
                <span className="text-gray-500 font-sans">{b.label}:</span>
                <strong className={b.textColor || 'text-gray-900'}>{formatINR(b.amount)}</strong>
                {b.count !== undefined && (
                  <span className="text-[10px] text-gray-400 font-sans">({b.count})</span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Category Tabs (e.g. All / Business / Personal) */}
        {categoryTabs && categoryTabs.length > 1 && (
          <div className="flex items-center gap-1.5 px-3 pt-2 pb-1.5 border-b border-gray-100 bg-white">
            {categoryTabs.map((ct) => {
              const isActive = activeTab === ct.id;
              return (
                <button
                  key={ct.id}
                  onClick={() => onTabChange && onTabChange(ct.id)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-rose-100 text-rose-800 border border-rose-200 shadow-2xs'
                      : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                  }`}
                >
                  {ct.label} ({ct.count})
                </button>
              );
            })}
          </div>
        )}

        {/* Section Entries */}
        <div className="p-3 max-h-72 overflow-y-auto divide-y divide-gray-100">
          {txns.length === 0 ? (
            <p className="text-xs text-gray-400 py-6 text-center italic">No entries under this head for this filter.</p>
          ) : (
            txns.map((t) => {
              const isPersonal = (
                t.category === 'PERSONAL EXPENSES' ||
                t.transaction_nature === 'PERSONAL EXPENSE' ||
                (t.party_name && /SELF|SHUBH/i.test(t.party_name)) ||
                (t.description && /SELF\s*TR|SELF|OWN\s*ACCOUNT/i.test(t.description))
              );

              return (
                <div
                  key={t.id}
                  onClick={() => onSelect && onSelect(t.id)}
                  className="py-2.5 px-2 hover:bg-blue-50/50 rounded-lg transition-colors flex items-center justify-between text-xs cursor-pointer group"
                >
                  <div className="min-w-0 pr-3">
                    <div className="font-bold text-gray-800 truncate group-hover:text-blue-600 flex items-center gap-1.5 flex-wrap">
                      <span>{t.party_name || 'Direct Receipt / Cash'}</span>
                      {isPersonal && (
                        <span className="bg-purple-100 text-purple-800 text-[10px] font-bold px-1.5 py-0.2 rounded border border-purple-200">
                          👤 Personal Expense / Self Tr
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-gray-500 flex items-center gap-2 mt-0.5">
                      <span className="bg-gray-100 text-gray-600 px-1.5 py-0.2 rounded text-[10px] font-medium">
                        {t.category || t.source_sector || t.expense_sector || t.payment_channel || 'GENERAL'}
                      </span>
                      <span className="truncate max-w-xs">{t.description || t.bank_ref_utr || '-'}</span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className={`font-mono text-xs font-bold block ${
                      t.source_table === 'ONLINE_PAYMENT' || t.direction === 'OUT'
                        ? 'text-rose-700'
                        : t.direction === 'IN'
                        ? 'text-emerald-700'
                        : 'text-amber-700'
                    }`}>
                      {t.source_table === 'ONLINE_PAYMENT' || t.direction === 'OUT' ? '−' : '+'}{formatINR(t.amount)}
                    </span>
                    <span className="text-[10px] text-gray-400 group-hover:text-blue-600 font-medium">
                      Inspect →
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Section Footer */}
      <div className="p-2.5 bg-gray-50 border-t border-gray-200 text-right text-[11px] text-gray-500 font-medium">
        Total {txns.length} records in this view
      </div>
    </div>
  );
};

import React, { useEffect, useState } from 'react';
import {
  TrendingUp, TrendingDown, Landmark, AlertTriangle,
  ChevronRight, Wallet, Check, Edit3, ArrowUpRight, ArrowDownRight, RefreshCw
} from 'lucide-react';
import { apiClient } from '../../api/client';
import { DashboardSummary } from '../../types';
import { formatINR } from '../../utils/formatters';

interface DashboardViewProps {
  selectedMonth: string;
  onNavigate: (tab: string, dateOrFilter?: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ selectedMonth, onNavigate }) => {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [charts, setCharts] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [openingBalanceInput, setOpeningBalanceInput] = useState<string>('');
  const [isEditingOpeningBal, setIsEditingOpeningBal] = useState<boolean>(false);
  const [savingBalance, setSavingBalance] = useState<boolean>(false);
  const [balanceSaveSuccess, setBalanceSaveSuccess] = useState<boolean>(false);

  useEffect(() => {
    loadData();
  }, [selectedMonth]);

  const loadData = async () => {
    setLoading(true);
    try {
      const startDate = selectedMonth !== 'ALL' ? `${selectedMonth}-01` : undefined;
      const endDate = selectedMonth !== 'ALL' ? `${selectedMonth}-31` : undefined;
      const [sumRes, chartRes] = await Promise.all([
        apiClient.getDashboardSummary(startDate, endDate),
        apiClient.getDashboardCharts(startDate, endDate)
      ]);
      setSummary(sumRes);
      setCharts(chartRes);
      if (sumRes.initial_opening_balance !== undefined) {
        setOpeningBalanceInput(String(sumRes.initial_opening_balance));
      }
    } catch (err) {
      console.error("Failed to load dashboard data", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveOpeningBalance = async () => {
    const num = parseFloat(openingBalanceInput);
    if (isNaN(num)) return;
    setSavingBalance(true);
    try {
      await apiClient.setOpeningBalance(num);
      setBalanceSaveSuccess(true);
      setIsEditingOpeningBal(false);
      setTimeout(() => setBalanceSaveSuccess(false), 3000);
      await loadData();
    } catch (err) {
      console.error("Failed to update opening balance", err);
      alert("Failed to update opening balance. Please try again.");
    } finally {
      setSavingBalance(false);
    }
  };

  if (loading || !summary) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500"></div>
      </div>
    );
  }

  const initialOpening = summary.initial_opening_balance || 0;
  const currentClosing = summary.current_closing_balance ?? (initialOpening + (summary.total_bank_credits || 0) - (summary.total_bank_debits || 0));
  const grossTurnover = summary.total_turnover || summary.total_receipts;

  return (
    <div className="space-y-6">
      {/* Top Notice / Period Bar */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-xs">
        <div>
          <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Audit Period</span>
          <p className="text-sm font-semibold text-gray-900">
            {summary.period_start || 'N/A'} &nbsp;➔&nbsp; {summary.period_end || 'N/A'} &nbsp;•&nbsp;
            <span className="text-gray-500 font-normal"> {summary.total_transactions} Total Transactions across 118 Serial Days</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate('daily-audit')}
            className="text-xs bg-gray-50 hover:bg-gray-100 text-gray-800 px-3.5 py-2 rounded-xl border border-gray-300 transition-colors flex items-center gap-1.5 font-semibold cursor-pointer shadow-xs"
          >
            <span>View Day-by-Day Bank Ledger</span>
            <ChevronRight className="w-3.5 h-3.5 text-gray-500" />
          </button>
        </div>
      </div>

      {/* Smart Bank Balance Configuration Banner */}
      <div className="bg-gradient-to-r from-blue-50/80 via-white to-indigo-50/80 border border-blue-200 rounded-xl p-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-600 shadow-xs">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900 tracking-tight flex items-center gap-2">
                <span>Bank Account Starting Balance</span>
                {balanceSaveSuccess && (
                  <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-md flex items-center gap-1">
                    <Check className="w-3 h-3" /> Balance Saved & Ledger Recalculated!
                  </span>
                )}
              </h3>
              <p className="text-xs text-gray-500">
                Enter your bank starting balance here. The system will automatically calculate the expected bank balance for every single day.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {!isEditingOpeningBal ? (
              <div className="flex items-center gap-3 bg-white border border-gray-300 px-4 py-2 rounded-xl shadow-xs">
                <span className="text-xs text-gray-500 font-medium">Initial Opening Balance:</span>
                <span className="text-base font-bold font-mono text-emerald-600">{formatINR(initialOpening)}</span>
                <button
                  onClick={() => setIsEditingOpeningBal(true)}
                  className="text-xs text-blue-600 hover:text-blue-800 ml-1 p-1 hover:bg-blue-50 rounded transition-colors cursor-pointer"
                  title="Edit Opening Balance"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 bg-white border border-blue-400 p-1.5 rounded-xl shadow-md">
                <span className="text-xs font-bold text-gray-500 pl-2">₹</span>
                <input
                  type="number"
                  step="any"
                  value={openingBalanceInput}
                  onChange={(e) => setOpeningBalanceInput(e.target.value)}
                  placeholder="0.00"
                  className="bg-gray-50 border border-gray-300 text-gray-900 font-mono text-sm px-2.5 py-1 rounded-lg w-36 focus:outline-none focus:border-blue-500"
                  autoFocus
                />
                <button
                  onClick={handleSaveOpeningBalance}
                  disabled={savingBalance}
                  className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  {savingBalance ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                  <span>Save</span>
                </button>
                <button
                  onClick={() => {
                    setIsEditingOpeningBal(false);
                    setOpeningBalanceInput(String(initialOpening));
                  }}
                  className="text-xs text-gray-500 hover:text-gray-800 px-2 py-1 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CORE 4 BUSINESS FINANCIAL CARDS (Clean White & Vivid Accents) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Turnover */}
        <div className="bg-white border border-blue-200 rounded-xl p-4 shadow-xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-blue-700 uppercase tracking-wider">Total Bank Deposits & Turnover</span>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-50 border border-blue-200 text-blue-600">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-gray-900 tracking-tight">
            {formatINR(summary.bank_deposits || grossTurnover)}
          </div>
          <p className="text-[11px] text-gray-500 mt-1">Direct Bank Deposits + UPI / QR Collections</p>
        </div>

        {/* Real Business Income */}
        <div className="bg-white border border-emerald-200 rounded-xl p-4 shadow-xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Total Income</span>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-emerald-50 border border-emerald-200 text-emerald-600">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-emerald-600 tracking-tight">
            {formatINR(summary.total_receipts)}
          </div>
          <p className="text-[11px] text-gray-500 mt-1">Real Customer Receipts (Excluding Transfers)</p>
        </div>

        {/* Total Expenses */}
        <div className="bg-white border border-rose-200 rounded-xl p-4 shadow-xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-rose-700 uppercase tracking-wider">Total Expenses</span>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-rose-50 border border-rose-200 text-rose-600">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-rose-600 tracking-tight">
            {formatINR(summary.total_expenses)}
          </div>
          <p className="text-[11px] text-gray-500 mt-1">All Payments & Business Expenses</p>
        </div>

        {/* Expected Bank Closing Balance */}
        <div className="bg-white border border-indigo-200 rounded-xl p-4 shadow-xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider">Bank Balance</span>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-indigo-50 border border-indigo-200 text-indigo-600">
              <Landmark className="w-4 h-4" />
            </div>
          </div>
          <div className={`text-2xl font-black font-mono tracking-tight ${currentClosing >= 0 ? 'text-indigo-700' : 'text-amber-600'}`}>
            {formatINR(currentClosing)}
          </div>
          <p className="text-[11px] text-gray-500 mt-1">
            Opening ({formatINR(initialOpening)}) + Inflow − Outflow
          </p>
        </div>
      </div>

      {/* Secondary Financial & Status Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-xs">
          <span className="text-gray-500 font-medium">Total Bank Deposits (Bank + Cash + QR)</span>
          <div className="font-mono text-emerald-600 font-bold text-sm mt-0.5">{formatINR(summary.bank_deposits || 0)}</div>
          <div className="text-[10px] text-gray-500 mt-0.5 font-medium">
            Cash: {formatINR(summary.cash_deposits || 0, true)} | Bank Dep: {formatINR(summary.bank_transfer_deposits || 0, true)} | QR: {formatINR(summary.upi_collections || 0, true)}
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-xs">
          <span className="text-gray-500 font-medium">Bank Outflows (Payments)</span>
          <div className="font-mono text-rose-600 font-bold text-sm mt-0.5">{formatINR(summary.total_bank_debits || 0)}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-xs">
          <span className="text-gray-500 font-medium">Internal Transfers</span>
          <div className="font-mono text-amber-600 font-bold text-sm mt-0.5">{formatINR(summary.internal_transfers)}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-xs">
          <span className="text-gray-500 font-medium">Items to Check</span>
          <div className="font-mono text-rose-600 font-bold text-sm mt-0.5">{summary.audit_exceptions_count} Alerts</div>
        </div>
      </div>

      {/* Daily Flow Matrix & Sector Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-gray-900 text-sm">Recent Daily Cashflow</h3>
              <p className="text-xs text-gray-500">Daily customer receipts vs actual payments</p>
            </div>
            <button
              onClick={() => onNavigate('daily-audit')}
              className="text-xs text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
            >
              View all 118 days →
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-600 uppercase text-[10px] tracking-wider border-b border-gray-200">
                <tr>
                  <th className="py-2.5 px-3 font-bold">Date</th>
                  <th className="py-2.5 px-3 font-bold">Customer Receipts</th>
                  <th className="py-2.5 px-3 font-bold">Actual Expenses</th>
                  <th className="py-2.5 px-3 font-bold">Net Cash</th>
                  <th className="py-2.5 px-3 font-bold">Internal Transfers</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-mono">
                {charts?.daily_timeline?.slice(-10)?.reverse()?.map((row: any, idx: number) => (
                  <tr
                    key={idx}
                    onClick={() => onNavigate('daily-audit', row.date)}
                    className="hover:bg-blue-50/50 transition-colors cursor-pointer"
                  >
                    <td className="py-2 px-3 text-gray-800 font-sans font-medium">{row.date}</td>
                    <td className="py-2 px-3 text-emerald-600 font-semibold">{formatINR(row.receipts)}</td>
                    <td className="py-2 px-3 text-rose-600 font-semibold">{formatINR(row.expenses)}</td>
                    <td className={`py-2 px-3 font-semibold ${row.net >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {formatINR(row.net)}
                    </td>
                    <td className="py-2 px-3 text-amber-600">{formatINR(row.internal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Sector Inflows & Outflows */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col justify-between shadow-xs">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900 text-sm">Top Business Sectors</h3>
              <button
                onClick={() => onNavigate('sectors')}
                className="text-xs text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
              >
                All Sectors →
              </button>
            </div>

            <div className="space-y-3">
              <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                Top Income Sectors
              </div>
              {charts?.sector_receipts?.slice(0, 5)?.map((s: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-gray-100">
                  <span className="text-gray-700 font-medium">{s.sector}</span>
                  <span className="font-mono text-emerald-600 font-bold">{formatINR(s.amount)}</span>
                </div>
              ))}

              <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider pt-2">
                Top Expense Sectors
              </div>
              {charts?.sector_expenses?.slice(0, 5)?.map((s: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-gray-100">
                  <span className="text-gray-700 font-medium">{s.sector}</span>
                  <span className="font-mono text-rose-600 font-bold">{formatINR(s.amount)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-gray-200">
            <button
              onClick={() => onNavigate('sectors')}
              className="w-full text-center py-2 bg-gray-50 hover:bg-gray-100 text-gray-800 text-xs font-semibold rounded-xl border border-gray-300 transition-colors cursor-pointer"
            >
              Open Full Sector Matrix
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

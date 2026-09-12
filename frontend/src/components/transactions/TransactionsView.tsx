import React, { useEffect, useState } from 'react';
import {
  Search, Filter, Download, ArrowUpDown, ChevronLeft,
  ChevronRight, AlertTriangle, ExternalLink
} from 'lucide-react';
import { apiClient } from '../../api/client';
import { Transaction } from '../../types';
import { formatINR, getDirectionBadge, getStatusBadge } from '../../utils/formatters';
import { TransactionDetailModal } from './TransactionDetailModal';

interface TransactionsViewProps {
  initialTxnId?: string | null;
}

export const TransactionsView: React.FC<TransactionsViewProps> = ({ initialTxnId }) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(50);
  const [search, setSearch] = useState<string>('');
  const [direction, setDirection] = useState<string>('');
  const [nature, setNature] = useState<string>('');
  const [sector, setSector] = useState<string>('');
  const [channel, setChannel] = useState<string>('');
  const [hasFlag, setHasFlag] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedTxnId, setSelectedTxnId] = useState<string | null>(initialTxnId || null);

  useEffect(() => {
    loadTransactions();
  }, [page, pageSize, direction, nature, sector, channel, hasFlag]);

  const loadTransactions = async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = {
        page,
        page_size: pageSize,
        search: search || undefined,
        direction: direction || undefined,
        nature: nature || undefined,
        sector: sector || undefined,
        channel: channel || undefined,
        has_flag: hasFlag === 'true' ? true : hasFlag === 'false' ? false : undefined,
      };
      const res = await apiClient.getTransactions(params);
      setTransactions(res.transactions);
      setTotal(res.total);
    } catch (err) {
      console.error("Failed to load transactions", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadTransactions();
  };

  const handleExport = () => {
    const params: Record<string, any> = {
      search: search || undefined,
      direction: direction || undefined,
    };
    window.location.href = apiClient.exportTransactionsUrl(params);
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-4">
      {/* Top Search & Filter Bar */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3 shadow-xs">
        <form onSubmit={handleSearchSubmit} className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by party, description, UTR, reference, or sheet..."
              className="w-full bg-gray-50 border border-gray-300 rounded-xl pl-9 pr-3 py-2 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 shadow-xs"
            />
          </div>

          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer shadow-xs"
          >
            Search
          </button>

          <button
            type="button"
            onClick={handleExport}
            className="flex items-center gap-1.5 bg-gray-50 hover:bg-gray-100 text-gray-700 px-3.5 py-2 rounded-xl text-xs font-semibold border border-gray-300 transition-colors cursor-pointer shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </form>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
          <span className="text-gray-500 font-medium mr-1 flex items-center gap-1">
            <Filter className="w-3 h-3" /> Filters:
          </span>

          {/* Direction */}
          <select
            value={direction}
            onChange={(e) => { setDirection(e.target.value); setPage(1); }}
            className="bg-gray-50 border border-gray-300 text-gray-700 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-blue-500"
          >
            <option value="">Direction: All</option>
            <option value="IN">Incoming (Receipts)</option>
            <option value="OUT">Outgoing (Payments)</option>
            <option value="INTERNAL">Internal Transfers</option>
          </select>

          {/* Sector */}
          <select
            value={sector}
            onChange={(e) => { setSector(e.target.value); setPage(1); }}
            className="bg-gray-50 border border-gray-300 text-gray-700 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-blue-500"
          >
            <option value="">Sector: All</option>
            <option value="AKBAR">AKBAR</option>
            <option value="YTSK">YTSK</option>
            <option value="COCKPIT">COCKPIT</option>
            <option value="PASSPORT">PASSPORT</option>
            <option value="HOTEL">HOTEL</option>
            <option value="PURI">PURI</option>
            <option value="CARD">CARD</option>
            <option value="VEHICLE / CAB">VEHICLE / CAB</option>
          </select>

          {/* Channel */}
          <select
            value={channel}
            onChange={(e) => { setChannel(e.target.value); setPage(1); }}
            className="bg-gray-50 border border-gray-300 text-gray-700 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-blue-500"
          >
            <option value="">Channel: All</option>
            <option value="BANK">Bank Deposit / Transfer</option>
            <option value="UPI">UPI / QR</option>
          </select>

          {/* Flag */}
          <select
            value={hasFlag}
            onChange={(e) => { setHasFlag(e.target.value); setPage(1); }}
            className="bg-gray-50 border border-gray-300 text-gray-700 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-blue-500"
          >
            <option value="">Alert Status: All</option>
            <option value="true">With Alerts Only</option>
            <option value="false">Clean Entries</option>
          </select>

          {(direction || sector || channel || hasFlag || search) && (
            <button
              onClick={() => {
                setDirection('');
                setSector('');
                setChannel('');
                setHasFlag('');
                setSearch('');
                setPage(1);
              }}
              className="text-xs text-blue-600 hover:text-blue-800 underline ml-2 cursor-pointer font-medium"
            >
              Reset Filters
            </button>
          )}

          <div className="ml-auto text-gray-500 font-mono text-[11px]">
            Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total} records
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 text-gray-700 uppercase text-[10px] tracking-wider border-b border-gray-200">
              <tr>
                <th className="py-3 px-3 font-bold">Date</th>
                <th className="py-3 px-3 font-bold">Party Name</th>
                <th className="py-3 px-3 font-bold">Amount</th>
                <th className="py-3 px-3 font-bold">Direction</th>
                <th className="py-3 px-3 font-bold">Type</th>
                <th className="py-3 px-3 font-bold">Channel</th>
                <th className="py-3 px-3 font-bold">Sector</th>
                <th className="py-3 px-3 font-bold">Reference</th>
                <th className="py-3 px-3 font-bold">Sheet / Row</th>
                <th className="py-3 px-3 font-bold">Alert</th>
                <th className="py-3 px-3 font-bold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-sans">
              {loading ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-gray-500">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
                    Loading transactions...
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-gray-400 italic">
                    No transactions match the selected filters.
                  </td>
                </tr>
              ) : (
                transactions.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => setSelectedTxnId(t.id)}
                    className="hover:bg-blue-50/50 transition-colors cursor-pointer group"
                  >
                    <td className="py-2.5 px-3 font-mono text-gray-700 whitespace-nowrap">{t.txn_date}</td>
                    <td className="py-2.5 px-3 font-semibold text-gray-900 max-w-[180px] truncate group-hover:text-blue-600">
                      {t.party_name || 'N/A'}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-black text-gray-900 whitespace-nowrap">
                      {formatINR(t.amount)}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${getDirectionBadge(t.direction)}`}>
                        {t.direction === 'IN' ? 'RECEIPT' : t.direction === 'OUT' ? 'EXPENSE' : 'TRANSFER'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-gray-700 text-[11px] whitespace-nowrap">
                      {t.transaction_nature}
                    </td>
                    <td className="py-2.5 px-3 text-gray-500 text-[11px]">{t.payment_channel}</td>
                    <td className="py-2.5 px-3">
                      <span className="bg-gray-100 text-blue-700 font-semibold px-2 py-0.5 rounded text-[10px] font-mono border border-gray-200">
                        {t.source_sector || t.expense_sector || 'GENERAL'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-gray-500 text-[11px] max-w-[100px] truncate">
                      {t.bank_ref_utr || t.txn_id_extracted || '-'}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-gray-400 text-[10px] whitespace-nowrap">
                      {t.original_sheet} : R{t.original_row}
                    </td>
                    <td className="py-2.5 px-3">
                      {t.audit_flag ? (
                        <span className="text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded text-[10px] flex items-center gap-1 font-semibold whitespace-nowrap">
                          <AlertTriangle className="w-3 h-3 text-amber-600" />
                          <span>{t.audit_flag}</span>
                        </span>
                      ) : (
                        <span className="text-gray-300 text-[10px]">-</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button className="text-blue-600 group-hover:text-blue-800 text-xs font-semibold inline-flex items-center gap-1">
                        <span>View</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="p-4 border-t border-gray-200 flex items-center justify-between text-xs text-gray-600 bg-gray-50/50">
          <div>
            Page <span className="font-bold text-gray-900">{page}</span> of{' '}
            <span className="font-bold text-gray-900">{totalPages || 1}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 bg-white hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-gray-700 font-semibold border border-gray-300 transition-colors flex items-center gap-1 shadow-xs cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1.5 bg-white hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-gray-700 font-semibold border border-gray-300 transition-colors flex items-center gap-1 shadow-xs cursor-pointer"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Transaction Detail Modal */}
      {selectedTxnId && (
        <TransactionDetailModal
          txnId={selectedTxnId}
          onClose={() => setSelectedTxnId(null)}
          onUpdated={loadTransactions}
        />
      )}
    </div>
  );
};

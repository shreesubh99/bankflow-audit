import React, { useEffect, useState } from 'react';
import {
  Network, Search, Filter, ArrowRight, CheckCircle2,
  PieChart, ExternalLink, RefreshCw
} from 'lucide-react';
import { apiClient } from '../../api/client';
import { FundItem } from '../../types';
import { formatINR, getStatusBadge } from '../../utils/formatters';
import { FundTraceModal } from './FundTraceModal';

export const FundsView: React.FC = () => {
  const [funds, setFunds] = useState<FundItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [sectorFilter, setSectorFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [selectedFundId, setSelectedFundId] = useState<string | null>(null);

  useEffect(() => {
    loadFunds();
  }, [sectorFilter, statusFilter]);

  const loadFunds = async () => {
    setLoading(true);
    try {
      const res = await apiClient.getFunds(sectorFilter || undefined, statusFilter || undefined);
      setFunds(res);
    } catch (err) {
      console.error("Failed to load funds", err);
    } finally {
      setLoading(false);
    }
  };

  // Metrics
  const totalOriginal = funds.reduce((acc, f) => acc + f.original_amount, 0);
  const totalSpent = funds.reduce((acc, f) => acc + f.spent_amount, 0);
  const totalRemaining = funds.reduce((acc, f) => acc + f.remaining_amount, 0);

  return (
    <div className="space-y-6">
      {/* Top Banner & Fund Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-xs">
          <span className="text-xs text-gray-500 font-medium">Total Income Tracked</span>
          <div className="text-xl font-bold font-mono text-gray-900 mt-1">{formatINR(totalOriginal)}</div>
          <p className="text-[11px] text-gray-500 mt-1">{funds.length} Active money sources identified</p>
        </div>
        <div className="bg-white border border-rose-200 rounded-xl p-4 shadow-xs">
          <span className="text-xs text-rose-700 font-medium">Used / Paid Out</span>
          <div className="text-xl font-bold font-mono text-rose-700 mt-1">{formatINR(totalSpent)}</div>
          <p className="text-[11px] text-rose-600 mt-1">Paid towards sector expenses</p>
        </div>
        <div className="bg-white border border-emerald-200 rounded-xl p-4 shadow-xs">
          <span className="text-xs text-emerald-700 font-medium">Remaining Surplus</span>
          <div className="text-xl font-bold font-mono text-emerald-700 mt-1">{formatINR(totalRemaining)}</div>
          <p className="text-[11px] text-emerald-600 mt-1">Balance available from these sources</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5" /> Filters:
          </span>

          <select
            value={sectorFilter}
            onChange={(e) => setSectorFilter(e.target.value)}
            className="bg-white border border-gray-300 text-gray-700 text-xs px-2.5 py-1.5 rounded-lg focus:ring-1 focus:ring-blue-500 outline-hidden"
          >
            <option value="">Source Sector: All</option>
            <option value="AKBAR">AKBAR</option>
            <option value="YTSK">YTSK</option>
            <option value="COCKPIT">COCKPIT</option>
            <option value="PASSPORT">PASSPORT</option>
            <option value="HOTEL">HOTEL</option>
            <option value="PURI">PURI</option>
            <option value="CARD">CARD</option>
            <option value="GENERAL POOL">GENERAL POOL</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-white border border-gray-300 text-gray-700 text-xs px-2.5 py-1.5 rounded-lg focus:ring-1 focus:ring-blue-500 outline-hidden"
          >
            <option value="">Usage Status: All</option>
            <option value="OPEN">OPEN (Not Spent)</option>
            <option value="PARTIALLY USED">PARTIALLY USED</option>
            <option value="FULLY USED">FULLY USED</option>
            <option value="OVERSPENT">OVERSPENT</option>
          </select>

          {(sectorFilter || statusFilter) && (
            <button
              onClick={() => { setSectorFilter(''); setStatusFilter(''); }}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium underline cursor-pointer"
            >
              Reset
            </button>
          )}
        </div>

        <button
          onClick={loadFunds}
          className="text-xs bg-white hover:bg-gray-50 text-gray-700 px-3 py-1.5 rounded-lg border border-gray-300 flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Fund Ledger Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 text-gray-600 uppercase text-[10px] tracking-wider border-b border-gray-200">
              <tr>
                <th className="py-3 px-4 font-semibold">Fund Code</th>
                <th className="py-3 px-4 font-semibold">Source Date</th>
                <th className="py-3 px-4 font-semibold">Source Sector</th>
                <th className="py-3 px-4 font-semibold">Income Received</th>
                <th className="py-3 px-4 font-semibold">Spent Amount</th>
                <th className="py-3 px-4 font-semibold">Remaining Balance</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold text-right">Flow Tree</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-mono">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-400 font-sans">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
                    Loading money flow records...
                  </td>
                </tr>
              ) : funds.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-500 font-sans">
                    No records match the selected filters.
                  </td>
                </tr>
              ) : (
                funds.map((f) => (
                  <tr
                    key={f.id}
                    onClick={() => setSelectedFundId(f.id)}
                    className="hover:bg-gray-50/70 transition-colors cursor-pointer group"
                  >
                    <td className="py-2.5 px-4 font-bold text-blue-600 group-hover:text-blue-700">
                      {f.fund_code}
                    </td>
                    <td className="py-2.5 px-4 text-gray-700 font-sans">{f.source_date}</td>
                    <td className="py-2.5 px-4 font-sans">
                      <span className="bg-gray-100 text-gray-800 px-2 py-0.5 rounded text-[11px] font-semibold">
                        {f.source_sector}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 font-bold text-gray-900">{formatINR(f.original_amount)}</td>
                    <td className="py-2.5 px-4 font-semibold text-rose-600">{formatINR(f.spent_amount)}</td>
                    <td className="py-2.5 px-4 font-semibold text-emerald-600">{formatINR(f.remaining_amount)}</td>
                    <td className="py-2.5 px-4 font-sans">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${getStatusBadge(f.status)}`}>
                        {f.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right font-sans">
                      <button className="text-xs text-blue-600 group-hover:text-blue-700 font-medium inline-flex items-center gap-1">
                        <span>View Tree</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Fund Trace Tree Modal */}
      {selectedFundId && (
        <FundTraceModal
          fundId={selectedFundId}
          onClose={() => setSelectedFundId(null)}
        />
      )}
    </div>
  );
};

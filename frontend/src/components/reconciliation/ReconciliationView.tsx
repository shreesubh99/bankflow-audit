import React, { useEffect, useState } from 'react';
import { Scale, CheckCircle2, AlertTriangle, Filter, RefreshCw } from 'lucide-react';
import { apiClient } from '../../api/client';
import { ReconciliationItem } from '../../types';
import { formatINR, getStatusBadge } from '../../utils/formatters';

export const ReconciliationView: React.FC = () => {
  const [reports, setReports] = useState<ReconciliationItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    loadReports();
  }, [statusFilter]);

  const loadReports = async () => {
    setLoading(true);
    try {
      const data = await apiClient.getReconciliations(statusFilter || undefined);
      setReports(data);
    } catch (err) {
      console.error("Failed to load reconciliations", err);
    } finally {
      setLoading(false);
    }
  };

  const matches = reports.filter((r) => r.status === 'MATCH').length;
  const mismatches = reports.filter((r) => r.status === 'MISMATCH').length;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-xs">
          <span className="text-xs text-gray-500 font-medium">Total Table Sections Checked</span>
          <div className="text-xl font-bold font-mono text-gray-900 mt-1">{reports.length}</div>
          <p className="text-[11px] text-gray-500 mt-1">Bank Deposits, UPI QR, and Online Payment tables</p>
        </div>
        <div className="bg-white border border-emerald-200 rounded-xl p-4 shadow-xs">
          <span className="text-xs text-emerald-700 font-medium flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" /> Perfectly Matched
          </span>
          <div className="text-xl font-bold font-mono text-emerald-700 mt-1">{matches}</div>
          <p className="text-[11px] text-emerald-600 mt-1">Calculated sum exactly equals Excel sheet total</p>
        </div>
        <div className="bg-white border border-rose-200 rounded-xl p-4 shadow-xs">
          <span className="text-xs text-rose-700 font-medium flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" /> Total Mismatches
          </span>
          <div className="text-xl font-bold font-mono text-rose-700 mt-1">{mismatches}</div>
          <p className="text-[11px] text-rose-600 mt-1">Difference between Excel written total and line sum</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5" /> Filter by Match:
          </span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-white border border-gray-300 text-gray-700 text-xs px-2.5 py-1.5 rounded-lg focus:ring-1 focus:ring-blue-500 outline-hidden"
          >
            <option value="">All Checks</option>
            <option value="MISMATCH">Mismatches Only ({mismatches})</option>
            <option value="MATCH">Matches Only ({matches})</option>
          </select>
        </div>

        <button
          onClick={loadReports}
          className="text-xs bg-white hover:bg-gray-50 text-gray-700 px-3 py-1.5 rounded-lg border border-gray-300 flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Reconciliation Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 text-gray-600 uppercase text-[10px] tracking-wider border-b border-gray-200">
              <tr>
                <th className="py-3 px-4 font-semibold">Date</th>
                <th className="py-3 px-4 font-semibold">Excel Sheet</th>
                <th className="py-3 px-4 font-semibold">Table Section</th>
                <th className="py-3 px-4 font-semibold">Excel Sheet Total</th>
                <th className="py-3 px-4 font-semibold">Calculated Sum</th>
                <th className="py-3 px-4 font-semibold">Difference</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-mono">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-400 font-sans">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
                    Checking totals against Excel...
                  </td>
                </tr>
              ) : reports.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-500 font-sans">
                    No records found.
                  </td>
                </tr>
              ) : (
                reports.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50/70 transition-colors">
                    <td className="py-2.5 px-4 font-sans font-medium text-gray-900 whitespace-nowrap">
                      {r.report_date}
                    </td>
                    <td className="py-2.5 px-4 font-sans text-gray-700">{r.sheet_name}</td>
                    <td className="py-2.5 px-4 font-sans text-gray-700">
                      <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded text-[11px] font-semibold">
                        {r.section_name}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 font-semibold text-gray-800">{formatINR(r.reported_total)}</td>
                    <td className="py-2.5 px-4 font-semibold text-gray-800">{formatINR(r.parsed_total)}</td>
                    <td className={`py-2.5 px-4 font-bold ${r.difference === 0 ? 'text-gray-400' : 'text-rose-600'}`}>
                      {formatINR(r.difference)}
                    </td>
                    <td className="py-2.5 px-4 font-sans">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${getStatusBadge(r.status)}`}>
                        {r.status === 'MATCH' ? 'Match' : 'Mismatch'}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 font-sans text-gray-500 text-[11px]">{r.notes || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

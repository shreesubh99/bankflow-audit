import React, { useEffect, useState } from 'react';
import {
  AlertTriangle, CheckCircle, XCircle, Filter, Check,
  ExternalLink, RefreshCw, MessageSquare
} from 'lucide-react';
import { apiClient } from '../../api/client';
import { AuditExceptionItem } from '../../types';
import { getStatusBadge } from '../../utils/formatters';

export const ExceptionsView: React.FC = () => {
  const [exceptions, setExceptions] = useState<AuditExceptionItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('OPEN');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [resolvingId, setResolvingId] = useState<number | null>(null);

  useEffect(() => {
    loadExceptions();
  }, [statusFilter, typeFilter]);

  const loadExceptions = async () => {
    setLoading(true);
    try {
      const data = await apiClient.getExceptions(statusFilter, typeFilter || undefined);
      setExceptions(data);
    } catch (err) {
      console.error("Failed to load audit exceptions", err);
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async (flagId: number, action: string) => {
    setResolvingId(flagId);
    try {
      await apiClient.resolveException(flagId, { action });
      loadExceptions();
    } catch (err) {
      console.error("Failed to resolve flag", err);
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-gray-900 tracking-tight">Review Alerts & Warnings</h2>
          <p className="text-xs text-gray-500">
            Automatic check for duplicate entries, self transfers, source total mismatches, and unassigned categories
          </p>
        </div>

        <button
          onClick={loadExceptions}
          className="text-xs bg-white hover:bg-gray-50 text-gray-700 px-3 py-1.5 rounded-lg border border-gray-300 flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-wrap items-center gap-3 shadow-xs">
        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5" /> Filter Alerts:
        </span>

        {/* Status */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-white border border-gray-300 text-gray-700 text-xs px-2.5 py-1.5 rounded-lg focus:ring-1 focus:ring-blue-500 outline-hidden"
        >
          <option value="OPEN">Pending Review</option>
          <option value="RESOLVED">Resolved</option>
          <option value="IGNORED">Ignored</option>
          <option value="ALL">All Alerts</option>
        </select>

        {/* Flag Type */}
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="bg-white border border-gray-300 text-gray-700 text-xs px-2.5 py-1.5 rounded-lg focus:ring-1 focus:ring-blue-500 outline-hidden"
        >
          <option value="">All Alert Types</option>
          <option value="Duplicate Transaction">Duplicate Transaction</option>
          <option value="Source Total Mismatch">Excel Total Mismatch</option>
          <option value="Possible Self Transfer">Possible Self Transfer</option>
          <option value="Possible UPI Settlement">Possible UPI Settlement</option>
          <option value="Unclassified Transaction">Uncategorized Entry</option>
          <option value="Missing Amount">Missing Amount</option>
        </select>

        <div className="ml-auto text-xs text-gray-500 font-mono">
          {exceptions.length} alerts in queue
        </div>
      </div>

      {/* Exceptions Cards List */}
      <div className="space-y-3">
        {loading ? (
          <div className="py-16 text-center text-gray-400">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
            Checking review alerts...
          </div>
        ) : exceptions.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-12 text-center text-gray-500 shadow-xs">
            <CheckCircle className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
            <p className="font-semibold text-gray-900 text-sm">All Clear!</p>
            <p className="text-xs text-gray-500 mt-1">No pending review alerts match your current filter.</p>
          </div>
        ) : (
          exceptions.map((ex) => (
            <div
              key={ex.id}
              className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-gray-300 transition-colors shadow-xs"
            >
              <div className="space-y-1 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-bold px-2 py-0.5 rounded">
                    {ex.flag_type}
                  </span>
                  {ex.sheet_name && (
                    <span className="text-gray-500 font-mono text-[11px]">
                      Sheet: <strong className="text-gray-800">{ex.sheet_name}</strong>
                    </span>
                  )}
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${getStatusBadge(ex.status)}`}>
                    {ex.status === 'OPEN' ? 'Pending' : ex.status}
                  </span>
                </div>
                <p className="text-xs text-gray-800 font-medium pt-1">{ex.description}</p>
                {ex.txn_details && (
                  <p className="text-[11px] text-gray-500 font-mono">
                    Party: {ex.txn_details.party_name || 'N/A'} &bull; Amount: ₹{ex.txn_details.amount} &bull; Date: {ex.txn_details.txn_date}
                  </p>
                )}
                {ex.resolution_notes && (
                  <p className="text-[11px] text-emerald-700 italic pt-1">
                    Action taken: {ex.resolution_notes}
                  </p>
                )}
              </div>

              {/* Action Buttons for OPEN items */}
              {ex.status === 'OPEN' && (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleResolve(ex.id, 'MARK_VALID')}
                    disabled={resolvingId === ex.id}
                    className="bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs px-3 py-1.5 rounded-lg transition-colors cursor-pointer font-medium"
                  >
                    Keep as Valid
                  </button>
                  <button
                    onClick={() => handleResolve(ex.id, 'IGNORE')}
                    disabled={resolvingId === ex.id}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 text-xs px-3 py-1.5 rounded-lg transition-colors cursor-pointer font-medium"
                  >
                    Ignore
                  </button>
                  <button
                    onClick={() => handleResolve(ex.id, 'OVERRIDE')}
                    disabled={resolvingId === ex.id}
                    className="bg-blue-50 hover:bg-blue-100 border border-blue-300 text-blue-800 text-xs px-3 py-1.5 rounded-lg transition-colors cursor-pointer font-medium"
                  >
                    Override
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

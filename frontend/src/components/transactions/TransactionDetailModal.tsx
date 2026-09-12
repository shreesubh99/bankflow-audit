import React, { useEffect, useState } from 'react';
import { X, ShieldAlert, History, Edit3, Check, Link2, FileSpreadsheet } from 'lucide-react';
import { apiClient } from '../../api/client';
import { Transaction } from '../../types';
import { formatINR, formatDate, getDirectionBadge, getStatusBadge } from '../../utils/formatters';

interface TransactionDetailModalProps {
  txnId: string | null;
  onClose: () => void;
  onUpdated?: () => void;
}

export const TransactionDetailModal: React.FC<TransactionDetailModalProps> = ({ txnId, onClose, onUpdated }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editSector, setEditSector] = useState<string>('');
  const [editCategory, setEditCategory] = useState<string>('');
  const [editNature, setEditNature] = useState<string>('');
  const [editReason, setEditReason] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);

  useEffect(() => {
    if (txnId) {
      loadDetail(txnId);
    }
  }, [txnId]);

  const loadDetail = async (id: string) => {
    setLoading(true);
    try {
      const res = await apiClient.getTransactionDetail(id);
      setData(res);
      const t = res.transaction;
      setEditSector(t.source_sector || t.expense_sector || '');
      setEditCategory(t.category || '');
      setEditNature(t.transaction_nature || '');
    } catch (err) {
      console.error("Failed to load transaction detail", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!txnId) return;
    setSaving(true);
    try {
      await apiClient.updateTransaction(txnId, {
        source_sector: editSector || undefined,
        expense_sector: editSector || undefined,
        category: editCategory || undefined,
        transaction_nature: editNature || undefined,
        reason: editReason || 'Manual update'
      });
      setIsEditing(false);
      loadDetail(txnId);
      if (onUpdated) onUpdated();
    } catch (err) {
      console.error("Failed to update transaction", err);
    } finally {
      setSaving(false);
    }
  };

  if (!txnId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50/70">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 font-mono text-xs font-bold">
              TXN
            </span>
            <div>
              <h3 className="font-bold text-gray-900 text-sm">Transaction Entry Details</h3>
              <p className="text-xs font-mono text-gray-500">{txnId}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {loading || !data ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <>
              {/* Top Highlights Banner */}
              {(() => {
                const t: Transaction = data.transaction;
                return (
                  <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div>
                      <span className="text-[10px] text-gray-500 uppercase font-semibold">Amount</span>
                      <div className="text-lg font-bold font-mono text-gray-900 mt-0.5">{formatINR(t.amount)}</div>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-500 uppercase font-semibold">Money Flow</span>
                      <div className="mt-1">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${getDirectionBadge(t.direction)}`}>
                          {t.direction === 'IN' ? 'Money In' : t.direction === 'OUT' ? 'Money Out' : 'Internal Transfer'}
                        </span>
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-500 uppercase font-semibold">Date</span>
                      <div className="text-xs font-medium text-gray-800 mt-1">{t.txn_date}</div>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-500 uppercase font-semibold">Status</span>
                      <div className="text-xs font-semibold text-blue-700 mt-1">{t.status} ({t.confidence_score}%)</div>
                    </div>
                  </div>
                );
              })()}

              {/* Transaction Fields Grid */}
              <div className="bg-gray-50/50 border border-gray-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3 border-b border-gray-200 pb-2">
                  <h4 className="font-semibold text-gray-800 text-xs">
                    Entry Information
                  </h4>
                  {!isEditing ? (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit Category</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setIsEditing(false)}
                        className="text-xs text-gray-500 hover:text-gray-700"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveEdit}
                        disabled={saving}
                        className="flex items-center gap-1 text-xs bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1 rounded-md font-medium shadow-xs"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>{saving ? 'Saving...' : 'Save Changes'}</span>
                      </button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-y-3 gap-x-4">
                  <div>
                    <span className="text-gray-500">Party / Person Name:</span>
                    <p className="font-medium text-gray-900">{data.transaction.party_name || 'Not Available'}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Nature of Transaction:</span>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editNature}
                        onChange={(e) => setEditNature(e.target.value)}
                        className="w-full mt-1 bg-white border border-gray-300 rounded px-2 py-1 text-gray-900 text-xs focus:ring-1 focus:ring-blue-500 outline-hidden"
                      />
                    ) : (
                      <p className="font-medium text-gray-900">{data.transaction.transaction_nature}</p>
                    )}
                  </div>
                  <div>
                    <span className="text-gray-500">Payment Mode / Type:</span>
                    <p className="font-medium text-gray-900">{data.transaction.payment_channel} / {data.transaction.transaction_type}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Business Sector:</span>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editSector}
                        onChange={(e) => setEditSector(e.target.value)}
                        className="w-full mt-1 bg-white border border-gray-300 rounded px-2 py-1 text-gray-900 text-xs focus:ring-1 focus:ring-blue-500 outline-hidden"
                      />
                    ) : (
                      <p className="font-mono text-blue-700 font-semibold">{data.transaction.source_sector || data.transaction.expense_sector || 'UNASSIGNED'}</p>
                    )}
                  </div>
                  <div>
                    <span className="text-gray-500">Category:</span>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editCategory}
                        onChange={(e) => setEditCategory(e.target.value)}
                        className="w-full mt-1 bg-white border border-gray-300 rounded px-2 py-1 text-gray-900 text-xs focus:ring-1 focus:ring-blue-500 outline-hidden"
                      />
                    ) : (
                      <p className="font-medium text-gray-900">{data.transaction.category || 'Not Available'}</p>
                    )}
                  </div>
                  <div>
                    <span className="text-gray-500">Bank Reference / UTR:</span>
                    <p className="font-mono text-gray-700">{data.transaction.bank_ref_utr || data.transaction.txn_id_extracted || 'None'}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Narration / Note:</span>
                    <p className="text-gray-700">{data.transaction.description || 'None'}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Value Date:</span>
                    <p className="font-mono text-gray-700">{data.transaction.value_date || 'None'}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Review Flag:</span>
                    <p className={data.transaction.audit_flag ? 'text-amber-600 font-semibold' : 'text-gray-500'}>
                      {data.transaction.audit_flag || 'Clean'}
                    </p>
                  </div>
                </div>

                {isEditing && (
                  <div className="mt-4 pt-3 border-t border-gray-200">
                    <label className="text-gray-600 block mb-1">Reason for Change:</label>
                    <input
                      type="text"
                      value={editReason}
                      onChange={(e) => setEditReason(e.target.value)}
                      placeholder="e.g. Corrected party sector after reviewing bill"
                      className="w-full bg-white border border-gray-300 rounded px-3 py-1.5 text-gray-900 text-xs focus:ring-1 focus:ring-blue-500 outline-hidden"
                    />
                  </div>
                )}
              </div>

              {/* Original Excel Location */}
              <div className="bg-gray-50/50 border border-gray-200 rounded-xl p-4">
                <h4 className="font-semibold text-gray-800 text-xs mb-3 flex items-center gap-2">
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Original Excel Sheet Origin</span>
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3 text-xs">
                  <div>
                    <span className="text-gray-500">Excel Sheet:</span>
                    <p className="font-medium text-gray-900">{data.transaction.original_sheet}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Excel Row Number:</span>
                    <p className="font-mono text-gray-900 font-bold">Row {data.transaction.original_row}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Section Table:</span>
                    <p className="font-medium text-gray-900">{data.transaction.source_table}</p>
                  </div>
                </div>
                <div>
                  <span className="text-gray-500 block mb-1">Raw Excel Row Values:</span>
                  <pre className="bg-white p-2.5 rounded-lg border border-gray-200 font-mono text-[11px] text-gray-700 overflow-x-auto">
                    {data.transaction.original_raw_data || '[]'}
                  </pre>
                </div>
              </div>

              {/* Classification Change History */}
              {data.history && data.history.length > 0 && (
                <div className="bg-gray-50/50 border border-gray-200 rounded-xl p-4">
                  <h4 className="font-semibold text-gray-800 text-xs mb-3 flex items-center gap-2">
                    <History className="w-3.5 h-3.5 text-blue-600" />
                    <span>Change History</span>
                  </h4>
                  <div className="space-y-2">
                    {data.history.map((h: any) => (
                      <div key={h.id} className="p-2.5 bg-white rounded-lg border border-gray-200 text-[11px]">
                        <div className="flex justify-between text-gray-500 mb-1">
                          <span>Updated by <strong className="text-gray-800">{h.changed_by}</strong></span>
                          <span>{h.created_at}</span>
                        </div>
                        <p className="text-gray-700">
                          <strong>Nature:</strong> {h.old_nature} ➔ <span className="text-blue-700">{h.new_nature}</span> &bull;{' '}
                          <strong>Sector:</strong> {h.old_sector || 'None'} ➔ <span className="text-blue-700">{h.new_sector || 'None'}</span>
                        </p>
                        {h.reason && <p className="text-gray-500 italic mt-0.5">Reason: {h.reason}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-gray-200 bg-gray-50/70 flex justify-end">
          <button
            onClick={onClose}
            className="text-xs bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium px-4 py-2 rounded-lg transition-colors cursor-pointer shadow-xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

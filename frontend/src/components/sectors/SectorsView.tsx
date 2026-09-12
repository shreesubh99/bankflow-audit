import React, { useEffect, useState } from 'react';
import { Grid3x3, Plus, ArrowRight, Layers, Check, Sparkles } from 'lucide-react';
import { apiClient } from '../../api/client';
import { SectorItem, SectorFlowMatrix } from '../../types';
import { formatINR } from '../../utils/formatters';

export const SectorsView: React.FC = () => {
  const [sectors, setSectors] = useState<SectorItem[]>([]);
  const [matrix, setMatrix] = useState<SectorFlowMatrix | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [newCode, setNewCode] = useState<string>('');
  const [newName, setNewName] = useState<string>('');
  const [newPurpose, setNewPurpose] = useState<string>('');
  const [newSubsectors, setNewSubsectors] = useState<string>('');
  const [creating, setCreating] = useState<boolean>(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [secRes, matRes] = await Promise.all([
        apiClient.getSectors(),
        apiClient.getSectorFlowMatrix()
      ]);
      setSectors(secRes);
      setMatrix(matRes);
    } catch (err) {
      console.error("Failed to load sector data", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSector = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode || !newName) return;
    setCreating(true);
    try {
      const subs = newSubsectors.split(',').map((s) => s.trim()).filter(Boolean);
      await apiClient.createSector({
        code: newCode,
        name: newName,
        purpose: newPurpose || undefined,
        subsectors: subs
      });
      setShowAddModal(false);
      setNewCode('');
      setNewName('');
      setNewPurpose('');
      setNewSubsectors('');
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to create sector");
    } finally {
      setCreating(false);
    }
  };

  if (loading || !matrix) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Find max value in matrix for heatmap scaling
  let maxCell = 1;
  Object.values(matrix.matrix).forEach((row) => {
    Object.values(row).forEach((val) => {
      if (val > maxCell) maxCell = val;
    });
  });

  return (
    <div className="space-y-8">
      {/* Dynamic Sector Flow Matrix Section */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Grid3x3 className="w-5 h-5 text-blue-600" />
              <h2 className="text-base font-bold text-gray-900 tracking-tight">Income to Expense Flow Matrix</h2>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Matrix comparing where money came in (Source Sectors) vs where it was spent (Expense Sectors)
            </p>
          </div>
          <div className="text-xs text-gray-600 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200">
            Source Sectors (Rows) &bull; Expense Sectors (Columns)
          </div>
        </div>

        {/* Matrix Grid Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-right border-collapse">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="py-2.5 px-3 text-left font-semibold text-gray-600 uppercase text-[10px] bg-gray-50 sticky left-0 z-10">
                  Income \ Expense
                </th>
                {matrix.expense_sectors.map((expSec) => (
                  <th key={expSec} className="py-2.5 px-3 font-semibold text-gray-700 uppercase text-[10px] whitespace-nowrap bg-gray-50/70">
                    {expSec}
                  </th>
                ))}
                <th className="py-2.5 px-3 font-bold text-blue-700 uppercase text-[10px] bg-blue-50">
                  Total Disbursed
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-mono">
              {matrix.source_sectors.map((srcSec) => {
                const rowTotal = matrix.totals_by_source[srcSec] || 0;
                return (
                  <tr key={srcSec} className="hover:bg-gray-50/60 transition-colors">
                    <td className="py-2.5 px-3 text-left font-sans font-semibold text-gray-800 bg-white sticky left-0 z-10 whitespace-nowrap border-r border-gray-200">
                      {srcSec}
                    </td>
                    {matrix.expense_sectors.map((expSec) => {
                      const val = matrix.matrix[srcSec]?.[expSec] || 0;
                      const intensity = val > 0 ? Math.min(Math.max(val / maxCell, 0.1), 0.7) : 0;
                      const bgStyle = val > 0 ? { backgroundColor: `rgba(2, 132, 199, ${intensity})` } : {};
                      return (
                        <td
                          key={expSec}
                          style={bgStyle}
                          className={`py-2 px-3 whitespace-nowrap ${val > 0 ? 'text-gray-900 font-semibold' : 'text-gray-400'}`}
                        >
                          {val > 0 ? formatINR(val) : '—'}
                        </td>
                      );
                    })}
                    <td className="py-2.5 px-3 font-bold text-blue-700 bg-blue-50/40 border-l border-gray-200 whitespace-nowrap">
                      {formatINR(rowTotal)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-300 bg-gray-50 font-mono font-bold text-xs">
                <td className="py-2.5 px-3 text-left font-sans text-blue-800 uppercase text-[10px] sticky left-0 z-10">
                  Total Spent
                </td>
                {matrix.expense_sectors.map((expSec) => (
                  <td key={expSec} className="py-2.5 px-3 text-rose-700 whitespace-nowrap">
                    {formatINR(matrix.totals_by_expense[expSec] || 0)}
                  </td>
                ))}
                <td className="py-2.5 px-3 text-emerald-700 whitespace-nowrap">
                  {formatINR(Object.values(matrix.totals_by_source).reduce((a, b) => a + b, 0))}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Dynamic Sector Management Section */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4 shadow-xs">
        <div className="flex items-center justify-between border-b border-gray-200 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-purple-600" />
              <h3 className="text-base font-bold text-gray-900 tracking-tight">Active Business Sectors</h3>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Custom business sectors and heads used for categorizing money
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs px-3.5 py-2 rounded-lg transition-colors cursor-pointer shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add New Sector</span>
          </button>
        </div>

        {/* Sectors Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sectors.map((s) => (
            <div key={s.id} className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-blue-700 text-sm">{s.code}</span>
                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded">
                  ACTIVE
                </span>
              </div>
              <div className="text-xs font-semibold text-gray-900">{s.name}</div>
              {s.purpose && <p className="text-[11px] text-gray-500">{s.purpose}</p>}
              {s.subsectors && s.subsectors.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {s.subsectors.map((sub, idx) => (
                    <span key={idx} className="bg-white border border-gray-200 text-gray-600 text-[10px] px-1.5 py-0.5 rounded">
                      {sub}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Create Sector Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-xs p-4">
          <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <h3 className="font-bold text-gray-900 text-sm">Add New Business Sector</h3>
            <form onSubmit={handleCreateSector} className="space-y-3 text-xs">
              <div>
                <label className="text-gray-700 block mb-1 font-medium">Sector Code (e.g. PASSPORT, HOTEL):</label>
                <input
                  type="text"
                  required
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  placeholder="PASSPORT"
                  className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:ring-1 focus:ring-blue-500 outline-hidden"
                />
              </div>
              <div>
                <label className="text-gray-700 block mb-1 font-medium">Sector Name:</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Passport & Visa Processing"
                  className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:ring-1 focus:ring-blue-500 outline-hidden"
                />
              </div>
              <div>
                <label className="text-gray-700 block mb-1 font-medium">Purpose / Description:</label>
                <input
                  type="text"
                  value={newPurpose}
                  onChange={(e) => setNewPurpose(e.target.value)}
                  placeholder="Passport fees, agent processing, and appointment fees"
                  className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:ring-1 focus:ring-blue-500 outline-hidden"
                />
              </div>
              <div>
                <label className="text-gray-700 block mb-1 font-medium">Subcategories (comma-separated):</label>
                <input
                  type="text"
                  value={newSubsectors}
                  onChange={(e) => setNewSubsectors(e.target.value)}
                  placeholder="Passport Fee, Documentation, Courier"
                  className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:ring-1 focus:ring-blue-500 outline-hidden"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-xs transition-colors cursor-pointer"
                >
                  {creating ? 'Saving...' : 'Save Sector'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useEffect, useState } from 'react';
import { SlidersHorizontal, Plus, Trash2, Check, Sparkles } from 'lucide-react';
import { apiClient } from '../../api/client';
import { ClassificationRuleItem } from '../../types';

export const RulesView: React.FC = () => {
  const [rules, setRules] = useState<ClassificationRuleItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [name, setName] = useState<string>('');
  const [pattern, setPattern] = useState<string>('');
  const [matchField, setMatchField] = useState<string>('all');
  const [targetNature, setTargetNature] = useState<string>('');
  const [targetSector, setTargetSector] = useState<string>('');
  const [targetCategory, setTargetCategory] = useState<string>('');
  const [confidence, setConfidence] = useState<number>(95);
  const [priority, setPriority] = useState<number>(10);
  const [saving, setSaving] = useState<boolean>(false);

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    setLoading(true);
    try {
      const data = await apiClient.getRules();
      setRules(data);
    } catch (err) {
      console.error("Failed to load rules", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !pattern) return;
    setSaving(true);
    try {
      await apiClient.createRule({
        name,
        pattern,
        match_field: matchField,
        target_nature: targetNature || undefined,
        target_sector: targetSector || undefined,
        target_category: targetCategory || undefined,
        confidence_score: confidence,
        priority
      });
      setShowAddModal(false);
      setName('');
      setPattern('');
      setTargetNature('');
      setTargetSector('');
      setTargetCategory('');
      loadRules();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to create rule");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRule = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this rule?")) return;
    try {
      await apiClient.deleteRule(id);
      loadRules();
    } catch (err) {
      console.error("Failed to delete rule", err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-gray-900 tracking-tight">Automatic Categorization Rules</h2>
          <p className="text-xs text-gray-500">
            Rules that automatically recognize keywords and assign sectors & categories to transactions
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs px-3.5 py-2 rounded-lg transition-colors cursor-pointer shadow-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add New Rule</span>
        </button>
      </div>

      {/* Rules Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 text-gray-600 uppercase text-[10px] tracking-wider border-b border-gray-200">
              <tr>
                <th className="py-3 px-4 font-semibold">Priority</th>
                <th className="py-3 px-4 font-semibold">Rule Name</th>
                <th className="py-3 px-4 font-semibold">Keyword / Text Pattern</th>
                <th className="py-3 px-4 font-semibold">Nature</th>
                <th className="py-3 px-4 font-semibold">Target Sector</th>
                <th className="py-3 px-4 font-semibold">Category</th>
                <th className="py-3 px-4 font-semibold">Accuracy</th>
                <th className="py-3 px-4 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-mono">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-400 font-sans">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
                    Loading rules...
                  </td>
                </tr>
              ) : rules.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-500 font-sans">
                    No rules found.
                  </td>
                </tr>
              ) : (
                rules.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50/70 transition-colors">
                    <td className="py-2.5 px-4 text-gray-400">#{r.priority}</td>
                    <td className="py-2.5 px-4 font-sans font-semibold text-gray-900">{r.name}</td>
                    <td className="py-2.5 px-4 text-blue-700 font-mono text-[11px]">{r.pattern}</td>
                    <td className="py-2.5 px-4 font-sans text-gray-700">{r.target_nature || '—'}</td>
                    <td className="py-2.5 px-4 font-sans">
                      {r.target_sector ? (
                        <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded text-[10px] font-mono">
                          {r.target_sector}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="py-2.5 px-4 font-sans text-gray-700">{r.target_category || '—'}</td>
                    <td className="py-2.5 px-4 font-sans">
                      <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded text-[10px] font-bold">
                        {r.confidence_score}%
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right font-sans">
                      <button
                        onClick={() => handleDeleteRule(r.id)}
                        className="text-rose-600 hover:text-rose-700 p-1 rounded hover:bg-rose-50 transition-colors cursor-pointer"
                        title="Delete Rule"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Rule Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-xs p-4">
          <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <h3 className="font-bold text-gray-900 text-sm">Add Categorization Rule</h3>
            <form onSubmit={handleCreateRule} className="space-y-3 text-xs">
              <div>
                <label className="text-gray-700 block mb-1 font-medium">Rule Name:</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Railway IRCTC Agent"
                  className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:ring-1 focus:ring-blue-500 outline-hidden"
                />
              </div>
              <div>
                <label className="text-gray-700 block mb-1 font-medium">Keywords or Regex Pattern:</label>
                <input
                  type="text"
                  required
                  value={pattern}
                  onChange={(e) => setPattern(e.target.value)}
                  placeholder="e.g. IRCTC|RAILWAY"
                  className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-gray-900 font-mono focus:ring-1 focus:ring-blue-500 outline-hidden"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-700 block mb-1 font-medium">Target Sector:</label>
                  <input
                    type="text"
                    value={targetSector}
                    onChange={(e) => setTargetSector(e.target.value)}
                    placeholder="RAILWAY"
                    className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:ring-1 focus:ring-blue-500 outline-hidden"
                  />
                </div>
                <div>
                  <label className="text-gray-700 block mb-1 font-medium">Target Category:</label>
                  <input
                    type="text"
                    value={targetCategory}
                    onChange={(e) => setTargetCategory(e.target.value)}
                    placeholder="TRAIN TICKET"
                    className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:ring-1 focus:ring-blue-500 outline-hidden"
                  />
                </div>
              </div>
              <div>
                <label className="text-gray-700 block mb-1 font-medium">Confidence Score (%):</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={confidence}
                  onChange={(e) => setConfidence(Number(e.target.value))}
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
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-xs transition-colors cursor-pointer"
                >
                  {saving ? 'Saving...' : 'Save Rule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useEffect, useState } from 'react';
import { X, Network, CornerDownRight, Landmark, ArrowRight, CheckCircle2 } from 'lucide-react';
import { apiClient } from '../../api/client';
import { FundTreeNode } from '../../types';
import { formatINR } from '../../utils/formatters';

interface FundTraceModalProps {
  fundId: string | null;
  onClose: () => void;
}

export const FundTraceModal: React.FC<FundTraceModalProps> = ({ fundId, onClose }) => {
  const [tree, setTree] = useState<FundTreeNode | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedNode, setSelectedNode] = useState<FundTreeNode | null>(null);

  useEffect(() => {
    if (fundId) {
      loadTrace(fundId);
    }
  }, [fundId]);

  const loadTrace = async (id: string) => {
    setLoading(true);
    try {
      const res = await apiClient.getFundTrace(id);
      setTree(res);
      setSelectedNode(res);
    } catch (err) {
      console.error("Failed to load fund trace tree", err);
    } finally {
      setLoading(false);
    }
  };

  if (!fundId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50/70">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
              <Network className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-sm">Money Source to Expense Flow Tree</h3>
              <p className="text-xs font-mono text-gray-500">Fund Code: {fundId}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {loading || !tree ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Visual Hierarchical Flow Tree */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 font-mono">
                {/* Level 1: Source Sector */}
                <div
                  onClick={() => setSelectedNode(tree)}
                  className={`p-3 rounded-lg border transition-all cursor-pointer inline-flex items-center gap-3 ${
                    selectedNode?.id === tree.id ? 'bg-blue-50 border-blue-500 text-blue-900' : 'bg-white border-gray-200 text-gray-800 hover:border-gray-300'
                  }`}
                >
                  <Landmark className="w-4 h-4 text-blue-600" />
                  <div>
                    <span className="font-sans font-bold text-sm text-gray-900">{tree.name}</span>
                    <div className="text-[11px] text-emerald-700 font-semibold">{formatINR(tree.amount)} received</div>
                  </div>
                </div>

                {/* Level 2: Fund Node */}
                {tree.children.map((fundNode) => (
                  <div key={fundNode.id} className="mt-4 pl-6 border-l-2 border-gray-200 space-y-4">
                    <div className="flex items-center gap-2">
                      <CornerDownRight className="w-4 h-4 text-gray-400 shrink-0" />
                      <div
                        onClick={() => setSelectedNode(fundNode)}
                        className={`p-3 rounded-lg border transition-all cursor-pointer inline-flex items-center gap-3 ${
                          selectedNode?.id === fundNode.id ? 'bg-blue-50 border-blue-500 text-blue-900' : 'bg-white border-gray-200 text-gray-800 hover:border-gray-300'
                        }`}
                      >
                        <Network className="w-4 h-4 text-purple-600" />
                        <div>
                          <div className="font-sans font-bold text-xs text-gray-900">{fundNode.name}</div>
                          <div className="text-[11px] text-gray-500">
                            Created on {fundNode.date} • Status: <span className="text-amber-700 font-semibold">{fundNode.details?.status}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Level 3: Expenses and Remaining */}
                    <div className="pl-8 border-l-2 border-gray-200 space-y-2">
                      {fundNode.children.map((child) => {
                        const isRemaining = child.type === 'remaining';
                        return (
                          <div key={child.id} className="flex items-center gap-2">
                            <CornerDownRight className="w-4 h-4 text-gray-400 shrink-0" />
                            <div
                              onClick={() => setSelectedNode(child)}
                              className={`p-2.5 rounded-lg border transition-all cursor-pointer flex-1 max-w-lg flex items-center justify-between ${
                                selectedNode?.id === child.id
                                  ? 'bg-blue-50 border-blue-500 text-blue-900'
                                  : isRemaining
                                  ? 'bg-emerald-50/60 border-emerald-200 hover:border-emerald-300'
                                  : 'bg-white border-gray-200 hover:border-gray-300'
                              }`}
                            >
                              <div>
                                <div className={`font-sans text-xs font-semibold ${isRemaining ? 'text-emerald-800' : 'text-gray-800'}`}>
                                  {child.name}
                                </div>
                                <div className="text-[11px] text-gray-500">
                                  {child.date ? `Date: ${child.date}` : ''}
                                  {child.details?.sector ? ` • Sector: ${child.details.sector}` : ''}
                                </div>
                              </div>
                              <span className={`font-bold font-mono text-xs ${isRemaining ? 'text-emerald-700' : 'text-rose-700'}`}>
                                {formatINR(child.amount)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Node Inspector Panel */}
              {selectedNode && (
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl">
                  <h4 className="font-semibold text-gray-800 text-xs mb-2 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-600" />
                    <span>Selected Item Information</span>
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <span className="text-gray-500">Name:</span>
                      <p className="font-medium text-gray-900">{selectedNode.name}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Item Type:</span>
                      <p className="font-mono text-blue-700 uppercase">{selectedNode.type}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Amount:</span>
                      <p className="font-mono font-bold text-gray-900">{formatINR(selectedNode.amount)}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Date:</span>
                      <p className="font-mono text-gray-700">{selectedNode.date || 'N/A'}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-gray-200 bg-gray-50/70 flex justify-end">
          <button
            onClick={onClose}
            className="text-xs bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium px-4 py-2 rounded-lg transition-colors cursor-pointer shadow-xs"
          >
            Close Flow
          </button>
        </div>
      </div>
    </div>
  );
};

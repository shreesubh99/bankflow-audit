import React, { useEffect, useState } from 'react';
import { FileSpreadsheet, UploadCloud, RefreshCw, CheckCircle2, ShieldAlert, Trash2 } from 'lucide-react';
import { apiClient } from '../../api/client';
import { ImportItem } from '../../types';
import { getStatusBadge } from '../../utils/formatters';

interface ImportsViewProps {
  onOpenUpload: () => void;
}

export const ImportsView: React.FC<ImportsViewProps> = ({ onOpenUpload }) => {
  const [imports, setImports] = useState<ImportItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    loadImports();
  }, []);

  const loadImports = async () => {
    setLoading(true);
    try {
      const data = await apiClient.getImports();
      setImports(data);
    } catch (err) {
      console.error("Failed to load imports", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm(`Are you sure you want to delete Import #${id}?`)) return;
    try {
      await apiClient.deleteImport(id);
      loadImports();
    } catch (err) {
      console.error("Failed to delete import", err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-gray-900 tracking-tight">Excel Upload History</h2>
          <p className="text-xs text-gray-500">
            List of uploaded Excel workbooks and processing records
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadImports}
            className="text-xs bg-white hover:bg-gray-50 text-gray-700 px-3 py-1.5 rounded-lg border border-gray-300 flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
          <button
            onClick={onOpenUpload}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer shadow-xs"
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>Upload New Excel</span>
          </button>
        </div>
      </div>

      {/* Imports Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 text-gray-600 uppercase text-[10px] tracking-wider border-b border-gray-200">
              <tr>
                <th className="py-3 px-4 font-semibold">ID</th>
                <th className="py-3 px-4 font-semibold">File Name</th>
                <th className="py-3 px-4 font-semibold">Uploaded On</th>
                <th className="py-3 px-4 font-semibold">Date Range</th>
                <th className="py-3 px-4 font-semibold">Total Sheets</th>
                <th className="py-3 px-4 font-semibold">Date Sheets</th>
                <th className="py-3 px-4 font-semibold">Transactions</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-mono">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-gray-400 font-sans">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
                    Loading upload history...
                  </td>
                </tr>
              ) : imports.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-gray-500 font-sans">
                    No workbooks have been uploaded yet. Click "Upload New Excel" to start.
                  </td>
                </tr>
              ) : (
                imports.map((imp) => (
                  <tr key={imp.id} className="hover:bg-gray-50/70 transition-colors">
                    <td className="py-2.5 px-4 font-bold text-blue-600">#{imp.id}</td>
                    <td className="py-2.5 px-4 font-sans font-semibold text-gray-900">{imp.file_name}</td>
                    <td className="py-2.5 px-4 text-gray-500 text-[11px] font-sans">
                      {imp.upload_date ? new Date(imp.upload_date).toLocaleString() : 'N/A'}
                    </td>
                    <td className="py-2.5 px-4 text-gray-700 font-sans">
                      {imp.period_start || 'N/A'} • {imp.period_end || 'N/A'}
                    </td>
                    <td className="py-2.5 px-4 text-gray-700">{imp.sheet_count}</td>
                    <td className="py-2.5 px-4 text-emerald-700 font-bold">{imp.date_sheet_count}</td>
                    <td className="py-2.5 px-4 font-bold text-gray-900">{imp.transaction_count}</td>
                    <td className="py-2.5 px-4 font-sans">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${getStatusBadge(imp.status)}`}>
                        {imp.status === 'COMPLETED' ? 'Active / Completed' : imp.status === 'ARCHIVED' ? 'Previous / Archived' : imp.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right font-sans">
                      <button
                        onClick={() => handleDelete(imp.id)}
                        className="text-gray-400 hover:text-rose-600 p-1 rounded-md hover:bg-rose-50 transition-colors cursor-pointer"
                        title="Delete this record"
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
    </div>
  );
};

import React, { useState } from 'react';
import {
  X, UploadCloud, FileSpreadsheet, CheckCircle2,
  AlertTriangle, ArrowRight, Sparkles, RefreshCw
} from 'lucide-react';
import { apiClient } from '../../api/client';

interface UploadModalProps {
  onClose: () => void;
  onImportSuccess: () => void;
}

export const UploadModal: React.FC<UploadModalProps> = ({ onClose, onImportSuccess }) => {
  const [file, setFile] = useState<File | null>(null);
  const [useDemo, setUseDemo] = useState<boolean>(false);
  const [step, setStep] = useState<'SELECT' | 'SCANNING' | 'PREVIEW' | 'IMPORTING' | 'DONE'>('SELECT');
  const [scanResult, setScanResult] = useState<any>(null);
  const [importResult, setImportResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const [importMode, setImportMode] = useState<'append' | 'replace'>('append');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setUseDemo(false);
    }
  };

  const startScan = async () => {
    if (!file && !useDemo) return;
    setStep('SCANNING');
    setError(null);
    try {
      if (useDemo) {
        executeImport(true);
        return;
      }
      const res = await apiClient.scanWorkbook(file!);
      setScanResult(res);
      // If file has existing data and new dates, default to append; if no new dates, default to replace
      if (res.has_existing_data && res.new_dates_count === 0) {
        setImportMode('replace');
      } else {
        setImportMode('append');
      }
      setStep('PREVIEW');
    } catch (err: any) {
      setError(err.response?.data?.detail || "Scan failed. Please verify file format.");
      setStep('SELECT');
    }
  };

  const executeImport = async (demoMode = false) => {
    setStep('IMPORTING');
    setError(null);
    try {
      const isReplace = importMode === 'replace';
      const res = await apiClient.importWorkbook(
        file || undefined, 
        demoMode || useDemo,
        importMode,
        isReplace
      );
      setImportResult(res);
      setStep('DONE');
    } catch (err: any) {
      setError(err.response?.data?.detail || "Import failed. Please try again.");
      setStep('PREVIEW');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50/70">
          <div className="flex items-center gap-2.5">
            <UploadCloud className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-gray-900 text-sm">Upload Excel Statement</h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="p-6 space-y-6 text-xs">
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* STEP 1: Select File or Demo Fixture */}
          {step === 'SELECT' && (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-gray-300 hover:border-blue-500 rounded-xl p-8 text-center transition-colors bg-gray-50/50">
                <input
                  type="file"
                  id="file-upload"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <label htmlFor="file-upload" className="cursor-pointer space-y-2 block">
                  <FileSpreadsheet className="w-10 h-10 text-blue-600 mx-auto" />
                  <p className="font-medium text-gray-800">
                    {file ? file.name : "Click to select or drag & drop Excel workbook"}
                  </p>
                  <p className="text-[11px] text-gray-500">Supports .xlsx, .xls, and .csv files</p>
                </label>
              </div>

              {/* Demo Sample Quick Option */}
              <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-between">
                <div>
                  <span className="font-semibold text-gray-900 block">Use Sample Bank Workbook (HDFC BANK RECORD BOOK)</span>
                  <span className="text-[11px] text-gray-500">118 date sheets &bull; ~1,521 transactions &bull; 3 tables per sheet</span>
                </div>
                <button
                  type="button"
                  onClick={() => { setUseDemo(true); setFile(null); }}
                  className={`px-3 py-1.5 rounded-lg font-medium text-xs transition-colors cursor-pointer ${
                    useDemo ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {useDemo ? 'Selected' : 'Use Sample'}
                </button>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  disabled={!file && !useDemo}
                  onClick={startScan}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <span>Check Workbook</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Scanning Loading */}
          {step === 'SCANNING' && (
            <div className="py-16 text-center space-y-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="font-semibold text-gray-900">Reading Excel Workbook...</p>
              <p className="text-gray-500 text-xs">Finding date sheets, transaction tables, and rows</p>
            </div>
          )}

          {/* STEP 3: Preview Scan Summary */}
          {step === 'PREVIEW' && scanResult && (
            <div className="space-y-4">
              {/* Incremental Continuation Info Banner */}
              {scanResult.has_existing_data && scanResult.new_dates_count > 0 && (
                <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/80 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-indigo-900 font-bold text-xs">
                      <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
                      <span>Continuous Rhythm Mode (डेटा आगे से जुड़ेगा)</span>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-200 text-indigo-900">
                      +{scanResult.new_dates_count} New Dates Found
                    </span>
                  </div>
                  <div className="text-[11px] text-indigo-950 space-y-1">
                    <div>
                      • <span className="font-semibold">Pehle se uploaded:</span> {scanResult.existing_max_date} tak ({scanResult.existing_date_count} dates pehle se hain).
                    </div>
                    <div>
                      • <span className="font-semibold">Is file me naya data:</span> {scanResult.new_period_start} se {scanResult.new_period_end} ({scanResult.new_dates_count} dates).
                    </div>
                    <div>
                      • <span className="font-semibold">Running Balance Rhythm:</span> Opening Balance pichhle closing balance (<strong>₹{scanResult.last_closing_balance.toLocaleString('en-IN')}</strong>) se smoothly continue hoga.
                    </div>
                  </div>

                  <div className="pt-2 flex flex-wrap items-center gap-4 text-[11px] border-t border-indigo-200/80">
                    <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-indigo-950">
                      <input 
                        type="radio" 
                        name="importMode" 
                        value="append" 
                        checked={importMode === 'append'} 
                        onChange={() => setImportMode('append')}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>Continue from {scanResult.existing_max_date} (Recommended)</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer text-gray-600">
                      <input 
                        type="radio" 
                        name="importMode" 
                        value="replace" 
                        checked={importMode === 'replace'} 
                        onChange={() => setImportMode('replace')}
                        className="text-gray-500 focus:ring-gray-400"
                      />
                      <span>Replace All (Naye sire se)</span>
                    </label>
                  </div>
                </div>
              )}

              {scanResult.has_existing_data && scanResult.new_dates_count === 0 && (
                <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50 text-amber-900 space-y-1.5">
                  <div className="font-semibold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Is workbook ke sabhi sheets pehle se uploaded hain ({scanResult.existing_max_date} tak)</span>
                  </div>
                  <p className="text-[11px] text-amber-800">
                    Is file me koi naya date nahi mila. Agar aap pure database ko is file se overwrite karna chahte hain to "Replace All" select karein.
                  </p>
                  <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-medium text-gray-800 pt-1">
                    <input 
                      type="radio" 
                      name="importMode" 
                      value="replace" 
                      checked={importMode === 'replace'} 
                      onChange={() => setImportMode('replace')}
                    />
                    <span>Replace All Data with this workbook</span>
                  </label>
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <span className="text-gray-500 text-[11px] block">Total Sheets</span>
                  <span className="text-base font-bold font-mono text-gray-900">{scanResult.total_sheets}</span>
                </div>
                <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                  <span className="text-emerald-700 text-[11px] block font-semibold">Date Sheets</span>
                  <span className="text-base font-bold font-mono text-emerald-800">{scanResult.date_sheets_count}</span>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <span className="text-blue-700 text-[11px] block font-semibold">Tables Found</span>
                  <span className="text-base font-bold font-mono text-blue-800">{scanResult.transaction_sections_count}</span>
                </div>
                <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                  <span className="text-purple-700 text-[11px] block font-semibold">Transactions</span>
                  <span className="text-base font-bold font-mono text-purple-800">{scanResult.candidate_transactions_count}</span>
                </div>
              </div>

              {/* Sample Sheet Scan Preview */}
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl space-y-2 max-h-48 overflow-y-auto">
                <span className="font-semibold text-gray-700 block text-[11px] uppercase tracking-wider">
                  Sample Detected Sheets:
                </span>
                {scanResult.sheets.slice(0, 8).map((s: any, idx: number) => (
                  <div key={idx} className="flex justify-between items-center text-[11px] text-gray-600 border-b border-gray-200 pb-1">
                    <span className="text-gray-900 font-medium">{s.sheet_name}</span>
                    <span className="font-mono text-emerald-700 font-bold">{s.detected_date}</span>
                    <span className="text-gray-500">{s.section_count} tables &bull; {s.candidate_txns} entries</span>
                  </div>
                ))}
              </div>

              <div className="flex justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setStep('SELECT')}
                  className="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg transition-colors cursor-pointer"
                >
                  Choose Different File
                </button>
                <button
                  type="button"
                  disabled={scanResult.has_existing_data && scanResult.new_dates_count === 0 && importMode !== 'replace'}
                  onClick={() => executeImport(false)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <span>
                    {importMode === 'append' && scanResult.has_existing_data && scanResult.new_dates_count > 0
                      ? `Append & Continue (${scanResult.new_dates_count} New Dates)`
                      : importMode === 'replace'
                      ? 'Replace All Records'
                      : 'Process All Records'}
                  </span>
                  <Sparkles className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: Importing Loading */}
          {step === 'IMPORTING' && (
            <div className="py-16 text-center space-y-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="font-semibold text-gray-900">
                {importMode === 'append' ? 'Appending New Dates & Continuing Ledger Rhythm...' : 'Processing All Dates & Calculating Balances...'}
              </p>
              <p className="text-gray-500 text-xs">
                Classifying transactions, organizing into head sections, and matching sheet totals
              </p>
            </div>
          )}

          {/* STEP 5: Done */}
          {step === 'DONE' && importResult && (
            <div className="text-center py-6 space-y-4">
              <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
              <div>
                <h3 className="text-base font-bold text-gray-900">
                  {importResult.is_incremental ? 'Data Successfully Appended & Continued!' : 'Workbook Ready!'}
                </h3>
                <p className="text-xs text-gray-600 mt-1 max-w-md mx-auto">
                  {importResult.is_incremental ? (
                    <>
                      {importResult.continuation_from_date} ke aage se <strong>{importResult.appended_dates_count} naye dates</strong> ({importResult.transaction_count} transactions) jod diye gaye hain. Ab total active dates <strong>{importResult.total_active_dates_count}</strong> hain.
                    </>
                  ) : (
                    <>Successfully loaded {importResult.transaction_count} transactions across {importResult.date_sheet_count} date sheets.</>
                  )}
                </p>
              </div>

              <button
                onClick={() => {
                  onImportSuccess();
                  onClose();
                }}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl shadow-md transition-all cursor-pointer"
              >
                Go to Dashboard
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

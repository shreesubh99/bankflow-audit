import React from 'react';
import { UploadCloud, Calendar, RefreshCw } from 'lucide-react';

interface NavbarProps {
  title: string;
  subtitle?: string;
  onOpenUpload: () => void;
  onRefresh: () => void;
  selectedMonth: string;
  onSelectMonth: (month: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  title,
  subtitle,
  onOpenUpload,
  onRefresh,
  selectedMonth,
  onSelectMonth
}) => {
  const months = [
    { label: 'All Dates', value: 'ALL' },
    { label: 'Sep 2026', value: '2026-09' },
    { label: 'Aug 2026', value: '2026-08' },
    { label: 'Jul 2026', value: '2026-07' },
    { label: 'May 2026', value: '2026-05' },
  ];

  return (
    <header className="h-16 bg-white border-b border-gray-200 px-6 flex items-center justify-between sticky top-0 z-30 shadow-xs">
      <div>
        <h2 className="text-lg font-bold text-gray-900 tracking-tight">{title}</h2>
        {subtitle && <p className="text-xs text-gray-500 font-medium">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-3">
        {/* Quick Month Filter */}
        <div className="flex items-center bg-gray-100 p-1 rounded-xl border border-gray-200 text-xs">
          <Calendar className="w-3.5 h-3.5 text-gray-500 ml-2 mr-1" />
          {months.map((m) => (
            <button
              key={m.value}
              onClick={() => onSelectMonth(m.value)}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                selectedMonth === m.value
                  ? 'bg-white text-blue-600 shadow-xs border border-gray-200/80'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Refresh Button */}
        <button
          onClick={onRefresh}
          title="Refresh Data"
          className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-xl border border-gray-200 transition-colors cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" />
        </button>

        {/* Upload Excel Button */}
        <button
          onClick={onOpenUpload}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-3.5 py-2 rounded-xl shadow-xs transition-all cursor-pointer"
        >
          <UploadCloud className="w-4 h-4" />
          <span>Upload Excel Sheet</span>
        </button>
      </div>
    </header>
  );
};

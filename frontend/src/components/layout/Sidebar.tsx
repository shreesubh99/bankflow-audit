import React from 'react';
import {
  LayoutDashboard, CalendarCheck2, ReceiptText, Network,
  Grid3x3, Scale, AlertTriangle, SlidersHorizontal,
  FileSpreadsheet, ShieldCheck
} from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  exceptionCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onSelectTab, exceptionCount = 0 }) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'daily-audit', label: 'Day-Wise Bank Ledger', icon: CalendarCheck2 },
    { id: 'transactions', label: 'All Transactions', icon: ReceiptText },
    { id: 'funds', label: 'Money Source Tracker', icon: Network },
    { id: 'sectors', label: 'Sector Analysis', icon: Grid3x3 },
    { id: 'reconciliation', label: 'Sheet Match Check', icon: Scale },
    { id: 'exceptions', label: 'Review Alerts', icon: AlertTriangle, badge: exceptionCount },
    { id: 'rules', label: 'Category Rules', icon: SlidersHorizontal },
    { id: 'imports', label: 'Upload History', icon: FileSpreadsheet },
  ];

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col shrink-0 h-screen sticky top-0 shadow-sm">
      {/* Brand Header */}
      <div className="p-5 border-b border-gray-200 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shadow-sm">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <div>
          <h1 className="font-bold text-gray-900 text-base tracking-tight leading-tight">BankFlow</h1>
          <p className="text-xs text-blue-600 font-semibold">Audit Intelligence</p>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider px-3 pt-2 pb-1.5">
          Accounts & Audit
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                isActive
                  ? 'bg-blue-50 text-blue-700 font-bold border border-blue-200 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-blue-600' : 'text-gray-500'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge !== undefined && item.badge > 0 ? (
                <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${
                  isActive ? 'bg-blue-600 text-white' : 'bg-rose-100 text-rose-700 border border-rose-200'
                }`}>
                  {item.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>

      {/* Footer System Status */}
      <div className="p-4 border-t border-gray-200 text-xs text-gray-500 bg-gray-50/50">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-gray-800 font-semibold">System Active</span>
        </div>
        <p className="text-[11px] text-gray-400">Simple & Clean Financial Audit</p>
      </div>
    </aside>
  );
};

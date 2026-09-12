import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { Navbar } from './components/layout/Navbar';
import { DashboardView } from './components/dashboard/DashboardView';
import { DailyAuditView } from './components/daily_audit/DailyAuditView';
import { TransactionsView } from './components/transactions/TransactionsView';
import { FundsView } from './components/funds/FundsView';
import { SectorsView } from './components/sectors/SectorsView';
import { ReconciliationView } from './components/reconciliation/ReconciliationView';
import { ExceptionsView } from './components/exceptions/ExceptionsView';
import { RulesView } from './components/rules/RulesView';
import { ImportsView } from './components/imports/ImportsView';
import { UploadModal } from './components/imports/UploadModal';
import { apiClient } from './api/client';

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [selectedMonth, setSelectedMonth] = useState<string>('ALL');
  const [drilldownDate, setDrilldownDate] = useState<string | undefined>(undefined);
  const [inspectTxnId, setInspectTxnId] = useState<string | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState<boolean>(false);
  const [exceptionCount, setExceptionCount] = useState<number>(0);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

  useEffect(() => {
    loadExceptionCount();
  }, [refreshTrigger]);

  const loadExceptionCount = async () => {
    try {
      const excs = await apiClient.getExceptions('OPEN');
      setExceptionCount(excs.length);
    } catch (err) {
      console.error("Failed to load exception count", err);
    }
  };

  const handleNavigate = (tab: string, param?: string) => {
    if (tab === 'daily-audit' && param) {
      setDrilldownDate(param);
    } else {
      setDrilldownDate(undefined);
    }
    setCurrentTab(tab);
  };

  const handleSelectTransaction = (txnId: string) => {
    setInspectTxnId(txnId);
    setCurrentTab('transactions');
  };

  const handleRefresh = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  const getTabTitle = () => {
    switch (currentTab) {
      case 'dashboard':
        return { title: 'Business Overview', subtitle: 'Turnover, real income, expenses, and bank account balance' };
      case 'daily-audit':
        return { title: 'Day-Wise Bank Ledger', subtitle: 'Daily bank opening balance, deposits, payments, and expected closing balance' };
      case 'transactions':
        return { title: 'All Transactions', subtitle: 'Search, filter, and view all incoming and outgoing entries' };
      case 'funds':
        return { title: 'Money Source Tracker', subtitle: 'Track where received money came from and where it was spent' };
      case 'sectors':
        return { title: 'Sector Analysis', subtitle: 'Breakdown of receipts and expenses across business sectors' };
      case 'reconciliation':
        return { title: 'Sheet Match Check', subtitle: 'Verify Excel sheet totals against calculated transactions' };
      case 'exceptions':
        return { title: 'Review Alerts', subtitle: 'Review items that need attention like duplicate entries or mismatches' };
      case 'rules':
        return { title: 'Category Rules', subtitle: 'Rules to automatically categorize transactions' };
      case 'imports':
        return { title: 'Upload History', subtitle: 'View previously uploaded Excel record books' };
      default:
        return { title: 'BankFlow Accounts', subtitle: 'Financial Record System' };
    }
  };

  const { title, subtitle } = getTabTitle();

  return (
    <div className="flex h-screen bg-gray-50 text-gray-900 overflow-hidden font-sans">
      {/* Navigation Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={(tab) => {
          setDrilldownDate(undefined);
          setCurrentTab(tab);
        }}
        exceptionCount={exceptionCount}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Navbar
          title={title}
          subtitle={subtitle}
          onOpenUpload={() => setIsUploadOpen(true)}
          onRefresh={handleRefresh}
          selectedMonth={selectedMonth}
          onSelectMonth={setSelectedMonth}
        />

        <main className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
          <div className="max-w-7xl mx-auto">
            {currentTab === 'dashboard' && (
              <DashboardView
                selectedMonth={selectedMonth}
                onNavigate={handleNavigate}
              />
            )}
            {currentTab === 'daily-audit' && (
              <DailyAuditView
                initialDate={drilldownDate}
                onSelectTransaction={handleSelectTransaction}
              />
            )}
            {currentTab === 'transactions' && (
              <TransactionsView
                initialTxnId={inspectTxnId}
              />
            )}
            {currentTab === 'funds' && <FundsView />}
            {currentTab === 'sectors' && <SectorsView />}
            {currentTab === 'reconciliation' && <ReconciliationView />}
            {currentTab === 'exceptions' && <ExceptionsView />}
            {currentTab === 'rules' && <RulesView />}
            {currentTab === 'imports' && (
              <ImportsView onOpenUpload={() => setIsUploadOpen(true)} />
            )}
          </div>
        </main>
      </div>

      {/* Upload Wizard Modal */}
      {isUploadOpen && (
        <UploadModal
          onClose={() => setIsUploadOpen(false)}
          onImportSuccess={() => {
            handleRefresh();
            setCurrentTab('dashboard');
          }}
        />
      )}
    </div>
  );
};

export default App;

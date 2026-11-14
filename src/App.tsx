import React, { useState } from 'react';
import { useApp } from './context/AppContext';
import { KlarencyLogo } from './components/brand/KlarencyLogo';
import { LandingPage } from './components/landing/LandingPage';
import { MainDashboardView } from './components/dashboard/MainDashboardView';
import { GroupManagementView } from './components/groups/GroupManagementView';
import { CommitmentCenterView } from './components/commitments/CommitmentCenterView';
import { PaymentHistoryAndVerificationView } from './components/payments/PaymentHistoryAndVerificationView';
import { ExpenseManagementView } from './components/expenses/ExpenseManagementView';
import { DisputeManagementView } from './components/disputes/DisputeManagementView';
import { FinancialReportingView } from './components/reports/FinancialReportingView';
import { NotificationsCenterView } from './components/notifications/NotificationsCenterView';
import { UserSettingsAndProfileView } from './components/settings/UserSettingsAndProfileView';
import { RecordPaymentModal } from './components/payments/RecordPaymentModal';
import { CreateCommitmentModal } from './components/commitments/CreateCommitmentModal';
import { CreateContributionModal } from './components/contributions/CreateContributionModal';
import { RecordExpenseModal } from './components/expenses/RecordExpenseModal';
import { EmailCommunicationsCenterView } from './components/communications/EmailCommunicationsCenterView';
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Clock,
  Receipt,
  FileText,
  AlertTriangle,
  Bell,
  Settings,
  LogOut,
  Menu,
  X,
  Mail,
  ShieldCheck,
  ArrowLeft,
  AlertCircle,
} from 'lucide-react';

export default function App() {
  const {
    currentUser,
    authStatus,
    authError,
    clearAuthError,
    actionError,
    clearActionError,
    currentGroup,
    groups,
    setCurrentGroup,
    notifications,
    commitments,
    communications,
    firebaseAuthUser,
    signInWithGoogle,
    signOut,
  } = useApp();

  const [viewMode, setViewMode] = useState<'landing' | 'app'>('app');
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  // Modals state
  const [isRecordPaymentOpen, setIsRecordPaymentOpen] = useState(false);
  const [recordPaymentAssignmentId, setRecordPaymentAssignmentId] = useState<string | undefined>(undefined);

  const [isCreateCommitmentOpen, setIsCreateCommitmentOpen] = useState(false);
  const [createCommitmentAssignmentId, setCreateCommitmentAssignmentId] = useState<string | undefined>(undefined);

  const [isCreateContributionOpen, setIsCreateContributionOpen] = useState(false);
  const [isRecordExpenseOpen, setIsRecordExpenseOpen] = useState(false);

  const activeGroups = groups.filter((g) => g.status !== 'archived');

  if (viewMode === 'landing') {
    return (
      <LandingPage
        onGetStarted={() => setViewMode('app')}
      />
    );
  }

  // Loading auth state
  if (authStatus === 'loading') {
    return (
      <div className="min-h-screen bg-[#FDFDFD] flex items-center justify-center p-6">
        <div className="bg-white border border-neutral-200 rounded-2xl p-8 max-w-sm w-full text-center space-y-4">
          <div className="flex justify-center">
            <KlarencyLogo size="md" />
          </div>
          <p className="text-xs text-neutral-500 font-medium">
            Verifying administrator session...
          </p>
        </div>
      </div>
    );
  }

  // Strict Administrator Authentication Gate
  if (!firebaseAuthUser || !currentUser) {
    return (
      <div className="min-h-screen bg-[#F7F7F8] text-neutral-900 flex flex-col justify-between p-4 sm:p-8">
        <div className="max-w-5xl w-full mx-auto flex items-center justify-between">
          <KlarencyLogo size="md" />
          <button
            type="button"
            onClick={() => setViewMode('landing')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-600 hover:text-neutral-900 px-3 py-2 rounded-xl hover:bg-neutral-200/60 transition-colors cursor-pointer whitespace-nowrap"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Platform Overview
          </button>
        </div>

        <main className="max-w-md w-full mx-auto my-10">
          <div className="bg-white border border-neutral-200 rounded-3xl p-7 sm:p-8 shadow-sm space-y-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-700">
                <ShieldCheck className="w-4 h-4 text-[#16A34A]" />
                <span>Centralized Administrator Access</span>
              </div>
              <h1 className="text-2xl font-extrabold text-neutral-900 tracking-tight">
                Sign in to manage shared finances
              </h1>
              <p className="text-xs text-neutral-600 leading-relaxed">
                KLARENCY UnitSpot is operated exclusively by verified group administrators. Sign in with your Google account to manage member directories, contribution rates, verified payments, and audit logs.
              </p>
            </div>

            {authError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="flex-1">{authError}</div>
                <button
                  type="button"
                  onClick={clearAuthError}
                  className="text-rose-700 hover:text-rose-900 font-semibold cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            )}

            <div className="space-y-3">
              <button
                type="button"
                onClick={signInWithGoogle}
                className="w-full flex items-center justify-center gap-2.5 bg-neutral-900 hover:bg-black text-white font-bold py-3 px-4 rounded-xl text-sm transition-colors cursor-pointer"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>Continue with Google</span>
              </button>

              <p className="text-[11px] text-neutral-500 text-center leading-relaxed">
                Group members do not need accounts or passwords. All member obligations, receipts, and reminders are sent directly to their registered emails.
              </p>
            </div>
          </div>
        </main>

        <footer className="max-w-5xl w-full mx-auto text-center text-[11px] text-neutral-500">
          Every Contribution · Every Transaction · Clear · Malawi Kwacha (MWK)
        </footer>
      </div>
    );
  }

  // Unread notifications count
  const unreadCount = notifications.filter(
    (n) => !n.read && (n.userId === currentUser.id || !n.userId)
  ).length;
  const activeCountdownsCount = commitments.filter((c) => c.currentOutstandingAmount > 0).length;

  const handleOpenRecordPayment = (assignmentId?: string) => {
    setRecordPaymentAssignmentId(assignmentId);
    setIsRecordPaymentOpen(true);
  };

  const handleOpenCreateCommitment = (assignmentId?: string) => {
    setCreateCommitmentAssignmentId(assignmentId);
    setIsCreateCommitmentOpen(true);
  };

  const navItems = [
    { id: 'dashboard', label: 'Main Dashboard', icon: LayoutDashboard },
    {
      id: 'communications',
      label: 'Email Notices & Hub',
      icon: Mail,
      badge: communications.length > 0 ? communications.length : null,
    },
    {
      id: 'commitments',
      label: 'Commitments & Countdowns',
      icon: Clock,
      badge: activeCountdownsCount > 0 ? activeCountdownsCount : null,
    },
    { id: 'payments', label: 'Payments & Verification', icon: CreditCard },
    { id: 'expenses', label: 'Expenses & Treasury', icon: Receipt },
    { id: 'groups', label: 'Groups & Directory', icon: Users },
    { id: 'reports', label: 'Financial Reports', icon: FileText },
    { id: 'disputes', label: 'Disputes & Inquiries', icon: AlertTriangle },
    {
      id: 'notifications',
      label: 'Notification Centre',
      icon: Bell,
      badge: unreadCount > 0 ? unreadCount : null,
    },
    { id: 'settings', label: 'Account & Audit Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-[#FDFDFD] text-neutral-900 flex flex-col md:flex-row antialiased">
      {/* Desktop Left Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-neutral-200/80 p-5 shrink-0 justify-between select-none">
        <div className="space-y-6">
          <div className="flex items-center justify-between pb-2">
            <button
              onClick={() => setCurrentTab('dashboard')}
              className="text-left cursor-pointer hover:opacity-90 transition-opacity"
            >
              <KlarencyLogo size="md" />
            </button>
          </div>

          {/* Group Switcher Dropdown */}
          <div className="bg-neutral-50 rounded-2xl p-2.5 border border-neutral-200">
            <div className="text-[10px] uppercase font-bold tracking-wider text-neutral-500 mb-1 px-1">
              Active Financial Circle
            </div>
            {activeGroups.length === 0 ? (
              <button
                onClick={() => setCurrentTab('groups')}
                className="w-full text-left bg-white border border-dashed border-neutral-300 rounded-xl px-2.5 py-1.5 text-xs text-neutral-600 hover:text-neutral-900 transition-colors cursor-pointer"
              >
                + Create First Group
              </button>
            ) : (
              <select
                value={currentGroup?.id || ''}
                onChange={(e) => {
                  const found = activeGroups.find((g) => g.id === e.target.value);
                  if (found) setCurrentGroup(found);
                }}
                aria-label="Select active financial group"
                className="w-full bg-white border border-neutral-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-neutral-900 focus:outline-none cursor-pointer"
              >
                {activeGroups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Primary Navigation Links */}
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => setCurrentTab(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                    isActive
                      ? 'bg-neutral-900 text-white font-bold shadow-xs'
                      : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-neutral-500'}`} />
                    <span className="truncate">{item.label}</span>
                  </div>

                  {item.badge && (
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full tabular-nums ${
                        isActive ? 'bg-white text-neutral-900' : 'bg-neutral-200 text-neutral-800'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer Authenticated Admin Card */}
        <div className="pt-4 border-t border-neutral-100 space-y-3">
          <button
            type="button"
            onClick={() => setCurrentTab('settings')}
            className="w-full flex items-center gap-2.5 p-2 rounded-xl hover:bg-neutral-100 transition-colors cursor-pointer text-left"
          >
            {currentUser.avatarUrl ? (
              <img
                src={currentUser.avatarUrl}
                alt={currentUser.name}
                referrerPolicy="no-referrer"
                className="w-8 h-8 rounded-full object-cover border border-neutral-200"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-neutral-900 text-white font-bold flex items-center justify-center text-xs">
                {currentUser.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="font-bold text-xs text-neutral-900 truncate">{currentUser.name}</div>
              <div className="text-[10px] text-neutral-500 capitalize">
                {currentUser.role.replace('_', ' ')}
              </div>
            </div>
          </button>

          <div className="flex items-center justify-between px-2.5 py-1.5 bg-neutral-50 text-neutral-700 rounded-xl text-[11px] font-medium border border-neutral-200">
            <span className="truncate max-w-[120px]">{currentUser.email}</span>
            <button
              type="button"
              onClick={signOut}
              className="text-rose-700 hover:text-rose-900 font-semibold cursor-pointer whitespace-nowrap"
            >
              Sign Out
            </button>
          </div>

          <button
            type="button"
            onClick={() => setViewMode('landing')}
            className="w-full text-left text-neutral-500 hover:text-neutral-800 text-[11px] font-medium px-2 py-1 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Platform Overview
          </button>
        </div>
      </aside>

      {/* Mobile Top Header */}
      <header className="md:hidden bg-white border-b border-neutral-200 px-3.5 py-2.5 flex items-center justify-between sticky top-0 z-40">
        <KlarencyLogo size="sm" />

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCurrentTab('settings')}
            className="w-8 h-8 rounded-full overflow-hidden border border-neutral-200 cursor-pointer flex items-center justify-center"
            title={currentUser.email}
            aria-label="Account settings"
          >
            {currentUser.avatarUrl ? (
              <img src={currentUser.avatarUrl} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-neutral-900 text-white text-[10px] flex items-center justify-center font-bold">
                {currentUser.name.charAt(0).toUpperCase()}
              </div>
            )}
          </button>

          <button
            type="button"
            onClick={() => setCurrentTab('notifications')}
            className="relative p-2 text-neutral-600 hover:text-neutral-900"
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#16A34A]" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 text-neutral-600 hover:text-neutral-900"
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </header>

      {/* Mobile Navigation Drawer */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-white border-b border-neutral-200 p-4 space-y-2 z-30 shadow-lg">
          <div className="pb-2 border-b border-neutral-100 flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-neutral-400">Current Group:</span>
              <div className="font-bold text-xs text-neutral-900">
                {currentGroup ? currentGroup.name : 'No group active'}
              </div>
            </div>
            <span className="text-[11px] text-neutral-500 font-medium">{currentUser.email}</span>
          </div>
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setCurrentTab(item.id);
                setIsMobileMenuOpen(false);
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold ${
                currentTab === item.id ? 'bg-neutral-900 text-white' : 'text-neutral-700 hover:bg-neutral-100'
              }`}
            >
              <span>{item.label}</span>
              {item.badge && (
                <span className="bg-neutral-200 text-neutral-900 text-[10px] px-2 py-0.5 rounded-full tabular-nums">
                  {item.badge}
                </span>
              )}
            </button>
          ))}
          <div className="pt-2 border-t border-neutral-100 flex items-center justify-between">
            <button
              onClick={() => {
                setViewMode('landing');
                setIsMobileMenuOpen(false);
              }}
              className="text-xs text-neutral-600 font-medium py-1"
            >
              Platform Overview
            </button>
            <button onClick={signOut} className="text-xs text-rose-700 font-semibold py-1">
              Sign Out
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 pb-20 md:pb-6">
        {/* Top bar on desktop (3 zones: Breadcrumb — Session — Primary Action) */}
        <div className="hidden md:flex h-14 border-b border-neutral-200/80 bg-white px-8 items-center justify-between gap-8">
          <div className="flex items-center gap-2 text-xs text-neutral-500 whitespace-nowrap">
            <span className="font-semibold text-neutral-800">UnitSpot MWK</span>
            <span aria-hidden="true">/</span>
            <span className="font-semibold text-neutral-900 capitalize">
              {currentTab.replace('_', ' ')}
            </span>
            {currentGroup && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-neutral-600 truncate max-w-[220px]">{currentGroup.name}</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-2 bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-1">
              <span className="text-xs font-semibold text-neutral-800 max-w-[160px] truncate">
                {currentUser.name}
              </span>
              <span className="text-neutral-300" aria-hidden="true">|</span>
              <button
                onClick={signOut}
                className="text-[11px] text-neutral-600 hover:text-rose-700 font-semibold transition-colors cursor-pointer whitespace-nowrap"
              >
                Sign Out
              </button>
            </div>

            <button
              onClick={() => setCurrentTab('notifications')}
              className="relative p-2 text-neutral-500 hover:text-neutral-900 rounded-xl hover:bg-neutral-100 transition-colors cursor-pointer"
              aria-label="View notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#16A34A]" />
              )}
            </button>

            <button
              onClick={() => handleOpenRecordPayment()}
              className="bg-neutral-900 hover:bg-black text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <CreditCard className="w-3.5 h-3.5 text-[#D5A52B]" />
              Record Payment
            </button>
          </div>
        </div>

        {/* Cloud / Action Error Banner */}
        {actionError && (
          <div className="mx-4 sm:mx-6 lg:mx-8 mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
              <span>{actionError}</span>
            </div>
            <button
              type="button"
              onClick={clearActionError}
              className="text-amber-800 hover:text-amber-950 font-semibold cursor-pointer whitespace-nowrap"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* View Router */}
        <div className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {currentTab === 'dashboard' && (
            <MainDashboardView
              onOpenRecordPayment={handleOpenRecordPayment}
              onOpenCreateCommitment={handleOpenCreateCommitment}
              onOpenCreateContribution={() => setIsCreateContributionOpen(true)}
              onOpenRecordExpense={() => setIsRecordExpenseOpen(true)}
              onNavigateTab={(tab) => setCurrentTab(tab)}
            />
          )}

          {currentTab === 'communications' && <EmailCommunicationsCenterView />}

          {currentTab === 'commitments' && (
            <CommitmentCenterView
              onOpenCreateCommitment={handleOpenCreateCommitment}
              onOpenRecordPayment={handleOpenRecordPayment}
            />
          )}

          {currentTab === 'payments' && (
            <PaymentHistoryAndVerificationView onOpenRecordModal={handleOpenRecordPayment} />
          )}

          {currentTab === 'expenses' && (
            <ExpenseManagementView onOpenRecordExpense={() => setIsRecordExpenseOpen(true)} />
          )}

          {currentTab === 'groups' && <GroupManagementView />}

          {currentTab === 'reports' && <FinancialReportingView />}

          {currentTab === 'disputes' && <DisputeManagementView />}

          {currentTab === 'notifications' && <NotificationsCenterView />}

          {currentTab === 'settings' && <UserSettingsAndProfileView />}
        </div>
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-200 px-3 py-2 flex items-center justify-around z-40 text-[10px] font-semibold text-neutral-500">
        <button
          onClick={() => setCurrentTab('dashboard')}
          className={`flex flex-col items-center gap-1 ${currentTab === 'dashboard' ? 'text-neutral-900 font-bold' : ''}`}
        >
          <LayoutDashboard className="w-4 h-4" />
          <span>Home</span>
        </button>

        <button
          onClick={() => setCurrentTab('commitments')}
          className={`flex flex-col items-center gap-1 relative ${currentTab === 'commitments' ? 'text-neutral-900 font-bold' : ''}`}
        >
          <Clock className="w-4 h-4" />
          <span>Promises</span>
          {activeCountdownsCount > 0 && (
            <span className="absolute -top-1 right-1 w-2 h-2 rounded-full bg-[#D5A52B]" />
          )}
        </button>

        <button
          onClick={() => handleOpenRecordPayment()}
          className="flex flex-col items-center justify-center -mt-4 bg-neutral-900 text-white w-11 h-11 rounded-full shadow-lg"
          aria-label="Record payment"
        >
          <CreditCard className="w-5 h-5 text-[#D5A52B]" />
        </button>

        <button
          onClick={() => setCurrentTab('payments')}
          className={`flex flex-col items-center gap-1 ${currentTab === 'payments' ? 'text-neutral-900 font-bold' : ''}`}
        >
          <Receipt className="w-4 h-4" />
          <span>Ledger</span>
        </button>

        <button
          onClick={() => setCurrentTab('settings')}
          className={`flex flex-col items-center gap-1 ${currentTab === 'settings' ? 'text-neutral-900 font-bold' : ''}`}
        >
          <Settings className="w-4 h-4" />
          <span>Audit</span>
        </button>
      </div>

      {/* Global Modals */}
      <RecordPaymentModal
        isOpen={isRecordPaymentOpen}
        onClose={() => setIsRecordPaymentOpen(false)}
        defaultAssignmentId={recordPaymentAssignmentId}
      />

      <CreateCommitmentModal
        isOpen={isCreateCommitmentOpen}
        onClose={() => setIsCreateCommitmentOpen(false)}
        defaultAssignmentId={createCommitmentAssignmentId}
      />

      <CreateContributionModal
        isOpen={isCreateContributionOpen}
        onClose={() => setIsCreateContributionOpen(false)}
      />

      <RecordExpenseModal
        isOpen={isRecordExpenseOpen}
        onClose={() => setIsRecordExpenseOpen(false)}
      />
    </div>
  );
}

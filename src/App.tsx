import React, { useState, useEffect, Suspense, lazy } from 'react';
import { useApp } from './context/AppContext';
import { UnitSpotLogo } from './components/brand/UnitSpotLogo';
import { ThemeToggle } from './components/ui/ThemeToggle';
import { ViewSkeleton } from './components/ui/Skeleton';
import { LandingPage } from './components/landing/LandingPage';
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
  CheckCircle2,
  MoreHorizontal,
} from 'lucide-react';

// Code-split views & modals for faster initial load
const MainDashboardView = lazy(() =>
  import('./components/dashboard/MainDashboardView').then((m) => ({
    default: m.MainDashboardView,
  }))
);
const GroupManagementView = lazy(() =>
  import('./components/groups/GroupManagementView').then((m) => ({
    default: m.GroupManagementView,
  }))
);
const CommitmentCenterView = lazy(() =>
  import('./components/commitments/CommitmentCenterView').then((m) => ({
    default: m.CommitmentCenterView,
  }))
);
const PaymentHistoryAndVerificationView = lazy(() =>
  import('./components/payments/PaymentHistoryAndVerificationView').then((m) => ({
    default: m.PaymentHistoryAndVerificationView,
  }))
);
const ExpenseManagementView = lazy(() =>
  import('./components/expenses/ExpenseManagementView').then((m) => ({
    default: m.ExpenseManagementView,
  }))
);
const DisputeManagementView = lazy(() =>
  import('./components/disputes/DisputeManagementView').then((m) => ({
    default: m.DisputeManagementView,
  }))
);
const FinancialReportingView = lazy(() =>
  import('./components/reports/FinancialReportingView').then((m) => ({
    default: m.FinancialReportingView,
  }))
);
const NotificationsCenterView = lazy(() =>
  import('./components/notifications/NotificationsCenterView').then((m) => ({
    default: m.NotificationsCenterView,
  }))
);
const UserSettingsAndProfileView = lazy(() =>
  import('./components/settings/UserSettingsAndProfileView').then((m) => ({
    default: m.UserSettingsAndProfileView,
  }))
);
const EmailCommunicationsCenterView = lazy(() =>
  import('./components/communications/EmailCommunicationsCenterView').then((m) => ({
    default: m.EmailCommunicationsCenterView,
  }))
);

const RecordPaymentModal = lazy(() =>
  import('./components/payments/RecordPaymentModal').then((m) => ({
    default: m.RecordPaymentModal,
  }))
);
const CreateCommitmentModal = lazy(() =>
  import('./components/commitments/CreateCommitmentModal').then((m) => ({
    default: m.CreateCommitmentModal,
  }))
);
const CreateContributionModal = lazy(() =>
  import('./components/contributions/CreateContributionModal').then((m) => ({
    default: m.CreateContributionModal,
  }))
);
const RecordExpenseModal = lazy(() =>
  import('./components/expenses/RecordExpenseModal').then((m) => ({
    default: m.RecordExpenseModal,
  }))
);

const PAGE_METADATA: Record<string, { title: string; subtitle: string }> = {
  dashboard: {
    title: 'Main Dashboard',
    subtitle: 'Collection progress, member balances, and verified treasury pulse',
  },
  groups: {
    title: 'Groups & Directory',
    subtitle: 'Manage resident records, stove tiers, and member welcome cards',
  },
  payments: {
    title: 'Payments & Verification',
    subtitle: 'Inspect receipt photos, verify inflows, and issue audited reversals',
  },
  commitments: {
    title: 'Commitments & Countdowns',
    subtitle: 'Track partial payment promises and upcoming balance deadlines',
  },
  expenses: {
    title: 'Expenses & Treasury',
    subtitle: 'Record ESCOM tokens, utilities, and reconcile against inflows',
  },
  communications: {
    title: 'Email Notices & Hub',
    subtitle: 'Send private obligation notices, reminders, and announcements',
  },
  reports: {
    title: 'Financial Reports',
    subtitle: 'Generate printable MWK statements and export CSV audit logs',
  },
  disputes: {
    title: 'Disputes & Inquiries',
    subtitle: 'Review and resolve member balance questions transparently',
  },
  notifications: {
    title: 'Notification Centre',
    subtitle: 'System alerts, upcoming deadlines, and activity feed',
  },
  settings: {
    title: 'Account & Audit Settings',
    subtitle: 'Administrator session, rate rules, and workspace preferences',
  },
};

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
  const [recordPaymentAssignmentId, setRecordPaymentAssignmentId] = useState<string | undefined>(
    undefined
  );

  const [isCreateCommitmentOpen, setIsCreateCommitmentOpen] = useState(false);
  const [createCommitmentAssignmentId, setCreateCommitmentAssignmentId] = useState<
    string | undefined
  >(undefined);

  const [isCreateContributionOpen, setIsCreateContributionOpen] = useState(false);
  const [isRecordExpenseOpen, setIsRecordExpenseOpen] = useState(false);

  // Close mobile drawer on Escape
  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsMobileMenuOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isMobileMenuOpen]);

  const activeGroups = groups.filter((g) => g.status !== 'archived');

  if (viewMode === 'landing') {
    return <LandingPage onGetStarted={() => setViewMode('app')} />;
  }

  // Loading auth state
  if (authStatus === 'loading') {
    return (
      <div className="min-h-screen bg-[#F6F8FC] dark:bg-[#070B14] flex items-center justify-center p-6">
        <div className="bg-white dark:bg-[#0D1424] border border-slate-200 dark:border-slate-800 rounded-3xl p-8 max-w-sm w-full text-center space-y-4 shadow-sm">
          <div className="flex justify-center">
            <UnitSpotLogo size="md" />
          </div>
          <div className="h-1.5 w-32 mx-auto rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div className="h-full w-1/2 bg-blue-600 dark:bg-cyan-400 rounded-full animate-pulse" />
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Verifying administrator session...
          </p>
        </div>
      </div>
    );
  }

  // Strict Administrator Authentication Gate
  if (!firebaseAuthUser || !currentUser) {
    return (
      <div className="relative min-h-screen bg-[#F6F8FC] dark:bg-[#070B14] text-slate-900 dark:text-slate-100 flex flex-col justify-between p-4 sm:p-8 overflow-x-hidden">
        {/* Ambient radial highlight in dark mode */}
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-x-0 top-0 h-[380px] opacity-0 dark:opacity-100 bg-[radial-gradient(ellipse_75%_55%_at_50%_-10%,rgba(59,130,246,0.22),rgba(139,92,246,0.1)_48%,transparent_80%)]"
        />

        <header className="relative z-10 max-w-5xl w-full mx-auto flex items-center justify-between gap-2">
          <div className="sm:hidden shrink-0">
            <UnitSpotLogo size="sm" />
          </div>
          <div className="hidden sm:block shrink-0">
            <UnitSpotLogo size="md" />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <ThemeToggle />
            <button
              type="button"
              onClick={() => setViewMode('landing')}
              className="min-h-[44px] inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white px-3 sm:px-3.5 py-2 rounded-xl bg-white/80 dark:bg-[#11192C] border border-slate-200 dark:border-slate-700/80 hover:bg-slate-100 dark:hover:bg-[#18233D] transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
              <span className="sm:hidden">Overview</span>
              <span className="hidden sm:inline">Platform Overview</span>
            </button>
          </div>
        </header>

        <main className="relative z-10 max-w-md w-full mx-auto my-8 sm:my-10">
          <div className="bg-white dark:bg-[#0D1424] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl shadow-slate-200/50 dark:shadow-black/40 space-y-6">
            <div className="space-y-2.5">
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>Centralized Administrator Access</span>
              </div>
              <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                Sign in to manage shared finances
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                UnitSpot is operated exclusively by verified group administrators. Sign in with your Google account to manage member directories, stove-tier rates, verified receipts, and audit logs.
              </p>
            </div>

            <ul className="space-y-2 text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-[#131D33]/70 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-cyan-400 shrink-0" />
                <span>Real-time Firebase cloud sync across your devices</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-cyan-400 shrink-0" />
                <span>Members receive updates by email — no passwords needed</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-cyan-400 shrink-0" />
                <span>Whole-integer MWK reconciliation &amp; non-destructive reversals</span>
              </li>
            </ul>

            {authError && (
              <div
                role="alert"
                className="p-3.5 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/70 rounded-xl text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2.5"
              >
                <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <div className="flex-1 leading-relaxed">{authError}</div>
                <button
                  type="button"
                  onClick={clearAuthError}
                  className="min-h-[36px] px-2 text-rose-700 dark:text-rose-300 hover:text-rose-950 dark:hover:text-white font-semibold cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            )}

            <div className="space-y-3">
              <button
                type="button"
                onClick={signInWithGoogle}
                className="w-full min-h-[48px] flex items-center justify-center gap-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white font-bold py-3 px-4 rounded-xl text-sm transition-colors cursor-pointer shadow-sm"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Continue with Google</span>
              </button>

              <p className="text-[11px] text-slate-500 dark:text-slate-400 text-center leading-relaxed">
                Uses a secure Google sign-in popup. Ensure popups are allowed in your browser if the sign-in window does not appear.
              </p>
            </div>
          </div>
        </main>

        <footer className="relative z-10 max-w-5xl w-full mx-auto text-center text-[11px] text-slate-500 dark:text-slate-400">
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

  const navSections = [
    {
      heading: 'Overview',
      items: [{ id: 'dashboard', label: 'Main Dashboard', icon: LayoutDashboard, badge: null }],
    },
    {
      heading: 'Operations',
      items: [
        { id: 'groups', label: 'Groups & Directory', icon: Users, badge: null },
        { id: 'payments', label: 'Payments & Verification', icon: CreditCard, badge: null },
        {
          id: 'commitments',
          label: 'Commitments & Countdowns',
          icon: Clock,
          badge: activeCountdownsCount > 0 ? activeCountdownsCount : null,
        },
        { id: 'expenses', label: 'Expenses & Treasury', icon: Receipt, badge: null },
      ],
    },
    {
      heading: 'Communication & Audit',
      items: [
        {
          id: 'communications',
          label: 'Email Notices & Hub',
          icon: Mail,
          badge: communications.length > 0 ? communications.length : null,
        },
        { id: 'reports', label: 'Financial Reports', icon: FileText, badge: null },
        { id: 'disputes', label: 'Disputes & Inquiries', icon: AlertTriangle, badge: null },
        {
          id: 'notifications',
          label: 'Notification Centre',
          icon: Bell,
          badge: unreadCount > 0 ? unreadCount : null,
        },
        { id: 'settings', label: 'Account & Audit Settings', icon: Settings, badge: null },
      ],
    },
  ];

  const pageMeta = PAGE_METADATA[currentTab] || {
    title: currentTab.replace('_', ' '),
    subtitle: 'UnitSpot financial workspace',
  };

  const selectTab = (tabId: string) => {
    setCurrentTab(tabId);
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#F6F8FC] dark:bg-[#070B14] text-slate-900 dark:text-slate-100 flex flex-col md:flex-row antialiased transition-colors">
      {/* Desktop Left Sidebar */}
      <aside className="no-print hidden md:flex flex-col w-64 bg-white dark:bg-[#0B1120] border-r border-slate-200 dark:border-slate-800/80 p-4 shrink-0 justify-between select-none">
        <div className="space-y-5">
          <div className="flex items-center justify-between gap-2 px-1">
            <button
              type="button"
              onClick={() => selectTab('dashboard')}
              className="text-left cursor-pointer hover:opacity-90 transition-opacity"
            >
              <UnitSpotLogo size="md" />
            </button>
          </div>

          {/* Group Switcher Dropdown */}
          <div className="bg-slate-50 dark:bg-[#11192C] rounded-2xl p-2.5 border border-slate-200 dark:border-slate-800">
            <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 px-1">
              Active Financial Circle
            </div>
            {activeGroups.length === 0 ? (
              <button
                type="button"
                onClick={() => selectTab('groups')}
                className="w-full min-h-[40px] text-left bg-white dark:bg-[#0D1424] border border-dashed border-slate-300 dark:border-slate-700 rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-cyan-400 transition-colors cursor-pointer"
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
                className="w-full min-h-[40px] bg-white dark:bg-[#0D1424] border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-900 dark:text-slate-100 focus:outline-none cursor-pointer"
              >
                {activeGroups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Grouped Navigation Links */}
          <nav className="space-y-4" aria-label="Main navigation">
            {navSections.map((section) => (
              <div key={section.heading} className="space-y-1">
                <div className="px-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  {section.heading}
                </div>
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentTab === item.id;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => selectTab(item.id)}
                      className={`w-full min-h-[40px] flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-slate-900 dark:bg-blue-600 text-white font-bold shadow-xs'
                          : 'text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#131D33]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon
                          className={`w-4 h-4 shrink-0 ${
                            isActive ? 'text-white' : 'text-slate-500 dark:text-slate-400'
                          }`}
                        />
                        <span className="truncate">{item.label}</span>
                      </div>

                      {item.badge !== null && (
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full tabular-nums ${
                            isActive
                              ? 'bg-white/20 text-white'
                              : 'bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>
        </div>

        {/* Sidebar Footer Authenticated Admin Card */}
        <div className="pt-4 mt-4 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
          <button
            type="button"
            onClick={() => selectTab('settings')}
            className="w-full flex items-center gap-2.5 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-[#131D33] transition-colors cursor-pointer text-left"
          >
            {currentUser.avatarUrl ? (
              <img
                src={currentUser.avatarUrl}
                alt={currentUser.name}
                referrerPolicy="no-referrer"
                className="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-slate-700"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-slate-900 dark:bg-blue-600 text-white font-bold flex items-center justify-center text-xs shrink-0">
                {currentUser.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="font-bold text-xs text-slate-900 dark:text-white truncate">
                {currentUser.name}
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 capitalize">
                {currentUser.role.replace('_', ' ')}
              </div>
            </div>
          </button>

          <div className="flex items-center justify-between px-2.5 py-1.5 bg-slate-50 dark:bg-[#11192C] text-slate-700 dark:text-slate-300 rounded-xl text-[11px] font-medium border border-slate-200 dark:border-slate-800">
            <span className="truncate max-w-[120px]">{currentUser.email}</span>
            <button
              type="button"
              onClick={signOut}
              className="text-rose-600 dark:text-rose-400 hover:text-rose-800 dark:hover:text-rose-300 font-semibold cursor-pointer whitespace-nowrap"
            >
              Sign Out
            </button>
          </div>

          <button
            type="button"
            onClick={() => setViewMode('landing')}
            className="w-full min-h-[36px] text-left text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-[11px] font-medium px-2 py-1 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Platform Overview
          </button>
        </div>
      </aside>

      {/* Mobile Top Header */}
      <header className="no-print md:hidden h-14 bg-white/90 dark:bg-[#0B1120]/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-3 flex items-center justify-between sticky top-0 z-40">
        <button
          type="button"
          onClick={() => selectTab('dashboard')}
          className="text-left cursor-pointer"
          aria-label="Go to Main Dashboard"
        >
          <UnitSpotLogo size="sm" />
        </button>

        <div className="flex items-center gap-1">
          <ThemeToggle className="!px-2.5 border-transparent dark:border-transparent bg-transparent dark:bg-transparent" />

          <button
            type="button"
            onClick={() => selectTab('notifications')}
            className="relative min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#131D33] cursor-pointer"
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-emerald-500" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#131D33] cursor-pointer"
            aria-label={isMobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={isMobileMenuOpen}
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Slide-Over Mobile Navigation Drawer */}
      {isMobileMenuOpen && (
        <div
          className="no-print md:hidden fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex justify-end"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsMobileMenuOpen(false);
          }}
        >
          <div className="w-80 max-w-[88vw] h-full bg-white dark:bg-[#0B1120] border-l border-slate-200 dark:border-slate-800 flex flex-col shadow-2xl">
            <div className="px-4 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <UnitSpotLogo size="sm" />
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(false)}
                aria-label="Close navigation menu"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 space-y-5">
              {/* Group Switcher inside mobile drawer */}
              <div className="bg-slate-50 dark:bg-[#11192C] rounded-2xl p-3 border border-slate-200 dark:border-slate-800">
                <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  Active Financial Circle
                </div>
                {activeGroups.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => selectTab('groups')}
                    className="w-full min-h-[44px] text-left bg-white dark:bg-[#0D1424] border border-dashed border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer"
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
                    className="w-full min-h-[44px] bg-white dark:bg-[#0D1424] border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 dark:text-slate-100"
                  >
                    {activeGroups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {navSections.map((section) => (
                <div key={section.heading} className="space-y-1">
                  <div className="px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    {section.heading}
                  </div>
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = currentTab === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => selectTab(item.id)}
                        className={`w-full min-h-[44px] flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold cursor-pointer ${
                          isActive
                            ? 'bg-slate-900 dark:bg-blue-600 text-white'
                            : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#131D33]'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <Icon className="w-4 h-4 shrink-0" />
                          <span>{item.label}</span>
                        </div>
                        {item.badge !== null && (
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full tabular-nums ${
                              isActive
                                ? 'bg-white/20 text-white'
                                : 'bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-200'
                            }`}
                          >
                            {item.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-2 bg-slate-50/70 dark:bg-[#0D1424]">
              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                Signed in as <span className="font-semibold text-slate-800 dark:text-slate-200">{currentUser.email}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setViewMode('landing');
                    setIsMobileMenuOpen(false);
                  }}
                  className="min-h-[44px] px-3 rounded-xl text-xs text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-200/70 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Overview
                </button>
                <button
                  type="button"
                  onClick={signOut}
                  className="min-h-[44px] px-3 rounded-xl text-xs text-rose-600 dark:text-rose-400 font-semibold hover:bg-rose-50 dark:hover:bg-rose-950/50 cursor-pointer"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 pb-20 md:pb-8">
        {/* Desktop Top Header */}
        <div className="no-print hidden md:flex min-h-[64px] border-b border-slate-200/80 dark:border-slate-800/80 bg-white/85 dark:bg-[#0B1120]/85 backdrop-blur-md px-6 lg:px-8 items-center justify-between gap-6 sticky top-0 z-30">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
              <span>{pageMeta.title}</span>
              {currentGroup && (
                <>
                  <span className="text-slate-300 dark:text-slate-600" aria-hidden="true">
                    ·
                  </span>
                  <span className="text-xs font-semibold text-blue-600 dark:text-cyan-400 truncate max-w-[240px]">
                    {currentGroup.name}
                  </span>
                </>
              )}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              {pageMeta.subtitle}
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <ThemeToggle />

            <button
              type="button"
              onClick={() => selectTab('notifications')}
              className="relative min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-[#11192C] hover:bg-slate-50 dark:hover:bg-[#18233D] transition-colors cursor-pointer"
              aria-label="View notifications"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-emerald-500" />
              )}
            </button>

            <button
              type="button"
              onClick={() => handleOpenRecordPayment()}
              className="min-h-[44px] bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 shadow-xs"
            >
              <CreditCard className="w-3.5 h-3.5 text-[#E5B93C] dark:text-white" />
              Record Payment
            </button>
          </div>
        </div>

        {/* Cloud / Action Error Banner */}
        {actionError && (
          <div
            role="alert"
            className="mx-4 sm:mx-6 lg:mx-8 mt-4 p-3.5 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/70 rounded-xl text-xs text-amber-900 dark:text-amber-200 flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0" />
              <span>{actionError}</span>
            </div>
            <button
              type="button"
              onClick={clearActionError}
              className="min-h-[36px] px-2 text-amber-800 dark:text-amber-200 hover:text-amber-950 dark:hover:text-white font-semibold cursor-pointer whitespace-nowrap"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* View Router */}
        <div className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <Suspense fallback={<ViewSkeleton />}>
            {currentTab === 'dashboard' && (
              <MainDashboardView
                onOpenRecordPayment={handleOpenRecordPayment}
                onOpenCreateCommitment={handleOpenCreateCommitment}
                onOpenCreateContribution={() => setIsCreateContributionOpen(true)}
                onOpenRecordExpense={() => setIsRecordExpenseOpen(true)}
                onNavigateTab={(tab) => selectTab(tab)}
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
          </Suspense>
        </div>
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav
        aria-label="Mobile quick navigation"
        className="no-print md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white/95 dark:bg-[#0B1120]/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 px-2 flex items-center justify-around z-40 text-[10px] font-semibold text-slate-500 dark:text-slate-400"
      >
        <button
          type="button"
          onClick={() => selectTab('dashboard')}
          className={`min-h-[44px] min-w-[52px] flex flex-col items-center justify-center gap-0.5 rounded-xl cursor-pointer ${
            currentTab === 'dashboard'
              ? 'text-blue-600 dark:text-cyan-400 font-bold'
              : 'hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <LayoutDashboard className="w-4 h-4" />
          <span>Home</span>
        </button>

        <button
          type="button"
          onClick={() => selectTab('groups')}
          className={`min-h-[44px] min-w-[52px] flex flex-col items-center justify-center gap-0.5 rounded-xl cursor-pointer ${
            currentTab === 'groups'
              ? 'text-blue-600 dark:text-cyan-400 font-bold'
              : 'hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Groups</span>
        </button>

        <button
          type="button"
          onClick={() => handleOpenRecordPayment()}
          className="flex items-center justify-center -mt-4 bg-slate-900 dark:bg-blue-600 text-white w-12 h-12 rounded-2xl shadow-lg border border-slate-700/40 dark:border-blue-400/30 cursor-pointer"
          aria-label="Record payment"
        >
          <CreditCard className="w-5 h-5 text-[#E5B93C] dark:text-white" />
        </button>

        <button
          type="button"
          onClick={() => selectTab('payments')}
          className={`min-h-[44px] min-w-[52px] flex flex-col items-center justify-center gap-0.5 rounded-xl cursor-pointer ${
            currentTab === 'payments'
              ? 'text-blue-600 dark:text-cyan-400 font-bold'
              : 'hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>Ledger</span>
        </button>

        <button
          type="button"
          onClick={() => setIsMobileMenuOpen(true)}
          className="min-h-[44px] min-w-[52px] relative flex flex-col items-center justify-center gap-0.5 rounded-xl hover:text-slate-900 dark:hover:text-white cursor-pointer"
        >
          <MoreHorizontal className="w-4 h-4" />
          <span>More</span>
          {activeCountdownsCount > 0 && (
            <span className="absolute top-2 right-2.5 w-1.5 h-1.5 rounded-full bg-[#D5A52B]" />
          )}
        </button>
      </nav>

      {/* Global Modals (Code-split) */}
      <Suspense fallback={null}>
        {isRecordPaymentOpen && (
          <RecordPaymentModal
            isOpen={isRecordPaymentOpen}
            onClose={() => setIsRecordPaymentOpen(false)}
            defaultAssignmentId={recordPaymentAssignmentId}
          />
        )}

        {isCreateCommitmentOpen && (
          <CreateCommitmentModal
            isOpen={isCreateCommitmentOpen}
            onClose={() => setIsCreateCommitmentOpen(false)}
            defaultAssignmentId={createCommitmentAssignmentId}
          />
        )}

        {isCreateContributionOpen && (
          <CreateContributionModal
            isOpen={isCreateContributionOpen}
            onClose={() => setIsCreateContributionOpen(false)}
          />
        )}

        {isRecordExpenseOpen && (
          <RecordExpenseModal
            isOpen={isRecordExpenseOpen}
            onClose={() => setIsRecordExpenseOpen(false)}
          />
        )}
      </Suspense>
    </div>
  );
}

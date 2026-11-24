import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { useApp } from './context/AppContext';
import { UnitSpotLogo } from './components/brand/UnitSpotLogo';
import { ThemeToggle } from './components/ui/ThemeToggle';
import { ViewSkeleton } from './components/ui/Skeleton';
import { LandingPage } from './components/landing/LandingPage';
import {
  AuthOnboardingCard,
  EmailVerificationGate,
  JoinGroupModal,
} from './components/auth/AuthOnboardingModal';
import { AutoJoinInvite } from './components/auth/AutoJoinInvite';
import {
  canManageGroupRole,
  canVerifyPaymentsRole,
} from './utils/centralizedFinancialAdmin';
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
  ArrowLeft,
  AlertCircle,
  MoreHorizontal,
  KeyRound,
  Cloud,
  CloudOff,
  RefreshCw,
} from 'lucide-react';

// Code-split views & modals for faster initial load
const MainDashboardView = lazy(() =>
  import('./components/dashboard/MainDashboardView').then((m) => ({
    default: m.MainDashboardView,
  }))
);
const MemberDashboardView = lazy(() =>
  import('./components/member/MemberDashboardView').then((m) => ({
    default: m.MemberDashboardView,
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

export default function App() {
  const {
    currentUser,
    authStatus,
    isHydratingAccount,
    isEmailVerified,
    actionError,
    clearActionError,
    currentGroup,
    groups,
    setCurrentGroup,
    notifications,
    commitments,
    communications,
    payments,
    firebaseAuthUser,
    signOut,
    effectiveRole,
    strings,
    syncStatus,
    pendingInviteCode,
  } = useApp();

  const hasInviteUrl =
    typeof window !== 'undefined' &&
    (window.location.search.includes('join=') || window.location.hash.includes('code='));
  const hasAutostart =
    typeof window !== 'undefined' && window.location.search.includes('autostart=1');

  const [viewMode, setViewMode] = useState<'landing' | 'app'>(
    hasInviteUrl || hasAutostart ? 'app' : 'landing'
  );
  const [onboardingIntent, setOnboardingIntent] = useState<'create' | 'join'>(
    hasInviteUrl ? 'join' : 'create'
  );
  const userExitedToLandingRef = useRef(false);

  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState<boolean>(false);

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

  const prevUidRef = useRef<string | null>(null);

  // Reset UI tab and close transient modals/drawers whenever authenticated UID changes or signs out
  useEffect(() => {
    const nextUid = firebaseAuthUser?.uid || null;
    if (prevUidRef.current !== nextUid) {
      prevUidRef.current = nextUid;
      setCurrentTab('dashboard');
      setIsMobileMenuOpen(false);
      setIsJoinModalOpen(false);
      setIsRecordPaymentOpen(false);
      setRecordPaymentAssignmentId(undefined);
      setIsCreateCommitmentOpen(false);
      setCreateCommitmentAssignmentId(undefined);
      setIsCreateContributionOpen(false);
      setIsRecordExpenseOpen(false);
    }
  }, [firebaseAuthUser?.uid]);

  // Auto-enter app once Firebase restores an active session (unless user deliberately returned to landing)
  useEffect(() => {
    if (authStatus === 'authenticated' && firebaseAuthUser && !userExitedToLandingRef.current) {
      setViewMode('app');
    }
  }, [authStatus, firebaseAuthUser]);

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

  const openWorkspaceFromLanding = (intent?: 'create' | 'join') => {
    userExitedToLandingRef.current = false;
    if (intent) setOnboardingIntent(intent);
    setViewMode('app');
  };

  const returnToLanding = () => {
    userExitedToLandingRef.current = true;
    setViewMode('landing');
    setIsMobileMenuOpen(false);
  };

  if (viewMode === 'landing') {
    return <LandingPage onGetStarted={openWorkspaceFromLanding} />;
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
            <div className="h-full w-1/2 bg-blue-600 dark:bg-cyan-400 rounded-full" />
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Checking your UNIT SPOT session...
          </p>
        </div>
      </div>
    );
  }

  // Unified Auth + Create/Join Onboarding Gate
  if (!firebaseAuthUser || !currentUser) {
    return (
      <div className="relative min-h-screen bg-[#F6F8FC] dark:bg-[#070B14] text-slate-900 dark:text-slate-100 flex flex-col justify-between p-4 sm:p-8 overflow-x-hidden">
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
              onClick={returnToLanding}
              className="min-h-[44px] inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white px-3 sm:px-3.5 py-2 rounded-xl bg-white/80 dark:bg-[#11192C] border border-slate-200 dark:border-slate-700/80 hover:bg-slate-100 dark:hover:bg-[#18233D] transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
              <span className="sm:hidden">Overview</span>
              <span className="hidden sm:inline">Platform Overview</span>
            </button>
          </div>
        </header>

        <main className="relative z-10 max-w-md w-full mx-auto my-8 sm:my-10">
          <AuthOnboardingCard initialIntent={onboardingIntent} />
        </main>

        <footer className="relative z-10 max-w-5xl w-full mx-auto text-center text-[11px] text-slate-500 dark:text-slate-400">
          {strings.tagline} · Malawi Kwacha (MWK)
        </footer>
      </div>
    );
  }

  // Email verification gate (matches firestore.rules email_verified == true requirement)
  if (!isEmailVerified) {
    return <EmailVerificationGate />;
  }

  // Wait until UID-scoped Firestore group listeners settle so zero stale UI renders during account switch
  if (isHydratingAccount) {
    return (
      <div className="min-h-screen bg-[#F6F8FC] dark:bg-[#070B14] flex items-center justify-center p-6">
        <div className="bg-white dark:bg-[#0D1424] border border-slate-200 dark:border-slate-800 rounded-3xl p-8 max-w-sm w-full text-center space-y-4 shadow-sm">
          <div className="flex justify-center">
            <UnitSpotLogo size="md" />
          </div>
          <div className="h-1.5 w-32 mx-auto rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div className="h-full w-2/3 bg-blue-600 dark:bg-cyan-400 rounded-full" />
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Loading your private UNIT SPOT workspace...
          </p>
        </div>
      </div>
    );
  }

  const isGroupAdmin = canManageGroupRole(effectiveRole);
  const isVerifier = canVerifyPaymentsRole(effectiveRole);

  // Unread notifications & pending proof counts
  const unreadCount = notifications.filter(
    (n) => !n.read && (n.userId === currentUser.id || !n.userId)
  ).length;
  const activeCountdownsCount = commitments.filter((c) => c.currentOutstandingAmount > 0).length;
  const pendingVerificationCount = currentGroup
    ? payments.filter(
        (p) =>
          p.groupId === currentGroup.id &&
          (p.verificationStatus === 'pending_verification' ||
            p.verificationStatus === 'submitted')
      ).length
    : 0;

  const handleOpenRecordPayment = (assignmentId?: string) => {
    setRecordPaymentAssignmentId(assignmentId);
    setIsRecordPaymentOpen(true);
  };

  const handleOpenCreateCommitment = (assignmentId?: string) => {
    setCreateCommitmentAssignmentId(assignmentId);
    setIsCreateCommitmentOpen(true);
  };

  const navSections = isVerifier
    ? [
        {
          heading: 'Overview',
          items: [{ id: 'dashboard', label: strings.nav.home, icon: LayoutDashboard, badge: null }],
        },
        {
          heading: 'Group Operations',
          items: [
            { id: 'groups', label: strings.nav.groupMembers, icon: Users, badge: null },
            {
              id: 'payments',
              label: strings.nav.checkPayments,
              icon: CreditCard,
              badge: pendingVerificationCount > 0 ? pendingVerificationCount : null,
            },
            {
              id: 'commitments',
              label: strings.nav.promisesDueDates,
              icon: Clock,
              badge: activeCountdownsCount > 0 ? activeCountdownsCount : null,
            },
            { id: 'expenses', label: strings.nav.groupExpenses, icon: Receipt, badge: null },
          ],
        },
        {
          heading: 'Notices & Reports',
          items: [
            {
              id: 'communications',
              label: strings.nav.sendReminders,
              icon: Mail,
              badge: communications.length > 0 ? communications.length : null,
            },
            { id: 'reports', label: strings.nav.moneyReports, icon: FileText, badge: null },
            { id: 'disputes', label: strings.nav.questionsIssues, icon: AlertTriangle, badge: null },
            {
              id: 'notifications',
              label: strings.nav.notifications,
              icon: Bell,
              badge: unreadCount > 0 ? unreadCount : null,
            },
            { id: 'settings', label: strings.nav.settings, icon: Settings, badge: null },
          ],
        },
      ]
    : [
        {
          heading: 'Member Workspace',
          items: [
            { id: 'dashboard', label: strings.nav.home, icon: LayoutDashboard, badge: null },
            { id: 'groups', label: strings.nav.myGroups, icon: Users, badge: null },
            { id: 'payments', label: strings.nav.myPayments, icon: CreditCard, badge: null },
            {
              id: 'notifications',
              label: strings.nav.notifications,
              icon: Bell,
              badge: unreadCount > 0 ? unreadCount : null,
            },
            { id: 'settings', label: strings.nav.settings, icon: Settings, badge: null },
          ],
        },
      ];

  const pageMeta: Record<string, { title: string; subtitle: string }> = {
    dashboard: {
      title: isVerifier ? strings.nav.home : 'My Group Money',
      subtitle: isVerifier
        ? 'Collection progress, member balances, and verified treasury pulse'
        : 'What you owe, what is verified, and group spending transparency',
    },
    groups: {
      title: isVerifier ? strings.nav.groupMembers : strings.nav.myGroups,
      subtitle: isVerifier
        ? 'Manage members, invite links, join requests, and group settings'
        : 'Your active groups and member directory',
    },
    payments: {
      title: isVerifier ? strings.nav.checkPayments : strings.nav.myPayments,
      subtitle: isVerifier
        ? 'Check member receipts, verify inflows, and issue audited reversals'
        : 'Your submitted payment proofs and verified receipts',
    },
    commitments: {
      title: strings.nav.promisesDueDates,
      subtitle: 'Track partial payment promises and upcoming balance deadlines',
    },
    expenses: {
      title: strings.nav.groupExpenses,
      subtitle: 'Track utilities, purchases, and how collected money was spent',
    },
    communications: {
      title: strings.nav.sendReminders,
      subtitle: 'Send private obligation notices, reminders, and announcements',
    },
    reports: {
      title: strings.nav.moneyReports,
      subtitle: 'Generate printable MWK statements and export CSV audit logs',
    },
    disputes: {
      title: strings.nav.questionsIssues,
      subtitle: 'Ask a question or report a balance mistake transparently',
    },
    notifications: {
      title: strings.nav.notifications,
      subtitle: 'System alerts, upcoming deadlines, and activity feed',
    },
    settings: {
      title: strings.nav.settings,
      subtitle: isGroupAdmin
        ? 'Profile, language preferences, data integrity, and audit log'
        : 'Your contact profile, language, and account preferences',
    },
  };

  const activePageMeta = pageMeta[currentTab] || {
    title: currentTab.replace('_', ' '),
    subtitle: 'UNIT SPOT financial workspace',
  };

  const selectTab = (tabId: string) => {
    setCurrentTab(tabId);
    setIsMobileMenuOpen(false);
  };

  const renderSyncLabel = () => {
    if (syncStatus === 'syncing') {
      return (
        <span className="inline-flex items-center gap-1.5 text-[11px] text-blue-600 dark:text-cyan-400 font-medium">
          <RefreshCw className="w-3 h-3 animate-spin" />
          {strings.sync.syncing}
        </span>
      );
    }
    if (syncStatus === 'offline_queued') {
      return (
        <span className="inline-flex items-center gap-1.5 text-[11px] text-amber-700 dark:text-amber-400 font-medium">
          <CloudOff className="w-3 h-3" />
          {strings.sync.offlineQueued}
        </span>
      );
    }
    if (syncStatus === 'error') {
      return (
        <span className="inline-flex items-center gap-1.5 text-[11px] text-rose-700 dark:text-rose-400 font-medium">
          <AlertCircle className="w-3 h-3" />
          {strings.sync.error}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
        <Cloud className="w-3 h-3" />
        {strings.sync.synced}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-[#F6F8FC] dark:bg-[#070B14] text-slate-900 dark:text-slate-100 flex flex-col md:flex-row antialiased transition-colors">
      {/* Finish invite links automatically once a verified session exists. */}
      {pendingInviteCode && (
        <AutoJoinInvite onError={() => setIsJoinModalOpen(true)} />
      )}

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

          {/* Group Switcher + Join Code Action */}
          <div className="bg-slate-50 dark:bg-[#11192C] rounded-2xl p-2.5 border border-slate-200 dark:border-slate-800 space-y-2">
            <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400 px-1">
              Active Group
            </div>
            {activeGroups.length === 0 ? (
              <button
                type="button"
                onClick={() => selectTab('groups')}
                className="w-full min-h-[40px] text-left bg-white dark:bg-[#0D1424] border border-dashed border-slate-300 dark:border-slate-700 rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-cyan-400 transition-colors cursor-pointer"
              >
                + {strings.plain.createGroup}
              </button>
            ) : (
              <select
                value={currentGroup?.id || ''}
                onChange={(e) => {
                  const found = activeGroups.find((g) => g.id === e.target.value);
                  if (found) setCurrentGroup(found);
                }}
                aria-label="Select active group"
                className="w-full min-h-[40px] bg-white dark:bg-[#0D1424] border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-900 dark:text-slate-100 focus:outline-none cursor-pointer"
              >
                {activeGroups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            )}

            <button
              type="button"
              onClick={() => setIsJoinModalOpen(true)}
              className="w-full min-h-[36px] flex items-center justify-center gap-1.5 text-[11px] font-semibold text-blue-700 dark:text-cyan-400 hover:bg-blue-50 dark:hover:bg-[#18233D] rounded-lg px-2 py-1 transition-colors cursor-pointer"
            >
              <KeyRound className="w-3 h-3 shrink-0" />
              <span>Join with Invite Code</span>
            </button>
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
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md tabular-nums ${
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

        {/* Sidebar Footer Authenticated User Card + Sync Status */}
        <div className="pt-4 mt-4 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
          <div className="px-2">{renderSyncLabel()}</div>

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
                {effectiveRole.replace('_', ' ')}
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
            onClick={returnToLanding}
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
          aria-label="Go to Home"
        >
          <UnitSpotLogo size="sm" />
        </button>

        <div className="flex items-center gap-1">
          <ThemeToggle className="!px-2.5 border-transparent dark:border-transparent bg-transparent dark:bg-transparent" />

          <button
            type="button"
            onClick={() => selectTab('notifications')}
            className="relative min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#131D33] cursor-pointer"
            aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : 'Notifications'}
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="ml-0.5 text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">
                {unreadCount}
              </span>
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
              <div className="bg-slate-50 dark:bg-[#11192C] rounded-2xl p-3 border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400">
                  Active Group
                </div>
                {activeGroups.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => selectTab('groups')}
                    className="w-full min-h-[44px] text-left bg-white dark:bg-[#0D1424] border border-dashed border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer"
                  >
                    + {strings.plain.createGroup}
                  </button>
                ) : (
                  <select
                    value={currentGroup?.id || ''}
                    onChange={(e) => {
                      const found = activeGroups.find((g) => g.id === e.target.value);
                      if (found) setCurrentGroup(found);
                    }}
                    aria-label="Select active group"
                    className="w-full min-h-[44px] bg-white dark:bg-[#0D1424] border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 dark:text-slate-100"
                  >
                    {activeGroups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    setIsJoinModalOpen(true);
                  }}
                  className="w-full min-h-[40px] flex items-center justify-center gap-1.5 text-xs font-semibold text-blue-700 dark:text-cyan-400 hover:bg-blue-50 dark:hover:bg-[#18233D] rounded-xl px-3 py-1.5 cursor-pointer"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Join with Invite Code</span>
                </button>
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
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-md tabular-nums ${
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
              <div className="flex items-center justify-between gap-2">
                {renderSyncLabel()}
                <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">
                  {effectiveRole.replace('_', ' ')}
                </span>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                Signed in as{' '}
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {currentUser.email}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={returnToLanding}
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
              <span>{activePageMeta.title}</span>
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
              {activePageMeta.subtitle}
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <ThemeToggle />

            <button
              type="button"
              onClick={() => selectTab('notifications')}
              className="relative min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-[#11192C] hover:bg-slate-50 dark:hover:bg-[#18233D] transition-colors cursor-pointer px-2.5 gap-1"
              aria-label={unreadCount > 0 ? `View notifications (${unreadCount} unread)` : 'View notifications'}
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="text-[11px] font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {unreadCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => handleOpenRecordPayment()}
              className="min-h-[44px] bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 shadow-xs"
            >
              <CreditCard className="w-3.5 h-3.5 text-[#E5B93C] dark:text-white" />
              <span>{isVerifier ? 'Record Payment' : strings.plain.submitPaymentProof}</span>
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
            {currentTab === 'dashboard' &&
              (isVerifier ? (
                <MainDashboardView
                  onOpenRecordPayment={handleOpenRecordPayment}
                  onOpenCreateCommitment={handleOpenCreateCommitment}
                  onOpenCreateContribution={() => setIsCreateContributionOpen(true)}
                  onOpenRecordExpense={() => setIsRecordExpenseOpen(true)}
                  onNavigateTab={(tab) => selectTab(tab)}
                />
              ) : (
                <MemberDashboardView
                  onOpenRecordPayment={handleOpenRecordPayment}
                  onOpenJoinGroup={() => setIsJoinModalOpen(true)}
                  onNavigateTab={(tab) => selectTab(tab)}
                />
              ))}

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

            {currentTab === 'groups' && (
              <GroupManagementView
                onOpenJoinGroup={() => setIsJoinModalOpen(true)}
                onNavigateDashboard={() => selectTab('dashboard')}
              />
            )}

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
          <span>{strings.nav.home}</span>
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
          aria-label={isVerifier ? 'Record payment' : strings.plain.submitPaymentProof}
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
          <span>{isVerifier ? 'Payments' : 'Receipts'}</span>
        </button>

        <button
          type="button"
          onClick={() => setIsMobileMenuOpen(true)}
          className="min-h-[44px] min-w-[52px] relative flex flex-col items-center justify-center gap-0.5 rounded-xl hover:text-slate-900 dark:hover:text-white cursor-pointer"
        >
          <MoreHorizontal className="w-4 h-4" />
          <span>More</span>
        </button>
      </nav>

      {/* Global Modals (Code-split + Join Modal) */}
      <JoinGroupModal
        isOpen={isJoinModalOpen}
        onClose={() => setIsJoinModalOpen(false)}
        defaultCode={pendingInviteCode}
      />

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

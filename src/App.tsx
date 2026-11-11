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
  Plus, 
  Menu, 
  X,
  ChevronDown,
  Cloud,
  CheckCircle2,
  LogIn
} from 'lucide-react';

export default function App() {
  const { 
    currentUser, 
    currentGroup, 
    groups, 
    setCurrentGroup, 
    notifications, 
    commitments,
    firebaseAuthUser,
    signInWithGoogle,
    signOut,
    isFirebaseReady
  } = useApp();

  // Mode: landing page vs application
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

  // Unread notifications count
  const unreadCount = notifications.filter(n => !n.read && (n.userId === currentUser.id || !n.userId)).length;
  // Active countdowns count
  const activeCountdownsCount = commitments.filter(c => c.currentOutstandingAmount > 0).length;

  if (viewMode === 'landing') {
    return <LandingPage onGetStarted={() => setViewMode('app')} />;
  }

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
    { id: 'commitments', label: 'Commitments & Countdowns', icon: Clock, badge: activeCountdownsCount > 0 ? activeCountdownsCount : null },
    { id: 'payments', label: 'Payments & Verification', icon: CreditCard },
    { id: 'expenses', label: 'Expenses & Treasury', icon: Receipt },
    { id: 'groups', label: 'Groups & Directory', icon: Users },
    { id: 'reports', label: 'Financial Reports', icon: FileText },
    { id: 'disputes', label: 'Disputes & Inquiries', icon: AlertTriangle },
    { id: 'notifications', label: 'Notification Centre', icon: Bell, badge: unreadCount > 0 ? unreadCount : null },
    { id: 'settings', label: 'Account & Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-[#FDFDFD] text-neutral-900 flex flex-col md:flex-row antialiased">
      {/* Desktop Left Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-neutral-200/80 p-5 shrink-0 justify-between select-none">
        <div className="space-y-6">
          {/* Logo & Brand */}
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
            <div className="text-[10px] uppercase font-bold tracking-wider text-neutral-400 mb-1 px-1">
              Active Financial Circle
            </div>
            {groups.length === 0 ? (
              <button
                onClick={() => setCurrentTab('groups')}
                className="w-full text-left bg-white border border-dashed border-neutral-300 rounded-xl px-2.5 py-1.5 text-xs text-neutral-500 hover:text-neutral-900 transition-colors"
              >
                + Create First Group
              </button>
            ) : (
              <select
                value={currentGroup?.id || ''}
                onChange={(e) => {
                  const found = groups.find(g => g.id === e.target.value);
                  if (found) setCurrentGroup(found);
                }}
                className="w-full bg-white border border-neutral-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-neutral-900 focus:outline-none cursor-pointer"
              >
                {groups.map(g => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Primary Navigation Links */}
          <nav className="space-y-1">
            {navItems.map(item => {
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
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-neutral-500'}`} />
                    <span>{item.label}</span>
                  </div>

                  {item.badge && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      isActive 
                        ? 'bg-white text-neutral-900' 
                        : 'bg-neutral-200 text-neutral-800'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer User Card */}
        <div className="pt-4 border-t border-neutral-100 space-y-3">
          <div 
            onClick={() => setCurrentTab('settings')}
            className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-neutral-100 transition-colors cursor-pointer"
          >
            {currentUser.avatarUrl ? (
              <img src={currentUser.avatarUrl} alt={currentUser.name} className="w-8 h-8 rounded-full object-cover border border-neutral-200" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-neutral-200 font-bold flex items-center justify-center text-xs">
                {currentUser.name.charAt(0)}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="font-bold text-xs text-neutral-900 truncate">{currentUser.name}</div>
              <div className="text-[10px] text-neutral-400 capitalize">{currentUser.role.replace('_', ' ')}</div>
            </div>
          </div>

          {!firebaseAuthUser ? (
            <button
              onClick={signInWithGoogle}
              className="w-full flex items-center justify-center gap-2 bg-neutral-900 hover:bg-black text-white text-xs font-semibold py-2 px-3 rounded-xl transition-colors shadow-2xs cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Connect Google Account</span>
            </button>
          ) : (
            <div className="flex items-center justify-between px-2 py-1 bg-emerald-50 text-emerald-800 rounded-lg text-[10px] font-semibold border border-emerald-200">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Firebase Cloud Live
              </span>
              <button 
                onClick={signOut} 
                className="text-neutral-500 hover:text-red-600 cursor-pointer"
              >
                Logout
              </button>
            </div>
          )}

          <button
            onClick={() => setViewMode('landing')}
            className="w-full text-left text-neutral-400 hover:text-neutral-700 text-[11px] font-medium px-2 py-1 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Switch to Public Website
          </button>
        </div>
      </aside>

      {/* Mobile Top Header */}
      <header className="md:hidden bg-white border-b border-neutral-200 p-3.5 flex items-center justify-between sticky top-0 z-40">
        <KlarencyLogo size="sm" />

        <div className="flex items-center gap-2">
          {firebaseAuthUser ? (
            <button 
              onClick={() => setCurrentTab('settings')}
              className="w-7 h-7 rounded-full overflow-hidden border border-neutral-200 cursor-pointer flex items-center justify-center"
              title={firebaseAuthUser.email || ''}
            >
              {firebaseAuthUser.photoURL ? (
                <img src={firebaseAuthUser.photoURL} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-neutral-900 text-white text-[10px] flex items-center justify-center font-bold">
                  {(firebaseAuthUser.displayName || firebaseAuthUser.email || 'U').charAt(0).toUpperCase()}
                </div>
              )}
            </button>
          ) : (
            <button
              onClick={signInWithGoogle}
              className="flex items-center gap-1 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 text-neutral-800 px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer transition-colors"
            >
              <LogIn className="w-3 h-3 text-neutral-600" />
              <span>Sign In</span>
            </button>
          )}

          <button
            onClick={() => setCurrentTab('notifications')}
            className="relative p-1.5 text-neutral-600 hover:text-neutral-900"
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#16A34A]" />
            )}
          </button>

          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-1.5 text-neutral-600 hover:text-neutral-900"
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
              <div className="font-bold text-xs text-neutral-900">{currentGroup ? currentGroup.name : 'No group active'}</div>
            </div>
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-medium border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Cloud Ready</span>
            </div>
          </div>
          {navItems.map(item => (
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
                <span className="bg-neutral-200 text-neutral-900 text-[10px] px-2 py-0.5 rounded-full">
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
              className="text-xs text-neutral-500 font-medium py-1"
            >
              View Landing Page
            </button>
            {firebaseAuthUser ? (
              <button
                onClick={signOut}
                className="text-xs text-red-600 font-semibold py-1"
              >
                Sign Out
              </button>
            ) : (
              <button
                onClick={signInWithGoogle}
                className="text-xs text-neutral-900 font-bold py-1 flex items-center gap-1"
              >
                <LogIn className="w-3.5 h-3.5" />
                Sign in with Google
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 pb-16 md:pb-6">
        {/* Top bar on desktop */}
        <div className="hidden md:flex h-14 border-b border-neutral-200/80 bg-white/70 backdrop-blur-md px-8 items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs text-neutral-500">
              <span className="font-semibold text-neutral-800">UnitSpot MWK</span>
              <span>/</span>
              <span className="font-semibold text-neutral-900 capitalize">{currentTab.replace('_', ' ')}</span>
            </div>

            <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-medium select-none">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Firestore Cloud Sync</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Google Auth Status / Button */}
            {firebaseAuthUser ? (
              <div className="flex items-center gap-2 bg-neutral-50 border border-neutral-200 rounded-xl px-2.5 py-1">
                {firebaseAuthUser.photoURL ? (
                  <img src={firebaseAuthUser.photoURL} alt="" className="w-5 h-5 rounded-full object-cover" />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-neutral-900 text-white text-[10px] flex items-center justify-center font-bold">
                    {(firebaseAuthUser.displayName || firebaseAuthUser.email || 'U').charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="text-xs font-semibold text-neutral-800 max-w-[140px] truncate">
                  {firebaseAuthUser.displayName || firebaseAuthUser.email}
                </span>
                <button
                  onClick={signOut}
                  className="text-[10px] text-neutral-500 hover:text-red-600 font-semibold px-1 py-0.5 rounded transition-colors ml-1 cursor-pointer"
                  title="Sign Out"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <button
                onClick={signInWithGoogle}
                className="flex items-center gap-2 bg-white hover:bg-neutral-50 text-neutral-800 border border-neutral-200 px-3 py-1.5 rounded-xl text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                title="Sign in with your Google account to sync data across devices"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>Sign in with Google</span>
              </button>
            )}

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
              className="bg-neutral-900 hover:bg-black text-white text-xs font-bold px-3 py-1.5 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
            >
              <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
              Pay
            </button>
          </div>
        </div>

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

          {currentTab === 'commitments' && (
            <CommitmentCenterView
              onOpenCreateCommitment={handleOpenCreateCommitment}
              onOpenRecordPayment={handleOpenRecordPayment}
            />
          )}

          {currentTab === 'payments' && (
            <PaymentHistoryAndVerificationView
              onOpenRecordModal={handleOpenRecordPayment}
            />
          )}

          {currentTab === 'expenses' && (
            <ExpenseManagementView
              onOpenRecordExpense={() => setIsRecordExpenseOpen(true)}
            />
          )}

          {currentTab === 'groups' && (
            <GroupManagementView />
          )}

          {currentTab === 'reports' && (
            <FinancialReportingView />
          )}

          {currentTab === 'disputes' && (
            <DisputeManagementView />
          )}

          {currentTab === 'notifications' && (
            <NotificationsCenterView />
          )}

          {currentTab === 'settings' && (
            <UserSettingsAndProfileView />
          )}
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
          className="flex flex-col items-center justify-center -mt-4 bg-neutral-900 text-white w-10 h-10 rounded-full shadow-lg"
          aria-label="Pay now"
        >
          <CreditCard className="w-5 h-5 text-emerald-400" />
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
          <span>Profile</span>
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

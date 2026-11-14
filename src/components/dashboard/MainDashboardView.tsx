import React from 'react';
import { useApp } from '../../context/AppContext';
import {
  formatMWK,
  formatSignedMWK,
  computeGroupFinancialSummary,
  calculateVerifiedPaidForAssignment,
  calculateOutstandingBalance,
} from '../../utils/financialCalculations';
import {
  resolveMemberInfo,
  STOVE_TYPE_LABELS,
  isValidStoveType,
} from '../../utils/financialConfig';
import { canUserVerifyPayments } from '../../utils/centralizedFinancialAdmin';
import {
  Clock,
  CheckCircle2,
  CreditCard,
  Plus,
  ChevronRight,
  ShieldCheck,
  Building2,
  AlertTriangle,
  Users,
  FileSpreadsheet,
  ArrowRight,
} from 'lucide-react';
import { CommitmentCard } from '../commitments/CommitmentCard';

export const MainDashboardView: React.FC<{
  onOpenRecordPayment: (assignmentId?: string) => void;
  onOpenCreateCommitment: (assignmentId?: string) => void;
  onOpenCreateContribution: () => void;
  onOpenRecordExpense: () => void;
  onNavigateTab: (tab: string) => void;
}> = ({
  onOpenRecordPayment,
  onOpenCreateCommitment,
  onOpenCreateContribution,
  onNavigateTab,
}) => {
  const {
    currentGroup,
    contributions,
    assignments,
    payments,
    commitments,
    expenses,
    groupMembers,
    users,
    auditLogs,
    currentUser,
    integrityReport,
    approveCommitmentExtension,
  } = useApp();

  if (!currentGroup) {
    return (
      <div className="space-y-6">
        <div className="bg-white dark:bg-[#0D1424] rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-12 text-center max-w-2xl mx-auto shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-slate-900 dark:bg-[#131D33] border border-slate-800 dark:border-slate-700 text-white flex items-center justify-center mx-auto mb-4 shadow-sm">
            <Building2 className="w-7 h-7 text-[#E5B93C]" />
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Welcome to UnitSpot
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 leading-relaxed max-w-lg mx-auto">
            Your financial accountability workspace is ready. Create your first shared accommodation or group fund to begin tracking contributions in Malawi Kwacha (MWK).
          </p>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#11192C] border border-slate-200/80 dark:border-slate-800">
              <div className="text-[11px] font-bold font-mono text-blue-600 dark:text-cyan-400">
                Step 1
              </div>
              <div className="text-xs font-bold text-slate-900 dark:text-white mt-0.5">
                Create a Circle
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Name your hostel, flat, or community fund.
              </p>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#11192C] border border-slate-200/80 dark:border-slate-800">
              <div className="text-[11px] font-bold font-mono text-blue-600 dark:text-cyan-400">
                Step 2
              </div>
              <div className="text-xs font-bold text-slate-900 dark:text-white mt-0.5">
                Enroll Members
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Assign electric or non-electric stove tiers.
              </p>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#11192C] border border-slate-200/80 dark:border-slate-800">
              <div className="text-[11px] font-bold font-mono text-blue-600 dark:text-cyan-400">
                Step 3
              </div>
              <div className="text-xs font-bold text-slate-900 dark:text-white mt-0.5">
                Track &amp; Reconcile
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Verify receipts, promises, and expenses.
              </p>
            </div>
          </div>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => onNavigateTab('groups')}
              className="w-full sm:w-auto min-h-[44px] bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white text-xs font-bold px-6 py-3 rounded-xl transition-colors shadow-xs cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap"
            >
              <Plus className="w-4 h-4 text-[#E5B93C] dark:text-white" />
              <span>Create First Financial Group</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab('settings')}
              className="w-full sm:w-auto min-h-[44px] bg-slate-100 hover:bg-slate-200 dark:bg-[#131D33] dark:hover:bg-[#1A2744] text-slate-800 dark:text-slate-200 text-xs font-semibold px-5 py-3 rounded-xl border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer whitespace-nowrap"
            >
              Configure Account
            </button>
          </div>
        </div>
      </div>
    );
  }

  const activeGroupMembers = groupMembers.filter(
    (m) => m.groupId === currentGroup.id && m.status === 'active'
  );
  const groupContributions = contributions.filter((c) => c.groupId === currentGroup.id);
  const groupAssignments = assignments.filter((a) => a.groupId === currentGroup.id);
  const groupPayments = payments.filter((p) => p.groupId === currentGroup.id);
  const groupExpenses = expenses.filter((e) => e.groupId === currentGroup.id);
  const groupCommitments = commitments.filter((c) => c.groupId === currentGroup.id);
  const groupAuditLogs = auditLogs.filter((l) => !l.groupId || l.groupId === currentGroup.id);

  const approvedExpensesTotal = groupExpenses
    .filter((e) => e.status === 'approved')
    .reduce((sum, e) => sum + e.amount, 0);

  const summary = computeGroupFinancialSummary(
    groupAssignments,
    groupPayments,
    approvedExpensesTotal
  );

  const collectionPct =
    summary.totalExpected > 0
      ? Math.min(100, Math.round((summary.totalVerified / summary.totalExpected) * 100))
      : 0;

  const activeCommitments = groupCommitments.filter((c) => c.currentOutstandingAmount > 0);
  const canManage = canUserVerifyPayments(currentUser?.role);

  const membersNeedingStoveReview = activeGroupMembers.filter(
    (m) => !isValidStoveType(m.stoveType)
  );

  // Guided onboarding checklist for groups still being set up
  const hasMembers = activeGroupMembers.length > 0;
  const hasContributions = groupContributions.length > 0;
  const hasPayments = groupPayments.length > 0;
  const showSetupChecklist = !hasMembers || !hasContributions || !hasPayments;

  const setupSteps = [
    {
      id: 'group',
      done: true,
      label: 'Create Group',
      detail: currentGroup.name,
      actionLabel: 'Manage',
      onClick: () => onNavigateTab('groups'),
      icon: Building2,
    },
    {
      id: 'members',
      done: hasMembers,
      label: 'Enroll Members',
      detail: hasMembers
        ? `${activeGroupMembers.length} active member(s)`
        : 'Add residents & stove tiers',
      actionLabel: hasMembers ? 'Directory' : 'Add Member',
      onClick: () => onNavigateTab('groups'),
      icon: Users,
    },
    {
      id: 'contribution',
      done: hasContributions,
      label: 'Assign Contribution',
      detail: hasContributions
        ? `${groupContributions.length} cycle(s) created`
        : 'Create your first bill cycle',
      actionLabel: hasContributions ? 'New Cycle' : 'Create Now',
      onClick: onOpenCreateContribution,
      icon: FileSpreadsheet,
    },
    {
      id: 'payment',
      done: hasPayments,
      label: 'Record Payment',
      detail: hasPayments
        ? `${groupPayments.length} payment(s) logged`
        : 'Log cash or mobile receipt',
      actionLabel: 'Record',
      onClick: () =>
        hasContributions ? onOpenRecordPayment() : onOpenCreateContribution(),
      icon: CreditCard,
    },
  ];

  const completedSetupCount = setupSteps.filter((s) => s.done).length;

  return (
    <div className="space-y-6">
      {/* Integrity / Classification Alert Banner */}
      {(membersNeedingStoveReview.length > 0 ||
        (integrityReport &&
          (integrityReport.repairedCount > 0 || integrityReport.flaggedCount > 0))) && (
        <div className="bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/70 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-950 dark:text-amber-100">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">
                {membersNeedingStoveReview.length > 0
                  ? `${membersNeedingStoveReview.length} active member(s) require stove classification (MK 10,000 Electric vs MK 5,000 Non-Electric).`
                  : `Data Integrity Scan: ${integrityReport?.repairedCount || 0} normalized, ${integrityReport?.flaggedCount || 0} flagged for review.`}
              </p>
              <p className="text-amber-800 dark:text-amber-300 mt-0.5">
                Historical financial records are preserved untouched until reviewed by an administrator.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {membersNeedingStoveReview.length > 0 && (
              <button
                type="button"
                onClick={() => onNavigateTab('groups')}
                className="min-h-[40px] px-3.5 py-2 rounded-xl bg-amber-900 hover:bg-amber-950 text-white font-semibold cursor-pointer whitespace-nowrap"
              >
                Classify in Directory
              </button>
            )}
            <button
              type="button"
              onClick={() => onNavigateTab('settings')}
              className="min-h-[40px] px-3.5 py-2 rounded-xl bg-white dark:bg-[#131D33] border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 font-semibold hover:bg-amber-100 dark:hover:bg-[#1A2744] cursor-pointer whitespace-nowrap"
            >
              Review Audit &amp; Integrity
            </button>
          </div>
        </div>
      )}

      {/* Top Welcome / Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div>
          <div className="flex items-center gap-2 text-xs">
            <span className="uppercase tracking-widest font-extrabold text-[#B68915] dark:text-[#E5B93C]">
              Financial Ledger
            </span>
            <span className="text-slate-300 dark:text-slate-600" aria-hidden="true">
              ·
            </span>
            <span className="font-semibold text-slate-500 dark:text-slate-400">
              {currentGroup.name}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-0.5">
            Overview &amp; Clear Balances
          </h1>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {groupAssignments.length > 0 && (
            <button
              type="button"
              onClick={() => onOpenRecordPayment()}
              className="min-h-[44px] inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition-colors shadow-xs cursor-pointer whitespace-nowrap"
            >
              <CreditCard className="w-3.5 h-3.5 text-emerald-400 dark:text-white" />
              <span>Record Payment</span>
            </button>
          )}

          {groupAssignments.length > 0 && (
            <button
              type="button"
              onClick={() => onOpenCreateCommitment()}
              className="min-h-[44px] inline-flex items-center gap-1.5 bg-white hover:bg-slate-50 dark:bg-[#11192C] dark:hover:bg-[#18233D] text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700/80 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
            >
              <Clock className="w-3.5 h-3.5 text-[#D5A52B]" />
              <span>New Commitment</span>
            </button>
          )}

          <button
            type="button"
            onClick={onOpenCreateContribution}
            className="min-h-[44px] inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 dark:bg-[#131D33] dark:hover:bg-[#1A2744] dark:border dark:border-slate-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-colors shadow-xs cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5 text-[#E5B93C]" />
            <span>New Contribution</span>
          </button>
        </div>
      </div>

      {/* Guided Onboarding Quick-Start Checklist (shown until group has members, contribution & payment) */}
      {showSetupChecklist && (
        <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-blue-200/80 dark:border-blue-800/50 p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
                Workspace Quick-Start Guide
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Complete these 4 steps to get {currentGroup.name} tracking MWK balances smoothly.
              </p>
            </div>
            <span className="text-xs font-bold font-mono text-blue-600 dark:text-cyan-400 tabular-nums whitespace-nowrap">
              {completedSetupCount} of {setupSteps.length} complete
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {setupSteps.map((step, idx) => {
              const Icon = step.icon;
              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={step.onClick}
                  className={`text-left p-3.5 rounded-xl border transition-colors cursor-pointer flex flex-col justify-between gap-2.5 ${
                    step.done
                      ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/50'
                      : 'bg-slate-50 dark:bg-[#11192C] border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-cyan-500/60'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                      <Icon className="w-3.5 h-3.5" />
                      Step {idx + 1}
                    </span>
                    {step.done ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    ) : (
                      <ArrowRight className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400 shrink-0" />
                    )}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">
                      {step.label}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                      {step.detail}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Primary Financial Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 tabular-nums">
        <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Total Expected
          </span>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1 tracking-tight font-mono">
            {formatMWK(summary.totalExpected)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
            {groupAssignments.length} assigned obligations
          </div>
        </div>

        <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
            Verified Inflow
          </span>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1 tracking-tight font-mono">
            {formatMWK(summary.totalVerified)}
          </div>
          <div className="mt-2 space-y-1.5">
            <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-emerald-600 dark:bg-emerald-400 transition-all duration-300"
                style={{ width: `${collectionPct}%` }}
              />
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>
                {collectionPct}% collected
                {summary.totalOverpaid > 0
                  ? ` · +${formatMWK(summary.totalOverpaid)} overpaid`
                  : ''}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400">
            Outstanding Balance
          </span>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1 tracking-tight font-mono">
            {formatMWK(summary.totalOutstanding)}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 mt-2">
            <Clock className="w-3.5 h-3.5 text-[#D5A52B] shrink-0" />
            <span>
              {summary.unpaidCount} unpaid · {summary.partiallyPaidCount} partial
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Remaining Group Funds
          </span>
          <div
            className={`text-2xl font-black mt-1 tracking-tight font-mono ${
              summary.remainingGroupFunds >= 0
                ? 'text-slate-900 dark:text-white'
                : 'text-rose-700 dark:text-rose-400'
            }`}
          >
            {formatSignedMWK(summary.remainingGroupFunds)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
            Approved expenses: {formatMWK(summary.totalExpensesApproved)}
          </div>
        </div>
      </div>

      {/* Active Commitments Spotlight Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h3 className="font-extrabold text-slate-900 dark:text-white text-base sm:text-lg tracking-tight">
              Active Payment Commitments &amp; Countdowns
            </h3>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 tabular-nums">
              · {activeCommitments.length}
            </span>
          </div>

          {activeCommitments.length > 0 && (
            <button
              type="button"
              onClick={() => onNavigateTab('commitments')}
              className="min-h-[40px] px-2.5 text-xs font-semibold text-blue-600 dark:text-cyan-400 hover:underline flex items-center gap-1 cursor-pointer whitespace-nowrap"
            >
              <span>View all</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {activeCommitments.length === 0 ? (
          <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 text-center text-slate-500 dark:text-slate-400 text-xs">
            No active countdowns right now. When members pay partially, record a commitment deadline to track settlement.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeCommitments.slice(0, 3).map((c) => {
              const memberInfo = resolveMemberInfo(c.memberId, groupMembers, users);
              const contribution = contributions.find((cntr) => cntr.id === c.contributionId);

              return (
                <CommitmentCard
                  key={c.id}
                  commitment={c}
                  member={memberInfo}
                  contribution={contribution}
                  canManage={canManage}
                  onRecordPaymentClick={() => onOpenRecordPayment(c.assignmentId)}
                  onApproveExtensionClick={() => approveCommitmentExtension(c.id, true)}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Two Column Layout: Member Balances & Recent Audit Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-[#0D1424] rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
          <div className="p-5 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                Current Obligations &amp; Member Balances
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Verified ledger shares, paid totals, and remaining or overpaid balances
              </p>
            </div>
            {groupAssignments.length > 0 && (
              <button
                type="button"
                onClick={() => onNavigateTab('payments')}
                className="min-h-[40px] px-2.5 text-xs font-semibold text-blue-600 dark:text-cyan-400 hover:underline cursor-pointer whitespace-nowrap"
              >
                See all payments
              </button>
            )}
          </div>

          {groupAssignments.length === 0 ? (
            <div className="p-10 text-center text-xs text-slate-500 dark:text-slate-400">
              <p className="font-semibold text-slate-700 dark:text-slate-300">
                No active obligations assigned yet.
              </p>
              <p className="mt-1 text-slate-400 dark:text-slate-500">
                Click &ldquo;New Contribution&rdquo; above to assign obligations to active group members.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {groupAssignments.map((a) => {
                const member = resolveMemberInfo(a.memberId, groupMembers, users);
                const verifiedPaid = calculateVerifiedPaidForAssignment(a.id, groupPayments);
                const { outstanding, overpaid, completionPercentage } =
                  calculateOutstandingBalance(a.assignedAmount, verifiedPaid);
                const isSettled = outstanding === 0;

                return (
                  <div
                    key={a.id}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 dark:hover:bg-[#11192C]/70 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {member?.avatarUrl ? (
                        <img
                          src={member.avatarUrl}
                          alt={member.name}
                          referrerPolicy="no-referrer"
                          className="w-9 h-9 rounded-full object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-[#131D33] flex items-center justify-center font-bold text-xs text-slate-700 dark:text-slate-200 shrink-0">
                          {member?.name ? member.name.charAt(0) : 'M'}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
                          <span className="truncate">{member?.name || 'Registered Member'}</span>
                          {member && isValidStoveType(member.stoveType) && (
                            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                              · {STOVE_TYPE_LABELS[member.stoveType]}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                          <span>
                            Expected:{' '}
                            <strong className="text-slate-800 dark:text-slate-200">
                              {formatMWK(a.assignedAmount)}
                            </strong>
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>
                            Paid:{' '}
                            <strong className="text-emerald-700 dark:text-emerald-400">
                              {formatMWK(verifiedPaid)}
                            </strong>
                          </span>
                          {overpaid > 0 && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="text-amber-700 dark:text-amber-400 font-semibold">
                                Overpaid: +{formatMWK(overpaid)}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 tabular-nums shrink-0">
                      <div className="text-left sm:text-right">
                        <div className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                          {overpaid > 0 ? 'Overpaid Credit' : 'Remaining'}
                        </div>
                        <div
                          className={`font-black text-sm font-mono ${
                            overpaid > 0
                              ? 'text-amber-700 dark:text-amber-400'
                              : isSettled
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : 'text-slate-900 dark:text-white'
                          }`}
                        >
                          {overpaid > 0 ? `+${formatMWK(overpaid)}` : formatMWK(outstanding)}
                        </div>
                      </div>

                      <div className="w-20 hidden sm:block">
                        <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${
                              isSettled
                                ? 'bg-emerald-600 dark:bg-emerald-400'
                                : 'bg-blue-600 dark:bg-cyan-400'
                            }`}
                            style={{ width: `${completionPercentage}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium block text-right mt-0.5">
                          {completionPercentage}%
                        </span>
                      </div>

                      {!isSettled && (
                        <button
                          type="button"
                          onClick={() => onOpenRecordPayment(a.id)}
                          className="min-h-[40px] bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
                        >
                          Pay
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Audit Trail */}
        <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 dark:border-slate-800">
              <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white text-sm">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Live Financial Audit Trail</span>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('settings')}
                className="min-h-[36px] px-2 text-[11px] font-semibold text-blue-600 dark:text-cyan-400 hover:underline cursor-pointer"
              >
                Full Log
              </button>
            </div>

            <div className="mt-3 space-y-3.5">
              {groupAuditLogs.length === 0 ? (
                <div className="py-8 text-center text-slate-400 dark:text-slate-500 text-xs">
                  No audit logs yet. Actions will appear here automatically.
                </div>
              ) : (
                groupAuditLogs.slice(0, 6).map((log) => (
                  <div
                    key={log.id}
                    className="text-xs border-b border-slate-100 dark:border-slate-800/80 last:border-b-0 pb-2.5 last:pb-0"
                  >
                    <div className="flex items-center justify-between text-slate-400 dark:text-slate-500 text-[10px] mb-0.5">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {log.actorName}
                      </span>
                      <span className="tabular-nums font-mono">
                        {new Date(log.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <p className="text-slate-800 dark:text-slate-200 leading-snug">
                      {log.details}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-slate-200/80 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 text-center">
            Every contribution and transaction is auditable by administrators.
          </div>
        </div>
      </div>
    </div>
  );
};

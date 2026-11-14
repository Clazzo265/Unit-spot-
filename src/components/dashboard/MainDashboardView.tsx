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
        <div className="bg-white rounded-3xl border border-neutral-200 p-8 sm:p-12 text-center max-w-2xl mx-auto shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-neutral-900 text-white flex items-center justify-center mx-auto mb-4 shadow-sm">
            <Building2 className="w-7 h-7 text-[#D5A52B]" />
          </div>
          <h2 className="text-2xl font-extrabold text-neutral-900 tracking-tight">
            Welcome to UnitSpot
          </h2>
          <p className="text-sm text-neutral-600 mt-2 leading-relaxed">
            Your financial accountability workspace is ready. Create your first shared accommodation or group fund to begin tracking contributions in Malawi Kwacha (MWK).
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => onNavigateTab('groups')}
              className="w-full sm:w-auto bg-neutral-900 hover:bg-black text-white text-xs font-bold px-6 py-3 rounded-xl transition-all shadow-xs cursor-pointer flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4 text-[#D5A52B]" />
              <span>Create First Financial Group</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab('settings')}
              className="w-full sm:w-auto bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-semibold px-5 py-3 rounded-xl transition-colors cursor-pointer"
            >
              Configure Account
            </button>
          </div>
        </div>
      </div>
    );
  }

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

  const activeCommitments = groupCommitments.filter((c) => c.currentOutstandingAmount > 0);
  const canManage = canUserVerifyPayments(currentUser?.role);

  const membersNeedingStoveReview = groupMembers.filter(
    (m) =>
      m.groupId === currentGroup.id &&
      m.status === 'active' &&
      !isValidStoveType(m.stoveType)
  );

  return (
    <div className="space-y-6">
      {/* Integrity / Classification Alert Banner */}
      {(membersNeedingStoveReview.length > 0 ||
        (integrityReport &&
          (integrityReport.repairedCount > 0 || integrityReport.flaggedCount > 0))) && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-950">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">
                {membersNeedingStoveReview.length > 0
                  ? `${membersNeedingStoveReview.length} active member(s) require stove classification (MK 10,000 Electric vs MK 5,000 Non-Electric).`
                  : `Data Integrity Scan: ${integrityReport?.repairedCount || 0} normalized, ${integrityReport?.flaggedCount || 0} flagged for review.`}
              </p>
              <p className="text-amber-800 mt-0.5">
                Historical financial records are preserved untouched until reviewed by an administrator.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {membersNeedingStoveReview.length > 0 && (
              <button
                type="button"
                onClick={() => onNavigateTab('groups')}
                className="px-3 py-1.5 rounded-lg bg-amber-900 hover:bg-black text-white font-semibold cursor-pointer whitespace-nowrap"
              >
                Classify in Directory
              </button>
            )}
            <button
              type="button"
              onClick={() => onNavigateTab('settings')}
              className="px-3 py-1.5 rounded-lg bg-white border border-amber-300 text-amber-900 font-semibold hover:bg-amber-100 cursor-pointer whitespace-nowrap"
            >
              Review Audit & Integrity
            </button>
          </div>
        </div>
      )}

      {/* Top Welcome / Group Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div>
          <div className="flex items-center gap-2 text-xs">
            <span className="uppercase tracking-widest font-extrabold text-[#D5A52B]">
              Financial Ledger
            </span>
            <span className="text-neutral-300">•</span>
            <span className="font-semibold text-neutral-500">{currentGroup.name}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-900 tracking-tight mt-0.5">
            Overview & Clear Balances
          </h1>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {groupAssignments.length > 0 && (
            <button
              type="button"
              onClick={() => onOpenRecordPayment()}
              className="inline-flex items-center gap-1.5 bg-neutral-900 hover:bg-black text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer whitespace-nowrap"
            >
              <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
              <span>Record Payment</span>
            </button>
          )}

          {groupAssignments.length > 0 && (
            <button
              type="button"
              onClick={() => onOpenCreateCommitment()}
              className="inline-flex items-center gap-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-900 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
            >
              <Clock className="w-3.5 h-3.5 text-[#D5A52B]" />
              <span>New Commitment</span>
            </button>
          )}

          <button
            type="button"
            onClick={onOpenCreateContribution}
            className="inline-flex items-center gap-1.5 bg-neutral-900 hover:bg-black text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5 text-[#D5A52B]" />
            <span>New Contribution</span>
          </button>
        </div>
      </div>

      {/* Primary Financial Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 tabular-nums">
        <div className="bg-white rounded-2xl border border-neutral-200/90 p-5 shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">
            Total Expected
          </span>
          <div className="text-2xl font-black text-neutral-900 mt-1 tracking-tight">
            {formatMWK(summary.totalExpected)}
          </div>
          <div className="text-[11px] text-neutral-500 mt-2">
            {groupAssignments.length} assigned obligations
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-neutral-200/90 p-5 shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
            Verified Inflow
          </span>
          <div className="text-2xl font-black text-neutral-900 mt-1 tracking-tight">
            {formatMWK(summary.totalVerified)}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 font-medium mt-2">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>
              {summary.totalExpected > 0
                ? Math.round((summary.totalVerified / summary.totalExpected) * 100)
                : 0}
              % collected
              {summary.totalOverpaid > 0
                ? ` • +${formatMWK(summary.totalOverpaid)} overpaid`
                : ''}
            </span>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-neutral-200/90 p-5 shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-rose-700">
            Outstanding Balance
          </span>
          <div className="text-2xl font-black text-neutral-900 mt-1 tracking-tight">
            {formatMWK(summary.totalOutstanding)}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-neutral-500 mt-2">
            <Clock className="w-3.5 h-3.5 text-[#D5A52B]" />
            <span>
              {summary.unpaidCount} unpaid • {summary.partiallyPaidCount} partial
            </span>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-neutral-200/90 p-5 shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">
            Remaining Group Funds
          </span>
          <div
            className={`text-2xl font-black mt-1 tracking-tight ${
              summary.remainingGroupFunds >= 0 ? 'text-neutral-900' : 'text-rose-700'
            }`}
          >
            {formatSignedMWK(summary.remainingGroupFunds)}
          </div>
          <div className="text-[11px] text-neutral-500 mt-2">
            Approved expenses: {formatMWK(summary.totalExpensesApproved)}
          </div>
        </div>
      </div>

      {/* Active Commitments Spotlight Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-extrabold text-neutral-900 text-lg tracking-tight">
              Active Payment Commitments & Countdowns
            </h3>
            <span className="text-xs font-bold bg-neutral-100 text-neutral-700 px-2 py-0.5 rounded-md tabular-nums">
              {activeCommitments.length}
            </span>
          </div>

          {activeCommitments.length > 0 && (
            <button
              type="button"
              onClick={() => onNavigateTab('commitments')}
              className="text-xs font-semibold text-neutral-600 hover:text-neutral-900 flex items-center gap-1 cursor-pointer"
            >
              <span>View all commitments</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {activeCommitments.length === 0 ? (
          <div className="bg-white rounded-2xl border border-neutral-200 p-8 text-center text-neutral-500 text-xs">
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
        <div className="lg:col-span-2 bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-xs">
          <div className="p-5 border-b border-neutral-100 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-neutral-900 text-base">
                Current Obligations & Member Balances
              </h3>
              <p className="text-xs text-neutral-500 mt-0.5">
                Verified ledger shares, paid totals, and remaining or overpaid balances
              </p>
            </div>
            {groupAssignments.length > 0 && (
              <button
                type="button"
                onClick={() => onNavigateTab('payments')}
                className="text-xs font-semibold text-neutral-600 hover:text-neutral-900 cursor-pointer"
              >
                See all payments
              </button>
            )}
          </div>

          {groupAssignments.length === 0 ? (
            <div className="p-10 text-center text-xs text-neutral-500">
              <p className="font-semibold text-neutral-700">No active obligations assigned yet.</p>
              <p className="mt-1 text-neutral-400">
                Click &ldquo;New Contribution&rdquo; above to assign obligations to active group members.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-neutral-100">
              {groupAssignments.map((a) => {
                const member = resolveMemberInfo(a.memberId, groupMembers, users);
                const verifiedPaid = calculateVerifiedPaidForAssignment(a.id, groupPayments);
                const { outstanding, overpaid, completionPercentage } =
                  calculateOutstandingBalance(a.assignedAmount, verifiedPaid);
                const isSettled = outstanding === 0;

                return (
                  <div
                    key={a.id}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-neutral-50/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {member?.avatarUrl ? (
                        <img
                          src={member.avatarUrl}
                          alt={member.name}
                          className="w-9 h-9 rounded-full object-cover border border-neutral-200"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-neutral-200 flex items-center justify-center font-bold text-xs text-neutral-700 shrink-0">
                          {member?.name ? member.name.charAt(0) : 'M'}
                        </div>
                      )}
                      <div>
                        <div className="font-bold text-sm text-neutral-900 flex items-center gap-2 flex-wrap">
                          <span>{member?.name || 'Registered Member'}</span>
                          {member && isValidStoveType(member.stoveType) && (
                            <span className="text-[10px] font-semibold bg-neutral-100 text-neutral-700 px-1.5 py-0.5 rounded">
                              {STOVE_TYPE_LABELS[member.stoveType]}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-neutral-500 mt-0.5 tabular-nums">
                          <span>
                            Expected: <strong>{formatMWK(a.assignedAmount)}</strong>
                          </span>
                          <span>•</span>
                          <span>
                            Paid: <strong className="text-emerald-700">{formatMWK(verifiedPaid)}</strong>
                          </span>
                          {overpaid > 0 && (
                            <>
                              <span>•</span>
                              <span className="text-amber-700 font-semibold">
                                Overpaid: +{formatMWK(overpaid)}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 tabular-nums">
                      <div className="text-right">
                        <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
                          {overpaid > 0 ? 'Overpaid Credit' : 'Remaining'}
                        </div>
                        <div
                          className={`font-black text-sm ${
                            overpaid > 0
                              ? 'text-amber-700'
                              : isSettled
                                ? 'text-emerald-700'
                                : 'text-neutral-900'
                          }`}
                        >
                          {overpaid > 0 ? `+${formatMWK(overpaid)}` : formatMWK(outstanding)}
                        </div>
                      </div>

                      <div className="w-20 hidden sm:block">
                        <div className="w-full bg-neutral-200 h-1.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${isSettled ? 'bg-emerald-600' : 'bg-neutral-900'}`}
                            style={{ width: `${completionPercentage}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-neutral-500 font-medium block text-right mt-0.5">
                          {completionPercentage}%
                        </span>
                      </div>

                      {!isSettled && (
                        <button
                          type="button"
                          onClick={() => onOpenRecordPayment(a.id)}
                          className="bg-neutral-900 hover:bg-black text-white text-[11px] font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
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
        <div className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <div className="flex items-center gap-1.5 font-bold text-neutral-900 text-sm">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Live Financial Audit Trail</span>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('settings')}
                className="text-[11px] font-semibold text-neutral-600 hover:text-neutral-950 cursor-pointer"
              >
                Full Log
              </button>
            </div>

            <div className="mt-3 space-y-3.5">
              {groupAuditLogs.length === 0 ? (
                <div className="py-8 text-center text-neutral-400 text-xs">
                  No audit logs yet. Actions will appear here automatically.
                </div>
              ) : (
                groupAuditLogs.slice(0, 6).map((log) => (
                  <div key={log.id} className="text-xs border-b border-neutral-100 last:border-b-0 pb-2.5 last:pb-0">
                    <div className="flex items-center justify-between text-neutral-400 text-[10px] mb-0.5">
                      <span className="font-semibold text-neutral-700">{log.actorName}</span>
                      <span className="tabular-nums">
                        {new Date(log.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <p className="text-neutral-800 leading-snug">{log.details}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-neutral-100 text-[11px] text-neutral-500 text-center">
            Every contribution and transaction is auditable by administrators.
          </div>
        </div>
      </div>
    </div>
  );
};

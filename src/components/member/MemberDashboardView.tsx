import React from 'react';
import { useApp } from '../../context/AppContext';
import {
  formatMWK,
  calculateVerifiedPaidForAssignment,
  calculatePendingPaidForAssignment,
  calculateOutstandingBalance,
} from '../../utils/financialCalculations';
import { getGroupPreset, getExpenseCategoryLabel } from '../../utils/groupPresets';
import {
  CheckCircle2,
  Clock,
  CreditCard,
  AlertTriangle,
  Receipt,
  Users,
  Plus,
  KeyRound,
  HelpCircle,
} from 'lucide-react';

export const MemberDashboardView: React.FC<{
  onOpenRecordPayment: (assignmentId?: string) => void;
  onOpenJoinGroup: () => void;
  onNavigateTab: (tab: string) => void;
}> = ({ onOpenRecordPayment, onOpenJoinGroup, onNavigateTab }) => {
  const {
    currentGroup,
    currentUser,
    currentMemberRecord,
    contributions,
    assignments,
    payments,
    expenses,
    strings,
  } = useApp();

  if (!currentGroup) {
    return (
      <div className="bg-white dark:bg-[#0D1424] rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-10 max-w-2xl mx-auto text-center space-y-6 shadow-xs">
        <div className="w-12 h-12 rounded-2xl bg-slate-900 dark:bg-[#131D33] text-[#E5B93C] flex items-center justify-center mx-auto">
          <Users className="w-6 h-6" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            {strings.tagline}
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
            You are signed in as <strong className="text-slate-900 dark:text-white">{currentUser?.name}</strong>. Start a new shared money circle or join an existing group using an invite code.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md mx-auto">
          <button
            type="button"
            onClick={() => onNavigateTab('groups')}
            className="min-h-[48px] bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white font-bold px-5 py-3 rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4 text-[#E5B93C] dark:text-white" />
            <span>{strings.plain.createGroup}</span>
          </button>
          <button
            type="button"
            onClick={onOpenJoinGroup}
            className="min-h-[48px] bg-white hover:bg-slate-50 dark:bg-[#11192C] dark:hover:bg-[#18233D] text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 font-bold px-5 py-3 rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer"
          >
            <KeyRound className="w-4 h-4 text-blue-600 dark:text-cyan-400" />
            <span>{strings.plain.joinGroup}</span>
          </button>
        </div>
      </div>
    );
  }

  const preset = getGroupPreset(currentGroup.category);

  const myAssignments = assignments.filter((a) => {
    if (a.groupId !== currentGroup.id) return false;
    if (
      currentMemberRecord &&
      (a.memberId === currentMemberRecord.id || a.memberId === currentMemberRecord.userId)
    ) {
      return true;
    }
    if (currentUser && a.memberId === currentUser.id) return true;
    return false;
  });

  const groupPayments = payments.filter((p) => p.groupId === currentGroup.id);

  let totalAssigned = 0;
  let totalVerifiedPaid = 0;
  let totalPendingCheck = 0;

  myAssignments.forEach((a) => {
    totalAssigned += a.assignedAmount;
    totalVerifiedPaid += calculateVerifiedPaidForAssignment(a.id, groupPayments);
    totalPendingCheck += calculatePendingPaidForAssignment(a.id, groupPayments);
  });

  const { outstanding: totalRemaining, overpaid } = calculateOutstandingBalance(
    totalAssigned,
    totalVerifiedPaid
  );

  const myPayments = groupPayments
    .filter((p) => {
      if (
        currentMemberRecord &&
        (p.memberId === currentMemberRecord.id ||
          p.memberId === currentMemberRecord.userId ||
          p.submittedByMemberId === currentMemberRecord.id)
      ) {
        return true;
      }
      if (currentUser && (p.memberId === currentUser.id || p.collectorId === currentUser.id)) {
        return true;
      }
      return false;
    })
    .slice(0, 6);

  const approvedGroupExpenses = expenses
    .filter((e) => e.groupId === currentGroup.id && e.status === 'approved')
    .slice(0, 5);

  const getPlainStatusLabel = (
    assignedAmt: number,
    verifiedAmt: number,
    pendingAmt: number,
    deadline: string
  ) => {
    const rem = Math.max(0, assignedAmt - verifiedAmt);
    if (rem === 0 && assignedAmt > 0) {
      return { text: strings.plain.verifiedBadge, cls: 'text-emerald-700 dark:text-emerald-400' };
    }
    if (pendingAmt > 0 && verifiedAmt === 0) {
      return {
        text: strings.plain.waitingVerification,
        cls: 'text-amber-700 dark:text-amber-400',
      };
    }
    const deadlineMs = new Date(deadline).getTime();
    const daysLeft = Math.ceil((deadlineMs - Date.now()) / (1000 * 60 * 60 * 24));
    if (deadlineMs < Date.now() && rem > 0) {
      return { text: strings.plain.overdueBadge, cls: 'text-rose-700 dark:text-rose-400' };
    }
    if (verifiedAmt > 0) {
      return { text: strings.plain.partialBadge, cls: 'text-amber-700 dark:text-amber-400' };
    }
    if (daysLeft <= 3) {
      return { text: strings.plain.dueSoonBadge, cls: 'text-amber-700 dark:text-amber-400' };
    }
    return { text: strings.plain.unpaidBadge, cls: 'text-slate-600 dark:text-slate-400' };
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-semibold">
            <span>{preset.label}</span>
            <span aria-hidden="true">·</span>
            <span>{currentGroup.name}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-0.5">
            Hello, {currentUser?.name.split(' ')[0] || 'Member'}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {currentGroup.paymentRules}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {myAssignments.length > 0 && (
            <button
              type="button"
              onClick={() => onOpenRecordPayment(myAssignments[0]?.id)}
              className="min-h-[44px] inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
            >
              <CreditCard className="w-4 h-4 text-[#E5B93C] dark:text-white" />
              <span>{strings.plain.submitPaymentProof}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => onNavigateTab('disputes')}
            className="min-h-[44px] inline-flex items-center gap-1.5 bg-white dark:bg-[#11192C] hover:bg-slate-50 dark:hover:bg-[#18233D] text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer whitespace-nowrap"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>{strings.plain.askQuestionReportIssue}</span>
          </button>
        </div>
      </div>

      {/* 4 Plain-Language Personal Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 tabular-nums">
        <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
            {strings.plain.whatYouNeedToContribute}
          </span>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1 font-mono">
            {formatMWK(totalAssigned)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">
            {myAssignments.length} contribution item(s)
          </div>
        </div>

        <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
          <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
            {strings.plain.paidVerified}
          </span>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1 font-mono">
            {formatMWK(totalVerifiedPaid)}
          </div>
          <div className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-1.5 flex items-center gap-1 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span>Confirmed by group admin</span>
          </div>
        </div>

        <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
          <span className="text-xs font-bold text-amber-700 dark:text-amber-400">
            {strings.plain.waitingVerification}
          </span>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1 font-mono">
            {formatMWK(totalPendingCheck)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>{strings.plain.waitingAdminCheck}</span>
          </div>
        </div>

        <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
          <span className="text-xs font-bold text-rose-700 dark:text-rose-400">
            {overpaid > 0 ? 'Extra Credit Paid' : strings.plain.amountRemaining}
          </span>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1 font-mono">
            {overpaid > 0 ? `+${formatMWK(overpaid)}` : formatMWK(totalRemaining)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">
            {totalRemaining === 0 && totalAssigned > 0
              ? 'All settled — thank you!'
              : 'Based on verified payments'}
          </div>
        </div>
      </div>

      {/* Main Content Split: My Contributions + Group Expenses */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-[#0D1424] rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
          <div className="p-5 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-bold text-slate-900 dark:text-white text-base">
                My Contributions
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Upload your Airtel Money, TNM Mpamba, bank, or cash receipt for each item
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('payments')}
              className="min-h-[38px] px-2.5 text-xs font-semibold text-blue-600 dark:text-cyan-400 hover:underline cursor-pointer whitespace-nowrap"
            >
              View receipts
            </button>
          </div>

          {myAssignments.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400 space-y-2">
              <p className="font-semibold text-slate-700 dark:text-slate-300">
                No contributions assigned to you yet in {currentGroup.name}.
              </p>
              <p>When your group administrator sets a new contribution, it will appear right here.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {myAssignments.map((a) => {
                const contrib = contributions.find((c) => c.id === a.contributionId);
                const verified = calculateVerifiedPaidForAssignment(a.id, groupPayments);
                const pending = calculatePendingPaidForAssignment(a.id, groupPayments);
                const { outstanding } = calculateOutstandingBalance(a.assignedAmount, verified);
                const statusInfo = getPlainStatusLabel(
                  a.assignedAmount,
                  verified,
                  pending,
                  a.deadline
                );

                return (
                  <div
                    key={a.id}
                    className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-slate-900 dark:text-white">
                          {contrib?.title || 'Group Contribution'}
                        </span>
                        <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                          ·
                        </span>
                        <span className={`text-xs font-bold ${statusInfo.cls}`}>
                          {statusInfo.text}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                        <span>
                          Target:{' '}
                          <strong className="text-slate-800 dark:text-slate-200">
                            {formatMWK(a.assignedAmount)}
                          </strong>
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>
                          Verified:{' '}
                          <strong className="text-emerald-700 dark:text-emerald-400">
                            {formatMWK(verified)}
                          </strong>
                        </span>
                        {pending > 0 && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="text-amber-700 dark:text-amber-400 font-semibold">
                              Waiting check: {formatMWK(pending)}
                            </span>
                          </>
                        )}
                        <span aria-hidden="true">·</span>
                        <span>
                          Due{' '}
                          {new Date(a.deadline).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                          })}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 tabular-nums">
                      <div className="text-left sm:text-right">
                        <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                          Remaining
                        </div>
                        <div className="text-sm font-black font-mono text-slate-900 dark:text-white">
                          {formatMWK(outstanding)}
                        </div>
                      </div>

                      {outstanding > 0 && (
                        <button
                          type="button"
                          onClick={() => onOpenRecordPayment(a.id)}
                          className="min-h-[42px] bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white px-3.5 py-2 rounded-xl text-xs font-bold cursor-pointer whitespace-nowrap"
                        >
                          Submit Proof
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Recent Proofs & Group Expenses Transparency */}
        <div className="space-y-6">
          {/* My Recent Payments */}
          <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-3">
            <h3 className="font-bold text-slate-900 dark:text-white text-sm">
              My Recent Payment Proofs
            </h3>
            {myPayments.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 py-2">
                No receipts submitted yet. When you submit a mobile money reference or receipt photo, its check status shows here.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs tabular-nums">
                {myPayments.map((p) => (
                  <div key={p.id} className="py-2.5 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-bold font-mono text-slate-900 dark:text-white">
                        {formatMWK(p.amountReceived)}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {p.transactionReference} · {p.paymentMethod.replace('_', ' ')}
                      </div>
                    </div>
                    <span
                      className={`text-[11px] font-bold shrink-0 ${
                        p.verificationStatus === 'verified'
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : p.verificationStatus === 'rejected' || p.verificationStatus === 'reversed'
                            ? 'text-rose-700 dark:text-rose-400'
                            : 'text-amber-700 dark:text-amber-400'
                      }`}
                    >
                      {p.verificationStatus === 'verified'
                        ? 'Verified'
                        : p.verificationStatus === 'rejected'
                          ? 'Rejected'
                          : p.verificationStatus === 'reversed'
                            ? 'Reversed'
                            : 'Waiting Check'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Group Expenses Transparency */}
          <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white text-sm">
                <Receipt className="w-4 h-4 text-blue-600 dark:text-cyan-400" />
                <span>{strings.plain.groupExpensesTransparency}</span>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('expenses')}
                className="text-xs font-semibold text-blue-600 dark:text-cyan-400 hover:underline cursor-pointer"
              >
                See all
              </button>
            </div>
            {approvedGroupExpenses.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 py-2">
                No approved expenses logged for this group yet.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs tabular-nums">
                {approvedGroupExpenses.map((e) => (
                  <div key={e.id} className="py-2.5 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900 dark:text-white truncate">
                        {e.name}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {getExpenseCategoryLabel(e.category)}
                      </div>
                    </div>
                    <span className="font-bold font-mono text-slate-900 dark:text-white shrink-0">
                      {formatMWK(e.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Subtle support notice */}
      <div className="bg-slate-50 dark:bg-[#0D1424] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-600 dark:text-slate-400">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-[#D5A52B] shrink-0" />
          <span>
            Notice a mistake in your recorded balance or receipt? Ask a question so your group admin can check and update it.
          </span>
        </div>
        <button
          type="button"
          onClick={() => onNavigateTab('disputes')}
          className="min-h-[40px] px-3.5 py-2 rounded-xl bg-white dark:bg-[#11192C] border border-slate-200 dark:border-slate-700 font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#18233D] cursor-pointer whitespace-nowrap"
        >
          {strings.plain.askQuestionReportIssue}
        </button>
      </div>
    </div>
  );
};

import React from 'react';
import { useApp } from '../../context/AppContext';
import { 
  formatMWK, 
  computeGroupFinancialSummary,
  calculateVerifiedPaidForAssignment,
  calculateOutstandingBalance 
} from '../../utils/financialCalculations';
import { 
  Clock, 
  CheckCircle2, 
  CreditCard, 
  Plus, 
  ChevronRight,
  ShieldCheck,
  Building2,
  Users
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
  onOpenRecordExpense,
  onNavigateTab,
}) => {
  const { 
    currentGroup, 
    groups,
    contributions, 
    assignments, 
    payments, 
    commitments, 
    expenses, 
    users, 
    auditLogs,
    currentUser,
    approveCommitmentExtension 
  } = useApp();

  // If no group created yet, render professional empty state to create first group
  if (!currentGroup) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-3xl border border-neutral-200 p-8 sm:p-12 text-center max-w-2xl mx-auto shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-neutral-900 text-white flex items-center justify-center mx-auto mb-4 shadow-sm">
            <Building2 className="w-7 h-7 text-[#D5A52B]" />
          </div>
          <h2 className="text-2xl font-extrabold text-neutral-900 tracking-tight">
            Welcome to KLARENCY
          </h2>
          <p className="text-sm text-neutral-600 mt-2 leading-relaxed">
            Your platform is pristine and ready for live financial management. Create your first group (shared accommodation, hostel, workplace team, or community fund) to begin tracking contributions in Malawi Kwacha.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => onNavigateTab('groups')}
              className="w-full sm:w-auto bg-neutral-900 hover:bg-black text-white text-xs font-bold px-6 py-3 rounded-xl transition-all shadow-xs cursor-pointer flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Create First Financial Group
            </button>
            <button
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

  const groupAssignments = assignments.filter(a => a.groupId === currentGroup.id);
  const groupPayments = payments.filter(p => p.groupId === currentGroup.id);
  const groupExpenses = expenses.filter(e => e.groupId === currentGroup.id);
  const groupCommitments = commitments.filter(c => c.groupId === currentGroup.id);

  const approvedExpensesTotal = groupExpenses
    .filter(e => e.status === 'approved')
    .reduce((sum, e) => sum + e.amount, 0);

  const summary = computeGroupFinancialSummary(
    groupAssignments,
    groupPayments,
    approvedExpensesTotal
  );

  const activeCommitments = groupCommitments.filter(c => c.currentOutstandingAmount > 0);

  return (
    <div className="space-y-6">
      {/* Top Welcome / Group Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-widest font-extrabold text-[#D5A52B]">
              Financial Ledger
            </span>
            <span className="text-neutral-300">•</span>
            <span className="text-xs font-semibold text-neutral-500">
              {currentGroup.name}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-900 tracking-tight mt-0.5">
            Overview & Clear Balances
          </h1>
        </div>

        {/* Action quick buttons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {groupAssignments.length > 0 && (
            <button
              onClick={() => onOpenRecordPayment()}
              className="inline-flex items-center gap-1.5 bg-neutral-900 hover:bg-black text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
              Record Payment
            </button>
          )}

          {activeCommitments.length > 0 && (
            <button
              onClick={() => onOpenCreateCommitment()}
              className="inline-flex items-center gap-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-900 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              <Clock className="w-3.5 h-3.5 text-[#D5A52B]" />
              New Commitment
            </button>
          )}

          <button
            onClick={onOpenCreateContribution}
            className="inline-flex items-center gap-1.5 bg-neutral-900 hover:bg-black text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            New Monthly Bill
          </button>
        </div>
      </div>

      {/* Primary Financial Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Expected */}
        <div className="bg-white rounded-2xl border border-neutral-200/90 p-5 shadow-xs relative overflow-hidden">
          <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">
            Total Expected
          </span>
          <div className="text-2xl font-black text-neutral-900 mt-1 tracking-tight">
            {formatMWK(summary.totalExpected)}
          </div>
          <div className="flex items-center gap-1 text-[11px] text-neutral-400 mt-2">
            <span>{groupAssignments.length} assigned obligations</span>
          </div>
          <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-neutral-300" />
        </div>

        {/* Total Verified Collected */}
        <div className="bg-white rounded-2xl border border-neutral-200/90 p-5 shadow-xs relative overflow-hidden">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">
            Verified Inflow
          </span>
          <div className="text-2xl font-black text-neutral-900 mt-1 tracking-tight">
            {formatMWK(summary.totalVerified)}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 font-medium mt-2">
            <CheckCircle2 className="w-3 h-3" />
            <span>{summary.totalExpected > 0 ? Math.round((summary.totalVerified / summary.totalExpected) * 100) : 0}% collected in MWK</span>
          </div>
          <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-emerald-500" />
        </div>

        {/* Total Outstanding */}
        <div className="bg-white rounded-2xl border border-neutral-200/90 p-5 shadow-xs relative overflow-hidden">
          <span className="text-xs font-bold uppercase tracking-wider text-rose-600">
            Outstanding Balance
          </span>
          <div className="text-2xl font-black text-neutral-900 mt-1 tracking-tight">
            {formatMWK(summary.totalOutstanding)}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-neutral-500 mt-2">
            <Clock className="w-3 h-3 text-[#D5A52B]" />
            <span>{summary.unpaidCount} unpaid • {summary.partiallyPaidCount} partial</span>
          </div>
          <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-rose-500" />
        </div>

        {/* Remaining Group Funds */}
        <div className="bg-white rounded-2xl border border-neutral-200/90 p-5 shadow-xs relative overflow-hidden">
          <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">
            Remaining Group Funds
          </span>
          <div className={`text-2xl font-black mt-1 tracking-tight ${
            summary.remainingGroupFunds >= 0 ? 'text-neutral-900' : 'text-rose-600'
          }`}>
            {formatMWK(summary.remainingGroupFunds)}
          </div>
          <div className="flex items-center justify-between text-[11px] text-neutral-400 mt-2">
            <span>Expenses: {formatMWK(summary.totalExpensesApproved)}</span>
          </div>
          <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-[#D5A52B]" />
        </div>
      </div>

      {/* Active Commitments Spotlight Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-[#D5A52B]" />
            <h3 className="font-extrabold text-neutral-900 text-lg tracking-tight">
              Active Payment Commitments & Countdowns
            </h3>
            <span className="text-xs font-semibold bg-neutral-100 text-neutral-700 px-2 py-0.5 rounded-full">
              {activeCommitments.length}
            </span>
          </div>

          {activeCommitments.length > 0 && (
            <button
              onClick={() => onNavigateTab('commitments')}
              className="text-xs font-semibold text-neutral-600 hover:text-neutral-900 flex items-center gap-1 cursor-pointer"
            >
              View all commitments
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {activeCommitments.length === 0 ? (
          <div className="bg-white rounded-2xl border border-neutral-200 p-8 text-center text-neutral-500 text-xs">
            No active countdowns right now. When members pay partially, you can set promise deadlines here.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeCommitments.slice(0, 3).map(c => {
              const member = users.find(u => u.id === c.memberId);
              const contribution = contributions.find(cntr => cntr.id === c.contributionId);

              return (
                <CommitmentCard
                  key={c.id}
                  commitment={c}
                  member={member}
                  contribution={contribution}
                  canManage={currentUser.role !== 'member'}
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
        {/* Left Column: Member Contribution Status (2 cols) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-xs">
          <div className="p-5 border-b border-neutral-100 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-neutral-900 text-base">
                Current Obligations & Member Balances
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                Real-time breakdown of assigned shares and payments
              </p>
            </div>
            {groupAssignments.length > 0 && (
              <button
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
              <p className="mt-1 text-neutral-400">Click &ldquo;New Monthly Bill&rdquo; above to assign contributions to group members.</p>
            </div>
          ) : (
            <div className="divide-y divide-neutral-100">
              {groupAssignments.map(a => {
                const member = users.find(u => u.id === a.memberId);
                const verifiedPaid = groupPayments
                  .filter(p => p.assignmentId === a.id && p.verificationStatus === 'verified')
                  .reduce((sum, p) => sum + p.amountReceived, 0);

                const { outstanding, completionPercentage } = calculateOutstandingBalance(
                  a.assignedAmount, 
                  verifiedPaid
                );

                const isSettled = outstanding === 0;

                return (
                  <div key={a.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-neutral-50/50 transition-colors">
                    <div className="flex items-center gap-3">
                      {member?.avatarUrl ? (
                        <img src={member.avatarUrl} alt={member.name} className="w-9 h-9 rounded-full object-cover border border-neutral-200" />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-neutral-200 flex items-center justify-center font-bold text-xs text-neutral-700">
                          {member?.name ? member.name.charAt(0) : 'M'}
                        </div>
                      )}
                      <div>
                        <div className="font-bold text-sm text-neutral-900 flex items-center gap-2">
                          {member?.name || 'Member'}
                          {a.notes && (
                            <span className="text-[10px] text-neutral-400 font-normal">
                              ({a.notes})
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-neutral-500 mt-0.5">
                          <span>Expected: <strong>{formatMWK(a.assignedAmount)}</strong></span>
                          <span>•</span>
                          <span>Paid: <strong className="text-emerald-700">{formatMWK(verifiedPaid)}</strong></span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3">
                      <div className="text-right">
                        <div className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                          Remaining
                        </div>
                        <div className={`font-black text-sm ${isSettled ? 'text-emerald-600' : 'text-neutral-900'}`}>
                          {formatMWK(outstanding)}
                        </div>
                      </div>

                      <div className="w-20 hidden sm:block">
                        <div className="w-full bg-neutral-200 h-1.5 rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${isSettled ? 'bg-emerald-500' : 'bg-neutral-900'}`}
                            style={{ width: `${completionPercentage}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-neutral-400 font-medium block text-right mt-0.5">
                          {completionPercentage}%
                        </span>
                      </div>

                      {!isSettled && (
                        <button
                          onClick={() => onOpenRecordPayment(a.id)}
                          className="bg-neutral-900 hover:bg-black text-white text-[11px] font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
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

        {/* Right Column: Immutable Audit Ledger & Transparency */}
        <div className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <div className="flex items-center gap-1.5 font-bold text-neutral-900 text-sm">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Live Financial Audit Trail
              </div>
              <span className="text-[10px] bg-neutral-100 text-neutral-600 font-mono px-1.5 py-0.5 rounded">
                Immutable
              </span>
            </div>

            <div className="mt-3 space-y-3.5">
              {auditLogs.length === 0 ? (
                <div className="py-8 text-center text-neutral-400 text-xs">
                  No audit logs yet. System records will appear here as actions occur.
                </div>
              ) : (
                auditLogs.slice(0, 5).map(log => (
                  <div key={log.id} className="text-xs">
                    <div className="flex items-center justify-between text-neutral-400 text-[10px] mb-0.5">
                      <span className="font-semibold text-neutral-700">{log.actorName}</span>
                      <span>{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p className="text-neutral-800 leading-snug">
                      {log.details}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-neutral-100 text-[11px] text-neutral-400 text-center">
            Every contribution and transaction is verifiable by group members.
          </div>
        </div>
      </div>
    </div>
  );
};

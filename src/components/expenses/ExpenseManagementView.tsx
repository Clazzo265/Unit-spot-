import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { formatMWK, formatSignedMWK } from '../../utils/financialCalculations';
import { toSafeIntMWK } from '../../utils/financialConfig';
import { canUserApproveExpenses } from '../../utils/centralizedFinancialAdmin';
import { EmptyState } from '../ui/EmptyState';
import { Plus, CheckCircle2, Clock, XCircle, AlertCircle, Receipt } from 'lucide-react';

export const ExpenseManagementView: React.FC<{
  onOpenRecordExpense: () => void;
}> = ({ onOpenRecordExpense }) => {
  const { expenses, payments, currentGroup, currentUser, approveExpense } = useApp();
  const { showToast } = useToast();

  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [actionError, setActionError] = useState<string | null>(null);

  const canApprove = canUserApproveExpenses(currentUser?.role);

  const groupExpenses = currentGroup
    ? expenses.filter((e) => e.groupId === currentGroup.id)
    : expenses;

  const groupPayments = currentGroup
    ? payments.filter((p) => p.groupId === currentGroup.id)
    : payments;

  const totalVerifiedCollected = groupPayments
    .filter((p) => p.verificationStatus === 'verified')
    .reduce((sum, p) => sum + toSafeIntMWK(p.amountReceived), 0);

  const approvedExpenses = groupExpenses.filter((e) => e.status === 'approved');
  const totalSpent = approvedExpenses.reduce((sum, e) => sum + toSafeIntMWK(e.amount), 0);
  const remainingFunds = totalVerifiedCollected - totalSpent;

  const filteredExpenses = groupExpenses.filter((e) => {
    if (filterCategory === 'all') return true;
    return e.category === filterCategory;
  });

  const handleApproval = (expenseId: string, approved: boolean) => {
    setActionError(null);
    const res = approveExpense(expenseId, approved);
    if (!res.success && res.error) {
      setActionError(res.error);
      return;
    }
    showToast(approved ? 'Expense Approved' : 'Expense Declined', {
      message: approved
        ? 'Disbursement deducted from remaining group treasury.'
        : 'Expense marked declined.',
      variant: approved ? 'success' : 'info',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Expense Management &amp; Reconciliation
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Transparent tracking of where group contributions were spent (ESCOM tokens, water, rent, WiFi)
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenRecordExpense}
          className="min-h-[44px] inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-colors shadow-xs cursor-pointer whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          <span>Record New Expense</span>
        </button>
      </div>

      {actionError && (
        <div
          role="alert"
          className="bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 px-4 py-3 rounded-xl text-xs font-medium flex items-center gap-2"
        >
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Financial Reconciliation Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Total Verified Inflow
          </span>
          <div className="text-2xl font-extrabold font-mono text-slate-900 dark:text-white mt-1 tabular-nums">
            {formatMWK(totalVerifiedCollected)}
          </div>
          <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium mt-1 inline-block">
            Collected &amp; verified in MWK
          </span>
        </div>

        <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Total Approved Expenses
          </span>
          <div className="text-2xl font-extrabold font-mono text-slate-900 dark:text-white mt-1 tabular-nums">
            {formatMWK(totalSpent)}
          </div>
          <span className="text-[11px] text-rose-700 dark:text-rose-400 font-medium mt-1 inline-block">
            Disbursed for utilities &amp; goods
          </span>
        </div>

        <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Remaining Group Treasury
          </span>
          <div
            className={`text-2xl font-extrabold font-mono mt-1 tabular-nums ${
              remainingFunds >= 0
                ? 'text-emerald-700 dark:text-emerald-400'
                : 'text-rose-700 dark:text-rose-400'
            }`}
          >
            {formatSignedMWK(remainingFunds)}
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-1 inline-block">
            {remainingFunds >= 0 ? 'Unallocated reserve balance' : 'Overdraft deficit'}
          </span>
        </div>
      </div>

      {/* Expenses Ledger */}
      <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h3 className="font-bold text-slate-900 dark:text-white text-sm">
              Disbursement Ledger
            </h3>
            <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              {filteredExpenses.length} of {groupExpenses.length} recorded items
            </span>
          </div>

          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            aria-label="Filter expenses by category"
            className="min-h-[40px] bg-slate-50 dark:bg-[#11192C] border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none"
          >
            <option value="all">All Categories</option>
            <option value="electricity">Electricity</option>
            <option value="water">Water Utility</option>
            <option value="rent">Rent</option>
            <option value="internet">Internet / WiFi</option>
            <option value="security">Security</option>
            <option value="waste">Waste Disposal</option>
            <option value="groceries">Shared Groceries</option>
            <option value="maintenance">Maintenance</option>
            <option value="other">Other</option>
          </select>
        </div>

        {filteredExpenses.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={Receipt}
              title={
                filterCategory === 'all'
                  ? 'No group expenses recorded yet'
                  : 'No expenses in this category'
              }
              description="Record ESCOM tokens, water bills, or maintenance payouts to reconcile against verified member inflows."
              actionLabel="Record Expense"
              onAction={onOpenRecordExpense}
              secondaryActionLabel={filterCategory !== 'all' ? 'Show All Categories' : undefined}
              onSecondaryAction={
                filterCategory !== 'all' ? () => setFilterCategory('all') : undefined
              }
            />
          </div>
        ) : (
          <>
            {/* Mobile Card List */}
            <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
              {filteredExpenses.map((e) => (
                <div key={e.id} className="p-4 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-bold text-sm text-slate-900 dark:text-white truncate">
                        {e.name}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 capitalize mt-0.5">
                        {e.category} ·{' '}
                        {new Date(e.date).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </div>
                    </div>
                    <div className="text-right tabular-nums shrink-0">
                      <div className="font-bold font-mono text-sm text-slate-900 dark:text-white">
                        {formatMWK(e.amount)}
                      </div>
                      <div className="text-[11px] font-semibold mt-0.5">
                        {e.status === 'approved' ? (
                          <span className="text-emerald-700 dark:text-emerald-400">Approved</span>
                        ) : e.status === 'pending_approval' ? (
                          <span className="text-amber-700 dark:text-amber-400">Pending</span>
                        ) : (
                          <span className="text-rose-700 dark:text-rose-400">Rejected</span>
                        )}
                      </div>
                    </div>
                  </div>
                  {e.receiptNumber && (
                    <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                      Receipt: {e.receiptNumber}
                    </div>
                  )}
                  {e.status === 'pending_approval' && canApprove && (
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleApproval(e.id, true)}
                        className="flex-1 min-h-[40px] bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold cursor-pointer"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApproval(e.id, false)}
                        className="flex-1 min-h-[40px] bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-xl text-xs font-semibold cursor-pointer"
                      >
                        Decline
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50/80 dark:bg-[#10182B] border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4 font-semibold">Expense Title</th>
                    <th className="py-3 px-4 font-semibold">Category</th>
                    <th className="py-3 px-4 font-semibold">Amount</th>
                    <th className="py-3 px-4 font-semibold">Date</th>
                    <th className="py-3 px-4 font-semibold">Receipt / Token #</th>
                    <th className="py-3 px-4 font-semibold">Approval Status</th>
                    <th className="py-3 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-slate-800 dark:text-slate-200">
                  {filteredExpenses.map((e) => (
                    <tr
                      key={e.id}
                      className="hover:bg-slate-50/60 dark:hover:bg-[#11192C]/60 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 dark:text-white">{e.name}</div>
                        {e.description && (
                          <div className="text-[11px] text-slate-400 line-clamp-1">
                            {e.description}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4 capitalize text-slate-600 dark:text-slate-300 font-semibold">
                        {e.category}
                      </td>

                      <td className="py-3 px-4 font-bold font-mono text-slate-900 dark:text-white text-sm tabular-nums">
                        {formatMWK(e.amount)}
                      </td>

                      <td className="py-3 px-4 text-slate-500 dark:text-slate-400 tabular-nums">
                        {new Date(e.date).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>

                      <td className="py-3 px-4 font-mono text-[11px] text-slate-700 dark:text-slate-300">
                        {e.receiptNumber || 'None provided'}
                      </td>

                      <td className="py-3 px-4">
                        {e.status === 'approved' && (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Approved
                          </span>
                        )}
                        {e.status === 'pending_approval' && (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-400">
                            <Clock className="w-3.5 h-3.5" />
                            Pending
                          </span>
                        )}
                        {e.status === 'rejected' && (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700 dark:text-rose-400">
                            <XCircle className="w-3.5 h-3.5" />
                            Rejected
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        {e.status === 'pending_approval' && canApprove ? (
                          <div className="inline-flex gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleApproval(e.id, true)}
                              className="min-h-[34px] bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => handleApproval(e.id, false)}
                              className="min-h-[34px] bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 text-rose-600 dark:text-rose-300 px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer"
                            >
                              Decline
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500 text-xs">Logged</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

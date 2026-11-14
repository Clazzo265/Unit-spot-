import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { formatMWK, formatSignedMWK } from '../../utils/financialCalculations';
import { toSafeIntMWK } from '../../utils/financialConfig';
import { canUserApproveExpenses } from '../../utils/centralizedFinancialAdmin';
import { Plus, CheckCircle2, Clock, XCircle, AlertCircle } from 'lucide-react';

export const ExpenseManagementView: React.FC<{
  onOpenRecordExpense: () => void;
}> = ({ onOpenRecordExpense }) => {
  const { expenses, payments, currentGroup, currentUser, approveExpense } = useApp();

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
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900 tracking-tight">
            Expense Management &amp; Reconciliation
          </h2>
          <p className="text-sm text-neutral-500 mt-0.5">
            Transparent tracking of where group contributions were spent (ESCOM tokens, water, rent, WiFi)
          </p>
        </div>

        <button
          onClick={onOpenRecordExpense}
          className="inline-flex items-center gap-2 bg-neutral-900 hover:bg-black text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-colors shadow-xs cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Record New Expense
        </button>
      </div>

      {actionError && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-xl text-xs font-medium flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Financial Reconciliation Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-xs">
          <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
            Total Verified Inflow
          </span>
          <div className="text-2xl font-extrabold text-neutral-900 mt-1 tabular-nums">
            {formatMWK(totalVerifiedCollected)}
          </div>
          <span className="text-[11px] text-emerald-700 font-medium mt-1 inline-block">
            Collected &amp; verified in MWK
          </span>
        </div>

        <div className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-xs">
          <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
            Total Approved Expenses
          </span>
          <div className="text-2xl font-extrabold text-neutral-900 mt-1 tabular-nums">
            {formatMWK(totalSpent)}
          </div>
          <span className="text-[11px] text-rose-700 font-medium mt-1 inline-block">
            Disbursed for utilities &amp; goods
          </span>
        </div>

        <div className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-xs">
          <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
            Remaining Group Treasury
          </span>
          <div
            className={`text-2xl font-extrabold mt-1 tabular-nums ${
              remainingFunds >= 0 ? 'text-emerald-700' : 'text-rose-700'
            }`}
          >
            {formatSignedMWK(remainingFunds)}
          </div>
          <span className="text-[11px] text-neutral-500 font-medium mt-1 inline-block">
            {remainingFunds >= 0 ? 'Unallocated reserve balance' : 'Overdraft deficit'}
          </span>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-xs">
        <div className="p-4 border-b border-neutral-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h3 className="font-bold text-neutral-900 text-sm">
              Disbursement Ledger
            </h3>
            <span className="text-xs text-neutral-500 tabular-nums">
              {filteredExpenses.length} of {groupExpenses.length} recorded items
            </span>
          </div>

          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            aria-label="Filter expenses by category"
            className="bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-1.5 text-xs font-medium text-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-900"
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

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-neutral-50/80 border-b border-neutral-200/80 text-neutral-500 uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4 font-semibold">Expense Title</th>
                <th className="py-3 px-4 font-semibold">Category</th>
                <th className="py-3 px-4 font-semibold">Amount</th>
                <th className="py-3 px-4 font-semibold">Date</th>
                <th className="py-3 px-4 font-semibold">Receipt / Token #</th>
                <th className="py-3 px-4 font-semibold">Approval Status</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 text-neutral-800">
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-neutral-400">
                    No expenses match the selected filter.
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((e) => (
                  <tr key={e.id} className="hover:bg-neutral-50/60 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-neutral-900">{e.name}</div>
                      {e.description && (
                        <div className="text-[11px] text-neutral-400 line-clamp-1">
                          {e.description}
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-neutral-100 text-neutral-700 capitalize">
                        {e.category}
                      </span>
                    </td>

                    <td className="py-3 px-4 font-bold text-neutral-900 text-sm tabular-nums">
                      {formatMWK(e.amount)}
                    </td>

                    <td className="py-3 px-4 text-neutral-500 tabular-nums">
                      {new Date(e.date).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>

                    <td className="py-3 px-4 font-mono text-[11px] text-neutral-700">
                      {e.receiptNumber || 'None provided'}
                    </td>

                    <td className="py-3 px-4">
                      {e.status === 'approved' && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          Approved
                        </span>
                      )}
                      {e.status === 'pending_approval' && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                          <Clock className="w-3.5 h-3.5 text-amber-600" />
                          Pending
                        </span>
                      )}
                      {e.status === 'rejected' && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                          <XCircle className="w-3.5 h-3.5 text-rose-600" />
                          Rejected
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-right">
                      {e.status === 'pending_approval' && canApprove ? (
                        <div className="inline-flex gap-1.5">
                          <button
                            onClick={() => handleApproval(e.id, true)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleApproval(e.id, false)}
                            className="bg-neutral-100 hover:bg-rose-50 text-rose-600 px-2 py-1 rounded-md text-xs font-semibold cursor-pointer"
                          >
                            Decline
                          </button>
                        </div>
                      ) : (
                        <span className="text-neutral-400 text-xs">Logged</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

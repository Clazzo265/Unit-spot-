import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { EmptyState } from '../ui/EmptyState';
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
import { Download, Printer, Building2 } from 'lucide-react';

export const FinancialReportingView: React.FC = () => {
  const {
    currentGroup,
    contributions,
    assignments,
    payments,
    expenses,
    groupMembers,
    users,
  } = useApp();
  const { showToast } = useToast();

  const [selectedContributionId, setSelectedContributionId] = useState<string>('');

  if (!currentGroup) {
    return (
      <EmptyState
        icon={Building2}
        title="No Active Financial Group"
        description="Create or select an administrator group to generate verified financial statements and CSV exports."
      />
    );
  }

  const groupContributions = contributions.filter((c) => c.groupId === currentGroup.id);
  const activeContribution =
    groupContributions.find((c) => c.id === selectedContributionId) || groupContributions[0];

  const relatedAssignments = assignments.filter(
    (a) =>
      a.groupId === currentGroup.id &&
      (!activeContribution ? true : a.contributionId === activeContribution.id)
  );

  const groupPayments = payments.filter((p) => p.groupId === currentGroup.id);

  const totalApprovedExpenses = expenses
    .filter((e) => e.groupId === currentGroup.id && e.status === 'approved')
    .reduce((sum, e) => sum + e.amount, 0);

  const summary = computeGroupFinancialSummary(
    relatedAssignments,
    groupPayments,
    totalApprovedExpenses
  );

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    const headers = [
      'Member Name',
      'Email',
      'Phone',
      'Stove Tier',
      'Assigned MWK',
      'Verified Paid MWK',
      'Outstanding MWK',
      'Overpaid MWK',
      'Status',
    ];
    const rows = relatedAssignments.map((a) => {
      const m = resolveMemberInfo(a.memberId, groupMembers, users);
      const paid = calculateVerifiedPaidForAssignment(a.id, groupPayments);
      const { outstanding, overpaid } = calculateOutstandingBalance(a.assignedAmount, paid);
      const stoveLabel =
        a.stoveTypeAtAssignment && isValidStoveType(a.stoveTypeAtAssignment)
          ? STOVE_TYPE_LABELS[a.stoveTypeAtAssignment]
          : m?.stoveType && isValidStoveType(m.stoveType)
            ? STOVE_TYPE_LABELS[m.stoveType]
            : 'Unclassified';

      return [
        `"${m?.name || 'Registered Member'}"`,
        `"${m?.email || ''}"`,
        `"${m?.phone || ''}"`,
        `"${stoveLabel}"`,
        a.assignedAmount,
        paid,
        outstanding,
        overpaid,
        `"${a.status}"`,
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    const filenameDate = new Date().toISOString().split('T')[0];
    const fileName = `UnitSpot_Report_${currentGroup.name.replace(/\s+/g, '_')}_${filenameDate}.csv`;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('CSV statement exported', {
      message: `Downloaded ${fileName} (${relatedAssignments.length} records).`,
      variant: 'success',
    });
  };

  return (
    <div className="space-y-6">
      <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-50 tracking-tight">
            Financial Audit Reports &amp; Statements
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
            Verified audit records, member statements, and CSV reconciliations
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handlePrint}
            className="min-h-[44px] inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-[#131D33] dark:hover:bg-[#1A2744] text-slate-800 dark:text-slate-200 px-4 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Printer className="w-4 h-4" />
            <span>Print Statement</span>
          </button>
          <button
            type="button"
            onClick={handleExportCSV}
            className="min-h-[44px] inline-flex items-center gap-1.5 bg-slate-900 hover:bg-black dark:bg-blue-600 dark:hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition-colors shadow-xs cursor-pointer whitespace-nowrap"
          >
            <Download className="w-4 h-4 text-[#E5B93C]" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {groupContributions.length > 0 && (
        <div className="no-print flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 bg-white dark:bg-[#0D1424] p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs">
          <label
            htmlFor="report-period-filter"
            className="font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap"
          >
            Filter Contribution Period:
          </label>
          <select
            id="report-period-filter"
            value={selectedContributionId || activeContribution?.id || ''}
            onChange={(e) => setSelectedContributionId(e.target.value)}
            className="min-h-[44px] bg-slate-50 dark:bg-[#11192C] border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {groupContributions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title} (Target: {formatMWK(c.totalTargetAmount)})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Printable Statement */}
      <div className="bg-white dark:bg-[#0D1424] print:bg-white rounded-3xl border border-slate-200 dark:border-slate-800 p-5 sm:p-8 shadow-sm space-y-6 print:border-none print:shadow-none print:p-0">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-3 border-b border-slate-200 dark:border-slate-800 print:border-slate-200 pb-6">
          <div>
            <div className="text-2xl font-extrabold text-slate-900 dark:text-slate-50 print:text-black tracking-tight">
              Unit<span className="text-[#D5A52B]">Spot</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 print:text-slate-600 uppercase tracking-widest font-semibold mt-0.5">
              Financial Accountability Ledger • Malawi
            </p>
            <div className="mt-3 text-xs text-slate-600 dark:text-slate-300 print:text-slate-700 space-y-0.5">
              <div>
                <strong>Group:</strong> {currentGroup.name}
              </div>
              <div>
                <strong>Currency:</strong> Malawi Kwacha ({currentGroup.defaultCurrency})
              </div>
              <div>
                <strong>Statement Date:</strong>{' '}
                {new Date().toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </div>
            </div>
          </div>

          <div className="sm:text-right">
            <span className="inline-block bg-slate-900 dark:bg-blue-600 print:bg-slate-900 text-white font-mono text-[11px] px-3 py-1.5 rounded-lg uppercase tracking-wider font-bold">
              Official Statement
            </span>
          </div>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 bg-slate-50 dark:bg-[#11192C] print:bg-slate-50 rounded-2xl p-4 border border-slate-200/70 dark:border-slate-800 print:border-slate-200 tabular-nums">
          <div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 print:text-slate-600 uppercase tracking-wider font-medium">
              Expected Target
            </span>
            <div className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-50 print:text-black mt-0.5">
              {formatMWK(summary.totalExpected)}
            </div>
          </div>
          <div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 print:text-slate-600 uppercase tracking-wider font-medium">
              Verified Collected
            </span>
            <div className="text-base sm:text-lg font-bold text-emerald-700 dark:text-emerald-400 print:text-emerald-700 mt-0.5">
              {formatMWK(summary.totalVerified)}
            </div>
          </div>
          <div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 print:text-slate-600 uppercase tracking-wider font-medium">
              Outstanding Owed
            </span>
            <div className="text-base sm:text-lg font-bold text-rose-700 dark:text-rose-400 print:text-rose-700 mt-0.5">
              {formatMWK(summary.totalOutstanding)}
            </div>
          </div>
          <div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 print:text-slate-600 uppercase tracking-wider font-medium">
              Overpaid Credit
            </span>
            <div className="text-base sm:text-lg font-bold text-amber-700 dark:text-amber-400 print:text-amber-700 mt-0.5">
              {formatMWK(summary.totalOverpaid)}
            </div>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 print:text-slate-600 uppercase tracking-wider font-medium">
              Net Treasury
            </span>
            <div className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-50 print:text-black mt-0.5">
              {formatSignedMWK(summary.remainingGroupFunds)}
            </div>
          </div>
        </div>

        {/* Member Breakdown */}
        <div>
          <h4 className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 print:text-black mb-3">
            Member Obligation &amp; Settlement Schedule
          </h4>

          {relatedAssignments.length === 0 ? (
            <div className="p-8 text-center text-slate-400 dark:text-slate-500 text-xs border border-slate-200 dark:border-slate-800 rounded-xl">
              No obligations assigned in this statement period.
            </div>
          ) : (
            <>
              {/* Mobile Card List (hidden on md+ and when printing) */}
              <div className="space-y-3 md:hidden print:hidden tabular-nums">
                {relatedAssignments.map((a) => {
                  const m = resolveMemberInfo(a.memberId, groupMembers, users);
                  const paid = calculateVerifiedPaidForAssignment(a.id, groupPayments);
                  const { outstanding, overpaid } = calculateOutstandingBalance(
                    a.assignedAmount,
                    paid
                  );
                  const stove =
                    a.stoveTypeAtAssignment && isValidStoveType(a.stoveTypeAtAssignment)
                      ? STOVE_TYPE_LABELS[a.stoveTypeAtAssignment]
                      : m?.stoveType && isValidStoveType(m.stoveType)
                        ? STOVE_TYPE_LABELS[m.stoveType]
                        : 'Unclassified';

                  return (
                    <div
                      key={a.id}
                      className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#11192C] p-3.5 space-y-2.5 text-xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                            {m?.name || 'Registered Member'}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            {stove} {m?.phone ? `• ${m.phone}` : ''}
                          </div>
                        </div>
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                            overpaid > 0
                              ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                              : outstanding === 0
                                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                                : paid > 0
                                  ? 'bg-yellow-50 dark:bg-amber-950/50 text-yellow-800 dark:text-amber-300'
                                  : 'bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300'
                          }`}
                        >
                          {overpaid > 0
                            ? 'Overpaid'
                            : outstanding === 0
                              ? 'Fully Paid'
                              : paid > 0
                                ? 'Partial'
                                : 'Unpaid'}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200/70 dark:border-slate-800">
                        <div>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                            Expected
                          </span>
                          <span className="font-bold text-slate-900 dark:text-slate-100">
                            {formatMWK(a.assignedAmount)}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                            Verified
                          </span>
                          <span className="font-bold text-emerald-700 dark:text-emerald-400">
                            {formatMWK(paid)}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                            {overpaid > 0 ? 'Credit' : 'Owed'}
                          </span>
                          <span className="font-bold text-slate-900 dark:text-slate-100">
                            {overpaid > 0 ? `+${formatMWK(overpaid)}` : formatMWK(outstanding)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop & Print Table */}
              <div className="hidden md:block print:block border border-slate-200 dark:border-slate-800 print:border-slate-300 rounded-xl overflow-hidden overflow-x-auto">
                <table className="w-full text-left text-xs tabular-nums">
                  <thead className="bg-slate-100 dark:bg-[#11192C] print:bg-slate-100 text-slate-600 dark:text-slate-300 print:text-slate-700 uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="py-3 px-3">Member</th>
                      <th className="py-3 px-3">Stove Tier</th>
                      <th className="py-3 px-3">Expected (MWK)</th>
                      <th className="py-3 px-3">Verified Paid</th>
                      <th className="py-3 px-3">Outstanding</th>
                      <th className="py-3 px-3">Overpaid</th>
                      <th className="py-3 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 print:divide-slate-200">
                    {relatedAssignments.map((a) => {
                      const m = resolveMemberInfo(a.memberId, groupMembers, users);
                      const paid = calculateVerifiedPaidForAssignment(a.id, groupPayments);
                      const { outstanding, overpaid } = calculateOutstandingBalance(
                        a.assignedAmount,
                        paid
                      );
                      const stove =
                        a.stoveTypeAtAssignment && isValidStoveType(a.stoveTypeAtAssignment)
                          ? STOVE_TYPE_LABELS[a.stoveTypeAtAssignment]
                          : m?.stoveType && isValidStoveType(m.stoveType)
                            ? STOVE_TYPE_LABELS[m.stoveType]
                            : 'Unclassified';

                      return (
                        <tr
                          key={a.id}
                          className="hover:bg-slate-50/70 dark:hover:bg-[#11192C]/60 print:hover:bg-transparent"
                        >
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-slate-900 dark:text-slate-100 print:text-black">
                              {m?.name || 'Registered Member'}
                            </div>
                            {m?.phone && (
                              <div className="font-mono text-[10px] text-slate-500 dark:text-slate-400 print:text-slate-600">
                                {m.phone}
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300 print:text-slate-800">
                            {stove}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-slate-100 print:text-black">
                            {formatMWK(a.assignedAmount)}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-emerald-700 dark:text-emerald-400 print:text-emerald-700">
                            {formatMWK(paid)}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-slate-100 print:text-black">
                            {formatMWK(outstanding)}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-amber-700 dark:text-amber-400 print:text-amber-700">
                            {overpaid > 0 ? `+${formatMWK(overpaid)}` : 'MK 0'}
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                                overpaid > 0
                                  ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                                  : outstanding === 0
                                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                                    : paid > 0
                                      ? 'bg-yellow-50 dark:bg-amber-950/50 text-yellow-800 dark:text-amber-300'
                                      : 'bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300'
                              }`}
                            >
                              {overpaid > 0
                                ? 'Overpaid'
                                : outstanding === 0
                                  ? 'Fully Paid'
                                  : paid > 0
                                    ? 'Partial'
                                    : 'Unpaid'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 print:border-slate-200 flex flex-col sm:flex-row justify-between items-center text-[11px] text-slate-400 dark:text-slate-500 print:text-slate-600 gap-2">
          <span>Every Contribution. Every Transaction. Clear.</span>
          <span>UnitSpot Financial Accountability Ledger</span>
        </div>
      </div>
    </div>
  );
};

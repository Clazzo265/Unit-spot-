import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  formatMWK, 
  computeGroupFinancialSummary,
  calculateVerifiedPaidForAssignment,
  calculateOutstandingBalance 
} from '../../utils/financialCalculations';
import { 
  FileText, 
  Download, 
  CheckCircle, 
  Printer, 
  Calendar, 
  Users, 
  CreditCard,
  Building2 
} from 'lucide-react';

export const FinancialReportingView: React.FC = () => {
  const { currentGroup, contributions, assignments, payments, expenses, users } = useApp();

  const [selectedContributionId, setSelectedContributionId] = useState<string>('');

  if (!currentGroup) {
    return (
      <div className="bg-white rounded-2xl border border-neutral-200 p-12 text-center text-xs text-neutral-500">
        <Building2 className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
        <p className="font-semibold text-neutral-700">No active financial group</p>
        <p className="text-neutral-400 mt-1">Create or select a group to generate financial statements.</p>
      </div>
    );
  }

  const groupContributions = contributions.filter(c => c.groupId === currentGroup.id);
  const activeContribution = groupContributions.find(c => c.id === selectedContributionId) || groupContributions[0];

  const relatedAssignments = assignments.filter(a => 
    a.groupId === currentGroup.id && 
    (!activeContribution ? true : a.contributionId === activeContribution.id)
  );

  const totalApprovedExpenses = expenses
    .filter(e => e.groupId === currentGroup.id && e.status === 'approved')
    .reduce((sum, e) => sum + e.amount, 0);

  const summary = computeGroupFinancialSummary(
    relatedAssignments,
    payments.filter(p => p.groupId === currentGroup.id),
    totalApprovedExpenses
  );

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    const headers = ['Member Name', 'Phone', 'Assigned MWK', 'Verified Paid MWK', 'Outstanding MWK', 'Status'];
    const rows = relatedAssignments.map(a => {
      const u = users.find(usr => usr.id === a.memberId);
      const paid = calculateVerifiedPaidForAssignment(a.id, payments);
      const { outstanding } = calculateOutstandingBalance(a.assignedAmount, paid);
      return [
        `"${u?.name || 'Member'}"`,
        `"${u?.phone || ''}"`,
        a.assignedAmount,
        paid,
        outstanding,
        `"${a.status}"`,
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    const filenameDate = new Date().toISOString().split('T')[0];
    link.setAttribute('download', `KLARENCY_Report_${currentGroup.name.replace(/\s+/g, '_')}_${filenameDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900 tracking-tight">
            Financial Audit Reports & Statements
          </h2>
          <p className="text-sm text-neutral-500 mt-0.5">
            Verified audit records, member statements and CSV/Excel exportable reconciliations
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            Print Statement
          </button>
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 bg-neutral-900 hover:bg-black text-white px-4 py-2 rounded-xl text-xs font-bold transition-colors shadow-xs cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV / Excel
          </button>
        </div>
      </div>

      {/* Select Contribution */}
      {groupContributions.length > 0 && (
        <div className="flex items-center gap-3 bg-white p-3.5 rounded-2xl border border-neutral-200 text-xs">
          <span className="font-semibold text-neutral-700 whitespace-nowrap">
            Filter Contribution Period:
          </span>
          <select
            value={selectedContributionId || activeContribution?.id || ''}
            onChange={(e) => setSelectedContributionId(e.target.value)}
            className="bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-1.5 text-xs text-neutral-900 font-medium focus:outline-none"
          >
            {groupContributions.map(c => (
              <option key={c.id} value={c.id}>
                {c.title} (Target: {formatMWK(c.totalTargetAmount)})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Official Printable Statement Sheet */}
      <div className="bg-white rounded-3xl border border-neutral-200 p-8 shadow-sm space-y-6 print:border-none print:shadow-none">
        {/* Statement Header */}
        <div className="flex justify-between items-start border-b border-neutral-200 pb-6">
          <div>
            <div className="text-2xl font-extrabold text-neutral-900 tracking-tight">
              KLARENCY
            </div>
            <p className="text-xs text-neutral-500 uppercase tracking-widest font-semibold mt-0.5">
              Financial Accountability Platform • Malawi
            </p>
            <div className="mt-3 text-xs text-neutral-600">
              <div><strong>Group:</strong> {currentGroup.name}</div>
              <div><strong>Default Currency:</strong> Malawi Kwacha ({currentGroup.defaultCurrency})</div>
              <div><strong>Statement Date:</strong> {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
            </div>
          </div>

          <div className="text-right">
            <span className="inline-block bg-neutral-900 text-white font-mono text-[11px] px-3 py-1 rounded-lg uppercase tracking-wider font-bold">
              Official Statement
            </span>
            <div className="mt-2 text-xs text-neutral-500">
              Ref: <span className="font-mono">STMT-{Date.now().toString().slice(-6)}</span>
            </div>
          </div>
        </div>

        {/* High-Level Financial Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-neutral-50 rounded-2xl p-4 border border-neutral-100">
          <div>
            <span className="text-[11px] text-neutral-500 uppercase tracking-wider font-medium">Expected Target</span>
            <div className="text-lg font-bold text-neutral-900 mt-0.5">{formatMWK(summary.totalExpected)}</div>
          </div>
          <div>
            <span className="text-[11px] text-neutral-500 uppercase tracking-wider font-medium">Verified Collected</span>
            <div className="text-lg font-bold text-emerald-700 mt-0.5">{formatMWK(summary.totalVerified)}</div>
          </div>
          <div>
            <span className="text-[11px] text-neutral-500 uppercase tracking-wider font-medium">Outstanding Owed</span>
            <div className="text-lg font-bold text-rose-700 mt-0.5">{formatMWK(summary.totalOutstanding)}</div>
          </div>
          <div>
            <span className="text-[11px] text-neutral-500 uppercase tracking-wider font-medium">Approved Expenses</span>
            <div className="text-lg font-bold text-neutral-900 mt-0.5">{formatMWK(summary.totalExpensesApproved)}</div>
          </div>
        </div>

        {/* Member Breakdown Table */}
        <div>
          <h4 className="text-sm font-bold uppercase tracking-wider text-neutral-800 mb-3">
            Member Obligation & Settlement Schedule
          </h4>
          <div className="border border-neutral-200 rounded-xl overflow-hidden">
            {relatedAssignments.length === 0 ? (
              <div className="p-8 text-center text-neutral-400 text-xs">
                No obligations assigned in this statement period.
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-100 text-neutral-600 uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-2.5 px-3">Member</th>
                    <th className="py-2.5 px-3">Contact</th>
                    <th className="py-2.5 px-3">Expected (MWK)</th>
                    <th className="py-2.5 px-3">Verified Paid</th>
                    <th className="py-2.5 px-3">Outstanding Balance</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {relatedAssignments.map(a => {
                    const u = users.find(usr => usr.id === a.memberId);
                    const paid = calculateVerifiedPaidForAssignment(a.id, payments);
                    const { outstanding } = calculateOutstandingBalance(a.assignedAmount, paid);

                    return (
                      <tr key={a.id} className="hover:bg-neutral-50/50">
                        <td className="py-2.5 px-3 font-semibold text-neutral-900">
                          {u?.name || 'Member'}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-neutral-600">
                          {u?.phone}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-neutral-900">
                          {formatMWK(a.assignedAmount)}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-emerald-700">
                          {formatMWK(paid)}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-neutral-900">
                          {formatMWK(outstanding)}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            outstanding === 0 
                              ? 'bg-emerald-50 text-emerald-800' 
                              : paid > 0 
                                ? 'bg-yellow-50 text-yellow-800' 
                                : 'bg-rose-50 text-rose-800'
                          }`}>
                            {outstanding === 0 ? 'Fully Paid' : paid > 0 ? 'Partial' : 'Unpaid'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Footer Notes */}
        <div className="pt-4 border-t border-neutral-100 flex flex-col sm:flex-row justify-between items-center text-[11px] text-neutral-400 gap-2">
          <span>Every Contribution. Every Commitment. Every Transaction. Clear.</span>
          <span>Generated by KLARENCY Platform v1.0 • System Ledger Certified</span>
        </div>
      </div>
    </div>
  );
};

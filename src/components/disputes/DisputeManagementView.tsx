import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { Modal } from '../ui/Modal';
import { EmptyState } from '../ui/EmptyState';
import { Dispute } from '../../types';
import { formatMWK } from '../../utils/financialCalculations';
import { parseMWKInput, resolveMemberInfo } from '../../utils/financialConfig';
import { canUserManageGroup } from '../../utils/centralizedFinancialAdmin';
import { AlertTriangle, CheckCircle2, AlertCircle } from 'lucide-react';

export const DisputeManagementView: React.FC = () => {
  const {
    disputes,
    groupMembers,
    users,
    currentGroup,
    currentUser,
    submitDispute,
    resolveDispute,
  } = useApp();
  const { showToast } = useToast();

  const [isFiling, setIsFiling] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [claimedAmount, setClaimedAmount] = useState('');
  const [formError, setFormError] = useState('');
  const [selectedDisputeForResolution, setSelectedDisputeForResolution] = useState<Dispute | null>(
    null
  );
  const [resolutionNote, setResolutionNote] = useState('');
  const [resolutionError, setResolutionError] = useState('');

  const canResolve = canUserManageGroup(currentUser?.role);

  if (!currentGroup || !currentUser) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="No Active Financial Circle"
        description="Select or create an administrator group to inspect or log payment discrepancies."
      />
    );
  }

  const groupDisputes = disputes.filter((d) => d.groupId === currentGroup.id);

  const handleFileDispute = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!title.trim() || !description.trim()) {
      setFormError('Please provide both a subject and detailed explanation.');
      return;
    }

    let parsedClaim: number | undefined;
    if (claimedAmount.trim()) {
      const parsed = parseMWKInput(claimedAmount);
      if (!parsed.valid) {
        setFormError(parsed.error || 'Enter a valid whole MWK amount.');
        return;
      }
      parsedClaim = parsed.value;
    }

    submitDispute({
      groupId: currentGroup.id,
      memberId: currentUser.id,
      title: title.trim(),
      description: description.trim(),
      claimedAmount: parsedClaim,
    });

    showToast('Discrepancy report logged', {
      message: `"${title.trim()}" added to the permanent audit log.`,
      variant: 'info',
    });

    setTitle('');
    setDescription('');
    setClaimedAmount('');
    setIsFiling(false);
  };

  const handleResolveAction = (status: 'resolved' | 'rejected') => {
    if (!selectedDisputeForResolution) return;
    if (resolutionNote.trim().length < 5) {
      setResolutionError('Please enter a clear resolution explanation (at least 5 characters).');
      return;
    }
    resolveDispute(selectedDisputeForResolution.id, resolutionNote.trim(), status);
    showToast(status === 'resolved' ? 'Dispute resolved' : 'Dispute declined', {
      message: selectedDisputeForResolution.title,
      variant: status === 'resolved' ? 'success' : 'info',
    });
    setSelectedDisputeForResolution(null);
    setResolutionNote('');
    setResolutionError('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-50 tracking-tight">
            Dispute &amp; Discrepancy Resolution
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
            Transparent conflict resolution with permanent audit history. No disputed record is ever silently deleted.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setFormError('');
            setIsFiling(true);
          }}
          className="min-h-[44px] inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-black dark:bg-blue-600 dark:hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-colors shadow-xs cursor-pointer whitespace-nowrap"
        >
          <AlertTriangle className="w-4 h-4 text-[#E5B93C]" />
          <span>File Discrepancy Report</span>
        </button>
      </div>

      {/* Disputes List */}
      <div className="grid grid-cols-1 gap-4">
        {groupDisputes.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title="No Active Disputes"
            description="All member contributions and ledger records are currently reconciled with zero open discrepancies."
            actionLabel="Log New Discrepancy"
            onAction={() => {
              setFormError('');
              setIsFiling(true);
            }}
          />
        ) : (
          groupDisputes.map((d) => {
            const member = resolveMemberInfo(d.memberId, groupMembers, users);
            const isResolved = d.status === 'resolved';
            const isRejected = d.status === 'rejected';

            return (
              <div
                key={d.id}
                className="bg-white dark:bg-[#0D1424] rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0 border border-amber-200 dark:border-amber-800/60">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-slate-50 text-base leading-snug">
                        {d.title}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Reported for{' '}
                        <strong className="text-slate-800 dark:text-slate-200">
                          {member?.name || 'Member'}
                        </strong>{' '}
                        on{' '}
                        {new Date(d.createdAt).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                  </div>

                  <div>
                    <span
                      className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider ${
                        isResolved
                          ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60'
                          : isRejected
                            ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                            : 'bg-amber-50 dark:bg-amber-950/50 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-800/60'
                      }`}
                    >
                      {d.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-[#11192C] rounded-xl p-3.5 text-xs text-slate-700 dark:text-slate-300 leading-relaxed border border-slate-200/70 dark:border-slate-800">
                  {d.description}
                </div>

                {d.claimedAmount !== undefined && d.claimedAmount > 0 && (
                  <div className="text-xs text-slate-600 dark:text-slate-400 tabular-nums">
                    Disputed Amount in Question:{' '}
                    <strong className="text-slate-900 dark:text-slate-100">
                      {formatMWK(d.claimedAmount)}
                    </strong>
                  </div>
                )}

                {d.resolutionNote && (
                  <div className="bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl p-3 text-xs text-emerald-900 dark:text-emerald-200">
                    <strong className="block font-semibold mb-0.5">
                      Admin Resolution Outcome:
                    </strong>
                    {d.resolutionNote}
                  </div>
                )}

                {!isResolved && !isRejected && canResolve && (
                  <div className="pt-2 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setResolutionError('');
                        setResolutionNote('');
                        setSelectedDisputeForResolution(d);
                      }}
                      className="min-h-[44px] bg-slate-900 hover:bg-black dark:bg-blue-600 dark:hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                    >
                      Resolve Dispute
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* File Dispute Modal */}
      <Modal
        isOpen={isFiling}
        onClose={() => setIsFiling(false)}
        title="File Discrepancy or Payment Dispute"
        subtitle="Log a formal discrepancy record for audit review"
      >
        <form onSubmit={handleFileDispute} className="space-y-4 text-xs">
          {formError && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/60 text-rose-800 dark:text-rose-200 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
              <span>{formError}</span>
            </div>
          )}

          <div>
            <label
              htmlFor="dispute-title"
              className="block font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5"
            >
              Dispute Subject *
            </label>
            <input
              id="dispute-title"
              type="text"
              placeholder="e.g. Paid MK 10,000 via Airtel Money but only MK 7,000 recorded"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full min-h-[44px] bg-white dark:bg-[#11192C] border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label
              htmlFor="dispute-amount"
              className="block font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5"
            >
              Disputed Amount (MWK)
            </label>
            <input
              id="dispute-amount"
              type="text"
              inputMode="numeric"
              placeholder="e.g. 3000"
              value={claimedAmount}
              onChange={(e) => setClaimedAmount(e.target.value.replace(/[^\d]/g, ''))}
              className="w-full min-h-[44px] bg-white dark:bg-[#11192C] border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm tabular-nums text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="dispute-desc"
              className="block font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5"
            >
              Detailed Explanation &amp; Evidence *
            </label>
            <textarea
              id="dispute-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Include transaction references, date of payment or reason why assignment was questioned..."
              className="w-full bg-white dark:bg-[#11192C] border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsFiling(false)}
              className="min-h-[44px] px-4 py-2 text-slate-600 dark:text-slate-300 font-semibold rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="min-h-[44px] bg-slate-900 dark:bg-blue-600 text-white px-5 py-2 font-bold rounded-xl text-xs hover:bg-black dark:hover:bg-blue-500 transition-colors cursor-pointer"
            >
              Log Discrepancy
            </button>
          </div>
        </form>
      </Modal>

      {/* Resolve Dispute Modal */}
      <Modal
        isOpen={Boolean(selectedDisputeForResolution)}
        onClose={() => setSelectedDisputeForResolution(null)}
        title={
          selectedDisputeForResolution
            ? `Resolve: ${selectedDisputeForResolution.title}`
            : 'Resolve Dispute'
        }
        subtitle="Record the outcome. A permanent audit entry will be preserved in the ledger."
      >
        {selectedDisputeForResolution && (
          <div className="space-y-4 text-xs">
            {resolutionError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/60 text-rose-800 dark:text-rose-200 rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                <span>{resolutionError}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label
                htmlFor="dispute-resolution-note"
                className="block font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400"
              >
                Resolution Explanation &amp; Action Taken *
              </label>
              <textarea
                id="dispute-resolution-note"
                rows={3}
                value={resolutionNote}
                onChange={(e) => setResolutionNote(e.target.value)}
                placeholder="e.g. Verified Airtel Money SMS statement, credited missing MK 3,000 to ledger."
                className="w-full bg-white dark:bg-[#11192C] border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedDisputeForResolution(null)}
                className="min-h-[44px] px-4 py-2 text-slate-600 dark:text-slate-300 text-xs font-semibold rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleResolveAction('rejected')}
                className="min-h-[44px] bg-slate-100 dark:bg-[#131D33] hover:bg-rose-50 dark:hover:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-slate-200 dark:border-slate-700 px-4 py-2 rounded-xl text-xs font-bold cursor-pointer"
              >
                Decline Dispute
              </button>
              <button
                type="button"
                onClick={() => handleResolveAction('resolved')}
                className="min-h-[44px] bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-xl text-xs font-bold cursor-pointer"
              >
                Approve &amp; Resolve
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

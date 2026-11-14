import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
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
      <div className="bg-white rounded-2xl border border-neutral-200 p-12 text-center text-xs text-neutral-500">
        <AlertTriangle className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
        <p className="font-semibold text-neutral-700">No active financial circle</p>
        <p className="text-neutral-400 mt-1">Select or create a group to view or file disputes.</p>
      </div>
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
    setSelectedDisputeForResolution(null);
    setResolutionNote('');
    setResolutionError('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900 tracking-tight">
            Dispute &amp; Discrepancy Resolution
          </h2>
          <p className="text-sm text-neutral-500 mt-0.5">
            Transparent conflict resolution with permanent audit history. No disputed record is ever silently deleted.
          </p>
        </div>

        <button
          onClick={() => {
            setFormError('');
            setIsFiling(true);
          }}
          className="inline-flex items-center gap-2 bg-neutral-900 hover:bg-black text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-colors shadow-xs cursor-pointer"
        >
          <AlertTriangle className="w-4 h-4 text-[#D5A52B]" />
          File Discrepancy Report
        </button>
      </div>

      {/* Disputes List */}
      <div className="grid grid-cols-1 gap-4">
        {groupDisputes.length === 0 ? (
          <div className="bg-white rounded-2xl border border-neutral-200 p-12 text-center text-neutral-400">
            <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-500" />
            <p className="font-semibold text-neutral-700">No active disputes</p>
            <p className="text-xs text-neutral-400 mt-1">
              All member contributions and records are reconciled.
            </p>
          </div>
        ) : (
          groupDisputes.map((d) => {
            const member = resolveMemberInfo(d.memberId, groupMembers, users);
            const isResolved = d.status === 'resolved';
            const isRejected = d.status === 'rejected';

            return (
              <div
                key={d.id}
                className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-xs space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0 border border-amber-200">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-neutral-900 text-base leading-snug">
                        {d.title}
                      </h4>
                      <p className="text-xs text-neutral-500 mt-0.5">
                        Reported for{' '}
                        <strong className="text-neutral-800">{member?.name || 'Member'}</strong> on{' '}
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
                      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${
                        isResolved
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : isRejected
                            ? 'bg-neutral-100 text-neutral-600 border border-neutral-200'
                            : 'bg-amber-50 text-amber-900 border border-amber-300'
                      }`}
                    >
                      {d.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>

                <div className="bg-neutral-50 rounded-xl p-3.5 text-xs text-neutral-700 leading-relaxed border border-neutral-100">
                  {d.description}
                </div>

                {d.claimedAmount !== undefined && d.claimedAmount > 0 && (
                  <div className="text-xs text-neutral-600 tabular-nums">
                    Disputed Amount in Question:{' '}
                    <strong className="text-neutral-900">{formatMWK(d.claimedAmount)}</strong>
                  </div>
                )}

                {d.resolutionNote && (
                  <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-xl p-3 text-xs text-emerald-900">
                    <strong className="block font-semibold mb-0.5">
                      Admin Resolution Outcome:
                    </strong>
                    {d.resolutionNote}
                  </div>
                )}

                {!isResolved && !isRejected && canResolve && (
                  <div className="pt-2 flex justify-end gap-2">
                    <button
                      onClick={() => {
                        setResolutionError('');
                        setResolutionNote('');
                        setSelectedDisputeForResolution(d);
                      }}
                      className="bg-neutral-900 hover:bg-black text-white px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer"
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
      {isFiling && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-neutral-200 p-6 space-y-4">
            <h3 className="font-bold text-neutral-900 text-base">
              File Discrepancy or Payment Dispute
            </h3>
            <p className="text-xs text-neutral-500">
              Log a formal discrepancy record if a recorded amount, mobile money reference, or assignment requires investigation.
            </p>

            <form onSubmit={handleFileDispute} className="space-y-3 text-xs">
              {formError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block font-semibold uppercase tracking-wider text-neutral-600 mb-1">
                  Dispute Subject *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Paid MK 10,000 via Airtel Money but only MK 7,000 recorded"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold uppercase tracking-wider text-neutral-600 mb-1">
                  Disputed Amount (MWK)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="e.g. 3000"
                  value={claimedAmount}
                  onChange={(e) => setClaimedAmount(e.target.value.replace(/[^\d]/g, ''))}
                  className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs tabular-nums text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
                />
              </div>

              <div>
                <label className="block font-semibold uppercase tracking-wider text-neutral-600 mb-1">
                  Detailed Explanation &amp; Evidence *
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Include transaction references, date of payment or reason why assignment was questioned..."
                  className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsFiling(false)}
                  className="px-3 py-2 text-neutral-600 font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-neutral-900 text-white px-4 py-2 font-bold rounded-xl text-xs hover:bg-black transition-colors cursor-pointer"
                >
                  Log Discrepancy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Resolve Dispute Modal */}
      {selectedDisputeForResolution && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-neutral-200 p-6 space-y-4">
            <h3 className="font-bold text-neutral-900 text-base">
              Resolve Dispute: {selectedDisputeForResolution.title}
            </h3>
            <p className="text-xs text-neutral-600">
              Record the outcome. A permanent audit entry will be preserved in the ledger.
            </p>

            {resolutionError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{resolutionError}</span>
              </div>
            )}

            <div className="text-xs space-y-2">
              <label className="block font-semibold uppercase tracking-wider text-neutral-600">
                Resolution Explanation &amp; Action Taken *
              </label>
              <textarea
                rows={3}
                value={resolutionNote}
                onChange={(e) => setResolutionNote(e.target.value)}
                placeholder="e.g. Verified Airtel Money SMS statement, credited missing MK 3,000 to ledger."
                className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
                required
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedDisputeForResolution(null)}
                className="px-3 py-2 text-neutral-600 text-xs font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleResolveAction('rejected')}
                className="bg-neutral-100 hover:bg-rose-50 text-rose-700 px-3 py-2 rounded-xl text-xs font-bold cursor-pointer"
              >
                Decline Dispute
              </button>
              <button
                type="button"
                onClick={() => handleResolveAction('resolved')}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-bold cursor-pointer"
              >
                Approve &amp; Resolve
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import {
  formatMWK,
  calculateVerifiedPaidForAssignment,
} from '../../utils/financialCalculations';
import { resolveMemberInfo, toSafeIntMWK } from '../../utils/financialConfig';
import { Modal } from '../ui/Modal';
import { Clock, Calendar, CheckCircle2, AlertCircle } from 'lucide-react';

interface CreateCommitmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultAssignmentId?: string;
}

export const CreateCommitmentModal: React.FC<CreateCommitmentModalProps> = ({
  isOpen,
  onClose,
  defaultAssignmentId,
}) => {
  const {
    currentGroup,
    assignments,
    payments,
    groupMembers,
    users,
    contributions,
    createCommitment,
  } = useApp();
  const { showToast } = useToast();

  const groupAssignments = currentGroup
    ? assignments.filter((a) => a.groupId === currentGroup.id)
    : assignments;

  const openAssignments = groupAssignments.filter((a) => {
    const paid = calculateVerifiedPaidForAssignment(a.id, payments);
    return toSafeIntMWK(a.assignedAmount) - paid > 0;
  });

  const selectableAssignments = openAssignments.length > 0 ? openAssignments : groupAssignments;

  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>(
    defaultAssignmentId || selectableAssignments[0]?.id || ''
  );
  const [durationDays, setDurationDays] = useState<number>(7);
  const [notes, setNotes] = useState<string>(
    'Member promised to settle outstanding balance by the agreed deadline.'
  );
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen) return;
    if (defaultAssignmentId) {
      setSelectedAssignmentId(defaultAssignmentId);
    } else if (!selectedAssignmentId && selectableAssignments[0]?.id) {
      setSelectedAssignmentId(selectableAssignments[0].id);
    }
  }, [isOpen, defaultAssignmentId, selectableAssignments, selectedAssignmentId]);

  const currentAssignment = groupAssignments.find((a) => a.id === selectedAssignmentId);
  const member = resolveMemberInfo(currentAssignment?.memberId, groupMembers, users);
  const contribution = contributions.find((c) => c.id === currentAssignment?.contributionId);

  const verifiedPaid = currentAssignment
    ? calculateVerifiedPaidForAssignment(currentAssignment.id, payments)
    : 0;

  const outstanding = currentAssignment
    ? Math.max(0, toSafeIntMWK(currentAssignment.assignedAmount) - verifiedPaid)
    : 0;

  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + durationDays);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!currentAssignment) {
      setError('Please select a valid member contribution obligation.');
      return;
    }

    if (outstanding <= 0) {
      setError('This member has already fully settled this obligation. No commitment needed.');
      return;
    }

    const created = createCommitment({
      assignmentId: currentAssignment.id,
      promisedDate: targetDate.toISOString(),
      durationDays,
      notes: notes.trim(),
    });

    if (created) {
      showToast('Commitment Countdown Started', {
        message: `${durationDays}-day promise logged for ${member?.name || 'member'}.`,
      });
      setSuccess(true);
    } else {
      setError('Could not create commitment for this assignment.');
    }
  };

  const resetAndClose = () => {
    setSuccess(false);
    setError('');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={resetAndClose}
      title="Record Payment Commitment"
      subtitle="Register a member's promised settlement date"
      maxWidthClass="max-w-md"
    >
      {success ? (
        <div className="text-center py-4 space-y-3">
          <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h4 className="font-bold text-slate-900 dark:text-white text-lg">
            Commitment Registered
          </h4>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            The {durationDays}-day countdown timer has started for{' '}
            <strong className="text-slate-900 dark:text-white">{member?.name || 'Member'}</strong>
            {contribution ? ` (${contribution.title})` : ''} to settle remaining{' '}
            <strong className="text-slate-900 dark:text-white tabular-nums font-mono">
              {formatMWK(outstanding)}
            </strong>
            .
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={resetAndClose}
              className="min-h-[44px] bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white font-semibold px-6 py-2 rounded-xl text-xs transition-colors cursor-pointer"
            >
              Close &amp; Return
            </button>
          </div>
        </div>
      ) : selectableAssignments.length === 0 ? (
        <div className="text-center py-6 space-y-3">
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            No contribution assignments exist in this group yet.
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Create a shared contribution obligation first before recording a payment commitment.
          </p>
          <button
            type="button"
            onClick={resetAndClose}
            className="min-h-[44px] bg-slate-900 dark:bg-blue-600 text-white px-5 py-2 rounded-xl text-xs font-bold cursor-pointer"
          >
            Close
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div
              role="alert"
              className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs rounded-xl flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
              Member &amp; Contribution Obligation
            </label>
            <select
              value={selectedAssignmentId}
              onChange={(e) => setSelectedAssignmentId(e.target.value)}
              className="w-full min-h-[44px] bg-white dark:bg-[#11192C] border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white font-medium focus:outline-none"
            >
              {selectableAssignments.map((a) => {
                const m = resolveMemberInfo(a.memberId, groupMembers, users);
                const c = contributions.find((cn) => cn.id === a.contributionId);
                const pPaid = calculateVerifiedPaidForAssignment(a.id, payments);
                const remaining = Math.max(0, toSafeIntMWK(a.assignedAmount) - pPaid);

                return (
                  <option key={a.id} value={a.id}>
                    {m?.name || 'Member'} — {c?.title || 'Obligation'} (Remaining:{' '}
                    {formatMWK(remaining)})
                  </option>
                );
              })}
            </select>
          </div>

          <div className="p-3.5 bg-slate-50 dark:bg-[#11192C] rounded-xl border border-slate-200 dark:border-slate-800 flex justify-between items-center text-xs">
            <div>
              <span className="text-slate-500 dark:text-slate-400 block">
                Current Outstanding Balance:
              </span>
              <span className="text-base font-extrabold font-mono text-slate-900 dark:text-white tabular-nums">
                {formatMWK(outstanding)}
              </span>
            </div>
            <span className="text-xs font-bold text-amber-700 dark:text-[#E5B93C]">
              {outstanding > 0 ? 'Requires Promise' : 'Settled'}
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
              Agreed Commitment Duration
            </label>
            <div className="grid grid-cols-4 gap-2 text-xs">
              {[
                { days: 3, label: '3 Days' },
                { days: 7, label: '7 Days' },
                { days: 14, label: '14 Days' },
                { days: 30, label: '30 Days' },
              ].map((opt) => (
                <button
                  key={opt.days}
                  type="button"
                  onClick={() => setDurationDays(opt.days)}
                  className={`min-h-[42px] py-2 px-2 rounded-xl font-medium border transition-colors cursor-pointer ${
                    durationDays === opt.days
                      ? 'border-slate-900 dark:border-blue-500 bg-slate-900 dark:bg-blue-600 text-white font-bold'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-[#11192C] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#18233D]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-[#11192C] p-3 rounded-xl border border-slate-200 dark:border-slate-800">
            <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
            <span>
              Promised Deadline:{' '}
              <strong className="text-slate-900 dark:text-white">
                {targetDate.toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </strong>
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
              Commitment Notes / Agreed Terms
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-white dark:bg-[#11192C] border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
              placeholder="e.g. Member expects salary credit on Friday; will transfer via Airtel Money."
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={resetAndClose}
              className="min-h-[44px] px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#131D33] rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="min-h-[44px] bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white px-5 py-2 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Clock className="w-4 h-4 text-[#E5B93C] dark:text-white" />
              <span>Start Countdown</span>
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
};

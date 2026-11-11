import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { formatMWK } from '../../utils/financialCalculations';
import { X, Clock, Calendar, CheckCircle2, AlertCircle } from 'lucide-react';

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
  const { assignments, payments, users, contributions, createCommitment } = useApp();

  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>(
    defaultAssignmentId || assignments[0]?.id || ''
  );
  const [durationDays, setDurationDays] = useState<number>(7);
  const [notes, setNotes] = useState<string>('Member promised to settle outstanding balance next week.');
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<boolean>(false);

  React.useEffect(() => {
    if (defaultAssignmentId) {
      setSelectedAssignmentId(defaultAssignmentId);
    }
  }, [defaultAssignmentId]);

  if (!isOpen) return null;

  const currentAssignment = assignments.find(a => a.id === selectedAssignmentId);
  const member = users.find(u => u.id === currentAssignment?.memberId);
  const contribution = contributions.find(c => c.id === currentAssignment?.contributionId);

  const verifiedPaid = currentAssignment 
    ? payments
        .filter(p => p.assignmentId === currentAssignment.id && p.verificationStatus === 'verified')
        .reduce((sum, p) => sum + p.amountReceived, 0)
    : 0;

  const outstanding = currentAssignment 
    ? Math.max(0, currentAssignment.assignedAmount - verifiedPaid)
    : 0;

  // Calculate promised target date based on duration
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + durationDays);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (outstanding <= 0) {
      setError('This member has already fully settled this obligation. No commitment needed.');
      return;
    }

    const created = createCommitment({
      assignmentId: selectedAssignmentId,
      promisedDate: targetDate.toISOString(),
      durationDays,
      notes: notes.trim(),
    });

    if (created) {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-neutral-900 text-white flex items-center justify-center font-bold text-sm">
              <Clock className="w-4 h-4 text-[#D5A52B]" />
            </div>
            <div>
              <h3 className="font-bold text-neutral-900 text-base leading-tight">
                Record Payment Commitment
              </h3>
              <p className="text-xs text-neutral-500">
                Register a member&apos;s promised settlement date
              </p>
            </div>
          </div>
          <button 
            onClick={resetAndClose}
            className="text-neutral-400 hover:text-neutral-700 p-1.5 rounded-lg hover:bg-neutral-100 transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {success ? (
            <div className="text-center py-4 space-y-3">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-neutral-900 text-lg">
                Commitment Registered!
              </h4>
              <p className="text-xs text-neutral-600">
                The {durationDays}-day countdown timer has started for <strong className="text-neutral-900">{member?.name}</strong> to settle remaining <strong className="text-neutral-900">{formatMWK(outstanding)}</strong>.
              </p>
              <div className="pt-2">
                <button
                  onClick={resetAndClose}
                  className="bg-neutral-900 hover:bg-black text-white font-semibold px-5 py-2 rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Close & View Dashboard
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{error}</span>
                </div>
              )}

              {/* Assignment select */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-600 mb-1.5">
                  Member & Contribution Obligation
                </label>
                <select
                  value={selectedAssignmentId}
                  onChange={(e) => setSelectedAssignmentId(e.target.value)}
                  className="w-full bg-white border border-neutral-200 rounded-xl px-3.5 py-2.5 text-xs text-neutral-900 font-medium focus:outline-none focus:ring-2 focus:ring-neutral-900"
                >
                  {assignments.map(a => {
                    const m = users.find(u => u.id === a.memberId);
                    const c = contributions.find(cn => cn.id === a.contributionId);
                    const pPaid = payments
                      .filter(p => p.assignmentId === a.id && p.verificationStatus === 'verified')
                      .reduce((sum, p) => sum + p.amountReceived, 0);
                    const remaining = Math.max(0, a.assignedAmount - pPaid);

                    return (
                      <option key={a.id} value={a.id}>
                        {m?.name || 'Member'} — {c?.title} (Remaining: {formatMWK(remaining)})
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Outstanding Highlight */}
              <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 flex justify-between items-center text-xs">
                <div>
                  <span className="text-neutral-500 block">Current Outstanding Balance:</span>
                  <span className="text-base font-extrabold text-neutral-900">{formatMWK(outstanding)}</span>
                </div>
                <span className="bg-amber-100 text-amber-900 px-2 py-1 rounded-md text-[11px] font-semibold">
                  Requires Promise
                </span>
              </div>

              {/* Duration presets */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-600 mb-1.5">
                  Agreed Commitment Duration
                </label>
                <div className="grid grid-cols-4 gap-2 text-xs">
                  {[
                    { days: 3, label: '3 Days' },
                    { days: 7, label: '7 Days (1 Wk)' },
                    { days: 14, label: '14 Days (2 Wk)' },
                    { days: 30, label: '30 Days' },
                  ].map(opt => (
                    <button
                      key={opt.days}
                      type="button"
                      onClick={() => setDurationDays(opt.days)}
                      className={`py-2 px-2 rounded-xl font-medium border transition-colors ${
                        durationDays === opt.days
                          ? 'border-neutral-900 bg-neutral-900 text-white font-bold'
                          : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-100'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Calculated target date */}
              <div className="flex items-center gap-2 text-xs text-neutral-600 bg-neutral-50 p-2.5 rounded-xl border border-neutral-200">
                <Calendar className="w-4 h-4 text-neutral-400 shrink-0" />
                <span>
                  Promised Deadline: <strong className="text-neutral-900">{targetDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>
                </span>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-600 mb-1.5">
                  Commitment Notes / Agreed Terms
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs text-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-900"
                  placeholder="e.g. Member expects salary credit on Friday; will transfer via Airtel Money."
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={resetAndClose}
                  className="px-4 py-2 text-xs font-semibold text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-neutral-900 hover:bg-black text-white px-5 py-2 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Clock className="w-4 h-4 text-[#D5A52B]" />
                  Start Countdown
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

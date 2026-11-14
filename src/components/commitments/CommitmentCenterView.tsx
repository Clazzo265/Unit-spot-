import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { CommitmentCard } from './CommitmentCard';
import { resolveMemberInfo } from '../../utils/financialConfig';
import { canUserVerifyPayments } from '../../utils/centralizedFinancialAdmin';
import { Modal } from '../ui/Modal';
import { EmptyState } from '../ui/EmptyState';
import { Clock, Plus } from 'lucide-react';

export const CommitmentCenterView: React.FC<{
  onOpenCreateCommitment: (assignmentId?: string) => void;
  onOpenRecordPayment: (assignmentId?: string) => void;
}> = ({ onOpenCreateCommitment, onOpenRecordPayment }) => {
  const {
    commitments,
    groupMembers,
    users,
    contributions,
    currentGroup,
    currentUser,
    requestCommitmentExtension,
    approveCommitmentExtension,
  } = useApp();
  const { showToast } = useToast();

  const [filter, setFilter] = useState<'all' | 'active' | 'completed' | 'overdue'>('all');
  const [extensionModalCommitmentId, setExtensionModalCommitmentId] = useState<string | null>(null);
  const [extensionDays, setExtensionDays] = useState<number>(3);
  const [extensionReason, setExtensionReason] = useState<string>('');

  const canManage = canUserVerifyPayments(currentUser?.role);

  const groupCommitments = currentGroup
    ? commitments.filter((c) => c.groupId === currentGroup.id)
    : commitments;

  const filteredCommitments = groupCommitments.filter((c) => {
    if (filter === 'all') return true;
    if (filter === 'active') {
      return (
        c.status === 'active' ||
        c.status === 'due_soon' ||
        c.status === 'due_today' ||
        c.status === 'extension_requested' ||
        c.status === 'revised'
      );
    }
    if (filter === 'completed') {
      return c.status === 'completed' || c.currentOutstandingAmount <= 0;
    }
    if (filter === 'overdue') {
      return (
        c.status === 'overdue' ||
        (new Date(c.promisedDate).getTime() < Date.now() && c.currentOutstandingAmount > 0)
      );
    }
    return true;
  });

  const handleSendExtensionRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!extensionModalCommitmentId) return;

    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + extensionDays);

    requestCommitmentExtension(
      extensionModalCommitmentId,
      targetDate.toISOString(),
      extensionReason.trim() || 'Need a few more days to arrange funds.'
    );

    showToast('Extension Logged', {
      message: `Requested +${extensionDays} additional days for settlement.`,
      variant: 'info',
    });
    setExtensionModalCommitmentId(null);
    setExtensionReason('');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-br from-slate-900 via-[#0D162D] to-slate-900 rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden border border-slate-800 shadow-lg">
        <div className="relative z-10 max-w-2xl">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#E5B93C] mb-2">
            <Clock className="w-4 h-4" />
            <span>Commitment Tracker</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Commitment &amp; Countdown Engine
          </h2>
          <p className="text-slate-300 text-sm mt-2 leading-relaxed">
            When members pay partially, track their promised settlement dates with real-time countdown clocks, transparent extension approvals, and full audit accountability.
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => onOpenCreateCommitment()}
              className="min-h-[44px] bg-white hover:bg-slate-100 text-slate-900 text-xs font-bold px-4 py-2.5 rounded-xl transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Record New Commitment</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between gap-3 overflow-x-auto pb-1">
        <div className="inline-flex p-1 bg-slate-100 dark:bg-[#11192C] rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
          {[
            { id: 'all', label: `All Commitments (${groupCommitments.length})` },
            {
              id: 'active',
              label: `Active (${groupCommitments.filter((c) => c.currentOutstandingAmount > 0).length})`,
            },
            {
              id: 'completed',
              label: `Cleared (${groupCommitments.filter((c) => c.currentOutstandingAmount <= 0).length})`,
            },
            { id: 'overdue', label: 'Overdue' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id as 'all' | 'active' | 'completed' | 'overdue')}
              className={`min-h-[38px] px-3.5 py-1.5 rounded-lg font-medium transition-colors cursor-pointer whitespace-nowrap ${
                filter === tab.id
                  ? 'bg-white dark:bg-blue-600 text-slate-900 dark:text-white font-bold shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Commitment Cards */}
      {filteredCommitments.length === 0 ? (
        <EmptyState
          icon={Clock}
          title="No commitments found"
          description="When a partial payment is recorded, log a promised date to track accountability."
          actionLabel="Record New Commitment"
          onAction={() => onOpenCreateCommitment()}
          secondaryActionLabel={filter !== 'all' ? 'Show All' : undefined}
          onSecondaryAction={filter !== 'all' ? () => setFilter('all') : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredCommitments.map((commitment) => {
            const member = resolveMemberInfo(commitment.memberId, groupMembers, users);
            const contribution = contributions.find((c) => c.id === commitment.contributionId);

            return (
              <CommitmentCard
                key={commitment.id}
                commitment={commitment}
                member={member}
                contribution={contribution}
                canManage={canManage}
                onRecordPaymentClick={() => onOpenRecordPayment(commitment.assignmentId)}
                onRequestExtensionClick={() => setExtensionModalCommitmentId(commitment.id)}
                onApproveExtensionClick={() => {
                  approveCommitmentExtension(commitment.id, true);
                  showToast('Extension Approved', {
                    message: `Revised commitment deadline approved for ${member?.name || 'member'}.`,
                  });
                }}
              />
            );
          })}
        </div>
      )}

      {/* Extension Request Modal */}
      <Modal
        isOpen={Boolean(extensionModalCommitmentId)}
        onClose={() => {
          setExtensionModalCommitmentId(null);
          setExtensionReason('');
        }}
        title="Log Commitment Extension"
        subtitle="Record a member's request for additional days to complete settlement"
        maxWidthClass="max-w-sm"
      >
        <form onSubmit={handleSendExtensionRequest} className="space-y-3.5 text-xs">
          <div>
            <label className="block font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
              Additional Days Requested
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[3, 5, 7].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setExtensionDays(d)}
                  className={`min-h-[42px] py-2 rounded-xl font-bold border transition-colors cursor-pointer ${
                    extensionDays === d
                      ? 'bg-slate-900 dark:bg-blue-600 border-slate-900 dark:border-blue-500 text-white'
                      : 'bg-slate-50 dark:bg-[#11192C] border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#18233D]'
                  }`}
                >
                  +{d} Days
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
              Reason for Extension
            </label>
            <textarea
              rows={2}
              value={extensionReason}
              onChange={(e) => setExtensionReason(e.target.value)}
              placeholder="e.g. Awaiting salary disbursement on Friday"
              className="w-full bg-white dark:bg-[#11192C] border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none"
              required
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                setExtensionModalCommitmentId(null);
                setExtensionReason('');
              }}
              className="min-h-[44px] px-4 py-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="min-h-[44px] bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white px-4 py-2 font-bold rounded-xl text-xs transition-colors cursor-pointer"
            >
              Submit Request
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

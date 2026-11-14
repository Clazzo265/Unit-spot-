import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { CommitmentCard } from './CommitmentCard';
import { resolveMemberInfo } from '../../utils/financialConfig';
import { canUserVerifyPayments } from '../../utils/centralizedFinancialAdmin';
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

    setExtensionModalCommitmentId(null);
    setExtensionReason('');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-neutral-900 via-neutral-950 to-neutral-900 rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden border border-neutral-800 shadow-lg">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 bg-[#D5A52B]/20 text-[#D5A52B] border border-[#D5A52B]/30 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-3">
            <Clock className="w-3.5 h-3.5" />
            Commitment Tracker
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Commitment &amp; Countdown Engine
          </h2>
          <p className="text-neutral-300 text-sm mt-2 leading-relaxed">
            When members pay partially, track their promised settlement dates with real-time countdown clocks, transparent extension approvals, and full audit accountability.
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              onClick={() => onOpenCreateCommitment()}
              className="bg-white hover:bg-neutral-100 text-neutral-900 text-xs font-bold px-4 py-2.5 rounded-xl transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4 text-neutral-900" />
              Record New Commitment
            </button>
          </div>
        </div>

        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial from-[#D5A52B]/10 to-transparent pointer-events-none" />
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between gap-3 overflow-x-auto pb-1">
        <div className="inline-flex p-1 bg-neutral-100 rounded-xl border border-neutral-200 text-xs">
          {[
            { id: 'all', label: `All Commitments (${groupCommitments.length})` },
            {
              id: 'active',
              label: `Active Countdowns (${groupCommitments.filter((c) => c.currentOutstandingAmount > 0).length})`,
            },
            {
              id: 'completed',
              label: `Honoured / Cleared (${groupCommitments.filter((c) => c.currentOutstandingAmount <= 0).length})`,
            },
            { id: 'overdue', label: 'Overdue' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id as 'all' | 'active' | 'completed' | 'overdue')}
              className={`px-3.5 py-1.5 rounded-lg font-medium transition-all cursor-pointer whitespace-nowrap ${
                filter === tab.id
                  ? 'bg-white text-neutral-900 font-bold shadow-xs'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Commitment Cards */}
      {filteredCommitments.length === 0 ? (
        <div className="bg-white rounded-2xl border border-neutral-200 p-12 text-center text-neutral-500">
          <Clock className="w-8 h-8 mx-auto mb-2 text-neutral-300" />
          <p className="font-semibold text-neutral-700">No commitments found</p>
          <p className="text-xs text-neutral-400 mt-1">
            When a partial payment is recorded, log a promised date to track accountability.
          </p>
        </div>
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
                onApproveExtensionClick={() => approveCommitmentExtension(commitment.id, true)}
              />
            );
          })}
        </div>
      )}

      {/* Extension Request Modal */}
      {extensionModalCommitmentId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl border border-neutral-200 p-6 space-y-4">
            <h3 className="font-bold text-neutral-900 text-base">
              Log Commitment Extension
            </h3>
            <p className="text-xs text-neutral-500">
              Record a member&apos;s request for additional days to complete settlement.
            </p>

            <form onSubmit={handleSendExtensionRequest} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold uppercase tracking-wider text-neutral-600 mb-1">
                  Additional Days Requested
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[3, 5, 7].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setExtensionDays(d)}
                      className={`py-2 rounded-xl font-bold border transition-colors cursor-pointer ${
                        extensionDays === d
                          ? 'bg-neutral-900 border-neutral-900 text-white'
                          : 'bg-neutral-50 border-neutral-200 text-neutral-800 hover:bg-neutral-100'
                      }`}
                    >
                      +{d} Days
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-semibold uppercase tracking-wider text-neutral-600 mb-1">
                  Reason for Extension
                </label>
                <textarea
                  rows={2}
                  value={extensionReason}
                  onChange={(e) => setExtensionReason(e.target.value)}
                  placeholder="e.g. Awaiting salary disbursement on Friday"
                  className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
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
                  className="px-3 py-2 text-neutral-600 hover:text-neutral-900 font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-neutral-900 text-white px-4 py-2 font-bold rounded-xl text-xs hover:bg-black transition-colors cursor-pointer"
                >
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

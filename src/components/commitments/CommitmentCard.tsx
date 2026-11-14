import React, { useState, useEffect } from 'react';
import {
  computeCommitmentCountdown,
  formatMWK,
  CommitmentCountdownResult,
} from '../../utils/financialCalculations';
import { toSafeIntMWK } from '../../utils/financialConfig';
import { PaymentCommitment, Contribution } from '../../types';
import { Clock, AlertTriangle, CheckCircle2, ArrowRight } from 'lucide-react';

interface CommitmentMemberSummary {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string;
}

interface CommitmentCardProps {
  commitment: PaymentCommitment;
  member?: CommitmentMemberSummary | null;
  contribution?: Contribution;
  onRecordPaymentClick?: () => void;
  onRequestExtensionClick?: () => void;
  onApproveExtensionClick?: () => void;
  canManage?: boolean;
}

export const CommitmentCard: React.FC<CommitmentCardProps> = ({
  commitment,
  member,
  contribution,
  onRecordPaymentClick,
  onRequestExtensionClick,
  onApproveExtensionClick,
  canManage = false,
}) => {
  const [countdown, setCountdown] = useState<CommitmentCountdownResult>(() =>
    computeCommitmentCountdown(
      commitment.promisedDate,
      commitment.status,
      commitment.currentOutstandingAmount
    )
  );

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(
        computeCommitmentCountdown(
          commitment.promisedDate,
          commitment.status,
          commitment.currentOutstandingAmount
        )
      );
    }, 1000);
    return () => clearInterval(timer);
  }, [commitment.promisedDate, commitment.status, commitment.currentOutstandingAmount]);

  const originalAmount = toSafeIntMWK(commitment.originalOutstandingAmount);
  const currentAmount = toSafeIntMWK(commitment.currentOutstandingAmount);
  const paidAgainstCommitment = Math.max(0, originalAmount - currentAmount);
  const completionPercentage =
    originalAmount > 0 ? Math.min(100, Math.round((paidAgainstCommitment / originalAmount) * 100)) : 100;

  const getBadgeStyle = () => {
    if (countdown.computedStatus === 'completed' || currentAmount <= 0) {
      return {
        bg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        label: 'Honoured & Completed',
        icon: CheckCircle2,
      };
    }
    if (countdown.computedStatus === 'overdue' || countdown.isOverdue) {
      return {
        bg: 'bg-rose-50 text-rose-800 border-rose-200',
        label: 'Overdue Deadline',
        icon: AlertTriangle,
      };
    }
    if (commitment.status === 'extension_requested') {
      return {
        bg: 'bg-amber-50 text-amber-900 border-amber-300',
        label: 'Extension Requested',
        icon: Clock,
      };
    }
    if (countdown.isDueToday) {
      return {
        bg: 'bg-amber-50 text-amber-800 border-amber-200',
        label: 'Due Today',
        icon: Clock,
      };
    }
    if (countdown.isDueSoon) {
      return {
        bg: 'bg-yellow-50 text-yellow-800 border-yellow-200',
        label: 'Due Soon (<= 3 Days)',
        icon: Clock,
      };
    }
    return {
      bg: 'bg-neutral-100 text-neutral-800 border-neutral-200',
      label: 'Active Commitment',
      icon: Clock,
    };
  };

  const badge = getBadgeStyle();
  const IconComponent = badge.icon;

  return (
    <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-xs hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col justify-between">
      <div className="p-5 pb-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5">
            {member?.avatarUrl ? (
              <img
                src={member.avatarUrl}
                alt={member.name}
                className="w-10 h-10 rounded-full object-cover border border-neutral-200"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-neutral-100 text-neutral-700 font-bold flex items-center justify-center text-sm border border-neutral-200">
                {member?.name ? member.name.charAt(0).toUpperCase() : 'M'}
              </div>
            )}
            <div>
              <h4 className="font-semibold text-neutral-900 text-base leading-tight">
                {member?.name || 'Member'}
              </h4>
              <p className="text-xs text-neutral-500 mt-0.5">
                {contribution?.title || 'Shared Contribution'}
              </p>
            </div>
          </div>

          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${badge.bg}`}
          >
            <IconComponent className="w-3.5 h-3.5 shrink-0" />
            {badge.label}
          </span>
        </div>

        {/* Financial Promise Highlight Box */}
        <div className="bg-neutral-50 rounded-xl p-3.5 border border-neutral-100 mt-2">
          <div className="flex justify-between items-baseline mb-1">
            <span className="text-xs font-medium text-neutral-500">Remaining Promised</span>
            <span className="text-lg font-extrabold text-neutral-900 tracking-tight tabular-nums">
              {formatMWK(currentAmount)}
            </span>
          </div>

          <div className="flex justify-between text-xs text-neutral-500 mb-2 tabular-nums">
            <span>Original: {formatMWK(originalAmount)}</span>
            <span>Paid so far: {formatMWK(paidAgainstCommitment)}</span>
          </div>

          <div className="w-full h-2 bg-neutral-200 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                currentAmount <= 0
                  ? 'bg-emerald-500'
                  : countdown.isOverdue
                    ? 'bg-rose-500'
                    : 'bg-neutral-900'
              }`}
              style={{ width: `${completionPercentage}%` }}
            />
          </div>
        </div>

        {/* Countdown Digits Display */}
        <div className="mt-4 pt-3 border-t border-neutral-100">
          <div className="flex items-center justify-between text-xs text-neutral-500 mb-1.5">
            <span className="flex items-center gap-1 font-medium">
              <IconComponent className="w-3.5 h-3.5" />
              Commitment Deadline:
            </span>
            <span className="font-semibold text-neutral-800">
              {new Date(commitment.promisedDate).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </span>
          </div>

          {currentAmount > 0 ? (
            <div
              className={`grid grid-cols-4 gap-2 text-center p-2.5 rounded-xl tabular-nums ${
                countdown.isOverdue
                  ? 'bg-rose-50/70 border border-rose-100 text-rose-950'
                  : 'bg-neutral-900 text-white'
              }`}
            >
              <div className="flex flex-col">
                <span className="text-xl font-bold font-mono tracking-tight leading-none">
                  {String(countdown.days).padStart(2, '0')}
                </span>
                <span className="text-[10px] uppercase tracking-wider text-neutral-400 mt-1">
                  Days
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-bold font-mono tracking-tight leading-none">
                  {String(countdown.hours).padStart(2, '0')}
                </span>
                <span className="text-[10px] uppercase tracking-wider text-neutral-400 mt-1">
                  Hours
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-bold font-mono tracking-tight leading-none">
                  {String(countdown.minutes).padStart(2, '0')}
                </span>
                <span className="text-[10px] uppercase tracking-wider text-neutral-400 mt-1">
                  Mins
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-bold font-mono tracking-tight leading-none">
                  {String(countdown.seconds).padStart(2, '0')}
                </span>
                <span className="text-[10px] uppercase tracking-wider text-neutral-400 mt-1">
                  Secs
                </span>
              </div>
            </div>
          ) : (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-2.5 rounded-xl text-center font-medium text-xs flex items-center justify-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Obligation completely cleared! Zero debt remaining.
            </div>
          )}

          {commitment.notes && (
            <p className="text-xs text-neutral-500 italic mt-2.5 line-clamp-2">
              &ldquo;{commitment.notes}&rdquo;
            </p>
          )}

          {commitment.extensionCount > 0 && (
            <div className="text-[11px] text-amber-700 bg-amber-50/60 rounded-md px-2 py-0.5 mt-2 inline-block">
              Revised {commitment.extensionCount}{' '}
              {commitment.extensionCount === 1 ? 'time' : 'times'}
            </div>
          )}
        </div>
      </div>

      {/* Card Action Footer */}
      <div className="p-3 bg-neutral-50/80 border-t border-neutral-100 flex items-center justify-between gap-2">
        {currentAmount > 0 && onRecordPaymentClick && (
          <button
            onClick={onRecordPaymentClick}
            className="flex-1 bg-neutral-900 hover:bg-black text-white text-xs font-semibold py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
          >
            Record Payment
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}

        {commitment.status === 'extension_requested' && onApproveExtensionClick && canManage && (
          <button
            onClick={onApproveExtensionClick}
            className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold py-2 px-3 rounded-lg transition-colors cursor-pointer"
          >
            Approve Extension
          </button>
        )}

        {currentAmount > 0 && onRequestExtensionClick && (
          <button
            onClick={onRequestExtensionClick}
            className="text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/60 text-xs font-medium py-2 px-2.5 rounded-lg transition-colors cursor-pointer"
          >
            Request Extension
          </button>
        )}
      </div>
    </div>
  );
};

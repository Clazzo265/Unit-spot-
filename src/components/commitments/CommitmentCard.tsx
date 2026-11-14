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
    originalAmount > 0
      ? Math.min(100, Math.round((paidAgainstCommitment / originalAmount) * 100))
      : 100;

  const getStatusMeta = () => {
    if (countdown.computedStatus === 'completed' || currentAmount <= 0) {
      return {
        color: 'text-emerald-700 dark:text-emerald-400',
        label: 'Honoured & Completed',
        icon: CheckCircle2,
      };
    }
    if (countdown.computedStatus === 'overdue' || countdown.isOverdue) {
      return {
        color: 'text-rose-700 dark:text-rose-400',
        label: 'Overdue Deadline',
        icon: AlertTriangle,
      };
    }
    if (commitment.status === 'extension_requested') {
      return {
        color: 'text-amber-700 dark:text-[#E5B93C]',
        label: 'Extension Requested',
        icon: Clock,
      };
    }
    if (countdown.isDueToday) {
      return {
        color: 'text-amber-700 dark:text-[#E5B93C]',
        label: 'Due Today',
        icon: Clock,
      };
    }
    if (countdown.isDueSoon) {
      return {
        color: 'text-amber-700 dark:text-amber-300',
        label: 'Due Soon',
        icon: Clock,
      };
    }
    return {
      color: 'text-blue-600 dark:text-cyan-400',
      label: 'Active Commitment',
      icon: Clock,
    };
  };

  const statusMeta = getStatusMeta();
  const IconComponent = statusMeta.icon;

  return (
    <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden flex flex-col justify-between">
      <div className="p-5 pb-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            {member?.avatarUrl ? (
              <img
                src={member.avatarUrl}
                alt={member.name}
                referrerPolicy="no-referrer"
                className="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-slate-700 shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-[#131D33] text-slate-700 dark:text-slate-200 font-bold flex items-center justify-center text-sm border border-slate-200 dark:border-slate-700 shrink-0">
                {member?.name ? member.name.charAt(0).toUpperCase() : 'M'}
              </div>
            )}
            <div className="min-w-0">
              <h4 className="font-semibold text-slate-900 dark:text-white text-base leading-tight truncate">
                {member?.name || 'Member'}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                {contribution?.title || 'Shared Contribution'}
              </p>
            </div>
          </div>

          <span
            className={`inline-flex items-center gap-1 text-[11px] font-bold whitespace-nowrap shrink-0 ${statusMeta.color}`}
          >
            <IconComponent className="w-3.5 h-3.5 shrink-0" />
            {statusMeta.label}
          </span>
        </div>

        {/* Financial Promise Highlight Box */}
        <div className="bg-slate-50 dark:bg-[#11192C] rounded-xl p-3.5 border border-slate-200/80 dark:border-slate-800 mt-2">
          <div className="flex justify-between items-baseline mb-1">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Remaining Promised
            </span>
            <span className="text-lg font-extrabold font-mono text-slate-900 dark:text-white tracking-tight tabular-nums">
              {formatMWK(currentAmount)}
            </span>
          </div>

          <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mb-2 tabular-nums">
            <span>Original: {formatMWK(originalAmount)}</span>
            <span>Paid: {formatMWK(paidAgainstCommitment)}</span>
          </div>

          <div className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                currentAmount <= 0
                  ? 'bg-emerald-500'
                  : countdown.isOverdue
                    ? 'bg-rose-500'
                    : 'bg-blue-600 dark:bg-cyan-400'
              }`}
              style={{ width: `${completionPercentage}%` }}
            />
          </div>
        </div>

        {/* Countdown Digits Display */}
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
            <span className="flex items-center gap-1 font-medium">
              <IconComponent className="w-3.5 h-3.5" />
              Deadline:
            </span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">
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
                  ? 'bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-950 dark:text-rose-100'
                  : 'bg-slate-900 dark:bg-[#131D33] border border-slate-800 dark:border-slate-700 text-white'
              }`}
            >
              <div className="flex flex-col">
                <span className="text-xl font-bold font-mono tracking-tight leading-none">
                  {String(countdown.days).padStart(2, '0')}
                </span>
                <span className="text-[10px] uppercase tracking-wider text-slate-400 mt-1">
                  Days
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-bold font-mono tracking-tight leading-none">
                  {String(countdown.hours).padStart(2, '0')}
                </span>
                <span className="text-[10px] uppercase tracking-wider text-slate-400 mt-1">
                  Hours
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-bold font-mono tracking-tight leading-none">
                  {String(countdown.minutes).padStart(2, '0')}
                </span>
                <span className="text-[10px] uppercase tracking-wider text-slate-400 mt-1">
                  Mins
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-bold font-mono tracking-tight leading-none">
                  {String(countdown.seconds).padStart(2, '0')}
                </span>
                <span className="text-[10px] uppercase tracking-wider text-slate-400 mt-1">
                  Secs
                </span>
              </div>
            </div>
          ) : (
            <div className="bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 p-2.5 rounded-xl text-center font-medium text-xs flex items-center justify-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              Obligation completely cleared! Zero debt remaining.
            </div>
          )}

          {commitment.notes && (
            <p className="text-xs text-slate-500 dark:text-slate-400 italic mt-2.5 line-clamp-2">
              &ldquo;{commitment.notes}&rdquo;
            </p>
          )}

          {commitment.extensionCount > 0 && (
            <div className="text-[11px] text-amber-700 dark:text-[#E5B93C] font-medium mt-2">
              Revised {commitment.extensionCount}{' '}
              {commitment.extensionCount === 1 ? 'time' : 'times'}
            </div>
          )}
        </div>
      </div>

      {/* Card Action Footer */}
      <div className="p-3 bg-slate-50/80 dark:bg-[#10182B] border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
        {currentAmount > 0 && onRecordPaymentClick && (
          <button
            type="button"
            onClick={onRecordPaymentClick}
            className="flex-1 min-h-[40px] bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white text-xs font-semibold py-2 px-3 rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-xs cursor-pointer whitespace-nowrap"
          >
            <span>Record Payment</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}

        {commitment.status === 'extension_requested' && onApproveExtensionClick && canManage && (
          <button
            type="button"
            onClick={onApproveExtensionClick}
            className="min-h-[40px] bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold py-2 px-3 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
          >
            Approve Extension
          </button>
        )}

        {currentAmount > 0 && onRequestExtensionClick && (
          <button
            type="button"
            onClick={onRequestExtensionClick}
            className="min-h-[40px] text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-[#18233D] text-xs font-medium py-2 px-2.5 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
          >
            Request Extension
          </button>
        )}
      </div>
    </div>
  );
};

import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { Payment, PaymentVerificationStatus } from '../../types';
import { formatMWK } from '../../utils/financialCalculations';
import { resolveMemberInfo } from '../../utils/financialConfig';
import {
  canUserVerifyPayments,
  canUserReversePayments,
} from '../../utils/centralizedFinancialAdmin';
import { Modal } from '../ui/Modal';
import { EmptyState } from '../ui/EmptyState';
import {
  CheckCircle2,
  XCircle,
  Clock,
  CreditCard,
  Search,
  RotateCcw,
  Flag,
  AlertCircle,
  Image as ImageIcon,
} from 'lucide-react';

export const PaymentHistoryAndVerificationView: React.FC<{
  onOpenRecordModal: (assignmentId?: string) => void;
}> = ({ onOpenRecordModal }) => {
  const {
    currentGroup,
    payments,
    groupMembers,
    users,
    contributions,
    verifyPayment,
    reversePayment,
    disputePayment,
    currentUser,
  } = useApp();
  const { showToast } = useToast();

  const [filterStatus, setFilterStatus] = useState<'all' | PaymentVerificationStatus>('all');
  const [filterMethod, setFilterMethod] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');

  const [selectedPaymentForReview, setSelectedPaymentForReview] = useState<Payment | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [actionMode, setActionMode] = useState<'none' | 'reverse' | 'dispute'>('none');
  const [actionReason, setActionReason] = useState<string>('');
  const [modalError, setModalError] = useState<string>('');

  const canVerify = canUserVerifyPayments(currentUser?.role);
  const canReverse = canUserReversePayments(currentUser?.role);

  const groupPayments = useMemo(
    () => (currentGroup ? payments.filter((p) => p.groupId === currentGroup.id) : payments),
    [payments, currentGroup]
  );

  const filteredPayments = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return groupPayments.filter((p) => {
      if (filterStatus !== 'all' && p.verificationStatus !== filterStatus) return false;
      if (filterMethod !== 'all' && p.paymentMethod !== filterMethod) return false;

      if (fromDate) {
        const pDay = p.paymentDate.slice(0, 10);
        if (pDay < fromDate) return false;
      }
      if (toDate) {
        const pDay = p.paymentDate.slice(0, 10);
        if (pDay > toDate) return false;
      }

      if (q) {
        const m = resolveMemberInfo(p.memberId, groupMembers, users);
        const c = contributions.find((cn) => cn.id === p.contributionId);
        const hay = `${p.id} ${p.transactionReference} ${m?.name || ''} ${m?.email || ''} ${c?.title || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }

      return true;
    });
  }, [
    groupPayments,
    filterStatus,
    filterMethod,
    fromDate,
    toDate,
    searchQuery,
    groupMembers,
    users,
    contributions,
  ]);

  const hasActiveFilters =
    filterStatus !== 'all' ||
    filterMethod !== 'all' ||
    Boolean(searchQuery.trim()) ||
    Boolean(fromDate) ||
    Boolean(toDate);

  const resetFilters = () => {
    setFilterStatus('all');
    setFilterMethod('all');
    setSearchQuery('');
    setFromDate('');
    setToDate('');
  };

  const closeModal = () => {
    setSelectedPaymentForReview(null);
    setRejectionReason('');
    setActionMode('none');
    setActionReason('');
    setModalError('');
  };

  const handleApprove = (paymentId: string) => {
    setModalError('');
    const res = verifyPayment(paymentId, true);
    if (!res.success) {
      setModalError(res.error || 'Could not approve payment.');
      return;
    }
    showToast('Payment Verified', {
      message: `Transaction ${paymentId} applied to member balance.`,
    });
    closeModal();
  };

  const handleReject = (paymentId: string) => {
    setModalError('');
    if (!rejectionReason.trim()) {
      setModalError('Please provide a clear reason for rejecting this payment.');
      return;
    }
    const res = verifyPayment(paymentId, false, rejectionReason.trim());
    if (!res.success) {
      setModalError(res.error || 'Could not reject payment.');
      return;
    }
    showToast('Payment Rejected', {
      message: `Transaction ${paymentId} marked as rejected.`,
      variant: 'info',
    });
    closeModal();
  };

  const handleReverse = (paymentId: string) => {
    setModalError('');
    const res = reversePayment(paymentId, actionReason);
    if (!res.success) {
      setModalError(res.error || 'Could not reverse payment.');
      return;
    }
    showToast('Payment Reversed', {
      message: `Audit trail preserved for ${paymentId} and balances recalculated.`,
      variant: 'info',
    });
    closeModal();
  };

  const handleDispute = (paymentId: string) => {
    setModalError('');
    const res = disputePayment(paymentId, actionReason);
    if (!res.success) {
      setModalError(res.error || 'Could not flag payment as disputed.');
      return;
    }
    showToast('Dispute Logged', {
      message: `Transaction ${paymentId} flagged in Dispute Center.`,
      variant: 'info',
    });
    closeModal();
  };

  const renderStatusText = (status: PaymentVerificationStatus) => {
    switch (status) {
      case 'verified':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            Verified
          </span>
        );
      case 'pending_verification':
      case 'submitted':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-400 whitespace-nowrap">
            <Clock className="w-3.5 h-3.5 shrink-0" />
            {status === 'submitted' ? 'Submitted' : 'Pending Review'}
          </span>
        );
      case 'disputed':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-800 dark:text-amber-300 whitespace-nowrap">
            <Flag className="w-3.5 h-3.5 shrink-0" />
            Disputed
          </span>
        );
      case 'reversed':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 dark:text-slate-400 whitespace-nowrap">
            <RotateCcw className="w-3.5 h-3.5 shrink-0" />
            Reversed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700 dark:text-rose-400 whitespace-nowrap">
            <XCircle className="w-3.5 h-3.5 shrink-0" />
            Rejected
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Payments &amp; Verification
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Immutable audit ledger of every transaction, reference, reversal, and receipt proof
          </p>
        </div>

        <button
          type="button"
          onClick={() => onOpenRecordModal()}
          className="min-h-[44px] inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-colors shadow-xs cursor-pointer whitespace-nowrap"
        >
          <CreditCard className="w-4 h-4 text-[#E5B93C] dark:text-white" />
          <span>Record New Payment</span>
        </button>
      </div>

      {/* Search & Filters */}
      <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3 shadow-xs">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search member name, TX ID, or SMS/bank reference..."
              aria-label="Search payments"
              className="w-full min-h-[44px] bg-slate-50 dark:bg-[#11192C] border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none"
            />
          </div>

          <select
            value={filterMethod}
            onChange={(e) => setFilterMethod(e.target.value)}
            aria-label="Filter by payment method"
            className="min-h-[44px] bg-slate-50 dark:bg-[#11192C] border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 font-medium focus:outline-none"
          >
            <option value="all">All Payment Channels</option>
            <option value="tnm_mpamba">TNM Mpamba</option>
            <option value="airtel_money">Airtel Money</option>
            <option value="bank_transfer">Bank Transfer</option>
            <option value="cash">Physical Cash</option>
          </select>

          <div className="flex items-center gap-2 text-xs">
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              aria-label="From date"
              className="flex-1 min-h-[44px] bg-slate-50 dark:bg-[#11192C] border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-2 text-xs text-slate-800 dark:text-slate-200"
            />
            <span className="text-slate-400">to</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              aria-label="To date"
              className="flex-1 min-h-[44px] bg-slate-50 dark:bg-[#11192C] border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-2 text-xs text-slate-800 dark:text-slate-200"
            />
          </div>
        </div>

        {/* Status Tabs */}
        <div className="flex items-center justify-between gap-2 overflow-x-auto pb-0.5">
          <div className="inline-flex p-1 bg-slate-100 dark:bg-[#11192C] rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
            {(
              [
                { id: 'all', label: `All (${groupPayments.length})` },
                {
                  id: 'verified',
                  label: `Verified (${groupPayments.filter((p) => p.verificationStatus === 'verified').length})`,
                },
                {
                  id: 'pending_verification',
                  label: `Pending (${groupPayments.filter((p) => p.verificationStatus === 'pending_verification' || p.verificationStatus === 'submitted').length})`,
                },
                {
                  id: 'disputed',
                  label: `Disputed (${groupPayments.filter((p) => p.verificationStatus === 'disputed').length})`,
                },
                {
                  id: 'reversed',
                  label: `Reversed (${groupPayments.filter((p) => p.verificationStatus === 'reversed').length})`,
                },
                {
                  id: 'rejected',
                  label: `Rejected (${groupPayments.filter((p) => p.verificationStatus === 'rejected').length})`,
                },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterStatus(tab.id)}
                className={`min-h-[36px] px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  filterStatus === tab.id
                    ? 'bg-white dark:bg-blue-600 text-slate-900 dark:text-white font-bold shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Empty State or Responsive List / Table */}
      {filteredPayments.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title={
            hasActiveFilters
              ? 'No payments match your filters'
              : 'No transactions recorded yet'
          }
          description={
            hasActiveFilters
              ? 'Try clearing your search term, date range, or status tab to see all transactions.'
              : 'Record cash, Airtel Money, TNM Mpamba, or bank transfer payments with optional receipt photos.'
          }
          actionLabel={hasActiveFilters ? 'Reset Filters' : 'Record First Payment'}
          onAction={hasActiveFilters ? resetFilters : () => onOpenRecordModal()}
        />
      ) : (
        <>
          {/* Mobile Card View (< md) */}
          <div className="md:hidden space-y-3">
            {filteredPayments.map((p) => {
              const member = resolveMemberInfo(p.memberId, groupMembers, users);
              const contribution = contributions.find((c) => c.id === p.contributionId);
              const isPending =
                p.verificationStatus === 'pending_verification' ||
                p.verificationStatus === 'submitted';

              return (
                <div
                  key={p.id}
                  className="bg-white dark:bg-[#0D1424] rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3 shadow-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-bold text-sm text-slate-900 dark:text-white truncate">
                        {member?.name || 'Registered Member'}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                        {contribution?.title || 'Shared Obligation'}
                      </div>
                    </div>
                    <div className="text-right tabular-nums shrink-0">
                      <div
                        className={`font-black text-base font-mono ${
                          p.verificationStatus === 'reversed' ||
                          p.verificationStatus === 'rejected'
                            ? 'line-through text-slate-400'
                            : 'text-slate-900 dark:text-white'
                        }`}
                      >
                        {formatMWK(p.amountReceived)}
                      </div>
                      <div className="mt-0.5">{renderStatusText(p.verificationStatus)}</div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                    <div className="space-y-0.5">
                      <div>
                        <span className="uppercase font-semibold">
                          {p.paymentMethod.replace('_', ' ')}
                        </span>{' '}
                        · <span className="font-mono">{p.transactionReference}</span>
                      </div>
                      <div className="font-mono text-[10px]">
                        {p.id} ·{' '}
                        {new Date(p.paymentDate).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedPaymentForReview(p)}
                      className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-bold cursor-pointer whitespace-nowrap ${
                        isPending && canVerify
                          ? 'bg-slate-900 dark:bg-blue-600 text-white'
                          : 'bg-slate-100 dark:bg-[#131D33] text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {isPending && canVerify ? 'Review' : 'Details'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Table View (>= md) */}
          <div className="hidden md:block bg-white dark:bg-[#0D1424] rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50/80 dark:bg-[#10182B] border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4 font-semibold">Transaction ID</th>
                    <th className="py-3 px-4 font-semibold">Member</th>
                    <th className="py-3 px-4 font-semibold">Contribution</th>
                    <th className="py-3 px-4 font-semibold">Amount</th>
                    <th className="py-3 px-4 font-semibold">Method &amp; Reference</th>
                    <th className="py-3 px-4 font-semibold">Date</th>
                    <th className="py-3 px-4 font-semibold">Status</th>
                    <th className="py-3 px-4 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-slate-800 dark:text-slate-200">
                  {filteredPayments.map((p) => {
                    const member = resolveMemberInfo(p.memberId, groupMembers, users);
                    const contribution = contributions.find((c) => c.id === p.contributionId);
                    const isPending =
                      p.verificationStatus === 'pending_verification' ||
                      p.verificationStatus === 'submitted';

                    return (
                      <tr
                        key={p.id}
                        className="hover:bg-slate-50/70 dark:hover:bg-[#11192C]/70 transition-colors"
                      >
                        <td className="py-3 px-4 font-mono font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                          {p.id}
                        </td>

                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            {member?.avatarUrl ? (
                              <img
                                src={member.avatarUrl}
                                alt={member.name}
                                referrerPolicy="no-referrer"
                                className="w-7 h-7 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-[#131D33] flex items-center justify-center font-bold text-[10px]">
                                {member?.name.charAt(0) || 'M'}
                              </div>
                            )}
                            <div>
                              <span className="font-semibold text-slate-900 dark:text-white block">
                                {member?.name || 'Registered Member'}
                              </span>
                              {member?.memberRefId && (
                                <span className="text-[10px] font-mono text-slate-400">
                                  {member.memberRefId}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                          {contribution?.title || 'Shared Obligation'}
                        </td>

                        <td className="py-3 px-4 tabular-nums font-mono">
                          <span
                            className={`font-bold text-sm ${
                              p.verificationStatus === 'reversed' ||
                              p.verificationStatus === 'rejected'
                                ? 'line-through text-slate-400'
                                : 'text-slate-900 dark:text-white'
                            }`}
                          >
                            {formatMWK(p.amountReceived)}
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          <div>
                            <span className="font-semibold uppercase tracking-wider text-[10px] text-slate-500 dark:text-slate-400">
                              {p.paymentMethod.replace('_', ' ')}
                            </span>
                            <div className="font-mono text-slate-900 dark:text-slate-200 font-medium">
                              {p.transactionReference}
                            </div>
                            {(p.receiptImageUrl || p.receiptEvidenceUrl) && (
                              <button
                                type="button"
                                onClick={() => setSelectedPaymentForReview(p)}
                                className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 dark:text-cyan-400 hover:underline mt-0.5 cursor-pointer"
                              >
                                <ImageIcon className="w-3 h-3" />
                                <span>View Receipt</span>
                              </button>
                            )}
                          </div>
                        </td>

                        <td className="py-3 px-4 text-slate-500 dark:text-slate-400 whitespace-nowrap tabular-nums">
                          {new Date(p.paymentDate).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>

                        <td className="py-3 px-4">{renderStatusText(p.verificationStatus)}</td>

                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedPaymentForReview(p)}
                            className={`min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer whitespace-nowrap ${
                              isPending && canVerify
                                ? 'bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white'
                                : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#131D33] border border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            {isPending && canVerify ? 'Review' : 'Details'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Review, Verification, Reversal & Dispute Modal */}
      <Modal
        isOpen={Boolean(selectedPaymentForReview)}
        onClose={closeModal}
        title="Transaction Audit Details"
        subtitle={
          selectedPaymentForReview ? `Transaction ${selectedPaymentForReview.id}` : undefined
        }
        maxWidthClass="max-w-lg"
      >
        {selectedPaymentForReview && (
          <div className="space-y-4 text-xs">
            {modalError && (
              <div
                role="alert"
                className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 rounded-xl flex items-start gap-2"
              >
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
                <span>{modalError}</span>
              </div>
            )}

            {selectedPaymentForReview.receiptImageUrl ||
            selectedPaymentForReview.receiptEvidenceUrl ? (
              <div className="space-y-1.5">
                <span className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[11px] block">
                  Attached Receipt Picture
                </span>
                <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-950 flex items-center justify-center max-h-60">
                  <img
                    src={
                      selectedPaymentForReview.receiptImageUrl ||
                      selectedPaymentForReview.receiptEvidenceUrl
                    }
                    alt="Captured transaction receipt"
                    className="w-full max-h-60 object-contain"
                  />
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#11192C] border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-center">
                No receipt image uploaded. Recorded with transaction reference.
              </div>
            )}

            <div className="bg-slate-50 dark:bg-[#11192C] p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2 tabular-nums">
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Transaction ID</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  {selectedPaymentForReview.id}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Member</span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {resolveMemberInfo(selectedPaymentForReview.memberId, groupMembers, users)
                    ?.name || 'Registered Member'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Amount Received</span>
                <span className="font-bold font-mono text-slate-900 dark:text-white text-sm">
                  {formatMWK(selectedPaymentForReview.amountReceived)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Payment Channel</span>
                <span className="font-semibold text-slate-900 dark:text-white uppercase">
                  {selectedPaymentForReview.paymentMethod.replace('_', ' ')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Reference</span>
                <span className="font-mono font-semibold text-slate-900 dark:text-white">
                  {selectedPaymentForReview.transactionReference}
                </span>
              </div>
              <div className="flex justify-between items-center pt-1.5 border-t border-slate-200 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400">Status</span>
                {renderStatusText(selectedPaymentForReview.verificationStatus)}
              </div>
            </div>

            {selectedPaymentForReview.receiptNote && (
              <div className="text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-[#11192C] p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                <span className="font-semibold text-slate-700 dark:text-slate-200 block mb-1">
                  Receipt Note
                </span>
                {selectedPaymentForReview.receiptNote}
              </div>
            )}

            {selectedPaymentForReview.reversalReason && (
              <div className="bg-slate-100 dark:bg-[#131D33] border border-slate-300 dark:border-slate-700 p-3 rounded-xl space-y-1">
                <span className="font-bold text-slate-900 dark:text-white block">
                  Payment Reversed ({selectedPaymentForReview.reversedAt?.slice(0, 10)})
                </span>
                <p className="text-slate-700 dark:text-slate-300">
                  Reason: {selectedPaymentForReview.reversalReason}
                </p>
              </div>
            )}

            {selectedPaymentForReview.disputeReason && (
              <div className="bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 p-3 rounded-xl space-y-1">
                <span className="font-bold text-amber-900 dark:text-amber-200 block">
                  Flagged Disputed
                </span>
                <p className="text-amber-800 dark:text-amber-300">
                  {selectedPaymentForReview.disputeReason}
                </p>
              </div>
            )}

            {selectedPaymentForReview.rejectionReason && (
              <div className="bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 p-3 rounded-xl space-y-1">
                <span className="font-bold text-rose-900 dark:text-rose-200 block">
                  Rejection Reason
                </span>
                <p className="text-rose-800 dark:text-rose-300">
                  {selectedPaymentForReview.rejectionReason}
                </p>
              </div>
            )}

            {/* Pending Verification Actions */}
            {(selectedPaymentForReview.verificationStatus === 'pending_verification' ||
              selectedPaymentForReview.verificationStatus === 'submitted') &&
              canVerify && (
                <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <div>
                    <label className="block font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">
                      Rejection Reason (required if rejecting)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Reference code not found on Airtel Money statement"
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      className="w-full min-h-[44px] bg-white dark:bg-[#11192C] border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleReject(selectedPaymentForReview.id)}
                      className="flex-1 min-h-[44px] bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900/70 text-rose-700 dark:text-rose-300 font-bold py-2.5 rounded-xl border border-rose-200 dark:border-rose-800 transition-colors cursor-pointer"
                    >
                      Reject Payment
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApprove(selectedPaymentForReview.id)}
                      className="flex-1 min-h-[44px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl transition-colors shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Verify &amp; Approve</span>
                    </button>
                  </div>
                </div>
              )}

            {/* Non-destructive Reversal / Dispute Controls */}
            {selectedPaymentForReview.verificationStatus !== 'reversed' &&
              (canReverse || canVerify) && (
                <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-3">
                  {actionMode === 'none' ? (
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      {canVerify &&
                        selectedPaymentForReview.verificationStatus !== 'disputed' && (
                          <button
                            type="button"
                            onClick={() => {
                              setActionMode('dispute');
                              setActionReason('');
                              setModalError('');
                            }}
                            className="min-h-[44px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-amber-900 dark:text-amber-200 font-semibold cursor-pointer"
                          >
                            <Flag className="w-3.5 h-3.5" />
                            <span>Flag Disputed</span>
                          </button>
                        )}
                      {canReverse && (
                        <button
                          type="button"
                          onClick={() => {
                            setActionMode('reverse');
                            setActionReason('');
                            setModalError('');
                          }}
                          className="min-h-[44px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-800 dark:text-rose-300 font-semibold cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Reverse Payment</span>
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#11192C] space-y-2.5">
                      <label className="block font-bold text-slate-900 dark:text-white">
                        {actionMode === 'reverse'
                          ? 'Reversal Reason (original record remains in audit log) *'
                          : 'Dispute Reason (creates linked dispute ticket) *'}
                      </label>
                      <textarea
                        rows={2}
                        value={actionReason}
                        onChange={(e) => setActionReason(e.target.value)}
                        placeholder={
                          actionMode === 'reverse'
                            ? 'e.g. Duplicate entry for MP847219 or wrong member selected'
                            : 'e.g. Receipt image mismatch or disputed mobile money amount'
                        }
                        className="w-full bg-white dark:bg-[#0D1424] border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white"
                      />
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setActionMode('none');
                            setActionReason('');
                            setModalError('');
                          }}
                          className="min-h-[40px] px-3 py-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 font-semibold cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            actionMode === 'reverse'
                              ? handleReverse(selectedPaymentForReview.id)
                              : handleDispute(selectedPaymentForReview.id)
                          }
                          className={`min-h-[40px] px-4 py-1.5 rounded-lg font-bold text-white cursor-pointer ${
                            actionMode === 'reverse'
                              ? 'bg-rose-600 hover:bg-rose-700'
                              : 'bg-amber-600 hover:bg-amber-700'
                          }`}
                        >
                          {actionMode === 'reverse' ? 'Confirm Reversal' : 'Confirm Dispute'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
          </div>
        )}
      </Modal>
    </div>
  );
};

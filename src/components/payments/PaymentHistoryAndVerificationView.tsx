import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Payment, PaymentVerificationStatus } from '../../types';
import { formatMWK } from '../../utils/financialCalculations';
import { resolveMemberInfo } from '../../utils/financialConfig';
import {
  canUserVerifyPayments,
  canUserReversePayments,
} from '../../utils/centralizedFinancialAdmin';
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
  X,
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
  const [feedbackBanner, setFeedbackBanner] = useState<string>('');

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
    setFeedbackBanner(`Payment ${paymentId} verified and applied to member balance.`);
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
    setFeedbackBanner(`Payment ${paymentId} marked as rejected.`);
    closeModal();
  };

  const handleReverse = (paymentId: string) => {
    setModalError('');
    const res = reversePayment(paymentId, actionReason);
    if (!res.success) {
      setModalError(res.error || 'Could not reverse payment.');
      return;
    }
    setFeedbackBanner(
      `Payment ${paymentId} reversed. Original audit record preserved and balances recalculated.`
    );
    closeModal();
  };

  const handleDispute = (paymentId: string) => {
    setModalError('');
    const res = disputePayment(paymentId, actionReason);
    if (!res.success) {
      setModalError(res.error || 'Could not flag payment as disputed.');
      return;
    }
    setFeedbackBanner(`Payment ${paymentId} flagged as disputed and logged in Dispute Center.`);
    closeModal();
  };

  const renderStatusBadge = (status: PaymentVerificationStatus) => {
    switch (status) {
      case 'verified':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 whitespace-nowrap">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Verified
          </span>
        );
      case 'pending_verification':
      case 'submitted':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200 whitespace-nowrap">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            {status === 'submitted' ? 'Submitted' : 'Pending Verification'}
          </span>
        );
      case 'disputed':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-900 bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-300 whitespace-nowrap">
            <Flag className="w-3.5 h-3.5 text-amber-700" />
            Disputed
          </span>
        );
      case 'reversed':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-neutral-700 bg-neutral-100 px-2.5 py-0.5 rounded-full border border-neutral-300 whitespace-nowrap">
            <RotateCcw className="w-3.5 h-3.5 text-neutral-600" />
            Reversed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200 whitespace-nowrap">
            <XCircle className="w-3.5 h-3.5 text-rose-600" />
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
          <h2 className="text-2xl font-bold text-neutral-900 tracking-tight">
            Payments & Verification
          </h2>
          <p className="text-sm text-neutral-500 mt-0.5">
            Immutable audit ledger of every transaction, reference, reversal, and receipt proof
          </p>
        </div>

        <button
          type="button"
          onClick={() => onOpenRecordModal()}
          className="inline-flex items-center gap-2 bg-neutral-900 hover:bg-black text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-colors shadow-xs cursor-pointer whitespace-nowrap"
        >
          <CreditCard className="w-4 h-4 text-[#D5A52B]" />
          <span>Record New Payment</span>
        </button>
      </div>

      {feedbackBanner && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-900">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{feedbackBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackBanner('')}
            className="text-emerald-700 hover:text-emerald-950 font-bold px-2 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Search & Filters */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-4 space-y-3 shadow-xs">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search member name, TX ID, or SMS/bank reference..."
              className="w-full bg-neutral-50 border border-neutral-200 rounded-xl pl-10 pr-4 py-2 text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
            />
          </div>

          <select
            value={filterMethod}
            onChange={(e) => setFilterMethod(e.target.value)}
            className="bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-xs text-neutral-800 font-medium focus:outline-none focus:ring-2 focus:ring-neutral-900"
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
              className="bg-neutral-50 border border-neutral-200 rounded-xl px-2.5 py-2 text-xs text-neutral-800"
            />
            <span className="text-neutral-400">to</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              aria-label="To date"
              className="bg-neutral-50 border border-neutral-200 rounded-xl px-2.5 py-2 text-xs text-neutral-800"
            />
          </div>
        </div>

        {/* Status Tabs */}
        <div className="flex items-center justify-between gap-2 overflow-x-auto pb-0.5">
          <div className="inline-flex p-1 bg-neutral-100 rounded-xl border border-neutral-200 text-xs">
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
                className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer whitespace-nowrap ${
                  filterStatus === tab.id
                    ? 'bg-white text-neutral-900 font-bold shadow-xs'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Payments Table Card */}
      <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-neutral-50/80 border-b border-neutral-200/80 text-neutral-500 uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4 font-semibold">Transaction ID</th>
                <th className="py-3 px-4 font-semibold">Member</th>
                <th className="py-3 px-4 font-semibold">Contribution</th>
                <th className="py-3 px-4 font-semibold">Amount</th>
                <th className="py-3 px-4 font-semibold">Method & Reference</th>
                <th className="py-3 px-4 font-semibold">Date & Time</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 text-neutral-800">
              {filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-neutral-400">
                    No transactions matching the active filter criteria.
                  </td>
                </tr>
              ) : (
                filteredPayments.map((p) => {
                  const member = resolveMemberInfo(p.memberId, groupMembers, users);
                  const contribution = contributions.find((c) => c.id === p.contributionId);
                  const isPending =
                    p.verificationStatus === 'pending_verification' ||
                    p.verificationStatus === 'submitted';

                  return (
                    <tr key={p.id} className="hover:bg-neutral-50/60 transition-colors">
                      <td className="py-3 px-4 font-mono font-semibold text-neutral-900 whitespace-nowrap">
                        {p.id}
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          {member?.avatarUrl ? (
                            <img
                              src={member.avatarUrl}
                              alt={member.name}
                              className="w-6 h-6 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-neutral-200 flex items-center justify-center font-bold text-[10px]">
                              {member?.name.charAt(0) || 'M'}
                            </div>
                          )}
                          <div>
                            <span className="font-semibold text-neutral-900 block">
                              {member?.name || 'Registered Member'}
                            </span>
                            {member?.memberRefId && (
                              <span className="text-[10px] font-mono text-neutral-400">
                                {member.memberRefId}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4 text-neutral-600">
                        {contribution?.title || 'Shared Obligation'}
                      </td>

                      <td className="py-3 px-4 tabular-nums">
                        <span
                          className={`font-bold text-sm ${
                            p.verificationStatus === 'reversed' ||
                            p.verificationStatus === 'rejected'
                              ? 'line-through text-neutral-400'
                              : 'text-neutral-900'
                          }`}
                        >
                          {formatMWK(p.amountReceived)}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <div>
                          <span className="font-semibold uppercase tracking-wider text-[10px] text-neutral-500">
                            {p.paymentMethod.replace('_', ' ')}
                          </span>
                          <div className="font-mono text-neutral-900 font-medium">
                            {p.transactionReference}
                          </div>
                          {(p.receiptImageUrl || p.receiptEvidenceUrl) && (
                            <button
                              type="button"
                              onClick={() => setSelectedPaymentForReview(p)}
                              className="inline-flex items-center gap-1 text-[10px] font-bold text-neutral-800 bg-neutral-100 hover:bg-neutral-200 px-2 py-0.5 rounded-md mt-1 border border-neutral-200 transition-colors cursor-pointer"
                            >
                              <ImageIcon className="w-3 h-3 text-emerald-600" />
                              <span>Photo Proof</span>
                            </button>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-neutral-500 whitespace-nowrap tabular-nums">
                        {new Date(p.paymentDate).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>

                      <td className="py-3 px-4">{renderStatusBadge(p.verificationStatus)}</td>

                      <td className="py-3 px-4 text-right">
                        {isPending && canVerify ? (
                          <button
                            type="button"
                            onClick={() => setSelectedPaymentForReview(p)}
                            className="bg-neutral-900 hover:bg-black text-white px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap"
                          >
                            Review
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setSelectedPaymentForReview(p)}
                            className="text-neutral-600 hover:text-neutral-900 px-2.5 py-1 rounded-lg hover:bg-neutral-100 text-xs font-medium cursor-pointer"
                          >
                            Details
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Review, Verification, Reversal & Dispute Modal */}
      {selectedPaymentForReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/70">
              <h3 className="font-bold text-neutral-900 text-base">
                Transaction Audit Details
              </h3>
              <button
                type="button"
                onClick={closeModal}
                className="text-neutral-400 hover:text-neutral-700 p-1.5 rounded-lg hover:bg-neutral-100 cursor-pointer"
                aria-label="Close transaction modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs overflow-y-auto">
              {modalError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                  <span>{modalError}</span>
                </div>
              )}

              {(selectedPaymentForReview.receiptImageUrl ||
                selectedPaymentForReview.receiptEvidenceUrl) ? (
                <div className="space-y-1.5">
                  <span className="font-bold text-neutral-800 uppercase tracking-wider text-[11px] block">
                    Attached Receipt Picture
                  </span>
                  <div className="rounded-xl overflow-hidden border border-neutral-200 bg-neutral-950 flex items-center justify-center max-h-60">
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
                <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-200 text-neutral-500 text-center">
                  No receipt image uploaded. Recorded with transaction reference.
                </div>
              )}

              <div className="bg-neutral-50 p-4 rounded-xl border border-neutral-200 space-y-2 tabular-nums">
                <div className="flex justify-between">
                  <span className="text-neutral-500">Transaction ID</span>
                  <span className="font-mono font-bold text-neutral-900">
                    {selectedPaymentForReview.id}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Member</span>
                  <span className="font-semibold text-neutral-900">
                    {resolveMemberInfo(selectedPaymentForReview.memberId, groupMembers, users)
                      ?.name || 'Registered Member'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Amount Received</span>
                  <span className="font-bold text-neutral-900 text-sm">
                    {formatMWK(selectedPaymentForReview.amountReceived)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Payment Channel</span>
                  <span className="font-semibold text-neutral-900 uppercase">
                    {selectedPaymentForReview.paymentMethod.replace('_', ' ')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Reference</span>
                  <span className="font-mono font-semibold text-neutral-900">
                    {selectedPaymentForReview.transactionReference}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-neutral-200">
                  <span className="text-neutral-500">Status</span>
                  {renderStatusBadge(selectedPaymentForReview.verificationStatus)}
                </div>
              </div>

              {selectedPaymentForReview.receiptNote && (
                <div className="text-neutral-600 bg-neutral-50 p-3 rounded-xl border border-neutral-200/70">
                  <span className="font-semibold text-neutral-700 block mb-1">Receipt Note</span>
                  {selectedPaymentForReview.receiptNote}
                </div>
              )}

              {selectedPaymentForReview.reversalReason && (
                <div className="bg-neutral-100 border border-neutral-300 p-3 rounded-xl space-y-1">
                  <span className="font-bold text-neutral-900 block">
                    Payment Reversed ({selectedPaymentForReview.reversedAt?.slice(0, 10)})
                  </span>
                  <p className="text-neutral-700">
                    Reason: {selectedPaymentForReview.reversalReason}
                  </p>
                </div>
              )}

              {selectedPaymentForReview.disputeReason && (
                <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl space-y-1">
                  <span className="font-bold text-amber-900 block">Flagged Disputed</span>
                  <p className="text-amber-800">{selectedPaymentForReview.disputeReason}</p>
                </div>
              )}

              {selectedPaymentForReview.rejectionReason && (
                <div className="bg-rose-50 border border-rose-200 p-3 rounded-xl space-y-1">
                  <span className="font-bold text-rose-900 block">Rejection Reason</span>
                  <p className="text-rose-800">{selectedPaymentForReview.rejectionReason}</p>
                </div>
              )}

              {/* Pending Verification Actions */}
              {(selectedPaymentForReview.verificationStatus === 'pending_verification' ||
                selectedPaymentForReview.verificationStatus === 'submitted') &&
                canVerify && (
                  <div className="space-y-3 pt-2 border-t border-neutral-100">
                    <div>
                      <label className="block font-semibold uppercase tracking-wider text-neutral-600 mb-1">
                        Rejection Reason (required if rejecting)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Reference code not found on Airtel Money statement"
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleReject(selectedPaymentForReview.id)}
                        className="flex-1 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold py-2.5 rounded-xl border border-rose-200 transition-colors cursor-pointer"
                      >
                        Reject Payment
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApprove(selectedPaymentForReview.id)}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl transition-colors shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Verify & Approve</span>
                      </button>
                    </div>
                  </div>
                )}

              {/* Non-destructive Reversal / Dispute Controls */}
              {selectedPaymentForReview.verificationStatus !== 'reversed' &&
                (canReverse || canVerify) && (
                  <div className="pt-3 border-t border-neutral-100 space-y-3">
                    {actionMode === 'none' ? (
                      <div className="flex items-center justify-end gap-2">
                        {canVerify &&
                          selectedPaymentForReview.verificationStatus !== 'disputed' && (
                            <button
                              type="button"
                              onClick={() => {
                                setActionMode('dispute');
                                setActionReason('');
                                setModalError('');
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 font-semibold cursor-pointer"
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
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-800 font-semibold cursor-pointer"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Reverse Payment</span>
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="p-3.5 rounded-xl border border-neutral-200 bg-neutral-50 space-y-2.5">
                        <label className="block font-bold text-neutral-900">
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
                          className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs text-neutral-900"
                        />
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setActionMode('none');
                              setActionReason('');
                              setModalError('');
                            }}
                            className="px-3 py-1.5 rounded-lg text-neutral-600 hover:bg-neutral-200 font-semibold cursor-pointer"
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
                            className={`px-4 py-1.5 rounded-lg font-bold text-white cursor-pointer ${
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
          </div>
        </div>
      )}
    </div>
  );
};

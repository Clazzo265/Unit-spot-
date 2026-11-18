import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { PaymentMethod } from '../../types';
import {
  formatMWK,
  calculateVerifiedPaidForAssignment,
  calculateOutstandingBalance,
} from '../../utils/financialCalculations';
import {
  RATES,
  STOVE_TYPE_LABELS,
  parseMWKInput,
  validateTransactionReference,
  generateIdempotencyKey,
  resolveMemberInfo,
  isValidStoveType,
  isStoveBillingApplicable,
} from '../../utils/financialConfig';
import { canVerifyPaymentsRole } from '../../utils/centralizedFinancialAdmin';
import { Modal } from '../ui/Modal';
import { FileUploadField, UploadedFileState } from '../ui/FileUploadField';
import { UploadStatus, isUploadInProgress } from '../../utils/uploadUtils';
import {
  CheckCircle,
  Clock,
  AlertCircle,
  AlertTriangle,
  Upload,
  ChevronDown,
  ChevronUp,
  FileText,
  ExternalLink,
  Info,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface RecordPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultAssignmentId?: string;
}

export const RecordPaymentModal: React.FC<RecordPaymentModalProps> = ({
  isOpen,
  onClose,
  defaultAssignmentId,
}) => {
  const {
    currentGroup,
    currentUser,
    effectiveRole,
    currentMemberRecord,
    assignments,
    payments,
    groupMembers,
    users,
    contributions,
    recordPayment,
  } = useApp();
  const { showToast } = useToast();

  const isVerifier = canVerifyPaymentsRole(effectiveRole);

  const groupAssignments = useMemo(() => {
    const scoped = currentGroup
      ? assignments.filter((a) => a.groupId === currentGroup.id)
      : assignments;
    if (isVerifier) return scoped;
    return scoped.filter((a) => {
      if (
        currentMemberRecord &&
        (a.memberId === currentMemberRecord.id || a.memberId === currentMemberRecord.userId)
      ) {
        return true;
      }
      if (currentUser && a.memberId === currentUser.id) return true;
      return false;
    });
  }, [assignments, currentGroup, isVerifier, currentMemberRecord, currentUser]);

  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>(
    defaultAssignmentId || groupAssignments[0]?.id || ''
  );
  const [amount, setAmount] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<string>(
    () => new Date().toISOString().split('T')[0]
  );
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('tnm_mpamba');
  const [transactionReference, setTransactionReference] = useState<string>('');
  const [receiptFile, setReceiptFile] = useState<UploadedFileState | null>(null);
  const [receiptUploadStatus, setReceiptUploadStatus] = useState<UploadStatus>('idle');
  const [verifyImmediately, setVerifyImmediately] = useState<boolean>(false);
  const [showNotes, setShowNotes] = useState<boolean>(false);
  const [receiptNote, setReceiptNote] = useState<string>('');
  const [confirmOverpayment, setConfirmOverpayment] = useState<boolean>(false);
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() => generateIdempotencyKey());
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [successInfo, setSuccessInfo] = useState<{
    paymentId: string;
    amount: number;
    outstanding: number;
    overpaid: number;
    fileUrl?: string;
    fileName?: string;
    fileType?: string;
    isPending: boolean;
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setIdempotencyKey(generateIdempotencyKey());
      setConfirmOverpayment(false);
      setVerifyImmediately(false);
      setIsSubmitting(false);
      setError('');
      setPaymentDate(new Date().toISOString().split('T')[0]);
      if (defaultAssignmentId) {
        setSelectedAssignmentId(defaultAssignmentId);
      } else if (
        groupAssignments.length > 0 &&
        !groupAssignments.some((a) => a.id === selectedAssignmentId)
      ) {
        setSelectedAssignmentId(groupAssignments[0].id);
      }
    }
  }, [isOpen, defaultAssignmentId, groupAssignments, selectedAssignmentId]);

  const currentAssignment = groupAssignments.find((a) => a.id === selectedAssignmentId);
  const memberInfo = resolveMemberInfo(currentAssignment?.memberId, groupMembers, users);
  const contribution = contributions.find((c) => c.id === currentAssignment?.contributionId);

  const showStoveInfo = Boolean(
    contribution &&
      isStoveBillingApplicable(currentGroup, contribution.category) &&
      (contribution.allocationMode === 'stove_rate' ||
        Boolean(currentAssignment?.stoveTypeAtAssignment))
  );

  const verifiedPaid = currentAssignment
    ? calculateVerifiedPaidForAssignment(currentAssignment.id, payments)
    : 0;

  const { outstanding: currentOutstanding, overpaid: currentOverpaid } = currentAssignment
    ? calculateOutstandingBalance(currentAssignment.assignedAmount, verifiedPaid)
    : { outstanding: 0, overpaid: 0 };

  const parsedAmountPreview = parseMWKInput(amount);
  const projectedOverpayment =
    parsedAmountPreview.valid && currentAssignment
      ? Math.max(0, parsedAmountPreview.value - currentOutstanding)
      : 0;
  const requiresOverpaymentConfirmation =
    Boolean(currentAssignment) &&
    parsedAmountPreview.valid &&
    (currentOutstanding === 0 || parsedAmountPreview.value > currentOutstanding);

  const handleAmountChange = (val: string) => {
    const digitsOnly = val.replace(/[^\d]/g, '');
    setAmount(digitsOnly);
    setConfirmOverpayment(false);
    setError('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setError('');

    if (isUploadInProgress(receiptUploadStatus)) {
      setError('Please wait for your receipt upload to finish before saving.');
      return;
    }
    if (receiptUploadStatus === 'failed') {
      setError('Your receipt upload failed. Please tap Retry or Remove the failed attachment before saving.');
      return;
    }

    if (!currentAssignment) {
      setError('Please select a valid contribution balance.');
      return;
    }

    if (!paymentDate.trim()) {
      setError('Please select the payment date.');
      return;
    }

    const parsedAmount = parseMWKInput(amount);
    if (!parsedAmount.valid) {
      setError(parsedAmount.error || 'Please enter a valid whole MWK amount.');
      return;
    }

    const refCheck = validateTransactionReference(
      paymentMethod,
      transactionReference,
      Boolean(receiptFile?.url)
    );
    if (!refCheck.valid) {
      setError(refCheck.error || 'Please check the transaction reference.');
      return;
    }

    if (requiresOverpaymentConfirmation && !confirmOverpayment) {
      setError('Please confirm the overpayment / already-settled warning below before saving.');
      return;
    }

    setIsSubmitting(true);
    const shouldVerifyImmediately = isVerifier && verifyImmediately;

    const result = recordPayment({
      assignmentId: selectedAssignmentId,
      amount: parsedAmount.value,
      paymentDate: `${paymentDate}T12:00:00Z`,
      paymentMethod,
      transactionReference: transactionReference.trim() || undefined,
      idempotencyKey,
      receiptImageUrl: receiptFile?.url,
      receiptStoragePath: receiptFile?.storagePath,
      receiptFileName: receiptFile?.fileName,
      receiptFileType: receiptFile?.fileType,
      receiptFileSize: receiptFile?.fileSize,
      receiptNote: receiptNote.trim() || (receiptFile ? 'Receipt file attached' : undefined),
      verifyImmediately: shouldVerifyImmediately,
    });

    setIsSubmitting(false);

    if (!result.success) {
      setError(result.error || 'Could not save payment. Please check details.');
      return;
    }

    const isPending = result.verificationStatus !== 'verified';

    setSuccessInfo({
      paymentId: result.paymentId,
      amount: parsedAmount.value,
      outstanding: result.newOutstanding,
      overpaid: result.overpaid || 0,
      fileUrl: receiptFile?.previewUrl || receiptFile?.url,
      fileName: receiptFile?.fileName,
      fileType: receiptFile?.fileType,
      isPending,
    });

    if (isPending) {
      showToast('Saved — Waiting Verification', {
        message: `${formatMWK(parsedAmount.value)} logged as pending verification until confirmed by a verifier.`,
        variant: 'info',
      });
    } else {
      showToast('Payment Recorded & Verified', {
        message: `${formatMWK(parsedAmount.value)} verified for ${memberInfo?.name || 'member'}.`,
      });
    }

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!isPending && result.newOutstanding === 0 && !prefersReducedMotion) {
      confetti({
        particleCount: 70,
        spread: 60,
        origin: { y: 0.6 },
      });
    }
  };

  const resetAndClose = () => {
    setSuccessInfo(null);
    setAmount('');
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setTransactionReference('');
    setReceiptFile(null);
    setReceiptUploadStatus('idle');
    setVerifyImmediately(false);
    setShowNotes(false);
    setReceiptNote('');
    setConfirmOverpayment(false);
    setError('');
    setIsSubmitting(false);
    setIdempotencyKey(generateIdempotencyKey());
    onClose();
  };

  const applicableStoveRate =
    memberInfo && isValidStoveType(memberInfo.stoveType)
      ? RATES[memberInfo.stoveType]
      : currentAssignment?.applicableRate;

  const isSuccessPdf =
    successInfo?.fileType === 'application/pdf' ||
    Boolean(successInfo?.fileName?.toLowerCase().endsWith('.pdf'));

  return (
    <Modal
      isOpen={isOpen}
      onClose={resetAndClose}
      title={isVerifier ? 'Record Payment' : 'Submit Payment Proof'}
      subtitle={
        isVerifier
          ? 'Log member payment in Malawi Kwacha (MWK)'
          : 'Send your mobile money, bank, or cash proof for admin check'
      }
      maxWidthClass="max-w-lg"
    >
      {successInfo ? (
        <div className="py-4 text-center space-y-4">
          <div
            className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto ${
              successInfo.isPending
                ? 'bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-400'
                : 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-400'
            }`}
          >
            {successInfo.isPending ? (
              <Clock className="w-8 h-8" />
            ) : (
              <CheckCircle className="w-8 h-8" />
            )}
          </div>
          <div>
            <h4 className="text-xl font-bold text-slate-900 dark:text-white">
              {successInfo.isPending
                ? 'Payment Submitted — Pending Verification'
                : 'Payment Recorded & Verified'}
            </h4>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              {successInfo.isPending ? (
                <>
                  Reference{' '}
                  <span className="font-mono font-semibold text-slate-900 dark:text-white">
                    {successInfo.paymentId}
                  </span>{' '}
                  is saved as pending verification. Member balances update once verified.
                </>
              ) : (
                <>
                  Transaction{' '}
                  <span className="font-mono font-semibold text-slate-900 dark:text-white">
                    {successInfo.paymentId}
                  </span>{' '}
                  has been verified and applied to the ledger.
                </>
              )}
            </p>
          </div>

          <div className="bg-slate-50 dark:bg-[#11192C] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 text-left max-w-sm mx-auto space-y-2 tabular-nums">
            {successInfo.fileUrl && (
              <div className="mb-3 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-black/5">
                {isSuccessPdf ? (
                  <a
                    href={successInfo.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between p-3 bg-white dark:bg-[#0D1424] text-xs font-semibold text-blue-600 dark:text-cyan-400 hover:underline"
                  >
                    <span className="inline-flex items-center gap-2 truncate">
                      <FileText className="w-4 h-4 shrink-0" />
                      <span className="truncate">{successInfo.fileName || 'Receipt.pdf'}</span>
                    </span>
                    <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                  </a>
                ) : (
                  <img
                    src={successInfo.fileUrl}
                    alt="Payment Receipt"
                    className="w-full h-32 object-cover"
                  />
                )}
                <div className="px-2.5 py-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-between border-t border-emerald-100 dark:border-emerald-900">
                  <span>Receipt Attached</span>
                  <span className="font-mono">{successInfo.paymentId}</span>
                </div>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-slate-500 dark:text-slate-400">
                {successInfo.isPending ? 'Amount Submitted' : 'Amount Received'}
              </span>
              <span className="font-bold font-mono text-slate-900 dark:text-white">
                {formatMWK(successInfo.amount)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500 dark:text-slate-400">Member</span>
              <span className="font-medium text-slate-900 dark:text-white">
                {memberInfo?.name || 'Registered Member'}
              </span>
            </div>
            {contribution && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-500 dark:text-slate-400">Contribution</span>
                <span className="font-medium text-slate-900 dark:text-white">
                  {contribution.title}
                </span>
              </div>
            )}
            <div className="flex justify-between text-sm border-t border-slate-200 dark:border-slate-800 pt-2">
              <span className="text-slate-500 dark:text-slate-400">
                {successInfo.isPending ? 'Current Balance (Pending Check)' : 'New Balance'}
              </span>
              <span
                className={`font-bold font-mono ${
                  successInfo.outstanding === 0
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-slate-900 dark:text-white'
                }`}
              >
                {formatMWK(successInfo.outstanding)}
              </span>
            </div>
            {!successInfo.isPending && successInfo.overpaid > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-500 dark:text-slate-400">Overpayment Credit</span>
                <span className="font-bold font-mono text-amber-700 dark:text-amber-400">
                  +{formatMWK(successInfo.overpaid)}
                </span>
              </div>
            )}
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={resetAndClose}
              className="min-h-[44px] bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white font-semibold px-6 py-2.5 rounded-xl text-sm transition-colors cursor-pointer"
            >
              Done &amp; Back to Overview
            </button>
          </div>
        </div>
      ) : groupAssignments.length === 0 ? (
        <div className="py-8 text-center space-y-3">
          <AlertCircle className="w-10 h-10 text-amber-500 mx-auto" />
          <h4 className="font-bold text-slate-900 dark:text-white text-base">
            No Contributions Assigned Yet
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
            {isVerifier
              ? `Create a contribution for ${currentGroup?.name || 'your group'} before recording payments.`
              : `No active contributions have been assigned to you in ${currentGroup?.name || 'this group'} yet.`}
          </p>
          <button
            type="button"
            onClick={resetAndClose}
            className="min-h-[44px] bg-slate-900 dark:bg-blue-600 text-white px-5 py-2 rounded-xl text-xs font-semibold cursor-pointer"
          >
            Close
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div
              role="alert"
              className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs rounded-xl flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Assignment Selector */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
              {isVerifier ? 'Member & Contribution Balance *' : 'Contribution to Pay *'}
            </label>
            <select
              value={selectedAssignmentId}
              onChange={(e) => {
                setSelectedAssignmentId(e.target.value);
                setConfirmOverpayment(false);
                setError('');
              }}
              className="w-full min-h-[44px] bg-white dark:bg-[#11192C] border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white font-medium focus:outline-none"
            >
              {groupAssignments.map((a) => {
                const m = resolveMemberInfo(a.memberId, groupMembers, users);
                const c = contributions.find((cn) => cn.id === a.contributionId);
                const pPaid = calculateVerifiedPaidForAssignment(a.id, payments);
                const { outstanding, overpaid } = calculateOutstandingBalance(
                  a.assignedAmount,
                  pPaid
                );

                return (
                  <option key={a.id} value={a.id}>
                    {m?.name || 'Registered Member'} — {c?.title || 'Shared Contribution'} (
                    {overpaid > 0
                      ? `Overpaid +${formatMWK(overpaid)}`
                      : outstanding === 0
                        ? 'Settled'
                        : `Owes ${formatMWK(outstanding)}`}
                    )
                  </option>
                );
              })}
            </select>
          </div>

          {/* Member & Financial Context Card */}
          {currentAssignment && (
            <div className="bg-slate-50 dark:bg-[#11192C] rounded-xl p-3.5 border border-slate-200 dark:border-slate-800 space-y-2 text-xs tabular-nums">
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {memberInfo?.name || 'Registered Member'}
                  </span>
                  {memberInfo?.memberRefId && (
                    <span className="ml-2 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                      {memberInfo.memberRefId}
                    </span>
                  )}
                </div>
                {showStoveInfo && memberInfo && isValidStoveType(memberInfo.stoveType) && (
                  <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    {STOVE_TYPE_LABELS[memberInfo.stoveType]} ({formatMWK(applicableStoveRate || 0)})
                  </span>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 pt-0.5">
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block text-[11px]">
                    Expected
                  </span>
                  <strong className="text-slate-900 dark:text-white text-sm font-mono">
                    {formatMWK(currentAssignment.assignedAmount)}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block text-[11px]">
                    Verified Paid
                  </span>
                  <strong className="text-emerald-700 dark:text-emerald-400 text-sm font-mono">
                    {formatMWK(verifiedPaid)}
                  </strong>
                </div>
                <div className="text-right">
                  <span className="text-slate-500 dark:text-slate-400 block text-[11px]">
                    {currentOverpaid > 0 ? 'Overpaid Credit' : 'Remaining'}
                  </span>
                  <strong
                    className={`text-sm font-mono ${
                      currentOverpaid > 0
                        ? 'text-amber-700 dark:text-amber-400'
                        : currentOutstanding === 0
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-slate-900 dark:text-white'
                    }`}
                  >
                    {currentOverpaid > 0
                      ? `+${formatMWK(currentOverpaid)}`
                      : formatMWK(currentOutstanding)}
                  </strong>
                </div>
              </div>
            </div>
          )}

          {/* Quick Fill Amount */}
          {currentOutstanding > 0 && (
            <div>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1.5">
                Quick Fill Amount
              </span>
              <div className="grid grid-cols-3 gap-2 tabular-nums">
                <button
                  type="button"
                  onClick={() => handleAmountChange(String(currentOutstanding))}
                  className="min-h-[42px] text-xs py-1.5 px-2 bg-slate-100 dark:bg-[#131D33] hover:bg-slate-200 dark:hover:bg-[#1A2744] text-slate-800 dark:text-slate-200 font-semibold rounded-xl border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer whitespace-nowrap"
                >
                  Full ({formatMWK(currentOutstanding)})
                </button>
                {currentOutstanding >= 2000 && (
                  <button
                    type="button"
                    onClick={() =>
                      handleAmountChange(String(Math.floor(currentOutstanding / 2)))
                    }
                    className="min-h-[42px] text-xs py-1.5 px-2 bg-slate-100 dark:bg-[#131D33] hover:bg-slate-200 dark:hover:bg-[#1A2744] text-slate-800 dark:text-slate-200 font-semibold rounded-xl border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    50% ({formatMWK(Math.floor(currentOutstanding / 2))})
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleAmountChange('5000')}
                  className="min-h-[42px] text-xs py-1.5 px-2 bg-slate-100 dark:bg-[#131D33] hover:bg-slate-200 dark:hover:bg-[#1A2744] text-slate-800 dark:text-slate-200 font-semibold rounded-xl border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer whitespace-nowrap"
                >
                  MK 5,000
                </button>
              </div>
            </div>
          )}

          {/* Amount & Payment Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                {isVerifier ? 'Amount Received (MWK) *' : 'Amount Paid (MWK) *'}
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-sm">
                  MK
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="e.g. 10000"
                  value={amount}
                  onChange={(e) => handleAmountChange(e.target.value)}
                  className="w-full min-h-[44px] bg-white dark:bg-[#11192C] border border-slate-200 dark:border-slate-700 rounded-xl pl-12 pr-4 py-2 text-base font-bold font-mono text-slate-900 dark:text-white tabular-nums focus:outline-none"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                Payment Date *
              </label>
              <input
                type="date"
                value={paymentDate}
                max={new Date().toISOString().split('T')[0]}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full min-h-[44px] bg-white dark:bg-[#11192C] border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:outline-none"
                required
              />
            </div>
          </div>

          {/* Overpayment / Already Settled Confirmation Banner */}
          {requiresOverpaymentConfirmation && (
            <div className="p-3.5 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-xl space-y-2 text-xs">
              <div className="flex items-start gap-2 text-amber-900 dark:text-amber-200">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                <div>
                  <p className="font-bold">
                    {currentOutstanding === 0
                      ? 'This contribution is already settled (MK 0 remaining).'
                      : `Entered amount exceeds remaining balance of ${formatMWK(currentOutstanding)}.`}
                  </p>
                  <p className="text-amber-800 dark:text-amber-300 mt-0.5">
                    Saving this payment will create a member overpayment credit of{' '}
                    <strong className="tabular-nums font-mono">
                      {formatMWK(projectedOverpayment)}
                    </strong>
                    .
                  </p>
                </div>
              </div>
              <label className="flex items-center gap-2 text-amber-950 dark:text-amber-100 font-semibold cursor-pointer pt-1 min-h-[36px]">
                <input
                  type="checkbox"
                  checked={confirmOverpayment}
                  onChange={(e) => setConfirmOverpayment(e.target.checked)}
                  className="rounded border-amber-400 text-blue-600"
                />
                <span>Confirm saving this overpayment entry</span>
              </label>
            </div>
          )}

          {/* Payment Method */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
              Payment Method *
            </label>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                { id: 'tnm_mpamba', label: 'TNM Mpamba', tag: 'Mobile Money Ref / Receipt' },
                { id: 'airtel_money', label: 'Airtel Money', tag: 'Mobile Money Ref / Receipt' },
                { id: 'bank_transfer', label: 'Bank Transfer', tag: 'Bank Ref / Receipt' },
                { id: 'cash', label: 'Cash', tag: 'No receipt photo required' },
              ].map((m) => (
                <label
                  key={m.id}
                  className={`min-h-[48px] flex flex-col justify-center p-2.5 rounded-xl border cursor-pointer transition-colors ${
                    paymentMethod === m.id
                      ? 'border-slate-900 dark:border-blue-500 bg-slate-900 dark:bg-blue-600 text-white shadow-xs'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-[#11192C] hover:bg-slate-50 dark:hover:bg-[#18233D] text-slate-800 dark:text-slate-200'
                  }`}
                >
                  <input
                    type="radio"
                    name="paymentMethod"
                    value={m.id}
                    checked={paymentMethod === m.id}
                    onChange={() => setPaymentMethod(m.id as PaymentMethod)}
                    className="sr-only"
                  />
                  <span className="font-semibold text-xs leading-tight">{m.label}</span>
                  <span
                    className={`text-[10px] mt-0.5 ${
                      paymentMethod === m.id
                        ? 'text-slate-300 dark:text-blue-100'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {m.tag}
                  </span>
                </label>
              ))}
            </div>

            {paymentMethod !== 'cash' && (
              <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 flex items-start gap-1.5 leading-snug">
                <Info className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400 shrink-0 mt-0.5" />
                <span>
                  UnitSpot records your transaction reference or receipt screenshot for group verification — it does not automatically debit mobile money or bank accounts.
                </span>
              </p>
            )}
          </div>

          {/* Receipt File / Photo Upload */}
          <FileUploadField
            label={
              paymentMethod === 'cash'
                ? 'Receipt Photo / PDF (Optional for Cash)'
                : 'Transaction Receipt Photo / PDF'
            }
            helperText={
              paymentMethod === 'cash'
                ? 'No receipt photo is required for cash payments.'
                : 'Provide either a receipt photo/PDF below or enter the SMS/bank reference number.'
            }
            folder="receipts"
            groupId={currentGroup?.id || 'default'}
            recordIdPrefix="pay"
            scopeMeta={{
              uploaderUid: currentUser?.id,
              adminId: currentGroup?.adminId,
              treasurerId: currentGroup?.treasurerId,
            }}
            allowPdf
            allowCamera
            value={receiptFile}
            onChange={setReceiptFile}
            onStatusChange={setReceiptUploadStatus}
          />

          {/* Transaction Reference */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                {paymentMethod === 'cash'
                  ? 'Receipt / Cash Slip Number (Optional)'
                  : paymentMethod === 'bank_transfer'
                    ? 'Bank Reference Number'
                    : 'Mobile Money SMS Reference'}
              </label>
              {(paymentMethod === 'cash' || receiptFile) && (
                <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold">
                  {paymentMethod === 'cash' ? 'Optional for cash' : 'Optional with attachment'}
                </span>
              )}
            </div>
            <input
              type="text"
              placeholder={
                paymentMethod === 'cash'
                  ? 'Leave blank to auto-assign, or enter slip #'
                  : paymentMethod === 'bank_transfer'
                    ? 'e.g. NBM-8829104 or FDH-22910'
                    : 'e.g. MP847219 or CI260512.1402'
              }
              value={transactionReference}
              onChange={(e) => setTransactionReference(e.target.value)}
              className="w-full min-h-[44px] bg-white dark:bg-[#11192C] border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-mono text-slate-900 dark:text-white focus:outline-none"
            />
          </div>

          {/* Explicit Verifier Opt-in (No silent auto-verification) */}
          {isVerifier && (
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#11192C] space-y-1">
              <label className="flex items-start gap-2.5 cursor-pointer text-xs font-semibold text-slate-900 dark:text-white min-h-[36px]">
                <input
                  type="checkbox"
                  checked={verifyImmediately}
                  onChange={(e) => setVerifyImmediately(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-emerald-600"
                />
                <span>Mark as verified immediately (I have confirmed receipt of funds)</span>
              </label>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 pl-6">
                {verifyImmediately
                  ? 'Member balance will decrease immediately upon saving.'
                  : 'Leave unchecked to save as Pending Verification until funds or SMS confirmation are checked.'}
              </p>
            </div>
          )}

          {/* Collapsible Optional Notes */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowNotes((prev) => !prev)}
              className="w-full min-h-[44px] px-3.5 py-2.5 bg-slate-50 dark:bg-[#11192C] hover:bg-slate-100 dark:hover:bg-[#18233D] flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer"
            >
              <span>Optional Notes</span>
              {showNotes ? (
                <ChevronUp className="w-4 h-4 text-slate-500" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-500" />
              )}
            </button>
            {showNotes && (
              <div className="p-3 bg-white dark:bg-[#0D1424] border-t border-slate-200 dark:border-slate-800">
                <textarea
                  rows={2}
                  placeholder="Optional note, e.g. 'Sent via Airtel Money from 0999...'"
                  value={receiptNote}
                  onChange={(e) => setReceiptNote(e.target.value)}
                  className="w-full bg-white dark:bg-[#11192C] border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
                />
              </div>
            )}
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={resetAndClose}
              className="min-h-[44px] px-4 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#131D33] rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isUploadInProgress(receiptUploadStatus)}
              className="min-h-[44px] bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 disabled:opacity-50 text-white px-5 py-2.5 text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              {isVerifier && verifyImmediately ? (
                <CheckCircle className="w-4 h-4 text-emerald-400 dark:text-white" />
              ) : (
                <Upload className="w-4 h-4 text-[#E5B93C] dark:text-white" />
              )}
              <span>
                {isUploadInProgress(receiptUploadStatus)
                  ? 'Uploading Receipt...'
                  : isSubmitting
                    ? 'Saving...'
                    : isVerifier && verifyImmediately
                      ? 'Confirm & Verify Payment'
                      : isVerifier
                        ? 'Save as Pending Check'
                        : 'Submit Proof for Check'}
              </span>
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
};

import React, { useState, useRef, useMemo, useEffect } from 'react';
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
} from '../../utils/financialConfig';
import { Modal } from '../ui/Modal';
import {
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Camera,
  Upload,
  Trash2,
  Image as ImageIcon,
  ChevronDown,
  ChevronUp,
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
    assignments,
    payments,
    groupMembers,
    users,
    contributions,
    recordPayment,
  } = useApp();
  const { showToast } = useToast();

  const groupAssignments = useMemo(
    () =>
      currentGroup
        ? assignments.filter((a) => a.groupId === currentGroup.id)
        : assignments,
    [assignments, currentGroup]
  );

  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>(
    defaultAssignmentId || groupAssignments[0]?.id || ''
  );
  const [amount, setAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('tnm_mpamba');
  const [transactionReference, setTransactionReference] = useState<string>('');
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [receiptImageName, setReceiptImageName] = useState<string>('');
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
    image?: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setIdempotencyKey(generateIdempotencyKey());
      setConfirmOverpayment(false);
      setIsSubmitting(false);
      setError('');
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

  const handleProcessImage = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file (PNG, JPG, WEBP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1200;
        const MAX_HEIGHT = 1200;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
          setReceiptImage(dataUrl);
          setReceiptImageName(file.name || 'receipt_capture.jpg');
          setError('');
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleProcessImage(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setError('');

    if (!currentAssignment) {
      setError('Please select a valid member contribution obligation.');
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
      Boolean(receiptImage)
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
    const result = recordPayment({
      assignmentId: selectedAssignmentId,
      amount: parsedAmount.value,
      paymentMethod,
      transactionReference: transactionReference.trim() || undefined,
      idempotencyKey,
      receiptImageUrl: receiptImage || undefined,
      receiptNote: receiptNote.trim() || (receiptImage ? 'Picture proof attached' : undefined),
    });
    setIsSubmitting(false);

    if (!result.success) {
      setError(result.error || 'Could not record payment. Please check details.');
      return;
    }

    setSuccessInfo({
      paymentId: result.paymentId,
      amount: parsedAmount.value,
      outstanding: result.newOutstanding,
      overpaid: result.overpaid || 0,
      image: receiptImage || undefined,
    });

    showToast('Payment Recorded', {
      message: `${formatMWK(parsedAmount.value)} verified for ${memberInfo?.name || 'member'}.`,
    });

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (result.newOutstanding === 0 && !prefersReducedMotion) {
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
    setTransactionReference('');
    setReceiptImage(null);
    setReceiptImageName('');
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

  return (
    <Modal
      isOpen={isOpen}
      onClose={resetAndClose}
      title="Record Payment"
      subtitle="Verified ledger entry in Malawi Kwacha (MWK)"
      maxWidthClass="max-w-lg"
    >
      {successInfo ? (
        <div className="py-4 text-center space-y-4">
          <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle className="w-8 h-8" />
          </div>
          <div>
            <h4 className="text-xl font-bold text-slate-900 dark:text-white">
              Payment Recorded Successfully
            </h4>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Transaction{' '}
              <span className="font-mono font-semibold text-slate-900 dark:text-white">
                {successInfo.paymentId}
              </span>{' '}
              has been verified and added to the ledger.
            </p>
          </div>

          <div className="bg-slate-50 dark:bg-[#11192C] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 text-left max-w-sm mx-auto space-y-2 tabular-nums">
            {successInfo.image && (
              <div className="mb-3 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-black/5">
                <img
                  src={successInfo.image}
                  alt="Payment Receipt"
                  className="w-full h-32 object-cover"
                />
                <div className="px-2.5 py-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-between border-t border-emerald-100 dark:border-emerald-900">
                  <span>Receipt Attached</span>
                  <span className="font-mono">{successInfo.paymentId}</span>
                </div>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-slate-500 dark:text-slate-400">Amount Received</span>
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
              <span className="text-slate-500 dark:text-slate-400">New Balance</span>
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
            {successInfo.overpaid > 0 && (
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
            No Obligations Assigned Yet
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
            Create a contribution obligation for {currentGroup?.name || 'your group'} before recording payments.
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
              Member &amp; Contribution Obligation *
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
                    {m?.name || 'Registered Member'} — {c?.title || 'Shared Obligation'} (
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
                {memberInfo && isValidStoveType(memberInfo.stoveType) ? (
                  <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    {STOVE_TYPE_LABELS[memberInfo.stoveType]} ({formatMWK(applicableStoveRate || 0)})
                  </span>
                ) : (
                  <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                    Stove Rate Unset
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
                  className="min-h-[40px] text-xs py-1.5 px-2 bg-slate-100 dark:bg-[#131D33] hover:bg-slate-200 dark:hover:bg-[#1A2744] text-slate-800 dark:text-slate-200 font-semibold rounded-xl border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer whitespace-nowrap"
                >
                  Full ({formatMWK(currentOutstanding)})
                </button>
                {currentOutstanding >= 2000 && (
                  <button
                    type="button"
                    onClick={() =>
                      handleAmountChange(String(Math.floor(currentOutstanding / 2)))
                    }
                    className="min-h-[40px] text-xs py-1.5 px-2 bg-slate-100 dark:bg-[#131D33] hover:bg-slate-200 dark:hover:bg-[#1A2744] text-slate-800 dark:text-slate-200 font-semibold rounded-xl border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    50% ({formatMWK(Math.floor(currentOutstanding / 2))})
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleAmountChange('5000')}
                  className="min-h-[40px] text-xs py-1.5 px-2 bg-slate-100 dark:bg-[#131D33] hover:bg-slate-200 dark:hover:bg-[#1A2744] text-slate-800 dark:text-slate-200 font-semibold rounded-xl border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer whitespace-nowrap"
                >
                  MK 5,000
                </button>
              </div>
            </div>
          )}

          {/* Amount Input (Strict Integer MWK) */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
              Amount Received (Whole MWK) *
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
                className="w-full min-h-[44px] bg-white dark:bg-[#11192C] border border-slate-200 dark:border-slate-700 rounded-xl pl-12 pr-4 py-2.5 text-base font-bold font-mono text-slate-900 dark:text-white tabular-nums focus:outline-none"
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
                      ? 'This obligation is already settled (MK 0 remaining).'
                      : `Entered amount exceeds remaining balance of ${formatMWK(currentOutstanding)}.`}
                  </p>
                  <p className="text-amber-800 dark:text-amber-300 mt-0.5">
                    Recording this payment will create a member overpayment credit of{' '}
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
                <span>Confirm recording this overpayment entry</span>
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
                { id: 'tnm_mpamba', label: 'TNM Mpamba', tag: 'Mobile Money' },
                { id: 'airtel_money', label: 'Airtel Money', tag: 'Mobile Money' },
                { id: 'bank_transfer', label: 'Bank Transfer', tag: 'Malawian Commercial Banks' },
                { id: 'cash', label: 'Physical Cash', tag: 'In-person Receipt' },
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
          </div>

          {/* Hidden file and camera inputs */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
            className="hidden"
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />

          {/* 1-Tap Receipt Capture */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
              Transaction Receipt Photo / Screenshot
            </label>

            {receiptImage ? (
              <div className="p-3 bg-slate-50 dark:bg-[#11192C] rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2.5">
                <div className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 max-h-44 bg-slate-950 flex items-center justify-center">
                  <img
                    src={receiptImage}
                    alt="Receipt preview"
                    className="w-full h-44 object-contain"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setReceiptImage(null);
                      setReceiptImageName('');
                    }}
                    className="min-h-[36px] min-w-[36px] absolute top-2 right-2 p-1.5 bg-black/75 hover:bg-black text-white rounded-lg transition-colors cursor-pointer flex items-center justify-center"
                    aria-label="Remove photo"
                  >
                    <Trash2 className="w-4 h-4 text-rose-400" />
                  </button>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
                  <div className="flex items-center gap-1.5 truncate max-w-[200px]">
                    <ImageIcon className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span className="truncate font-medium">{receiptImageName}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="min-h-[36px] text-xs font-semibold text-blue-600 dark:text-cyan-400 hover:underline cursor-pointer"
                  >
                    Replace Receipt
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="min-h-[48px] py-2.5 px-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 dark:hover:border-cyan-400 bg-slate-50 dark:bg-[#11192C] hover:bg-slate-100 dark:hover:bg-[#18233D] text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <Camera className="w-4 h-4 text-blue-600 dark:text-cyan-400 shrink-0" />
                  <span>Take Photo</span>
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="min-h-[48px] py-2.5 px-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 dark:hover:border-cyan-400 bg-slate-50 dark:bg-[#11192C] hover:bg-slate-100 dark:hover:bg-[#18233D] text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <Upload className="w-4 h-4 text-blue-600 dark:text-cyan-400 shrink-0" />
                  <span>Upload Image</span>
                </button>
              </div>
            )}
          </div>

          {/* Transaction Reference */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                {paymentMethod === 'cash'
                  ? 'Receipt / Cash Slip Number'
                  : paymentMethod === 'bank_transfer'
                    ? 'Bank Reference Number'
                    : 'Mobile Money SMS Reference'}
              </label>
              {receiptImage && (
                <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold">
                  Optional with photo
                </span>
              )}
            </div>
            <input
              type="text"
              placeholder={
                paymentMethod === 'cash'
                  ? 'e.g. SLIP-104 or Cash Receipt #12'
                  : paymentMethod === 'bank_transfer'
                    ? 'e.g. NBM-8829104 or FDH-22910'
                    : 'e.g. MP847219 or CI260512.1402'
              }
              value={transactionReference}
              onChange={(e) => setTransactionReference(e.target.value)}
              className="w-full min-h-[44px] bg-white dark:bg-[#11192C] border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-mono text-slate-900 dark:text-white focus:outline-none"
            />
          </div>

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
                  placeholder="Optional verification note, e.g. 'Confirmed SMS on treasurer phone'"
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
              disabled={isSubmitting}
              className="min-h-[44px] bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 disabled:opacity-50 text-white px-5 py-2.5 text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <CheckCircle className="w-4 h-4 text-emerald-400 dark:text-white" />
              <span>{isSubmitting ? 'Recording...' : 'Confirm & Record Payment'}</span>
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
};

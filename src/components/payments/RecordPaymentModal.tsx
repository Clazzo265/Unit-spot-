import React, { useState, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { PaymentMethod } from '../../types';
import { formatMWK } from '../../utils/financialCalculations';
import { 
  X, 
  CheckCircle, 
  CreditCard, 
  AlertCircle, 
  FileText, 
  Camera, 
  Upload, 
  Trash2, 
  Eye, 
  Image as ImageIcon 
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
    assignments, 
    payments, 
    users, 
    contributions, 
    recordPayment, 
    currentUser 
  } = useApp();

  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>(
    defaultAssignmentId || assignments[0]?.id || ''
  );
  const [amount, setAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('tnm_mpamba');
  const [transactionReference, setTransactionReference] = useState<string>('');
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [receiptImageName, setReceiptImageName] = useState<string>('');
  const [receiptNote, setReceiptNote] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [successInfo, setSuccessInfo] = useState<{ paymentId: string; outstanding: number; image?: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Sync assignment if passed in
  React.useEffect(() => {
    if (defaultAssignmentId) {
      setSelectedAssignmentId(defaultAssignmentId);
    }
  }, [defaultAssignmentId]);

  if (!isOpen) return null;

  const currentAssignment = assignments.find(a => a.id === selectedAssignmentId);
  const member = users.find(u => u.id === currentAssignment?.memberId);
  const contribution = contributions.find(c => c.id === currentAssignment?.contributionId);

  // Calculate current verified paid and outstanding
  const verifiedPaid = currentAssignment 
    ? payments
        .filter(p => p.assignmentId === currentAssignment.id && p.verificationStatus === 'verified')
        .reduce((sum, p) => sum + p.amountReceived, 0)
    : 0;

  const currentOutstanding = currentAssignment 
    ? Math.max(0, currentAssignment.assignedAmount - verifiedPaid)
    : 0;

  // Handle image upload and compression via canvas
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
    setError('');

    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0) {
      setError('Please enter a valid payment amount greater than zero.');
      return;
    }

    // Reference is optional if receipt image is captured
    if (!transactionReference.trim() && !receiptImage) {
      setError('Please either capture/upload a receipt picture OR provide a transaction reference code.');
      return;
    }

    const result = recordPayment({
      assignmentId: selectedAssignmentId,
      amount: numericAmount,
      paymentMethod,
      transactionReference: transactionReference.trim() || undefined,
      receiptImageUrl: receiptImage || undefined,
      receiptNote: receiptNote.trim() || (receiptImage ? 'Picture proof attached' : undefined),
    });

    if (result.success) {
      setSuccessInfo({ 
        paymentId: result.paymentId, 
        outstanding: result.newOutstanding,
        image: receiptImage || undefined
      });
      if (result.newOutstanding === 0) {
        confetti({
          particleCount: 80,
          spread: 60,
          origin: { y: 0.6 },
        });
      }
    }
  };

  const resetAndClose = () => {
    setSuccessInfo(null);
    setAmount('');
    setTransactionReference('');
    setReceiptImage(null);
    setReceiptImageName('');
    setReceiptNote('');
    setError('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-neutral-900 text-white flex items-center justify-center font-bold text-sm">
              <CreditCard className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h3 className="font-bold text-neutral-900 text-lg leading-tight">
                Record Payment
              </h3>
              <p className="text-xs text-neutral-500">
                Log cash, Airtel Money, Mpamba or bank receipt in MWK
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

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto">
          {successInfo ? (
            <div className="py-6 text-center space-y-4">
              <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="w-8 h-8" />
              </div>
              <div>
                <h4 className="text-xl font-bold text-neutral-900">
                  Payment Recorded Successfully!
                </h4>
                <p className="text-sm text-neutral-600 mt-1">
                  Transaction <span className="font-mono font-semibold text-neutral-900">{successInfo.paymentId}</span> has been logged to the group ledger.
                </p>
              </div>

              <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 text-left max-w-sm mx-auto space-y-2">
                {successInfo.image && (
                  <div className="mb-3 rounded-lg overflow-hidden border border-neutral-200 bg-black/5">
                    <img 
                      src={successInfo.image} 
                      alt="Payment Receipt" 
                      className="w-full h-32 object-cover" 
                    />
                    <div className="px-2 py-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 flex items-center justify-between border-t border-emerald-100">
                      <span>✓ Receipt Image Captured</span>
                      <span className="font-mono text-neutral-500">{successInfo.paymentId}</span>
                    </div>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-500">Amount Received:</span>
                  <span className="font-bold text-neutral-900">{formatMWK(Number(amount))}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-500">Member:</span>
                  <span className="font-medium text-neutral-900">{member?.name}</span>
                </div>
                <div className="flex justify-between text-sm border-t border-neutral-200/80 pt-2">
                  <span className="text-neutral-500">New Outstanding Balance:</span>
                  <span className={`font-bold ${successInfo.outstanding === 0 ? 'text-emerald-600' : 'text-neutral-900'}`}>
                    {formatMWK(successInfo.outstanding)}
                  </span>
                </div>
              </div>

              <div className="pt-3">
                <button
                  onClick={resetAndClose}
                  className="bg-neutral-900 hover:bg-black text-white font-semibold px-6 py-2.5 rounded-xl text-sm transition-colors cursor-pointer"
                >
                  Done & Back to Overview
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

              {/* Assignment Selector */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-600 mb-1.5">
                  Select Member & Contribution Assignment
                </label>
                <select
                  value={selectedAssignmentId}
                  onChange={(e) => setSelectedAssignmentId(e.target.value)}
                  className="w-full bg-white border border-neutral-200 rounded-xl px-3.5 py-2.5 text-sm text-neutral-900 font-medium focus:outline-none focus:ring-2 focus:ring-neutral-900"
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
                        {m?.name || 'Unknown'} — {c?.title || 'Shared'} (Owes: {formatMWK(remaining)})
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Outstanding context banner */}
              {currentAssignment && (
                <div className="bg-neutral-50 rounded-xl p-3 border border-neutral-200/80 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-neutral-500">Expected Total: </span>
                    <strong className="text-neutral-900">{formatMWK(currentAssignment.assignedAmount)}</strong>
                    <span className="text-neutral-400 mx-1">•</span>
                    <span className="text-neutral-500">Verified Paid: </span>
                    <strong className="text-emerald-700">{formatMWK(verifiedPaid)}</strong>
                  </div>
                  <div className="text-right">
                    <span className="text-neutral-500">Remaining: </span>
                    <span className="font-extrabold text-neutral-900 text-sm">
                      {formatMWK(currentOutstanding)}
                    </span>
                  </div>
                </div>
              )}

              {/* Quick Preset Buttons */}
              {currentOutstanding > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-medium text-neutral-500">Quick Fill Amount:</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setAmount(String(currentOutstanding))}
                      className="text-xs py-1.5 px-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 font-semibold rounded-lg border border-neutral-200 transition-colors"
                    >
                      Full ({formatMWK(currentOutstanding)})
                    </button>
                    {currentOutstanding >= 2000 && (
                      <button
                        type="button"
                        onClick={() => setAmount(String(Math.floor(currentOutstanding / 2)))}
                        className="text-xs py-1.5 px-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 font-semibold rounded-lg border border-neutral-200 transition-colors"
                      >
                        50% ({formatMWK(Math.floor(currentOutstanding / 2))})
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setAmount('5000')}
                      className="text-xs py-1.5 px-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 font-semibold rounded-lg border border-neutral-200 transition-colors"
                    >
                      MK 5,000
                    </button>
                  </div>
                </div>
              )}

              {/* Amount input */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-600 mb-1.5">
                  Amount Received (MWK) *
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-neutral-400 text-sm">
                    MK
                  </span>
                  <input
                    type="number"
                    min="1"
                    placeholder="e.g. 7000"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-white border border-neutral-200 rounded-xl pl-12 pr-4 py-2.5 text-base font-bold text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
                    required
                  />
                </div>
              </div>

              {/* Payment Method */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-600 mb-1.5">
                  Payment Method *
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {[
                    { id: 'tnm_mpamba', label: 'TNM Mpamba', tag: 'Mobile Money' },
                    { id: 'airtel_money', label: 'Airtel Money', tag: 'Mobile Money' },
                    { id: 'bank_transfer', label: 'Bank Transfer (Mo626 / 247)', tag: 'NBM / Standard / FDH' },
                    { id: 'cash', label: 'Physical Cash', tag: 'In-person' },
                  ].map((m) => (
                    <label
                      key={m.id}
                      className={`flex flex-col p-2.5 rounded-xl border cursor-pointer transition-all ${
                        paymentMethod === m.id
                          ? 'border-neutral-900 bg-neutral-900 text-white shadow-xs'
                          : 'border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-800'
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
                      <span className={`text-[10px] mt-0.5 ${paymentMethod === m.id ? 'text-neutral-300' : 'text-neutral-500'}`}>
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

              {/* Transaction Picture / Screenshot Capture */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-700">
                  Transaction Receipt / Screenshot Picture
                </label>

                {receiptImage ? (
                  <div className="p-3 bg-neutral-50 rounded-2xl border border-neutral-200 space-y-2.5">
                    <div className="relative rounded-xl overflow-hidden border border-neutral-200 max-h-44 bg-neutral-900 flex items-center justify-center">
                      <img 
                        src={receiptImage} 
                        alt="Receipt preview" 
                        className="w-full h-44 object-contain"
                      />
                      <div className="absolute top-2 right-2 flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setReceiptImage(null);
                            setReceiptImageName('');
                          }}
                          className="p-1.5 bg-black/75 hover:bg-black text-white rounded-lg transition-colors cursor-pointer"
                          title="Remove photo"
                        >
                          <Trash2 className="w-4 h-4 text-rose-400" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-neutral-600">
                      <div className="flex items-center gap-1.5 truncate max-w-[200px]">
                        <ImageIcon className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span className="truncate font-medium">{receiptImageName}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => cameraInputRef.current?.click()}
                          className="text-[11px] font-semibold text-neutral-800 hover:text-black cursor-pointer underline"
                        >
                          Retake
                        </button>
                        <span className="text-neutral-300">•</span>
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="text-[11px] font-semibold text-neutral-800 hover:text-black cursor-pointer underline"
                        >
                          Change File
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      className="p-3.5 border-2 border-dashed border-neutral-300 hover:border-neutral-900 rounded-2xl flex flex-col items-center justify-center gap-1.5 bg-neutral-50/60 hover:bg-neutral-100 transition-all cursor-pointer group"
                    >
                      <div className="w-9 h-9 rounded-xl bg-white border border-neutral-200 flex items-center justify-center group-hover:scale-105 transition-transform">
                        <Camera className="w-5 h-5 text-neutral-700" />
                      </div>
                      <div className="text-center">
                        <span className="text-xs font-bold text-neutral-900 block">Take Photo</span>
                        <span className="text-[10px] text-neutral-500">Snap SMS or slip</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="p-3.5 border-2 border-dashed border-neutral-300 hover:border-neutral-900 rounded-2xl flex flex-col items-center justify-center gap-1.5 bg-neutral-50/60 hover:bg-neutral-100 transition-all cursor-pointer group"
                    >
                      <div className="w-9 h-9 rounded-xl bg-white border border-neutral-200 flex items-center justify-center group-hover:scale-105 transition-transform">
                        <Upload className="w-5 h-5 text-neutral-700" />
                      </div>
                      <div className="text-center">
                        <span className="text-xs font-bold text-neutral-900 block">Upload Screenshot</span>
                        <span className="text-[10px] text-neutral-500">From gallery / phone</span>
                      </div>
                    </button>
                  </div>
                )}
              </div>

              {/* Transaction Reference (Optional if picture is uploaded) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-600">
                    Transaction Reference / SMS Code
                  </label>
                  {receiptImage && (
                    <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      Optional (Photo Attached)
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  placeholder={receiptImage ? "Optional (auto-generated from picture if blank)" : "e.g. MP847219 or AIRTEL-CI9821 or Cash Slip #104"}
                  value={transactionReference}
                  onChange={(e) => setTransactionReference(e.target.value)}
                  className="w-full bg-white border border-neutral-200 rounded-xl px-3.5 py-2.5 text-sm font-mono text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
                />
                <p className="text-[11px] text-neutral-400 mt-1">
                  {receiptImage 
                    ? 'Picture proof attached. You can leave this blank and UnitSpot will auto-generate an audit verification ID.' 
                    : 'Provide the mobile money SMS code, bank confirmation or paper receipt number.'}
                </p>
              </div>

              {/* Supporting Receipt Note */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-600 mb-1.5">
                  Supporting Note / Verification Evidence
                </label>
                <textarea
                  rows={2}
                  placeholder="Optional notes: e.g. 'Confirmed SMS on treasurer SIM at 14:02'"
                  value={receiptNote}
                  onChange={(e) => setReceiptNote(e.target.value)}
                  className="w-full bg-white border border-neutral-200 rounded-xl px-3.5 py-2 text-xs text-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-900"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={resetAndClose}
                  className="px-4 py-2.5 text-xs font-semibold text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-neutral-900 hover:bg-black text-white px-5 py-2.5 text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  Confirm & Log Payment
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

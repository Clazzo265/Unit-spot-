import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  formatMWK, 
  calculateVerifiedPaidForAssignment, 
  calculatePendingPaidForAssignment 
} from '../../utils/financialCalculations';
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  ShieldCheck, 
  Filter, 
  CreditCard,
  Eye, 
  AlertCircle,
  Image as ImageIcon 
} from 'lucide-react';

export const PaymentHistoryAndVerificationView: React.FC<{
  onOpenRecordModal: (assignmentId?: string) => void;
}> = ({ onOpenRecordModal }) => {
  const { 
    payments, 
    assignments, 
    users, 
    contributions, 
    verifyPayment, 
    currentUser 
  } = useApp();

  const [filterStatus, setFilterStatus] = useState<'all' | 'verified' | 'pending_verification' | 'rejected'>('all');
  const [selectedPaymentForReview, setSelectedPaymentForReview] = useState<any | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');

  const canVerify = currentUser.role === 'super_admin' || currentUser.role === 'group_admin' || currentUser.role === 'treasurer';

  const filteredPayments = payments.filter(p => {
    if (filterStatus === 'all') return true;
    return p.verificationStatus === filterStatus;
  });

  const handleApprove = (paymentId: string) => {
    verifyPayment(paymentId, true);
    setSelectedPaymentForReview(null);
  };

  const handleReject = (paymentId: string) => {
    if (!rejectionReason.trim()) {
      alert('Please provide a reason for rejecting this payment.');
      return;
    }
    verifyPayment(paymentId, false, rejectionReason.trim());
    setSelectedPaymentForReview(null);
    setRejectionReason('');
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
            Audit trail of every payment, Airtel Money & Mpamba reference, and verification status
          </p>
        </div>

        <button
          onClick={() => onOpenRecordModal()}
          className="inline-flex items-center gap-2 bg-neutral-900 hover:bg-black text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-colors shadow-xs cursor-pointer"
        >
          <CreditCard className="w-4 h-4 text-emerald-400" />
          Record New Payment
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1">
        <div className="inline-flex p-1 bg-neutral-100 rounded-xl border border-neutral-200 text-xs">
          {[
            { id: 'all', label: `All Transactions (${payments.length})` },
            { id: 'verified', label: `Verified (${payments.filter(p => p.verificationStatus === 'verified').length})` },
            { id: 'pending_verification', label: `Pending Verification (${payments.filter(p => p.verificationStatus === 'pending_verification').length})` },
            { id: 'rejected', label: `Rejected (${payments.filter(p => p.verificationStatus === 'rejected').length})` },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilterStatus(tab.id as any)}
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
                    No transactions matching this filter.
                  </td>
                </tr>
              ) : (
                filteredPayments.map(p => {
                  const member = users.find(u => u.id === p.memberId);
                  const contribution = contributions.find(c => c.id === p.contributionId);

                  const isVerified = p.verificationStatus === 'verified';
                  const isPending = p.verificationStatus === 'pending_verification';
                  const isRejected = p.verificationStatus === 'rejected';

                  return (
                    <tr key={p.id} className="hover:bg-neutral-50/60 transition-colors">
                      <td className="py-3 px-4 font-mono font-semibold text-neutral-900">
                        {p.id}
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          {member?.avatarUrl ? (
                            <img src={member.avatarUrl} alt={member.name} className="w-6 h-6 rounded-full object-cover" />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-neutral-200 flex items-center justify-center font-bold text-[10px]">
                              {member?.name.charAt(0) || 'M'}
                            </div>
                          )}
                          <span className="font-semibold text-neutral-900">{member?.name || 'Unknown'}</span>
                        </div>
                      </td>

                      <td className="py-3 px-4 text-neutral-600">
                        {contribution?.title || 'Shared Obligation'}
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-bold text-neutral-900 text-sm">
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
                              onClick={() => setSelectedPaymentForReview(p)}
                              className="inline-flex items-center gap-1 text-[10px] font-bold text-neutral-800 bg-neutral-100 hover:bg-neutral-200 px-2 py-0.5 rounded-md mt-1 border border-neutral-200 transition-colors cursor-pointer"
                              title="Click to view captured transaction picture"
                            >
                              <ImageIcon className="w-3 h-3 text-emerald-600" />
                              <span>Photo Proof</span>
                            </button>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-neutral-500">
                        {new Date(p.paymentDate).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </td>

                      <td className="py-3 px-4">
                        {isVerified && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            Verified
                          </span>
                        )}
                        {isPending && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                            <Clock className="w-3.5 h-3.5 text-amber-600" />
                            Pending Verification
                          </span>
                        )}
                        {isRejected && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200">
                            <XCircle className="w-3.5 h-3.5 text-rose-600" />
                            Rejected
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        {isPending && canVerify ? (
                          <button
                            onClick={() => setSelectedPaymentForReview(p)}
                            className="bg-neutral-900 hover:bg-black text-white px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer"
                          >
                            Verify / Reject
                          </button>
                        ) : (
                          <button
                            onClick={() => setSelectedPaymentForReview(p)}
                            className="text-neutral-500 hover:text-neutral-900 px-2 py-1 rounded-lg hover:bg-neutral-100 text-xs font-medium cursor-pointer"
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

      {/* Review & Verification Modal */}
      {selectedPaymentForReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
              <h3 className="font-bold text-neutral-900 text-base">
                Transaction Details & Picture Proof
              </h3>
              <button 
                onClick={() => setSelectedPaymentForReview(null)}
                className="text-neutral-400 hover:text-neutral-700 p-1 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs overflow-y-auto">
              {/* Picture Proof Preview */}
              {(selectedPaymentForReview.receiptImageUrl || selectedPaymentForReview.receiptEvidenceUrl) ? (
                <div className="space-y-1.5">
                  <span className="font-bold text-neutral-800 uppercase tracking-wider text-[11px] block">
                    Captured Transaction Picture / SMS Screenshot:
                  </span>
                  <div className="rounded-xl overflow-hidden border border-neutral-200 bg-neutral-950 flex items-center justify-center max-h-64">
                    <img 
                      src={selectedPaymentForReview.receiptImageUrl || selectedPaymentForReview.receiptEvidenceUrl} 
                      alt="Captured transaction receipt" 
                      className="w-full max-h-64 object-contain"
                    />
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-200 text-neutral-500 text-center text-xs">
                  No screenshot uploaded. Verified by text reference code.
                </div>
              )}

              <div className="bg-neutral-50 p-4 rounded-xl border border-neutral-200 space-y-2">
                <div className="flex justify-between">
                  <span className="text-neutral-500">Transaction ID:</span>
                  <span className="font-mono font-bold text-neutral-900">{selectedPaymentForReview.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Amount Received:</span>
                  <span className="font-bold text-neutral-900 text-sm">{formatMWK(selectedPaymentForReview.amountReceived)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Payment Channel:</span>
                  <span className="font-semibold text-neutral-900 uppercase">{selectedPaymentForReview.paymentMethod.replace('_', ' ')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Reference / SMS Code:</span>
                  <span className="font-mono font-semibold text-neutral-900">{selectedPaymentForReview.transactionReference}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Verification Status:</span>
                  <span className="font-bold capitalize">{selectedPaymentForReview.verificationStatus.replace('_', ' ')}</span>
                </div>
              </div>

              {selectedPaymentForReview.receiptNote && (
                <div className="text-neutral-600 bg-neutral-50 p-3 rounded-xl border border-neutral-100">
                  <span className="font-semibold text-neutral-700 block mb-1">Receipt Note:</span>
                  &ldquo;{selectedPaymentForReview.receiptNote}&rdquo;
                </div>
              )}

              {selectedPaymentForReview.verificationStatus === 'pending_verification' && canVerify && (
                <div className="space-y-3 pt-2">
                  <div>
                    <label className="block font-semibold uppercase tracking-wider text-neutral-600 mb-1">
                      Rejection Reason (if rejecting)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Reference code not found on Airtel Money statement"
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <button
                      onClick={() => handleReject(selectedPaymentForReview.id)}
                      className="flex-1 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold py-2.5 rounded-xl border border-rose-200 transition-colors cursor-pointer"
                    >
                      Reject Payment
                    </button>
                    <button
                      onClick={() => handleApprove(selectedPaymentForReview.id)}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl transition-colors shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Verify & Approve
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

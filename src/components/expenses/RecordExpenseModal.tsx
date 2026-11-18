import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { ExpenseCategory } from '../../types';
import { formatMWK } from '../../utils/financialCalculations';
import { parseMWKInput } from '../../utils/financialConfig';
import {
  ORDERED_CONTRIBUTION_CATEGORIES,
  getExpenseCategoryLabel,
  getGroupPreset,
} from '../../utils/groupPresets';
import { Modal } from '../ui/Modal';
import { FileUploadField, UploadedFileState } from '../ui/FileUploadField';
import { Plus, AlertCircle, CheckCircle } from 'lucide-react';

interface RecordExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RecordExpenseModal: React.FC<RecordExpenseModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { currentGroup, currentUser, recordExpense } = useApp();
  const { showToast } = useToast();

  const preset = useMemo(() => getGroupPreset(currentGroup?.category), [currentGroup?.category]);

  const [name, setName] = useState<string>('');
  const [category, setCategory] = useState<ExpenseCategory>(
    preset.suggestedExpenseCategories[0] || 'other'
  );
  const [customCategoryLabel, setCustomCategoryLabel] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [expenseDate, setExpenseDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState<string>('');
  const [receiptNumber, setReceiptNumber] = useState<string>('');
  const [uploadedReceipt, setUploadedReceipt] = useState<UploadedFileState | null>(null);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'uploaded' | 'error'>('idle');
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setCategory(preset.suggestedExpenseCategories[0] || 'other');
      setCustomCategoryLabel('');
      setExpenseDate(new Date().toISOString().split('T')[0]);
      setError('');
    }
  }, [isOpen, currentGroup?.id, preset]);

  const sortedCategories = useMemo(() => {
    const suggested = new Set(preset.suggestedExpenseCategories);
    return [
      ...preset.suggestedExpenseCategories.filter((c) => ORDERED_CONTRIBUTION_CATEGORIES.includes(c)),
      ...ORDERED_CONTRIBUTION_CATEGORIES.filter((c) => !suggested.has(c)),
    ];
  }, [preset]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentGroup || !currentUser || isSubmitting) return;
    setError('');

    if (uploadStatus === 'uploading') {
      setError('Please wait for the receipt file upload to finish before saving.');
      return;
    }

    const parsedAmount = parseMWKInput(amount);
    if (!parsedAmount.valid) {
      setError(parsedAmount.error || 'Please provide a valid whole-MWK expense amount.');
      return;
    }

    if (!name.trim()) {
      setError('Please provide an expense title.');
      return;
    }

    if (category === 'other' && customCategoryLabel.trim().length > 80) {
      setError('Custom category name must be 80 characters or fewer.');
      return;
    }

    setIsSubmitting(true);
    const isoDate = expenseDate ? new Date(expenseDate).toISOString() : new Date().toISOString();

    const result = recordExpense({
      groupId: currentGroup.id,
      name: name.trim(),
      category,
      customCategoryLabel: category === 'other' && customCategoryLabel.trim() ? customCategoryLabel.trim() : undefined,
      amount: parsedAmount.value,
      date: Number.isNaN(new Date(isoDate).getTime()) ? new Date().toISOString() : isoDate,
      description: description.trim(),
      responsiblePersonId: currentUser.id,
      receiptNumber: receiptNumber.trim() || undefined,
      receiptImageUrl: uploadedReceipt?.url,
      receiptStoragePath: uploadedReceipt?.storagePath,
      receiptEvidenceUrl: uploadedReceipt?.url,
      receiptFileName: uploadedReceipt?.fileName,
      receiptFileType: uploadedReceipt?.fileType,
      receiptFileSize: uploadedReceipt?.fileSize,
    });

    setIsSubmitting(false);
    if (!result.success) {
      setError(result.error || 'Could not save expense.');
      return;
    }

    showToast('Expense Recorded', {
      message: `${name.trim()} (${formatMWK(parsedAmount.value)}) logged.`,
    });
    setSuccess(true);
  };

  const resetAndClose = () => {
    setName('');
    setCustomCategoryLabel('');
    setAmount('');
    setDescription('');
    setReceiptNumber('');
    setUploadedReceipt(null);
    setUploadStatus('idle');
    setError('');
    setSuccess(false);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={resetAndClose}
      title="Record Group Expense"
      subtitle="Show members where shared funds were spent"
      maxWidthClass="max-w-lg"
    >
      {!currentGroup || !currentUser ? (
        <div className="py-6 text-center space-y-3">
          <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">
            Please create or select a group first.
          </p>
          <button
            type="button"
            onClick={resetAndClose}
            className="min-h-[44px] bg-slate-900 dark:bg-blue-600 text-white px-5 py-2 rounded-xl text-xs font-semibold cursor-pointer"
          >
            Close
          </button>
        </div>
      ) : success ? (
        <div className="text-center py-4 space-y-3">
          <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle className="w-6 h-6" />
          </div>
          <h4 className="font-bold text-slate-900 dark:text-white text-lg">Expense Logged</h4>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Group expense ledger updated for{' '}
            <strong className="text-slate-900 dark:text-white">{currentGroup.name}</strong>.
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={resetAndClose}
              className="min-h-[44px] bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white font-semibold px-6 py-2 rounded-xl text-xs transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div
              role="alert"
              className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs rounded-xl flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
              Expense Purpose / Item Name *
            </label>
            <input
              type="text"
              placeholder="e.g. ESCOM Token, Venue Hire, Food & Drinks, Generator Petrol"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full min-h-[44px] bg-white dark:bg-[#11192C] border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:outline-none"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                Category *
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                className="w-full min-h-[44px] bg-white dark:bg-[#11192C] border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none"
              >
                {sortedCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {getExpenseCategoryLabel(cat)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                Amount Paid (MWK) *
              </label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="e.g. 35000"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))}
                className="w-full min-h-[44px] bg-white dark:bg-[#11192C] border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-sm font-bold font-mono text-slate-900 dark:text-white tabular-nums focus:outline-none"
                required
              />
            </div>
          </div>

          {category === 'other' && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                Custom Category Name (Optional)
              </label>
              <input
                type="text"
                maxLength={80}
                placeholder="e.g. Charcoal, Generator Servicing, Borehole Pump"
                value={customCategoryLabel}
                onChange={(e) => setCustomCategoryLabel(e.target.value)}
                className="w-full min-h-[44px] bg-white dark:bg-[#11192C] border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white focus:outline-none"
              />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                Expense Date *
              </label>
              <input
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                className="w-full min-h-[44px] bg-white dark:bg-[#11192C] border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                Receipt / Token Number
              </label>
              <input
                type="text"
                placeholder="e.g. ESCOM-TKN-9281"
                value={receiptNumber}
                onChange={(e) => setReceiptNumber(e.target.value)}
                className="w-full min-h-[44px] bg-white dark:bg-[#11192C] border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-900 dark:text-white focus:outline-none"
              />
            </div>
          </div>

          <FileUploadField
            label="Receipt / Invoice Attachment (Optional)"
            helperText="Attach a photo or PDF invoice from Firebase Storage (up to 5 MB)."
            folder="receipts"
            groupId={currentGroup.id}
            recordIdPrefix="exp"
            scopeMeta={{
              uploaderUid: currentUser.id,
              adminId: currentGroup.adminId,
              treasurerId: currentGroup.treasurerId,
            }}
            allowPdf
            allowCamera
            value={uploadedReceipt}
            onChange={setUploadedReceipt}
            onStatusChange={setUploadStatus}
          />

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
              Description / Vendor Notes
            </label>
            <textarea
              rows={2}
              placeholder="Details of expense, vendor invoice number or receipt notes..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-white dark:bg-[#11192C] border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={resetAndClose}
              className="min-h-[44px] px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#131D33] rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={uploadStatus === 'uploading' || isSubmitting}
              className="min-h-[44px] bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 disabled:opacity-50 text-white px-5 py-2 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>
                {uploadStatus === 'uploading'
                  ? 'Uploading receipt...'
                  : isSubmitting
                    ? 'Saving...'
                    : 'Save Expense'}
              </span>
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
};


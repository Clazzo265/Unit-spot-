import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { ExpenseCategory } from '../../types';
import { parseMWKInput } from '../../utils/financialConfig';
import { X, Receipt, Plus, AlertCircle, CheckCircle } from 'lucide-react';

interface RecordExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RecordExpenseModal: React.FC<RecordExpenseModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { currentGroup, currentUser, recordExpense } = useApp();

  const [name, setName] = useState<string>('');
  const [category, setCategory] = useState<ExpenseCategory>('electricity');
  const [amount, setAmount] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [receiptNumber, setReceiptNumber] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<boolean>(false);

  if (!isOpen) return null;

  if (!currentGroup || !currentUser) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
        <div className="bg-white w-full max-w-sm rounded-2xl p-6 text-center space-y-3">
          <p className="font-bold text-neutral-800 text-sm">
            Please create or select a financial group first.
          </p>
          <button
            onClick={onClose}
            className="bg-neutral-900 text-white px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const parsedAmount = parseMWKInput(amount);
    if (!parsedAmount.valid) {
      setError(parsedAmount.error || 'Please provide a valid whole-MWK expense amount.');
      return;
    }

    if (!name.trim()) {
      setError('Please provide an expense title.');
      return;
    }

    const result = recordExpense({
      groupId: currentGroup.id,
      name: name.trim(),
      category,
      amount: parsedAmount.value,
      date: new Date().toISOString(),
      description: description.trim(),
      responsiblePersonId: currentUser.id,
      receiptNumber: receiptNumber.trim() || undefined,
    });

    if (!result.success) {
      setError(result.error || 'Could not save expense.');
      return;
    }

    setSuccess(true);
  };

  const resetAndClose = () => {
    setName('');
    setAmount('');
    setDescription('');
    setReceiptNumber('');
    setError('');
    setSuccess(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-neutral-900 text-white flex items-center justify-center font-bold text-sm">
              <Receipt className="w-4 h-4 text-[#D5A52B]" />
            </div>
            <div>
              <h3 className="font-bold text-neutral-900 text-base leading-tight">
                Record Group Expense
              </h3>
              <p className="text-xs text-neutral-500">
                Log where collected funds were spent
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

        <div className="p-6">
          {success ? (
            <div className="text-center py-4 space-y-3">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-neutral-900 text-lg">
                Expense Logged
              </h4>
              <p className="text-xs text-neutral-600">
                Financial reconciliation ledger has been updated for{' '}
                <strong className="text-neutral-900">{currentGroup.name}</strong>.
              </p>
              <div className="pt-2">
                <button
                  onClick={resetAndClose}
                  className="bg-neutral-900 hover:bg-black text-white font-semibold px-5 py-2 rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Done
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

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-600 mb-1.5">
                  Expense Purpose / Item Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. ESCOM Electricity Token, Security Guard Fee, Generator Petrol"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-white border border-neutral-200 rounded-xl px-3.5 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-600 mb-1.5">
                    Category *
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                    className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
                  >
                    <option value="electricity">Electricity</option>
                    <option value="water">Water Utility</option>
                    <option value="rent">Rent</option>
                    <option value="internet">Internet / WiFi</option>
                    <option value="security">Security</option>
                    <option value="waste">Waste Disposal</option>
                    <option value="groceries">Shared Groceries</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-600 mb-1.5">
                    Amount Paid (MWK) *
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="e.g. 35000"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))}
                    className="w-full bg-white border border-neutral-200 rounded-xl px-3.5 py-2 text-sm font-bold text-neutral-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-neutral-900"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-600 mb-1.5">
                  Receipt / Token Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. ESCOM-TKN-9281-0021"
                  value={receiptNumber}
                  onChange={(e) => setReceiptNumber(e.target.value)}
                  className="w-full bg-white border border-neutral-200 rounded-xl px-3.5 py-2 text-xs font-mono text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-600 mb-1.5">
                  Description / Vendor Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Details of expense, vendor invoice number or receipt notes..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs text-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-900"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={resetAndClose}
                  className="px-4 py-2 text-xs font-semibold text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-neutral-900 hover:bg-black text-white px-5 py-2 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  Save Expense
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { ExpenseCategory } from '../../types';
import { formatMWK } from '../../utils/financialCalculations';
import { X, Calendar, Plus, Users, AlertCircle, CheckCircle2 } from 'lucide-react';

interface CreateContributionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateContributionModal: React.FC<CreateContributionModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { currentGroup, groupMembers, users, createContribution } = useApp();

  const membersInGroup = currentGroup 
    ? groupMembers
        .filter(gm => gm.groupId === currentGroup.id)
        .map(gm => users.find(u => u.id === gm.userId))
        .filter((u): u is NonNullable<typeof u> => Boolean(u))
    : [];

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('electricity');
  const [totalTargetAmount, setTotalTargetAmount] = useState<string>('');
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  
  // Default deadline 10 days from now
  const [deadline, setDeadline] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 10);
    return d.toISOString().split('T')[0];
  });
  const [description, setDescription] = useState<string>('');
  
  // Allocation mode: equal or custom
  const [allocationMode, setAllocationMode] = useState<'equal' | 'custom'>('equal');

  // Custom member assignments state
  const [customAmounts, setCustomAmounts] = useState<Record<string, { amount: string; notes: string }>>({});

  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Sync member custom amounts when members change or target changes
  React.useEffect(() => {
    if (membersInGroup.length > 0) {
      const perPerson = totalTargetAmount ? Math.floor(Number(totalTargetAmount) / membersInGroup.length) : '';
      const initial: Record<string, { amount: string; notes: string }> = {};
      membersInGroup.forEach(m => {
        initial[m.id] = { amount: perPerson ? String(perPerson) : '', notes: '' };
      });
      setCustomAmounts(initial);
    }
  }, [membersInGroup.length]);

  if (!isOpen) return null;

  if (!currentGroup) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
        <div className="bg-white w-full max-w-sm rounded-2xl p-6 text-center space-y-3">
          <p className="font-bold text-neutral-800 text-sm">Please create or select a financial group first.</p>
          <button
            onClick={onClose}
            className="bg-neutral-900 text-white px-4 py-2 rounded-xl text-xs font-semibold"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const handleEqualDistribute = (total: number) => {
    if (membersInGroup.length === 0) return;
    const perPerson = Math.floor(total / membersInGroup.length);
    const updated: Record<string, { amount: string; notes: string }> = {};
    membersInGroup.forEach(m => {
      updated[m.id] = { 
        amount: String(perPerson), 
        notes: customAmounts[m.id]?.notes || 'Equal share' 
      };
    });
    setCustomAmounts(updated);
  };

  const handleTotalChange = (val: string) => {
    setTotalTargetAmount(val);
    const num = Number(val);
    if (num > 0 && allocationMode === 'equal') {
      handleEqualDistribute(num);
    }
  };

  const calculatedSum = Object.values(customAmounts).reduce(
    (sum, item) => sum + (Number(item.amount) || 0), 
    0
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const targetNum = Number(totalTargetAmount);
    if (!targetNum || targetNum <= 0) {
      setError('Please provide a valid target amount.');
      return;
    }

    if (!title.trim()) {
      setError('Please provide a contribution title.');
      return;
    }

    if (membersInGroup.length === 0) {
      setError('Please add members to this group in the Directory tab before assigning obligations.');
      return;
    }

    const assignmentsPayload = membersInGroup.map(m => {
      const custom = customAmounts[m.id];
      const amt = custom ? Number(custom.amount) : 0;
      return {
        memberId: m.id,
        amount: amt > 0 ? amt : 0,
        notes: custom?.notes || undefined,
      };
    });

    createContribution(
      {
        groupId: currentGroup.id,
        title: title.trim(),
        category,
        month,
        year,
        totalTargetAmount: targetNum,
        deadline: `${deadline}T23:59:59Z`,
        description: description.trim() || undefined,
        status: 'active',
      },
      assignmentsPayload
    );

    setSuccess(true);
  };

  const resetAndClose = () => {
    setError('');
    setSuccess(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-neutral-900 text-white flex items-center justify-center font-bold text-sm">
              <Calendar className="w-4 h-4 text-[#D5A52B]" />
            </div>
            <div>
              <h3 className="font-bold text-neutral-900 text-base leading-tight">
                Create Monthly Contribution
              </h3>
              <p className="text-xs text-neutral-500">
                Assign obligations for {currentGroup.name}
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

        <div className="p-6 overflow-y-auto">
          {success ? (
            <div className="text-center py-6 space-y-3">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-neutral-900 text-xl">
                Contribution Assigned!
              </h4>
              <p className="text-xs text-neutral-600 max-w-sm mx-auto">
                Target amount of <strong className="text-neutral-900">{formatMWK(Number(totalTargetAmount))}</strong> distributed across {membersInGroup.length} members. Notifications dispatched.
              </p>
              <div className="pt-2">
                <button
                  onClick={resetAndClose}
                  className="bg-neutral-900 hover:bg-black text-white font-semibold px-5 py-2.5 rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Return to Dashboard
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
                  Contribution Title *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Electricity Bill, Shared Water, Generator Fuel, Rent"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-white border border-neutral-200 rounded-xl px-3.5 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
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
                    <option value="water">Water</option>
                    <option value="rent">Rent</option>
                    <option value="internet">Internet</option>
                    <option value="security">Security</option>
                    <option value="waste">Waste</option>
                    <option value="groceries">Groceries</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-600 mb-1.5">
                    Total Target (MWK) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="e.g. 50000"
                    value={totalTargetAmount}
                    onChange={(e) => handleTotalChange(e.target.value)}
                    className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs font-bold text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-600 mb-1.5">
                    Payment Deadline *
                  </label>
                  <input
                    type="date"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
                    required
                  />
                </div>
              </div>

              {/* Allocation Mode Tabs */}
              {membersInGroup.length > 0 ? (
                <div className="pt-1">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-neutral-600">
                      Member Allocation Strategy
                    </span>
                    <div className="inline-flex p-0.5 bg-neutral-100 rounded-lg border border-neutral-200 text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          setAllocationMode('equal');
                          if (totalTargetAmount) handleEqualDistribute(Number(totalTargetAmount));
                        }}
                        className={`px-3 py-1 rounded-md font-medium transition-all ${
                          allocationMode === 'equal' ? 'bg-white shadow-xs text-neutral-900 font-bold' : 'text-neutral-600'
                        }`}
                      >
                        Equal Share
                      </button>
                      <button
                        type="button"
                        onClick={() => setAllocationMode('custom')}
                        className={`px-3 py-1 rounded-md font-medium transition-all ${
                          allocationMode === 'custom' ? 'bg-white shadow-xs text-neutral-900 font-bold' : 'text-neutral-600'
                        }`}
                      >
                        Custom Amounts
                      </button>
                    </div>
                  </div>

                  {/* Member List Inputs */}
                  <div className="border border-neutral-200 rounded-xl overflow-hidden divide-y divide-neutral-100">
                    <div className="bg-neutral-50 px-3.5 py-2 text-[11px] font-semibold text-neutral-500 uppercase tracking-wider flex justify-between">
                      <span>Member</span>
                      <span>Assigned MWK</span>
                    </div>
                    {membersInGroup.map(m => (
                      <div key={m.id} className="p-3 flex items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2">
                          {m.avatarUrl ? (
                            <img src={m.avatarUrl} alt={m.name} className="w-7 h-7 rounded-full object-cover" />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-neutral-200 flex items-center justify-center font-bold">
                              {m.name.charAt(0)}
                            </div>
                          )}
                          <div>
                            <div className="font-semibold text-neutral-900">{m.name}</div>
                            <div className="text-[10px] text-neutral-500">{m.phone}</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-neutral-400 font-medium">MK</span>
                          <input
                            type="number"
                            value={customAmounts[m.id]?.amount || ''}
                            onChange={(e) => {
                              setCustomAmounts(prev => ({
                                ...prev,
                                [m.id]: { ...prev[m.id], amount: e.target.value }
                              }));
                            }}
                            className="w-24 bg-white border border-neutral-200 rounded-lg px-2.5 py-1 text-xs font-bold text-neutral-900 text-right focus:outline-none focus:ring-1 focus:ring-neutral-900"
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-2 flex items-center justify-between text-xs px-1">
                    <span className="text-neutral-500">Allocated Sum:</span>
                    <span className={`font-bold ${calculatedSum === Number(totalTargetAmount) ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {formatMWK(calculatedSum)} / {formatMWK(Number(totalTargetAmount))}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                  This group currently has 0 enrolled members. Go to <strong>Groups & Directory</strong> to add members first.
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-600 mb-1.5">
                  Rules or Note to Members
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Please send payment to treasurer via Airtel Money or Mpamba before the 10th."
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
                  disabled={membersInGroup.length === 0}
                  className="bg-neutral-900 hover:bg-black disabled:bg-neutral-300 text-white px-5 py-2.5 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  Assign & Dispatch
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

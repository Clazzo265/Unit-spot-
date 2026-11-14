import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { ExpenseCategory } from '../../types';
import { formatMWK } from '../../utils/financialCalculations';
import {
  RATES,
  STOVE_TYPE_LABELS,
  isValidStoveType,
  parseMWKInput,
  resolveMemberInfo,
} from '../../utils/financialConfig';
import { Modal } from '../ui/Modal';
import { Plus, AlertCircle, CheckCircle2, AlertTriangle } from 'lucide-react';

interface CreateContributionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateContributionModal: React.FC<CreateContributionModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { currentGroup, groupMembers, users, createContribution } = useApp();
  const { showToast } = useToast();

  const activeMembers = useMemo(() => {
    if (!currentGroup) return [];
    return groupMembers
      .filter((gm) => gm.groupId === currentGroup.id && gm.status === 'active')
      .map((gm) => ({
        member: gm,
        info: resolveMemberInfo(gm.id, groupMembers, users),
      }));
  }, [currentGroup, groupMembers, users]);

  const membersMissingStove = useMemo(
    () => activeMembers.filter(({ member }) => !isValidStoveType(member.stoveType)),
    [activeMembers]
  );

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('electricity');
  const [totalTargetAmount, setTotalTargetAmount] = useState<string>('');
  const [month] = useState<number>(new Date().getMonth() + 1);
  const [year] = useState<number>(new Date().getFullYear());

  const [deadline, setDeadline] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 10);
    return d.toISOString().split('T')[0];
  });
  const [description, setDescription] = useState<string>('');
  const [allocationMode, setAllocationMode] = useState<'stove_rate' | 'equal' | 'custom'>(
    'stove_rate'
  );
  const [customAmounts, setCustomAmounts] = useState<
    Record<string, { amount: string; notes: string }>
  >({});

  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const applyStoveRateDistribution = () => {
    if (activeMembers.length === 0) return;
    const next: Record<string, { amount: string; notes: string }> = {};
    let total = 0;
    activeMembers.forEach(({ member }) => {
      if (isValidStoveType(member.stoveType)) {
        const rate = RATES[member.stoveType];
        total += rate;
        next[member.id] = {
          amount: String(rate),
          notes: `${STOVE_TYPE_LABELS[member.stoveType]} Rate`,
        };
      } else {
        next[member.id] = { amount: '', notes: 'Stove classification needed' };
      }
    });
    setCustomAmounts(next);
    if (total > 0) {
      setTotalTargetAmount(String(total));
    }
  };

  const handleEqualDistribute = (total: number) => {
    if (activeMembers.length === 0) return;
    const perPerson = Math.floor(total / activeMembers.length);
    const updated: Record<string, { amount: string; notes: string }> = {};
    activeMembers.forEach(({ member }) => {
      updated[member.id] = {
        amount: String(perPerson),
        notes: 'Equal share',
      };
    });
    setCustomAmounts(updated);
  };

  useEffect(() => {
    if (!isOpen) return;
    if (activeMembers.length > 0) {
      if (allocationMode === 'stove_rate') {
        applyStoveRateDistribution();
      } else if (allocationMode === 'equal' && totalTargetAmount) {
        const parsed = parseMWKInput(totalTargetAmount);
        if (parsed.valid) handleEqualDistribute(parsed.value);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, activeMembers.length, allocationMode]);

  const handleTotalChange = (val: string) => {
    const clean = val.replace(/[^\d]/g, '');
    setTotalTargetAmount(clean);
    const parsed = parseMWKInput(clean);
    if (parsed.valid && allocationMode === 'equal') {
      handleEqualDistribute(parsed.value);
    }
  };

  const calculatedSum = activeMembers.reduce((sum, { member }) => {
    const raw = customAmounts[member.id]?.amount;
    const parsed = parseMWKInput(raw, { allowZero: true });
    return sum + (parsed.valid ? parsed.value : 0);
  }, 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentGroup) return;
    setError('');

    if (!title.trim()) {
      setError('Please provide a contribution title.');
      return;
    }

    if (activeMembers.length === 0) {
      setError(
        'Please add active members to this group in the Directory tab before assigning obligations.'
      );
      return;
    }

    if (allocationMode === 'stove_rate' && membersMissingStove.length > 0) {
      setError(
        `Classify stove type (Electric or Non-Electric) in Directory for: ${membersMissingStove
          .map((m) => m.member.name)
          .join(', ')}.`
      );
      return;
    }

    const parsedTarget = parseMWKInput(totalTargetAmount);
    if (!parsedTarget.valid) {
      setError(parsedTarget.error || 'Please provide a valid whole MWK target amount.');
      return;
    }

    const assignmentsPayload: { memberId: string; amount: number; notes?: string }[] = [];
    for (const { member } of activeMembers) {
      const custom = customAmounts[member.id];
      const parsedMemberAmt = parseMWKInput(custom?.amount);
      if (!parsedMemberAmt.valid) {
        setError(
          `Invalid amount for ${member.name}: ${parsedMemberAmt.error || 'Enter a whole MWK integer.'}`
        );
        return;
      }
      assignmentsPayload.push({
        memberId: member.id,
        amount: parsedMemberAmt.value,
        notes: custom?.notes || (allocationMode === 'custom' ? 'custom' : undefined),
      });
    }

    const result = createContribution(
      {
        groupId: currentGroup.id,
        title: title.trim(),
        category,
        month,
        year,
        totalTargetAmount: parsedTarget.value,
        deadline: `${deadline}T23:59:59Z`,
        description: description.trim() || undefined,
        status: 'active',
      },
      assignmentsPayload
    );

    if (!result.success) {
      setError(result.error || 'Failed to create contribution.');
      return;
    }

    showToast('Contribution Assigned', {
      message: `${title.trim()} (${formatMWK(parsedTarget.value)}) assigned to ${activeMembers.length} member(s).`,
    });
    setSuccess(true);
  };

  const resetAndClose = () => {
    setError('');
    setSuccess(false);
    setTitle('');
    setDescription('');
    onClose();
  };

  const parsedTargetDisplay = parseMWKInput(totalTargetAmount, { allowZero: true });
  const targetInt = parsedTargetDisplay.valid ? parsedTargetDisplay.value : 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={resetAndClose}
      title="Create Contribution Obligation"
      subtitle={currentGroup ? `Assign obligations for ${currentGroup.name}` : 'No group active'}
      maxWidthClass="max-w-xl"
    >
      {!currentGroup ? (
        <div className="py-6 text-center space-y-3">
          <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">
            Please create or select a financial group first.
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
        <div className="text-center py-6 space-y-3">
          <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h4 className="font-bold text-slate-900 dark:text-white text-xl">
            Contribution Assigned
          </h4>
          <p className="text-xs text-slate-600 dark:text-slate-400 max-w-sm mx-auto tabular-nums">
            Target of <strong className="text-slate-900 dark:text-white">{formatMWK(targetInt)}</strong>{' '}
            distributed across {activeMembers.length} active member(s) with locked rate snapshots.
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={resetAndClose}
              className="min-h-[44px] bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white font-semibold px-6 py-2.5 rounded-xl text-xs transition-colors cursor-pointer"
            >
              Return to Dashboard
            </button>
          </div>
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

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
              Contribution Title *
            </label>
            <input
              type="text"
              placeholder="e.g. May ESCOM Electricity, Water Bill, Shared Rent"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full min-h-[44px] bg-white dark:bg-[#11192C] border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:outline-none"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                Category *
              </label>
              <select
                value={category}
                onChange={(e) => {
                  const nextCat = e.target.value as ExpenseCategory;
                  setCategory(nextCat);
                  if (nextCat !== 'electricity' && allocationMode === 'stove_rate') {
                    setAllocationMode('equal');
                  }
                }}
                className="w-full min-h-[44px] bg-white dark:bg-[#11192C] border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none"
              >
                <option value="electricity">Electricity</option>
                <option value="water">Water Utility</option>
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
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                Total Target (MWK) *
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="e.g. 50000"
                value={totalTargetAmount}
                onChange={(e) => handleTotalChange(e.target.value)}
                readOnly={allocationMode === 'stove_rate'}
                className={`w-full min-h-[44px] border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold font-mono text-slate-900 dark:text-white tabular-nums focus:outline-none ${
                  allocationMode === 'stove_rate'
                    ? 'bg-slate-50 dark:bg-[#131D33]'
                    : 'bg-white dark:bg-[#11192C]'
                }`}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                Payment Deadline *
              </label>
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full min-h-[44px] bg-white dark:bg-[#11192C] border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none"
                required
              />
            </div>
          </div>

          {activeMembers.length > 0 ? (
            <div className="pt-1 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Allocation Strategy
                </span>
                <div className="inline-flex p-1 bg-slate-100 dark:bg-[#11192C] rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setAllocationMode('stove_rate');
                      applyStoveRateDistribution();
                    }}
                    className={`min-h-[34px] px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer whitespace-nowrap ${
                      allocationMode === 'stove_rate'
                        ? 'bg-white dark:bg-blue-600 shadow-xs text-slate-900 dark:text-white font-bold'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Stove Rate
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAllocationMode('equal');
                      if (targetInt > 0) handleEqualDistribute(targetInt);
                    }}
                    className={`min-h-[34px] px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer whitespace-nowrap ${
                      allocationMode === 'equal'
                        ? 'bg-white dark:bg-blue-600 shadow-xs text-slate-900 dark:text-white font-bold'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Equal Share
                  </button>
                  <button
                    type="button"
                    onClick={() => setAllocationMode('custom')}
                    className={`min-h-[34px] px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer whitespace-nowrap ${
                      allocationMode === 'custom'
                        ? 'bg-white dark:bg-blue-600 shadow-xs text-slate-900 dark:text-white font-bold'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Custom
                  </button>
                </div>
              </div>

              {allocationMode === 'stove_rate' && membersMissingStove.length > 0 && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">
                      Stove classification required before auto-splitting:
                    </span>
                    <span>
                      {membersMissingStove.map((m) => m.member.name).join(', ')} — classify in
                      Group Directory first.
                    </span>
                  </div>
                </div>
              )}

              {/* Member List Inputs */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
                <div className="bg-slate-50 dark:bg-[#11192C] px-3.5 py-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex justify-between">
                  <span>Active Member &amp; Stove Tier</span>
                  <span>Assigned MWK</span>
                </div>
                {activeMembers.map(({ member, info }) => (
                  <div
                    key={member.id}
                    className="p-3 flex items-center justify-between gap-3 text-xs bg-white dark:bg-[#0D1424]"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-[#131D33] text-slate-800 dark:text-slate-200 flex items-center justify-center font-bold shrink-0">
                        {member.name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900 dark:text-white truncate">
                          {member.name}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 flex-wrap">
                          <span>{info?.roomNumber || 'Main unit'}</span>
                          <span aria-hidden="true">·</span>
                          {isValidStoveType(member.stoveType) ? (
                            <span className="font-medium text-slate-700 dark:text-slate-300 tabular-nums">
                              {STOVE_TYPE_LABELS[member.stoveType]} (
                              {formatMWK(RATES[member.stoveType])})
                            </span>
                          ) : (
                            <span className="text-amber-700 dark:text-amber-400 font-semibold">
                              Stove Type Unset
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-slate-400 font-medium">MK</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        readOnly={allocationMode === 'stove_rate'}
                        value={customAmounts[member.id]?.amount || ''}
                        onChange={(e) => {
                          const digits = e.target.value.replace(/[^\d]/g, '');
                          setAllocationMode('custom');
                          setCustomAmounts((prev) => ({
                            ...prev,
                            [member.id]: {
                              amount: digits,
                              notes: 'custom',
                            },
                          }));
                        }}
                        className={`w-24 min-h-[38px] border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs font-bold font-mono text-slate-900 dark:text-white text-right tabular-nums focus:outline-none ${
                          allocationMode === 'stove_rate'
                            ? 'bg-slate-50 dark:bg-[#131D33]'
                            : 'bg-white dark:bg-[#11192C]'
                        }`}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between text-xs px-1 tabular-nums">
                <span className="text-slate-500 dark:text-slate-400">Allocated Sum:</span>
                <span
                  className={`font-bold font-mono ${
                    calculatedSum === targetInt
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : 'text-amber-700 dark:text-amber-400'
                  }`}
                >
                  {formatMWK(calculatedSum)} / {formatMWK(targetInt)}
                </span>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-800 dark:text-amber-200">
              This group currently has 0 active members. Go to{' '}
              <strong>Groups &amp; Directory</strong> to register members first.
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
              Rules or Note to Members
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Send Airtel Money or TNM Mpamba before deadline."
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
              disabled={activeMembers.length === 0}
              className="min-h-[44px] bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 disabled:opacity-50 text-white px-5 py-2.5 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>Assign &amp; Dispatch</span>
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
};

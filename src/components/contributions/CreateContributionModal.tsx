import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { ContributionAllocationMode, ExpenseCategory } from '../../types';
import { formatMWK } from '../../utils/financialCalculations';
import {
  RATES,
  STOVE_TYPE_LABELS,
  allocateByPercentage,
  formatDeadlineLabel,
  isStoveBillingApplicable,
  isValidStoveType,
  parseMWKInput,
  resolveMemberInfo,
  validateCustomAllocations,
} from '../../utils/financialConfig';
import {
  ORDERED_CONTRIBUTION_CATEGORIES,
  getExpenseCategoryLabel,
  getGroupPreset,
} from '../../utils/groupPresets';
import { Modal } from '../ui/Modal';
import { FileUploadField, UploadedFileState } from '../ui/FileUploadField';
import { Plus, AlertCircle, CheckCircle2, AlertTriangle } from 'lucide-react';

interface CreateContributionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function buildStarterPercentages(memberIds: string[]): Record<string, string> {
  if (memberIds.length === 0) return {};
  const count = memberIds.length;
  const baseBp = Math.floor(10000 / count);
  let rem = 10000 - baseBp * count;
  const out: Record<string, string> = {};
  memberIds.forEach((id, idx) => {
    const bp = baseBp + (idx === count - 1 ? rem : 0);
    if (idx === count - 1) rem = 0;
    const pctStr = (bp / 100).toFixed(2).replace(/\.00$/, '');
    out[id] = pctStr;
  });
  return out;
}

export const CreateContributionModal: React.FC<CreateContributionModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { currentGroup, currentUser, groupMembers, users, createContribution } = useApp();
  const { showToast } = useToast();

  const preset = useMemo(() => getGroupPreset(currentGroup?.category), [currentGroup?.category]);

  const activeMembers = useMemo(() => {
    if (!currentGroup) return [];
    return groupMembers
      .filter((gm) => gm.groupId === currentGroup.id && gm.status === 'active')
      .map((gm) => ({
        member: gm,
        info: resolveMemberInfo(gm.id, groupMembers, users),
      }));
  }, [currentGroup, groupMembers, users]);

  const responsibleCandidates = useMemo(() => {
    if (!currentGroup) return [];
    const managers = activeMembers.filter(
      ({ member }) => member.roleInGroup === 'admin' || member.roleInGroup === 'treasurer'
    );
    return managers.length > 0 ? managers : activeMembers;
  }, [activeMembers, currentGroup]);

  const membersMissingStove = useMemo(
    () => activeMembers.filter(({ member }) => !isValidStoveType(member.stoveType)),
    [activeMembers]
  );

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>(
    preset.suggestedContributionCategories[0] || 'other'
  );
  const [customCategoryLabel, setCustomCategoryLabel] = useState('');
  const [totalTargetAmount, setTotalTargetAmount] = useState<string>('');
  const [month] = useState<number>(new Date().getMonth() + 1);
  const [year] = useState<number>(new Date().getFullYear());

  const [deadline, setDeadline] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 10);
    return d.toISOString().split('T')[0];
  });
  const [hasNoDeadline, setHasNoDeadline] = useState<boolean>(false);
  const [responsiblePersonId, setResponsiblePersonId] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [supportingDoc, setSupportingDoc] = useState<UploadedFileState | null>(null);
  const [docUploadStatus, setDocUploadStatus] = useState<
    'idle' | 'uploading' | 'uploaded' | 'error'
  >('idle');

  const stoveBillingApplicable = useMemo(
    () => isStoveBillingApplicable(currentGroup, category),
    [currentGroup, category]
  );

  const resolveDefaultModeForCategory = (cat: ExpenseCategory): ContributionAllocationMode => {
    if (isStoveBillingApplicable(currentGroup, cat)) {
      return 'stove_rate';
    }
    return preset.defaultAllocationMode === 'stove_rate' ? 'percentage' : preset.defaultAllocationMode;
  };

  const [allocationMode, setAllocationMode] = useState<ContributionAllocationMode>(() =>
    resolveDefaultModeForCategory(preset.suggestedContributionCategories[0] || 'other')
  );

  const [customAmounts, setCustomAmounts] = useState<
    Record<string, { amount: string; notes: string }>
  >({});
  const [percentageInputs, setPercentageInputs] = useState<Record<string, string>>({});

  const [error, setError] = useState('');
  const [successInfo, setSuccessInfo] = useState<{
    title: string;
    totalTarget: number;
    memberCount: number;
    deadlineText: string;
  } | null>(null);

  // Sync preset defaults whenever modal opens or active group changes
  useEffect(() => {
    if (!isOpen) return;
    const defaultCategory = preset.suggestedContributionCategories[0] || 'other';
    setCategory(defaultCategory);
    setCustomCategoryLabel('');
    setHasNoDeadline(false);
    const defaultMode: ContributionAllocationMode = isStoveBillingApplicable(
      currentGroup,
      defaultCategory
    )
      ? 'stove_rate'
      : preset.defaultAllocationMode === 'stove_rate'
        ? 'percentage'
        : preset.defaultAllocationMode;
    setAllocationMode(defaultMode);

    const defaultResponsible =
      currentGroup?.treasurerId ||
      currentGroup?.adminId ||
      responsibleCandidates[0]?.member.id ||
      currentUser?.id ||
      '';
    setResponsiblePersonId(defaultResponsible);

    const memberIds = activeMembers.map((m) => m.member.id);
    setPercentageInputs(buildStarterPercentages(memberIds));
    setError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, currentGroup?.id, preset]);

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

  useEffect(() => {
    if (!isOpen || activeMembers.length === 0) return;
    if (allocationMode === 'stove_rate') {
      if (stoveBillingApplicable) {
        applyStoveRateDistribution();
      } else {
        setAllocationMode('percentage');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, activeMembers.length, allocationMode, stoveBillingApplicable]);

  const handleCategoryChange = (nextCat: ExpenseCategory) => {
    setCategory(nextCat);
    if (nextCat !== 'other') {
      setCustomCategoryLabel('');
    }
    const nextStoveApplicable = isStoveBillingApplicable(currentGroup, nextCat);
    if (!nextStoveApplicable && allocationMode === 'stove_rate') {
      setAllocationMode('percentage');
      if (Object.keys(percentageInputs).length === 0) {
        setPercentageInputs(buildStarterPercentages(activeMembers.map((m) => m.member.id)));
      }
    } else if (nextStoveApplicable && allocationMode !== 'stove_rate') {
      setAllocationMode('stove_rate');
    }
  };

  const parsedTargetDisplay = parseMWKInput(totalTargetAmount, { allowZero: true });
  const targetInt = parsedTargetDisplay.valid ? parsedTargetDisplay.value : 0;

  const percentageEntries = useMemo(
    () =>
      activeMembers.map(({ member }) => {
        const raw = (percentageInputs[member.id] ?? '').trim();
        const parsed = raw === '' ? 0 : Number.parseFloat(raw);
        return {
          memberId: member.id,
          percentage: Number.isFinite(parsed) ? parsed : 0,
        };
      }),
    [activeMembers, percentageInputs]
  );

  const percentagePreview = useMemo(() => {
    if (allocationMode !== 'percentage' || targetInt <= 0) return null;
    return allocateByPercentage(targetInt, percentageEntries);
  }, [allocationMode, targetInt, percentageEntries]);

  const totalEnteredBasisPoints = useMemo(
    () => percentageEntries.reduce((sum, e) => sum + Math.round((e.percentage || 0) * 100), 0),
    [percentageEntries]
  );
  const totalEnteredPctDisplay = (totalEnteredBasisPoints / 100).toFixed(2).replace(/\.00$/, '');

  const customCalculatedSum = activeMembers.reduce((sum, { member }) => {
    const raw = customAmounts[member.id]?.amount;
    const parsed = parseMWKInput(raw, { allowZero: true });
    return sum + (parsed.valid ? parsed.value : 0);
  }, 0);

  const displayedAllocatedSum =
    allocationMode === 'percentage'
      ? percentagePreview?.valid
        ? percentagePreview.shares.reduce((s, item) => s + item.amount, 0)
        : 0
      : customCalculatedSum;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentGroup) return;
    setError('');

    if (docUploadStatus === 'uploading') {
      setError('Please wait for the supporting document upload to finish before submitting.');
      return;
    }

    if (!title.trim()) {
      setError('Please provide a contribution title.');
      return;
    }

    if (category === 'other' && !customCategoryLabel.trim()) {
      setError('Please enter a custom category label when selecting Other / Custom expense.');
      return;
    }

    if (!hasNoDeadline && !deadline.trim()) {
      setError('Please choose a due date or select "No fixed deadline".');
      return;
    }

    if (activeMembers.length === 0) {
      setError(
        'Please add or invite active members in Group & Members before assigning contributions.'
      );
      return;
    }

    if (allocationMode === 'stove_rate') {
      if (!stoveBillingApplicable) {
        setError('Stove rates apply only to Electricity requests in house or hostel groups.');
        return;
      }
      if (membersMissingStove.length > 0) {
        setError(
          `Classify stove type (Electric or Non-Electric) in Directory for: ${membersMissingStove
            .map((m) => m.member.name)
            .join(', ')}.`
        );
        return;
      }
    }

    const parsedTarget = parseMWKInput(totalTargetAmount);
    if (!parsedTarget.valid) {
      setError(parsedTarget.error || 'Please provide a valid whole MWK target amount.');
      return;
    }

    const assignmentsPayload: {
      memberId: string;
      amount: number;
      allocationPercentage?: number;
      notes?: string;
    }[] = [];

    if (allocationMode === 'percentage') {
      const pctResult = allocateByPercentage(parsedTarget.value, percentageEntries);
      if (!pctResult.valid) {
        setError(pctResult.error || 'Percentages must sum to 100%.');
        return;
      }
      pctResult.shares.forEach((share) => {
        assignmentsPayload.push({
          memberId: share.memberId,
          amount: share.amount,
          allocationPercentage: share.percentage,
          notes: `${share.percentage}% split`,
        });
      });
    } else if (allocationMode === 'custom') {
      const entries: Array<{ memberId: string; amount: number; notes?: string }> = [];
      for (const { member } of activeMembers) {
        const custom = customAmounts[member.id];
        const parsedMemberAmt = parseMWKInput(custom?.amount, { allowZero: true });
        if (!parsedMemberAmt.valid) {
          setError(
            `Invalid amount for ${member.name}: ${parsedMemberAmt.error || 'Enter a whole MWK integer.'}`
          );
          return;
        }
        entries.push({
          memberId: member.id,
          amount: parsedMemberAmt.value,
          notes: custom?.notes || 'Custom amount',
        });
      }
      const reconciliation = validateCustomAllocations(parsedTarget.value, entries);
      if (!reconciliation.valid) {
        setError(reconciliation.error || 'Custom amounts must match Total Target.');
        return;
      }
      if (entries.every((item) => item.amount === 0)) {
        setError('At least one member must have an amount greater than MK 0.');
        return;
      }
      entries
        .filter((item) => item.amount > 0)
        .forEach((item) => assignmentsPayload.push(item));
    } else {
      // Stove rate mode
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
          notes: custom?.notes,
        });
      }
    }

    const effectiveDeadline = hasNoDeadline ? '' : `${deadline}T23:59:59Z`;

    const result = createContribution(
      {
        groupId: currentGroup.id,
        title: title.trim(),
        category,
        customCategoryLabel: category === 'other' ? customCategoryLabel.trim() : undefined,
        month,
        year,
        totalTargetAmount: parsedTarget.value,
        deadline: effectiveDeadline,
        hasNoDeadline,
        responsiblePersonId: responsiblePersonId || undefined,
        description: description.trim() || undefined,
        supportingDocumentUrl: supportingDoc?.url,
        supportingDocumentName: supportingDoc?.fileName,
        supportingDocumentType: supportingDoc?.fileType,
        supportingDocumentSize: supportingDoc?.fileSize,
        supportingStoragePath: supportingDoc?.storagePath,
        status: 'active',
        allocationMode,
      },
      assignmentsPayload
    );

    if (!result.success) {
      setError(result.error || 'Failed to create contribution.');
      return;
    }

    const deadlineText = formatDeadlineLabel(effectiveDeadline, hasNoDeadline);
    showToast('Contribution Assigned', {
      message: `${title.trim()} (${formatMWK(parsedTarget.value)}) assigned to ${assignmentsPayload.length} member(s).`,
    });
    setSuccessInfo({
      title: title.trim(),
      totalTarget: parsedTarget.value,
      memberCount: assignmentsPayload.length,
      deadlineText,
    });
  };

  const resetAndClose = () => {
    setError('');
    setSuccessInfo(null);
    setTitle('');
    setCustomCategoryLabel('');
    setTotalTargetAmount('');
    setCustomAmounts({});
    setPercentageInputs({});
    setDescription('');
    setSupportingDoc(null);
    setDocUploadStatus('idle');
    setHasNoDeadline(false);
    onClose();
  };

  const sortedCategories = useMemo(() => {
    const suggested = preset.suggestedContributionCategories.filter((c) =>
      ORDERED_CONTRIBUTION_CATEGORIES.includes(c)
    );
    const suggestedSet = new Set(suggested);
    return [
      ...suggested,
      ...ORDERED_CONTRIBUTION_CATEGORIES.filter((c) => !suggestedSet.has(c)),
    ];
  }, [preset]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={resetAndClose}
      title="Set Member Contributions"
      subtitle={currentGroup ? `Create a bill or contribution for ${currentGroup.name}` : 'No group active'}
      maxWidthClass="max-w-xl"
    >
      {!currentGroup ? (
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
      ) : successInfo ? (
        <div className="text-center py-6 space-y-3">
          <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h4 className="font-bold text-slate-900 dark:text-white text-xl">
            Contribution Assigned
          </h4>
          <p className="text-xs text-slate-600 dark:text-slate-400 max-w-sm mx-auto tabular-nums">
            <strong className="text-slate-900 dark:text-white">{successInfo.title}</strong> — Target of{' '}
            <strong className="text-slate-900 dark:text-white">
              {formatMWK(successInfo.totalTarget)}
            </strong>{' '}
            assigned across {successInfo.memberCount} member(s) · Due: {successInfo.deadlineText}.
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={resetAndClose}
              className="min-h-[44px] bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white font-semibold px-6 py-2.5 rounded-xl text-xs transition-colors cursor-pointer"
            >
              Return to Overview
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
              placeholder={
                stoveBillingApplicable
                  ? 'e.g. May ESCOM Electricity, Lilongwe Water Bill'
                  : `e.g. ${preset.label} — Monthly Need or Bill`
              }
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full min-h-[44px] bg-white dark:bg-[#11192C] border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:outline-none"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                Bill / Need Category *
              </label>
              <select
                value={category}
                onChange={(e) => handleCategoryChange(e.target.value as ExpenseCategory)}
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
                Total Target (MWK) *
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="e.g. 50000"
                value={totalTargetAmount}
                onChange={(e) => setTotalTargetAmount(e.target.value.replace(/[^\d]/g, ''))}
                readOnly={allocationMode === 'stove_rate' && stoveBillingApplicable}
                className={`w-full min-h-[44px] border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold font-mono text-slate-900 dark:text-white tabular-nums focus:outline-none ${
                  allocationMode === 'stove_rate' && stoveBillingApplicable
                    ? 'bg-slate-50 dark:bg-[#131D33]'
                    : 'bg-white dark:bg-[#11192C]'
                }`}
                required
              />
            </div>
          </div>

          {category === 'other' && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                Custom Category Name *
              </label>
              <input
                type="text"
                placeholder="e.g. Borehole Repair, Generator Fuel, Choir Uniforms"
                value={customCategoryLabel}
                onChange={(e) => setCustomCategoryLabel(e.target.value)}
                className="w-full min-h-[44px] bg-white dark:bg-[#11192C] border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white focus:outline-none"
                required
              />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Due Date {!hasNoDeadline && '*'}
                </label>
                <label className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasNoDeadline}
                    onChange={(e) => setHasNoDeadline(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600"
                  />
                  <span>No fixed deadline</span>
                </label>
              </div>
              <input
                type="date"
                value={hasNoDeadline ? '' : deadline}
                disabled={hasNoDeadline}
                onChange={(e) => setDeadline(e.target.value)}
                className={`w-full min-h-[44px] border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none ${
                  hasNoDeadline
                    ? 'bg-slate-100 dark:bg-[#131D33] opacity-60 cursor-not-allowed'
                    : 'bg-white dark:bg-[#11192C]'
                }`}
                required={!hasNoDeadline}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                Responsible Collector / Coordinator
              </label>
              <select
                value={responsiblePersonId}
                onChange={(e) => setResponsiblePersonId(e.target.value)}
                className="w-full min-h-[44px] bg-white dark:bg-[#11192C] border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none"
              >
                {responsibleCandidates.length === 0 ? (
                  <option value={currentUser?.id || ''}>
                    {currentUser?.name || 'Group Administrator'}
                  </option>
                ) : (
                  responsibleCandidates.map(({ member }) => (
                    <option key={member.id} value={member.id}>
                      {member.name} ({member.roleInGroup})
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          {activeMembers.length > 0 ? (
            <div className="pt-1 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  How to Split Contributions
                </span>
                <div className="inline-flex p-1 bg-slate-100 dark:bg-[#11192C] rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
                  {stoveBillingApplicable && (
                    <button
                      type="button"
                      onClick={() => {
                        setAllocationMode('stove_rate');
                        applyStoveRateDistribution();
                      }}
                      className={`min-h-[36px] px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer whitespace-nowrap ${
                        allocationMode === 'stove_rate'
                          ? 'bg-white dark:bg-blue-600 shadow-xs text-slate-900 dark:text-white font-bold'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      Stove Rate
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setAllocationMode('percentage');
                      if (Object.keys(percentageInputs).length === 0) {
                        setPercentageInputs(
                          buildStarterPercentages(activeMembers.map((m) => m.member.id))
                        );
                      }
                    }}
                    className={`min-h-[36px] px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer whitespace-nowrap ${
                      allocationMode === 'percentage'
                        ? 'bg-white dark:bg-blue-600 shadow-xs text-slate-900 dark:text-white font-bold'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Percentage Split (%)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAllocationMode('custom')}
                    className={`min-h-[36px] px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer whitespace-nowrap ${
                      allocationMode === 'custom'
                        ? 'bg-white dark:bg-blue-600 shadow-xs text-slate-900 dark:text-white font-bold'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Custom Amounts
                  </button>
                </div>
              </div>

              {allocationMode === 'stove_rate' &&
                stoveBillingApplicable &&
                membersMissingStove.length > 0 && (
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block">
                        Stove classification required for Electricity Stove Rate:
                      </span>
                      <span>
                        {membersMissingStove.map((m) => m.member.name).join(', ')} — classify in
                        Group Directory first, or choose Percentage Split (%) / Custom Amounts.
                      </span>
                    </div>
                  </div>
                )}

              {/* Member List Inputs */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
                <div className="bg-slate-50 dark:bg-[#11192C] px-3.5 py-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex justify-between">
                  <span>
                    {stoveBillingApplicable
                      ? 'Active Member & Stove Tier'
                      : `Active Member (${preset.unitLabel})`}
                  </span>
                  <span>
                    {allocationMode === 'percentage' ? '% Share & MWK' : 'Assigned MWK'}
                  </span>
                </div>
                {activeMembers.map(({ member, info }) => {
                  const pctShare = percentagePreview?.shares.find((s) => s.memberId === member.id);

                  return (
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
                            <span>{info?.roomNumber || preset.shortLabel}</span>
                            {stoveBillingApplicable && (
                              <>
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
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {allocationMode === 'percentage' ? (
                        <div className="flex items-center gap-2 shrink-0 tabular-nums">
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              max="100"
                              aria-label={`Percentage for ${member.name}`}
                              value={percentageInputs[member.id] ?? ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                setPercentageInputs((prev) => ({
                                  ...prev,
                                  [member.id]: val,
                                }));
                              }}
                              className="w-20 min-h-[38px] bg-white dark:bg-[#11192C] border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-bold font-mono text-slate-900 dark:text-white text-right focus:outline-none"
                            />
                            <span className="text-slate-400 font-semibold">%</span>
                          </div>
                          <span className="w-24 text-right font-mono font-bold text-slate-800 dark:text-slate-200">
                            {targetInt > 0 && pctShare ? formatMWK(pctShare.amount) : 'MK 0'}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-slate-400 font-medium">MK</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            aria-label={`MWK amount for ${member.name}`}
                            readOnly={allocationMode === 'stove_rate' && stoveBillingApplicable}
                            value={customAmounts[member.id]?.amount || ''}
                            onChange={(e) => {
                              const digits = e.target.value.replace(/[^\d]/g, '');
                              setAllocationMode('custom');
                              setCustomAmounts((prev) => ({
                                ...prev,
                                [member.id]: {
                                  amount: digits,
                                  notes: 'Custom amount',
                                },
                              }));
                            }}
                            className={`w-24 min-h-[38px] border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs font-bold font-mono text-slate-900 dark:text-white text-right tabular-nums focus:outline-none ${
                              allocationMode === 'stove_rate' && stoveBillingApplicable
                                ? 'bg-slate-50 dark:bg-[#131D33]'
                                : 'bg-white dark:bg-[#11192C]'
                            }`}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-xs px-1 tabular-nums">
                {allocationMode === 'percentage' ? (
                  <>
                    <span className="text-slate-500 dark:text-slate-400">
                      Total Percentage:{' '}
                      <strong
                        className={`font-mono ${
                          totalEnteredBasisPoints === 10000
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-amber-700 dark:text-amber-400'
                        }`}
                      >
                        {totalEnteredPctDisplay}% / 100%
                      </strong>
                    </span>
                    <span className="font-bold font-mono text-slate-800 dark:text-slate-200">
                      {formatMWK(displayedAllocatedSum)} / {formatMWK(targetInt)}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-slate-500 dark:text-slate-400">Allocated Sum:</span>
                    <span
                      className={`font-bold font-mono ${
                        displayedAllocatedSum === targetInt && targetInt > 0
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-amber-700 dark:text-amber-400'
                      }`}
                    >
                      {formatMWK(displayedAllocatedSum)} / {formatMWK(targetInt)}
                    </span>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="p-4 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-800 dark:text-amber-200">
              This group currently has 0 active members. Go to{' '}
              <strong>Group &amp; Members</strong> to add or invite members first.
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
              Description / Note to Members (Optional)
            </label>
            <textarea
              rows={2}
              placeholder={preset.defaultRulesPlaceholder}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-white dark:bg-[#11192C] border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
            />
          </div>

          <FileUploadField
            label="Supporting Bill / Invoice / Notice (Optional)"
            helperText="Attach an ESCOM bill, water invoice, quotation, or notice (image or PDF, max 5 MB)."
            folder="supportingDocs"
            groupId={currentGroup.id}
            recordIdPrefix="contrib"
            scopeMeta={{
              uploaderUid: currentUser?.id,
              adminId: currentGroup.adminId,
              treasurerId: currentGroup.treasurerId,
            }}
            allowPdf
            allowCamera
            value={supportingDoc}
            onChange={setSupportingDoc}
            onStatusChange={setDocUploadStatus}
          />

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
              disabled={activeMembers.length === 0 || docUploadStatus === 'uploading'}
              className="min-h-[44px] bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 disabled:opacity-50 text-white px-5 py-2.5 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>
                {docUploadStatus === 'uploading' ? 'Uploading Attachment...' : 'Assign Contributions'}
              </span>
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
};

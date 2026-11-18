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
import {
  Plus,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  FileText,
  Edit3,
} from 'lucide-react';

interface CreateContributionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const STEP_LABELS = [
  'Purpose & Schedule',
  'Allocation Method',
  'Total Target (MWK)',
  'Member Allocation',
  'Supporting Document',
  'Review & Publish',
] as const;

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

  const [step, setStep] = useState<number>(1);
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successInfo, setSuccessInfo] = useState<{
    title: string;
    totalTarget: number;
    memberCount: number;
    deadlineText: string;
  } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setStep(1);
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
    setIsSubmitting(false);
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

  const remainingMWK = targetInt - displayedAllocatedSum;

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

  const buildAssignmentsPayload = (): {
    valid: boolean;
    error?: string;
    totalTarget?: number;
    payload?: {
      memberId: string;
      amount: number;
      allocationPercentage?: number;
      notes?: string;
    }[];
  } => {
    const parsedTarget = parseMWKInput(totalTargetAmount);
    if (!parsedTarget.valid) {
      return { valid: false, error: parsedTarget.error || 'Enter a valid whole MWK target amount.' };
    }

    const payload: {
      memberId: string;
      amount: number;
      allocationPercentage?: number;
      notes?: string;
    }[] = [];

    if (allocationMode === 'percentage') {
      const pctResult = allocateByPercentage(parsedTarget.value, percentageEntries);
      if (!pctResult.valid) {
        return { valid: false, error: pctResult.error || 'Percentages must sum to exactly 100%.' };
      }
      pctResult.shares.forEach((share) => {
        payload.push({
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
          return {
            valid: false,
            error: `Invalid amount for ${member.name}: ${parsedMemberAmt.error || 'Enter a whole MWK integer.'}`,
          };
        }
        entries.push({
          memberId: member.id,
          amount: parsedMemberAmt.value,
          notes: custom?.notes || 'Custom amount',
        });
      }
      const reconciliation = validateCustomAllocations(parsedTarget.value, entries);
      if (!reconciliation.valid) {
        return {
          valid: false,
          error: reconciliation.error || 'Custom member amounts must match Total Target.',
        };
      }
      if (entries.every((item) => item.amount === 0)) {
        return { valid: false, error: 'At least one member must be assigned more than MK 0.' };
      }
      entries.filter((item) => item.amount > 0).forEach((item) => payload.push(item));
    } else {
      if (!stoveBillingApplicable) {
        return { valid: false, error: 'Stove rates apply only to Electricity requests in house or hostel groups.' };
      }
      if (membersMissingStove.length > 0) {
        return {
          valid: false,
          error: `Set stove types in Directory → Electricity Stove Settings first for: ${membersMissingStove
            .map((m) => m.member.name)
            .join(', ')}.`,
        };
      }
      for (const { member } of activeMembers) {
        const custom = customAmounts[member.id];
        const parsedMemberAmt = parseMWKInput(custom?.amount);
        if (!parsedMemberAmt.valid) {
          return {
            valid: false,
            error: `Invalid stove-rate amount for ${member.name}: ${parsedMemberAmt.error || 'Enter a whole MWK integer.'}`,
          };
        }
        payload.push({
          memberId: member.id,
          amount: parsedMemberAmt.value,
          notes: custom?.notes,
        });
      }
    }

    return { valid: true, totalTarget: parsedTarget.value, payload };
  };

  const handleNextStep = () => {
    setError('');
    if (step === 1) {
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
        setError('Add or invite at least one active member in Group & Members first.');
        return;
      }
      setStep(2);
      return;
    }

    if (step === 2) {
      if (allocationMode === 'stove_rate' && !stoveBillingApplicable) {
        setError('Electricity Stove Tier only applies to Electricity bills in house or hostel groups.');
        return;
      }
      if (allocationMode === 'percentage' && Object.keys(percentageInputs).length === 0) {
        setPercentageInputs(buildStarterPercentages(activeMembers.map((m) => m.member.id)));
      }
      if (allocationMode === 'stove_rate' && stoveBillingApplicable) {
        applyStoveRateDistribution();
      }
      setStep(3);
      return;
    }

    if (step === 3) {
      const parsedTarget = parseMWKInput(totalTargetAmount);
      if (!parsedTarget.valid) {
        setError(parsedTarget.error || 'Please enter a valid whole MWK target amount.');
        return;
      }
      setStep(4);
      return;
    }

    if (step === 4) {
      const check = buildAssignmentsPayload();
      if (!check.valid) {
        setError(check.error || 'Please balance member allocations before continuing.');
        return;
      }
      setStep(5);
      return;
    }

    if (step === 5) {
      if (docUploadStatus === 'uploading') {
        setError('Please wait for the supporting document upload to finish.');
        return;
      }
      if (!supportingDoc?.url || docUploadStatus !== 'uploaded') {
        setError('Please upload a supporting bill, invoice, or notice before publishing.');
        return;
      }
      setStep(6);
    }
  };

  const handlePublish = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentGroup || isSubmitting) return;
    setError('');

    if (docUploadStatus === 'uploading') {
      setError('Please wait for the supporting document upload to finish.');
      return;
    }
    if (!supportingDoc?.url || docUploadStatus !== 'uploaded') {
      setError('A supporting bill, invoice, or notice is required.');
      return;
    }

    const check = buildAssignmentsPayload();
    if (!check.valid || !check.payload || !check.totalTarget) {
      setError(check.error || 'Allocation check failed.');
      return;
    }

    setIsSubmitting(true);
    const effectiveDeadline = hasNoDeadline ? '' : `${deadline}T23:59:59Z`;

    const result = createContribution(
      {
        groupId: currentGroup.id,
        title: title.trim(),
        category,
        customCategoryLabel: category === 'other' ? customCategoryLabel.trim() : undefined,
        month,
        year,
        totalTargetAmount: check.totalTarget,
        deadline: effectiveDeadline,
        hasNoDeadline,
        responsiblePersonId: responsiblePersonId || undefined,
        description: description.trim() || undefined,
        supportingDocumentUrl: supportingDoc.url,
        supportingDocumentName: supportingDoc.fileName,
        supportingDocumentType: supportingDoc.fileType,
        supportingDocumentSize: supportingDoc.fileSize,
        supportingStoragePath: supportingDoc.storagePath,
        status: 'active',
        allocationMode,
      },
      check.payload
    );

    setIsSubmitting(false);
    if (!result.success) {
      setError(result.error || 'Failed to create contribution.');
      return;
    }

    const deadlineText = formatDeadlineLabel(effectiveDeadline, hasNoDeadline);
    showToast('Contribution Assigned', {
      message: `${title.trim()} (${formatMWK(check.totalTarget)}) assigned to ${check.payload.length} member(s).`,
    });
    setSuccessInfo({
      title: title.trim(),
      totalTarget: check.totalTarget,
      memberCount: check.payload.length,
      deadlineText,
    });
  };

  const resetAndClose = () => {
    setStep(1);
    setError('');
    setIsSubmitting(false);
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

  const reviewCheck = step === 6 ? buildAssignmentsPayload() : null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={resetAndClose}
      title="Create Contribution Request"
      subtitle={
        currentGroup
          ? `${currentGroup.name} · Step ${step} of ${STEP_LABELS.length}: ${STEP_LABELS[step - 1]}`
          : 'No group active'
      }
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
            Contribution Published
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
        <form onSubmit={handlePublish} className="space-y-4 text-xs">
          {/* Step Progress Bar */}
          <div className="space-y-1.5" aria-label={`Step ${step} of ${STEP_LABELS.length}`}>
            <div className="grid grid-cols-6 gap-1.5">
              {STEP_LABELS.map((label, idx) => {
                const num = idx + 1;
                const isDone = num < step;
                const isCurrent = num === step;
                return (
                  <div
                    key={label}
                    title={`${num}. ${label}`}
                    className={`h-1.5 rounded-full transition-colors ${
                      isCurrent
                        ? 'bg-slate-900 dark:bg-blue-500'
                        : isDone
                          ? 'bg-emerald-500'
                          : 'bg-slate-200 dark:bg-slate-800'
                    }`}
                  />
                );
              })}
            </div>
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              <span>
                Step {step} of {STEP_LABELS.length}
              </span>
              <span className="text-slate-800 dark:text-slate-200">{STEP_LABELS[step - 1]}</span>
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs rounded-xl flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* STEP 1: Purpose & Schedule */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
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
                  <label className="block font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                    Category *
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
                  <label className="block font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                    Responsible Collector
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

              {category === 'other' && (
                <div>
                  <label className="block font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
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

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
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
                />
              </div>

              <div>
                <label className="block font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                  Optional Notes to Members
                </label>
                <textarea
                  rows={2}
                  placeholder={preset.defaultRulesPlaceholder}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-white dark:bg-[#11192C] border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
                />
              </div>

              {activeMembers.length === 0 && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-800 dark:text-amber-200">
                  This group currently has 0 active members. Add or invite members in{' '}
                  <strong>Group &amp; Members</strong> before continuing.
                </div>
              )}
            </div>
          )}

          {/* STEP 2: Allocation Method */}
          {step === 2 && (
            <div className="space-y-3" role="radiogroup" aria-label="Allocation Method">
              <p className="text-slate-600 dark:text-slate-300">
                Choose how <strong className="text-slate-900 dark:text-white">{title}</strong> should be divided across the {activeMembers.length} active member(s).
              </p>

              <button
                type="button"
                role="radio"
                aria-checked={allocationMode === 'percentage'}
                onClick={() => setAllocationMode('percentage')}
                className={`w-full p-4 rounded-2xl border text-left transition-colors cursor-pointer ${
                  allocationMode === 'percentage'
                    ? 'border-slate-900 dark:border-blue-500 bg-slate-900 dark:bg-blue-600 text-white shadow-xs'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11192C] text-slate-900 dark:text-white hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="font-bold text-sm">Percentage Split (%)</div>
                <p className="text-[11px] opacity-85 mt-1">
                  Assign a percentage share to each member (must sum to 100%). Calculated cleanly in whole Malawi Kwacha.
                </p>
              </button>

              <button
                type="button"
                role="radio"
                aria-checked={allocationMode === 'custom'}
                onClick={() => setAllocationMode('custom')}
                className={`w-full p-4 rounded-2xl border text-left transition-colors cursor-pointer ${
                  allocationMode === 'custom'
                    ? 'border-slate-900 dark:border-blue-500 bg-slate-900 dark:bg-blue-600 text-white shadow-xs'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11192C] text-slate-900 dark:text-white hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="font-bold text-sm">Custom Amounts (MWK)</div>
                <p className="text-[11px] opacity-85 mt-1">
                  Set an exact whole-MWK contribution amount per member matching your Total Target.
                </p>
              </button>

              {stoveBillingApplicable && (
                <button
                  type="button"
                  role="radio"
                  aria-checked={allocationMode === 'stove_rate'}
                  onClick={() => setAllocationMode('stove_rate')}
                  className={`w-full p-4 rounded-2xl border text-left transition-colors cursor-pointer ${
                    allocationMode === 'stove_rate'
                      ? 'border-slate-900 dark:border-blue-500 bg-slate-900 dark:bg-blue-600 text-white shadow-xs'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11192C] text-slate-900 dark:text-white hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="font-bold text-sm">Electricity Stove Tier</div>
                  <p className="text-[11px] opacity-85 mt-1">
                    Uses member stove classifications from Electricity Stove Settings (MK 10,000 Electric · MK 5,000 Non-Electric).
                  </p>
                </button>
              )}
            </div>
          )}

          {/* STEP 3: Total Target (MWK) */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <label className="block font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                  Total Target (MWK) *
                </label>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-500 dark:text-slate-400">MWK</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="e.g. 50000"
                    value={totalTargetAmount}
                    onChange={(e) => setTotalTargetAmount(e.target.value.replace(/[^\d]/g, ''))}
                    readOnly={allocationMode === 'stove_rate' && stoveBillingApplicable}
                    className={`w-full min-h-[48px] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-base font-bold font-mono text-slate-900 dark:text-white tabular-nums focus:outline-none ${
                      allocationMode === 'stove_rate' && stoveBillingApplicable
                        ? 'bg-slate-50 dark:bg-[#131D33]'
                        : 'bg-white dark:bg-[#11192C]'
                    }`}
                    required
                  />
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">
                  {allocationMode === 'stove_rate' && stoveBillingApplicable
                    ? 'Total Target is automatically calculated from active members’ Electricity Stove Settings.'
                    : 'Whole Malawi Kwacha integers only (no decimal places).'}
                </p>
              </div>

              {allocationMode === 'stove_rate' &&
                stoveBillingApplicable &&
                membersMissingStove.length > 0 && (
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block">
                        Stove tier missing for {membersMissingStove.length} member(s):
                      </span>
                      <span>
                        {membersMissingStove.map((m) => m.member.name).join(', ')}. Configure them in Group &amp; Members → Electricity Stove Settings, or go Back to choose Percentage Split / Custom Amounts.
                      </span>
                    </div>
                  </div>
                )}
            </div>
          )}

          {/* STEP 4: Member Allocation */}
          {step === 4 && (
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#11192C] border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 tabular-nums">
                <div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                    Total Target
                  </span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {formatMWK(targetInt)}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                    Allocated
                  </span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {formatMWK(displayedAllocatedSum)}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                    Remaining
                  </span>
                  <span
                    className={`font-bold ${
                      remainingMWK === 0 && targetInt > 0
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-amber-700 dark:text-amber-400'
                    }`}
                  >
                    {formatMWK(Math.abs(remainingMWK))}
                    {remainingMWK < 0 ? ' over' : ''}
                  </span>
                </div>
                <div>
                  {allocationMode === 'percentage' ? (
                    <span
                      className={`inline-flex px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                        totalEnteredBasisPoints === 10000
                          ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                          : 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                      }`}
                    >
                      {totalEnteredPctDisplay}% / 100%
                    </span>
                  ) : (
                    <span
                      className={`inline-flex px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                        displayedAllocatedSum === targetInt && targetInt > 0
                          ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                          : 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                      }`}
                    >
                      {displayedAllocatedSum === targetInt && targetInt > 0 ? 'Balanced' : 'Mismatch'}
                    </span>
                  )}
                </div>
              </div>

              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 max-h-72 overflow-y-auto">
                <div className="bg-slate-50 dark:bg-[#11192C] px-3.5 py-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex justify-between">
                  <span>Active Member ({preset.unitLabel})</span>
                  <span>{allocationMode === 'percentage' ? '% Split & MWK' : 'Assigned MWK'}</span>
                </div>

                {activeMembers.map(({ member, info }) => {
                  const pctShare = percentagePreview?.shares.find((s) => s.memberId === member.id);

                  return (
                    <div
                      key={member.id}
                      className="p-3 flex items-center justify-between gap-3 bg-white dark:bg-[#0D1424]"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-[#131D33] text-slate-800 dark:text-slate-200 flex items-center justify-center font-bold shrink-0">
                          {member.name.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900 dark:text-white truncate">
                            {member.name}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            {info?.roomNumber || preset.shortLabel}
                            {allocationMode === 'stove_rate' && stoveBillingApplicable && (
                              <>
                                {' · '}
                                {isValidStoveType(member.stoveType)
                                  ? STOVE_TYPE_LABELS[member.stoveType]
                                  : 'Stove Tier Unset'}
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
            </div>
          )}

          {/* STEP 5: Supporting Document (REQUIRED) */}
          {step === 5 && (
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#11192C] border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300">
                Attach the official bill, supplier quotation, utility token statement, or group notice for full member transparency.
              </div>
              <FileUploadField
                label="Supporting Bill / Invoice / Notice * (Required)"
                helperText="PDF or image (JPG/PNG/WebP), max 5 MB. Required before publishing."
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
            </div>
          )}

          {/* STEP 6: Review & Publish */}
          {step === 6 && (
            <div className="space-y-3">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#11192C] border border-slate-200 dark:border-slate-800 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-bold text-sm text-slate-900 dark:text-white">{title}</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      {getExpenseCategoryLabel(category, customCategoryLabel)} · Due:{' '}
                      {formatDeadlineLabel(hasNoDeadline ? '' : `${deadline}T23:59:59Z`, hasNoDeadline)}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-cyan-400 hover:underline cursor-pointer"
                  >
                    <Edit3 className="w-3 h-3" />
                    Edit
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200 dark:border-slate-800 tabular-nums">
                  <div>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                      Total Target
                    </span>
                    <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                      {formatMWK(reviewCheck?.totalTarget || targetInt)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                      Allocation Method
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {allocationMode === 'percentage'
                        ? 'Percentage Split (%)'
                        : allocationMode === 'stove_rate'
                          ? 'Electricity Stove Tier'
                          : 'Custom Amounts'}
                    </span>
                  </div>
                </div>

                {supportingDoc && (
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
                    <div className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-300 truncate">
                      <FileText className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400 shrink-0" />
                      <span className="truncate font-medium">{supportingDoc.fileName}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setStep(5)}
                      className="text-[11px] font-semibold text-blue-600 dark:text-cyan-400 hover:underline cursor-pointer shrink-0"
                    >
                      Change file
                    </button>
                  </div>
                )}
              </div>

              {reviewCheck?.payload && (
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 max-h-48 overflow-y-auto tabular-nums">
                  <div className="bg-slate-50 dark:bg-[#11192C] px-3.5 py-2 flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    <span>Member Breakdown ({reviewCheck.payload.length})</span>
                    <button
                      type="button"
                      onClick={() => setStep(4)}
                      className="normal-case font-semibold text-blue-600 dark:text-cyan-400 hover:underline cursor-pointer"
                    >
                      Adjust shares
                    </button>
                  </div>
                  {reviewCheck.payload.map((item) => {
                    const info = resolveMemberInfo(item.memberId, groupMembers, users);
                    return (
                      <div
                        key={item.memberId}
                        className="px-3.5 py-2 flex items-center justify-between bg-white dark:bg-[#0D1424]"
                      >
                        <span className="font-semibold text-slate-900 dark:text-white truncate">
                          {info?.name || item.memberId}
                        </span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white">
                          {formatMWK(item.amount)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Wizard Navigation Footer */}
          <div className="pt-2 flex items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => {
                setError('');
                if (step === 1) {
                  resetAndClose();
                } else {
                  setStep((s) => Math.max(1, s - 1));
                }
              }}
              className="min-h-[44px] inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#131D33] rounded-xl transition-colors cursor-pointer"
            >
              {step === 1 ? (
                <span>Cancel</span>
              ) : (
                <>
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </>
              )}
            </button>

            {step < STEP_LABELS.length ? (
              <button
                type="button"
                onClick={handleNextStep}
                disabled={step === 1 && activeMembers.length === 0}
                className="min-h-[44px] inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 disabled:opacity-50 text-white px-5 py-2.5 text-xs font-bold rounded-xl transition-colors cursor-pointer shadow-xs whitespace-nowrap"
              >
                <span>Next</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={isSubmitting || docUploadStatus === 'uploading'}
                className="min-h-[44px] bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 disabled:opacity-50 text-white px-5 py-2.5 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                <span>{isSubmitting ? 'Publishing...' : 'Publish Contribution'}</span>
              </button>
            )}
          </div>
        </form>
      )}
    </Modal>
  );
};

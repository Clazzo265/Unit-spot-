import {
  Contribution,
  ContributionAssignment,
  Expense,
  Group,
  GroupMember,
  IntegrityFinding,
  IntegrityReport,
  Payment,
  PaymentCommitment,
  PaymentMethod,
  StoveType,
} from '../types';
import { supportsAccommodationRates } from './groupPresets';

/**
 * SINGLE AUTHORITATIVE RATE CONFIGURATION
 * All contribution rate rules must read from this object.
 */
export const RATES = {
  electric: 10000,
  non_electric: 5000,
} as const;

export const RATE_CONFIG_VERSION = '2026.1';

export const STOVE_TYPE_LABELS: Record<StoveType, string> = {
  electric: 'Electric Stove',
  non_electric: 'Non-Electric Stove',
};

export function isValidStoveType(value: unknown): value is StoveType {
  return value === 'electric' || value === 'non_electric';
}

export function getRateForStoveType(stoveType: StoveType): number {
  return RATES[stoveType];
}

/**
 * Strict integer-only MWK input parser.
 * Rejects decimals, letters, NaN, Infinity, negative numbers, and zero unless allowZero is true.
 */
export function parseMWKInput(
  raw: string | number | null | undefined,
  options: { allowZero?: boolean; maxAmount?: number } = {}
): { valid: boolean; value: number; error?: string } {
  const { allowZero = false, maxAmount = 1_000_000_000 } = options;

  if (raw === null || raw === undefined) {
    return { valid: false, value: 0, error: 'Amount is required.' };
  }

  let cleaned: string;
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) {
      return { valid: false, value: 0, error: 'Amount must be a finite number.' };
    }
    if (!Number.isInteger(raw)) {
      return { valid: false, value: 0, error: 'Amount must be a whole Malawi Kwacha (MWK) integer.' };
    }
    cleaned = String(raw);
  } else {
    // Strip optional MK/MWK prefix, commas, and whitespace
    cleaned = raw.trim().replace(/^(MWK|MK)\s*/i, '').replace(/[\s,]/g, '');
    if (!cleaned) {
      return { valid: false, value: 0, error: 'Please enter a payment amount in MWK.' };
    }
    if (!/^\d+$/.test(cleaned)) {
      return {
        valid: false,
        value: 0,
        error: 'Enter whole digits only (no decimals, letters, or negative signs).',
      };
    }
  }

  const parsed = Number.parseInt(cleaned, 10);
  if (!Number.isSafeInteger(parsed)) {
    return { valid: false, value: 0, error: 'Amount exceeds safe integer limits.' };
  }
  if (!allowZero && parsed <= 0) {
    return { valid: false, value: 0, error: 'Amount must be greater than MK 0.' };
  }
  if (allowZero && parsed < 0) {
    return { valid: false, value: 0, error: 'Amount cannot be negative.' };
  }
  if (parsed > maxAmount) {
    return {
      valid: false,
      value: 0,
      error: `Amount exceeds maximum single entry limit of MK ${maxAmount.toLocaleString('en-US')}.`,
    };
  }

  return { valid: true, value: parsed };
}

/**
 * Coerce any persisted monetary value safely into a whole integer MWK amount without string concatenation.
 */
export function toSafeIntMWK(value: unknown): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
  }
  if (typeof value === 'string') {
    const parsed = parseMWKInput(value, { allowZero: true });
    return parsed.valid ? parsed.value : 0;
  }
  return 0;
}

/**
 * Channel-aware transaction reference validation
 */
export function validateTransactionReference(
  method: PaymentMethod,
  reference: string | undefined,
  hasReceiptImage: boolean
): { valid: boolean; error?: string; normalized?: string } {
  const trimmed = (reference || '').trim();

  if (method === 'cash') {
    if (trimmed && trimmed.length < 2) {
      return { valid: false, error: 'Cash receipt / slip number must be at least 2 characters.' };
    }
    return { valid: true, normalized: trimmed };
  }

  if (method === 'airtel_money' || method === 'tnm_mpamba') {
    if (!trimmed && !hasReceiptImage) {
      return {
        valid: false,
        error: 'Mobile money payments require an SMS transaction reference or receipt photo.',
      };
    }
    if (trimmed) {
      if (trimmed.length < 4 || trimmed.length > 64 || !/^[A-Za-z0-9\-_.\/]+$/.test(trimmed)) {
        return {
          valid: false,
          error: 'Mobile money reference must be 4–64 alphanumeric characters (no spaces).',
        };
      }
    }
    return { valid: true, normalized: trimmed };
  }

  if (method === 'bank_transfer') {
    if (!trimmed && !hasReceiptImage) {
      return {
        valid: false,
        error: 'Bank transfers require a bank reference number or receipt photo.',
      };
    }
    if (trimmed && (trimmed.length < 4 || trimmed.length > 64 || !/^[A-Za-z0-9\-_.\/ ]+$/.test(trimmed))) {
      return {
        valid: false,
        error: 'Bank reference must be 4–64 valid characters.',
      };
    }
    return { valid: true, normalized: trimmed };
  }

  if (!trimmed && !hasReceiptImage) {
    return {
      valid: false,
      error: 'Please provide a transaction reference or attach a receipt photo.',
    };
  }
  return { valid: true, normalized: trimmed };
}

export function generateIdempotencyKey(): string {
  return `idem_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Resolve a member cleanly across groupMembers directory and optional admin users fallback
 */
export function resolveMemberInfo(
  memberId: string | undefined,
  groupMembers: GroupMember[],
  users: Array<{ id: string; name: string; email?: string; phone?: string; avatarUrl?: string; roomNumber?: string }> = []
): {
  id: string;
  name: string;
  email: string;
  phone: string;
  roomNumber?: string;
  avatarUrl?: string;
  stoveType?: StoveType;
  stoveTypeReviewRequired?: boolean;
  memberRefId?: string;
  status?: string;
} | null {
  if (!memberId) return null;
  const gm = groupMembers.find((m) => m.id === memberId || m.userId === memberId);
  const usr = users.find((u) => u.id === memberId || (gm && u.id === gm.userId));

  if (!gm && !usr) return null;

  return {
    id: gm?.id || usr!.id,
    name: gm?.name || usr?.name || 'Member',
    email: gm?.email || usr?.email || '',
    phone: gm?.phone || usr?.phone || '',
    roomNumber: gm?.roomNumber || usr?.roomNumber,
    avatarUrl: usr?.avatarUrl,
    stoveType: gm?.stoveType,
    stoveTypeReviewRequired: gm?.stoveTypeReviewRequired,
    memberRefId: gm?.memberRefId,
    status: gm?.status,
  };
}

export function isAccommodationGroup(group?: Pick<Group, 'category'> | null): boolean {
  return Boolean(group && supportsAccommodationRates(group.category));
}

/**
 * Stove-tier billing (Electric MK 10,000 / Non-Electric MK 5,000) applies ONLY
 * when the group is Shared House or Student Hostel AND the contribution is Electricity.
 */
export function isStoveBillingApplicable(
  group?: Pick<Group, 'category'> | null,
  category?: string | null
): boolean {
  return isAccommodationGroup(group) && category === 'electricity';
}

export interface PercentageAllocationEntry {
  memberId: string;
  percentage: number;
}

export interface PercentageAllocationResult {
  valid: boolean;
  error?: string;
  totalPercentageBasisPoints: number;
  shares: Array<{ memberId: string; percentage: number; amount: number }>;
}

/**
 * Allocate an integer MWK total across members by percentage so rounded shares ALWAYS
 * sum strictly to totalTargetInt using Hamilton's Largest Remainder Method.
 * Requires total percentages to equal 100.00% (within 0.01% = 1 basis point precision).
 */
export function allocateByPercentage(
  totalTargetInt: number,
  entries: PercentageAllocationEntry[]
): PercentageAllocationResult {
  const safeTotal = toSafeIntMWK(totalTargetInt);
  if (safeTotal <= 0) {
    return {
      valid: false,
      error: 'Total target amount must be greater than MK 0.',
      totalPercentageBasisPoints: 0,
      shares: [],
    };
  }
  if (entries.length === 0) {
    return {
      valid: false,
      error: 'At least one active member is required.',
      totalPercentageBasisPoints: 0,
      shares: [],
    };
  }

  let totalBasisPoints = 0;
  const cleaned = entries.map((entry, index) => {
    const pct = Number.isFinite(entry.percentage) ? entry.percentage : 0;
    const bp = Math.round(pct * 100);
    totalBasisPoints += bp;
    return {
      index,
      memberId: entry.memberId,
      percentage: pct,
      basisPoints: bp,
    };
  });

  if (cleaned.some((e) => e.basisPoints < 0 || !Number.isFinite(e.percentage))) {
    return {
      valid: false,
      error: 'Percentages cannot be negative.',
      totalPercentageBasisPoints: totalBasisPoints,
      shares: [],
    };
  }

  const positiveCount = cleaned.filter((e) => e.basisPoints > 0).length;
  if (positiveCount === 0) {
    return {
      valid: false,
      error: 'Enter positive percentages totaling 100%.',
      totalPercentageBasisPoints: totalBasisPoints,
      shares: [],
    };
  }

  if (totalBasisPoints !== 10000) {
    const formattedPct = (totalBasisPoints / 100).toFixed(2).replace(/\.00$/, '');
    return {
      valid: false,
      error: `Percentages currently sum to ${formattedPct}%. They must equal 100%.`,
      totalPercentageBasisPoints: totalBasisPoints,
      shares: cleaned.map((c) => ({
        memberId: c.memberId,
        percentage: c.percentage,
        amount: Math.round((safeTotal * c.basisPoints) / 10000),
      })),
    };
  }

  // Hamilton Largest Remainder Method on whole MWK integer shares
  const exactItems = cleaned.map((item) => {
    const exactNumer = safeTotal * item.basisPoints;
    const floored = Math.floor(exactNumer / 10000);
    const remainder = exactNumer % 10000;
    return { ...item, floored, remainder, finalAmount: floored };
  });

  const flooredSum = exactItems.reduce((sum, item) => sum + item.floored, 0);
  let remainingKwacha = safeTotal - flooredSum;

  const sortedByRemainder = [...exactItems].sort((a, b) => {
    if (b.remainder !== a.remainder) return b.remainder - a.remainder;
    if (b.basisPoints !== a.basisPoints) return b.basisPoints - a.basisPoints;
    return a.index - b.index;
  });

  for (let i = 0; i < sortedByRemainder.length && remainingKwacha > 0; i++) {
    if (sortedByRemainder[i].basisPoints > 0) {
      sortedByRemainder[i].finalAmount += 1;
      remainingKwacha -= 1;
    }
  }

  const byIndex = new Map<number, number>();
  sortedByRemainder.forEach((item) => byIndex.set(item.index, item.finalAmount));

  return {
    valid: true,
    totalPercentageBasisPoints: totalBasisPoints,
    shares: cleaned.map((c) => ({
      memberId: c.memberId,
      percentage: c.percentage,
      amount: byIndex.get(c.index) ?? 0,
    })),
  };
}

export function validateCustomAllocations(
  totalTargetInt: number,
  entries: Array<{ memberId: string; amount: number }>
): { valid: boolean; error?: string; sum: number } {
  const safeTarget = toSafeIntMWK(totalTargetInt);
  if (safeTarget <= 0) {
    return { valid: false, error: 'Total target amount must be greater than MK 0.', sum: 0 };
  }
  if (entries.length === 0) {
    return { valid: false, error: 'At least one member must be assigned a share.', sum: 0 };
  }
  let sum = 0;
  for (const entry of entries) {
    if (!Number.isFinite(entry.amount) || !Number.isInteger(entry.amount) || entry.amount < 0) {
      return {
        valid: false,
        error: 'Each member share must be a non-negative whole MWK integer.',
        sum,
      };
    }
    sum += entry.amount;
  }
  if (sum !== safeTarget) {
    const diff = sum - safeTarget;
    const diffFormatted = `MK ${Math.abs(diff).toLocaleString('en-US')}`;
    return {
      valid: false,
      error:
        diff > 0
          ? `Member shares exceed target by ${diffFormatted}. Adjust shares so the total equals MK ${safeTarget.toLocaleString('en-US')}.`
          : `Member shares are ${diffFormatted} below the target of MK ${safeTarget.toLocaleString('en-US')}.`,
      sum,
    };
  }
  return { valid: true, sum };
}

export function formatDeadlineLabel(deadline?: string | null, hasNoDeadline?: boolean): string {
  if (hasNoDeadline || !deadline || !deadline.trim()) {
    return 'No fixed deadline';
  }
  const dt = new Date(deadline);
  if (Number.isNaN(dt.getTime())) {
    return 'No fixed deadline';
  }
  return dt.toLocaleDateString();
}

export const DEFAULT_INVITE_EXPIRY_DAYS = 30;

export function createInviteExpiry(
  days: number = DEFAULT_INVITE_EXPIRY_DAYS,
  nowMs: number = Date.now()
): { expiresAt: string; expiresAtMs: number } {
  const safeDays = Number.isFinite(days) && days > 0 ? days : DEFAULT_INVITE_EXPIRY_DAYS;
  const expiresAtMs = nowMs + Math.round(safeDays * 86_400_000);
  return {
    expiresAt: new Date(expiresAtMs).toISOString(),
    expiresAtMs,
  };
}

export function isInviteExpired(
  expiresAt?: string | null,
  expiresAtMs?: number | null,
  nowMs: number = Date.now()
): boolean {
  if (typeof expiresAtMs === 'number' && Number.isFinite(expiresAtMs)) {
    return nowMs >= expiresAtMs;
  }
  if (expiresAt && expiresAt.trim()) {
    const parsed = Date.parse(expiresAt);
    if (Number.isFinite(parsed)) {
      return nowMs >= parsed;
    }
  }
  return false;
}

export function generateJoinCode(prefix: string = 'US'): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const length = 10;
  const bytes = new Uint8Array(length);
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  const token = Array.from(bytes, (b) => chars[b % chars.length]).join('');
  return `${prefix}-${token.slice(0, 5)}-${token.slice(5, 10)}`;
}

/**
 * Build a shareable invite URL.
 *
 * GitHub Pages project sites are served from /<repo-name>/, not the domain root.
 * Vite exposes that prefix as import.meta.env.BASE_URL, so include it here;
 * otherwise invited members land on https://<owner>.github.io/?join=... and see
 * GitHub's "There isn't a GitHub Pages site here" 404.
 */
export function buildInviteUrl(joinCode: string, origin?: string, pathBase?: string): string {
  const cleanCode = encodeURIComponent(joinCode.trim().toUpperCase());
  const base =
    origin ||
    (typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '');

  const runtimeBase = (import.meta.env?.BASE_URL || '').replace(/\/$/, '');
  const rawBase = pathBase ?? runtimeBase;
  const normalizedBase =
    !rawBase || rawBase === '/' ? '' : rawBase.startsWith('/') ? rawBase : `/${rawBase}`;

  return `${base}${normalizedBase}/?join=${cleanCode}`;
}

export function extractInviteCodeFromUrl(hrefOrSearch: string): string | null {
  try {
    const cleanInput = (hrefOrSearch || '').trim();
    if (!cleanInput) return null;

    if (cleanInput.includes('join=')) {
      const idx = cleanInput.indexOf('?');
      const searchPart = idx >= 0 ? cleanInput.slice(idx) : `?${cleanInput}`;
      const params = new URLSearchParams(searchPart.split('#')[0]);
      const code = params.get('join')?.trim().toUpperCase();
      if (code && /^[A-Z0-9-]{4,32}$/.test(code)) return code;
    }

    if (cleanInput.includes('code=')) {
      const hashIdx = cleanInput.indexOf('#');
      const hashPart = hashIdx >= 0 ? cleanInput.slice(hashIdx + 1) : cleanInput;
      const params = new URLSearchParams(hashPart);
      const code = params.get('code')?.trim().toUpperCase();
      if (code && /^[A-Z0-9-]{4,32}$/.test(code)) return code;
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Non-destructive historical data integrity scanner and repair utility.
 * - Never overwrites valid historical payments or rates silently.
 * - Coerces string-encoded integer amounts into safe integers and logs exact deltas.
 * - Flags missing stoveType ONLY for accommodation groups (house/hostel) that rely on stove billing.
 * - Flags duplicate transaction references for admin review.
 * - Syncs commitment currentOutstandingAmount deterministically from verified payments.
 */
export function auditAndRepairFinancialData(input: {
  groups?: Group[];
  groupMembers: GroupMember[];
  contributions: Contribution[];
  assignments: ContributionAssignment[];
  payments: Payment[];
  commitments: PaymentCommitment[];
  expenses: Expense[];
}): {
  groupMembers: GroupMember[];
  contributions: Contribution[];
  assignments: ContributionAssignment[];
  payments: Payment[];
  commitments: PaymentCommitment[];
  expenses: Expense[];
  report: IntegrityReport;
} {
  const nowIso = new Date().toISOString();
  const findings: IntegrityFinding[] = [];
  let repairedCount = 0;
  let flaggedCount = 0;

  const groupMap = new Map<string, Group>();
  (input.groups || []).forEach((g) => groupMap.set(g.id, g));

  // 1. Scan accommodation group members for missing stoveType (non-accommodation groups never need stoveType)
  const repairedMembers = input.groupMembers.map((m) => {
    const parentGroup = groupMap.get(m.groupId);
    const groupUsesStoves = parentGroup ? isAccommodationGroup(parentGroup) : true;
    const hasElectricityStoveContrib = input.contributions.some(
      (c) =>
        c.groupId === m.groupId &&
        c.category === 'electricity' &&
        (c.allocationMode === 'stove_rate' || (!c.allocationMode && groupUsesStoves))
    );

    if (
      groupUsesStoves &&
      hasElectricityStoveContrib &&
      m.status === 'active' &&
      !isValidStoveType(m.stoveType)
    ) {
      if (!m.stoveTypeReviewRequired) {
        flaggedCount++;
        findings.push({
          id: `fnd_mem_${m.id}`,
          entityType: 'member',
          entityId: m.id,
          severity: 'review_required',
          issue: `Active member "${m.name}" is missing a stove classification (Electric vs Non-Electric) for electricity billing.`,
          beforeValue: String(m.stoveType ?? 'unset'),
          afterValue: 'stoveTypeReviewRequired=true',
          timestamp: nowIso,
        });
      } else {
        flaggedCount++;
      }
      return { ...m, stoveTypeReviewRequired: true };
    }
    return m;
  });

  // 2. Scan contributions for string/float target amounts
  const repairedContributions = input.contributions.map((c) => {
    const rawTarget: unknown = c.totalTargetAmount;
    const safeTarget = toSafeIntMWK(rawTarget);
    if (typeof rawTarget !== 'number' || rawTarget !== safeTarget) {
      repairedCount++;
      findings.push({
        id: `fnd_cnt_${c.id}`,
        entityType: 'contribution',
        entityId: c.id,
        severity: 'repaired',
        issue: `Normalized contribution "${c.title}" target amount to safe integer MWK.`,
        beforeValue: String(rawTarget),
        afterValue: String(safeTarget),
        timestamp: nowIso,
      });
      return { ...c, totalTargetAmount: safeTarget };
    }
    return c;
  });

  // 3. Scan payments for string/float amounts, missing createdAt, and duplicate references
  const seenRefs = new Map<string, string>();
  const repairedPayments = input.payments.map((p) => {
    let next = p;
    const rawAmount: unknown = p.amountReceived;
    const safeAmount = toSafeIntMWK(rawAmount);
    if (typeof rawAmount !== 'number' || rawAmount !== safeAmount) {
      repairedCount++;
      findings.push({
        id: `fnd_pay_amt_${p.id}`,
        entityType: 'payment',
        entityId: p.id,
        severity: 'repaired',
        issue: `Normalized payment ${p.id} amount from non-integer/string to safe integer MWK.`,
        beforeValue: String(rawAmount),
        afterValue: String(safeAmount),
        timestamp: nowIso,
      });
      next = { ...next, amountReceived: safeAmount };
    }

    const normRef = (next.transactionReference || '').trim().toLowerCase();
    if (
      normRef &&
      next.verificationStatus !== 'rejected' &&
      next.verificationStatus !== 'reversed'
    ) {
      const existingId = seenRefs.get(normRef);
      if (existingId && existingId !== next.id) {
        flaggedCount++;
        findings.push({
          id: `fnd_pay_dup_${next.id}`,
          entityType: 'payment',
          entityId: next.id,
          severity: 'review_required',
          issue: `Duplicate transaction reference "${next.transactionReference}" also used by payment ${existingId}. Review and reverse if duplicated.`,
          beforeValue: existingId,
          afterValue: next.id,
          timestamp: nowIso,
        });
      } else {
        seenRefs.set(normRef, next.id);
      }
    }

    return next;
  });

  // 4. Scan assignments for string amounts and rate discrepancies
  const repairedAssignments = input.assignments.map((a) => {
    let next = a;
    const rawAssigned: unknown = a.assignedAmount;
    const safeAssigned = toSafeIntMWK(rawAssigned);
    if (typeof rawAssigned !== 'number' || rawAssigned !== safeAssigned) {
      repairedCount++;
      findings.push({
        id: `fnd_asg_amt_${a.id}`,
        entityType: 'assignment',
        entityId: a.id,
        severity: 'repaired',
        issue: `Normalized assignment ${a.id} amount to safe integer MWK.`,
        beforeValue: String(rawAssigned),
        afterValue: String(safeAssigned),
        timestamp: nowIso,
      });
      next = { ...next, assignedAmount: safeAssigned };
    }

    const member = repairedMembers.find((m) => m.id === next.memberId || m.userId === next.memberId);
    const contrib = repairedContributions.find((c) => c.id === next.contributionId);
    const contribGroup = contrib ? groupMap.get(contrib.groupId) : undefined;
    const isStoveMode =
      contrib?.allocationMode === 'stove_rate' ||
      (!contrib?.allocationMode &&
        contrib?.category === 'electricity' &&
        (contribGroup ? isAccommodationGroup(contribGroup) : true));
    if (
      member &&
      isValidStoveType(member.stoveType) &&
      isStoveMode
    ) {
      const expectedRate = RATES[member.stoveType];
      if (next.assignedAmount !== expectedRate && !next.notes?.toLowerCase().includes('custom')) {
        flaggedCount++;
        findings.push({
          id: `fnd_asg_rate_${next.id}`,
          entityType: 'assignment',
          entityId: next.id,
          severity: 'review_required',
          issue: `Assignment ${next.id} for "${member.name}" (${STOVE_TYPE_LABELS[member.stoveType]}) has MK ${next.assignedAmount.toLocaleString('en-US')} instead of configured rate MK ${expectedRate.toLocaleString('en-US')}. Original preserved for admin review.`,
          beforeValue: String(next.assignedAmount),
          afterValue: String(expectedRate),
          timestamp: nowIso,
        });
      }
    }

    return next;
  });

  // 5. Scan commitments for numeric safety & verified-paid synchronization
  const repairedCommitments = input.commitments.map((c) => {
    const safeOrig = toSafeIntMWK(c.originalOutstandingAmount);
    let safeCurr = toSafeIntMWK(c.currentOutstandingAmount);

    const assignment = repairedAssignments.find((a) => a.id === c.assignmentId);
    if (assignment) {
      const verifiedPaid = repairedPayments
        .filter((p) => p.assignmentId === assignment.id && p.verificationStatus === 'verified')
        .reduce((sum, p) => sum + toSafeIntMWK(p.amountReceived), 0);
      const derivedRemaining = Math.max(0, assignment.assignedAmount - verifiedPaid);
      if (derivedRemaining !== safeCurr) {
        repairedCount++;
        findings.push({
          id: `fnd_cmt_sync_${c.id}`,
          entityType: 'commitment',
          entityId: c.id,
          severity: 'repaired',
          issue: `Synchronized commitment ${c.id} remaining balance from verified payments.`,
          beforeValue: String(safeCurr),
          afterValue: String(derivedRemaining),
          timestamp: nowIso,
        });
        safeCurr = derivedRemaining;
      }
    }

    return {
      ...c,
      originalOutstandingAmount: safeOrig,
      currentOutstandingAmount: safeCurr,
      status: safeCurr <= 0 ? ('completed' as const) : c.status,
    };
  });

  // 6. Scan expenses for integer amounts
  const repairedExpenses = input.expenses.map((e) => {
    const rawAmt: unknown = e.amount;
    const safeAmt = toSafeIntMWK(rawAmt);
    if (typeof rawAmt !== 'number' || rawAmt !== safeAmt) {
      repairedCount++;
      findings.push({
        id: `fnd_exp_${e.id}`,
        entityType: 'expense',
        entityId: e.id,
        severity: 'repaired',
        issue: `Normalized expense "${e.name}" amount to safe integer MWK.`,
        beforeValue: String(rawAmt),
        afterValue: String(safeAmt),
        timestamp: nowIso,
      });
      return { ...e, amount: safeAmt };
    }
    return e;
  });

  return {
    groupMembers: repairedMembers,
    contributions: repairedContributions,
    assignments: repairedAssignments,
    payments: repairedPayments,
    commitments: repairedCommitments,
    expenses: repairedExpenses,
    report: {
      scannedAt: nowIso,
      repairedCount,
      flaggedCount,
      findings,
    },
  };
}

/**
 * Recursively strip undefined and null fields before persisting objects to Firestore.
 */
export function sanitizeForFirestore<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val === undefined || val === null) continue;
    if (Array.isArray(val)) {
      result[key] = val
        .filter((item) => item !== undefined && item !== null)
        .map((item) =>
          item && typeof item === 'object' && !Array.isArray(item)
            ? sanitizeForFirestore(item as Record<string, unknown>)
            : item
        );
    } else if (val && typeof val === 'object') {
      result[key] = sanitizeForFirestore(val as Record<string, unknown>);
    } else {
      result[key] = val;
    }
  }
  return result;
}

/**
 * Normalize a GroupMember record (including legacy records missing name/email/userId)
 * before writing to Firestore so full schema invariants are always satisfied.
 */
export function normalizeGroupMemberForSync(
  member: GroupMember,
  usersList: Array<{ id: string; name?: string; email?: string; phone?: string; roomNumber?: string }> = [],
  fallbackNow: string = new Date().toISOString()
): GroupMember {
  const matchedUser = usersList.find(
    (u) => u.id === member.userId || u.id === member.id
  );
  const resolvedName =
    member.name?.trim() ||
    matchedUser?.name?.trim() ||
    'Group Member';
  const resolvedEmail =
    member.email?.trim() ||
    matchedUser?.email?.trim() ||
    '';
  const resolvedPhone =
    member.phone?.trim() ||
    matchedUser?.phone?.trim() ||
    undefined;
  const resolvedRoom =
    member.roomNumber?.trim() ||
    matchedUser?.roomNumber?.trim() ||
    undefined;

  return {
    ...member,
    id: member.id,
    groupId: member.groupId,
    userId: member.userId || member.id,
    name: resolvedName,
    email: resolvedEmail,
    phone: resolvedPhone,
    roomNumber: resolvedRoom,
    roleInGroup: member.roleInGroup || 'member',
    joinedAt: member.joinedAt || member.createdAt || fallbackNow,
    status: member.status || 'active',
  };
}

/**
 * Merge incoming Firestore member snapshots with existing local state without
 * letting legacy remote docs (which may omit name/email) erase locally known fields.
 */
export function mergeGroupMembersWithFallback(
  prev: GroupMember[],
  incoming: GroupMember[],
  usersList: Array<{ id: string; name?: string; email?: string; phone?: string; roomNumber?: string }> = []
): GroupMember[] {
  const merged = [...prev];
  incoming.forEach((remote) => {
    const idx = merged.findIndex((p) => p.id === remote.id);
    const existingLocal = idx >= 0 ? merged[idx] : undefined;
    const combined: GroupMember = {
      ...(existingLocal || {}),
      ...remote,
      name: remote.name?.trim() || existingLocal?.name?.trim() || '',
      email: remote.email?.trim() || existingLocal?.email?.trim() || '',
      phone: remote.phone ?? existingLocal?.phone,
      memberRefId: remote.memberRefId || existingLocal?.memberRefId,
      roomNumber: remote.roomNumber ?? existingLocal?.roomNumber,
      userId: remote.userId || existingLocal?.userId || remote.id,
      roleInGroup: remote.roleInGroup || existingLocal?.roleInGroup || 'member',
      joinedAt: remote.joinedAt || existingLocal?.joinedAt || remote.createdAt || new Date().toISOString(),
      status: remote.status || existingLocal?.status || 'active',
    };
    const normalized = normalizeGroupMemberForSync(combined, usersList);
    if (idx >= 0) merged[idx] = normalized;
    else merged.push(normalized);
  });
  return merged;
}


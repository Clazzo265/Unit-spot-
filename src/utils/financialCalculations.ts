import {
  ContributionAssignment,
  Payment,
  PaymentCommitment,
  CommitmentStatus,
  PaymentStatus,
} from '../types';
import { toSafeIntMWK } from './financialConfig';

/**
 * Format integer numbers as Malawi Kwacha currency (MWK / MK)
 */
export function formatMWK(amount: number): string {
  const safeInt = toSafeIntMWK(amount);
  return 'MK ' + safeInt.toLocaleString('en-US');
}

/**
 * Format signed MWK delta (e.g. negative treasury balance or adjustment)
 */
export function formatSignedMWK(amount: number): string {
  const num = Number.isFinite(amount) ? Math.round(amount) : 0;
  if (num < 0) {
    return '-MK ' + Math.abs(num).toLocaleString('en-US');
  }
  return 'MK ' + num.toLocaleString('en-US');
}

/**
 * Format currency without prefix for compact tables/inputs
 */
export function formatNumber(amount: number): string {
  return toSafeIntMWK(amount).toLocaleString('en-US');
}

/**
 * Calculate total verified payments for a specific assignment.
 * Strictly sums verified payments only (excludes submitted, pending_verification, rejected, disputed, reversed).
 * Uses safe integer parsing to prevent string concatenation.
 */
export function calculateVerifiedPaidForAssignment(
  assignmentId: string,
  payments: Payment[]
): number {
  return payments
    .filter((p) => p.assignmentId === assignmentId && p.verificationStatus === 'verified')
    .reduce((sum, p) => sum + toSafeIntMWK(p.amountReceived), 0);
}

/**
 * Calculate total pending / submitted payments awaiting verification for an assignment
 */
export function calculatePendingPaidForAssignment(
  assignmentId: string,
  payments: Payment[]
): number {
  return payments
    .filter(
      (p) =>
        p.assignmentId === assignmentId &&
        (p.verificationStatus === 'pending_verification' ||
          p.verificationStatus === 'submitted')
    )
    .reduce((sum, p) => sum + toSafeIntMWK(p.amountReceived), 0);
}

/**
 * Calculate total reversed amount for a specific assignment (for audit transparency)
 */
export function calculateReversedForAssignment(
  assignmentId: string,
  payments: Payment[]
): number {
  return payments
    .filter((p) => p.assignmentId === assignmentId && p.verificationStatus === 'reversed')
    .reduce((sum, p) => sum + toSafeIntMWK(p.amountReceived), 0);
}

/**
 * Calculate outstanding balance and overpayment credit for an assignment.
 * Outstanding = Expected - Verified Payments (clamped >= 0).
 * Credit / Overpaid = Verified Payments - Expected (when Verified > Expected).
 */
export function calculateOutstandingBalance(
  expectedAmount: number,
  verifiedPaid: number
): { outstanding: number; credit: number; overpaid: number; completionPercentage: number } {
  const safeExpected = toSafeIntMWK(expectedAmount);
  const safePaid = toSafeIntMWK(verifiedPaid);
  const diff = safeExpected - safePaid;
  const outstanding = diff > 0 ? diff : 0;
  const credit = diff < 0 ? Math.abs(diff) : 0;
  const completionPercentage =
    safeExpected > 0 ? Math.min(100, Math.round((safePaid / safeExpected) * 100)) : 100;

  return { outstanding, credit, overpaid: credit, completionPercentage };
}

/**
 * Full breakdown for an assignment across all verification states
 */
export function calculateAssignmentBreakdown(
  assignment: ContributionAssignment,
  payments: Payment[]
): {
  expected: number;
  verifiedPaid: number;
  pendingPaid: number;
  reversedTotal: number;
  remaining: number;
  overpaid: number;
  completionPercentage: number;
  status: PaymentStatus;
} {
  const expected = toSafeIntMWK(assignment.assignedAmount);
  const verifiedPaid = calculateVerifiedPaidForAssignment(assignment.id, payments);
  const pendingPaid = calculatePendingPaidForAssignment(assignment.id, payments);
  const reversedTotal = calculateReversedForAssignment(assignment.id, payments);
  const { outstanding, overpaid, completionPercentage } = calculateOutstandingBalance(
    expected,
    verifiedPaid
  );
  const status = determineAssignmentPaymentStatus(
    expected,
    verifiedPaid,
    pendingPaid,
    assignment.deadline
  );

  return {
    expected,
    verifiedPaid,
    pendingPaid,
    reversedTotal,
    remaining: outstanding,
    overpaid,
    completionPercentage,
    status,
  };
}

/**
 * Determine payment status for an assignment
 */
export function determineAssignmentPaymentStatus(
  expectedAmount: number,
  verifiedPaid: number,
  pendingPaid: number,
  deadline: string,
  nowIsoString: string = new Date().toISOString()
): PaymentStatus {
  const safeExpected = toSafeIntMWK(expectedAmount);
  const safeVerified = toSafeIntMWK(verifiedPaid);
  const safePending = toSafeIntMWK(pendingPaid);

  if (safeExpected > 0 && safeVerified >= safeExpected) {
    return 'fully_settled';
  }

  if (safeVerified > 0) {
    return 'partially_paid';
  }

  if (safePending > 0) {
    return 'pending_verification';
  }

  if (deadline) {
    const deadlineTime = new Date(deadline).getTime();
    const nowTime = new Date(nowIsoString).getTime();
    if (Number.isFinite(deadlineTime) && nowTime > deadlineTime) {
      return 'overdue';
    }
  }

  return 'unpaid';
}

/**
 * Calculate dynamic countdown status and remaining time for a commitment
 */
export interface CommitmentCountdownResult {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isOverdue: boolean;
  isDueToday: boolean;
  isDueSoon: boolean;
  computedStatus: CommitmentStatus;
  displayText: string;
}

export function computeCommitmentCountdown(
  promisedDateIso: string,
  currentStatus: CommitmentStatus,
  currentOutstanding: number,
  nowDate: Date = new Date()
): CommitmentCountdownResult {
  const safeOutstanding = toSafeIntMWK(currentOutstanding);
  if (safeOutstanding <= 0 || currentStatus === 'completed') {
    return {
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      isOverdue: false,
      isDueToday: false,
      isDueSoon: false,
      computedStatus: 'completed',
      displayText: 'Settled & Completed',
    };
  }

  const targetTime = new Date(promisedDateIso).getTime();
  const currentTime = nowDate.getTime();
  const diffMs = targetTime - currentTime;

  if (diffMs <= 0) {
    const overdueDays = Math.floor(Math.abs(diffMs) / (1000 * 60 * 60 * 24));
    return {
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      isOverdue: true,
      isDueToday: false,
      isDueSoon: false,
      computedStatus: 'overdue',
      displayText: overdueDays === 0 ? 'Overdue today' : `${overdueDays}d overdue`,
    };
  }

  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

  const isDueToday = days === 0;
  const isDueSoon = days <= 3;

  let computedStatus: CommitmentStatus = 'active';
  if (currentStatus === 'extension_requested') {
    computedStatus = 'extension_requested';
  } else if (isDueToday) {
    computedStatus = 'due_today';
  } else if (isDueSoon) {
    computedStatus = 'due_soon';
  }

  let displayText = '';
  if (days > 0) {
    displayText = `${days}d ${hours}h remaining`;
  } else if (hours > 0) {
    displayText = `${hours}h ${minutes}m remaining`;
  } else {
    displayText = `${minutes}m ${seconds}s remaining`;
  }

  return {
    days,
    hours,
    minutes,
    seconds,
    isOverdue: false,
    isDueToday,
    isDueSoon,
    computedStatus,
    displayText,
  };
}

/**
 * Calculate member financial scorecard performance
 */
export interface MemberPerformance {
  totalExpected: number;
  totalVerifiedPaid: number;
  totalOutstanding: number;
  totalOverpaid: number;
  commitmentsCount: number;
  commitmentsHonoured: number;
  commitmentsMissed: number;
  activeCommitments: number;
  onTimePaymentRate: number;
}

export function computeMemberPerformance(
  memberId: string,
  assignments: ContributionAssignment[],
  payments: Payment[],
  commitments: PaymentCommitment[]
): MemberPerformance {
  const memberAssignments = assignments.filter((a) => a.memberId === memberId);
  const totalExpected = memberAssignments.reduce(
    (sum, a) => sum + toSafeIntMWK(a.assignedAmount),
    0
  );

  const memberPayments = payments.filter((p) => p.memberId === memberId);
  const totalVerifiedPaid = memberPayments
    .filter((p) => p.verificationStatus === 'verified')
    .reduce((sum, p) => sum + toSafeIntMWK(p.amountReceived), 0);

  const totalOutstanding = Math.max(0, totalExpected - totalVerifiedPaid);
  const totalOverpaid = Math.max(0, totalVerifiedPaid - totalExpected);

  const memberCommitments = commitments.filter((c) => c.memberId === memberId);
  const commitmentsCount = memberCommitments.length;
  const commitmentsHonoured = memberCommitments.filter((c) => c.status === 'completed').length;
  const commitmentsMissed = memberCommitments.filter((c) => c.status === 'overdue').length;
  const activeCommitments = memberCommitments.filter(
    (c) =>
      c.status === 'active' ||
      c.status === 'due_soon' ||
      c.status === 'due_today' ||
      c.status === 'extension_requested'
  ).length;

  const onTimePaymentRate =
    commitmentsCount > 0 ? Math.round((commitmentsHonoured / commitmentsCount) * 100) : 100;

  return {
    totalExpected,
    totalVerifiedPaid,
    totalOutstanding,
    totalOverpaid,
    commitmentsCount,
    commitmentsHonoured,
    commitmentsMissed,
    activeCommitments,
    onTimePaymentRate,
  };
}

/**
 * Reconcile group financial summary using safe integer math and verified-only inflow
 */
export interface GroupFinancialSummary {
  totalExpected: number;
  totalCollected: number;
  totalVerified: number;
  totalPendingVerification: number;
  totalReversed: number;
  totalOutstanding: number;
  totalOverpaid: number;
  totalExpensesApproved: number;
  remainingGroupFunds: number;
  fullyPaidCount: number;
  partiallyPaidCount: number;
  unpaidCount: number;
}

export function computeGroupFinancialSummary(
  assignments: ContributionAssignment[],
  payments: Payment[],
  approvedExpensesTotal: number
): GroupFinancialSummary {
  const safeApprovedExpenses = toSafeIntMWK(approvedExpensesTotal);
  const totalExpected = assignments.reduce((sum, a) => sum + toSafeIntMWK(a.assignedAmount), 0);

  let totalCollected = 0;
  let totalVerified = 0;
  let totalPendingVerification = 0;
  let totalReversed = 0;

  // Scope payments to assignments if filtering by specific contribution, or all group payments
  const assignmentIds = new Set(assignments.map((a) => a.id));
  const scopedPayments =
    assignmentIds.size > 0
      ? payments.filter((p) => assignmentIds.has(p.assignmentId))
      : payments;

  scopedPayments.forEach((p) => {
    const amt = toSafeIntMWK(p.amountReceived);
    if (p.verificationStatus === 'verified') {
      totalVerified += amt;
      totalCollected += amt;
    } else if (
      p.verificationStatus === 'pending_verification' ||
      p.verificationStatus === 'submitted'
    ) {
      totalPendingVerification += amt;
      totalCollected += amt;
    } else if (p.verificationStatus === 'reversed') {
      totalReversed += amt;
    }
  });

  // Sum assignment-by-assignment so one member's overpayment doesn't mask another member's debt
  let totalOutstanding = 0;
  let totalOverpaid = 0;
  let fullyPaidCount = 0;
  let partiallyPaidCount = 0;
  let unpaidCount = 0;

  assignments.forEach((a) => {
    const verified = calculateVerifiedPaidForAssignment(a.id, scopedPayments);
    const { outstanding, overpaid } = calculateOutstandingBalance(a.assignedAmount, verified);
    totalOutstanding += outstanding;
    totalOverpaid += overpaid;

    if (verified >= toSafeIntMWK(a.assignedAmount)) {
      fullyPaidCount++;
    } else if (verified > 0) {
      partiallyPaidCount++;
    } else {
      unpaidCount++;
    }
  });

  const remainingGroupFunds = totalVerified - safeApprovedExpenses;

  return {
    totalExpected,
    totalCollected,
    totalVerified,
    totalPendingVerification,
    totalReversed,
    totalOutstanding,
    totalOverpaid,
    totalExpensesApproved: safeApprovedExpenses,
    remainingGroupFunds,
    fullyPaidCount,
    partiallyPaidCount,
    unpaidCount,
  };
}

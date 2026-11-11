import { 
  ContributionAssignment, 
  Payment, 
  PaymentCommitment, 
  CommitmentStatus, 
  PaymentStatus 
} from '../types';

/**
 * Format numbers as Malawi Kwacha currency (MWK / MK)
 */
export function formatMWK(amount: number): string {
  const rounded = Math.round(amount || 0);
  return 'MK ' + rounded.toLocaleString('en-US');
}

/**
 * Format currency without prefix for compact tables/inputs
 */
export function formatNumber(amount: number): string {
  return (Math.round(amount || 0)).toLocaleString('en-US');
}

/**
 * Calculate total verified payments for a specific assignment
 */
export function calculateVerifiedPaidForAssignment(
  assignmentId: string, 
  payments: Payment[]
): number {
  return payments
    .filter(p => p.assignmentId === assignmentId && p.verificationStatus === 'verified')
    .reduce((sum, p) => sum + p.amountReceived, 0);
}

/**
 * Calculate total pending verification payments for a specific assignment
 */
export function calculatePendingPaidForAssignment(
  assignmentId: string, 
  payments: Payment[]
): number {
  return payments
    .filter(p => p.assignmentId === assignmentId && p.verificationStatus === 'pending_verification')
    .reduce((sum, p) => sum + p.amountReceived, 0);
}

/**
 * Calculate outstanding balance for an assignment.
 * Outstanding = Expected - Verified Payments.
 * (Overpayments are clamped to 0 for outstanding, handled as credits if positive)
 */
export function calculateOutstandingBalance(
  expectedAmount: number,
  verifiedPaid: number
): { outstanding: number; credit: number; completionPercentage: number } {
  const diff = expectedAmount - verifiedPaid;
  const outstanding = diff > 0 ? diff : 0;
  const credit = diff < 0 ? Math.abs(diff) : 0;
  const completionPercentage = expectedAmount > 0 
    ? Math.min(100, Math.round((verifiedPaid / expectedAmount) * 100))
    : 100;

  return { outstanding, credit, completionPercentage };
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
  if (verifiedPaid >= expectedAmount) {
    return 'fully_settled';
  }
  
  if (verifiedPaid > 0) {
    return 'partially_paid';
  }

  if (pendingPaid > 0) {
    return 'pending_verification';
  }

  // Check if overdue
  if (deadline) {
    const deadlineTime = new Date(deadline).getTime();
    const nowTime = new Date(nowIsoString).getTime();
    if (nowTime > deadlineTime) {
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
  isDueSoon: boolean; // within 3 days
  computedStatus: CommitmentStatus;
  displayText: string;
}

export function computeCommitmentCountdown(
  promisedDateIso: string,
  currentStatus: CommitmentStatus,
  currentOutstanding: number,
  nowDate: Date = new Date()
): CommitmentCountdownResult {
  if (currentOutstanding <= 0 || currentStatus === 'completed') {
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
  commitmentsCount: number;
  commitmentsHonoured: number;
  commitmentsMissed: number;
  activeCommitments: number;
  onTimePaymentRate: number; // percentage
}

export function computeMemberPerformance(
  memberId: string,
  assignments: ContributionAssignment[],
  payments: Payment[],
  commitments: PaymentCommitment[]
): MemberPerformance {
  const memberAssignments = assignments.filter(a => a.memberId === memberId);
  const totalExpected = memberAssignments.reduce((sum, a) => sum + a.assignedAmount, 0);

  const memberPayments = payments.filter(p => p.memberId === memberId);
  const totalVerifiedPaid = memberPayments
    .filter(p => p.verificationStatus === 'verified')
    .reduce((sum, p) => sum + p.amountReceived, 0);

  const totalOutstanding = Math.max(0, totalExpected - totalVerifiedPaid);

  const memberCommitments = commitments.filter(c => c.memberId === memberId);
  const commitmentsCount = memberCommitments.length;
  const commitmentsHonoured = memberCommitments.filter(c => c.status === 'completed').length;
  const commitmentsMissed = memberCommitments.filter(c => c.status === 'overdue').length;
  const activeCommitments = memberCommitments.filter(c => 
    c.status === 'active' || c.status === 'due_soon' || c.status === 'due_today' || c.status === 'extension_requested'
  ).length;

  const onTimePaymentRate = commitmentsCount > 0 
    ? Math.round((commitmentsHonoured / commitmentsCount) * 100) 
    : 100;

  return {
    totalExpected,
    totalVerifiedPaid,
    totalOutstanding,
    commitmentsCount,
    commitmentsHonoured,
    commitmentsMissed,
    activeCommitments,
    onTimePaymentRate,
  };
}

/**
 * Reconcile group financial summary
 */
export interface GroupFinancialSummary {
  totalExpected: number;
  totalCollected: number;
  totalVerified: number;
  totalPendingVerification: number;
  totalOutstanding: number;
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
  const totalExpected = assignments.reduce((sum, a) => sum + a.assignedAmount, 0);

  let totalCollected = 0;
  let totalVerified = 0;
  let totalPendingVerification = 0;

  payments.forEach(p => {
    totalCollected += p.amountReceived;
    if (p.verificationStatus === 'verified') {
      totalVerified += p.amountReceived;
    } else if (p.verificationStatus === 'pending_verification') {
      totalPendingVerification += p.amountReceived;
    }
  });

  const totalOutstanding = Math.max(0, totalExpected - totalVerified);
  const remainingGroupFunds = totalVerified - approvedExpensesTotal;

  // Member completion counts
  let fullyPaidCount = 0;
  let partiallyPaidCount = 0;
  let unpaidCount = 0;

  assignments.forEach(a => {
    const verified = calculateVerifiedPaidForAssignment(a.id, payments);
    if (verified >= a.assignedAmount) {
      fullyPaidCount++;
    } else if (verified > 0) {
      partiallyPaidCount++;
    } else {
      unpaidCount++;
    }
  });

  return {
    totalExpected,
    totalCollected,
    totalVerified,
    totalPendingVerification,
    totalOutstanding,
    totalExpensesApproved: approvedExpensesTotal,
    remainingGroupFunds,
    fullyPaidCount,
    partiallyPaidCount,
    unpaidCount,
  };
}

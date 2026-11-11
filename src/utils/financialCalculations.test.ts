import test from 'node:test';
import assert from 'node:assert/strict';
import { 
  calculateOutstandingBalance, 
  determineAssignmentPaymentStatus,
  computeCommitmentCountdown,
  computeGroupFinancialSummary,
  formatMWK
} from './financialCalculations';
import { ContributionAssignment, Payment } from '../types';

test('Scenario 1: Full payment calculation (Expected: 10000, Paid: 10000 -> Remaining: 0)', () => {
  const result = calculateOutstandingBalance(10000, 10000);
  assert.equal(result.outstanding, 0);
  assert.equal(result.credit, 0);
  assert.equal(result.completionPercentage, 100);

  const status = determineAssignmentPaymentStatus(10000, 10000, 0, '2026-12-01');
  assert.equal(status, 'fully_settled');
});

test('Scenario 2: Partial payment calculation (Expected: 10000, Paid: 7000 -> Remaining: 3000)', () => {
  const result = calculateOutstandingBalance(10000, 7000);
  assert.equal(result.outstanding, 3000);
  assert.equal(result.credit, 0);
  assert.equal(result.completionPercentage, 70);

  const status = determineAssignmentPaymentStatus(10000, 7000, 0, '2026-12-01');
  assert.equal(status, 'partially_paid');
});

test('Scenario 3: Multi-step payment reduction (3000 balance minus 1000 new payment -> 2000)', () => {
  const step1 = calculateOutstandingBalance(10000, 7000);
  assert.equal(step1.outstanding, 3000);
  // Member pays additional 1000 -> total paid is now 8000
  const step2 = calculateOutstandingBalance(10000, 8000);
  assert.equal(step2.outstanding, 2000);
  assert.equal(step2.completionPercentage, 80);
});

test('Scenario 4: Commitment countdown calculation with future date', () => {
  const fixedNow = new Date('2026-11-11T12:00:00Z');
  const futurePromise = new Date('2026-11-18T12:00:00Z').toISOString(); // exactly 7 days
  
  const countdown = computeCommitmentCountdown(futurePromise, 'active', 3000, fixedNow);
  assert.equal(countdown.days, 7);
  assert.equal(countdown.isOverdue, false);
});

test('Scenario 5: Commitment overdue check when promise date has passed', () => {
  const fixedNow = new Date('2026-11-19T12:00:00Z');
  const pastPromise = new Date('2026-11-18T12:00:00Z').toISOString();
  
  const countdown = computeCommitmentCountdown(pastPromise, 'active', 3000, fixedNow);
  assert.equal(countdown.isOverdue, true);
  assert.equal(countdown.computedStatus, 'overdue');
});

test('Scenario 6: Expense reconciliation (Collected: 50000, Spent: 45000 -> Remaining: 5000)', () => {
  const dummyAssignments: ContributionAssignment[] = [
    {
      id: 'a1',
      contributionId: 'c1',
      groupId: 'g1',
      memberId: 'u1',
      assignedAmount: 50000,
      assignedDate: '2026-11-01',
      deadline: '2026-11-30',
      status: 'fully_settled',
    }
  ];

  const dummyPayments: Payment[] = [
    {
      id: 'p1',
      assignmentId: 'a1',
      contributionId: 'c1',
      groupId: 'g1',
      memberId: 'u1',
      amountReceived: 50000,
      paymentDate: '2026-11-05',
      paymentMethod: 'airtel_money',
      transactionReference: 'AIR-99201',
      collectorId: 'col1',
      verificationStatus: 'verified',
      createdAt: '2026-11-05',
    }
  ];

  const summary = computeGroupFinancialSummary(dummyAssignments, dummyPayments, 45000);
  assert.equal(summary.totalCollected, 50000);
  assert.equal(summary.totalVerified, 50000);
  assert.equal(summary.totalExpensesApproved, 45000);
  assert.equal(summary.remainingGroupFunds, 5000);
  assert.equal(summary.fullyPaidCount, 1);
});

test('MWK Currency formatting', () => {
  assert.equal(formatMWK(10000), 'MK 10,000');
  assert.equal(formatMWK(500000), 'MK 500,000');
});

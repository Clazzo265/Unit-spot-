import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  RATES,
  RATE_CONFIG_VERSION,
  isValidStoveType,
  getRateForStoveType,
  parseMWKInput,
  toSafeIntMWK,
  validateTransactionReference,
  resolveMemberInfo,
  auditAndRepairFinancialData,
} from './financialConfig';
import {
  calculateVerifiedPaidForAssignment,
  calculatePendingPaidForAssignment,
  calculateReversedForAssignment,
  calculateOutstandingBalance,
  calculateAssignmentBreakdown,
  computeGroupFinancialSummary,
  formatSignedMWK,
} from './financialCalculations';
import {
  canUserManageGroup,
  canUserVerifyPayments,
  canUserReversePayments,
  canUserApproveExpenses,
} from './centralizedFinancialAdmin';
import {
  Contribution,
  ContributionAssignment,
  Expense,
  GroupMember,
  Payment,
  PaymentCommitment,
} from '../types';

describe('Authoritative Financial Config, Integrity Repair, Reversals & RBAC', () => {
  test('1. Single authoritative stove rate constants match specification', () => {
    assert.equal(RATES.electric, 10000);
    assert.equal(RATES.non_electric, 5000);
    assert.equal(RATE_CONFIG_VERSION, '2026.1');
    assert.equal(getRateForStoveType('electric'), 10000);
    assert.equal(getRateForStoveType('non_electric'), 5000);
    assert.equal(isValidStoveType('electric'), true);
    assert.equal(isValidStoveType('non_electric'), true);
    assert.equal(isValidStoveType('gas'), false);
    assert.equal(isValidStoveType(undefined), false);
  });

  test('2. Strict integer MWK parsing prevents decimals, negative numbers, letters, and string concatenation', () => {
    assert.deepEqual(parseMWKInput('10000'), { valid: true, value: 10000 });
    assert.deepEqual(parseMWKInput('MK 10,000'), { valid: true, value: 10000 });
    assert.deepEqual(parseMWKInput('MWK 5 000'), { valid: true, value: 5000 });
    assert.equal(parseMWKInput('1000.50').valid, false);
    assert.equal(parseMWKInput(1000.5).valid, false);
    assert.equal(parseMWKInput('-5000').valid, false);
    assert.equal(parseMWKInput('0').valid, false);
    assert.deepEqual(parseMWKInput('0', { allowZero: true }), { valid: true, value: 0 });
    assert.equal(parseMWKInput('abc').valid, false);

    // Prevent JS string concatenation bug ("1000" + "5000" -> 6000, never "10005000")
    const a: unknown = '1000';
    const b: unknown = '5000';
    assert.equal(toSafeIntMWK(a) + toSafeIntMWK(b), 6000);
  });

  test('3. Channel-aware transaction reference validation', () => {
    assert.equal(validateTransactionReference('airtel_money', '', false).valid, false);
    assert.equal(validateTransactionReference('airtel_money', '', true).valid, true);
    assert.equal(validateTransactionReference('airtel_money', 'AB', false).valid, false);
    assert.equal(validateTransactionReference('airtel_money', 'PP260329.1045.G19', false).valid, true);
    assert.equal(validateTransactionReference('airtel_money', 'REF WITH SPACE', false).valid, false);

    assert.equal(validateTransactionReference('tnm_mpamba', 'MP992817', false).valid, true);
    assert.equal(validateTransactionReference('bank_transfer', 'NBM-2026-0091', false).valid, true);
    assert.equal(validateTransactionReference('cash', '', false).valid, false);
    assert.equal(validateTransactionReference('cash', 'R-12', false).valid, true);
  });

  test('4. Payment lifecycles: only verified sums reduce balance; reversed/disputed/rejected/pending are excluded', () => {
    const assignment: ContributionAssignment = {
      id: 'asg_1',
      contributionId: 'cnt_1',
      groupId: 'grp_1',
      memberId: 'mem_1',
      assignedAmount: 10000,
      applicableRate: 10000,
      stoveTypeAtAssignment: 'electric',
      assignedDate: '2026-10-01T00:00:00Z',
      deadline: '2026-12-01T00:00:00Z',
      status: 'unpaid',
    };

    const payments: Payment[] = [
      {
        id: 'p_verified',
        assignmentId: 'asg_1',
        contributionId: 'cnt_1',
        groupId: 'grp_1',
        memberId: 'mem_1',
        amountReceived: 4000,
        paymentDate: '2026-10-02T00:00:00Z',
        paymentMethod: 'airtel_money',
        transactionReference: 'AIR-1001',
        collectorId: 'adm_1',
        verificationStatus: 'verified',
        createdAt: '2026-10-02T00:00:00Z',
      },
      {
        id: 'p_pending',
        assignmentId: 'asg_1',
        contributionId: 'cnt_1',
        groupId: 'grp_1',
        memberId: 'mem_1',
        amountReceived: 3000,
        paymentDate: '2026-10-03T00:00:00Z',
        paymentMethod: 'tnm_mpamba',
        transactionReference: 'MP-1002',
        collectorId: 'adm_1',
        verificationStatus: 'pending_verification',
        createdAt: '2026-10-03T00:00:00Z',
      },
      {
        id: 'p_submitted',
        assignmentId: 'asg_1',
        contributionId: 'cnt_1',
        groupId: 'grp_1',
        memberId: 'mem_1',
        amountReceived: 1000,
        paymentDate: '2026-10-04T00:00:00Z',
        paymentMethod: 'cash',
        transactionReference: 'CSH-01',
        collectorId: 'adm_1',
        verificationStatus: 'submitted',
        createdAt: '2026-10-04T00:00:00Z',
      },
      {
        id: 'p_reversed',
        assignmentId: 'asg_1',
        contributionId: 'cnt_1',
        groupId: 'grp_1',
        memberId: 'mem_1',
        amountReceived: 6000,
        paymentDate: '2026-10-05T00:00:00Z',
        paymentMethod: 'airtel_money',
        transactionReference: 'AIR-1003',
        collectorId: 'adm_1',
        verificationStatus: 'reversed',
        reversalReason: 'Duplicate entry',
        createdAt: '2026-10-05T00:00:00Z',
      },
      {
        id: 'p_disputed',
        assignmentId: 'asg_1',
        contributionId: 'cnt_1',
        groupId: 'grp_1',
        memberId: 'mem_1',
        amountReceived: 2000,
        paymentDate: '2026-10-06T00:00:00Z',
        paymentMethod: 'bank_transfer',
        transactionReference: 'NBM-1004',
        collectorId: 'adm_1',
        verificationStatus: 'disputed',
        disputeReason: 'Amount mismatch',
        createdAt: '2026-10-06T00:00:00Z',
      },
    ];

    assert.equal(calculateVerifiedPaidForAssignment('asg_1', payments), 4000);
    assert.equal(calculatePendingPaidForAssignment('asg_1', payments), 4000);
    assert.equal(calculateReversedForAssignment('asg_1', payments), 6000);

    const breakdown = calculateAssignmentBreakdown(assignment, payments);
    assert.equal(breakdown.remaining, 6000);
    assert.equal(breakdown.overpaid, 0);
    assert.equal(breakdown.verifiedPaid, 4000);
    assert.equal(breakdown.pendingPaid, 4000);
    assert.equal(breakdown.reversedTotal, 6000);
  });

  test('5. Overpayment tracking & per-assignment summary prevents cross-member debt masking', () => {
    const assignments: ContributionAssignment[] = [
      {
        id: 'asg_a',
        contributionId: 'cnt_1',
        groupId: 'grp_1',
        memberId: 'mem_a',
        assignedAmount: 5000,
        assignedDate: '2026-10-01',
        deadline: '2026-12-01',
        status: 'fully_settled',
      },
      {
        id: 'asg_b',
        contributionId: 'cnt_1',
        groupId: 'grp_1',
        memberId: 'mem_b',
        assignedAmount: 10000,
        assignedDate: '2026-10-01',
        deadline: '2026-12-01',
        status: 'unpaid',
      },
    ];

    // Member A overpays by MK 3,000 (paid 8,000 on 5,000 obligation)
    // Member B has paid MK 0 on 10,000 obligation
    const payments: Payment[] = [
      {
        id: 'p_a',
        assignmentId: 'asg_a',
        contributionId: 'cnt_1',
        groupId: 'grp_1',
        memberId: 'mem_a',
        amountReceived: 8000,
        paymentDate: '2026-10-02',
        paymentMethod: 'cash',
        transactionReference: 'CSH-10',
        collectorId: 'adm_1',
        verificationStatus: 'verified',
        createdAt: '2026-10-02',
      },
    ];

    const overpaidCheck = calculateOutstandingBalance(5000, 8000);
    assert.equal(overpaidCheck.outstanding, 0);
    assert.equal(overpaidCheck.overpaid, 3000);
    assert.equal(overpaidCheck.credit, 3000);

    const summary = computeGroupFinancialSummary(assignments, payments, 12000);
    assert.equal(summary.totalExpected, 15000);
    assert.equal(summary.totalVerified, 8000);
    assert.equal(summary.totalOverpaid, 3000);
    // Member B's MK 10,000 debt is NOT masked by Member A's MK 3,000 overpayment
    assert.equal(summary.totalOutstanding, 10000);
    assert.equal(summary.remainingGroupFunds, -4000);
    assert.equal(formatSignedMWK(summary.remainingGroupFunds), '-MK 4,000');
  });

  test('6. Non-destructive integrity repair normalizes strings, flags missing stoveType & duplicates, preserves originals', () => {
    const members: GroupMember[] = [
      {
        id: 'm_electric',
        userId: 'm_electric',
        groupId: 'g1',
        name: 'Chisomo',
        email: 'chisomo@example.com',
        roleInGroup: 'member',
        stoveType: 'electric',
        joinedAt: '2026-01-01',
        status: 'active',
      },
      {
        id: 'm_missing_stove',
        userId: 'm_missing_stove',
        groupId: 'g1',
        name: 'Tadala',
        email: 'tadala@example.com',
        roleInGroup: 'member',
        joinedAt: '2026-01-01',
        status: 'active',
      },
    ];

    const contributions: Contribution[] = [
      {
        id: 'c_elec',
        groupId: 'g1',
        title: 'October Electricity',
        category: 'electricity',
        month: 10,
        year: 2026,
        totalTargetAmount: '15000' as unknown as number,
        deadline: '2026-10-31',
        status: 'active',
        createdAt: '2026-10-01',
      },
    ];

    const assignments: ContributionAssignment[] = [
      {
        id: 'a1',
        contributionId: 'c_elec',
        groupId: 'g1',
        memberId: 'm_electric',
        assignedAmount: 7500, // Mismatch vs MK 10,000 rate (must be flagged, NOT silently changed)
        assignedDate: '2026-10-01',
        deadline: '2026-10-31',
        status: 'partially_paid',
      },
    ];

    const payments: Payment[] = [
      {
        id: 'pay1',
        assignmentId: 'a1',
        contributionId: 'c_elec',
        groupId: 'g1',
        memberId: 'm_electric',
        amountReceived: '5000' as unknown as number,
        paymentDate: '2026-10-05',
        paymentMethod: 'airtel_money',
        transactionReference: 'AIR-DUP-99',
        collectorId: 'adm1',
        verificationStatus: 'verified',
        createdAt: '2026-10-05',
      },
      {
        id: 'pay2',
        assignmentId: 'a1',
        contributionId: 'c_elec',
        groupId: 'g1',
        memberId: 'm_electric',
        amountReceived: 1000,
        paymentDate: '2026-10-06',
        paymentMethod: 'airtel_money',
        transactionReference: 'AIR-DUP-99',
        collectorId: 'adm1',
        verificationStatus: 'verified',
        createdAt: '2026-10-06',
      },
    ];

    const commitments: PaymentCommitment[] = [
      {
        id: 'cmt1',
        assignmentId: 'a1',
        memberId: 'm_electric',
        groupId: 'g1',
        originalOutstandingAmount: 7500,
        currentOutstandingAmount: 7500, // Stale vs 6000 verified paid -> should sync to 1500
        commitmentDate: '2026-10-02',
        promisedDate: '2026-10-20',
        durationDays: 18,
        collectorId: 'adm1',
        status: 'active',
        memberConfirmed: true,
        extensionCount: 0,
      },
    ];

    const expenses: Expense[] = [];

    const result = auditAndRepairFinancialData({
      groupMembers: members,
      contributions,
      assignments,
      payments,
      commitments,
      expenses,
    });

    // Repaired counts: contribution target string, payment amount string, commitment balance sync
    assert.equal(result.contributions[0].totalTargetAmount, 15000);
    assert.equal(result.payments[0].amountReceived, 5000);
    assert.equal(result.commitments[0].currentOutstandingAmount, 1500);

    // Original assignment MK 7,500 preserved (not overwritten silently), stoveType never guessed
    assert.equal(result.assignments[0].assignedAmount, 7500);
    assert.equal(result.groupMembers[1].stoveType, undefined);
    assert.equal(result.groupMembers[1].stoveTypeReviewRequired, true);
    assert.ok(result.report.flaggedCount >= 3); // missing stove + duplicate ref + rate mismatch
  });

  test('7. Unified member resolution and RBAC permission helpers', () => {
    const gm: GroupMember[] = [
      {
        id: 'mem_42',
        userId: 'usr_42',
        groupId: 'g1',
        name: 'Yamikani Mwale',
        email: 'yamikani@example.com',
        roleInGroup: 'member',
        stoveType: 'non_electric',
        joinedAt: '2026-01-01',
        status: 'active',
      },
    ];

    const byMemberId = resolveMemberInfo('mem_42', gm, []);
    const byUserId = resolveMemberInfo('usr_42', gm, []);
    assert.equal(byMemberId?.name, 'Yamikani Mwale');
    assert.equal(byUserId?.stoveType, 'non_electric');
    assert.equal(resolveMemberInfo('non_existent', gm, []), null);

    // RBAC checks
    assert.equal(canUserManageGroup('super_admin'), true);
    assert.equal(canUserManageGroup('group_admin'), true);
    assert.equal(canUserManageGroup('treasurer'), false);
    assert.equal(canUserManageGroup('member'), false);

    assert.equal(canUserVerifyPayments('treasurer'), true);
    assert.equal(canUserVerifyPayments('member'), false);

    assert.equal(canUserReversePayments('super_admin'), true);
    assert.equal(canUserReversePayments('group_admin'), true);
    assert.equal(canUserReversePayments('treasurer'), false);

    assert.equal(canUserApproveExpenses('group_admin'), true);
    assert.equal(canUserApproveExpenses('treasurer'), false);
  });

  test('8. Legacy GroupMember normalization & Firestore payload sanitization preserve required schema fields', async () => {
    const {
      sanitizeForFirestore,
      normalizeGroupMemberForSync,
      mergeGroupMembersWithFallback,
    } = await import('./financialConfig');

    const cleaned = sanitizeForFirestore({
      id: 'pay_1',
      verifiedAt: null,
      rejectionReason: undefined,
      amountReceived: 5000,
      nested: { keep: 'ok', dropNull: null, dropUndef: undefined },
    });
    assert.deepEqual(cleaned, {
      id: 'pay_1',
      amountReceived: 5000,
      nested: { keep: 'ok' },
    });

    // Legacy member missing name, email, and userId resolved from user profile or safe defaults
    const legacyRemote = {
      id: 'usr_1794388328242',
      groupId: 'grp_1794388274416',
      userId: 'usr_1794388328242',
      roleInGroup: 'member',
      joinedAt: '2026-10-01T10:00:00Z',
      status: 'active',
    } as unknown as GroupMember;

    const normalized = normalizeGroupMemberForSync(legacyRemote, [
      { id: 'usr_1794388328242', name: 'Kondwani Banda', email: 'kondwani@example.com' },
    ]);
    assert.equal(normalized.name, 'Kondwani Banda');
    assert.equal(normalized.email, 'kondwani@example.com');
    assert.equal(normalized.userId, 'usr_1794388328242');

    // Merge remote legacy doc without wiping out existing local name/email
    const merged = mergeGroupMembersWithFallback(
      [
        {
          id: 'sDcFd9hsQzWfz7DxH8U890JAD203',
          userId: 'sDcFd9hsQzWfz7DxH8U890JAD203',
          groupId: 'grp_1794388274416',
          name: 'Chisomo Admin',
          email: 'cchilongo88@gmail.com',
          roleInGroup: 'admin',
          joinedAt: '2026-10-01T10:00:00Z',
          status: 'active',
        },
      ],
      [
        {
          id: 'sDcFd9hsQzWfz7DxH8U890JAD203',
          userId: 'sDcFd9hsQzWfz7DxH8U890JAD203',
          groupId: 'grp_1794388274416',
          roleInGroup: 'admin',
          joinedAt: '2026-10-01T10:00:00Z',
          status: 'active',
        } as unknown as GroupMember,
      ],
      []
    );
    assert.equal(merged[0].name, 'Chisomo Admin');
    assert.equal(merged[0].email, 'cchilongo88@gmail.com');
  });
});


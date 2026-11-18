import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getEffectiveGroupRole,
  canManageGroupRole,
  canVerifyPaymentsRole,
  resolveMemberForUser,
  getMemberFinancialSummary,
  validateLeaveGroupEligibility,
} from './centralizedFinancialAdmin';
import {
  auditAndRepairFinancialData,
  buildInviteUrl,
  extractInviteCodeFromUrl,
  generateJoinCode,
  isAccommodationGroup,
} from './financialConfig';
import { getGroupPreset, supportsAccommodationRates } from './groupPresets';
import { getLocaleStrings } from './i18n';
import { Contribution, ContributionAssignment, Group, GroupMember, Payment } from '../types';

describe('UNIT SPOT Multi-Group, Member Role, Invite & Non-Accommodation Workflows', () => {
  test('1. Presets distinguish accommodation vs general Malawian groups cleanly', () => {
    assert.equal(supportsAccommodationRates('house'), true);
    assert.equal(supportsAccommodationRates('hostel'), true);
    assert.equal(supportsAccommodationRates('family'), false);
    assert.equal(supportsAccommodationRates('savings_group'), false);
    assert.equal(supportsAccommodationRates('church'), false);
    assert.equal(supportsAccommodationRates('friends'), false);
    assert.equal(supportsAccommodationRates('event'), false);

    assert.equal(getGroupPreset('savings_group').defaultAllocationMode, 'percentage');
    assert.equal(getGroupPreset('house').defaultAllocationMode, 'stove_rate');
  });

  test('2. Non-accommodation groups do NOT trigger stove classification warnings in integrity audit', () => {
    const familyGroup: Group = {
      id: 'grp_family_1',
      name: 'Banda Family Fund',
      description: 'Monthly upkeep',
      category: 'family',
      adminId: 'uid_admin',
      memberUids: ['uid_admin', 'uid_mem1'],
      defaultCurrency: 'MWK',
      paymentRules: '',
      joinCode: 'US-FAM1-01',
      createdAt: '2026-03-01T00:00:00.000Z',
      memberCount: 2,
    };

    const members: GroupMember[] = [
      {
        id: 'mem_1',
        userId: 'uid_mem1',
        groupId: 'grp_family_1',
        name: 'Chisomo Banda',
        email: 'chisomo@example.com',
        roleInGroup: 'member',
        joinedAt: '2026-03-01T00:00:00.000Z',
        status: 'active',
      },
    ];

    const contribution: Contribution = {
      id: 'cnt_upkeep',
      groupId: 'grp_family_1',
      title: 'March Family Groceries',
      category: 'groceries',
      allocationMode: 'equal',
      month: 3,
      year: 2026,
      totalTargetAmount: 50000,
      deadline: '2026-03-31T23:59:59.000Z',
      status: 'active',
      createdAt: '2026-03-01T00:00:00.000Z',
    };

    assert.equal(isAccommodationGroup(familyGroup), false);
    const result = auditAndRepairFinancialData({
      groups: [familyGroup],
      groupMembers: members,
      contributions: [contribution],
      assignments: [],
      payments: [],
      commitments: [],
      expenses: [],
    });

    assert.equal(result.report.flaggedCount, 0);
    assert.equal(result.report.findings.length, 0);
    assert.equal(result.groupMembers[0].stoveTypeReviewRequired, undefined);
  });

  test('3. Effective group role resolves per-group (Admin in Group A, Ordinary Member in Group B)', () => {
    const groupA: Group = {
      id: 'grp_a',
      name: 'Area 47 House',
      description: 'Shared house',
      category: 'house',
      adminId: 'uid_alice',
      defaultCurrency: 'MWK',
      paymentRules: '',
      joinCode: 'US-AAAA-11',
      createdAt: '2026-01-01',
      memberCount: 2,
    };

    const groupB: Group = {
      id: 'grp_b',
      name: 'Chilimba Circle',
      description: 'Savings',
      category: 'savings_group',
      adminId: 'uid_bob',
      treasurerId: 'uid_charlie',
      defaultCurrency: 'MWK',
      paymentRules: '',
      joinCode: 'US-BBBB-22',
      createdAt: '2026-01-01',
      memberCount: 3,
    };

    const aliceUser = { id: 'uid_alice', email: 'alice@example.com', role: 'group_admin' as const };
    const charlieUser = { id: 'uid_charlie', email: 'charlie@example.com', role: 'group_admin' as const };

    assert.equal(getEffectiveGroupRole(aliceUser, groupA, []), 'admin');
    assert.equal(getEffectiveGroupRole(aliceUser, groupB, []), 'member');
    assert.equal(canManageGroupRole('admin'), true);
    assert.equal(canManageGroupRole('member'), false);
    assert.equal(getEffectiveGroupRole(charlieUser, groupB, []), 'treasurer');
    assert.equal(canVerifyPaymentsRole('treasurer'), true);
    assert.equal(canManageGroupRole('treasurer'), false);
  });

  test('4. Safe member account linking prevents claiming records linked to another UID', () => {
    const members: GroupMember[] = [
      {
        id: 'mem_pre_added',
        userId: 'mem_pre_added',
        groupId: 'grp_1',
        name: 'Tadala Mwale',
        email: 'tadala@example.com',
        roleInGroup: 'member',
        joinedAt: '2026-02-01',
        status: 'active',
      },
      {
        id: 'mem_already_linked',
        userId: 'mem_already_linked',
        linkedUserId: 'uid_real_owner',
        groupId: 'grp_1',
        name: 'Other Person',
        email: 'shared@example.com',
        roleInGroup: 'member',
        joinedAt: '2026-02-01',
        status: 'active',
      },
    ];

    const linked = resolveMemberForUser('uid_tadala', 'Tadala@Example.com', 'grp_1', members);
    assert.equal(linked?.id, 'mem_pre_added');

    const hijacked = resolveMemberForUser('uid_attacker', 'shared@example.com', 'grp_1', members);
    assert.equal(hijacked, null);
  });

  test('5. Pending verification payment proof never inflates verified paid totals', () => {
    const assignments: ContributionAssignment[] = [
      {
        id: 'asg_1',
        contributionId: 'cnt_1',
        groupId: 'grp_1',
        memberId: 'mem_1',
        assignedAmount: 20000,
        assignedDate: '2026-03-01',
        deadline: new Date(Date.now() + 86400000 * 5).toISOString(),
        status: 'pending_verification',
      },
    ];

    const payments: Payment[] = [
      {
        id: 'pay_pending_1',
        assignmentId: 'asg_1',
        contributionId: 'cnt_1',
        groupId: 'grp_1',
        memberId: 'mem_1',
        amountReceived: 20000,
        paymentDate: '2026-03-02',
        paymentMethod: 'airtel_money',
        transactionReference: 'PP260302.1122',
        collectorId: 'uid_mem1',
        submittedByMemberId: 'mem_1',
        verificationStatus: 'pending_verification',
        createdAt: '2026-03-02',
      },
    ];

    const summary = getMemberFinancialSummary('mem_1', assignments, payments);
    assert.equal(summary.totalExpected, 20000);
    assert.equal(summary.totalVerifiedPaid, 0);
    assert.equal(summary.totalOutstanding, 20000);
    assert.equal(summary.status, 'unpaid');
  });

  test('6. Invite URL parsing and bilingual locale dictionary behave consistently', () => {
    const code = generateJoinCode('US');
    const url = buildInviteUrl(code, 'https://unitspot.example');
    assert.equal(extractInviteCodeFromUrl(url), code);
    assert.equal(extractInviteCodeFromUrl('#group=grp_1&code=us-demo-99'), 'US-DEMO-99');

    const en = getLocaleStrings('en');
    const ny = getLocaleStrings('ny');
    assert.ok(en.landing.heroHeadline.includes('No confusion'));
    assert.ok(ny.landing.heroHeadline.includes('Palibe chisokonezo'));
  });

  test('7. Leave-group eligibility enforces sole-admin handover, archive fallback, and joined successor UID', () => {
    const baseGroup: Group = {
      id: 'grp_leave',
      name: 'Area 25 House',
      description: 'Shared bills',
      category: 'house',
      adminId: 'uid_admin',
      treasurerId: 'uid_treasurer',
      memberUids: ['uid_admin', 'uid_treasurer'],
      defaultCurrency: 'MWK',
      paymentRules: '',
      joinCode: 'US-ABCDE-FGHIJ',
      createdAt: '2026-01-01',
      memberCount: 3,
    };

    const unjoinedPreAdded: GroupMember = {
      id: 'mem_pre',
      userId: 'mem_pre',
      groupId: 'grp_leave',
      name: 'Pre-added Unjoined',
      email: 'pre@example.com',
      roleInGroup: 'member',
      joinedAt: '2026-01-01',
      status: 'active',
    };

    const joinedMember: GroupMember = {
      id: 'uid_treasurer',
      userId: 'uid_treasurer',
      linkedUserId: 'uid_treasurer',
      groupId: 'grp_leave',
      name: 'Chisomo Treasurer',
      email: 'treasurer@example.com',
      roleInGroup: 'treasurer',
      joinedAt: '2026-01-01',
      status: 'active',
    };

    const adminRecord: GroupMember = {
      id: 'uid_admin',
      userId: 'uid_admin',
      linkedUserId: 'uid_admin',
      groupId: 'grp_leave',
      name: 'Main Admin',
      email: 'admin@example.com',
      roleInGroup: 'admin',
      joinedAt: '2026-01-01',
      status: 'active',
    };

    // Sole admin with zero other members must archive rather than abandon
    const soleMemberAttempt = validateLeaveGroupEligibility({
      userId: 'uid_admin',
      group: baseGroup,
      groupMembers: [adminRecord],
    });
    assert.equal(soleMemberAttempt.allowed, false);
    assert.equal(soleMemberAttempt.requiresTransfer, true);
    assert.match(soleMemberAttempt.error || '', /Archive/i);

    // Sole admin without selected successor is blocked
    const noSuccessorAttempt = validateLeaveGroupEligibility({
      userId: 'uid_admin',
      group: baseGroup,
      groupMembers: [adminRecord, joinedMember],
    });
    assert.equal(noSuccessorAttempt.allowed, false);
    assert.equal(noSuccessorAttempt.requiresTransfer, true);

    // Cannot transfer admin ownership to a pre-added member with synthetic mem_ ID (no real Auth UID)
    const unjoinedSuccessorAttempt = validateLeaveGroupEligibility({
      userId: 'uid_admin',
      group: baseGroup,
      groupMembers: [adminRecord, unjoinedPreAdded, joinedMember],
      transferToMemberId: 'mem_pre',
    });
    assert.equal(unjoinedSuccessorAttempt.allowed, false);
    assert.match(unjoinedSuccessorAttempt.error || '', /not signed in/i);

    // Selecting an active joined member succeeds and returns nextAdminMember
    const validHandover = validateLeaveGroupEligibility({
      userId: 'uid_admin',
      group: baseGroup,
      groupMembers: [adminRecord, unjoinedPreAdded, joinedMember],
      transferToMemberId: 'uid_treasurer',
    });
    assert.equal(validHandover.allowed, true);
    assert.equal(validHandover.nextAdminMember?.id, 'uid_treasurer');

    // Ordinary / treasurer member can leave freely without transfer
    const regularLeave = validateLeaveGroupEligibility({
      userId: 'uid_treasurer',
      group: baseGroup,
      groupMembers: [adminRecord, joinedMember],
    });
    assert.equal(regularLeave.allowed, true);
  });
});

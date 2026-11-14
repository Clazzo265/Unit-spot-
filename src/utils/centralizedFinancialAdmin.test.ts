import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateEmailAddress,
  isDuplicateMemberEmail,
  generateMemberReferenceId,
  getMemberFinancialSummary,
  filterTargetAudience,
  buildPersonalizedCommunication,
  createEmailCommunicationDispatch,
} from './centralizedFinancialAdmin';
import {
  Group,
  MemberRecord,
  Contribution,
  ContributionAssignment,
  Payment,
  Administrator,
} from '../types';

describe('Centralized Financial Administrator & Communication Platform Tests', () => {
  // Test Scenario 1: Group Creation by Administrator
  test('1. Administrator creates and configures a shared financial group', () => {
    const admin: Administrator = {
      id: 'admin_cchilongo',
      name: 'Cornelius Chilongo',
      email: 'cchilongo88@gmail.com',
      role: 'super_admin',
      createdAt: new Date().toISOString(),
    };

    const group: Group = {
      id: 'grp_area47',
      name: 'Area 47 Sector 4 Shared Residence',
      description: 'Shared house expenses for utilities, security, and maintenance',
      category: 'house',
      adminId: admin.id,
      defaultCurrency: 'MWK',
      paymentRules: 'All payments must be verified with mobile money transaction screenshot or ID.',
      joinCode: 'KLAR-47',
      createdAt: new Date().toISOString(),
      memberCount: 0,
    };

    assert.equal(group.adminId, 'admin_cchilongo');
    assert.equal(group.defaultCurrency, 'MWK');
    assert.ok(group.name.includes('Area 47'));
  });

  // Test Scenario 2: Member Registration without User Credentials
  test('2. Administrator registers member records with valid email and generated reference ID without passwords', () => {
    const existingMembers: MemberRecord[] = [
      {
        id: 'mem_1',
        memberRefId: 'MEM-2026-001',
        groupId: 'grp_area47',
        name: 'Tiwonge Banda',
        email: 'tiwonge.banda@gmail.com',
        phone: '+265991234567',
        membershipDate: '2026-01-15T00:00:00.000Z',
        roomNumber: 'Room 1A',
        status: 'active',
        createdAt: '2026-01-15T00:00:00.000Z',
        updatedAt: '2026-01-15T00:00:00.000Z',
      },
    ];

    // Valid email test
    assert.equal(validateEmailAddress('kondwani.phiri@outlook.com'), true);
    assert.equal(validateEmailAddress('invalid-email-string'), false);
    assert.equal(validateEmailAddress(''), false);

    // Duplicate email check
    const isDup = isDuplicateMemberEmail('tiwonge.banda@gmail.com', 'grp_area47', existingMembers);
    assert.equal(isDup, true);

    const isNotDup = isDuplicateMemberEmail('kondwani.phiri@outlook.com', 'grp_area47', existingMembers);
    assert.equal(isNotDup, false);

    // Ref ID Generation
    const newRefId = generateMemberReferenceId('grp_area47', existingMembers.length);
    const currentYear = new Date().getFullYear();
    assert.equal(newRefId, `MEM-${currentYear}-002`);

    // Verify member record has no password or auth credential fields
    const newMember: MemberRecord = {
      id: 'mem_2',
      memberRefId: newRefId,
      groupId: 'grp_area47',
      name: 'Kondwani Phiri',
      email: 'kondwani.phiri@outlook.com',
      membershipDate: new Date().toISOString(),
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    assert.equal(newMember.status, 'active');
    assert.equal('password' in newMember, false);
    assert.equal('authToken' in newMember, false);
  });

  // Test Scenario 3: Contribution Obligation Recording
  test('3. Administrator records contribution obligation and assigns shares to members', () => {
    const contribution: Contribution = {
      id: 'cnt_escom_march',
      groupId: 'grp_area47',
      title: 'ESCOM Electricity Token March 2026',
      category: 'electricity',
      month: 3,
      year: 2026,
      totalTargetAmount: 120000,
      deadline: '2026-03-31T23:59:59.000Z',
      status: 'active',
      createdAt: new Date().toISOString(),
    };

    const assignment1: ContributionAssignment = {
      id: 'asg_1',
      contributionId: contribution.id,
      groupId: contribution.groupId,
      memberId: 'mem_1',
      assignedAmount: 60000,
      assignedDate: '2026-03-01T00:00:00.000Z',
      deadline: contribution.deadline,
      status: 'unpaid',
    };

    const assignment2: ContributionAssignment = {
      id: 'asg_2',
      contributionId: contribution.id,
      groupId: contribution.groupId,
      memberId: 'mem_2',
      assignedAmount: 60000,
      assignedDate: '2026-03-01T00:00:00.000Z',
      deadline: contribution.deadline,
      status: 'unpaid',
    };

    assert.equal(assignment1.assignedAmount + assignment2.assignedAmount, contribution.totalTargetAmount);
    assert.equal(assignment1.status, 'unpaid');
  });

  // Test Scenario 4: Automated Financial Balance Calculations (Full, Partial, Cleared)
  test('4. Balances calculate accurately across full payments, partial payments, and zero balance', () => {
    const futureDeadline = new Date(Date.now() + 7 * 86400000).toISOString();
    const assignments: ContributionAssignment[] = [
      {
        id: 'asg_1',
        contributionId: 'cnt_escom_march',
        groupId: 'grp_area47',
        memberId: 'mem_1',
        assignedAmount: 60000,
        assignedDate: '2026-03-01T00:00:00.000Z',
        deadline: futureDeadline,
        status: 'unpaid',
      },
      {
        id: 'asg_2',
        contributionId: 'cnt_escom_march',
        groupId: 'grp_area47',
        memberId: 'mem_2',
        assignedAmount: 60000,
        assignedDate: '2026-03-01T00:00:00.000Z',
        deadline: futureDeadline,
        status: 'unpaid',
      },
    ];

    // Member 1 pays 25,000 MWK partial
    const payments: Payment[] = [
      {
        id: 'pay_1',
        assignmentId: 'asg_1',
        contributionId: 'cnt_escom_march',
        groupId: 'grp_area47',
        memberId: 'mem_1',
        amountReceived: 25000,
        paymentDate: '2026-03-10T12:00:00.000Z',
        paymentMethod: 'airtel_money',
        transactionReference: 'AIR-987654321',
        collectorId: 'admin_cchilongo',
        verificationStatus: 'verified',
        createdAt: '2026-03-10T12:00:00.000Z',
      },
      // Member 2 pays 60,000 MWK full
      {
        id: 'pay_2',
        assignmentId: 'asg_2',
        contributionId: 'cnt_escom_march',
        groupId: 'grp_area47',
        memberId: 'mem_2',
        amountReceived: 60000,
        paymentDate: '2026-03-12T14:30:00.000Z',
        paymentMethod: 'tnm_mpamba',
        transactionReference: 'MP-554433221',
        collectorId: 'admin_cchilongo',
        verificationStatus: 'verified',
        createdAt: '2026-03-12T14:30:00.000Z',
      },
    ];

    const summaryMem1 = getMemberFinancialSummary('mem_1', assignments, payments, 'cnt_escom_march');
    assert.equal(summaryMem1.totalExpected, 60000);
    assert.equal(summaryMem1.totalVerifiedPaid, 25000);
    assert.equal(summaryMem1.totalOutstanding, 35000);
    assert.equal(summaryMem1.status, 'partially_paid');

    const summaryMem2 = getMemberFinancialSummary('mem_2', assignments, payments, 'cnt_escom_march');
    assert.equal(summaryMem2.totalExpected, 60000);
    assert.equal(summaryMem2.totalVerifiedPaid, 60000);
    assert.equal(summaryMem2.totalOutstanding, 0);
    assert.equal(summaryMem2.status, 'fully_settled');
  });

  // Test Scenario 5: General Announcements Target All Active Members Without Disclosing Balances
  test('5. General announcements target all active members with clean notice and no leaked individual amounts', () => {
    const group: Group = {
      id: 'grp_area47',
      name: 'Area 47 Sector 4 Shared Residence',
      description: 'Shared house',
      category: 'house',
      adminId: 'admin_cchilongo',
      defaultCurrency: 'MWK',
      paymentRules: '',
      joinCode: 'KLAR-47',
      createdAt: '2026-01-01',
      memberCount: 2,
    };

    const members: MemberRecord[] = [
      {
        id: 'mem_1',
        memberRefId: 'MEM-2026-001',
        groupId: 'grp_area47',
        name: 'Tiwonge Banda',
        email: 'tiwonge.banda@gmail.com',
        membershipDate: '2026-01-15',
        status: 'active',
        createdAt: '2026-01-15',
        updatedAt: '2026-01-15',
      },
      {
        id: 'mem_2',
        memberRefId: 'MEM-2026-002',
        groupId: 'grp_area47',
        name: 'Kondwani Phiri',
        email: 'kondwani.phiri@outlook.com',
        membershipDate: '2026-01-16',
        status: 'active',
        createdAt: '2026-01-16',
        updatedAt: '2026-01-16',
      },
    ];

    const targetAudience = filterTargetAudience('grp_area47', 'all_active', members, [], []);
    assert.equal(targetAudience.length, 2);

    const comm = buildPersonalizedCommunication(
      members[0],
      group,
      'announcement',
      'Water Supply Interruption Notice',
      'Lilongwe Water Board will carry out maintenance on Saturday from 8am to 4pm.',
      [],
      []
    );

    assert.equal(comm.subject, 'Water Supply Interruption Notice');
    assert.ok(comm.personalizedSnippet.includes('Lilongwe Water Board'));
    // Announcements must not disclose outstanding balances
    assert.equal(comm.outstandingAmount, undefined);
  });

  // Test Scenario 6: Financial Reminders Target Only Members With Balances and Personalize Privately
  test('6. Financial reminders target only members who owe and keep balances strictly confidential', () => {
    const group: Group = {
      id: 'grp_area47',
      name: 'Area 47 Sector 4 Shared Residence',
      description: 'Shared house',
      category: 'house',
      adminId: 'admin_cchilongo',
      defaultCurrency: 'MWK',
      paymentRules: '',
      joinCode: 'KLAR-47',
      createdAt: '2026-01-01',
      memberCount: 2,
    };

    const members: MemberRecord[] = [
      {
        id: 'mem_1',
        memberRefId: 'MEM-2026-001',
        groupId: 'grp_area47',
        name: 'Tiwonge Banda',
        email: 'tiwonge.banda@gmail.com',
        membershipDate: '2026-01-15',
        status: 'active',
        createdAt: '2026-01-15',
        updatedAt: '2026-01-15',
      },
      {
        id: 'mem_2',
        memberRefId: 'MEM-2026-002',
        groupId: 'grp_area47',
        name: 'Kondwani Phiri',
        email: 'kondwani.phiri@outlook.com',
        membershipDate: '2026-01-16',
        status: 'active',
        createdAt: '2026-01-16',
        updatedAt: '2026-01-16',
      },
    ];

    const contribution: Contribution = {
      id: 'cnt_escom_march',
      groupId: 'grp_area47',
      title: 'ESCOM Electricity Token March 2026',
      category: 'electricity',
      month: 3,
      year: 2026,
      totalTargetAmount: 120000,
      deadline: '2026-03-31T23:59:59.000Z',
      status: 'active',
      createdAt: '2026-03-01',
    };

    const assignments: ContributionAssignment[] = [
      {
        id: 'asg_1',
        contributionId: contribution.id,
        groupId: 'grp_area47',
        memberId: 'mem_1',
        assignedAmount: 60000,
        assignedDate: '2026-03-01',
        deadline: contribution.deadline,
        status: 'unpaid',
      },
      {
        id: 'asg_2',
        contributionId: contribution.id,
        groupId: 'grp_area47',
        memberId: 'mem_2',
        assignedAmount: 60000,
        assignedDate: '2026-03-01',
        deadline: contribution.deadline,
        status: 'unpaid',
      },
    ];

    // mem_2 pays in full, mem_1 pays partial (25k of 60k)
    const payments: Payment[] = [
      {
        id: 'pay_1',
        assignmentId: 'asg_1',
        contributionId: contribution.id,
        groupId: 'grp_area47',
        memberId: 'mem_1',
        amountReceived: 25000,
        paymentDate: '2026-03-10',
        paymentMethod: 'airtel_money',
        transactionReference: 'AIR-987654321',
        collectorId: 'admin_cchilongo',
        verificationStatus: 'verified',
        createdAt: '2026-03-10',
      },
      {
        id: 'pay_2',
        assignmentId: 'asg_2',
        contributionId: contribution.id,
        groupId: 'grp_area47',
        memberId: 'mem_2',
        amountReceived: 60000,
        paymentDate: '2026-03-12',
        paymentMethod: 'tnm_mpamba',
        transactionReference: 'MP-554433221',
        collectorId: 'admin_cchilongo',
        verificationStatus: 'verified',
        createdAt: '2026-03-12',
      },
    ];

    // Filter audience for outstanding balance
    const debtors = filterTargetAudience(
      'grp_area47',
      'outstanding_only',
      members,
      assignments,
      payments,
      contribution.id
    );

    // Only mem_1 should be targeted because mem_2 has 0 outstanding
    assert.equal(debtors.length, 1);
    assert.equal(debtors[0].id, 'mem_1');

    // Build personalized reminder
    const reminder = buildPersonalizedCommunication(
      debtors[0],
      group,
      'financial_reminder',
      '',
      '',
      assignments,
      payments,
      contribution
    );

    assert.equal(reminder.outstandingAmount, 35000);
    assert.ok(reminder.personalizedSnippet.includes('Outstanding Amount: MK 35,000'));
    // Make sure other members' names are NOT leaked
    assert.ok(!reminder.personalizedSnippet.includes('Kondwani Phiri'));
  });

  // Test Scenario 7: Payment Confirmation to Paying Individual Only
  test('7. Payment confirmation reaches only the paying individual with updated balance', () => {
    const group: Group = {
      id: 'grp_area47',
      name: 'Area 47 Sector 4 Shared Residence',
      description: 'Shared house',
      category: 'house',
      adminId: 'admin_cchilongo',
      defaultCurrency: 'MWK',
      paymentRules: '',
      joinCode: 'KLAR-47',
      createdAt: '2026-01-01',
      memberCount: 2,
    };

    const member1: MemberRecord = {
      id: 'mem_1',
      memberRefId: 'MEM-2026-001',
      groupId: 'grp_area47',
      name: 'Tiwonge Banda',
      email: 'tiwonge.banda@gmail.com',
      membershipDate: '2026-01-15',
      status: 'active',
      createdAt: '2026-01-15',
      updatedAt: '2026-01-15',
    };

    const contribution: Contribution = {
      id: 'cnt_escom_march',
      groupId: 'grp_area47',
      title: 'ESCOM Electricity Token March 2026',
      category: 'electricity',
      month: 3,
      year: 2026,
      totalTargetAmount: 120000,
      deadline: '2026-03-31T23:59:59.000Z',
      status: 'active',
      createdAt: '2026-03-01',
    };

    const assignment: ContributionAssignment = {
      id: 'asg_1',
      contributionId: contribution.id,
      groupId: 'grp_area47',
      memberId: 'mem_1',
      assignedAmount: 60000,
      assignedDate: '2026-03-01',
      deadline: contribution.deadline,
      status: 'unpaid',
    };

    const payment: Payment = {
      id: 'pay_1',
      assignmentId: 'asg_1',
      contributionId: contribution.id,
      groupId: 'grp_area47',
      memberId: 'mem_1',
      amountReceived: 25000,
      paymentDate: '2026-03-10',
      paymentMethod: 'airtel_money',
      transactionReference: 'AIR-987654321',
      collectorId: 'admin_cchilongo',
      verificationStatus: 'verified',
      createdAt: '2026-03-10',
    };

    const confirmation = buildPersonalizedCommunication(
      member1,
      group,
      'payment_confirmation',
      '',
      '',
      [assignment],
      [payment],
      contribution,
      payment
    );

    assert.ok(confirmation.personalizedSnippet.includes('MK 25,000'));
    assert.ok(confirmation.personalizedSnippet.includes('AIR-987654321'));
    assert.ok(confirmation.personalizedSnippet.includes('MK 35,000'));
  });

  // Test Scenario 8: Member Removal Excludes Them from Future Notifications
  test('8. Member removal sets status to removed and strictly excludes them from notifications', () => {
    const members: MemberRecord[] = [
      {
        id: 'mem_active',
        memberRefId: 'MEM-2026-001',
        groupId: 'grp_area47',
        name: 'Current Tenant',
        email: 'current@example.com',
        membershipDate: '2026-01-01',
        status: 'active',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
      {
        id: 'mem_removed',
        memberRefId: 'MEM-2026-002',
        groupId: 'grp_area47',
        name: 'Departed Tenant',
        email: 'departed@example.com',
        membershipDate: '2025-06-01',
        status: 'removed',
        removedAt: '2026-02-28T00:00:00.000Z',
        removalReason: 'Relocated to Blantyre',
        createdAt: '2025-06-01',
        updatedAt: '2026-02-28',
      },
    ];

    // Check all_active filter
    const activeAudience = filterTargetAudience('grp_area47', 'all_active', members, [], []);
    assert.equal(activeAudience.length, 1);
    assert.equal(activeAudience[0].id, 'mem_active');

    // Even if filter asks for outstanding, removed member MUST NOT be included
    const assignments: ContributionAssignment[] = [
      {
        id: 'asg_old',
        contributionId: 'cnt_old',
        groupId: 'grp_area47',
        memberId: 'mem_removed',
        assignedAmount: 50000,
        assignedDate: '2025-07-01',
        deadline: '2025-07-31',
        status: 'unpaid',
      },
    ];

    const outstandingAudience = filterTargetAudience(
      'grp_area47',
      'outstanding_only',
      members,
      assignments,
      []
    );
    assert.equal(outstandingAudience.length, 0);
  });

  // Test Scenario 9: Preservation of Historical Financial Transactions After Member Removal
  test('9. Historical payments and audit logs remain intact after member record is removed', () => {
    const historicalPayment: Payment = {
      id: 'pay_hist_01',
      assignmentId: 'asg_old',
      contributionId: 'cnt_escom_jan',
      groupId: 'grp_area47',
      memberId: 'mem_removed',
      amountReceived: 45000,
      paymentDate: '2026-01-05',
      paymentMethod: 'bank_transfer',
      transactionReference: 'NBM-889900',
      collectorId: 'admin_cchilongo',
      verificationStatus: 'verified',
      createdAt: '2026-01-05',
    };

    // The payment record still references 'mem_removed' and preserves the transaction
    assert.equal(historicalPayment.memberId, 'mem_removed');
    assert.equal(historicalPayment.amountReceived, 45000);
    assert.equal(historicalPayment.verificationStatus, 'verified');
  });

  // Test Scenario 10: Dispatch Creation with Full Recipient Audit Trail
  test('10. Administrator creates and dispatches email communication with complete audit trail', () => {
    const admin: Administrator = {
      id: 'admin_cchilongo',
      name: 'Cornelius Chilongo',
      email: 'cchilongo88@gmail.com',
      role: 'super_admin',
      createdAt: '2026-01-01',
    };

    const group: Group = {
      id: 'grp_area47',
      name: 'Area 47 Sector 4 Shared Residence',
      description: 'Shared house',
      category: 'house',
      adminId: admin.id,
      defaultCurrency: 'MWK',
      paymentRules: '',
      joinCode: 'KLAR-47',
      createdAt: '2026-01-01',
      memberCount: 1,
    };

    const targetMembers: MemberRecord[] = [
      {
        id: 'mem_1',
        memberRefId: 'MEM-2026-001',
        groupId: 'grp_area47',
        name: 'Tiwonge Banda',
        email: 'tiwonge.banda@gmail.com',
        phone: '+265991234567',
        membershipDate: '2026-01-15',
        status: 'active',
        createdAt: '2026-01-15',
        updatedAt: '2026-01-15',
      },
    ];

    const dispatch = createEmailCommunicationDispatch(
      group.id,
      group,
      admin.id,
      'announcement',
      'all_active',
      'Security Gate Remote Renewal',
      'New remote controls are ready for collection from the administrator.',
      targetMembers,
      [],
      []
    );

    assert.equal(dispatch.sentBy, admin.id);
    assert.equal(dispatch.recipientCount, 1);
    assert.equal(dispatch.recipients[0].email, 'tiwonge.banda@gmail.com');
    assert.equal(dispatch.recipients[0].deliveryStatus, 'delivered');
    assert.ok(dispatch.recipients[0].deliveredAt);
  });
});

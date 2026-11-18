import {
  MemberRecord,
  Group,
  GroupMember,
  Contribution,
  ContributionAssignment,
  Payment,
  AudienceType,
  CommunicationRecipient,
  CommunicationType,
  EmailCommunication,
  AdministratorRole,
  Administrator,
} from '../types';
import { formatMWK, calculateVerifiedPaidForAssignment } from './financialCalculations';
import { toSafeIntMWK } from './financialConfig';

export type EffectiveGroupRole = 'admin' | 'treasurer' | 'member';

/**
 * Validates email format with standard regex
 */
export function validateEmailAddress(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email.trim().toLowerCase());
}

/**
 * Checks for duplicate member email within the same group (excluding removed/departed)
 */
export function isDuplicateMemberEmail(
  email: string,
  groupId: string,
  members: MemberRecord[],
  excludeMemberId?: string
): boolean {
  const normalized = email.trim().toLowerCase();
  return members.some(
    (m) =>
      m.groupId === groupId &&
      m.email.trim().toLowerCase() === normalized &&
      m.id !== excludeMemberId &&
      m.status !== 'removed' &&
      m.status !== 'departed'
  );
}

/**
 * Generates an administrator reference ID for a new member record
 */
export function generateMemberReferenceId(_groupId: string, membersInGroupCount: number): string {
  const year = new Date().getFullYear();
  const sequence = String(membersInGroupCount + 1).padStart(3, '0');
  return `MEM-${year}-${sequence}`;
}

/**
 * Resolve a user's effective role inside a specific group strictly by Firebase UID.
 * Zero global privilege assumptions and zero email-based role escalation.
 */
export function getEffectiveGroupRole(
  user: Pick<Administrator, 'id' | 'email' | 'role'> | null | undefined,
  group: Pick<Group, 'id' | 'adminId' | 'treasurerId'> | null | undefined,
  groupMembers: GroupMember[] = []
): EffectiveGroupRole {
  if (!user || !group) return 'member';

  if (group.adminId === user.id) return 'admin';
  if (group.treasurerId === user.id) return 'treasurer';

  const membership = groupMembers.find(
    (m) =>
      m.groupId === group.id &&
      m.status === 'active' &&
      (m.linkedUserId === user.id || m.userId === user.id || m.id === user.id)
  );

  if (membership?.roleInGroup === 'admin') return 'admin';
  if (membership?.roleInGroup === 'treasurer') return 'treasurer';
  return 'member';
}

export function canManageGroupRole(role: EffectiveGroupRole | AdministratorRole | undefined): boolean {
  return role === 'admin' || role === 'group_admin';
}

export function canVerifyPaymentsRole(role: EffectiveGroupRole | AdministratorRole | undefined): boolean {
  return role === 'admin' || role === 'group_admin' || role === 'treasurer';
}

/**
 * Safely resolve the matching active GroupMember record for an authenticated user in a group.
 * Guards against claiming a record already linked to a different Firebase Auth UID.
 */
export function resolveMemberForUser(
  uid: string | undefined,
  email: string | undefined,
  groupId: string | undefined,
  groupMembers: GroupMember[]
): GroupMember | null {
  if (!uid || !groupId) return null;
  const scoped = groupMembers.filter(
    (m) => m.groupId === groupId && m.status !== 'removed' && m.status !== 'departed'
  );

  // 1. Direct UID match
  const direct = scoped.find(
    (m) => m.linkedUserId === uid || m.userId === uid || m.id === uid
  );
  if (direct) return direct;

  // 2. Active unlinked email match (when admin pre-registered member by email)
  const normalizedEmail = (email || '').trim().toLowerCase();
  if (!normalizedEmail) return null;

  const emailMatch = scoped.find((m) => {
    if ((m.email || '').trim().toLowerCase() !== normalizedEmail) return false;
    // Do not hijack a record already explicitly linked to another real UID
    if (m.linkedUserId && m.linkedUserId !== uid) return false;
    return true;
  });

  return emailMatch || null;
}

/**
 * Role-based permission checks for administrative & financial mutations
 */
export function canUserManageGroup(role: AdministratorRole | undefined): boolean {
  return role === 'group_admin';
}

export function canUserVerifyPayments(role: AdministratorRole | undefined): boolean {
  return role === 'group_admin' || role === 'treasurer';
}

export function canUserReversePayments(role: AdministratorRole | undefined): boolean {
  return role === 'group_admin';
}

export function canUserApproveExpenses(role: AdministratorRole | undefined): boolean {
  return role === 'group_admin';
}

/**
 * Validates whether a user can voluntarily leave a group, enforcing sole-admin handover guard.
 */
export function validateLeaveGroupEligibility(params: {
  userId: string;
  group: Pick<Group, 'id' | 'adminId' | 'treasurerId' | 'memberUids' | 'status'> | undefined;
  groupMembers: GroupMember[];
  transferToMemberId?: string;
}): {
  allowed: boolean;
  error?: string;
  requiresTransfer?: boolean;
  departingMember?: GroupMember;
  nextAdminMember?: GroupMember;
  otherActiveMembers: GroupMember[];
} {
  const { userId, group, groupMembers, transferToMemberId } = params;
  if (!userId || !group) {
    return { allowed: false, error: 'Group not found.', otherActiveMembers: [] };
  }

  const activeInGroup = groupMembers.filter(
    (m) => m.groupId === group.id && m.status === 'active'
  );
  const departingMember = activeInGroup.find(
    (m) => m.linkedUserId === userId || m.userId === userId || m.id === userId
  );
  const otherActiveMembers = activeInGroup.filter((m) => {
    const uid = m.linkedUserId || (!m.userId.startsWith('mem_') ? m.userId : m.id);
    return m.id !== departingMember?.id && uid !== userId;
  });

  const isMemberByGroupField =
    group.adminId === userId ||
    group.treasurerId === userId ||
    (Array.isArray(group.memberUids) && group.memberUids.includes(userId));

  if (!departingMember && !isMemberByGroupField) {
    return {
      allowed: false,
      error: 'You are not an active member of this group.',
      otherActiveMembers,
    };
  }

  const otherActiveAdmins = otherActiveMembers.filter((m) => m.roleInGroup === 'admin');
  const isSolePrimaryAdmin = group.adminId === userId && otherActiveAdmins.length === 0;

  if (isSolePrimaryAdmin) {
    if (!transferToMemberId) {
      if (otherActiveMembers.length === 0) {
        return {
          allowed: false,
          requiresTransfer: true,
          error:
            'You are the only active member and administrator of this group. Archive the group instead of leaving.',
          departingMember,
          otherActiveMembers,
        };
      }
      return {
        allowed: false,
        requiresTransfer: true,
        error:
          'You are the sole group administrator. Select an active member to receive admin ownership before leaving.',
        departingMember,
        otherActiveMembers,
      };
    }

    const successor = otherActiveMembers.find(
      (m) => m.id === transferToMemberId || m.userId === transferToMemberId || m.linkedUserId === transferToMemberId
    );
    if (!successor) {
      return {
        allowed: false,
        requiresTransfer: true,
        error: 'Selected new administrator must be an active member of this group.',
        departingMember,
        otherActiveMembers,
      };
    }

    const successorUid = successor.linkedUserId || successor.userId;
    if (!successorUid || successorUid.startsWith('mem_')) {
      return {
        allowed: false,
        requiresTransfer: true,
        error:
          'Selected member has not signed in to an account yet. Choose a member who has joined the app, or ask them to sign in first.',
        departingMember,
        otherActiveMembers,
      };
    }

    return {
      allowed: true,
      departingMember,
      nextAdminMember: successor,
      otherActiveMembers,
    };
  }

  // Group has another active admin if current admin is stepping away
  const fallbackNextAdmin =
    group.adminId === userId ? otherActiveAdmins[0] : undefined;

  return {
    allowed: true,
    departingMember,
    nextAdminMember: fallbackNextAdmin,
    otherActiveMembers,
  };
}

/**
 * Calculates current member financial balance across a group or specific contribution
 */
export function getMemberFinancialSummary(
  memberId: string,
  assignments: ContributionAssignment[],
  payments: Payment[],
  contributionId?: string
): {
  totalExpected: number;
  totalVerifiedPaid: number;
  totalOutstanding: number;
  totalOverpaid: number;
  isOverdue: boolean;
  status: 'fully_settled' | 'partially_paid' | 'unpaid' | 'overdue';
} {
  const filteredAssignments = assignments.filter((a) => {
    if (a.memberId !== memberId) return false;
    if (contributionId && a.contributionId !== contributionId) return false;
    return true;
  });

  const totalExpected = filteredAssignments.reduce(
    (sum, a) => sum + toSafeIntMWK(a.assignedAmount),
    0
  );

  let totalVerifiedPaid = 0;
  let hasOverdueAssignment = false;
  const nowTime = Date.now();

  filteredAssignments.forEach((a) => {
    const verified = calculateVerifiedPaidForAssignment(a.id, payments);
    totalVerifiedPaid += verified;
    const remaining = Math.max(0, toSafeIntMWK(a.assignedAmount) - verified);
    if (remaining > 0 && a.deadline && new Date(a.deadline).getTime() < nowTime) {
      hasOverdueAssignment = true;
    }
  });

  const totalOutstanding = Math.max(0, totalExpected - totalVerifiedPaid);
  const totalOverpaid = Math.max(0, totalVerifiedPaid - totalExpected);

  let status: 'fully_settled' | 'partially_paid' | 'unpaid' | 'overdue' = 'unpaid';
  if (totalOutstanding === 0 && totalExpected > 0) {
    status = 'fully_settled';
  } else if (hasOverdueAssignment) {
    status = 'overdue';
  } else if (totalVerifiedPaid > 0) {
    status = 'partially_paid';
  }

  return {
    totalExpected,
    totalVerifiedPaid,
    totalOutstanding,
    totalOverpaid,
    isOverdue: hasOverdueAssignment,
    status,
  };
}

/**
 * Filter audience for administrator communications.
 * Strictly excludes removed, departed, and suspended members from routine group communication.
 */
export function filterTargetAudience(
  groupId: string,
  targetAudience: AudienceType,
  members: MemberRecord[],
  assignments: ContributionAssignment[],
  payments: Payment[],
  contributionId?: string,
  individualMemberId?: string
): MemberRecord[] {
  const candidateMembers = members.filter(
    (m) => m.groupId === groupId && m.status === 'active'
  );

  if (targetAudience === 'individual') {
    if (!individualMemberId) return [];
    return candidateMembers.filter((m) => m.id === individualMemberId);
  }

  if (targetAudience === 'all_active') {
    return candidateMembers;
  }

  if (targetAudience === 'outstanding_only') {
    return candidateMembers.filter((m) => {
      const summary = getMemberFinancialSummary(m.id, assignments, payments, contributionId);
      return summary.totalOutstanding > 0;
    });
  }

  if (targetAudience === 'overdue_only') {
    return candidateMembers.filter((m) => {
      const summary = getMemberFinancialSummary(m.id, assignments, payments, contributionId);
      return summary.isOverdue && summary.totalOutstanding > 0;
    });
  }

  if (targetAudience === 'paid_only') {
    return candidateMembers.filter((m) => {
      const summary = getMemberFinancialSummary(m.id, assignments, payments, contributionId);
      return summary.totalExpected > 0 && summary.totalOutstanding === 0;
    });
  }

  return [];
}

/**
 * Intelligent personalized email composer.
 * Never discloses one member's financial obligations to other members.
 */
export function buildPersonalizedCommunication(
  member: MemberRecord,
  group: Group,
  type: CommunicationType,
  customSubject: string,
  customMessage: string,
  assignments: ContributionAssignment[],
  payments: Payment[],
  contribution?: Contribution,
  recordedPayment?: Payment
): {
  subject: string;
  personalizedSnippet: string;
  outstandingAmount?: number;
} {
  const summary = getMemberFinancialSummary(member.id, assignments, payments, contribution?.id);

  if (type === 'payment_confirmation' && recordedPayment) {
    const subject = customSubject || `Payment Received Confirmation — ${group.name}`;
    const snippet =
      `Your payment of ${formatMWK(recordedPayment.amountReceived)} has been recorded for ${group.name}. ` +
      `Transaction Ref: ${recordedPayment.transactionReference}. ` +
      `Your remaining balance for this obligation is now ${formatMWK(summary.totalOutstanding)}. Thank you.`;
    return {
      subject,
      personalizedSnippet: snippet,
      outstandingAmount: summary.totalOutstanding,
    };
  }

  if (type === 'financial_reminder') {
    const obligationName = contribution ? `"${contribution.title}"` : 'shared group expenses';
    const deadlineText = contribution?.deadline
      ? ` before ${new Date(contribution.deadline).toLocaleDateString()}`
      : '';
    const subject = customSubject || `Financial Balance Reminder: ${obligationName} — ${group.name}`;
    const baseMessage = customMessage.trim()
      ? customMessage
      : `Hello ${member.name}, this is a reminder regarding your contribution for ${obligationName}.`;

    const snippet =
      `${baseMessage}\n\n` +
      `• Member Name: ${member.name}\n` +
      (member.roomNumber ? `• Assigned Room/Unit: ${member.roomNumber}\n` : '') +
      `• Outstanding Amount: ${formatMWK(summary.totalOutstanding)}\n` +
      `• Status: ${summary.isOverdue ? 'OVERDUE' : 'Pending'}${deadlineText}\n\n` +
      `Please settle your balance with the administrator.`;

    return {
      subject,
      personalizedSnippet: snippet,
      outstandingAmount: summary.totalOutstanding,
    };
  }

  if (type === 'cleared_balance') {
    const subject = customSubject || `All Balances Cleared — Thank You — ${group.name}`;
    const snippet =
      `Hello ${member.name},\n\n` +
      `This is to confirm that your financial obligations for ${contribution ? `"${contribution.title}"` : group.name} have been fully settled in good standing.\n\n` +
      `Outstanding Balance: MK 0.\n\n` +
      `Thank you for your timely contribution!`;
    return {
      subject,
      personalizedSnippet: snippet,
      outstandingAmount: 0,
    };
  }

  // General announcement (Broadcast to all active members)
  const subject = customSubject || `Group Announcement — ${group.name}`;
  const snippet =
    `${customMessage.trim() || `Notice from the administrator regarding ${group.name}.`}\n\n` +
    `— Administrator, ${group.name}`;

  return {
    subject,
    personalizedSnippet: snippet,
    outstandingAmount: undefined,
  };
}

/**
 * Creates an intelligent email communication dispatch record
 */
export function createEmailCommunicationDispatch(
  groupId: string,
  group: Group,
  adminId: string,
  type: CommunicationType,
  targetAudience: AudienceType,
  subject: string,
  message: string,
  targetMembers: MemberRecord[],
  assignments: ContributionAssignment[],
  payments: Payment[],
  contribution?: Contribution,
  recordedPayment?: Payment
): EmailCommunication {
  const recipients: CommunicationRecipient[] = targetMembers.map((member) => {
    const personalized = buildPersonalizedCommunication(
      member,
      group,
      type,
      subject,
      message,
      assignments,
      payments,
      contribution,
      recordedPayment
    );

    return {
      memberId: member.id,
      name: member.name,
      email: member.email,
      phone: member.phone,
      personalizedSnippet: personalized.personalizedSnippet,
      outstandingAmount: personalized.outstandingAmount,
      deliveryStatus: 'delivered',
      deliveredAt: new Date().toISOString(),
    };
  });

  return {
    id: `comm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    groupId,
    subject,
    message,
    type,
    targetAudience,
    contributionId: contribution?.id,
    recipientCount: recipients.length,
    recipients,
    sentAt: new Date().toISOString(),
    sentBy: adminId,
    deliveredCount: recipients.length,
  };
}

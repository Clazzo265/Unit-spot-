import {
  User,
  Group,
  GroupMember,
  Contribution,
  ContributionAssignment,
  Payment,
  PaymentCommitment,
  Expense,
  Dispute,
  AppNotification,
  AuditLog,
  CommitmentEvent,
  EmailCommunication,
  NotificationScheduleConfig,
} from '../types';

/**
 * Clean production foundation for KLARENCY / UnitSpot.
 * Zero dummy users, zero sample groups, zero mock phone numbers or placeholder debts.
 */
export const INITIAL_USERS: User[] = [];
export const INITIAL_GROUPS: Group[] = [];
export const INITIAL_GROUP_MEMBERS: GroupMember[] = [];
export const INITIAL_CONTRIBUTIONS: Contribution[] = [];
export const INITIAL_ASSIGNMENTS: ContributionAssignment[] = [];
export const INITIAL_PAYMENTS: Payment[] = [];
export const INITIAL_COMMITMENTS: PaymentCommitment[] = [];
export const INITIAL_COMMITMENT_EVENTS: CommitmentEvent[] = [];
export const INITIAL_EXPENSES: Expense[] = [];
export const INITIAL_DISPUTES: Dispute[] = [];
export const INITIAL_NOTIFICATIONS: AppNotification[] = [];
export const INITIAL_AUDIT_LOGS: AuditLog[] = [];
export const INITIAL_COMMUNICATIONS: EmailCommunication[] = [];

export const DEFAULT_NOTIFICATION_CONFIG: NotificationScheduleConfig = {
  autoObligationNotice: true,
  autoUpcomingDeadlines: true,
  deadlineThresholdDays: 3,
  autoOverdueAlerts: true,
  autoPaymentConfirmations: true,
  autoClearedBalanceNotes: true,
};

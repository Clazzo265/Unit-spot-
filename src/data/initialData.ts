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
  CommitmentEvent
} from '../types';

/**
 * Clean production foundation for KLARENCY.
 * Includes initial authentic administrator account for the system operator.
 * All dummy houses, demo electricity transactions, and sample member debts have been removed.
 */
export const INITIAL_USERS: User[] = [
  {
    id: 'usr_admin',
    name: 'Administrator',
    email: 'admin@klarency.mw',
    phone: '+265 999 000 000',
    role: 'super_admin',
    createdAt: new Date().toISOString(),
  },
];

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

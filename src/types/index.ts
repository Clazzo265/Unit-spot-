export type AdministratorRole = 'super_admin' | 'group_admin' | 'treasurer' | 'member';

export type MemberStatus = 'active' | 'suspended' | 'removed' | 'departed';

export type StoveType = 'electric' | 'non_electric';

export type PaymentMethod = 'airtel_money' | 'tnm_mpamba' | 'bank_transfer' | 'cash' | 'other';

export type PaymentStatus =
  | 'unpaid'
  | 'partially_paid'
  | 'submitted'
  | 'pending_verification'
  | 'verified'
  | 'rejected'
  | 'disputed'
  | 'reversed'
  | 'overdue'
  | 'fully_settled';

export type PaymentVerificationStatus =
  | 'submitted'
  | 'pending_verification'
  | 'verified'
  | 'rejected'
  | 'disputed'
  | 'reversed';

export type CommitmentStatus =
  | 'active'
  | 'due_soon'
  | 'due_today'
  | 'completed'
  | 'overdue'
  | 'extension_requested'
  | 'revised';

export type ExpenseCategory =
  | 'electricity'
  | 'water'
  | 'rent'
  | 'internet'
  | 'security'
  | 'waste'
  | 'groceries'
  | 'maintenance'
  | 'other';

export type CommunicationType =
  | 'announcement'
  | 'financial_reminder'
  | 'payment_confirmation'
  | 'deadline_alert'
  | 'cleared_balance';

export type AudienceType =
  | 'all_active'
  | 'outstanding_only'
  | 'overdue_only'
  | 'paid_only'
  | 'individual';

/**
 * Authenticated Administrator operating the application
 */
export interface Administrator {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: AdministratorRole;
  avatarUrl?: string;
  roomNumber?: string;
  createdAt: string;
}

// User alias for compatibility with administrator identity
export type User = Administrator;

/**
 * Member Record - registered in the group directory (NOT an application user/login account)
 */
export interface MemberRecord {
  id: string;
  memberRefId?: string; // e.g. MEM-2026-001
  groupId: string;
  name: string;
  email: string;
  phone?: string;
  stoveType?: StoveType;
  stoveTypeReviewRequired?: boolean;
  stoveTypeUpdatedAt?: string;
  stoveTypeUpdatedBy?: string;
  stoveTypeChangeReason?: string;
  membershipDate?: string; // ISO date string
  roomNumber?: string;
  notes?: string;
  status: MemberStatus;
  removedAt?: string;
  removalReason?: string;
  suspendedAt?: string;
  suspensionReason?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface GroupMember {
  id: string;
  userId: string;
  groupId: string;
  name: string;
  email: string;
  phone?: string;
  memberRefId?: string;
  roleInGroup: 'admin' | 'treasurer' | 'member';
  stoveType?: StoveType;
  stoveTypeReviewRequired?: boolean;
  stoveTypeUpdatedAt?: string;
  stoveTypeUpdatedBy?: string;
  stoveTypeChangeReason?: string;
  membershipDate?: string;
  joinedAt: string;
  status: MemberStatus;
  departedAt?: string;
  departureReason?: string;
  roomNumber?: string;
  notes?: string;
  removedAt?: string;
  removalReason?: string;
  suspendedAt?: string;
  suspensionReason?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Group {
  id: string;
  name: string;
  description: string;
  category: 'house' | 'hostel' | 'workplace' | 'community' | 'church' | 'project';
  adminId: string;
  treasurerId?: string;
  defaultCurrency: string; // 'MWK'
  paymentRules: string;
  joinCode: string;
  status?: 'active' | 'archived';
  archivedAt?: string;
  archivedBy?: string;
  archiveReason?: string;
  createdAt: string;
  updatedAt?: string;
  memberCount: number;
}

export interface Contribution {
  id: string;
  groupId: string;
  title: string;
  category: ExpenseCategory;
  month: number; // 1-12
  year: number;
  totalTargetAmount: number; // integer MWK
  deadline: string; // ISO date string
  description?: string;
  status: 'active' | 'closed';
  rateConfigVersion?: string;
  createdAt: string;
}

export interface ContributionAssignment {
  id: string;
  contributionId: string;
  groupId: string;
  memberId: string; // MemberRecord ID
  assignedAmount: number; // integer MWK
  applicableRate?: number; // snapshotted rate in MWK
  stoveTypeAtAssignment?: StoveType;
  rateConfigVersion?: string;
  assignedDate: string;
  deadline: string;
  notes?: string;
  status: PaymentStatus;
}

export interface Payment {
  id: string; // Unique transaction ID, e.g. TX-2026-10491
  assignmentId: string;
  contributionId: string;
  groupId: string;
  memberId: string; // MemberRecord ID
  amountReceived: number; // integer MWK
  paymentDate: string;
  paymentMethod: PaymentMethod;
  transactionReference: string; // Mobile money TX ID or receipt ref
  idempotencyKey?: string;
  collectorId: string; // Admin ID
  verificationStatus: PaymentVerificationStatus;
  rejectionReason?: string;
  verifiedAt?: string;
  verifiedBy?: string;
  reversedAt?: string;
  reversedBy?: string;
  reversalReason?: string;
  reversedByPaymentId?: string;
  disputeReason?: string;
  disputedAt?: string;
  disputedBy?: string;
  receiptEvidenceUrl?: string;
  receiptImageUrl?: string; // Captured camera image or uploaded screenshot
  receiptNote?: string;
  createdAt: string;
}

export interface PaymentCommitment {
  id: string;
  assignmentId: string;
  memberId: string;
  groupId: string;
  contributionId?: string;
  originalOutstandingAmount: number;
  currentOutstandingAmount: number;
  amountAlreadyReceived?: number;
  commitmentDate: string;
  promisedDate: string;
  durationDays: number;
  collectorId: string;
  notes?: string;
  status: CommitmentStatus;
  memberConfirmed: boolean;
  extensionCount: number;
  completedAt?: string;
}

export interface CommitmentEvent {
  id: string;
  commitmentId: string;
  date: string;
  eventType:
    | 'created'
    | 'reminder_sent'
    | 'extension_requested'
    | 'extension_approved'
    | 'extension_declined'
    | 'extension_granted'
    | 'partial_payment'
    | 'completed'
    | 'broken'
    | 'revised';
  notes: string;
  recordedBy: string;
  newPromisedDate?: string;
  amountPaid?: number;
}

export interface Expense {
  id: string;
  groupId: string;
  name: string;
  category: ExpenseCategory;
  amount: number; // MWK integer
  date: string;
  description: string;
  responsiblePersonId: string;
  receiptNumber?: string;
  receiptEvidenceUrl?: string;
  receiptImageUrl?: string;
  paymentReference?: string;
  status: 'approved' | 'pending_approval' | 'rejected';
  approvedBy?: string;
  approvedAt?: string;
  createdAt: string;
}

export interface Dispute {
  id: string;
  groupId: string;
  assignmentId?: string;
  relatedAssignmentId?: string;
  paymentId?: string;
  memberId: string;
  title: string;
  description: string;
  expectedAmount?: number;
  paidAmountClaimed?: number;
  claimedAmount?: number;
  evidenceUrl?: string;
  status: 'open' | 'under_review' | 'resolved' | 'rejected';
  resolutionNote?: string;
  resolvedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AppNotification {
  id: string;
  userId: string;
  groupId?: string;
  title: string;
  message: string;
  category: 'payment' | 'commitment' | 'expense' | 'dispute' | 'announcement';
  read: boolean;
  createdAt: string;
  linkTab?: string;
}

/**
 * Intelligent Email Communication Engine Record
 */
export interface CommunicationRecipient {
  memberId: string;
  name: string;
  email: string;
  phone?: string;
  personalizedSnippet: string;
  outstandingAmount?: number;
  deliveryStatus: 'delivered' | 'sent' | 'queued';
  deliveredAt?: string;
}

export interface EmailCommunication {
  id: string;
  groupId: string;
  subject: string;
  message: string;
  type: CommunicationType;
  targetAudience: AudienceType;
  contributionId?: string;
  recipientCount: number;
  recipients: CommunicationRecipient[];
  sentAt: string;
  sentBy: string;
  deliveredCount: number;
}

export interface NotificationScheduleConfig {
  autoObligationNotice: boolean;
  autoUpcomingDeadlines: boolean;
  deadlineThresholdDays: number;
  autoOverdueAlerts: boolean;
  autoPaymentConfirmations: boolean;
  autoClearedBalanceNotes: boolean;
}

export interface AuditLog {
  id: string;
  groupId?: string;
  actorId: string;
  actorName: string;
  action: string;
  targetEntity?: string;
  targetId?: string;
  reason?: string;
  beforeValue?: string;
  afterValue?: string;
  details: string;
  timestamp: string;
  ipAddress?: string;
  securityEvent?: boolean;
}

export interface ActionResult<T = undefined> {
  success: boolean;
  error?: string;
  code?: string;
  data?: T;
}

export interface IntegrityFinding {
  id: string;
  entityType: 'member' | 'contribution' | 'assignment' | 'payment' | 'commitment' | 'expense';
  entityId: string;
  severity: 'repaired' | 'review_required' | 'warning';
  issue: string;
  beforeValue?: string;
  afterValue?: string;
  timestamp: string;
}

export interface IntegrityReport {
  scannedAt: string;
  repairedCount: number;
  flaggedCount: number;
  findings: IntegrityFinding[];
}

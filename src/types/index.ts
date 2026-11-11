export type UserRole = 'super_admin' | 'group_admin' | 'treasurer' | 'member';

export type PaymentMethod = 'airtel_money' | 'tnm_mpamba' | 'bank_transfer' | 'cash' | 'other';

export type PaymentStatus = 
  | 'unpaid' 
  | 'partially_paid' 
  | 'pending_verification' 
  | 'verified' 
  | 'rejected' 
  | 'overdue' 
  | 'fully_settled';

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

export type DisputeStatus = 'open' | 'under_review' | 'resolved' | 'rejected';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  avatarUrl?: string;
  department?: string;
  roomNumber?: string;
  createdAt: string;
}

export interface Group {
  id: string;
  name: string;
  description: string;
  category: 'house' | 'hostel' | 'workplace' | 'community' | 'church' | 'project';
  adminId: string;
  treasurerId: string;
  defaultCurrency: string; // 'MWK'
  paymentRules: string;
  joinCode: string;
  createdAt: string;
  memberCount: number;
}

export interface GroupMember {
  id: string;
  groupId: string;
  userId: string;
  user?: User;
  roleInGroup: 'admin' | 'treasurer' | 'member';
  joinedAt: string;
  departedAt?: string;
  departureReason?: string;
  status: 'active' | 'suspended' | 'departed';
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
  createdAt: string;
}

export interface ContributionAssignment {
  id: string;
  contributionId: string;
  groupId: string;
  memberId: string; // User ID
  assignedAmount: number; // integer MWK
  assignedDate: string;
  deadline: string;
  notes?: string;
  status: PaymentStatus;
}

export interface Payment {
  id: string; // Unique transaction ID, e.g. TX-2026-1049
  assignmentId: string;
  contributionId: string;
  groupId: string;
  memberId: string;
  amountReceived: number; // integer MWK
  paymentDate: string;
  paymentMethod: PaymentMethod;
  transactionReference: string; // Mobile money TX ID or bank slip (or generated PHOTO-REC-xxx)
  collectorId: string;
  verificationStatus: 'verified' | 'pending_verification' | 'rejected';
  rejectionReason?: string;
  verifiedAt?: string;
  verifiedBy?: string;
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
  contributionId: string;
  originalOutstandingAmount: number; // MWK when promise made
  currentOutstandingAmount: number; // MWK remaining
  amountAlreadyReceived: number;
  commitmentDate: string;
  promisedDate: string; // deadline
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
  eventType: 'created' | 'partial_payment' | 'extension_requested' | 'extension_granted' | 'revised' | 'completed' | 'missed';
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
  amount: number; // MWK
  date: string;
  description: string;
  responsiblePersonId: string;
  receiptNumber?: string;
  receiptEvidenceUrl?: string;
  paymentReference?: string;
  status: 'approved' | 'pending_approval' | 'rejected';
  approvedBy?: string;
  approvedAt?: string;
  createdAt: string;
}

export interface Dispute {
  id: string;
  groupId: string;
  memberId: string;
  title: string;
  description: string;
  relatedTransactionId?: string;
  relatedAssignmentId?: string;
  claimedAmount?: number;
  evidenceUrl?: string;
  status: DisputeStatus;
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
  category: 'payment' | 'commitment' | 'deadline' | 'expense' | 'dispute' | 'announcement';
  read: boolean;
  createdAt: string;
  linkAction?: string;
}

export interface AuditLog {
  id: string;
  groupId?: string;
  actorId: string;
  actorName: string;
  action: string;
  details: string;
  timestamp: string;
  ipAddress?: string;
  securityEvent?: boolean;
}

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  User,
  Group,
  GroupMember,
  Contribution,
  ContributionAssignment,
  Payment,
  PaymentCommitment,
  CommitmentEvent,
  Expense,
  Dispute,
  AppNotification,
  AuditLog,
  PaymentMethod,
  EmailCommunication,
  NotificationScheduleConfig,
  CommunicationType,
  AudienceType,
  StoveType,
  ActionResult,
  IntegrityReport,
  ContributionAllocationMode,
  GroupInvite,
  JoinRequest,
  GroupJoinPolicy,
  CloudSyncStatus,
} from '../types';
import {
  INITIAL_USERS,
  INITIAL_GROUPS,
  INITIAL_GROUP_MEMBERS,
  INITIAL_CONTRIBUTIONS,
  INITIAL_ASSIGNMENTS,
  INITIAL_PAYMENTS,
  INITIAL_COMMITMENTS,
  INITIAL_COMMITMENT_EVENTS,
  INITIAL_EXPENSES,
  INITIAL_DISPUTES,
  INITIAL_NOTIFICATIONS,
  INITIAL_AUDIT_LOGS,
  INITIAL_COMMUNICATIONS,
  DEFAULT_NOTIFICATION_CONFIG,
} from '../data/initialData';
import {
  calculateVerifiedPaidForAssignment,
  calculatePendingPaidForAssignment,
  determineAssignmentPaymentStatus,
} from '../utils/financialCalculations';
import {
  RATES,
  RATE_CONFIG_VERSION,
  isValidStoveType,
  parseMWKInput,
  toSafeIntMWK,
  validateTransactionReference,
  auditAndRepairFinancialData,
  sanitizeForFirestore,
  normalizeGroupMemberForSync,
  mergeGroupMembersWithFallback,
  isAccommodationGroup,
  generateJoinCode,
  extractInviteCodeFromUrl,
} from '../utils/financialConfig';
import {
  validateEmailAddress,
  isDuplicateMemberEmail,
  generateMemberReferenceId,
  filterTargetAudience,
  createEmailCommunicationDispatch,
  getEffectiveGroupRole,
  canManageGroupRole,
  canVerifyPaymentsRole,
  resolveMemberForUser,
  EffectiveGroupRole,
} from '../utils/centralizedFinancialAdmin';
import {
  stripDataUrlsFromPayments,
  stripDataUrlsFromExpenses,
  persistStorageWithFallback,
  mergeItemsById,
} from '../utils/storageUtils';
import { AppLanguage, getLocaleStrings, LocaleDictionary } from '../utils/i18n';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
  testFirestoreConnection,
  signUpWithEmail,
  signInWithEmail,
  resetPassword,
  resendVerificationEmail,
  reloadCurrentUser,
} from '../firebase/config';
import {
  signInWithPopup,
  signOut as fbSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  onSnapshot,
  query,
  where,
  arrayUnion,
  increment,
} from 'firebase/firestore';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AppContextType {
  currentUser: User | null;
  setCurrentUser: (user: User) => void;
  authStatus: AuthStatus;
  authError: string | null;
  clearAuthError: () => void;
  firebaseAuthUser: FirebaseUser | null;
  isEmailVerified: boolean;
  signInWithGoogle: () => Promise<boolean>;
  signInWithEmailAccount: (email: string, password: string) => Promise<boolean>;
  signUpWithEmailAccount: (name: string, email: string, password: string) => Promise<boolean>;
  sendPasswordReset: (email: string) => Promise<boolean>;
  resendVerification: () => Promise<boolean>;
  refreshAuthVerification: () => Promise<boolean>;
  signOut: () => Promise<void>;
  isFirebaseReady: boolean;

  language: AppLanguage;
  setLanguage: (lang: AppLanguage) => void;
  strings: LocaleDictionary;

  syncStatus: CloudSyncStatus;
  pendingInviteCode: string | null;
  setPendingInviteCode: (code: string | null) => void;

  effectiveRole: EffectiveGroupRole;
  currentMemberRecord: GroupMember | null;

  actionError: string | null;
  clearActionError: () => void;

  users: User[];
  groups: Group[];
  currentGroup: Group | null;
  setCurrentGroup: (group: Group | null) => void;
  groupMembers: GroupMember[];
  contributions: Contribution[];
  assignments: ContributionAssignment[];
  payments: Payment[];
  commitments: PaymentCommitment[];
  commitmentEvents: CommitmentEvent[];
  expenses: Expense[];
  disputes: Dispute[];
  joinRequests: JoinRequest[];
  notifications: AppNotification[];
  auditLogs: AuditLog[];
  communications: EmailCommunication[];
  notificationConfig: NotificationScheduleConfig;
  integrityReport: IntegrityReport | null;
  hasPreRepairSnapshot: boolean;

  // Payment & Financial Actions
  recordPayment: (params: {
    assignmentId: string;
    amount: number | string;
    paymentMethod: PaymentMethod;
    transactionReference?: string;
    idempotencyKey?: string;
    receiptImageUrl?: string;
    receiptStoragePath?: string;
    receiptNote?: string;
  }) => {
    success: boolean;
    paymentId: string;
    newOutstanding: number;
    overpaid?: number;
    verificationStatus?: Payment['verificationStatus'];
    error?: string;
  };

  verifyPayment: (paymentId: string, approved: boolean, reason?: string) => ActionResult;
  reversePayment: (paymentId: string, reason: string) => ActionResult;
  disputePayment: (paymentId: string, reason: string) => ActionResult;

  createCommitment: (params: {
    assignmentId: string;
    promisedDate: string;
    durationDays: number;
    notes?: string;
  }) => boolean;

  requestCommitmentExtension: (commitmentId: string, newDate: string, reason: string) => void;
  approveCommitmentExtension: (commitmentId: string, approved: boolean) => void;

  recordExpense: (expense: Omit<Expense, 'id' | 'createdAt' | 'status'>) => ActionResult;
  approveExpense: (expenseId: string, approved: boolean) => ActionResult;

  createContribution: (
    contribution: Omit<Contribution, 'id' | 'createdAt'>,
    memberAssignments: { memberId: string; amount: number; notes?: string }[]
  ) => ActionResult;

  // Group & Invite Lifecycle
  createGroup: (
    group: Omit<Group, 'id' | 'createdAt' | 'memberCount' | 'adminId' | 'treasurerId' | 'joinCode'>
  ) => string;
  updateGroup: (
    groupId: string,
    updates: Partial<Pick<Group, 'name' | 'description' | 'category' | 'paymentRules' | 'joinPolicy'>>
  ) => ActionResult;
  archiveGroup: (groupId: string, reason: string) => ActionResult;
  transferGroupOwnership: (groupId: string, newAdminMemberId: string, reason: string) => ActionResult;
  lookupInviteByCode: (code: string) => Promise<ActionResult<GroupInvite>>;
  joinGroupByCode: (code: string) => Promise<ActionResult<{ groupId: string; groupName: string; status: 'joined' | 'pending_approval' }>>;
  approveJoinRequest: (groupId: string, requestId: string, approved: boolean) => Promise<ActionResult>;
  regenerateGroupInvite: (
    groupId: string,
    options?: { revoke?: boolean; regenerate?: boolean; joinPolicy?: GroupJoinPolicy }
  ) => Promise<ActionResult>;

  // Member Lifecycle
  addMemberToGroup: (params: {
    name: string;
    email: string;
    phone: string;
    role: 'admin' | 'treasurer' | 'member';
    stoveType?: StoveType;
    roomNumber?: string;
    notes?: string;
  }) => { success: boolean; user?: User; member?: GroupMember; error?: string };

  addMemberRecord: (params: {
    name: string;
    email: string;
    phone?: string;
    stoveType?: StoveType;
    roomNumber?: string;
    notes?: string;
    role?: 'admin' | 'treasurer' | 'member';
  }) => { success: boolean; error?: string; member?: GroupMember };

  updateMemberRecord: (memberId: string, updates: Partial<GroupMember>) => boolean;
  updateMemberStoveType: (memberId: string, stoveType: StoveType, reason: string) => ActionResult;
  suspendMember: (memberId: string, reason: string) => ActionResult;
  reinstateMember: (memberId: string, reason: string) => ActionResult;
  changeMemberRole: (
    memberId: string,
    newRole: 'admin' | 'treasurer' | 'member',
    reason: string
  ) => ActionResult;
  removeMemberRecord: (memberId: string, reason?: string) => boolean;
  removeMemberFromGroup: (userId: string, reason?: string) => boolean;

  sendCommunication: (params: {
    type: CommunicationType;
    targetAudience: AudienceType;
    subject: string;
    message: string;
    contributionId?: string;
    individualMemberId?: string;
  }) => EmailCommunication | null;

  updateNotificationConfig: (config: Partial<NotificationScheduleConfig>) => void;

  submitDispute: (dispute: Omit<Dispute, 'id' | 'createdAt' | 'updatedAt' | 'status'>) => void;
  resolveDispute: (disputeId: string, resolutionNote: string, status: 'resolved' | 'rejected') => void;

  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;

  // Data Integrity & Recovery
  rescanAndRepairRecords: () => IntegrityReport;
  restorePreRepairSnapshot: () => ActionResult;
  clearAllData: () => void;
}

const STORAGE_KEY = 'unitspot_app_state_v4';
const LANG_STORAGE_KEY = 'unitspot_lang';
const PRE_REPAIR_SNAPSHOT_KEY = 'klarency_pre_repair_snapshot_v1';
const SUPER_ADMIN_EMAIL = 'cchilongo88@gmail.com';

const AppContext = createContext<AppContextType | null>(null);

function safeParseStorage<T>(key: string, fallback: T): T {
  try {
    const saved = localStorage.getItem(key);
    if (!saved) return fallback;
    return JSON.parse(saved) as T;
  } catch {
    return fallback;
  }
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseAuthUser, setFirebaseAuthUser] = useState<FirebaseUser | null>(null);
  const [isFirebaseReady, setIsFirebaseReady] = useState(false);
  const [authStatus, setAuthStatus] = useState<AuthStatus>('loading');
  const [authError, setAuthError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<CloudSyncStatus>(() =>
    typeof navigator !== 'undefined' && !navigator.onLine ? 'offline_queued' : 'synced'
  );
  const [language, setLanguageState] = useState<AppLanguage>(() => {
    const saved = localStorage.getItem(LANG_STORAGE_KEY);
    return saved === 'ny' ? 'ny' : 'en';
  });
  const [pendingInviteCode, setPendingInviteCode] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return extractInviteCodeFromUrl(window.location.href);
  });

  const setLanguage = useCallback((lang: AppLanguage) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(LANG_STORAGE_KEY, lang);
    } catch {
      // ignore storage errors
    }
  }, []);

  const strings = getLocaleStrings(language);

  const [users, setUsers] = useState<User[]>(() =>
    safeParseStorage<User[]>(`${STORAGE_KEY}_users`, INITIAL_USERS)
  );
  const usersRef = useRef<User[]>(users);
  useEffect(() => {
    usersRef.current = users;
  }, [users]);

  const [currentUser, setCurrentUserState] = useState<User | null>(null);

  const [groups, setGroups] = useState<Group[]>(() =>
    safeParseStorage<Group[]>(`${STORAGE_KEY}_groups`, INITIAL_GROUPS)
  );

  const [currentGroup, setCurrentGroup] = useState<Group | null>(() => {
    const saved = safeParseStorage<Group | null>(`${STORAGE_KEY}_currentGroup`, null);
    if (saved) return saved;
    const savedGroups = safeParseStorage<Group[]>(`${STORAGE_KEY}_groups`, INITIAL_GROUPS);
    return savedGroups.find((g) => g.status !== 'archived') || savedGroups[0] || null;
  });

  const [groupMembers, setGroupMembers] = useState<GroupMember[]>(() =>
    safeParseStorage<GroupMember[]>(`${STORAGE_KEY}_groupMembers`, INITIAL_GROUP_MEMBERS)
  );
  const [contributions, setContributions] = useState<Contribution[]>(() =>
    safeParseStorage<Contribution[]>(`${STORAGE_KEY}_contributions`, INITIAL_CONTRIBUTIONS)
  );
  const [assignments, setAssignments] = useState<ContributionAssignment[]>(() =>
    safeParseStorage<ContributionAssignment[]>(`${STORAGE_KEY}_assignments`, INITIAL_ASSIGNMENTS)
  );
  const [payments, setPayments] = useState<Payment[]>(() =>
    safeParseStorage<Payment[]>(`${STORAGE_KEY}_payments`, INITIAL_PAYMENTS)
  );
  const [commitments, setCommitments] = useState<PaymentCommitment[]>(() =>
    safeParseStorage<PaymentCommitment[]>(`${STORAGE_KEY}_commitments`, INITIAL_COMMITMENTS)
  );
  const [commitmentEvents, setCommitmentEvents] = useState<CommitmentEvent[]>(() =>
    safeParseStorage<CommitmentEvent[]>(`${STORAGE_KEY}_commitmentEvents`, INITIAL_COMMITMENT_EVENTS)
  );
  const [expenses, setExpenses] = useState<Expense[]>(() =>
    safeParseStorage<Expense[]>(`${STORAGE_KEY}_expenses`, INITIAL_EXPENSES)
  );
  const [disputes, setDisputes] = useState<Dispute[]>(() =>
    safeParseStorage<Dispute[]>(`${STORAGE_KEY}_disputes`, INITIAL_DISPUTES)
  );
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>(() =>
    safeParseStorage<AppNotification[]>(`${STORAGE_KEY}_notifications`, INITIAL_NOTIFICATIONS)
  );
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() =>
    safeParseStorage<AuditLog[]>(`${STORAGE_KEY}_auditLogs`, INITIAL_AUDIT_LOGS)
  );
  const [communications, setCommunications] = useState<EmailCommunication[]>(() =>
    safeParseStorage<EmailCommunication[]>(`${STORAGE_KEY}_communications`, INITIAL_COMMUNICATIONS)
  );
  const [notificationConfig, setNotificationConfig] = useState<NotificationScheduleConfig>(() =>
    safeParseStorage<NotificationScheduleConfig>(
      `${STORAGE_KEY}_notificationConfig`,
      DEFAULT_NOTIFICATION_CONFIG
    )
  );

  const [integrityReport, setIntegrityReport] = useState<IntegrityReport | null>(null);
  const [hasPreRepairSnapshot, setHasPreRepairSnapshot] = useState<boolean>(() =>
    Boolean(localStorage.getItem(PRE_REPAIR_SNAPSHOT_KEY))
  );

  const isEmailVerified = firebaseAuthUser ? Boolean(firebaseAuthUser.emailVerified) : true;

  const effectiveRole: EffectiveGroupRole = getEffectiveGroupRole(
    currentUser,
    currentGroup,
    groupMembers
  );

  const currentMemberRecord: GroupMember | null = resolveMemberForUser(
    currentUser?.id,
    currentUser?.email,
    currentGroup?.id,
    groupMembers
  );

  const getRoleForGroupId = useCallback(
    (targetGroupId?: string): EffectiveGroupRole => {
      if (!currentUser) return 'member';
      if (currentUser.role === 'super_admin') return 'super_admin';
      const target =
        groups.find((g) => g.id === targetGroupId) || currentGroup || undefined;
      return getEffectiveGroupRole(currentUser, target, groupMembers);
    },
    [currentUser, groups, currentGroup, groupMembers]
  );

  // Track browser online/offline changes honestly
  useEffect(() => {
    const onOnline = () => setSyncStatus('synced');
    const onOffline = () => setSyncStatus('offline_queued');
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const setCurrentUser = useCallback((user: User) => {
    setCurrentUserState(user);
    setUsers((prev) => {
      const exists = prev.some((u) => u.id === user.id);
      return exists ? prev.map((u) => (u.id === user.id ? user : u)) : [user, ...prev];
    });
    if (firebaseAuthUser && firebaseAuthUser.emailVerified) {
      setDoc(
        doc(db, 'users', user.id),
        sanitizeForFirestore(user as unknown as Record<string, unknown>),
        { merge: true }
      ).catch((err) => {
        console.warn('Could not persist user update:', err);
      });
    }
  }, [firebaseAuthUser]);

  const syncToFirestore = useCallback(
    async (
      path: string,
      docId: string,
      data: Record<string, unknown>,
      op: OperationType = OperationType.WRITE
    ): Promise<void> => {
      if (!firebaseAuthUser) return;
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setSyncStatus('offline_queued');
        return;
      }
      setSyncStatus('syncing');
      try {
        await setDoc(doc(db, path, docId), sanitizeForFirestore(data), { merge: true });
        setSyncStatus('synced');
      } catch (err) {
        setSyncStatus(typeof navigator !== 'undefined' && !navigator.onLine ? 'offline_queued' : 'error');
        try {
          handleFirestoreError(err, op, `${path}/${docId}`);
        } catch (wrapped) {
          console.warn(wrapped);
          setActionError('Cloud sync error: changes are saved locally but could not sync to Firestore.');
        }
      }
    },
    [firebaseAuthUser]
  );

  // Automatic one-time non-destructive historical integrity scan on boot
  useEffect(() => {
    const hasAnyRecords =
      groupMembers.length > 0 ||
      contributions.length > 0 ||
      assignments.length > 0 ||
      payments.length > 0 ||
      commitments.length > 0 ||
      expenses.length > 0;

    if (!hasAnyRecords) return;

    const scanResult = auditAndRepairFinancialData({
      groups,
      groupMembers,
      contributions,
      assignments,
      payments,
      commitments,
      expenses,
    });

    setIntegrityReport(scanResult.report);

    if (scanResult.report.repairedCount > 0) {
      if (!localStorage.getItem(PRE_REPAIR_SNAPSHOT_KEY)) {
        try {
          localStorage.setItem(
            PRE_REPAIR_SNAPSHOT_KEY,
            JSON.stringify({
              savedAt: new Date().toISOString(),
              groupMembers,
              contributions,
              assignments,
              payments,
              commitments,
              expenses,
            })
          );
          setHasPreRepairSnapshot(true);
        } catch {
          // ignore storage quota issue
        }
      }

      setGroupMembers(scanResult.groupMembers);
      setContributions(scanResult.contributions);
      setAssignments(scanResult.assignments);
      setPayments(scanResult.payments);
      setCommitments(scanResult.commitments);
      setExpenses(scanResult.expenses);
    } else if (scanResult.report.flaggedCount > 0) {
      setGroupMembers(scanResult.groupMembers);
    }
    // Run once on initial mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Test connection & listen to Firebase Auth
  useEffect(() => {
    testFirestoreConnection();

    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseAuthUser(fbUser);
      setIsFirebaseReady(true);

      if (fbUser) {
        const isVerifiedSuperAdmin =
          fbUser.email?.toLowerCase() === SUPER_ADMIN_EMAIL && fbUser.emailVerified === true;

        const mappedUser: User = {
          id: fbUser.uid,
          name: fbUser.displayName || fbUser.email?.split('@')[0] || 'User',
          email: fbUser.email || '',
          phone: fbUser.phoneNumber || undefined,
          role: isVerifiedSuperAdmin ? 'super_admin' : 'group_admin',
          avatarUrl: fbUser.photoURL || undefined,
          preferredLanguage: language,
          createdAt: new Date().toISOString(),
        };

        setCurrentUserState(mappedUser);
        setAuthStatus('authenticated');
        setUsers((prev) => {
          const exists = prev.some((u) => u.id === mappedUser.id);
          return exists
            ? prev.map((u) => (u.id === mappedUser.id ? { ...u, ...mappedUser } : u))
            : [mappedUser, ...prev];
        });

        if (fbUser.emailVerified) {
          try {
            await setDoc(
              doc(db, 'users', fbUser.uid),
              sanitizeForFirestore(mappedUser as unknown as Record<string, unknown>),
              { merge: true }
            );
          } catch (err) {
            console.warn('Could not sync user to Firestore:', err);
          }
        }
      } else {
        setCurrentUserState(null);
        setAuthStatus('unauthenticated');
      }
    });

    return () => unsubscribe();
  }, [language]);

  // Listen to authenticated user's groups (admin, treasurer, and memberUids)
  useEffect(() => {
    if (!firebaseAuthUser) return;

    const isVerifiedSuperAdmin =
      firebaseAuthUser.email?.toLowerCase() === SUPER_ADMIN_EMAIL &&
      firebaseAuthUser.emailVerified === true;

    const handleGroupSnapshot = (remoteGroups: Group[]) => {
      if (remoteGroups.length === 0) return;
      setGroups((prev) => mergeItemsById(prev, remoteGroups));
      setCurrentGroup((prev) => {
        if (!prev) return remoteGroups.find((g) => g.status !== 'archived') || remoteGroups[0] || null;
        const refreshed = remoteGroups.find((g) => g.id === prev.id);
        return refreshed || prev;
      });
      setSyncStatus('synced');
    };

    const unsubs: (() => void)[] = [];

    if (isVerifiedSuperAdmin) {
      unsubs.push(
        onSnapshot(
          collection(db, 'groups'),
          (snapshot) => {
            const remoteGroups: Group[] = [];
            snapshot.forEach((docSnap) => remoteGroups.push(docSnap.data() as Group));
            handleGroupSnapshot(remoteGroups);
          },
          (err) => console.warn('Groups snapshot error:', err)
        )
      );
    } else {
      const adminQuery = query(collection(db, 'groups'), where('adminId', '==', firebaseAuthUser.uid));
      const memberQuery = query(
        collection(db, 'groups'),
        where('memberUids', 'array-contains', firebaseAuthUser.uid)
      );

      [adminQuery, memberQuery].forEach((q) => {
        unsubs.push(
          onSnapshot(
            q,
            (snapshot) => {
              const remoteGroups: Group[] = [];
              snapshot.forEach((docSnap) => remoteGroups.push(docSnap.data() as Group));
              handleGroupSnapshot(remoteGroups);
            },
            (err) => console.warn('Groups query error:', err)
          )
        );
      });
    }

    const notificationsRef = collection(db, `users/${firebaseAuthUser.uid}/notifications`);
    const unsubNotifications = onSnapshot(
      notificationsRef,
      (snapshot) => {
        if (!snapshot.empty) {
          const remoteNotifs: AppNotification[] = [];
          snapshot.forEach((docSnap) => {
            remoteNotifs.push(docSnap.data() as AppNotification);
          });
          setNotifications((prev) =>
            mergeItemsById(
              prev,
              remoteNotifs,
              (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            )
          );
        }
      },
      (err) => console.warn('Notifications snapshot error:', err)
    );

    return () => {
      unsubs.forEach((u) => u());
      unsubNotifications();
    };
  }, [firebaseAuthUser]);

  // Listen to active group subcollections
  useEffect(() => {
    if (!currentGroup?.id || !firebaseAuthUser) return;

    const groupId = currentGroup.id;
    const unsubscribers: (() => void)[] = [];

    const mergeById = <T extends { id: string }>(prev: T[], incoming: T[]): T[] => {
      const merged = [...prev];
      incoming.forEach((item) => {
        const idx = merged.findIndex((p) => p.id === item.id);
        if (idx >= 0) merged[idx] = item;
        else merged.push(item);
      });
      return merged;
    };

    try {
      const listeners: Array<{
        path: string;
        onData: (docs: any[]) => void;
      }> = [
        {
          path: `groups/${groupId}/members`,
          onData: (docs) =>
            setGroupMembers((prev) =>
              mergeGroupMembersWithFallback(prev, docs as GroupMember[], usersRef.current)
            ),
        },
        {
          path: `groups/${groupId}/contributions`,
          onData: (docs) => setContributions((prev) => mergeById(prev, docs as Contribution[])),
        },
        {
          path: `groups/${groupId}/assignments`,
          onData: (docs) => setAssignments((prev) => mergeById(prev, docs as ContributionAssignment[])),
        },
        {
          path: `groups/${groupId}/payments`,
          onData: (docs) => setPayments((prev) => mergeById(prev, docs as Payment[])),
        },
        {
          path: `groups/${groupId}/commitments`,
          onData: (docs) => setCommitments((prev) => mergeById(prev, docs as PaymentCommitment[])),
        },
        {
          path: `groups/${groupId}/commitmentEvents`,
          onData: (docs) => setCommitmentEvents((prev) => mergeById(prev, docs as CommitmentEvent[])),
        },
        {
          path: `groups/${groupId}/expenses`,
          onData: (docs) => setExpenses((prev) => mergeById(prev, docs as Expense[])),
        },
        {
          path: `groups/${groupId}/disputes`,
          onData: (docs) => setDisputes((prev) => mergeById(prev, docs as Dispute[])),
        },
        {
          path: `groups/${groupId}/joinRequests`,
          onData: (docs) => setJoinRequests((prev) => mergeById(prev, docs as JoinRequest[])),
        },
        {
          path: `groups/${groupId}/auditLogs`,
          onData: (docs) =>
            setAuditLogs((prev) =>
              mergeById(prev, docs as AuditLog[]).sort(
                (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
              )
            ),
        },
        {
          path: `groups/${groupId}/communications`,
          onData: (docs) =>
            setCommunications((prev) =>
              mergeById(prev, docs as EmailCommunication[]).sort(
                (a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime()
              )
            ),
        },
      ];

      listeners.forEach(({ path, onData }) => {
        const unsub = onSnapshot(
          collection(db, path),
          (snapshot) => {
            if (!snapshot.empty) {
              const items: any[] = [];
              snapshot.forEach((docSnap) => items.push(docSnap.data()));
              onData(items);
            }
          },
          (err) => console.warn(`${path} snapshot error:`, err)
        );
        unsubscribers.push(unsub);
      });
    } catch (e) {
      console.warn('Real-time listeners setup exception:', e);
    }

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [currentGroup?.id, firebaseAuthUser]);

  // Sync state to local storage with quota-safe fallback for inline receipt images
  useEffect(() => {
    persistStorageWithFallback(localStorage, `${STORAGE_KEY}_users`, users);
    persistStorageWithFallback(localStorage, `${STORAGE_KEY}_groups`, groups);
    persistStorageWithFallback(localStorage, `${STORAGE_KEY}_currentGroup`, currentGroup);
    persistStorageWithFallback(localStorage, `${STORAGE_KEY}_groupMembers`, groupMembers);
    persistStorageWithFallback(localStorage, `${STORAGE_KEY}_contributions`, contributions);
    persistStorageWithFallback(localStorage, `${STORAGE_KEY}_assignments`, assignments);
    persistStorageWithFallback(
      localStorage,
      `${STORAGE_KEY}_payments`,
      payments,
      stripDataUrlsFromPayments(payments)
    );
    persistStorageWithFallback(localStorage, `${STORAGE_KEY}_commitments`, commitments);
    persistStorageWithFallback(localStorage, `${STORAGE_KEY}_commitmentEvents`, commitmentEvents);
    persistStorageWithFallback(
      localStorage,
      `${STORAGE_KEY}_expenses`,
      expenses,
      stripDataUrlsFromExpenses(expenses)
    );
    persistStorageWithFallback(localStorage, `${STORAGE_KEY}_disputes`, disputes);
    persistStorageWithFallback(localStorage, `${STORAGE_KEY}_notifications`, notifications);
    persistStorageWithFallback(localStorage, `${STORAGE_KEY}_auditLogs`, auditLogs);
    persistStorageWithFallback(localStorage, `${STORAGE_KEY}_communications`, communications);
    persistStorageWithFallback(
      localStorage,
      `${STORAGE_KEY}_notificationConfig`,
      notificationConfig
    );
  }, [
    users,
    groups,
    currentGroup,
    groupMembers,
    contributions,
    assignments,
    payments,
    commitments,
    commitmentEvents,
    expenses,
    disputes,
    notifications,
    auditLogs,
    communications,
    notificationConfig,
  ]);

  const signInWithGoogle = async (): Promise<boolean> => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
      return true;
    } catch (error) {
      console.error('Google Sign In failed:', error);
      setAuthError('Google Sign-In could not be completed. Please allow popups and try again.');
      return false;
    }
  };

  const signInWithEmailAccount = async (email: string, password: string): Promise<boolean> => {
    setAuthError(null);
    if (!validateEmailAddress(email)) {
      setAuthError('Please enter a valid email address.');
      return false;
    }
    if (!password) {
      setAuthError('Please enter your password.');
      return false;
    }
    try {
      await signInWithEmail(email, password);
      return true;
    } catch (err: any) {
      const code = err?.code || '';
      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
        setAuthError('Incorrect email or password. Please check your details or reset your password.');
      } else if (code === 'auth/operation-not-allowed') {
        setAuthError('Email & password sign-in is not yet enabled in Firebase Authentication. You can use Continue with Google in the meantime.');
      } else {
        setAuthError(err?.message || 'Sign in failed. Please try again.');
      }
      return false;
    }
  };

  const signUpWithEmailAccount = async (name: string, email: string, password: string): Promise<boolean> => {
    setAuthError(null);
    if (!name.trim() || name.trim().length < 2) {
      setAuthError('Please enter your full name.');
      return false;
    }
    if (!validateEmailAddress(email)) {
      setAuthError('Please enter a valid email address.');
      return false;
    }
    if (password.length < 6) {
      setAuthError('Password must be at least 6 characters long.');
      return false;
    }
    try {
      await signUpWithEmail(name, email, password);
      return true;
    } catch (err: any) {
      const code = err?.code || '';
      if (code === 'auth/email-already-in-use') {
        setAuthError('An account with this email already exists. Please sign in instead.');
      } else if (code === 'auth/operation-not-allowed') {
        setAuthError('Email & password registration is not yet enabled in Firebase Authentication. You can use Continue with Google in the meantime.');
      } else {
        setAuthError(err?.message || 'Could not create your account. Please try again.');
      }
      return false;
    }
  };

  const sendPasswordReset = async (email: string): Promise<boolean> => {
    setAuthError(null);
    if (!validateEmailAddress(email)) {
      setAuthError('Enter your account email address first.');
      return false;
    }
    try {
      await resetPassword(email);
      return true;
    } catch (err: any) {
      setAuthError(err?.message || 'Could not send reset email. Please check the address.');
      return false;
    }
  };

  const resendVerification = async (): Promise<boolean> => {
    setAuthError(null);
    try {
      await resendVerificationEmail();
      return true;
    } catch (err: any) {
      setAuthError(err?.message || 'Could not resend verification email right now.');
      return false;
    }
  };

  const refreshAuthVerification = async (): Promise<boolean> => {
    setAuthError(null);
    try {
      const reloaded = await reloadCurrentUser();
      if (reloaded) {
        setFirebaseAuthUser({ ...reloaded } as FirebaseUser);
        return Boolean(reloaded.emailVerified);
      }
      return false;
    } catch {
      return false;
    }
  };

  const signOut = async () => {
    try {
      await fbSignOut(auth);
      setFirebaseAuthUser(null);
      setCurrentUserState(null);
      setAuthStatus('unauthenticated');
      clearAllData();
      setUsers([]);
    } catch (error) {
      console.error('Sign Out failed:', error);
      setActionError('Could not sign out cleanly. Please refresh and try again.');
    }
  };

  const addAuditLog = useCallback(
    (
      action: string,
      details: string,
      options: {
        securityEvent?: boolean;
        targetEntity?: string;
        targetId?: string;
        reason?: string;
        beforeValue?: string;
        afterValue?: string;
        groupId?: string;
      } = {}
    ) => {
      const actorId = currentUser?.id || 'system';
      const actorName = currentUser?.name || 'System';
      const gid = options.groupId || currentGroup?.id;

      const newLog: AuditLog = {
        id: `aud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        groupId: gid,
        actorId,
        actorName,
        action,
        targetEntity: options.targetEntity,
        targetId: options.targetId,
        reason: options.reason,
        beforeValue: options.beforeValue,
        afterValue: options.afterValue,
        details,
        timestamp: new Date().toISOString(),
        securityEvent: Boolean(options.securityEvent),
      };
      setAuditLogs((prev) => [newLog, ...prev]);

      if (gid && firebaseAuthUser) {
        syncToFirestore(`groups/${gid}/auditLogs`, newLog.id, newLog as unknown as Record<string, unknown>, OperationType.CREATE);
      }
    },
    [currentUser, currentGroup?.id, firebaseAuthUser, syncToFirestore]
  );

  const addNotification = useCallback(
    (
      userId: string,
      title: string,
      message: string,
      category: AppNotification['category']
    ) => {
      const newNotif: AppNotification = {
        id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
        userId,
        groupId: currentGroup?.id,
        title,
        message,
        category,
        read: false,
        createdAt: new Date().toISOString(),
      };
      setNotifications((prev) => [newNotif, ...prev]);

      if (firebaseAuthUser) {
        syncToFirestore(
          `users/${userId}/notifications`,
          newNotif.id,
          newNotif as unknown as Record<string, unknown>,
          OperationType.CREATE
        );
      }
    },
    [currentGroup?.id, firebaseAuthUser, syncToFirestore]
  );

  // Recalculate assignment status & active commitment from authoritative payment list
  const recomputeAssignmentAndCommitments = useCallback(
    (targetAssignment: ContributionAssignment, updatedPayments: Payment[], nowIso: string) => {
      const totalVerified = calculateVerifiedPaidForAssignment(targetAssignment.id, updatedPayments);
      const totalPending = calculatePendingPaidForAssignment(targetAssignment.id, updatedPayments);
      const safeAssigned = toSafeIntMWK(targetAssignment.assignedAmount);

      const newOutstanding = Math.max(0, safeAssigned - totalVerified);
      const overpaid = Math.max(0, totalVerified - safeAssigned);
      const newStatus = determineAssignmentPaymentStatus(
        safeAssigned,
        totalVerified,
        totalPending,
        targetAssignment.deadline,
        nowIso
      );

      setAssignments((prev) =>
        prev.map((a) => {
          if (a.id === targetAssignment.id) {
            const nextAssignment = { ...a, status: newStatus };
            syncToFirestore(
              `groups/${targetAssignment.groupId}/assignments`,
              nextAssignment.id,
              nextAssignment as unknown as Record<string, unknown>
            );
            return nextAssignment;
          }
          return a;
        })
      );

      setCommitments((prev) =>
        prev.map((c) => {
          if (c.assignmentId === targetAssignment.id) {
            const isSettled = newOutstanding <= 0;
            const nextStatus = isSettled
              ? ('completed' as const)
              : c.status === 'completed'
                ? ('active' as const)
                : c.status;
            const updated: PaymentCommitment = {
              ...c,
              currentOutstandingAmount: newOutstanding,
              amountAlreadyReceived: totalVerified,
              status: nextStatus,
              completedAt: isSettled ? c.completedAt || nowIso : undefined,
            };
            syncToFirestore(
              `groups/${targetAssignment.groupId}/commitments`,
              updated.id,
              updated as unknown as Record<string, unknown>
            );
            return updated;
          }
          return c;
        })
      );

      return { newOutstanding, overpaid, newStatus, totalVerified };
    },
    [syncToFirestore]
  );

  // Record payment (Admins/Treasurers verify immediately; Active Members submit pending_verification for their own assignment)
  const recordPayment: AppContextType['recordPayment'] = (params) => {
    if (!currentUser) {
      return { success: false, paymentId: '', newOutstanding: 0, error: 'Authentication required.' };
    }

    const targetAssignment = assignments.find((a) => a.id === params.assignmentId);
    if (!targetAssignment) {
      return { success: false, paymentId: '', newOutstanding: 0, error: 'Selected obligation not found.' };
    }

    const roleInTargetGroup = getRoleForGroupId(targetAssignment.groupId);
    const isVerifier = canVerifyPaymentsRole(roleInTargetGroup);
    const memberSelf = resolveMemberForUser(
      currentUser.id,
      currentUser.email,
      targetAssignment.groupId,
      groupMembers
    );

    if (!isVerifier) {
      const ownsAssignment =
        memberSelf &&
        (targetAssignment.memberId === memberSelf.id ||
          targetAssignment.memberId === memberSelf.userId ||
          targetAssignment.memberId === currentUser.id);
      if (!ownsAssignment || memberSelf?.status !== 'active') {
        addAuditLog('UNAUTHORIZED_PAYMENT_ATTEMPT', `User ${currentUser.email} blocked from submitting payment for another member`, {
          securityEvent: true,
          groupId: targetAssignment.groupId,
        });
        return {
          success: false,
          paymentId: '',
          newOutstanding: 0,
          error: 'You can only submit payment proof for your own active contribution.',
        };
      }
    }

    const parsedAmount = parseMWKInput(params.amount);
    if (!parsedAmount.valid) {
      return { success: false, paymentId: '', newOutstanding: 0, error: parsedAmount.error };
    }

    const refValidation = validateTransactionReference(
      params.paymentMethod,
      params.transactionReference,
      Boolean(params.receiptImageUrl)
    );
    if (!refValidation.valid) {
      return { success: false, paymentId: '', newOutstanding: 0, error: refValidation.error };
    }

    // Idempotency key duplicate guard
    if (params.idempotencyKey) {
      const existingByKey = payments.find((p) => p.idempotencyKey === params.idempotencyKey);
      if (existingByKey) {
        return {
          success: false,
          paymentId: existingByKey.id,
          newOutstanding: 0,
          error: 'This payment submission was already processed.',
        };
      }
    }

    const rawRef = refValidation.normalized || '';
    const isCustomRefProvided = Boolean(rawRef);
    const effectiveReference = isCustomRefProvided
      ? rawRef
      : params.receiptImageUrl
        ? `REC-IMG-${Math.random().toString(36).substring(2, 7).toUpperCase()}-${Math.floor(100 + Math.random() * 899)}`
        : `TX-${Date.now().toString().slice(-6)}`;

    // Duplicate transaction reference check across non-rejected, non-reversed payments
    if (isCustomRefProvided) {
      const duplicate = payments.find(
        (p) =>
          p.verificationStatus !== 'rejected' &&
          p.verificationStatus !== 'reversed' &&
          p.transactionReference.trim().toLowerCase() === rawRef.toLowerCase()
      );
      if (duplicate) {
        addAuditLog(
          'PAYMENT_DUPLICATE_REJECTED',
          `Duplicate transaction reference "${rawRef}" blocked (matches ${duplicate.id}).`,
          {
            securityEvent: true,
            targetEntity: 'payment',
            targetId: duplicate.id,
            groupId: targetAssignment.groupId,
          }
        );
        return {
          success: false,
          paymentId: '',
          newOutstanding: 0,
          error: `Transaction reference "${rawRef}" has already been recorded (${duplicate.id}).`,
        };
      }
    }

    const paymentId = `TX-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;
    const nowIso = new Date().toISOString();

    const isDirectAutoVerified = isVerifier;

    const newPayment: Payment = {
      id: paymentId,
      assignmentId: targetAssignment.id,
      contributionId: targetAssignment.contributionId,
      groupId: targetAssignment.groupId,
      memberId: targetAssignment.memberId,
      amountReceived: parsedAmount.value,
      paymentDate: nowIso,
      paymentMethod: params.paymentMethod,
      transactionReference: effectiveReference,
      idempotencyKey: params.idempotencyKey,
      receiptImageUrl: params.receiptImageUrl,
      receiptStoragePath: params.receiptStoragePath,
      receiptEvidenceUrl: params.receiptImageUrl,
      collectorId: currentUser.id,
      submittedByMemberId: !isVerifier ? memberSelf?.id : undefined,
      verificationStatus: isDirectAutoVerified ? 'verified' : 'pending_verification',
      verifiedAt: isDirectAutoVerified ? nowIso : undefined,
      verifiedBy: isDirectAutoVerified ? currentUser.id : undefined,
      receiptNote: params.receiptNote,
      createdAt: nowIso,
    };

    const updatedPayments = [newPayment, ...payments];
    setPayments(updatedPayments);

    syncToFirestore(
      `groups/${targetAssignment.groupId}/payments`,
      newPayment.id,
      newPayment as unknown as Record<string, unknown>,
      OperationType.CREATE
    );

    if (!isDirectAutoVerified) {
      const targetGroup = groups.find((g) => g.id === targetAssignment.groupId);
      if (targetGroup?.adminId) {
        addNotification(
          targetGroup.adminId,
          'Payment Proof Waiting Check',
          `${currentUser.name} submitted payment proof of MK ${parsedAmount.value.toLocaleString('en-US')} (Ref: ${effectiveReference}).`,
          'payment'
        );
      }
    }

    const { newOutstanding, overpaid, newStatus } = recomputeAssignmentAndCommitments(
      targetAssignment,
      updatedPayments,
      nowIso
    );

    // Log commitment settlement event if an active commitment exists
    const activeCommitment = commitments.find(
      (c) =>
        c.assignmentId === targetAssignment.id &&
        (c.status === 'active' ||
          c.status === 'due_soon' ||
          c.status === 'due_today' ||
          c.status === 'overdue' ||
          c.status === 'revised')
    );

    if (activeCommitment && isDirectAutoVerified) {
      const event: CommitmentEvent = {
        id: `cev_${Date.now()}`,
        commitmentId: activeCommitment.id,
        date: nowIso,
        eventType: newOutstanding <= 0 ? 'completed' : 'partial_payment',
        notes:
          newOutstanding <= 0
            ? `Settled in full with payment of MK ${parsedAmount.value.toLocaleString('en-US')}. Balance is now MK 0.`
            : `Partial payment of MK ${parsedAmount.value.toLocaleString('en-US')} received. Remaining balance: MK ${newOutstanding.toLocaleString('en-US')}.`,
        recordedBy: currentUser.id,
        amountPaid: parsedAmount.value,
      };
      setCommitmentEvents((prev) => [event, ...prev]);
      syncToFirestore(
        `groups/${targetAssignment.groupId}/commitmentEvents`,
        event.id,
        event as unknown as Record<string, unknown>,
        OperationType.CREATE
      );
    }

    addAuditLog(
      'PAYMENT_RECORDED',
      `Payment ${paymentId} of MK ${parsedAmount.value.toLocaleString('en-US')} recorded for assignment ${targetAssignment.id}. Ref: ${effectiveReference}.`,
      {
        targetEntity: 'payment',
        targetId: paymentId,
        afterValue: `MK ${parsedAmount.value.toLocaleString('en-US')} (${newPayment.verificationStatus})`,
        groupId: targetAssignment.groupId,
      }
    );

    addNotification(
      targetAssignment.memberId,
      'Payment Recorded',
      `Payment of MK ${parsedAmount.value.toLocaleString('en-US')} recorded via ${params.paymentMethod.replace('_', ' ')}. Ref: ${effectiveReference}.`,
      'payment'
    );

    // Automated intelligent communication dispatch to paying member
    if (currentGroup) {
      const payingMember = groupMembers.find(
        (m) => m.id === targetAssignment.memberId || m.userId === targetAssignment.memberId
      );
      const contribution = contributions.find((c) => c.id === targetAssignment.contributionId);
      const nextAssignments = assignments.map((a) =>
        a.id === targetAssignment.id ? { ...a, status: newStatus } : a
      );

      if (payingMember && notificationConfig.autoPaymentConfirmations) {
        try {
          const confirmationDispatch = createEmailCommunicationDispatch(
            currentGroup.id,
            currentGroup,
            currentUser.id,
            'payment_confirmation',
            'individual',
            `Payment Received Confirmation — ${currentGroup.name}`,
            '',
            [payingMember],
            nextAssignments,
            updatedPayments,
            contribution,
            newPayment
          );
          setCommunications((prev) => [confirmationDispatch, ...prev]);
          syncToFirestore(
            `groups/${currentGroup.id}/communications`,
            confirmationDispatch.id,
            confirmationDispatch as unknown as Record<string, unknown>,
            OperationType.CREATE
          );
        } catch (e) {
          console.warn('Auto confirmation email error:', e);
        }
      }

      if (payingMember && newOutstanding === 0 && notificationConfig.autoClearedBalanceNotes) {
        try {
          const clearedDispatch = createEmailCommunicationDispatch(
            currentGroup.id,
            currentGroup,
            currentUser.id,
            'cleared_balance',
            'individual',
            `Balance Cleared Notice — ${currentGroup.name}`,
            '',
            [payingMember],
            nextAssignments,
            updatedPayments,
            contribution
          );
          setCommunications((prev) => [clearedDispatch, ...prev]);
          syncToFirestore(
            `groups/${currentGroup.id}/communications`,
            clearedDispatch.id,
            clearedDispatch as unknown as Record<string, unknown>,
            OperationType.CREATE
          );
        } catch (e) {
          console.warn('Auto cleared balance email error:', e);
        }
      }
    }

    return {
      success: true,
      paymentId,
      newOutstanding,
      overpaid,
      verificationStatus: newPayment.verificationStatus,
    };
  };

  // Verify or Reject payment
  const verifyPayment = (paymentId: string, approved: boolean, reason?: string): ActionResult => {
    const payment = payments.find((p) => p.id === paymentId);
    if (!payment) return { success: false, error: 'Payment not found.' };
    if (!currentUser || !canVerifyPaymentsRole(getRoleForGroupId(payment.groupId))) {
      return { success: false, error: 'Insufficient permissions to verify payments.' };
    }
    if (payment.verificationStatus === 'reversed') {
      return { success: false, error: 'Reversed payments cannot be re-verified.' };
    }
    if (!approved && !reason?.trim()) {
      return { success: false, error: 'A rejection reason is required.' };
    }

    const nowIso = new Date().toISOString();
    const newStatus = approved ? ('verified' as const) : ('rejected' as const);
    const updatedPayment: Payment = {
      ...payment,
      verificationStatus: newStatus,
      verifiedAt: approved ? nowIso : undefined,
      verifiedBy: currentUser.id,
      rejectionReason: approved ? undefined : reason?.trim(),
    };
    const updatedPayments = payments.map((p) => (p.id === paymentId ? updatedPayment : p));
    setPayments(updatedPayments);

    syncToFirestore(
      `groups/${payment.groupId}/payments`,
      paymentId,
      updatedPayment as unknown as Record<string, unknown>
    );

    const targetAssignment = assignments.find((a) => a.id === payment.assignmentId);
    if (targetAssignment) {
      recomputeAssignmentAndCommitments(targetAssignment, updatedPayments, nowIso);
    }

    addAuditLog(
      approved ? 'PAYMENT_VERIFIED' : 'PAYMENT_REJECTED',
      `Payment ${paymentId} (${payment.transactionReference}) ${approved ? 'verified' : 'rejected'} by ${currentUser.name}.`,
      {
        targetEntity: 'payment',
        targetId: paymentId,
        reason: reason?.trim(),
        beforeValue: payment.verificationStatus,
        afterValue: newStatus,
        groupId: payment.groupId,
      }
    );

    addNotification(
      payment.memberId,
      approved ? 'Payment Verified' : 'Payment Rejected',
      approved
        ? `Your payment of MK ${payment.amountReceived.toLocaleString('en-US')} (${payment.transactionReference}) is verified.`
        : `Your payment of MK ${payment.amountReceived.toLocaleString('en-US')} was rejected: ${reason?.trim()}.`,
      'payment'
    );

    return { success: true };
  };

  // Non-destructive Payment Reversal (preserves original record & recalculates balances)
  const reversePayment = (paymentId: string, reason: string): ActionResult => {
    const payment = payments.find((p) => p.id === paymentId);
    if (!payment) return { success: false, error: 'Payment record not found.' };
    if (!currentUser || !canManageGroupRole(getRoleForGroupId(payment.groupId))) {
      addAuditLog('UNAUTHORIZED_REVERSAL_ATTEMPT', `User ${currentUser?.email || 'unknown'} blocked from reversing payment ${paymentId}`, {
        securityEvent: true,
      });
      return { success: false, error: 'Only administrators may reverse recorded payments.' };
    }
    const cleanReason = reason.trim();
    if (cleanReason.length < 5) {
      return { success: false, error: 'Please provide a clear reversal reason (at least 5 characters).' };
    }

    if (payment.verificationStatus === 'reversed') {
      return { success: false, error: 'This payment has already been reversed.' };
    }

    const nowIso = new Date().toISOString();
    const updatedPayment: Payment = {
      ...payment,
      verificationStatus: 'reversed',
      reversedAt: nowIso,
      reversedBy: currentUser.id,
      reversalReason: cleanReason,
    };
    const updatedPayments = payments.map((p) => (p.id === paymentId ? updatedPayment : p));
    setPayments(updatedPayments);

    syncToFirestore(
      `groups/${payment.groupId}/payments`,
      paymentId,
      updatedPayment as unknown as Record<string, unknown>
    );

    const targetAssignment = assignments.find((a) => a.id === payment.assignmentId);
    if (targetAssignment) {
      recomputeAssignmentAndCommitments(targetAssignment, updatedPayments, nowIso);
    }

    addAuditLog(
      'PAYMENT_REVERSED',
      `Reversed payment ${paymentId} (MK ${payment.amountReceived.toLocaleString('en-US')}, Ref: ${payment.transactionReference}). Original record preserved. Reason: ${cleanReason}`,
      {
        securityEvent: true,
        targetEntity: 'payment',
        targetId: paymentId,
        reason: cleanReason,
        beforeValue: `${payment.verificationStatus} (MK ${payment.amountReceived})`,
        afterValue: 'reversed',
        groupId: payment.groupId,
      }
    );

    return { success: true };
  };

  // Flag Payment as Disputed
  const disputePayment = (paymentId: string, reason: string): ActionResult => {
    const payment = payments.find((p) => p.id === paymentId);
    if (!payment) return { success: false, error: 'Payment not found.' };
    if (!currentUser || !canVerifyPaymentsRole(getRoleForGroupId(payment.groupId))) {
      return { success: false, error: 'Insufficient permissions to dispute payment.' };
    }
    const cleanReason = reason.trim();
    if (!cleanReason) {
      return { success: false, error: 'Please enter a reason for flagging this payment as disputed.' };
    }

    if (payment.verificationStatus === 'reversed') {
      return { success: false, error: 'Reversed payments cannot be disputed.' };
    }

    const nowIso = new Date().toISOString();
    const updatedPayment: Payment = {
      ...payment,
      verificationStatus: 'disputed',
      disputedAt: nowIso,
      disputedBy: currentUser.id,
      disputeReason: cleanReason,
    };
    const updatedPayments = payments.map((p) => (p.id === paymentId ? updatedPayment : p));
    setPayments(updatedPayments);

    syncToFirestore(
      `groups/${payment.groupId}/payments`,
      paymentId,
      updatedPayment as unknown as Record<string, unknown>
    );

    const targetAssignment = assignments.find((a) => a.id === payment.assignmentId);
    if (targetAssignment) {
      recomputeAssignmentAndCommitments(targetAssignment, updatedPayments, nowIso);
    }

    // Create linked dispute entry
    const disputeId = `dsp_${Date.now()}`;
    const linkedDispute: Dispute = {
      id: disputeId,
      groupId: payment.groupId,
      assignmentId: payment.assignmentId,
      relatedAssignmentId: payment.assignmentId,
      paymentId: payment.id,
      memberId: payment.memberId,
      title: `Payment Discrepancy: ${payment.id} (${payment.transactionReference})`,
      description: cleanReason,
      claimedAmount: payment.amountReceived,
      status: 'under_review',
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    setDisputes((prev) => [linkedDispute, ...prev]);
    syncToFirestore(
      `groups/${payment.groupId}/disputes`,
      disputeId,
      linkedDispute as unknown as Record<string, unknown>,
      OperationType.CREATE
    );

    addAuditLog(
      'PAYMENT_DISPUTED',
      `Payment ${paymentId} marked as disputed by ${currentUser.name}. Reason: ${cleanReason}`,
      {
        targetEntity: 'payment',
        targetId: paymentId,
        reason: cleanReason,
        beforeValue: payment.verificationStatus,
        afterValue: 'disputed',
        groupId: payment.groupId,
      }
    );

    return { success: true };
  };

  // Create payment commitment
  const createCommitment = (params: {
    assignmentId: string;
    promisedDate: string;
    durationDays: number;
    notes?: string;
  }) => {
    if (!currentUser) return false;
    const assignment = assignments.find((a) => a.id === params.assignmentId);
    if (!assignment) return false;

    const paidVerified = calculateVerifiedPaidForAssignment(assignment.id, payments);
    const outstanding = Math.max(0, toSafeIntMWK(assignment.assignedAmount) - paidVerified);
    if (outstanding <= 0) return false;

    const commitmentId = `cmt_${Date.now()}`;
    const nowIso = new Date().toISOString();

    const newCommitment: PaymentCommitment = {
      id: commitmentId,
      assignmentId: assignment.id,
      memberId: assignment.memberId,
      groupId: assignment.groupId,
      contributionId: assignment.contributionId,
      originalOutstandingAmount: outstanding,
      currentOutstandingAmount: outstanding,
      amountAlreadyReceived: paidVerified,
      commitmentDate: nowIso,
      promisedDate: params.promisedDate,
      durationDays: params.durationDays,
      collectorId: currentUser.id,
      notes: params.notes,
      status: 'active',
      memberConfirmed: true,
      extensionCount: 0,
    };

    const event: CommitmentEvent = {
      id: `cev_${Date.now()}`,
      commitmentId,
      date: nowIso,
      eventType: 'created',
      notes: `Commitment agreed: MK ${outstanding.toLocaleString('en-US')} promised by ${new Date(params.promisedDate).toLocaleDateString()}. (${params.durationDays} days duration)`,
      recordedBy: currentUser.id,
      newPromisedDate: params.promisedDate,
    };

    setCommitments((prev) => [newCommitment, ...prev]);
    setCommitmentEvents((prev) => [event, ...prev]);

    syncToFirestore(
      `groups/${assignment.groupId}/commitments`,
      commitmentId,
      newCommitment as unknown as Record<string, unknown>,
      OperationType.CREATE
    );
    syncToFirestore(
      `groups/${assignment.groupId}/commitmentEvents`,
      event.id,
      event as unknown as Record<string, unknown>,
      OperationType.CREATE
    );

    addAuditLog(
      'COMMITMENT_CREATED',
      `Created ${params.durationDays}-day commitment of MK ${outstanding.toLocaleString('en-US')} for member ${assignment.memberId}`,
      { targetEntity: 'commitment', targetId: commitmentId, groupId: assignment.groupId }
    );

    addNotification(
      assignment.memberId,
      'Payment Commitment Active',
      `Your promise to settle remaining MK ${outstanding.toLocaleString('en-US')} by ${new Date(params.promisedDate).toLocaleDateString()} has been recorded.`,
      'commitment'
    );

    return true;
  };

  // Request commitment extension
  const requestCommitmentExtension = (commitmentId: string, newDate: string, reason: string) => {
    if (!currentUser) return;
    const commitment = commitments.find((c) => c.id === commitmentId);
    if (!commitment) return;

    const updatedCommitment: PaymentCommitment = {
      ...commitment,
      status: 'extension_requested',
    };
    setCommitments((prev) =>
      prev.map((c) => (c.id === commitmentId ? updatedCommitment : c))
    );
    syncToFirestore(
      `groups/${commitment.groupId}/commitments`,
      commitmentId,
      updatedCommitment as unknown as Record<string, unknown>
    );

    const event: CommitmentEvent = {
      id: `cev_${Date.now()}`,
      commitmentId,
      date: new Date().toISOString(),
      eventType: 'extension_requested',
      notes: `Extension requested to ${new Date(newDate).toLocaleDateString()}. Reason: ${reason}`,
      recordedBy: currentUser.id,
      newPromisedDate: newDate,
    };
    setCommitmentEvents((prev) => [...prev, event]);
    syncToFirestore(
      `groups/${commitment.groupId}/commitmentEvents`,
      event.id,
      event as unknown as Record<string, unknown>,
      OperationType.CREATE
    );

    addAuditLog('EXTENSION_REQUESTED', `Extension requested on commitment ${commitmentId}: ${reason}`, {
      targetEntity: 'commitment',
      targetId: commitmentId,
      reason,
      groupId: commitment.groupId,
    });
  };

  // Approve extension
  const approveCommitmentExtension = (commitmentId: string, approved: boolean) => {
    const commitment = commitments.find((c) => c.id === commitmentId);
    if (!commitment || !currentUser || !canVerifyPaymentsRole(getRoleForGroupId(commitment.groupId))) return;

    const lastEvent = [...commitmentEvents]
      .reverse()
      .find((e) => e.commitmentId === commitmentId && e.eventType === 'extension_requested');

    const newDate = lastEvent?.newPromisedDate || commitment.promisedDate;
    const nextExtensionCount = approved ? commitment.extensionCount + 1 : commitment.extensionCount;
    const nextStatus = approved ? ('revised' as const) : ('active' as const);

    const updatedCommitment: PaymentCommitment = {
      ...commitment,
      promisedDate: approved ? newDate : commitment.promisedDate,
      status: nextStatus,
      extensionCount: nextExtensionCount,
    };

    setCommitments((prev) =>
      prev.map((c) => (c.id === commitmentId ? updatedCommitment : c))
    );

    syncToFirestore(
      `groups/${commitment.groupId}/commitments`,
      commitmentId,
      updatedCommitment as unknown as Record<string, unknown>
    );

    const event: CommitmentEvent = {
      id: `cev_${Date.now()}`,
      commitmentId,
      date: new Date().toISOString(),
      eventType: approved ? 'extension_granted' : 'revised',
      notes: approved
        ? `Extension granted by ${currentUser.name} to ${new Date(newDate).toLocaleDateString()}.`
        : `Extension request declined by ${currentUser.name}. Original deadline stands.`,
      recordedBy: currentUser.id,
      newPromisedDate: approved ? newDate : undefined,
    };
    setCommitmentEvents((prev) => [...prev, event]);
    syncToFirestore(
      `groups/${commitment.groupId}/commitmentEvents`,
      event.id,
      event as unknown as Record<string, unknown>,
      OperationType.CREATE
    );

    addAuditLog(
      approved ? 'EXTENSION_APPROVED' : 'EXTENSION_DECLINED',
      `Commitment ${commitmentId} extension ${approved ? 'approved' : 'declined'}.`,
      { targetEntity: 'commitment', targetId: commitmentId, groupId: commitment.groupId }
    );

    addNotification(
      commitment.memberId,
      approved ? 'Extension Approved' : 'Extension Declined',
      approved
        ? `Your payment commitment deadline has been moved to ${new Date(newDate).toLocaleDateString()}.`
        : 'Your extension request was declined. Please adhere to the original deadline.',
      'commitment'
    );
  };

  // Record Expense
  const recordExpense = (
    expenseData: Omit<Expense, 'id' | 'createdAt' | 'status'>
  ): ActionResult => {
    const roleInGrp = getRoleForGroupId(expenseData.groupId);
    if (!currentUser || !canVerifyPaymentsRole(roleInGrp)) {
      return { success: false, error: 'Insufficient permissions to record expenses.' };
    }
    const parsedAmount = parseMWKInput(expenseData.amount);
    if (!parsedAmount.valid) {
      return { success: false, error: parsedAmount.error };
    }

    const isAutoApproved = canManageGroupRole(roleInGrp);
    const nowIso = new Date().toISOString();

    const newExpense: Expense = {
      ...expenseData,
      amount: parsedAmount.value,
      id: `exp_${Date.now()}`,
      status: isAutoApproved ? 'approved' : 'pending_approval',
      approvedBy: isAutoApproved ? currentUser.id : undefined,
      approvedAt: isAutoApproved ? nowIso : undefined,
      createdAt: nowIso,
    };

    setExpenses((prev) => [newExpense, ...prev]);
    syncToFirestore(
      `groups/${expenseData.groupId}/expenses`,
      newExpense.id,
      newExpense as unknown as Record<string, unknown>,
      OperationType.CREATE
    );

    addAuditLog(
      'EXPENSE_RECORDED',
      `Expense of MK ${parsedAmount.value.toLocaleString('en-US')} for "${expenseData.name}" recorded.`,
      { targetEntity: 'expense', targetId: newExpense.id, groupId: expenseData.groupId }
    );

    return { success: true };
  };

  // Approve expense
  const approveExpense = (expenseId: string, approved: boolean): ActionResult => {
    const targetExpense = expenses.find((e) => e.id === expenseId);
    if (!targetExpense) return { success: false, error: 'Expense not found.' };
    if (!currentUser || !canManageGroupRole(getRoleForGroupId(targetExpense.groupId))) {
      return { success: false, error: 'Only administrators may approve or decline expenses.' };
    }

    const nowIso = new Date().toISOString();
    const nextStatus = approved ? ('approved' as const) : ('rejected' as const);

    const updatedExpense: Expense = {
      ...targetExpense,
      status: nextStatus,
      approvedBy: currentUser.id,
      approvedAt: nowIso,
    };

    setExpenses((prev) =>
      prev.map((e) => (e.id === expenseId ? updatedExpense : e))
    );

    syncToFirestore(
      `groups/${targetExpense.groupId}/expenses`,
      expenseId,
      updatedExpense as unknown as Record<string, unknown>
    );

    addAuditLog(
      approved ? 'EXPENSE_APPROVED' : 'EXPENSE_REJECTED',
      `Expense ${expenseId} ("${targetExpense.name}") was ${approved ? 'approved' : 'rejected'} by ${currentUser.name}.`,
      {
        targetEntity: 'expense',
        targetId: expenseId,
        beforeValue: targetExpense.status,
        afterValue: nextStatus,
        groupId: targetExpense.groupId,
      }
    );

    return { success: true };
  };

  // Create Contribution (respects explicit allocationMode: stove_rate only requires stove classification)
  const createContribution = (
    contributionData: Omit<Contribution, 'id' | 'createdAt'>,
    memberAssignments: { memberId: string; amount: number; notes?: string }[]
  ): ActionResult => {
    if (!currentUser || !canManageGroupRole(getRoleForGroupId(contributionData.groupId))) {
      return { success: false, error: 'Only administrators may create contribution obligations.' };
    }
    if (memberAssignments.length === 0) {
      return { success: false, error: 'At least one active member assignment is required.' };
    }

    const targetGroup = groups.find((g) => g.id === contributionData.groupId) || currentGroup;
    const allocationMode: ContributionAllocationMode =
      contributionData.allocationMode ||
      (isAccommodationGroup(targetGroup) && contributionData.category === 'electricity'
        ? 'stove_rate'
        : 'equal');

    for (const ma of memberAssignments) {
      const member = groupMembers.find(
        (m) => m.id === ma.memberId || m.userId === ma.memberId
      );
      if (!member) {
        return { success: false, error: `Member ${ma.memberId} was not found in this group.` };
      }
      if (allocationMode === 'stove_rate' && !isValidStoveType(member.stoveType)) {
        return {
          success: false,
          error: `Member "${member.name}" needs a stove type (Electric or Non-Electric) before using electricity stove-rate billing.`,
        };
      }
      const parsed = parseMWKInput(ma.amount);
      if (!parsed.valid) {
        return {
          success: false,
          error: `Invalid amount for ${member.name}: ${parsed.error}`,
        };
      }
    }

    const contributionId = `cntr_${Date.now()}`;
    const nowIso = new Date().toISOString();
    const totalTargetSafe = memberAssignments.reduce(
      (sum, ma) => sum + toSafeIntMWK(ma.amount),
      0
    );

    const newContribution: Contribution = {
      ...contributionData,
      allocationMode,
      totalTargetAmount: totalTargetSafe || toSafeIntMWK(contributionData.totalTargetAmount),
      id: contributionId,
      rateConfigVersion: allocationMode === 'stove_rate' ? RATE_CONFIG_VERSION : undefined,
      createdAt: nowIso,
    };

    const newAssignments: ContributionAssignment[] = memberAssignments.map((ma, idx) => {
      const member = groupMembers.find(
        (m) => m.id === ma.memberId || m.userId === ma.memberId
      )!;
      const stoveType =
        allocationMode === 'stove_rate' && isValidStoveType(member.stoveType)
          ? member.stoveType
          : undefined;
      return {
        id: `asg_${Date.now()}_${idx}`,
        contributionId,
        groupId: contributionData.groupId,
        memberId: ma.memberId,
        assignedAmount: toSafeIntMWK(ma.amount),
        applicableRate: stoveType ? RATES[stoveType] : undefined,
        stoveTypeAtAssignment: stoveType,
        rateConfigVersion: stoveType ? RATE_CONFIG_VERSION : undefined,
        assignedDate: nowIso,
        deadline: contributionData.deadline,
        notes: ma.notes || '',
        status: 'unpaid',
      };
    });

    setContributions((prev) => [newContribution, ...prev]);
    setAssignments((prev) => [...newAssignments, ...prev]);

    syncToFirestore(
      `groups/${contributionData.groupId}/contributions`,
      contributionId,
      newContribution as unknown as Record<string, unknown>,
      OperationType.CREATE
    );
    newAssignments.forEach((asg) => {
      syncToFirestore(
        `groups/${contributionData.groupId}/assignments`,
        asg.id,
        asg as unknown as Record<string, unknown>,
        OperationType.CREATE
      );
    });

    addAuditLog(
      'CONTRIBUTION_CREATED',
      `Created contribution "${contributionData.title}" (Target MK ${newContribution.totalTargetAmount.toLocaleString('en-US')}) for ${memberAssignments.length} members (${allocationMode}).`,
      {
        targetEntity: 'contribution',
        targetId: contributionId,
        groupId: contributionData.groupId,
      }
    );

    memberAssignments.forEach((ma) => {
      addNotification(
        ma.memberId,
        'New Contribution Set',
        `Your share for "${contributionData.title}" is MK ${toSafeIntMWK(ma.amount).toLocaleString('en-US')}. Due ${new Date(contributionData.deadline).toLocaleDateString()}.`,
        'announcement'
      );
    });

    return { success: true };
  };

  // Create Group + non-PII GroupInvite index
  const createGroup: AppContextType['createGroup'] = (groupData) => {
    if (!currentUser) return '';
    const groupId = `grp_${Date.now()}`;
    const randomCode = generateJoinCode('US');
    const nowIso = new Date().toISOString();
    const joinPolicy: GroupJoinPolicy = groupData.joinPolicy || 'code_auto';

    const newGroup: Group = {
      ...groupData,
      id: groupId,
      adminId: currentUser.id,
      treasurerId: currentUser.id,
      memberUids: [currentUser.id],
      defaultCurrency: 'MWK',
      joinCode: randomCode,
      joinPolicy,
      inviteRevoked: false,
      status: 'active',
      createdAt: nowIso,
      updatedAt: nowIso,
      memberCount: 1,
    };

    setGroups((prev) => [...prev, newGroup]);
    setCurrentGroup(newGroup);

    const newMember: GroupMember = {
      id: currentUser.id,
      groupId,
      userId: currentUser.id,
      linkedUserId: currentUser.id,
      name: currentUser.name,
      email: currentUser.email,
      phone: currentUser.phone,
      memberRefId: 'MEM-ADMIN-001',
      roleInGroup: 'admin',
      stoveType: isAccommodationGroup(newGroup) ? 'electric' : undefined,
      joinedAt: nowIso,
      createdAt: nowIso,
      updatedAt: nowIso,
      status: 'active',
    };
    const normalizedAdminMember = normalizeGroupMemberForSync(newMember, users);
    setGroupMembers((prev) => [...prev, normalizedAdminMember]);

    const inviteDoc: GroupInvite = {
      inviteCode: randomCode,
      groupId,
      groupName: newGroup.name,
      category: newGroup.category,
      joinPolicy,
      revoked: false,
      adminId: currentUser.id,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    syncToFirestore(
      'groups',
      groupId,
      newGroup as unknown as Record<string, unknown>,
      OperationType.CREATE
    ).then(() => {
      syncToFirestore(
        `groups/${groupId}/members`,
        currentUser.id,
        normalizedAdminMember as unknown as Record<string, unknown>,
        OperationType.CREATE
      );
      syncToFirestore(
        'groupInvites',
        randomCode,
        inviteDoc as unknown as Record<string, unknown>,
        OperationType.CREATE
      );
    });

    addAuditLog('GROUP_CREATED', `Group "${groupData.name}" created with join code ${randomCode}`, {
      targetEntity: 'group',
      targetId: groupId,
      groupId,
    });
    return groupId;
  };

  // Update Group settings
  const updateGroup: AppContextType['updateGroup'] = (groupId, updates) => {
    if (!currentUser || !canManageGroupRole(getRoleForGroupId(groupId))) {
      return { success: false, error: 'Only administrators may edit group details.' };
    }
    const existingGroup = groups.find((g) => g.id === groupId);
    if (!existingGroup) return { success: false, error: 'Group not found.' };

    const nowIso = new Date().toISOString();
    const nextGroup: Group = {
      ...existingGroup,
      ...updates,
      updatedAt: nowIso,
    };

    setGroups((prev) => prev.map((g) => (g.id === groupId ? nextGroup : g)));
    if (currentGroup?.id === groupId) {
      setCurrentGroup(nextGroup);
    }

    syncToFirestore('groups', groupId, nextGroup as unknown as Record<string, unknown>);
    if (nextGroup.joinCode) {
      syncToFirestore('groupInvites', nextGroup.joinCode, {
        inviteCode: nextGroup.joinCode,
        groupId: nextGroup.id,
        groupName: nextGroup.name,
        category: nextGroup.category,
        joinPolicy: nextGroup.joinPolicy || 'code_auto',
        revoked: Boolean(nextGroup.inviteRevoked),
        adminId: nextGroup.adminId,
        createdAt: nextGroup.createdAt,
        updatedAt: nowIso,
      });
    }

    addAuditLog('GROUP_UPDATED', `Updated settings for group "${nextGroup.name}"`, {
      targetEntity: 'group',
      targetId: groupId,
      beforeValue: existingGroup.name,
      afterValue: nextGroup.name,
      groupId,
    });
    return { success: true };
  };

  // Archive Group (non-destructive)
  const archiveGroup: AppContextType['archiveGroup'] = (groupId, reason) => {
    if (!currentUser || !canManageGroupRole(getRoleForGroupId(groupId))) {
      return { success: false, error: 'Only administrators may archive groups.' };
    }
    const target = groups.find((g) => g.id === groupId);
    if (!target) return { success: false, error: 'Group not found.' };

    const nowIso = new Date().toISOString();
    const cleanReason = reason.trim() || 'Archived by administrator';
    const archivedGroup: Group = {
      ...target,
      status: 'archived',
      archivedAt: nowIso,
      archivedBy: currentUser.id,
      archiveReason: cleanReason,
      updatedAt: nowIso,
    };

    const nextGroups = groups.map((g) => (g.id === groupId ? archivedGroup : g));
    setGroups(nextGroups);
    if (currentGroup?.id === groupId) {
      setCurrentGroup(nextGroups.find((g) => g.status !== 'archived') || null);
    }

    syncToFirestore('groups', groupId, archivedGroup as unknown as Record<string, unknown>);

    addAuditLog('GROUP_ARCHIVED', `Archived group "${target.name}". Reason: ${cleanReason}`, {
      securityEvent: true,
      targetEntity: 'group',
      targetId: groupId,
      reason: cleanReason,
      groupId,
    });

    return { success: true };
  };

  // Transfer Group Ownership
  const transferGroupOwnership: AppContextType['transferGroupOwnership'] = (
    groupId,
    newAdminMemberId,
    reason
  ) => {
    if (!currentUser || !canManageGroupRole(getRoleForGroupId(groupId))) {
      return { success: false, error: 'Only administrators may transfer group ownership.' };
    }
    const targetGroup = groups.find((g) => g.id === groupId);
    if (!targetGroup) return { success: false, error: 'Group not found.' };

    const candidate = groupMembers.find(
      (m) => m.groupId === groupId && (m.id === newAdminMemberId || m.userId === newAdminMemberId) && m.status === 'active'
    );
    if (!candidate) {
      return { success: false, error: 'Selected member must be active in this group.' };
    }

    const nowIso = new Date().toISOString();
    const prevAdminId = targetGroup.adminId;
    const nextGroup: Group = {
      ...targetGroup,
      adminId: candidate.linkedUserId || candidate.userId,
      updatedAt: nowIso,
    };

    setGroups((prev) => prev.map((g) => (g.id === groupId ? nextGroup : g)));
    if (currentGroup?.id === groupId) setCurrentGroup(nextGroup);

    const updatedCandidate = normalizeGroupMemberForSync(
      { ...candidate, roleInGroup: 'admin', updatedAt: nowIso },
      users,
      nowIso
    );

    setGroupMembers((prev) =>
      prev.map((m) =>
        m.groupId === groupId && (m.id === candidate.id || m.userId === candidate.userId)
          ? updatedCandidate
          : m
      )
    );

    syncToFirestore('groups', groupId, nextGroup as unknown as Record<string, unknown>);
    syncToFirestore(
      `groups/${groupId}/members`,
      candidate.id,
      updatedCandidate as unknown as Record<string, unknown>
    );

    addAuditLog(
      'GROUP_OWNERSHIP_TRANSFERRED',
      `Transferred ownership of "${targetGroup.name}" to ${candidate.name} (${candidate.email}). Reason: ${reason || 'Admin handover'}`,
      {
        securityEvent: true,
        targetEntity: 'group',
        targetId: groupId,
        reason: reason || 'Admin handover',
        beforeValue: prevAdminId,
        afterValue: candidate.userId,
        groupId,
      }
    );

    return { success: true };
  };

  // Invite Lookup by Code
  const lookupInviteByCode: AppContextType['lookupInviteByCode'] = async (code) => {
    const cleanCode = (code || '').trim().toUpperCase();
    if (!cleanCode || cleanCode.length < 4) {
      return { success: false, error: 'Enter a valid invite code (for example US-ABCD-12).' };
    }

    // Check local groups first (supports offline / same-device previews)
    const localMatch = groups.find(
      (g) => g.joinCode.toUpperCase() === cleanCode && g.status !== 'archived'
    );
    if (localMatch) {
      if (localMatch.inviteRevoked) {
        return { success: false, error: 'This invite code has been disabled by the group administrator.' };
      }
      return {
        success: true,
        data: {
          inviteCode: localMatch.joinCode,
          groupId: localMatch.id,
          groupName: localMatch.name,
          category: localMatch.category,
          joinPolicy: localMatch.joinPolicy || 'code_auto',
          revoked: Boolean(localMatch.inviteRevoked),
          adminId: localMatch.adminId,
          createdAt: localMatch.createdAt,
        },
      };
    }

    if (!firebaseAuthUser) {
      return { success: false, error: 'Please sign in to look up this group invite code.' };
    }

    try {
      const snap = await getDoc(doc(db, 'groupInvites', cleanCode));
      if (!snap.exists()) {
        return { success: false, error: 'No group found with that invite code. Please check with your group admin.' };
      }
      const invite = snap.data() as GroupInvite;
      if (invite.revoked) {
        return { success: false, error: 'This invite link is no longer active. Ask your admin for a new code.' };
      }
      return { success: true, data: invite };
    } catch (err) {
      console.warn('Invite lookup error:', err);
      return { success: false, error: 'Could not look up that code right now. Check your connection and try again.' };
    }
  };

  // Join Group by Code
  const joinGroupByCode: AppContextType['joinGroupByCode'] = async (code) => {
    if (!currentUser || !firebaseAuthUser) {
      return { success: false, error: 'Please sign in first to join a group.' };
    }
    if (!firebaseAuthUser.emailVerified) {
      return { success: false, error: 'Please verify your email address before joining a group.' };
    }

    const lookup = await lookupInviteByCode(code);
    if (!lookup.success || !lookup.data) {
      return { success: false, error: lookup.error || 'Invalid invite code.' };
    }

    const invite = lookup.data;
    const nowIso = new Date().toISOString();

    // Check if user is already an active member of this group
    const alreadyInGroup = groupMembers.find(
      (m) =>
        m.groupId === invite.groupId &&
        m.status === 'active' &&
        (m.userId === currentUser.id || m.linkedUserId === currentUser.id || m.id === currentUser.id)
    );
    if (alreadyInGroup) {
      const existingGroup = groups.find((g) => g.id === invite.groupId);
      if (existingGroup) setCurrentGroup(existingGroup);
      setPendingInviteCode(null);
      return {
        success: true,
        data: { groupId: invite.groupId, groupName: invite.groupName, status: 'joined' },
      };
    }

    if (invite.joinPolicy === 'admin_approval') {
      const reqDoc: JoinRequest = {
        id: currentUser.id,
        groupId: invite.groupId,
        userId: currentUser.id,
        name: currentUser.name,
        email: currentUser.email,
        phone: currentUser.phone || '',
        inviteCode: invite.inviteCode,
        status: 'pending',
        createdAt: nowIso,
      };
      setJoinRequests((prev) => [reqDoc, ...prev.filter((r) => r.id !== reqDoc.id)]);
      await syncToFirestore(
        `groups/${invite.groupId}/joinRequests`,
        reqDoc.id,
        reqDoc as unknown as Record<string, unknown>,
        OperationType.CREATE
      );
      setPendingInviteCode(null);
      return {
        success: true,
        data: { groupId: invite.groupId, groupName: invite.groupName, status: 'pending_approval' },
      };
    }

    // Auto-join via code
    const newMember: GroupMember = {
      id: currentUser.id,
      userId: currentUser.id,
      linkedUserId: currentUser.id,
      joinedViaInvite: true,
      groupId: invite.groupId,
      name: currentUser.name,
      email: currentUser.email.trim().toLowerCase(),
      phone: currentUser.phone || '',
      memberRefId: generateMemberReferenceId(invite.groupId, groupMembers.filter((m) => m.groupId === invite.groupId).length),
      roleInGroup: 'member',
      membershipDate: nowIso,
      joinedAt: nowIso,
      status: 'active',
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    try {
      await setDoc(
        doc(db, `groups/${invite.groupId}/members`, currentUser.id),
        sanitizeForFirestore(newMember as unknown as Record<string, unknown>),
        { merge: true }
      );
      await updateDoc(doc(db, 'groups', invite.groupId), {
        memberUids: arrayUnion(currentUser.id),
        memberCount: increment(1),
        updatedAt: nowIso,
      });

      const joinedSnap = await getDoc(doc(db, 'groups', invite.groupId));
      if (joinedSnap.exists()) {
        const joinedGroup = joinedSnap.data() as Group;
        setGroups((prev) => mergeItemsById(prev, [joinedGroup]));
        setCurrentGroup(joinedGroup);
      }
    } catch (err) {
      console.warn('Firestore auto-join failed:', err);
      return {
        success: false,
        error: 'Could not complete group join right now. Check your internet connection or ask your admin.',
      };
    }

    setGroupMembers((prev) => [...prev.filter((m) => !(m.groupId === invite.groupId && m.id === newMember.id)), newMember]);
    addNotification(
      invite.adminId,
      'New Member Joined',
      `${currentUser.name} joined ${invite.groupName} using the group invite code.`,
      'announcement'
    );
    setPendingInviteCode(null);

    return {
      success: true,
      data: { groupId: invite.groupId, groupName: invite.groupName, status: 'joined' },
    };
  };

  // Approve or Reject Join Request
  const approveJoinRequest: AppContextType['approveJoinRequest'] = async (
    groupId,
    requestId,
    approved
  ) => {
    if (!currentUser || !canManageGroupRole(getRoleForGroupId(groupId))) {
      return { success: false, error: 'Only group administrators may review join requests.' };
    }
    const req = joinRequests.find((r) => r.id === requestId && r.groupId === groupId);
    if (!req) return { success: false, error: 'Join request not found.' };

    const nowIso = new Date().toISOString();
    const updatedReq: JoinRequest = {
      ...req,
      status: approved ? 'approved' : 'rejected',
      reviewedAt: nowIso,
      reviewedBy: currentUser.id,
    };

    setJoinRequests((prev) => prev.map((r) => (r.id === requestId ? updatedReq : r)));
    await syncToFirestore(
      `groups/${groupId}/joinRequests`,
      requestId,
      updatedReq as unknown as Record<string, unknown>,
      OperationType.UPDATE
    );

    if (approved) {
      const targetGroup = groups.find((g) => g.id === groupId);
      const newMember: GroupMember = {
        id: req.userId,
        userId: req.userId,
        linkedUserId: req.userId,
        joinedViaInvite: true,
        groupId,
        name: req.name,
        email: req.email,
        phone: req.phone || '',
        memberRefId: generateMemberReferenceId(groupId, groupMembers.filter((m) => m.groupId === groupId).length),
        roleInGroup: 'member',
        membershipDate: nowIso,
        joinedAt: nowIso,
        status: 'active',
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      setGroupMembers((prev) => [...prev, newMember]);
      await syncToFirestore(
        `groups/${groupId}/members`,
        newMember.id,
        newMember as unknown as Record<string, unknown>,
        OperationType.CREATE
      );
      if (targetGroup) {
        const nextUids = Array.from(new Set([...(targetGroup.memberUids || [targetGroup.adminId]), req.userId]));
        const nextGroup = { ...targetGroup, memberUids: nextUids, memberCount: nextUids.length, updatedAt: nowIso };
        setGroups((prev) => prev.map((g) => (g.id === groupId ? nextGroup : g)));
        if (currentGroup?.id === groupId) setCurrentGroup(nextGroup);
        await syncToFirestore('groups', groupId, nextGroup as unknown as Record<string, unknown>, OperationType.UPDATE);
      }
      addNotification(
        req.userId,
        'Membership Approved',
        `You have been approved to join ${targetGroup?.name || 'the group'}.`,
        'announcement'
      );
    }

    return { success: true };
  };

  // Regenerate, revoke, or update invite policy
  const regenerateGroupInvite: AppContextType['regenerateGroupInvite'] = async (
    groupId,
    options = {}
  ) => {
    if (!currentUser || !canManageGroupRole(getRoleForGroupId(groupId))) {
      return { success: false, error: 'Only group administrators may manage invite links.' };
    }
    const targetGroup = groups.find((g) => g.id === groupId);
    if (!targetGroup) return { success: false, error: 'Group not found.' };

    const nowIso = new Date().toISOString();
    const oldCode = targetGroup.joinCode;
    const nextCode = options.regenerate ? generateJoinCode('US') : oldCode;
    const nextRevoked = typeof options.revoke === 'boolean' ? options.revoke : Boolean(targetGroup.inviteRevoked);
    const nextPolicy = options.joinPolicy || targetGroup.joinPolicy || 'code_auto';

    const nextGroup: Group = {
      ...targetGroup,
      joinCode: nextCode,
      joinPolicy: nextPolicy,
      inviteRevoked: options.regenerate ? false : nextRevoked,
      updatedAt: nowIso,
    };

    setGroups((prev) => prev.map((g) => (g.id === groupId ? nextGroup : g)));
    if (currentGroup?.id === groupId) setCurrentGroup(nextGroup);

    await syncToFirestore('groups', groupId, nextGroup as unknown as Record<string, unknown>);

    if (options.regenerate && oldCode !== nextCode) {
      await syncToFirestore('groupInvites', oldCode, {
        inviteCode: oldCode,
        groupId,
        groupName: nextGroup.name,
        category: nextGroup.category,
        joinPolicy: nextPolicy,
        revoked: true,
        adminId: nextGroup.adminId,
        createdAt: nextGroup.createdAt,
        updatedAt: nowIso,
      });
    }

    await syncToFirestore('groupInvites', nextCode, {
      inviteCode: nextCode,
      groupId,
      groupName: nextGroup.name,
      category: nextGroup.category,
      joinPolicy: nextPolicy,
      revoked: Boolean(nextGroup.inviteRevoked),
      adminId: nextGroup.adminId,
      createdAt: nowIso,
      updatedAt: nowIso,
    });

    return { success: true };
  };

  // Add Member Record (stoveType optional — only needed if an accommodation group uses electricity stove billing)
  const addMemberRecord: AppContextType['addMemberRecord'] = (params) => {
    if (!currentGroup) return { success: false, error: 'No active group selected.' };
    if (!currentUser || !canManageGroupRole(getRoleForGroupId(currentGroup.id))) {
      return { success: false, error: 'Only administrators may register new members.' };
    }

    if (!validateEmailAddress(params.email)) {
      return { success: false, error: 'Please enter a valid email address (e.g. name@domain.com).' };
    }

    if (params.stoveType && !isValidStoveType(params.stoveType)) {
      return {
        success: false,
        error: 'Invalid stove classification selected.',
      };
    }

    if (isDuplicateMemberEmail(params.email, currentGroup.id, groupMembers)) {
      return {
        success: false,
        error: `A member with email ${params.email} is already active in this group.`,
      };
    }

    const membersInGroup = groupMembers.filter((m) => m.groupId === currentGroup.id);
    const memberRefId = generateMemberReferenceId(currentGroup.id, membersInGroup.length);
    const memberId = `mem_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const nowIso = new Date().toISOString();

    const newGroupMember: GroupMember = {
      id: memberId,
      userId: memberId,
      memberRefId,
      groupId: currentGroup.id,
      name: params.name.trim(),
      email: params.email.trim().toLowerCase(),
      phone: params.phone?.trim() || '',
      stoveType: params.stoveType,
      stoveTypeReviewRequired: false,
      stoveTypeUpdatedAt: params.stoveType ? nowIso : undefined,
      stoveTypeUpdatedBy: params.stoveType ? currentUser.id : undefined,
      roomNumber: params.roomNumber?.trim() || '',
      notes: params.notes?.trim() || '',
      roleInGroup: params.role || 'member',
      membershipDate: nowIso,
      joinedAt: nowIso,
      status: 'active',
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    setGroupMembers((prev) => [...prev, newGroupMember]);
    setGroups((prev) =>
      prev.map((g) => (g.id === currentGroup.id ? { ...g, memberCount: g.memberCount + 1 } : g))
    );

    syncToFirestore(
      `groups/${currentGroup.id}/members`,
      memberId,
      newGroupMember as unknown as Record<string, unknown>,
      OperationType.CREATE
    );

    const stoveNote = newGroupMember.stoveType
      ? ` (${newGroupMember.stoveType === 'electric' ? 'Electric Stove MK 10,000' : 'Non-Electric Stove MK 5,000'})`
      : '';

    addAuditLog(
      'MEMBER_REGISTERED',
      `Admin registered member ${newGroupMember.name} (${memberRefId}, ${newGroupMember.email})${stoveNote} in group ${currentGroup.name}.`,
      {
        targetEntity: 'member',
        targetId: memberId,
        afterValue: newGroupMember.stoveType
          ? `${newGroupMember.stoveType} (MK ${RATES[newGroupMember.stoveType].toLocaleString('en-US')})`
          : 'Registered',
        groupId: currentGroup.id,
      }
    );

    if (notificationConfig.autoObligationNotice) {
      const welcomeDispatch = createEmailCommunicationDispatch(
        currentGroup.id,
        currentGroup,
        currentUser.id,
        'announcement',
        'individual',
        `Welcome to ${currentGroup.name} — Reference ${memberRefId}`,
        `Hello ${newGroupMember.name},\n\nYou have been added by ${currentUser.name} to ${currentGroup.name}.\n` +
          `Your member reference code is: ${memberRefId}.\n` +
          (newGroupMember.roomNumber ? `Unit / Role: ${newGroupMember.roomNumber}\n` : '') +
          `You can also join the app using invite code: ${currentGroup.joinCode}.\n\n` +
          `Thank you for keeping our shared money clear and accountable!`,
        [newGroupMember],
        [],
        []
      );
      setCommunications((prev) => [welcomeDispatch, ...prev]);
      syncToFirestore(
        `groups/${currentGroup.id}/communications`,
        welcomeDispatch.id,
        welcomeDispatch as unknown as Record<string, unknown>,
        OperationType.CREATE
      );
    }

    return { success: true, member: newGroupMember };
  };

  // Compat wrapper
  const addMemberToGroup: AppContextType['addMemberToGroup'] = (params) => {
    const res = addMemberRecord({
      name: params.name,
      email: params.email,
      phone: params.phone,
      stoveType: params.stoveType,
      roomNumber: params.roomNumber,
      notes: params.notes,
      role: params.role,
    });

    if (!res.success || !res.member) {
      return { success: false, error: res.error };
    }

    const mappedUser: User = {
      id: res.member.id,
      name: res.member.name,
      email: res.member.email,
      phone: res.member.phone,
      roomNumber: res.member.roomNumber,
      role: params.role === 'admin' ? 'group_admin' : 'member',
      createdAt: res.member.createdAt || new Date().toISOString(),
    };
    return { success: true, user: mappedUser, member: res.member };
  };

  // Update Member Record
  const updateMemberRecord = (memberId: string, updates: Partial<GroupMember>): boolean => {
    if (!currentGroup || !currentUser || !canManageGroupRole(getRoleForGroupId(currentGroup.id))) return false;
    const member = groupMembers.find(
      (m) => m.groupId === currentGroup.id && (m.id === memberId || m.userId === memberId)
    ) || groupMembers.find((m) => m.id === memberId || m.userId === memberId);
    if (!member) return false;

    const nowIso = new Date().toISOString();
    const updatedMember = normalizeGroupMemberForSync(
      { ...member, ...updates, updatedAt: nowIso },
      users,
      nowIso
    );

    setGroupMembers((prev) =>
      prev.map((m) => (m.id === member.id ? updatedMember : m))
    );

    syncToFirestore(
      `groups/${member.groupId}/members`,
      member.id,
      updatedMember as unknown as Record<string, unknown>
    );

    addAuditLog('MEMBER_UPDATED', `Updated directory record for member ${member.name}`, {
      targetEntity: 'member',
      targetId: member.id,
      groupId: member.groupId,
    });
    return true;
  };

  // Audited stove classification update (does NOT rewrite historical payments or closed contributions)
  const updateMemberStoveType: AppContextType['updateMemberStoveType'] = (
    memberId,
    stoveType,
    reason
  ) => {
    if (!currentGroup || !currentUser || !canManageGroupRole(getRoleForGroupId(currentGroup.id))) {
      return { success: false, error: 'Only administrators may update stove classifications.' };
    }
    if (!isValidStoveType(stoveType)) {
      return { success: false, error: 'Invalid stove classification.' };
    }
    const cleanReason = reason.trim();
    if (cleanReason.length < 3) {
      return {
        success: false,
        error: 'Please enter a reason for updating this member’s stove classification.',
      };
    }

    const member =
      groupMembers.find(
        (m) => m.groupId === currentGroup.id && (m.id === memberId || m.userId === memberId)
      ) || groupMembers.find((m) => m.id === memberId || m.userId === memberId);
    if (!member) return { success: false, error: 'Member not found.' };

    const nowIso = new Date().toISOString();
    const prevStove = member.stoveType || 'unset';
    const updatedMember = normalizeGroupMemberForSync(
      {
        ...member,
        stoveType,
        stoveTypeReviewRequired: false,
        stoveTypeUpdatedAt: nowIso,
        stoveTypeUpdatedBy: currentUser.id,
        stoveTypeChangeReason: cleanReason,
        updatedAt: nowIso,
      },
      users,
      nowIso
    );

    setGroupMembers((prev) =>
      prev.map((m) => (m.id === member.id ? updatedMember : m))
    );

    syncToFirestore(
      `groups/${member.groupId}/members`,
      member.id,
      updatedMember as unknown as Record<string, unknown>
    );

    addAuditLog(
      'MEMBER_STOVE_TYPE_UPDATED',
      `Updated stove classification for ${updatedMember.name} from ${prevStove} to ${stoveType} (MK ${RATES[stoveType].toLocaleString('en-US')}). Reason: ${cleanReason}`,
      {
        targetEntity: 'member',
        targetId: member.id,
        reason: cleanReason,
        beforeValue: String(prevStove),
        afterValue: `${stoveType} (MK ${RATES[stoveType].toLocaleString('en-US')})`,
        groupId: member.groupId,
      }
    );

    return { success: true };
  };

  // Suspend Member
  const suspendMember: AppContextType['suspendMember'] = (memberId, reason) => {
    if (!currentGroup || !currentUser || !canManageGroupRole(getRoleForGroupId(currentGroup.id))) {
      return { success: false, error: 'Only administrators may suspend members.' };
    }
    const member =
      groupMembers.find(
        (m) => m.groupId === currentGroup.id && (m.id === memberId || m.userId === memberId)
      ) || groupMembers.find((m) => m.id === memberId || m.userId === memberId);
    if (!member) return { success: false, error: 'Member not found.' };

    const cleanReason = reason.trim() || 'Suspended by administrator';
    const nowIso = new Date().toISOString();
    const updatedMember = normalizeGroupMemberForSync(
      {
        ...member,
        status: 'suspended',
        suspendedAt: nowIso,
        suspensionReason: cleanReason,
        updatedAt: nowIso,
      },
      users,
      nowIso
    );

    setGroupMembers((prev) =>
      prev.map((m) => (m.id === member.id ? updatedMember : m))
    );

    syncToFirestore(
      `groups/${member.groupId}/members`,
      member.id,
      updatedMember as unknown as Record<string, unknown>
    );

    addAuditLog('MEMBER_SUSPENDED', `Suspended ${updatedMember.name} (${updatedMember.email}). Reason: ${cleanReason}`, {
      securityEvent: true,
      targetEntity: 'member',
      targetId: member.id,
      reason: cleanReason,
      beforeValue: member.status,
      afterValue: 'suspended',
      groupId: member.groupId,
    });

    return { success: true };
  };

  // Reinstate Member
  const reinstateMember: AppContextType['reinstateMember'] = (memberId, reason) => {
    if (!currentGroup || !currentUser || !canManageGroupRole(getRoleForGroupId(currentGroup.id))) {
      return { success: false, error: 'Only administrators may reinstate members.' };
    }
    const member =
      groupMembers.find(
        (m) => m.groupId === currentGroup.id && (m.id === memberId || m.userId === memberId)
      ) || groupMembers.find((m) => m.id === memberId || m.userId === memberId);
    if (!member) return { success: false, error: 'Member not found.' };

    const cleanReason = reason.trim() || 'Reinstated by administrator';
    const nowIso = new Date().toISOString();
    const updatedMember = normalizeGroupMemberForSync(
      {
        ...member,
        status: 'active',
        updatedAt: nowIso,
      },
      users,
      nowIso
    );

    setGroupMembers((prev) =>
      prev.map((m) => (m.id === member.id ? updatedMember : m))
    );

    syncToFirestore(
      `groups/${member.groupId}/members`,
      member.id,
      updatedMember as unknown as Record<string, unknown>
    );

    addAuditLog('MEMBER_REINSTATED', `Reinstated ${updatedMember.name} to active status. Reason: ${cleanReason}`, {
      targetEntity: 'member',
      targetId: member.id,
      reason: cleanReason,
      beforeValue: member.status,
      afterValue: 'active',
      groupId: member.groupId,
    });

    return { success: true };
  };

  // Change Member Role
  const changeMemberRole: AppContextType['changeMemberRole'] = (memberId, newRole, reason) => {
    if (!currentGroup || !currentUser || !canManageGroupRole(getRoleForGroupId(currentGroup.id))) {
      return { success: false, error: 'Only administrators may change member roles.' };
    }
    const member =
      groupMembers.find(
        (m) => m.groupId === currentGroup.id && (m.id === memberId || m.userId === memberId)
      ) || groupMembers.find((m) => m.id === memberId || m.userId === memberId);
    if (!member) return { success: false, error: 'Member not found.' };

    const prevRole = member.roleInGroup;
    const nowIso = new Date().toISOString();
    const updatedMember = normalizeGroupMemberForSync(
      {
        ...member,
        roleInGroup: newRole,
        updatedAt: nowIso,
      },
      users,
      nowIso
    );

    setGroupMembers((prev) =>
      prev.map((m) => (m.id === member.id ? updatedMember : m))
    );

    syncToFirestore(
      `groups/${member.groupId}/members`,
      member.id,
      updatedMember as unknown as Record<string, unknown>
    );

    addAuditLog(
      'MEMBER_ROLE_CHANGED',
      `Changed role of ${updatedMember.name} from ${prevRole} to ${newRole}. Reason: ${reason || 'Admin role assignment'}`,
      {
        securityEvent: true,
        targetEntity: 'member',
        targetId: member.id,
        reason: reason || 'Admin role assignment',
        beforeValue: prevRole,
        afterValue: newRole,
        groupId: member.groupId,
      }
    );

    return { success: true };
  };

  // Remove Member Record (Soft remove preserving all historical transactions & audit logs)
  const removeMemberRecord = (memberId: string, reason?: string): boolean => {
    if (!currentGroup || !currentUser || !canManageGroupRole(getRoleForGroupId(currentGroup.id))) return false;
    const member =
      groupMembers.find(
        (m) => m.groupId === currentGroup.id && (m.id === memberId || m.userId === memberId)
      ) || groupMembers.find((m) => m.id === memberId || m.userId === memberId);
    if (!member) return false;

    const nowIso = new Date().toISOString();
    const cleanReason = reason?.trim() || 'Removed by administrator';
    const updatedMember = normalizeGroupMemberForSync(
      {
        ...member,
        status: 'removed',
        removedAt: nowIso,
        removalReason: cleanReason,
        updatedAt: nowIso,
      },
      users,
      nowIso
    );

    setGroupMembers((prev) =>
      prev.map((m) => (m.id === member.id ? updatedMember : m))
    );

    setGroups((prev) =>
      prev.map((g) =>
        g.id === member.groupId ? { ...g, memberCount: Math.max(1, g.memberCount - 1) } : g
      )
    );

    syncToFirestore(
      `groups/${member.groupId}/members`,
      member.id,
      updatedMember as unknown as Record<string, unknown>
    );

    addAuditLog(
      'MEMBER_REMOVED',
      `Admin removed member ${member.name} (${member.email}). Reason: ${cleanReason}. Historical transactions preserved.`,
      {
        securityEvent: true,
        targetEntity: 'member',
        targetId: member.id,
        reason: cleanReason,
        beforeValue: member.status,
        afterValue: 'removed',
        groupId: currentGroup.id,
      }
    );

    return true;
  };

  const removeMemberFromGroup = (userId: string, reason?: string) => {
    return removeMemberRecord(userId, reason);
  };

  // Send Communication
  const sendCommunication = (params: {
    type: CommunicationType;
    targetAudience: AudienceType;
    subject: string;
    message: string;
    contributionId?: string;
    individualMemberId?: string;
  }): EmailCommunication | null => {
    if (!currentGroup || !currentUser) return null;

    const targetMembers = filterTargetAudience(
      currentGroup.id,
      params.targetAudience,
      groupMembers,
      assignments,
      payments,
      params.contributionId,
      params.individualMemberId
    );

    if (targetMembers.length === 0) {
      return null;
    }

    const contribution = params.contributionId
      ? contributions.find((c) => c.id === params.contributionId)
      : undefined;

    const dispatch = createEmailCommunicationDispatch(
      currentGroup.id,
      currentGroup,
      currentUser.id,
      params.type,
      params.targetAudience,
      params.subject,
      params.message,
      targetMembers,
      assignments,
      payments,
      contribution
    );

    setCommunications((prev) => [dispatch, ...prev]);

    syncToFirestore(
      `groups/${currentGroup.id}/communications`,
      dispatch.id,
      dispatch as unknown as Record<string, unknown>,
      OperationType.CREATE
    );

    addAuditLog(
      'COMMUNICATION_DISPATCHED',
      `Dispatched ${params.type.replace('_', ' ')} "${params.subject}" to ${dispatch.recipientCount} recipient(s). Audience: ${params.targetAudience}`,
      { targetEntity: 'communication', targetId: dispatch.id, groupId: currentGroup.id }
    );

    return dispatch;
  };

  const updateNotificationConfig = (config: Partial<NotificationScheduleConfig>) => {
    setNotificationConfig((prev) => ({
      ...prev,
      ...config,
    }));
    addAuditLog('NOTIFICATION_SETTINGS_UPDATED', 'Updated automatic notification rules');
  };

  // Submit dispute
  const submitDispute = (disputeData: Omit<Dispute, 'id' | 'createdAt' | 'updatedAt' | 'status'>) => {
    if (!currentUser) return;
    const nowIso = new Date().toISOString();
    const disputeId = `dsp_${Date.now()}`;

    const newDispute: Dispute = {
      ...disputeData,
      claimedAmount: disputeData.claimedAmount ? toSafeIntMWK(disputeData.claimedAmount) : undefined,
      id: disputeId,
      status: 'open',
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    setDisputes((prev) => [newDispute, ...prev]);

    syncToFirestore(
      `groups/${disputeData.groupId}/disputes`,
      disputeId,
      newDispute as unknown as Record<string, unknown>,
      OperationType.CREATE
    );

    addAuditLog('DISPUTE_SUBMITTED', `Dispute filed by ${currentUser.name}: ${disputeData.title}`, {
      targetEntity: 'dispute',
      targetId: disputeId,
      groupId: disputeData.groupId,
    });

    if (currentGroup?.adminId) {
      addNotification(
        currentGroup.adminId,
        'New Dispute Filed',
        `${currentUser.name} submitted a dispute: "${disputeData.title}".`,
        'dispute'
      );
    }
  };

  // Resolve dispute
  const resolveDispute = (
    disputeId: string,
    resolutionNote: string,
    status: 'resolved' | 'rejected'
  ) => {
    const dispute = disputes.find((d) => d.id === disputeId);
    if (!dispute || !currentUser || !canManageGroupRole(getRoleForGroupId(dispute.groupId))) return;
    const nowIso = new Date().toISOString();

    const updatedDispute: Dispute = {
      ...dispute,
      status,
      resolutionNote,
      resolvedBy: currentUser.id,
      updatedAt: nowIso,
    };

    setDisputes((prev) =>
      prev.map((d) => (d.id === disputeId ? updatedDispute : d))
    );

    syncToFirestore(
      `groups/${dispute.groupId}/disputes`,
      disputeId,
      updatedDispute as unknown as Record<string, unknown>
    );

    addAuditLog('DISPUTE_RESOLVED', `Dispute ${disputeId} marked as ${status} by ${currentUser.name}`, {
      targetEntity: 'dispute',
      targetId: disputeId,
      reason: resolutionNote,
      beforeValue: dispute.status,
      afterValue: status,
      groupId: dispute.groupId,
    });

    addNotification(
      dispute.memberId,
      `Dispute ${status === 'resolved' ? 'Resolved' : 'Declined'}`,
      `Outcome on your dispute "${dispute.title}": ${resolutionNote}`,
      'dispute'
    );
  };

  const markNotificationRead = (id: string) => {
    const target = notifications.find((n) => n.id === id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    if (firebaseAuthUser && target && target.userId === firebaseAuthUser.uid && !target.read) {
      syncToFirestore(
        `users/${target.userId}/notifications`,
        target.id,
        { ...target, read: true } as unknown as Record<string, unknown>,
        OperationType.UPDATE
      );
    }
  };

  const markAllNotificationsRead = () => {
    const unreadOwned = notifications.filter(
      (n) => !n.read && firebaseAuthUser && n.userId === firebaseAuthUser.uid
    );
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    unreadOwned.forEach((n) => {
      syncToFirestore(
        `users/${n.userId}/notifications`,
        n.id,
        { ...n, read: true } as unknown as Record<string, unknown>,
        OperationType.UPDATE
      );
    });
  };

  const rescanAndRepairRecords = (): IntegrityReport => {
    const res = auditAndRepairFinancialData({
      groups,
      groupMembers,
      contributions,
      assignments,
      payments,
      commitments,
      expenses,
    });
    setIntegrityReport(res.report);
    if (res.report.repairedCount > 0 || res.report.flaggedCount > 0) {
      setGroupMembers(res.groupMembers);
      setContributions(res.contributions);
      setAssignments(res.assignments);
      setPayments(res.payments);
      setCommitments(res.commitments);
      setExpenses(res.expenses);
    }
    addAuditLog(
      'DATA_INTEGRITY_SCAN',
      `Integrity scan complete: ${res.report.repairedCount} repaired, ${res.report.flaggedCount} flagged for admin review.`,
      { targetEntity: 'system', targetId: 'integrity_scan' }
    );
    return res.report;
  };

  const restorePreRepairSnapshot = (): ActionResult => {
    if (!currentUser || !canManageGroupRole(effectiveRole)) {
      return { success: false, error: 'Only administrators may restore snapshots.' };
    }
    const raw = localStorage.getItem(PRE_REPAIR_SNAPSHOT_KEY);
    if (!raw) {
      return { success: false, error: 'No pre-repair snapshot is stored.' };
    }
    try {
      const snap = JSON.parse(raw);
      if (snap.groupMembers) setGroupMembers(snap.groupMembers);
      if (snap.contributions) setContributions(snap.contributions);
      if (snap.assignments) setAssignments(snap.assignments);
      if (snap.payments) setPayments(snap.payments);
      if (snap.commitments) setCommitments(snap.commitments);
      if (snap.expenses) setExpenses(snap.expenses);
      addAuditLog('SNAPSHOT_RESTORED', `Restored pre-repair snapshot saved at ${snap.savedAt}`, {
        securityEvent: true,
      });
      return { success: true };
    } catch {
      return { success: false, error: 'Stored snapshot could not be parsed.' };
    }
  };

  const clearAllData = () => {
    localStorage.removeItem(`${STORAGE_KEY}_users`);
    localStorage.removeItem(`${STORAGE_KEY}_groups`);
    localStorage.removeItem(`${STORAGE_KEY}_currentGroup`);
    localStorage.removeItem(`${STORAGE_KEY}_groupMembers`);
    localStorage.removeItem(`${STORAGE_KEY}_contributions`);
    localStorage.removeItem(`${STORAGE_KEY}_assignments`);
    localStorage.removeItem(`${STORAGE_KEY}_payments`);
    localStorage.removeItem(`${STORAGE_KEY}_commitments`);
    localStorage.removeItem(`${STORAGE_KEY}_commitmentEvents`);
    localStorage.removeItem(`${STORAGE_KEY}_expenses`);
    localStorage.removeItem(`${STORAGE_KEY}_disputes`);
    localStorage.removeItem(`${STORAGE_KEY}_notifications`);
    localStorage.removeItem(`${STORAGE_KEY}_auditLogs`);
    localStorage.removeItem(`${STORAGE_KEY}_communications`);

    setUsers(currentUser ? [currentUser] : []);
    setGroups([]);
    setCurrentGroup(null);
    setGroupMembers([]);
    setContributions([]);
    setAssignments([]);
    setPayments([]);
    setCommitments([]);
    setCommitmentEvents([]);
    setExpenses([]);
    setDisputes([]);
    setJoinRequests([]);
    setNotifications([]);
    setAuditLogs([]);
    setCommunications([]);
    setIntegrityReport(null);
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        setCurrentUser,
        authStatus,
        authError,
        clearAuthError: () => setAuthError(null),
        firebaseAuthUser,
        isEmailVerified,
        signInWithGoogle,
        signInWithEmailAccount,
        signUpWithEmailAccount,
        sendPasswordReset,
        resendVerification,
        refreshAuthVerification,
        signOut,
        isFirebaseReady,
        language,
        setLanguage,
        strings,
        syncStatus,
        pendingInviteCode,
        setPendingInviteCode,
        effectiveRole,
        currentMemberRecord,
        actionError,
        clearActionError: () => setActionError(null),
        users,
        groups,
        currentGroup,
        setCurrentGroup,
        groupMembers,
        contributions,
        assignments,
        payments,
        commitments,
        commitmentEvents,
        expenses,
        disputes,
        joinRequests,
        notifications,
        auditLogs,
        communications,
        notificationConfig,
        integrityReport,
        hasPreRepairSnapshot,
        recordPayment,
        verifyPayment,
        reversePayment,
        disputePayment,
        createCommitment,
        requestCommitmentExtension,
        approveCommitmentExtension,
        recordExpense,
        approveExpense,
        createContribution,
        createGroup,
        updateGroup,
        archiveGroup,
        transferGroupOwnership,
        lookupInviteByCode,
        joinGroupByCode,
        approveJoinRequest,
        regenerateGroupInvite,
        addMemberToGroup,
        addMemberRecord,
        updateMemberRecord,
        updateMemberStoveType,
        suspendMember,
        reinstateMember,
        changeMemberRole,
        removeMemberRecord,
        removeMemberFromGroup,
        sendCommunication,
        updateNotificationConfig,
        submitDispute,
        resolveDispute,
        markNotificationRead,
        markAllNotificationsRead,
        rescanAndRepairRecords,
        restorePreRepairSnapshot,
        clearAllData,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

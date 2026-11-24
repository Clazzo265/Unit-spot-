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
import { DEFAULT_NOTIFICATION_CONFIG } from '../data/initialData';
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
  isStoveBillingApplicable,
  formatDeadlineLabel,
  generateJoinCode,
  extractInviteCodeFromUrl,
  createInviteExpiry,
  isInviteExpired,
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
  validateLeaveGroupEligibility,
  EffectiveGroupRole,
} from '../utils/centralizedFinancialAdmin';
import {
  stripDataUrlsFromPayments,
  stripDataUrlsFromExpenses,
  persistStorageWithFallback,
  mergeItemsById,
  getAccountStorageKey,
  purgeLegacyUnscopedStorage,
  purgeAccountScopedStorage,
  readUidScopedStorage,
} from '../utils/storageUtils';
import { AppLanguage, getLocaleStrings, LocaleDictionary } from '../utils/i18n';
import { formatFriendlyFirestoreError } from '../utils/uploadUtils';
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
  cancelAllActiveUploads,
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
  onSnapshot,
  query,
  where,
  arrayUnion,
  arrayRemove,
  increment,
  updateDoc,
  deleteField,
  writeBatch,
} from 'firebase/firestore';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AppContextType {
  currentUser: User | null;
  setCurrentUser: (user: User) => void;
  authStatus: AuthStatus;
  isHydratingAccount: boolean;
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
    paymentDate?: string;
    transactionReference?: string;
    idempotencyKey?: string;
    receiptImageUrl?: string;
    receiptStoragePath?: string;
    receiptFileName?: string;
    receiptFileType?: string;
    receiptFileSize?: number;
    receiptNote?: string;
    verifyImmediately?: boolean;
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
    memberAssignments: {
      memberId: string;
      amount: number;
      allocationPercentage?: number;
      notes?: string;
    }[]
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
  leaveGroup: (
    groupId: string,
    options?: { transferToMemberId?: string; reason?: string }
  ) => Promise<ActionResult & { code?: string }>;
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

const LANG_STORAGE_KEY = 'unitspot_lang';

const AppContext = createContext<AppContextType | null>(null);

function replaceGroupScopedItems<T extends { groupId: string }>(
  prev: T[],
  groupId: string,
  incoming: T[],
  sortCompare?: (a: T, b: T) => number
): T[] {
  const otherGroups = prev.filter((item) => item.groupId !== groupId);
  const next = [...otherGroups, ...incoming];
  if (sortCompare) next.sort(sortCompare);
  return next;
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseAuthUser, setFirebaseAuthUser] = useState<FirebaseUser | null>(null);
  const [isFirebaseReady, setIsFirebaseReady] = useState(false);
  const [authStatus, setAuthStatus] = useState<AuthStatus>('loading');
  const [isHydratingAccount, setIsHydratingAccount] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<CloudSyncStatus>(() =>
    typeof navigator !== 'undefined' && !navigator.onLine ? 'offline_queued' : 'synced'
  );
  const [language, setLanguageState] = useState<AppLanguage>(() => {
    try {
      const saved = localStorage.getItem(LANG_STORAGE_KEY);
      return saved === 'ny' ? 'ny' : 'en';
    } catch {
      return 'en';
    }
  });
  const languageRef = useRef<AppLanguage>(language);
  useEffect(() => {
    languageRef.current = language;
  }, [language]);

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

  // Security isolation invariant: initialize all account/financial state strictly empty on boot.
  // Data hydrates ONLY after Firebase Auth confirms an authenticated UID.
  const activeUidRef = useRef<string | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const usersRef = useRef<User[]>(users);
  useEffect(() => {
    usersRef.current = users;
  }, [users]);

  const [currentUser, setCurrentUserState] = useState<User | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [currentGroup, setCurrentGroupState] = useState<Group | null>(null);
  const setCurrentGroup = useCallback((group: Group | null) => {
    setCurrentGroupState(group);
  }, []);

  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const groupMembersRef = useRef<GroupMember[]>(groupMembers);
  useEffect(() => {
    groupMembersRef.current = groupMembers;
  }, [groupMembers]);

  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [assignments, setAssignments] = useState<ContributionAssignment[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [commitments, setCommitments] = useState<PaymentCommitment[]>([]);
  const [commitmentEvents, setCommitmentEvents] = useState<CommitmentEvent[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [communications, setCommunications] = useState<EmailCommunication[]>([]);
  const [notificationConfig, setNotificationConfig] = useState<NotificationScheduleConfig>(
    DEFAULT_NOTIFICATION_CONFIG
  );

  const [integrityReport, setIntegrityReport] = useState<IntegrityReport | null>(null);
  const [hasPreRepairSnapshot, setHasPreRepairSnapshot] = useState<boolean>(false);

  const resetInMemoryState = useCallback(() => {
    setUsers([]);
    setGroups([]);
    setCurrentGroupState(null);
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
    setNotificationConfig(DEFAULT_NOTIFICATION_CONFIG);
    setIntegrityReport(null);
    setHasPreRepairSnapshot(false);
    setActionError(null);
  }, []);

  // Purge any legacy unscoped financial localStorage keys immediately on mount
  useEffect(() => {
    try {
      purgeLegacyUnscopedStorage(localStorage);
    } catch {
      // ignore storage errors
    }
  }, []);

  const isEmailVerified = firebaseAuthUser ? Boolean(firebaseAuthUser.emailVerified) : false;

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
      const target =
        groups.find((g) => g.id === targetGroupId) || currentGroup || undefined;
      return getEffectiveGroupRole(currentUser, target, groupMembers);
    },
    [currentUser, groups, currentGroup, groupMembers]
  );

  const resolveMemberUid = useCallback(
    (memberId: string | undefined, targetGroupId?: string): string | undefined => {
      if (!memberId) return undefined;
      const scoped = groupMembersRef.current.find(
        (m) =>
          (!targetGroupId || m.groupId === targetGroupId) &&
          (m.id === memberId || m.userId === memberId || m.linkedUserId === memberId)
      );
      if (scoped?.linkedUserId) return scoped.linkedUserId;
      if (scoped?.userId && !scoped.userId.startsWith('mem_')) return scoped.userId;
      if (!memberId.startsWith('mem_')) return memberId;
      return undefined;
    },
    []
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
      op: OperationType = OperationType.WRITE,
      onRejected?: () => void,
      silent?: boolean
    ): Promise<void> => {
      const expectedUid = firebaseAuthUser?.uid;
      if (!expectedUid || activeUidRef.current !== expectedUid) return;
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setSyncStatus('offline_queued');
        return;
      }
      setSyncStatus('syncing');
      try {
        await setDoc(doc(db, path, docId), sanitizeForFirestore(data), { merge: true });
        if (activeUidRef.current === expectedUid) {
          setSyncStatus('synced');
        }
      } catch (err) {
        if (activeUidRef.current !== expectedUid) return;
        const offlineNow = typeof navigator !== 'undefined' && !navigator.onLine;
        setSyncStatus(offlineNow ? 'offline_queued' : 'error');
        if (!offlineNow && onRejected) {
          onRejected();
        }
        try {
          handleFirestoreError(err, op, `${path}/${docId}`);
        } catch (wrapped) {
          console.warn(wrapped);
          if (!silent) {
            setActionError(
              offlineNow
                ? 'You are offline. Changes are saved locally and queued.'
                : formatFriendlyFirestoreError(err, Boolean(onRejected))
            );
          }
        }
      }
    },
    [firebaseAuthUser]
  );

  // Listen to Firebase Auth with strict synchronous UID-isolation & foreign-cache purging
  useEffect(() => {
    testFirestoreConnection();

    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      try {
        purgeLegacyUnscopedStorage(localStorage);
      } catch {
        // ignore storage errors
      }

      if (!fbUser) {
        cancelAllActiveUploads();
        activeUidRef.current = null;
        resetInMemoryState();
        try {
          purgeAccountScopedStorage(localStorage);
        } catch {
          // ignore storage errors
        }
        setFirebaseAuthUser(null);
        setCurrentUserState(null);
        setAuthStatus('unauthenticated');
        setIsHydratingAccount(false);
        setIsFirebaseReady(true);
        return;
      }

      const uid = fbUser.uid;
      const uidChanged = activeUidRef.current !== uid;

      if (uidChanged) {
        cancelAllActiveUploads();
        resetInMemoryState();
        try {
          purgeAccountScopedStorage(localStorage, { preserveUid: uid });
        } catch {
          // ignore storage errors
        }
        activeUidRef.current = uid;
        setIsHydratingAccount(Boolean(fbUser.emailVerified));

        if (fbUser.emailVerified) {
          const cachedGroups = readUidScopedStorage<Group[]>(localStorage, uid, 'groups', []);
          const cachedCurrentGroup = readUidScopedStorage<Group | null>(
            localStorage,
            uid,
            'currentGroup',
            null
          );
          if (cachedGroups.length > 0) {
            setGroups(cachedGroups);
            setCurrentGroupState(
              cachedCurrentGroup && cachedGroups.some((g) => g.id === cachedCurrentGroup.id)
                ? cachedCurrentGroup
                : cachedGroups.find((g) => g.status !== 'archived') || cachedGroups[0] || null
            );
          }
          setGroupMembers(readUidScopedStorage<GroupMember[]>(localStorage, uid, 'groupMembers', []));
          setContributions(readUidScopedStorage<Contribution[]>(localStorage, uid, 'contributions', []));
          setAssignments(readUidScopedStorage<ContributionAssignment[]>(localStorage, uid, 'assignments', []));
          setPayments(readUidScopedStorage<Payment[]>(localStorage, uid, 'payments', []));
          setCommitments(readUidScopedStorage<PaymentCommitment[]>(localStorage, uid, 'commitments', []));
          setCommitmentEvents(readUidScopedStorage<CommitmentEvent[]>(localStorage, uid, 'commitmentEvents', []));
          setExpenses(readUidScopedStorage<Expense[]>(localStorage, uid, 'expenses', []));
          setDisputes(readUidScopedStorage<Dispute[]>(localStorage, uid, 'disputes', []));
          setJoinRequests(readUidScopedStorage<JoinRequest[]>(localStorage, uid, 'joinRequests', []));
          setNotifications(readUidScopedStorage<AppNotification[]>(localStorage, uid, 'notifications', []));
          setAuditLogs(readUidScopedStorage<AuditLog[]>(localStorage, uid, 'auditLogs', []));
          setCommunications(readUidScopedStorage<EmailCommunication[]>(localStorage, uid, 'communications', []));
          setNotificationConfig(
            readUidScopedStorage<NotificationScheduleConfig>(
              localStorage,
              uid,
              'notificationConfig',
              DEFAULT_NOTIFICATION_CONFIG
            )
          );
          try {
            setHasPreRepairSnapshot(
              Boolean(localStorage.getItem(getAccountStorageKey(uid, 'pre_repair_snapshot')))
            );
          } catch {
            setHasPreRepairSnapshot(false);
          }
        }
      }

      setFirebaseAuthUser(fbUser);
      setIsFirebaseReady(true);

      const fallbackUser: User = {
        id: uid,
        name: fbUser.displayName || fbUser.email?.split('@')[0] || 'User',
        email: fbUser.email || '',
        phone: fbUser.phoneNumber || undefined,
        role: 'member',
        avatarUrl: fbUser.photoURL || undefined,
        preferredLanguage: languageRef.current,
        createdAt: new Date().toISOString(),
      };

      setCurrentUserState(fallbackUser);
      setAuthStatus('authenticated');
      setUsers([fallbackUser]);

      if (fbUser.emailVerified) {
        try {
          const userRef = doc(db, 'users', uid);
          const userSnap = await getDoc(userRef);
          if (activeUidRef.current !== uid) return;

          if (userSnap.exists()) {
            const existingUser = userSnap.data() as User;
            const resolvedUser: User = {
              ...fallbackUser,
              ...existingUser,
              id: uid,
              email: fbUser.email || existingUser.email || '',
              avatarUrl: fbUser.photoURL || existingUser.avatarUrl,
              createdAt: existingUser.createdAt || fallbackUser.createdAt,
            };
            setCurrentUserState(resolvedUser);
            setUsers([resolvedUser]);
            // Update only mutable auth metadata if needed without touching immutable role/createdAt
            if (
              existingUser.email !== resolvedUser.email ||
              (resolvedUser.avatarUrl && existingUser.avatarUrl !== resolvedUser.avatarUrl)
            ) {
              await setDoc(
                userRef,
                sanitizeForFirestore({
                  email: resolvedUser.email,
                  avatarUrl: resolvedUser.avatarUrl,
                }),
                { merge: true }
              );
            }
          } else {
            await setDoc(
              userRef,
              sanitizeForFirestore(fallbackUser as unknown as Record<string, unknown>)
            );
          }
        } catch (err) {
          console.warn('Could not sync user profile to Firestore:', err);
        }
      } else {
        setIsHydratingAccount(false);
      }
    });

    return () => unsubscribe();
  }, [resetInMemoryState]);

  // Listen ONLY to authenticated user's own groups (adminId, treasurerId, memberUids) & own notifications
  useEffect(() => {
    const uid = firebaseAuthUser?.uid;
    if (!uid || !firebaseAuthUser.emailVerified) {
      setIsHydratingAccount(false);
      return;
    }

    const adminMap = new Map<string, Group>();
    const treasurerMap = new Map<string, Group>();
    const memberMap = new Map<string, Group>();
    const settled = { admin: false, treasurer: false, member: false };

    const safetyTimeout = setTimeout(() => {
      if (activeUidRef.current === uid) {
        setIsHydratingAccount(false);
      }
    }, 4500);

    const reconcileGroups = () => {
      if (activeUidRef.current !== uid) return;
      const combined = new Map<string, Group>();
      [adminMap, treasurerMap, memberMap].forEach((m) => {
        m.forEach((g, id) => combined.set(id, g));
      });
      const nextGroups = Array.from(combined.values()).sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );

      setGroups(nextGroups);
      setCurrentGroupState((prev) => {
        if (prev) {
          const match = nextGroups.find((g) => g.id === prev.id);
          if (match) return match;
        }
        return nextGroups.find((g) => g.status !== 'archived') || nextGroups[0] || null;
      });

      const validGroupIds = new Set(nextGroups.map((g) => g.id));
      setGroupMembers((prev) => prev.filter((item) => validGroupIds.has(item.groupId)));
      setContributions((prev) => prev.filter((item) => validGroupIds.has(item.groupId)));
      setAssignments((prev) => prev.filter((item) => validGroupIds.has(item.groupId)));
      setPayments((prev) => prev.filter((item) => validGroupIds.has(item.groupId)));
      setCommitments((prev) => prev.filter((item) => validGroupIds.has(item.groupId)));
      setCommitmentEvents((prev) =>
        prev.filter((item) => !item.groupId || validGroupIds.has(item.groupId))
      );
      setExpenses((prev) => prev.filter((item) => validGroupIds.has(item.groupId)));
      setDisputes((prev) => prev.filter((item) => validGroupIds.has(item.groupId)));
      setJoinRequests((prev) => prev.filter((item) => validGroupIds.has(item.groupId)));
      setAuditLogs((prev) =>
        prev.filter((item) => item.groupId && validGroupIds.has(item.groupId))
      );
      setCommunications((prev) => prev.filter((item) => validGroupIds.has(item.groupId)));

      setSyncStatus('synced');
      if (settled.admin && settled.treasurer && settled.member) {
        clearTimeout(safetyTimeout);
        setIsHydratingAccount(false);
      }
    };

    const unsubs: (() => void)[] = [];

    const bindGroupQuery = (
      q: ReturnType<typeof query>,
      targetMap: Map<string, Group>,
      key: keyof typeof settled
    ) => {
      unsubs.push(
        onSnapshot(
          q,
          (snapshot) => {
            if (activeUidRef.current !== uid) return;
            targetMap.clear();
            snapshot.forEach((docSnap) => {
              const g = docSnap.data() as Group;
              if (g?.id) targetMap.set(g.id, g);
            });
            settled[key] = true;
            reconcileGroups();
          },
          (err) => {
            console.warn(`Groups ${key} query error:`, err);
            settled[key] = true;
            reconcileGroups();
          }
        )
      );
    };

    bindGroupQuery(
      query(collection(db, 'groups'), where('adminId', '==', uid)),
      adminMap,
      'admin'
    );
    bindGroupQuery(
      query(collection(db, 'groups'), where('treasurerId', '==', uid)),
      treasurerMap,
      'treasurer'
    );
    bindGroupQuery(
      query(collection(db, 'groups'), where('memberUids', 'array-contains', uid)),
      memberMap,
      'member'
    );

    const notificationsRef = collection(db, `users/${uid}/notifications`);
    const unsubNotifications = onSnapshot(
      notificationsRef,
      (snapshot) => {
        if (activeUidRef.current !== uid) return;
        const remoteNotifs: AppNotification[] = [];
        snapshot.forEach((docSnap) => {
          remoteNotifs.push(docSnap.data() as AppNotification);
        });
        remoteNotifs.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setNotifications(remoteNotifs);
      },
      (err) => console.warn('Notifications snapshot error:', err)
    );

    return () => {
      clearTimeout(safetyTimeout);
      unsubs.forEach((u) => u());
      unsubNotifications();
    };
  }, [firebaseAuthUser?.uid, firebaseAuthUser?.emailVerified]);

  const isManagerInCurrentGroup = Boolean(
    currentGroup &&
      firebaseAuthUser?.uid &&
      (currentGroup.adminId === firebaseAuthUser.uid ||
        currentGroup.treasurerId === firebaseAuthUser.uid ||
        groupMembers.some(
          (m) =>
            m.groupId === currentGroup.id &&
            m.status === 'active' &&
            (m.userId === firebaseAuthUser.uid ||
              m.linkedUserId === firebaseAuthUser.uid ||
              m.id === firebaseAuthUser.uid) &&
            (m.roleInGroup === 'admin' || m.roleInGroup === 'treasurer')
        ))
  );

  // Listen to active group subcollections with strict role & UID scoping
  useEffect(() => {
    const uid = firebaseAuthUser?.uid;
    const groupId = currentGroup?.id;
    if (!groupId || !uid || !firebaseAuthUser.emailVerified) return;

    const unsubscribers: (() => void)[] = [];

    const bindCollection = <T extends { id: string; groupId: string }>(
      path: string,
      apply: (items: T[]) => void
    ) => {
      const unsub = onSnapshot(
        collection(db, path),
        (snapshot) => {
          if (activeUidRef.current !== uid) return;
          const items: T[] = [];
          snapshot.forEach((docSnap) => items.push(docSnap.data() as T));
          apply(items);
        },
        (err) => console.warn(`${path} snapshot error:`, err)
      );
      unsubscribers.push(unsub);
    };

    const bindMemberDualScoped = <T extends { id: string; groupId: string }>(
      subcollection: string,
      applyMerged: (items: T[]) => void
    ) => {
      const byUidMap = new Map<string, T>();
      const byMemberIdMap = new Map<string, T>();

      const flush = () => {
        if (activeUidRef.current !== uid) return;
        const merged = new Map<string, T>();
        byUidMap.forEach((item, id) => merged.set(id, item));
        byMemberIdMap.forEach((item, id) => merged.set(id, item));
        applyMerged(Array.from(merged.values()));
      };

      const qByUid = query(
        collection(db, `groups/${groupId}/${subcollection}`),
        where('memberUid', '==', uid)
      );
      const qByMemberId = query(
        collection(db, `groups/${groupId}/${subcollection}`),
        where('memberId', '==', uid)
      );

      unsubscribers.push(
        onSnapshot(
          qByUid,
          (snapshot) => {
            byUidMap.clear();
            snapshot.forEach((d) => {
              const docData = d.data() as T;
              if (docData?.id) byUidMap.set(docData.id, docData);
            });
            flush();
          },
          (err) => console.warn(`groups/${groupId}/${subcollection} (memberUid) snapshot error:`, err)
        ),
        onSnapshot(
          qByMemberId,
          (snapshot) => {
            byMemberIdMap.clear();
            snapshot.forEach((d) => {
              const docData = d.data() as T;
              if (docData?.id) byMemberIdMap.set(docData.id, docData);
            });
            flush();
          },
          (err) => console.warn(`groups/${groupId}/${subcollection} (memberId) snapshot error:`, err)
        )
      );
    };

    try {
      // Group directory & group-wide shared targets/expenses (accessible to active group members)
      bindCollection<GroupMember>(`groups/${groupId}/members`, (items) => {
        setGroupMembers((prev) => {
          const otherGroups = prev.filter((m) => m.groupId !== groupId);
          const mergedCurrent = mergeGroupMembersWithFallback([], items, usersRef.current);
          return [...otherGroups, ...mergedCurrent];
        });
      });

      bindCollection<Contribution>(`groups/${groupId}/contributions`, (items) => {
        setContributions((prev) => replaceGroupScopedItems(prev, groupId, items));
      });

      bindCollection<Expense>(`groups/${groupId}/expenses`, (items) => {
        setExpenses((prev) => replaceGroupScopedItems(prev, groupId, items));
      });

      if (isManagerInCurrentGroup) {
        bindCollection<ContributionAssignment>(`groups/${groupId}/assignments`, (items) => {
          setAssignments((prev) => replaceGroupScopedItems(prev, groupId, items));
        });
        bindCollection<Payment>(`groups/${groupId}/payments`, (items) => {
          setPayments((prev) => replaceGroupScopedItems(prev, groupId, items));
        });
        bindCollection<PaymentCommitment>(`groups/${groupId}/commitments`, (items) => {
          setCommitments((prev) => replaceGroupScopedItems(prev, groupId, items));
        });
        unsubscribers.push(
          onSnapshot(
            collection(db, `groups/${groupId}/commitmentEvents`),
            (snapshot) => {
              if (activeUidRef.current !== uid) return;
              const items: CommitmentEvent[] = [];
              snapshot.forEach((d) => {
                const ev = d.data() as CommitmentEvent;
                items.push({ ...ev, groupId: ev.groupId || groupId });
              });
              setCommitmentEvents((prev) => {
                const scopedPrev = prev.filter((e) => e.groupId && e.groupId !== groupId);
                return mergeItemsById(scopedPrev, items);
              });
            },
            (err) => console.warn(`groups/${groupId}/commitmentEvents snapshot error:`, err)
          )
        );
        bindCollection<Dispute>(`groups/${groupId}/disputes`, (items) => {
          setDisputes((prev) => replaceGroupScopedItems(prev, groupId, items));
        });
        bindCollection<JoinRequest>(`groups/${groupId}/joinRequests`, (items) => {
          setJoinRequests((prev) => replaceGroupScopedItems(prev, groupId, items));
        });
        unsubscribers.push(
          onSnapshot(
            collection(db, `groups/${groupId}/auditLogs`),
            (snapshot) => {
              if (activeUidRef.current !== uid) return;
              const items: AuditLog[] = [];
              snapshot.forEach((d) => items.push(d.data() as AuditLog));
              items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
              setAuditLogs((prev) => [
                ...prev.filter((l) => l.groupId !== groupId),
                ...items,
              ]);
            },
            (err) => console.warn(`groups/${groupId}/auditLogs snapshot error:`, err)
          )
        );
        bindCollection<EmailCommunication>(`groups/${groupId}/communications`, (items) => {
          setCommunications((prev) =>
            replaceGroupScopedItems(
              prev,
              groupId,
              items,
              (a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime()
            )
          );
        });
      } else {
        // Ordinary member: strictly UID-scoped queries; clear privileged group logs/communications
        setAuditLogs((prev) => prev.filter((l) => l.groupId !== groupId));
        setCommunications((prev) => prev.filter((c) => c.groupId !== groupId));

        bindMemberDualScoped<ContributionAssignment>('assignments', (items) => {
          setAssignments((prev) => replaceGroupScopedItems(prev, groupId, items));
        });
        bindMemberDualScoped<Payment>('payments', (items) => {
          setPayments((prev) => replaceGroupScopedItems(prev, groupId, items));
        });
        bindMemberDualScoped<PaymentCommitment>('commitments', (items) => {
          setCommitments((prev) => replaceGroupScopedItems(prev, groupId, items));
        });
        bindMemberDualScoped<Dispute>('disputes', (items) => {
          setDisputes((prev) => replaceGroupScopedItems(prev, groupId, items));
        });
        unsubscribers.push(
          onSnapshot(
            query(collection(db, `groups/${groupId}/joinRequests`), where('userId', '==', uid)),
            (snapshot) => {
              if (activeUidRef.current !== uid) return;
              const items: JoinRequest[] = [];
              snapshot.forEach((d) => items.push(d.data() as JoinRequest));
              setJoinRequests((prev) => replaceGroupScopedItems(prev, groupId, items));
            },
            (err) => console.warn(`groups/${groupId}/joinRequests (self) snapshot error:`, err)
          ),
          onSnapshot(
            query(
              collection(db, `groups/${groupId}/commitmentEvents`),
              where('memberUid', '==', uid)
            ),
            (snapshot) => {
              if (activeUidRef.current !== uid) return;
              const items: CommitmentEvent[] = [];
              snapshot.forEach((d) => {
                const ev = d.data() as CommitmentEvent;
                items.push({ ...ev, groupId: ev.groupId || groupId });
              });
              setCommitmentEvents((prev) => [
                ...prev.filter((e) => e.groupId && e.groupId !== groupId),
                ...items,
              ]);
            },
            (err) => console.warn(`groups/${groupId}/commitmentEvents (self) snapshot error:`, err)
          )
        );
      }
    } catch (e) {
      console.warn('Real-time listeners setup exception:', e);
    }

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [
    currentGroup?.id,
    firebaseAuthUser?.uid,
    firebaseAuthUser?.emailVerified,
    isManagerInCurrentGroup,
  ]);

  // Persist state strictly to verified UID-scoped localStorage keys (never global unscoped keys)
  useEffect(() => {
    const uid = firebaseAuthUser?.uid;
    if (!uid || !firebaseAuthUser.emailVerified || activeUidRef.current !== uid) {
      return;
    }

    persistStorageWithFallback(localStorage, getAccountStorageKey(uid, 'users'), users);
    persistStorageWithFallback(localStorage, getAccountStorageKey(uid, 'groups'), groups);
    persistStorageWithFallback(
      localStorage,
      getAccountStorageKey(uid, 'currentGroup'),
      currentGroup
    );
    persistStorageWithFallback(
      localStorage,
      getAccountStorageKey(uid, 'groupMembers'),
      groupMembers
    );
    persistStorageWithFallback(
      localStorage,
      getAccountStorageKey(uid, 'contributions'),
      contributions
    );
    persistStorageWithFallback(
      localStorage,
      getAccountStorageKey(uid, 'assignments'),
      assignments
    );
    persistStorageWithFallback(
      localStorage,
      getAccountStorageKey(uid, 'payments'),
      payments,
      stripDataUrlsFromPayments(payments)
    );
    persistStorageWithFallback(
      localStorage,
      getAccountStorageKey(uid, 'commitments'),
      commitments
    );
    persistStorageWithFallback(
      localStorage,
      getAccountStorageKey(uid, 'commitmentEvents'),
      commitmentEvents
    );
    persistStorageWithFallback(
      localStorage,
      getAccountStorageKey(uid, 'expenses'),
      expenses,
      stripDataUrlsFromExpenses(expenses)
    );
    persistStorageWithFallback(localStorage, getAccountStorageKey(uid, 'disputes'), disputes);
    persistStorageWithFallback(
      localStorage,
      getAccountStorageKey(uid, 'joinRequests'),
      joinRequests
    );
    persistStorageWithFallback(
      localStorage,
      getAccountStorageKey(uid, 'notifications'),
      notifications
    );
    persistStorageWithFallback(localStorage, getAccountStorageKey(uid, 'auditLogs'), auditLogs);
    persistStorageWithFallback(
      localStorage,
      getAccountStorageKey(uid, 'communications'),
      communications
    );
    persistStorageWithFallback(
      localStorage,
      getAccountStorageKey(uid, 'notificationConfig'),
      notificationConfig
    );
  }, [
    firebaseAuthUser?.uid,
    firebaseAuthUser?.emailVerified,
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
    joinRequests,
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
    } catch (error: any) {
      const code = typeof error?.code === 'string' ? error.code : '';
      console.error('Google Sign In failed:', error);
      const messages: Record<string, string> = {
        'auth/unauthorized-domain':
          'This site is not an authorized Firebase Auth domain. Add clazzo265.github.io to Firebase Authentication → Settings → Authorized domains, then try again.',
        'auth/popup-blocked':
          'Your browser blocked the sign-in popup. Allow popups for this site and try again.',
        'auth/popup-closed-by-user': 'Google sign-in was cancelled.',
        'auth/cancelled-popup-request': 'Another sign-in window is already open. Please close it and try again.',
        'auth/operation-not-allowed':
          'Google sign-in is not enabled for this Firebase project. Enable it in Firebase Authentication → Sign-in method.',
        'auth/network-request-failed':
          'Could not reach Google/Firebase. Check your connection and try again.',
        'auth/invalid-api-key':
          'Firebase configuration is invalid. Check firebase-applet-config.json.',
      };
      setAuthError(
        messages[code] ||
          (code
            ? `Google Sign-In failed (${code}). ${error?.message || 'Please try again.'}`
            : 'Google Sign-In could not be completed. Please check the browser console and try again.')
      );
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
    const signingOutUid = activeUidRef.current || firebaseAuthUser?.uid;
    try {
      cancelAllActiveUploads();
      activeUidRef.current = null;
      resetInMemoryState();
      try {
        purgeLegacyUnscopedStorage(localStorage);
        if (signingOutUid) {
          purgeAccountScopedStorage(localStorage, { targetUid: signingOutUid });
        } else {
          purgeAccountScopedStorage(localStorage);
        }
        sessionStorage.clear();
      } catch {
        // ignore storage errors
      }
      await fbSignOut(auth);
      setFirebaseAuthUser(null);
      setCurrentUserState(null);
      setAuthStatus('unauthenticated');
      setIsHydratingAccount(false);
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

      if (gid && firebaseAuthUser && firebaseAuthUser.emailVerified) {
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
      category: AppNotification['category'],
      explicitGroupId?: string
    ) => {
      if (category === 'payment' && !notificationConfig.autoPaymentConfirmations) return;
      if (category === 'announcement' && !notificationConfig.autoObligationNotice) return;
      if (category === 'deadline' && !notificationConfig.autoUpcomingDeadlines) return;

      const resolvedUid = resolveMemberUid(userId, explicitGroupId || currentGroup?.id) || userId;
      const newNotif: AppNotification = {
        id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
        userId: resolvedUid,
        senderId: currentUser?.id || firebaseAuthUser?.uid,
        groupId: explicitGroupId || currentGroup?.id,
        title,
        message,
        category,
        read: false,
        createdAt: new Date().toISOString(),
      };
      if (resolvedUid === firebaseAuthUser?.uid) {
        setNotifications((prev) => [newNotif, ...prev]);
      }

      if (firebaseAuthUser && firebaseAuthUser.emailVerified && !resolvedUid.startsWith('mem_')) {
        syncToFirestore(
          `users/${resolvedUid}/notifications`,
          newNotif.id,
          newNotif as unknown as Record<string, unknown>,
          OperationType.CREATE,
          undefined,
          true
        );
      }
    },
    [
      currentGroup?.id,
      currentUser?.id,
      firebaseAuthUser,
      notificationConfig.autoObligationNotice,
      notificationConfig.autoPaymentConfirmations,
      notificationConfig.autoUpcomingDeadlines,
      resolveMemberUid,
      syncToFirestore,
    ]
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

  // Record payment (Honest verification workflow: member submissions always enter pending_verification;
  // admins/treasurers explicitly choose whether to verify immediately or save as pending_verification)
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
    const dateStamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const effectiveReference = isCustomRefProvided
      ? rawRef
      : params.paymentMethod === 'cash'
        ? `CASH-${dateStamp}-${Math.floor(1000 + Math.random() * 9000)}`
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
    let paymentDateIso = nowIso;
    if (params.paymentDate && params.paymentDate.trim()) {
      const parsedDate = new Date(params.paymentDate);
      if (!Number.isNaN(parsedDate.getTime())) {
        paymentDateIso = parsedDate.toISOString();
      }
    }

    const isDirectAutoVerified = isVerifier && params.verifyImmediately === true;

    const resolvedMemberUid =
      targetAssignment.memberUid ||
      resolveMemberUid(targetAssignment.memberId, targetAssignment.groupId);

    const newPayment: Payment = {
      id: paymentId,
      assignmentId: targetAssignment.id,
      contributionId: targetAssignment.contributionId,
      groupId: targetAssignment.groupId,
      memberId: targetAssignment.memberId,
      memberUid: resolvedMemberUid,
      amountReceived: parsedAmount.value,
      paymentDate: paymentDateIso,
      paymentMethod: params.paymentMethod,
      transactionReference: effectiveReference,
      idempotencyKey: params.idempotencyKey,
      receiptImageUrl: params.receiptImageUrl,
      receiptStoragePath: params.receiptStoragePath,
      receiptEvidenceUrl: params.receiptImageUrl,
      receiptFileName: params.receiptFileName,
      receiptFileType: params.receiptFileType,
      receiptFileSize: params.receiptFileSize,
      collectorId: currentUser.id,
      submittedByMemberId: !isVerifier ? memberSelf?.id : undefined,
      verificationStatus: isDirectAutoVerified ? 'verified' : 'pending_verification',
      verifiedAt: isDirectAutoVerified ? nowIso : undefined,
      verifiedBy: isDirectAutoVerified ? currentUser.id : undefined,
      receiptNote: params.receiptNote,
      createdAt: nowIso,
    };

    const previousPayments = payments;
    const updatedPayments = [newPayment, ...payments];
    setPayments(updatedPayments);

    syncToFirestore(
      `groups/${targetAssignment.groupId}/payments`,
      newPayment.id,
      newPayment as unknown as Record<string, unknown>,
      OperationType.CREATE,
      () => {
        setPayments((curr) => curr.filter((p) => p.id !== newPayment.id));
        recomputeAssignmentAndCommitments(targetAssignment, previousPayments, nowIso);
      }
    );

    if (!isDirectAutoVerified) {
      const targetGroup = groups.find((g) => g.id === targetAssignment.groupId);
      if (targetGroup?.adminId && targetGroup.adminId !== currentUser.id) {
        addNotification(
          targetGroup.adminId,
          'Payment Waiting Check',
          `${currentUser.name} submitted payment proof of MK ${parsedAmount.value.toLocaleString('en-US')} (Ref: ${effectiveReference}).`,
          'payment',
          targetAssignment.groupId
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
        groupId: targetAssignment.groupId,
        memberUid: resolvedMemberUid,
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
      'payment',
      targetAssignment.groupId
    );

    // Automated intelligent communication dispatch to paying member (manager-only per Firestore rules)
    const targetGroupForComm = groups.find((g) => g.id === targetAssignment.groupId) || currentGroup;
    if (isVerifier && targetGroupForComm) {
      const payingMember = groupMembers.find(
        (m) =>
          m.groupId === targetGroupForComm.id &&
          (m.id === targetAssignment.memberId || m.userId === targetAssignment.memberId)
      );
      const contribution = contributions.find((c) => c.id === targetAssignment.contributionId);
      const nextAssignments = assignments.map((a) =>
        a.id === targetAssignment.id ? { ...a, status: newStatus } : a
      );

      if (payingMember && notificationConfig.autoPaymentConfirmations) {
        try {
          const confirmationDispatch = createEmailCommunicationDispatch(
            targetGroupForComm.id,
            targetGroupForComm,
            currentUser.id,
            'payment_confirmation',
            'individual',
            `Payment Received Confirmation — ${targetGroupForComm.name}`,
            '',
            [payingMember],
            nextAssignments,
            updatedPayments,
            contribution,
            newPayment
          );
          setCommunications((prev) => [confirmationDispatch, ...prev]);
          syncToFirestore(
            `groups/${targetGroupForComm.id}/communications`,
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
            targetGroupForComm.id,
            targetGroupForComm,
            currentUser.id,
            'cleared_balance',
            'individual',
            `Balance Cleared Notice — ${targetGroupForComm.name}`,
            '',
            [payingMember],
            nextAssignments,
            updatedPayments,
            contribution
          );
          setCommunications((prev) => [clearedDispatch, ...prev]);
          syncToFirestore(
            `groups/${targetGroupForComm.id}/communications`,
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
      'payment',
      payment.groupId
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
      memberUid: payment.memberUid || resolveMemberUid(payment.memberId, payment.groupId),
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

    const resolvedMemberUid =
      assignment.memberUid || resolveMemberUid(assignment.memberId, assignment.groupId);

    const newCommitment: PaymentCommitment = {
      id: commitmentId,
      assignmentId: assignment.id,
      memberId: assignment.memberId,
      memberUid: resolvedMemberUid,
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
      groupId: assignment.groupId,
      memberUid: resolvedMemberUid,
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
      'commitment',
      assignment.groupId
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
      groupId: commitment.groupId,
      memberUid:
        commitment.memberUid ||
        resolveMemberUid(commitment.memberId, commitment.groupId) ||
        currentUser.id,
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
      groupId: commitment.groupId,
      memberUid:
        commitment.memberUid || resolveMemberUid(commitment.memberId, commitment.groupId),
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
      'commitment',
      commitment.groupId
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
      OperationType.CREATE,
      () => {
        setExpenses((curr) => curr.filter((e) => e.id !== newExpense.id));
      }
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

  // Create Contribution (supports stove_rate for accommodation electricity ONLY, percentage, and custom allocations)
  const createContribution: AppContextType['createContribution'] = (
    contributionData,
    memberAssignments
  ) => {
    if (!currentUser || !canManageGroupRole(getRoleForGroupId(contributionData.groupId))) {
      return { success: false, error: 'Only administrators may create contribution obligations.' };
    }
    if (memberAssignments.length === 0) {
      return { success: false, error: 'At least one active member assignment is required.' };
    }

    const targetGroup = groups.find((g) => g.id === contributionData.groupId) || currentGroup;
    const stoveAllowed = isStoveBillingApplicable(targetGroup, contributionData.category);
    const allocationMode: ContributionAllocationMode =
      contributionData.allocationMode || (stoveAllowed ? 'stove_rate' : 'custom');

    if (allocationMode === 'stove_rate' && !stoveAllowed) {
      return {
        success: false,
        error:
          'Stove-tier electricity rates only apply to Electricity requests inside Shared House or Student Hostel groups.',
      };
    }

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

    const resolvedCollectorId =
      contributionData.responsiblePersonId ||
      targetGroup?.treasurerId ||
      targetGroup?.adminId ||
      currentUser.id;

    const newContribution: Contribution = {
      ...contributionData,
      responsiblePersonId: resolvedCollectorId,
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
        memberUid: resolveMemberUid(ma.memberId, contributionData.groupId),
        assignedAmount: toSafeIntMWK(ma.amount),
        allocationPercentage:
          typeof ma.allocationPercentage === 'number' ? ma.allocationPercentage : undefined,
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

    const newAssignmentIds = new Set(newAssignments.map((a) => a.id));
    syncToFirestore(
      `groups/${contributionData.groupId}/contributions`,
      contributionId,
      newContribution as unknown as Record<string, unknown>,
      OperationType.CREATE,
      () => {
        setContributions((curr) => curr.filter((c) => c.id !== contributionId));
        setAssignments((curr) => curr.filter((a) => !newAssignmentIds.has(a.id)));
      }
    );
    newAssignments.forEach((asg) => {
      syncToFirestore(
        `groups/${contributionData.groupId}/assignments`,
        asg.id,
        asg as unknown as Record<string, unknown>,
        OperationType.CREATE,
        () => {
          setAssignments((curr) => curr.filter((a) => a.id !== asg.id));
        }
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

    const deadlineText = formatDeadlineLabel(
      contributionData.deadline,
      contributionData.hasNoDeadline
    );
    memberAssignments.forEach((ma) => {
      addNotification(
        ma.memberId,
        'New Contribution Set',
        `Your share for "${contributionData.title}" is MK ${toSafeIntMWK(ma.amount).toLocaleString('en-US')}. Due: ${deadlineText}.`,
        'announcement',
        contributionData.groupId
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
    const expiry = createInviteExpiry();

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
      inviteExpiresAt: expiry.expiresAt,
      inviteExpiresAtMs: expiry.expiresAtMs,
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
      expiresAt: expiry.expiresAt,
      expiresAtMs: expiry.expiresAtMs,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const creatorUid = firebaseAuthUser?.uid || currentUser.id;
    const expectedAuthUid = firebaseAuthUser?.uid;

    if (expectedAuthUid && firebaseAuthUser.emailVerified && activeUidRef.current === expectedAuthUid) {
      setSyncStatus('syncing');
      const batch = writeBatch(db);
      batch.set(
        doc(db, 'groups', groupId),
        sanitizeForFirestore(newGroup as unknown as Record<string, unknown>)
      );
      batch.set(
        doc(db, `groups/${groupId}/members`, currentUser.id),
        sanitizeForFirestore(normalizedAdminMember as unknown as Record<string, unknown>)
      );
      batch.set(
        doc(db, 'groupInvites', randomCode),
        sanitizeForFirestore(inviteDoc as unknown as Record<string, unknown>)
      );
      batch
        .commit()
        .then(() => {
          if (activeUidRef.current !== expectedAuthUid) return;
          setSyncStatus('synced');
          addAuditLog('GROUP_CREATED', `Group "${groupData.name}" created with join code ${randomCode}`, {
            targetEntity: 'group',
            targetId: groupId,
            groupId,
          });
        })
        .catch((err) => {
          if (activeUidRef.current !== expectedAuthUid) return;
          console.warn('Atomic group creation batch failed:', err);
          setSyncStatus(typeof navigator !== 'undefined' && !navigator.onLine ? 'offline_queued' : 'error');
          setActionError('Cloud sync error: group was created locally but could not sync to Firestore.');
        });
    } else {
      addAuditLog('GROUP_CREATED', `Group "${groupData.name}" created with join code ${randomCode}`, {
        targetEntity: 'group',
        targetId: groupId,
        groupId,
      });
    }
    void creatorUid;
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
        expiresAt: nextGroup.inviteExpiresAt,
        expiresAtMs: nextGroup.inviteExpiresAtMs,
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

  // Voluntary Leave Group (atomically updates membership/group in Firestore, enforces sole-admin handover, purges departing user's view & preserves financial ledger)
  const leaveGroup: AppContextType['leaveGroup'] = async (groupId, options = {}) => {
    if (!currentUser) {
      return { success: false, error: 'Authentication required.' };
    }
    const targetGroup = groups.find((g) => g.id === groupId);
    if (!targetGroup) {
      return { success: false, error: 'Group not found.' };
    }

    const uid = firebaseAuthUser?.uid || currentUser.id;
    const eligibility = validateLeaveGroupEligibility({
      userId: uid,
      group: targetGroup,
      groupMembers,
      transferToMemberId: options.transferToMemberId,
    });

    if (!eligibility.allowed) {
      return {
        success: false,
        error: eligibility.error || 'Cannot leave this group right now.',
        code: eligibility.requiresTransfer ? 'TRANSFER_REQUIRED' : 'LEAVE_BLOCKED',
      };
    }

    const nowIso = new Date().toISOString();
    const reason = options.reason?.trim() || 'Voluntary departure by member';
    const nextAdminUid = eligibility.nextAdminMember
      ? eligibility.nextAdminMember.linkedUserId || eligibility.nextAdminMember.userId
      : undefined;
    const currentUids = Array.isArray(targetGroup.memberUids)
      ? targetGroup.memberUids
      : [targetGroup.adminId];
    const remainingUids = currentUids.filter((u) => u !== uid);
    const nextCount = Math.max(0, remainingUids.length);
    const wasTreasurer = targetGroup.treasurerId === uid;
    const adminTransferNeeded = targetGroup.adminId === uid && Boolean(nextAdminUid);

    if (firebaseAuthUser && firebaseAuthUser.emailVerified && activeUidRef.current === uid) {
      try {
        const batch = writeBatch(db);

        if (adminTransferNeeded && eligibility.nextAdminMember && nextAdminUid) {
          batch.update(
            doc(db, `groups/${groupId}/members`, eligibility.nextAdminMember.id),
            sanitizeForFirestore({
              roleInGroup: 'admin',
              updatedAt: nowIso,
            })
          );
        }

        if (eligibility.departingMember) {
          batch.update(
            doc(db, `groups/${groupId}/members`, eligibility.departingMember.id),
            sanitizeForFirestore({
              status: 'departed',
              departedAt: nowIso,
              departureReason: reason,
              updatedAt: nowIso,
            })
          );
        }

        const groupUpdatePayload: Record<string, unknown> = {
          memberUids: arrayRemove(uid),
          memberCount: nextCount,
          updatedAt: nowIso,
        };
        if (adminTransferNeeded && nextAdminUid) {
          groupUpdatePayload.adminId = nextAdminUid;
        }
        if (wasTreasurer) {
          groupUpdatePayload.treasurerId = deleteField();
        }
        batch.update(doc(db, 'groups', groupId), groupUpdatePayload);

        const leaveLogId = `aud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const leaveLog: AuditLog = {
          id: leaveLogId,
          groupId,
          actorId: uid,
          actorName: currentUser.name,
          action: 'MEMBER_LEFT_GROUP',
          targetEntity: 'member',
          targetId: eligibility.departingMember?.id || uid,
          reason,
          beforeValue: eligibility.departingMember?.status || 'active',
          afterValue: 'departed',
          details: adminTransferNeeded && eligibility.nextAdminMember
            ? `${currentUser.name} transferred admin ownership to ${eligibility.nextAdminMember.name} and left "${targetGroup.name}". Financial records preserved.`
            : `${currentUser.name} voluntarily left "${targetGroup.name}". Historical payments and ledger preserved.`,
          timestamp: nowIso,
          securityEvent: true,
        };
        batch.set(
          doc(db, `groups/${groupId}/auditLogs`, leaveLogId),
          sanitizeForFirestore(leaveLog as unknown as Record<string, unknown>)
        );

        const recipientAdminId = nextAdminUid || targetGroup.adminId;
        if (recipientAdminId && recipientAdminId !== uid && !recipientAdminId.startsWith('mem_')) {
          const notifId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;
          const leaveNotif: AppNotification = {
            id: notifId,
            userId: recipientAdminId,
            senderId: uid,
            groupId,
            title: adminTransferNeeded ? 'Group Ownership Transferred' : 'Member Left Group',
            message: adminTransferNeeded
              ? `${currentUser.name} transferred admin ownership of "${targetGroup.name}" to you before leaving.`
              : `${currentUser.name} has left "${targetGroup.name}". All payment records remain preserved.`,
            category: 'announcement',
            read: false,
            createdAt: nowIso,
          };
          batch.set(
            doc(db, `users/${recipientAdminId}/notifications`, notifId),
            sanitizeForFirestore(leaveNotif as unknown as Record<string, unknown>)
          );
        }

        await batch.commit();
        if (activeUidRef.current !== uid) {
          return { success: false, error: 'Session changed while leaving group.' };
        }
      } catch (err) {
        console.warn('Leave group batch failed:', err);
        return {
          success: false,
          error: 'Could not complete leaving this group right now. Check your connection and try again.',
        };
      }
    }

    // Immediately remove group & group-scoped state from the departing user's session
    const nextGroups = groups.filter((g) => g.id !== groupId);
    setGroups(nextGroups);
    if (currentGroup?.id === groupId) {
      setCurrentGroup(nextGroups.find((g) => g.status !== 'archived') || null);
    }
    setGroupMembers((prev) => prev.filter((item) => item.groupId !== groupId));
    setContributions((prev) => prev.filter((item) => item.groupId !== groupId));
    setAssignments((prev) => prev.filter((item) => item.groupId !== groupId));
    setPayments((prev) => prev.filter((item) => item.groupId !== groupId));
    setCommitments((prev) => prev.filter((item) => item.groupId !== groupId));
    setCommitmentEvents((prev) => prev.filter((item) => item.groupId !== groupId));
    setExpenses((prev) => prev.filter((item) => item.groupId !== groupId));
    setDisputes((prev) => prev.filter((item) => item.groupId !== groupId));
    setJoinRequests((prev) => prev.filter((item) => item.groupId !== groupId));
    setAuditLogs((prev) => prev.filter((item) => item.groupId !== groupId));
    setCommunications((prev) => prev.filter((item) => item.groupId !== groupId));
    setNotifications((prev) => prev.filter((n) => n.groupId !== groupId));

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
      if (isInviteExpired(localMatch.inviteExpiresAt, localMatch.inviteExpiresAtMs)) {
        return { success: false, error: 'This invite code has expired. Ask your group administrator for a new code.' };
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
          expiresAt: localMatch.inviteExpiresAt,
          expiresAtMs: localMatch.inviteExpiresAtMs,
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
      if (isInviteExpired(invite.expiresAt, invite.expiresAtMs)) {
        return { success: false, error: 'This invite link has expired. Ask your admin to generate a fresh code.' };
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

    // Ensure Firestore sees the current email_verified claim, not a cached token.
    try {
      await auth.currentUser?.getIdToken(true);
    } catch {
      // The batch below will report a precise error if the token cannot refresh.
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

    // Auto-join via code. Write the member record first, then add the UID to the
    // group. The rules validate the committed member record, so no getAfter()
    // batch dependency is needed. A retry safely skips completed steps.
    const joiningUid = firebaseAuthUser.uid;
    const newMember: GroupMember = {
      id: joiningUid,
      userId: joiningUid,
      linkedUserId: joiningUid,
      joinedViaInvite: true,
      inviteCodeUsed: invite.inviteCode,
      groupId: invite.groupId,
      name: currentUser.name,
      email: currentUser.email.trim().toLowerCase(),
      phone: currentUser.phone || '',
      memberRefId: generateMemberReferenceId(
        invite.groupId,
        groupMembers.filter((m) => m.groupId === invite.groupId).length
      ),
      roleInGroup: 'member',
      membershipDate: nowIso,
      joinedAt: nowIso,
      status: 'active',
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    try {
      const groupRef = doc(db, 'groups', invite.groupId);
      const memberRef = doc(db, `groups/${invite.groupId}/members`, joiningUid);

      const [groupSnap, memberSnap] = await Promise.all([
        getDoc(groupRef),
        getDoc(memberRef),
      ]);
      if (!groupSnap.exists()) {
        return { success: false, error: 'This group no longer exists. Ask your admin for a new invite.' };
      }
      if (activeUidRef.current !== joiningUid) {
        return { success: false, error: 'Session changed while joining group.' };
      }

      const existingMember = memberSnap.exists()
        ? (memberSnap.data() as Partial<GroupMember>)
        : null;
      if (!existingMember || existingMember.userId !== joiningUid || existingMember.status !== 'active') {
        await setDoc(memberRef, sanitizeForFirestore(newMember as unknown as Record<string, unknown>));
      }

      const groupData = groupSnap.data() as Group;
      const memberUids = Array.isArray(groupData.memberUids) ? groupData.memberUids : [];
      if (!memberUids.includes(joiningUid)) {
        await updateDoc(groupRef, {
          memberUids: arrayUnion(joiningUid),
          memberCount: increment(1),
          updatedAt: nowIso,
        });
      }

      if (activeUidRef.current !== joiningUid) {
        return { success: false, error: 'Session changed while joining group.' };
      }

      const joinedSnap = await getDoc(groupRef);
      if (activeUidRef.current !== joiningUid) {
        return { success: false, error: 'Session changed while joining group.' };
      }
      if (joinedSnap.exists()) {
        const joinedGroup = joinedSnap.data() as Group;
        setGroups((prev) => mergeItemsById(prev, [joinedGroup]));
        setCurrentGroup(joinedGroup);
      }
    } catch (err: any) {
      const code = typeof err?.code === 'string' ? err.code : '';
      console.warn('Firestore auto-join failed:', err);
      return {
        success: false,
        error: code
          ? `Could not join this group (${code}). ${err?.message || ''} If you just verified your email, sign out and back in once, or ask the admin to regenerate the invite link.`
          : 'Could not complete group join right now. Check your internet connection or ask your admin.',
      };
    }

    setGroupMembers((prev) => [
      ...prev.filter((m) => !(m.groupId === invite.groupId && m.id === newMember.id)),
      newMember,
    ]);
    addNotification(
      invite.adminId,
      'New Member Joined',
      `${currentUser.name} joined ${invite.groupName} using the group invite code.`,
      'announcement',
      invite.groupId
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

    const reviewerUid = firebaseAuthUser?.uid || currentUser.id;
    setJoinRequests((prev) => prev.map((r) => (r.id === requestId ? updatedReq : r)));

    if (!approved) {
      await syncToFirestore(
        `groups/${groupId}/joinRequests`,
        requestId,
        updatedReq as unknown as Record<string, unknown>,
        OperationType.UPDATE
      );
      return { success: true };
    }

    const targetGroup = groups.find((g) => g.id === groupId);
    const newMember: GroupMember = {
      id: req.userId,
      userId: req.userId,
      linkedUserId: req.userId,
      joinedViaInvite: true,
      inviteCodeUsed: req.inviteCode,
      groupId,
      name: req.name,
      email: req.email,
      phone: req.phone || '',
      memberRefId: generateMemberReferenceId(
        groupId,
        groupMembers.filter((m) => m.groupId === groupId).length
      ),
      roleInGroup: 'member',
      membershipDate: nowIso,
      joinedAt: nowIso,
      status: 'active',
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    if (firebaseAuthUser && firebaseAuthUser.emailVerified && activeUidRef.current === reviewerUid) {
      try {
        const batch = writeBatch(db);
        batch.set(
          doc(db, `groups/${groupId}/joinRequests`, requestId),
          sanitizeForFirestore(updatedReq as unknown as Record<string, unknown>),
          { merge: true }
        );
        batch.set(
          doc(db, `groups/${groupId}/members`, newMember.id),
          sanitizeForFirestore(newMember as unknown as Record<string, unknown>),
          { merge: true }
        );
        batch.update(doc(db, 'groups', groupId), {
          memberUids: arrayUnion(req.userId),
          memberCount: increment(1),
          updatedAt: nowIso,
        });
        await batch.commit();
      } catch (err) {
        console.warn('Approve join request batch failed:', err);
        return { success: false, error: 'Could not approve member in Firestore right now.' };
      }
      if (activeUidRef.current !== reviewerUid) {
        return { success: false, error: 'Session changed while approving request.' };
      }
    }

    setGroupMembers((prev) => [
      ...prev.filter((m) => !(m.groupId === groupId && m.id === newMember.id)),
      newMember,
    ]);
    if (targetGroup) {
      const nextUids = Array.from(
        new Set([...(targetGroup.memberUids || [targetGroup.adminId]), req.userId])
      );
      const nextGroup = {
        ...targetGroup,
        memberUids: nextUids,
        memberCount: nextUids.length,
        updatedAt: nowIso,
      };
      setGroups((prev) => prev.map((g) => (g.id === groupId ? nextGroup : g)));
      if (currentGroup?.id === groupId) setCurrentGroup(nextGroup);
    }

    addNotification(
      req.userId,
      'Membership Approved',
      `You have been approved to join ${targetGroup?.name || 'the group'}.`,
      'announcement',
      groupId
    );

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
    const shouldRefreshExpiry =
      Boolean(options.regenerate) || options.revoke === false || !targetGroup.inviteExpiresAtMs;
    const expiry = shouldRefreshExpiry
      ? createInviteExpiry()
      : {
          expiresAt: targetGroup.inviteExpiresAt,
          expiresAtMs: targetGroup.inviteExpiresAtMs,
        };

    const nextGroup: Group = {
      ...targetGroup,
      joinCode: nextCode,
      joinPolicy: nextPolicy,
      inviteRevoked: options.regenerate ? false : nextRevoked,
      inviteExpiresAt: expiry.expiresAt,
      inviteExpiresAtMs: expiry.expiresAtMs,
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
        expiresAt: targetGroup.inviteExpiresAt,
        expiresAtMs: targetGroup.inviteExpiresAtMs,
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
      expiresAt: expiry.expiresAt,
      expiresAtMs: expiry.expiresAtMs,
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

    const targetUid =
      member.linkedUserId || (!member.userId.startsWith('mem_') ? member.userId : undefined);
    const targetGroup = groups.find((g) => g.id === member.groupId) || currentGroup;
    if (targetUid && targetUid !== targetGroup?.adminId) {
      setGroups((prev) =>
        prev.map((g) =>
          g.id === member.groupId && Array.isArray(g.memberUids)
            ? { ...g, memberUids: g.memberUids.filter((u) => u !== targetUid), updatedAt: nowIso }
            : g
        )
      );
    }

    const expectedUid = firebaseAuthUser?.uid;
    if (expectedUid && firebaseAuthUser.emailVerified && activeUidRef.current === expectedUid) {
      const batch = writeBatch(db);
      batch.set(
        doc(db, `groups/${member.groupId}/members`, member.id),
        sanitizeForFirestore(updatedMember as unknown as Record<string, unknown>),
        { merge: true }
      );
      if (targetUid && targetUid !== targetGroup?.adminId) {
        batch.update(doc(db, 'groups', member.groupId), {
          memberUids: arrayRemove(targetUid),
          updatedAt: nowIso,
        });
      }
      batch.commit().catch((err) => {
        console.warn('Suspend member batch failed:', err);
        setActionError('Cloud sync error: member suspension could not be synced to Firestore.');
      });
    }

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

    const targetUid =
      member.linkedUserId || (!member.userId.startsWith('mem_') ? member.userId : undefined);
    if (targetUid) {
      setGroups((prev) =>
        prev.map((g) =>
          g.id === member.groupId
            ? {
                ...g,
                memberUids: Array.from(new Set([...(g.memberUids || [g.adminId]), targetUid])),
                updatedAt: nowIso,
              }
            : g
        )
      );
    }

    const expectedUid = firebaseAuthUser?.uid;
    if (expectedUid && firebaseAuthUser.emailVerified && activeUidRef.current === expectedUid) {
      const batch = writeBatch(db);
      batch.set(
        doc(db, `groups/${member.groupId}/members`, member.id),
        sanitizeForFirestore(updatedMember as unknown as Record<string, unknown>),
        { merge: true }
      );
      if (targetUid) {
        batch.update(doc(db, 'groups', member.groupId), {
          memberUids: arrayUnion(targetUid),
          updatedAt: nowIso,
        });
      }
      batch.commit().catch((err) => {
        console.warn('Reinstate member batch failed:', err);
        setActionError('Cloud sync error: member reinstatement could not be synced to Firestore.');
      });
    }

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

    const targetUid =
      member.linkedUserId || (!member.userId.startsWith('mem_') ? member.userId : undefined);
    const targetGroup = groups.find((g) => g.id === member.groupId) || currentGroup;
    const nextCount = Math.max(1, (targetGroup?.memberCount || 1) - 1);

    setGroups((prev) =>
      prev.map((g) =>
        g.id === member.groupId
          ? {
              ...g,
              memberCount: nextCount,
              memberUids:
                targetUid && targetUid !== g.adminId && Array.isArray(g.memberUids)
                  ? g.memberUids.filter((u) => u !== targetUid)
                  : g.memberUids,
              updatedAt: nowIso,
            }
          : g
      )
    );

    const expectedUid = firebaseAuthUser?.uid;
    if (expectedUid && firebaseAuthUser.emailVerified && activeUidRef.current === expectedUid) {
      const batch = writeBatch(db);
      batch.set(
        doc(db, `groups/${member.groupId}/members`, member.id),
        sanitizeForFirestore(updatedMember as unknown as Record<string, unknown>),
        { merge: true }
      );
      if (targetUid && targetUid !== targetGroup?.adminId) {
        batch.update(doc(db, 'groups', member.groupId), {
          memberUids: arrayRemove(targetUid),
          memberCount: nextCount,
          updatedAt: nowIso,
        });
      }
      batch.commit().catch((err) => {
        console.warn('Remove member batch failed:', err);
        setActionError('Cloud sync error: member removal could not be synced to Firestore.');
      });
    }

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
        groupId: member.groupId,
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

    const targetGroup = groups.find((g) => g.id === disputeData.groupId) || currentGroup;
    const newDispute: Dispute = {
      ...disputeData,
      memberUid:
        resolveMemberUid(disputeData.memberId, disputeData.groupId) || currentUser.id,
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

    if (targetGroup?.adminId) {
      addNotification(
        targetGroup.adminId,
        'New Dispute Filed',
        `${currentUser.name} submitted a dispute: "${disputeData.title}".`,
        'dispute',
        disputeData.groupId
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
      'dispute',
      dispute.groupId
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
    const uid = firebaseAuthUser?.uid || activeUidRef.current;
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
    if (res.report.repairedCount > 0 && uid) {
      try {
        const snapshotPayload = {
          savedAt: new Date().toISOString(),
          groupMembers,
          contributions,
          assignments,
          payments,
          commitments,
          expenses,
        };
        localStorage.setItem(
          getAccountStorageKey(uid, 'pre_repair_snapshot'),
          JSON.stringify(snapshotPayload)
        );
        setHasPreRepairSnapshot(true);
      } catch {
        // ignore storage errors
      }
    }
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
    const uid = firebaseAuthUser?.uid || activeUidRef.current;
    if (!uid) {
      return { success: false, error: 'Authenticated session required to restore snapshot.' };
    }
    const raw = localStorage.getItem(getAccountStorageKey(uid, 'pre_repair_snapshot'));
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
    const uid = activeUidRef.current || firebaseAuthUser?.uid;
    try {
      purgeLegacyUnscopedStorage(localStorage);
      if (uid) {
        purgeAccountScopedStorage(localStorage, { targetUid: uid });
      }
    } catch {
      // ignore storage errors
    }

    resetInMemoryState();
    setUsers(currentUser ? [currentUser] : []);
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        setCurrentUser,
        authStatus,
        isHydratingAccount,
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
        leaveGroup,
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

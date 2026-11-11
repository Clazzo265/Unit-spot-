import React, { createContext, useContext, useState, useEffect } from 'react';
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
  PaymentMethod
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
  INITIAL_AUDIT_LOGS 
} from '../data/initialData';
import { determineAssignmentPaymentStatus } from '../utils/financialCalculations';
import { 
  auth, 
  db, 
  googleProvider, 
  handleFirestoreError, 
  OperationType, 
  testFirestoreConnection 
} from '../firebase/config';
import { 
  signInWithPopup, 
  signOut as fbSignOut, 
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  onSnapshot, 
  query, 
  where 
} from 'firebase/firestore';

interface AppContextType {
  currentUser: User;
  setCurrentUser: (user: User) => void;
  firebaseAuthUser: FirebaseUser | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  isFirebaseReady: boolean;
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
  notifications: AppNotification[];
  auditLogs: AuditLog[];

  // Action methods
  recordPayment: (params: {
    assignmentId: string;
    amount: number;
    paymentMethod: PaymentMethod;
    transactionReference?: string;
    receiptImageUrl?: string;
    receiptNote?: string;
  }) => { success: boolean; paymentId: string; newOutstanding: number };

  verifyPayment: (paymentId: string, approved: boolean, reason?: string) => void;

  createCommitment: (params: {
    assignmentId: string;
    promisedDate: string;
    durationDays: number;
    notes?: string;
  }) => boolean;

  requestCommitmentExtension: (commitmentId: string, newDate: string, reason: string) => void;
  approveCommitmentExtension: (commitmentId: string, approved: boolean) => void;

  recordExpense: (expense: Omit<Expense, 'id' | 'createdAt' | 'status'>) => void;
  approveExpense: (expenseId: string, approved: boolean) => void;

  createContribution: (
    contribution: Omit<Contribution, 'id' | 'createdAt'>,
    memberAssignments: { memberId: string; amount: number; notes?: string }[]
  ) => void;

  createGroup: (group: Omit<Group, 'id' | 'createdAt' | 'memberCount' | 'adminId' | 'treasurerId' | 'joinCode'>) => string;

  addMemberToGroup: (params: {
    name: string;
    email: string;
    phone: string;
    role: 'admin' | 'treasurer' | 'member';
    roomNumber?: string;
  }) => { success: boolean; user?: User };

  removeMemberFromGroup: (userId: string, reason?: string) => boolean;

  submitDispute: (dispute: Omit<Dispute, 'id' | 'createdAt' | 'updatedAt' | 'status'>) => void;
  resolveDispute: (disputeId: string, resolutionNote: string, status: 'resolved' | 'rejected') => void;

  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  clearAllData: () => void;
}

const STORAGE_KEY = 'klarency_app_state_firebase_v3';

const AppContext = createContext<AppContextType | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseAuthUser, setFirebaseAuthUser] = useState<FirebaseUser | null>(null);
  const [isFirebaseReady, setIsFirebaseReady] = useState(false);

  const [users, setUsers] = useState<User[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_users`);
    return saved ? JSON.parse(saved) : INITIAL_USERS;
  });

  const [currentUser, setCurrentUser] = useState<User>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_currentUser`);
    return saved ? JSON.parse(saved) : (INITIAL_USERS[0] || {
      id: 'usr_admin',
      name: 'System Administrator',
      email: 'admin@klarency.mw',
      phone: '+265 999 000 000',
      role: 'super_admin',
      createdAt: new Date().toISOString(),
    });
  });

  const [groups, setGroups] = useState<Group[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_groups`);
    return saved ? JSON.parse(saved) : INITIAL_GROUPS;
  });

  const [currentGroup, setCurrentGroup] = useState<Group | null>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_currentGroup`);
    if (saved) return JSON.parse(saved);
    return groups[0] || null;
  });

  const [groupMembers, setGroupMembers] = useState<GroupMember[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_groupMembers`);
    return saved ? JSON.parse(saved) : INITIAL_GROUP_MEMBERS;
  });

  const [contributions, setContributions] = useState<Contribution[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_contributions`);
    return saved ? JSON.parse(saved) : INITIAL_CONTRIBUTIONS;
  });

  const [assignments, setAssignments] = useState<ContributionAssignment[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_assignments`);
    return saved ? JSON.parse(saved) : INITIAL_ASSIGNMENTS;
  });

  const [payments, setPayments] = useState<Payment[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_payments`);
    return saved ? JSON.parse(saved) : INITIAL_PAYMENTS;
  });

  const [commitments, setCommitments] = useState<PaymentCommitment[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_commitments`);
    return saved ? JSON.parse(saved) : INITIAL_COMMITMENTS;
  });

  const [commitmentEvents, setCommitmentEvents] = useState<CommitmentEvent[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_commitmentEvents`);
    return saved ? JSON.parse(saved) : INITIAL_COMMITMENT_EVENTS;
  });

  const [expenses, setExpenses] = useState<Expense[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_expenses`);
    return saved ? JSON.parse(saved) : INITIAL_EXPENSES;
  });

  const [disputes, setDisputes] = useState<Dispute[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_disputes`);
    return saved ? JSON.parse(saved) : INITIAL_DISPUTES;
  });

  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_notifications`);
    return saved ? JSON.parse(saved) : INITIAL_NOTIFICATIONS;
  });

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_auditLogs`);
    return saved ? JSON.parse(saved) : INITIAL_AUDIT_LOGS;
  });

  // Test connection & listen to Auth
  useEffect(() => {
    testFirestoreConnection();

    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseAuthUser(fbUser);
      setIsFirebaseReady(true);

      if (fbUser) {
        // Sync user profile
        const userDocRef = doc(db, 'users', fbUser.uid);
        const mappedUser: User = {
          id: fbUser.uid,
          name: fbUser.displayName || 'KLARENCY User',
          email: fbUser.email || '',
          phone: fbUser.phoneNumber || '+265 999 000 000',
          role: fbUser.email === 'cchilongo88@gmail.com' ? 'super_admin' : 'group_admin',
          avatarUrl: fbUser.photoURL || undefined,
          createdAt: new Date().toISOString(),
        };

        setCurrentUser(mappedUser);
        setUsers(prev => {
          const exists = prev.some(u => u.id === mappedUser.id);
          return exists ? prev.map(u => u.id === mappedUser.id ? mappedUser : u) : [mappedUser, ...prev];
        });

        // Save to Firestore users collection
        try {
          await setDoc(userDocRef, mappedUser, { merge: true });
        } catch (err) {
          console.warn('Could not sync user to Firestore:', err);
        }
      }
    });

    return () => unsubscribe();
  }, []);
  useEffect(() => {
    if (!currentGroup?.id || !firebaseAuthUser) return;

    const groupId = currentGroup.id;
    const unsubscribers: (() => void)[] = [];

    try {
      // 1. Payments listener
      const paymentsRef = collection(db, `groups/${groupId}/payments`);
      const unsubPayments = onSnapshot(paymentsRef, (snapshot) => {
        if (!snapshot.empty) {
          const remotePayments: Payment[] = [];
          snapshot.forEach(docSnap => {
            remotePayments.push(docSnap.data() as Payment);
          });
          setPayments(prev => {
            const merged = [...prev];
            remotePayments.forEach(rp => {
              const idx = merged.findIndex(p => p.id === rp.id);
              if (idx >= 0) merged[idx] = rp;
              else merged.push(rp);
            });
            return merged;
          });
        }
      }, (err) => console.warn('Payments snapshot error:', err));
      unsubscribers.push(unsubPayments);

      // 2. Commitments listener
      const commitmentsRef = collection(db, `groups/${groupId}/commitments`);
      const unsubCommitments = onSnapshot(commitmentsRef, (snapshot) => {
        if (!snapshot.empty) {
          const remoteCommitments: PaymentCommitment[] = [];
          snapshot.forEach(docSnap => {
            remoteCommitments.push(docSnap.data() as PaymentCommitment);
          });
          setCommitments(prev => {
            const merged = [...prev];
            remoteCommitments.forEach(rc => {
              const idx = merged.findIndex(c => c.id === rc.id);
              if (idx >= 0) merged[idx] = rc;
              else merged.push(rc);
            });
            return merged;
          });
        }
      }, (err) => console.warn('Commitments snapshot error:', err));
      unsubscribers.push(unsubCommitments);

      // 3. Expenses listener
      const expensesRef = collection(db, `groups/${groupId}/expenses`);
      const unsubExpenses = onSnapshot(expensesRef, (snapshot) => {
        if (!snapshot.empty) {
          const remoteExpenses: Expense[] = [];
          snapshot.forEach(docSnap => {
            remoteExpenses.push(docSnap.data() as Expense);
          });
          setExpenses(prev => {
            const merged = [...prev];
            remoteExpenses.forEach(re => {
              const idx = merged.findIndex(e => e.id === re.id);
              if (idx >= 0) merged[idx] = re;
              else merged.push(re);
            });
            return merged;
          });
        }
      }, (err) => console.warn('Expenses snapshot error:', err));
      unsubscribers.push(unsubExpenses);

      // 4. Contributions listener
      const contributionsRef = collection(db, `groups/${groupId}/contributions`);
      const unsubContributions = onSnapshot(contributionsRef, (snapshot) => {
        if (!snapshot.empty) {
          const remoteContributions: Contribution[] = [];
          snapshot.forEach(docSnap => {
            remoteContributions.push(docSnap.data() as Contribution);
          });
          setContributions(prev => {
            const merged = [...prev];
            remoteContributions.forEach(rc => {
              const idx = merged.findIndex(c => c.id === rc.id);
              if (idx >= 0) merged[idx] = rc;
              else merged.push(rc);
            });
            return merged;
          });
        }
      }, (err) => console.warn('Contributions snapshot error:', err));
      unsubscribers.push(unsubContributions);

      // 5. Members listener
      const membersRef = collection(db, `groups/${groupId}/members`);
      const unsubMembers = onSnapshot(membersRef, (snapshot) => {
        if (!snapshot.empty) {
          const remoteMembers: GroupMember[] = [];
          snapshot.forEach(docSnap => {
            remoteMembers.push(docSnap.data() as GroupMember);
          });
          setGroupMembers(prev => {
            const merged = [...prev];
            remoteMembers.forEach(rm => {
              const idx = merged.findIndex(m => m.id === rm.id);
              if (idx >= 0) merged[idx] = rm;
              else merged.push(rm);
            });
            return merged;
          });
        }
      }, (err) => console.warn('Members snapshot error:', err));
      unsubscribers.push(unsubMembers);
    } catch (e) {
      console.warn('Real-time listeners setup exception:', e);
    }

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [currentGroup?.id, firebaseAuthUser]);

  // Sync to local storage
  useEffect(() => {
    try {
      localStorage.setItem(`${STORAGE_KEY}_users`, JSON.stringify(users));
      localStorage.setItem(`${STORAGE_KEY}_currentUser`, JSON.stringify(currentUser));
      localStorage.setItem(`${STORAGE_KEY}_groups`, JSON.stringify(groups));
      localStorage.setItem(`${STORAGE_KEY}_currentGroup`, JSON.stringify(currentGroup));
      localStorage.setItem(`${STORAGE_KEY}_groupMembers`, JSON.stringify(groupMembers));
      localStorage.setItem(`${STORAGE_KEY}_contributions`, JSON.stringify(contributions));
      localStorage.setItem(`${STORAGE_KEY}_assignments`, JSON.stringify(assignments));
      localStorage.setItem(`${STORAGE_KEY}_payments`, JSON.stringify(payments));
      localStorage.setItem(`${STORAGE_KEY}_commitments`, JSON.stringify(commitments));
      localStorage.setItem(`${STORAGE_KEY}_commitmentEvents`, JSON.stringify(commitmentEvents));
      localStorage.setItem(`${STORAGE_KEY}_expenses`, JSON.stringify(expenses));
      localStorage.setItem(`${STORAGE_KEY}_disputes`, JSON.stringify(disputes));
      localStorage.setItem(`${STORAGE_KEY}_notifications`, JSON.stringify(notifications));
      localStorage.setItem(`${STORAGE_KEY}_auditLogs`, JSON.stringify(auditLogs));
    } catch (e) {
      console.warn('Storage sync error', e);
    }
  }, [
    users, currentUser, groups, currentGroup, groupMembers,
    contributions, assignments, payments, commitments,
    commitmentEvents, expenses, disputes, notifications, auditLogs
  ]);

  const signInWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Google Sign In failed:', error);
      alert('Google Sign-In failed. Please try again.');
    }
  };

  const signOut = async () => {
    try {
      await fbSignOut(auth);
      setFirebaseAuthUser(null);
    } catch (error) {
      console.error('Sign Out failed:', error);
    }
  };

  const addAuditLog = async (action: string, details: string, securityEvent = false) => {
    const newLog: AuditLog = {
      id: `aud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      groupId: currentGroup?.id,
      actorId: currentUser.id,
      actorName: currentUser.name,
      action,
      details,
      timestamp: new Date().toISOString(),
      securityEvent,
    };
    setAuditLogs(prev => [newLog, ...prev]);

    if (currentGroup) {
      const path = `groups/${currentGroup.id}/auditLogs`;
      try {
        await setDoc(doc(db, path, newLog.id), newLog);
      } catch (e) {
        console.warn('Firestore audit log write:', e);
      }
    }
  };

  const addNotification = async (
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
    setNotifications(prev => [newNotif, ...prev]);

    try {
      await setDoc(doc(db, `users/${userId}/notifications`, newNotif.id), newNotif);
    } catch (e) {
      console.warn('Firestore notification write:', e);
    }
  };

  // Record payment
  const recordPayment = (params: {
    assignmentId: string;
    amount: number;
    paymentMethod: PaymentMethod;
    transactionReference?: string;
    receiptImageUrl?: string;
    receiptNote?: string;
  }) => {
    const targetAssignment = assignments.find(a => a.id === params.assignmentId);
    if (!targetAssignment) return { success: false, paymentId: '', newOutstanding: 0 };

    const rawRef = params.transactionReference?.trim();
    const isCustomRefProvided = Boolean(rawRef);
    const effectiveReference = isCustomRefProvided 
      ? rawRef! 
      : (params.receiptImageUrl 
          ? `REC-IMG-${Math.random().toString(36).substring(2, 7).toUpperCase()}-${Math.floor(100 + Math.random() * 899)}`
          : `TX-${Date.now().toString().slice(-6)}`);

    // Duplicate check on manual transaction reference only
    if (isCustomRefProvided) {
      const duplicate = payments.find(p => 
        p.transactionReference.trim().toLowerCase() === rawRef!.toLowerCase()
      );
      if (duplicate) {
        addAuditLog('PAYMENT_DUPLICATE_REJECTED', `Duplicate transaction ref blocked: ${rawRef}`, true);
        alert(`Transaction reference "${rawRef}" has already been recorded.`);
        return { success: false, paymentId: '', newOutstanding: 0 };
      }
    }

    const paymentId = `TX-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;
    const nowIso = new Date().toISOString();

    const isDirectAutoVerified = currentUser.role === 'treasurer' || currentUser.role === 'group_admin' || currentUser.role === 'super_admin';

    const newPayment: Payment = {
      id: paymentId,
      assignmentId: targetAssignment.id,
      contributionId: targetAssignment.contributionId,
      groupId: targetAssignment.groupId,
      memberId: targetAssignment.memberId,
      amountReceived: Number(params.amount),
      paymentDate: nowIso,
      paymentMethod: params.paymentMethod,
      transactionReference: effectiveReference,
      receiptImageUrl: params.receiptImageUrl,
      receiptEvidenceUrl: params.receiptImageUrl,
      collectorId: currentUser.id,
      verificationStatus: isDirectAutoVerified ? 'verified' : 'pending_verification',
      verifiedAt: isDirectAutoVerified ? nowIso : undefined,
      verifiedBy: isDirectAutoVerified ? currentUser.id : undefined,
      receiptNote: params.receiptNote,
      createdAt: nowIso,
    };

    const updatedPayments = [...payments, newPayment];
    setPayments(updatedPayments);

    if (currentGroup) {
      setDoc(doc(db, `groups/${currentGroup.id}/payments`, newPayment.id), newPayment)
        .catch(err => console.warn('Firestore payment sync:', err));
    }

    // Calculate updated assignment numbers
    const totalVerified = updatedPayments
      .filter(p => p.assignmentId === targetAssignment.id && p.verificationStatus === 'verified')
      .reduce((sum, p) => sum + p.amountReceived, 0);

    const newOutstanding = Math.max(0, targetAssignment.assignedAmount - totalVerified);
    const newStatus = determineAssignmentPaymentStatus(
      targetAssignment.assignedAmount,
      totalVerified,
      0,
      targetAssignment.deadline
    );

    setAssignments(prev => prev.map(a => 
      a.id === targetAssignment.id ? { ...a, status: newStatus } : a
    ));

    // Update commitment if active
    const activeCommitment = commitments.find(c => 
      c.assignmentId === targetAssignment.id && 
      (c.status === 'active' || c.status === 'due_soon' || c.status === 'due_today' || c.status === 'overdue')
    );

    if (activeCommitment && isDirectAutoVerified) {
      const remainingForCommitment = Math.max(0, activeCommitment.currentOutstandingAmount - Number(params.amount));
      const isSettled = remainingForCommitment <= 0;

      setCommitments(prev => prev.map(c => {
        if (c.id === activeCommitment.id) {
          const updated = {
            ...c,
            currentOutstandingAmount: remainingForCommitment,
            status: isSettled ? ('completed' as const) : c.status,
            completedAt: isSettled ? nowIso : undefined,
          };
          if (currentGroup) {
            setDoc(doc(db, `groups/${currentGroup.id}/commitments`, updated.id), updated).catch(() => {});
          }
          return updated;
        }
        return c;
      }));

      // Add commitment event
      const event: CommitmentEvent = {
        id: `cev_${Date.now()}`,
        commitmentId: activeCommitment.id,
        date: nowIso,
        eventType: isSettled ? 'completed' : 'partial_payment',
        notes: isSettled 
          ? `Settled in full with payment of MK ${params.amount.toLocaleString()}. Balance is now MK 0.`
          : `Partial payment of MK ${params.amount.toLocaleString()} received. Remaining balance: MK ${remainingForCommitment.toLocaleString()}.`,
        recordedBy: currentUser.id,
        amountPaid: Number(params.amount),
      };
      setCommitmentEvents(prev => [...prev, event]);
    }

    addAuditLog('PAYMENT_RECORDED', `Payment of MK ${params.amount.toLocaleString()} recorded for assignment ${targetAssignment.id}. Ref: ${params.transactionReference}.`);
    addNotification(
      targetAssignment.memberId,
      'Payment Recorded',
      `Payment of MK ${params.amount.toLocaleString()} recorded via ${params.paymentMethod.replace('_', ' ')}. Ref: ${params.transactionReference}.`,
      'payment'
    );

    return { success: true, paymentId, newOutstanding };
  };

  // Verify payment
  const verifyPayment = (paymentId: string, approved: boolean, reason?: string) => {
    const payment = payments.find(p => p.id === paymentId);
    if (!payment) return;

    const nowIso = new Date().toISOString();
    const newStatus = approved ? 'verified' : 'rejected';

    setPayments(prev => prev.map(p => 
      p.id === paymentId 
        ? {
            ...p,
            verificationStatus: newStatus,
            verifiedAt: approved ? nowIso : undefined,
            verifiedBy: currentUser.id,
            rejectionReason: approved ? undefined : reason,
          }
        : p
    ));

    if (currentGroup) {
      setDoc(doc(db, `groups/${currentGroup.id}/payments`, paymentId), {
        verificationStatus: newStatus,
        verifiedAt: approved ? nowIso : undefined,
        verifiedBy: currentUser.id,
        rejectionReason: approved ? undefined : reason,
      }, { merge: true }).catch(() => {});
    }

    // Update assignment status
    const targetAssignment = assignments.find(a => a.id === payment.assignmentId);
    if (targetAssignment) {
      const updatedPayments = payments.map(p => 
        p.id === paymentId ? { ...p, verificationStatus: newStatus } : p
      );
      const totalVerified = updatedPayments
        .filter(p => p.assignmentId === targetAssignment.id && p.verificationStatus === 'verified')
        .reduce((sum, p) => sum + p.amountReceived, 0);

      const updatedStatus = determineAssignmentPaymentStatus(
        targetAssignment.assignedAmount,
        totalVerified,
        0,
        targetAssignment.deadline
      );

      setAssignments(prev => prev.map(a => 
        a.id === targetAssignment.id ? { ...a, status: updatedStatus } : a
      ));
    }

    addAuditLog(
      approved ? 'PAYMENT_VERIFIED' : 'PAYMENT_REJECTED',
      `Payment ${paymentId} ${approved ? 'verified' : 'rejected'} by ${currentUser.name}. ${reason ? 'Reason: ' + reason : ''}`
    );

    addNotification(
      payment.memberId,
      approved ? 'Payment Verified' : 'Payment Rejected',
      approved 
        ? `Your payment of MK ${payment.amountReceived.toLocaleString()} (${payment.transactionReference}) is verified.`
        : `Your payment of MK ${payment.amountReceived.toLocaleString()} was rejected: ${reason || 'Invalid reference'}.`,
      'payment'
    );
  };

  // Create payment commitment
  const createCommitment = (params: {
    assignmentId: string;
    promisedDate: string;
    durationDays: number;
    notes?: string;
  }) => {
    const assignment = assignments.find(a => a.id === params.assignmentId);
    if (!assignment) return false;

    const paidVerified = payments
      .filter(p => p.assignmentId === assignment.id && p.verificationStatus === 'verified')
      .reduce((sum, p) => sum + p.amountReceived, 0);

    const outstanding = Math.max(0, assignment.assignedAmount - paidVerified);
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
      notes: `Commitment agreed: MK ${outstanding.toLocaleString()} promised by ${new Date(params.promisedDate).toLocaleDateString()}. (${params.durationDays} days duration)`,
      recordedBy: currentUser.id,
      newPromisedDate: params.promisedDate,
    };

    setCommitments(prev => [newCommitment, ...prev]);
    setCommitmentEvents(prev => [event, ...prev]);

    if (currentGroup) {
      setDoc(doc(db, `groups/${currentGroup.id}/commitments`, commitmentId), newCommitment).catch(() => {});
    }

    addAuditLog(
      'COMMITMENT_CREATED',
      `Created ${params.durationDays}-day commitment of MK ${outstanding.toLocaleString()} for member ${assignment.memberId}`
    );

    addNotification(
      assignment.memberId,
      'Payment Commitment Active',
      `Your promise to settle remaining MK ${outstanding.toLocaleString()} by ${new Date(params.promisedDate).toLocaleDateString()} has been recorded.`,
      'commitment'
    );

    return true;
  };

  // Request commitment extension
  const requestCommitmentExtension = (commitmentId: string, newDate: string, reason: string) => {
    setCommitments(prev => prev.map(c => 
      c.id === commitmentId ? { ...c, status: 'extension_requested' } : c
    ));

    const event: CommitmentEvent = {
      id: `cev_${Date.now()}`,
      commitmentId,
      date: new Date().toISOString(),
      eventType: 'extension_requested',
      notes: `Extension requested to ${new Date(newDate).toLocaleDateString()}. Reason: ${reason}`,
      recordedBy: currentUser.id,
      newPromisedDate: newDate,
    };
    setCommitmentEvents(prev => [...prev, event]);

    addAuditLog('EXTENSION_REQUESTED', `Extension requested on commitment ${commitmentId}: ${reason}`);
    
    if (currentGroup?.adminId) {
      addNotification(
        currentGroup.adminId,
        'Commitment Extension Requested',
        `${currentUser.name} requested an extension for their pending balance.`,
        'commitment'
      );
    }
  };

  // Approve extension
  const approveCommitmentExtension = (commitmentId: string, approved: boolean) => {
    const commitment = commitments.find(c => c.id === commitmentId);
    if (!commitment) return;

    const lastEvent = [...commitmentEvents]
      .reverse()
      .find(e => e.commitmentId === commitmentId && e.eventType === 'extension_requested');

    const newDate = lastEvent?.newPromisedDate || commitment.promisedDate;

    setCommitments(prev => prev.map(c => {
      if (c.id === commitmentId) {
        return {
          ...c,
          promisedDate: approved ? newDate : c.promisedDate,
          status: approved ? 'revised' : 'active',
          extensionCount: approved ? c.extensionCount + 1 : c.extensionCount,
        };
      }
      return c;
    }));

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
    setCommitmentEvents(prev => [...prev, event]);

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
  const recordExpense = (expenseData: Omit<Expense, 'id' | 'createdAt' | 'status'>) => {
    const isAutoApproved = currentUser.role === 'group_admin' || currentUser.role === 'super_admin';
    const nowIso = new Date().toISOString();

    const newExpense: Expense = {
      ...expenseData,
      id: `exp_${Date.now()}`,
      status: isAutoApproved ? 'approved' : 'pending_approval',
      approvedBy: isAutoApproved ? currentUser.id : undefined,
      approvedAt: isAutoApproved ? nowIso : undefined,
      createdAt: nowIso,
    };

    setExpenses(prev => [newExpense, ...prev]);

    if (currentGroup) {
      setDoc(doc(db, `groups/${currentGroup.id}/expenses`, newExpense.id), newExpense).catch(() => {});
    }

    addAuditLog('EXPENSE_RECORDED', `Expense of MK ${expenseData.amount.toLocaleString()} for "${expenseData.name}" recorded.`);
    if (currentGroup?.adminId) {
      addNotification(
        currentGroup.adminId,
        'New Expense Submitted',
        `Expense "${expenseData.name}" (MK ${expenseData.amount.toLocaleString()}) recorded for group.`,
        'expense'
      );
    }
  };

  // Approve expense
  const approveExpense = (expenseId: string, approved: boolean) => {
    const nowIso = new Date().toISOString();
    setExpenses(prev => prev.map(e => 
      e.id === expenseId 
        ? {
            ...e,
            status: approved ? 'approved' : 'rejected',
            approvedBy: currentUser.id,
            approvedAt: nowIso,
          }
        : e
    ));

    addAuditLog(
      approved ? 'EXPENSE_APPROVED' : 'EXPENSE_REJECTED',
      `Expense ${expenseId} was ${approved ? 'approved' : 'rejected'} by ${currentUser.name}.`
    );
  };

  // Create Contribution with individual assignments
  const createContribution = (
    contributionData: Omit<Contribution, 'id' | 'createdAt'>,
    memberAssignments: { memberId: string; amount: number; notes?: string }[]
  ) => {
    const contributionId = `cntr_${Date.now()}`;
    const nowIso = new Date().toISOString();

    const newContribution: Contribution = {
      ...contributionData,
      id: contributionId,
      createdAt: nowIso,
    };

    const newAssignments: ContributionAssignment[] = memberAssignments.map((ma, idx) => ({
      id: `asg_${Date.now()}_${idx}`,
      contributionId,
      groupId: contributionData.groupId,
      memberId: ma.memberId,
      assignedAmount: Number(ma.amount),
      assignedDate: nowIso,
      deadline: contributionData.deadline,
      notes: ma.notes || '',
      status: 'unpaid',
    }));

    setContributions(prev => [newContribution, ...prev]);
    setAssignments(prev => [...newAssignments, ...prev]);

    if (currentGroup) {
      setDoc(doc(db, `groups/${currentGroup.id}/contributions`, contributionId), newContribution).catch(() => {});
    }

    addAuditLog(
      'CONTRIBUTION_CREATED',
      `Created monthly contribution "${contributionData.title}" with target MK ${contributionData.totalTargetAmount.toLocaleString()} for ${memberAssignments.length} members.`
    );

    // Notify all assigned members
    memberAssignments.forEach(ma => {
      addNotification(
        ma.memberId,
        'New Contribution Assigned',
        `You have been assigned MK ${ma.amount.toLocaleString()} for "${contributionData.title}". Deadline: ${new Date(contributionData.deadline).toLocaleDateString()}.`,
        'announcement'
      );
    });
  };

  // Create Group
  const createGroup = (groupData: Omit<Group, 'id' | 'createdAt' | 'memberCount' | 'adminId' | 'treasurerId' | 'joinCode'>) => {
    const groupId = `grp_${Date.now()}`;
    const randomCode = `KL-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.floor(10 + Math.random() * 89)}`;

    const newGroup: Group = {
      ...groupData,
      id: groupId,
      adminId: currentUser.id,
      treasurerId: currentUser.id,
      defaultCurrency: 'MWK',
      joinCode: randomCode,
      createdAt: new Date().toISOString(),
      memberCount: 1,
    };

    setGroups(prev => [...prev, newGroup]);
    setCurrentGroup(newGroup);

    // Add current user as admin in group members
    const newMember: GroupMember = {
      id: currentUser.id,
      groupId,
      userId: currentUser.id,
      roleInGroup: 'admin',
      joinedAt: new Date().toISOString(),
      status: 'active',
    };
    setGroupMembers(prev => [...prev, newMember]);

    // Firestore sync
    setDoc(doc(db, 'groups', groupId), newGroup).catch(() => {});
    setDoc(doc(db, `groups/${groupId}/members`, currentUser.id), newMember).catch(() => {});

    addAuditLog('GROUP_CREATED', `Group "${groupData.name}" created with code ${randomCode}`);
    return groupId;
  };

  // Add Member to Group
  const addMemberToGroup = (params: {
    name: string;
    email: string;
    phone: string;
    role: 'admin' | 'treasurer' | 'member';
    roomNumber?: string;
  }) => {
    if (!currentGroup) return false;

    // Check if user already exists by email/phone or create new user
    let user = users.find(u => u.email.toLowerCase() === params.email.toLowerCase() || u.phone === params.phone);
    if (!user) {
      const platformRole = params.role === 'admin' ? 'group_admin' : params.role === 'treasurer' ? 'treasurer' : 'member';
      user = {
        id: `usr_${Date.now()}`,
        name: params.name.trim(),
        email: params.email.trim(),
        phone: params.phone.trim(),
        role: platformRole,
        roomNumber: params.roomNumber?.trim() || undefined,
        createdAt: new Date().toISOString(),
      };
      setUsers(prev => [...prev, user!]);
      setDoc(doc(db, 'users', user.id), user).catch(() => {});
    }

    const targetUser = user;
    if (!targetUser) return { success: false };

    // Check if already an active member of this group
    const existingMember = groupMembers.find(gm => gm.groupId === currentGroup.id && gm.userId === targetUser.id);
    if (existingMember && existingMember.status === 'active') {
      alert(`${params.name} is already an active member of this group.`);
      return { success: false };
    }

    // If re-enrolling a departed member
    if (existingMember && existingMember.status === 'departed') {
      setGroupMembers(prev => prev.map(gm => 
        gm.id === existingMember.id 
          ? { ...gm, status: 'active', roleInGroup: params.role, departedAt: undefined, departureReason: undefined } 
          : gm
      ));
      setGroups(prev => prev.map(g => g.id === currentGroup.id ? { ...g, memberCount: g.memberCount + 1 } : g));
      setDoc(doc(db, `groups/${currentGroup.id}/members`, targetUser.id), { 
        status: 'active', 
        roleInGroup: params.role,
        departedAt: null,
        departureReason: null,
      }, { merge: true }).catch(() => {});
      addAuditLog('MEMBER_REENROLLED', `Re-enrolled member ${params.name} (${params.role}) into group ${currentGroup.name}`);
      return { success: true, user: targetUser };
    }

    const newGroupMember: GroupMember = {
      id: targetUser.id,
      groupId: currentGroup.id,
      userId: targetUser.id,
      roleInGroup: params.role,
      joinedAt: new Date().toISOString(),
      status: 'active',
    };

    setGroupMembers(prev => [...prev, newGroupMember]);
    setGroups(prev => prev.map(g => g.id === currentGroup.id ? { ...g, memberCount: g.memberCount + 1 } : g));

    setDoc(doc(db, `groups/${currentGroup.id}/members`, targetUser.id), newGroupMember).catch(() => {});

    addAuditLog('MEMBER_ENROLLED', `Added member ${params.name} (${params.role}) to group ${currentGroup.name}`);
    return { success: true, user: targetUser };
  };

  // Remove / Mark Member as Departed
  const removeMemberFromGroup = (userId: string, reason?: string) => {
    if (!currentGroup) return false;

    const targetUser = users.find(u => u.id === userId);
    const memberName = targetUser?.name || 'Member';
    const nowIso = new Date().toISOString();

    setGroupMembers(prev => prev.map(gm => {
      if (gm.groupId === currentGroup.id && gm.userId === userId) {
        return {
          ...gm,
          status: 'departed' as const,
          departedAt: nowIso,
          departureReason: reason || 'Tenant moved out / left group'
        };
      }
      return gm;
    }));

    setGroups(prev => prev.map(g => 
      g.id === currentGroup.id ? { ...g, memberCount: Math.max(1, g.memberCount - 1) } : g
    ));

    setDoc(doc(db, `groups/${currentGroup.id}/members`, userId), {
      status: 'departed',
      departedAt: nowIso,
      departureReason: reason || 'Tenant moved out / left group'
    }, { merge: true }).catch(() => {});

    addAuditLog(
      'MEMBER_REMOVED',
      `Admin ${currentUser.name} removed member ${memberName} from group ${currentGroup.name}. Reason: ${reason || 'Tenant moved out'}`
    );

    addNotification(
      userId,
      'Group Membership Update',
      `You have been marked as departed from "${currentGroup.name}". Your payment history remains archived.`,
      'announcement'
    );

    return true;
  };

  // Submit dispute
  const submitDispute = (disputeData: Omit<Dispute, 'id' | 'createdAt' | 'updatedAt' | 'status'>) => {
    const nowIso = new Date().toISOString();
    const disputeId = `dsp_${Date.now()}`;

    const newDispute: Dispute = {
      ...disputeData,
      id: disputeId,
      status: 'open',
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    setDisputes(prev => [newDispute, ...prev]);

    if (currentGroup) {
      setDoc(doc(db, `groups/${currentGroup.id}/disputes`, disputeId), newDispute).catch(() => {});
    }

    addAuditLog('DISPUTE_SUBMITTED', `Dispute filed by ${currentUser.name}: ${disputeData.title}`);

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
  const resolveDispute = (disputeId: string, resolutionNote: string, status: 'resolved' | 'rejected') => {
    const nowIso = new Date().toISOString();
    const dispute = disputes.find(d => d.id === disputeId);
    if (!dispute) return;

    setDisputes(prev => prev.map(d => 
      d.id === disputeId 
        ? {
            ...d,
            status,
            resolutionNote,
            resolvedBy: currentUser.id,
            updatedAt: nowIso,
          }
        : d
    ));

    if (currentGroup) {
      setDoc(doc(db, `groups/${currentGroup.id}/disputes`, disputeId), {
        status,
        resolutionNote,
        resolvedBy: currentUser.id,
        updatedAt: nowIso,
      }, { merge: true }).catch(() => {});
    }

    addAuditLog('DISPUTE_RESOLVED', `Dispute ${disputeId} marked as ${status} by ${currentUser.name}`);
    addNotification(
      dispute.memberId,
      `Dispute ${status === 'resolved' ? 'Resolved' : 'Declined'}`,
      `Outcome on your dispute "${dispute.title}": ${resolutionNote}`,
      'dispute'
    );
  };

  const markNotificationRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAllNotificationsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const clearAllData = () => {
    localStorage.clear();
    const cleanAdmin: User = {
      id: 'usr_admin',
      name: 'System Administrator',
      email: 'admin@klarency.mw',
      phone: '+265 999 000 000',
      role: 'super_admin',
      createdAt: new Date().toISOString(),
    };
    setUsers([cleanAdmin]);
    setCurrentUser(cleanAdmin);
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
    setNotifications([]);
    setAuditLogs([]);
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        setCurrentUser,
        firebaseAuthUser,
        signInWithGoogle,
        signOut,
        isFirebaseReady,
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
        notifications,
        auditLogs,
        recordPayment,
        verifyPayment,
        createCommitment,
        requestCommitmentExtension,
        approveCommitmentExtension,
        recordExpense,
        approveExpense,
        createContribution,
        createGroup,
        addMemberToGroup,
        removeMemberFromGroup,
        submitDispute,
        resolveDispute,
        markNotificationRead,
        markAllNotificationsRead,
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

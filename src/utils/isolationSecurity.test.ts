import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  ACCOUNT_SCOPED_KEY_PREFIX,
  getAccountStorageKey,
  getAccountStoragePrefix,
  purgeAccountScopedStorage,
  purgeLegacyUnscopedStorage,
  readUidScopedStorage,
  StorageKeysReadable,
} from './storageUtils';
import {
  getEffectiveGroupRole,
  resolveMemberForUser,
  canManageGroupRole,
  canVerifyPaymentsRole,
} from './centralizedFinancialAdmin';
import { calculateVerifiedPaidForAssignment } from './financialCalculations';
import { Group, GroupMember, Payment, User } from '../types';

function createMemoryStorage(initial: Record<string, string> = {}): StorageKeysReadable & {
  snapshot: () => Record<string, string>;
} {
  const map = new Map<string, string>(Object.entries(initial));
  return {
    get length() {
      return map.size;
    },
    key(index: number) {
      return Array.from(map.keys())[index] ?? null;
    },
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
    removeItem(key: string) {
      map.delete(key);
    },
    snapshot() {
      return Object.fromEntries(map.entries());
    },
  };
}

describe('UNIT SPOT Security Remediation — User Data Isolation & Access Control', () => {
  const accountA: User = {
    id: 'uid_account_A',
    name: 'Admin A',
    email: 'admin.a@unitspot.mw',
    role: 'super_admin', // Even if legacy role was super_admin, per-group scope must override!
    createdAt: '2026-01-01T00:00:00.000Z',
  };

  const accountB: User = {
    id: 'uid_account_B',
    name: 'Member B',
    email: 'member.b@unitspot.mw',
    role: 'group_admin', // Default signup role on user profile, must NOT grant admin in A's group!
    createdAt: '2026-01-02T00:00:00.000Z',
  };

  const accountC: User = {
    id: 'uid_account_C',
    name: 'Outsider C',
    email: 'outsider.c@unitspot.mw',
    role: 'group_admin',
    createdAt: '2026-01-03T00:00:00.000Z',
  };

  const groupA: Group = {
    id: 'grp_A',
    name: 'Area 47 Flatmates',
    description: 'House bills',
    category: 'house',
    adminId: accountA.id,
    treasurerId: accountA.id,
    memberUids: [accountA.id, accountB.id],
    defaultCurrency: 'MWK',
    paymentRules: 'Verify mobile money receipts before marking settled.',
    joinCode: 'US-A47-91',
    joinPolicy: 'code_auto',
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    memberCount: 2,
  };

  const groupC: Group = {
    id: 'grp_C',
    name: 'Chisomo Village Bank',
    description: 'Savings group',
    category: 'savings_group',
    adminId: accountC.id,
    treasurerId: accountC.id,
    memberUids: [accountC.id],
    defaultCurrency: 'MWK',
    paymentRules: 'Monthly shares due by 28th.',
    joinCode: 'US-CVB-22',
    joinPolicy: 'code_auto',
    status: 'active',
    createdAt: '2026-01-03T00:00:00.000Z',
    memberCount: 1,
  };

  const groupMembers: GroupMember[] = [
    {
      id: accountA.id,
      userId: accountA.id,
      linkedUserId: accountA.id,
      groupId: groupA.id,
      name: accountA.name,
      email: accountA.email,
      roleInGroup: 'admin',
      joinedAt: '2026-01-01T00:00:00.000Z',
      status: 'active',
    },
    {
      id: accountB.id,
      userId: accountB.id,
      linkedUserId: accountB.id,
      groupId: groupA.id,
      name: accountB.name,
      email: accountB.email,
      roleInGroup: 'member',
      joinedAt: '2026-01-02T00:00:00.000Z',
      status: 'active',
    },
    {
      id: accountC.id,
      userId: accountC.id,
      linkedUserId: accountC.id,
      groupId: groupC.id,
      name: accountC.name,
      email: accountC.email,
      roleInGroup: 'admin',
      joinedAt: '2026-01-03T00:00:00.000Z',
      status: 'active',
    },
  ];

  test('1. LocalStorage purges legacy unscoped financial keys completely', () => {
    const storage = createMemoryStorage({
      unitspot_app_state_v4_groups: JSON.stringify([groupA]),
      unitspot_app_state_v4_payments: JSON.stringify([{ id: 'TX-1', amountReceived: 50000 }]),
      klarency_app_state_v3_users: JSON.stringify([accountA]),
      klarency_pre_repair_snapshot_v1: JSON.stringify({ savedAt: '2026-01-01' }),
      unitspot_lang: 'en',
      unitspot_theme: 'dark',
    });

    const removed = purgeLegacyUnscopedStorage(storage);
    assert.equal(removed, 4);
    assert.deepEqual(storage.snapshot(), {
      unitspot_lang: 'en',
      unitspot_theme: 'dark',
    });
  });

  test('2. Account switching on the same device purges foreign UID storage and never leaks cached groups/payments', () => {
    const storage = createMemoryStorage();
    const keyAGroups = getAccountStorageKey(accountA.id, 'groups');
    const keyAPayments = getAccountStorageKey(accountA.id, 'payments');
    const keyASnapshot = getAccountStorageKey(accountA.id, 'pre_repair_snapshot');

    storage.setItem(keyAGroups, JSON.stringify([groupA]));
    storage.setItem(keyAPayments, JSON.stringify([{ id: 'TX-A-01', amountReceived: 25000 }]));
    storage.setItem(keyASnapshot, JSON.stringify({ savedAt: '2026-02-01' }));

    // Account C logs in on the same browser: foreign UID keys must be purged while preserving C's own keys & UI prefs
    storage.setItem('unitspot_theme', 'light');
    storage.setItem(getAccountStorageKey(accountC.id, 'groups'), JSON.stringify([groupC]));

    const purgedForeign = purgeAccountScopedStorage(storage, { preserveUid: accountC.id });
    assert.equal(purgedForeign, 3);

    // Account C reads strictly empty/own data, never Account A's
    assert.equal(storage.getItem(keyAGroups), null);
    assert.equal(storage.getItem(keyAPayments), null);
    assert.equal(storage.getItem(keyASnapshot), null);

    const groupsForC = readUidScopedStorage<Group[]>(storage, accountC.id, 'groups', []);
    assert.equal(groupsForC.length, 1);
    assert.equal(groupsForC[0].id, groupC.id);

    const paymentsForC = readUidScopedStorage<Payment[]>(storage, accountC.id, 'payments', []);
    assert.deepEqual(paymentsForC, []);

    // Sign out for Account C clears C's cached state completely
    const clearedC = purgeAccountScopedStorage(storage, { targetUid: accountC.id });
    assert.equal(clearedC, 1);
    assert.equal(storage.getItem(getAccountStorageKey(accountC.id, 'groups')), null);
    assert.equal(storage.getItem('unitspot_theme'), 'light');

    // Unauthenticated read always returns fallback
    assert.deepEqual(readUidScopedStorage<Group[]>(storage, null, 'groups', []), []);
    assert.ok(getAccountStoragePrefix(accountA.id).startsWith(ACCOUNT_SCOPED_KEY_PREFIX));
  });

  test('3. Per-group role resolution blocks cross-tenant privilege escalation even with super_admin user role', () => {
    // Account A is admin in groupA, but must be ONLY member in groupC even though accountA.role === 'super_admin'
    assert.equal(getEffectiveGroupRole(accountA, groupA, groupMembers), 'admin');
    assert.equal(canManageGroupRole(getEffectiveGroupRole(accountA, groupA, groupMembers)), true);

    assert.equal(getEffectiveGroupRole(accountA, groupC, groupMembers), 'member');
    assert.equal(canManageGroupRole(getEffectiveGroupRole(accountA, groupC, groupMembers)), false);
    assert.equal(canVerifyPaymentsRole(getEffectiveGroupRole(accountA, groupC, groupMembers)), false);

    // Account B has role: 'group_admin' on profile, but inside groupA is strictly 'member'
    const roleBInA = getEffectiveGroupRole(accountB, groupA, groupMembers);
    assert.equal(roleBInA, 'member');
    assert.equal(canManageGroupRole(roleBInA), false);
    assert.equal(canVerifyPaymentsRole(roleBInA), false);

    // Account C has zero admin/treasurer authority in groupA
    const roleCInA = getEffectiveGroupRole(accountC, groupA, groupMembers);
    assert.equal(roleCInA, 'member');
    assert.equal(canManageGroupRole(roleCInA), false);
  });

  test('4. Anti-hijack resolveMemberForUser blocks claiming a member record linked to a different UID', () => {
    const membersWithHijackAttempt: GroupMember[] = [
      {
        id: 'mem_real_owner',
        userId: 'uid_real_owner',
        linkedUserId: 'uid_real_owner',
        groupId: groupA.id,
        name: 'Shared Alias',
        email: 'shared.alias@unitspot.mw',
        roleInGroup: 'treasurer',
        joinedAt: '2026-01-01T00:00:00.000Z',
        status: 'active',
      },
    ];

    const attackerRes = resolveMemberForUser(
      'uid_attacker',
      'shared.alias@unitspot.mw',
      groupA.id,
      membersWithHijackAttempt
    );
    assert.equal(attackerRes, null);

    const ownerRes = resolveMemberForUser(
      'uid_real_owner',
      'shared.alias@unitspot.mw',
      groupA.id,
      membersWithHijackAttempt
    );
    assert.equal(ownerRes?.id, 'mem_real_owner');
  });

  test('5. Unverified member submissions never count as verified payments until verifier approves', () => {
    const payments: Payment[] = [
      {
        id: 'TX-pending',
        assignmentId: 'asg_B',
        contributionId: 'cntr_1',
        groupId: groupA.id,
        memberId: accountB.id,
        memberUid: accountB.id,
        amountReceived: 10000,
        paymentDate: '2026-02-01T00:00:00.000Z',
        paymentMethod: 'airtel_money',
        transactionReference: 'AM-123456',
        collectorId: accountB.id,
        verificationStatus: 'pending_verification',
        createdAt: '2026-02-01T00:00:00.000Z',
      },
      {
        id: 'TX-verified',
        assignmentId: 'asg_B',
        contributionId: 'cntr_1',
        groupId: groupA.id,
        memberId: accountB.id,
        memberUid: accountB.id,
        amountReceived: 5000,
        paymentDate: '2026-02-02T00:00:00.000Z',
        paymentMethod: 'cash',
        transactionReference: 'CASH-2',
        collectorId: accountA.id,
        verificationStatus: 'verified',
        createdAt: '2026-02-02T00:00:00.000Z',
      },
    ];

    assert.equal(calculateVerifiedPaidForAssignment('asg_B', payments), 5000);
  });

  test('6. Deployed Firestore & Storage security rules contain zero bypasses and enforce strict tenant + UID scoping', () => {
    const firestoreRules = fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf8');
    const storageRules = fs.readFileSync(path.resolve(process.cwd(), 'storage.rules'), 'utf8');

    // No hardcoded personal email or global super_admin bypasses anywhere in rules
    assert.equal(firestoreRules.includes('cchilongo88@gmail.com'), false);
    assert.equal(firestoreRules.includes('isSuperAdmin'), false);
    assert.equal(firestoreRules.includes('isSuperAdminToken'), false);

    // No wildcard open rules anywhere
    assert.equal(/allow\s+read\s*,\s*write\s*:\s*if\s+true\s*;/.test(firestoreRules), false);
    assert.equal(/allow\s+read\s*,\s*write\s*:\s*if\s+request\.auth\s*!=\s*null\s*;/.test(firestoreRules), false);
    assert.equal(/allow\s+read\s*,\s*write\s*:\s*if\s+true\s*;/.test(storageRules), false);

    // Critical structural locks
    assert.match(firestoreRules, /match\s+\/admins\/\{adminId\}[\s\S]*?allow\s+read,\s*write:\s*if\s+false;/);
    assert.match(firestoreRules, /match\s+\/users\/\{userId\}[\s\S]*?allow\s+list:\s*if\s+false;/);
    assert.match(firestoreRules, /incoming\(\)\.senderId\s*==\s*request\.auth\.uid/);

    // No insecure email-matching hijacks in rules (email_verified is expected; raw email claim comparison must not be used for linking/authz)
    assert.equal(/request\.auth\.token\.email\b/.test(firestoreRules), false);

    // Member privilege separation on private logs, communications, assignments, payments, disputes
    assert.match(
      firestoreRules,
      /match\s+\/auditLogs\/\{logId\}[\s\S]*?allow\s+list:\s*if\s+isGroupManager\(groupId\);/
    );
    assert.match(
      firestoreRules,
      /match\s+\/communications\/\{commId\}[\s\S]*?allow\s+list:\s*if\s+isGroupManager\(groupId\);/
    );
    assert.match(firestoreRules, /match\s+\/assignments\/\{assignmentId\}[\s\S]*?resource\.data\.memberUid\s*==\s*request\.auth\.uid/);
    assert.match(firestoreRules, /match\s+\/payments\/\{paymentId\}[\s\S]*?resource\.data\.memberUid\s*==\s*request\.auth\.uid/);
    assert.match(firestoreRules, /match\s+\/disputes\/\{disputeId\}[\s\S]*?resource\.data\.memberUid\s*==\s*request\.auth\.uid/);

    // Invite join code verification on atomic join
    assert.match(firestoreRules, /inviteCodeUsed\s*==\s*existing\(\)\.joinCode/);

    // Storage rules UID-scoped receipt paths and verification
    assert.match(storageRules, /match\s+\/receipts\/\{groupId\}\/\{userId\}\/\{fileName\}/);
    assert.match(storageRules, /request\.auth\.uid\s*==\s*userId/);
    assert.match(storageRules, /request\.auth\.token\.email_verified\s*==\s*true/);
  });
});

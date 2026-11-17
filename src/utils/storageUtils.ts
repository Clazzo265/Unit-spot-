import { Expense, Payment } from '../types';

export interface StorageLike {
  setItem: (key: string, value: string) => void;
  removeItem?: (key: string) => void;
}

/**
 * Strips inline base64 data:image/ URLs from payment records for localStorage caching
 * so oversized receipt photos never trigger QuotaExceededError in browser storage.
 * Never mutates the original React state objects or Firestore payloads.
 */
export function stripDataUrlsFromPayments(
  payments: Payment[],
  maxInlineLength = 2048
): Payment[] {
  return payments.map((p) => {
    const stripImg =
      typeof p.receiptImageUrl === 'string' &&
      p.receiptImageUrl.startsWith('data:image/') &&
      p.receiptImageUrl.length > maxInlineLength;
    const stripEvidence =
      typeof p.receiptEvidenceUrl === 'string' &&
      p.receiptEvidenceUrl.startsWith('data:image/') &&
      p.receiptEvidenceUrl.length > maxInlineLength;

    if (!stripImg && !stripEvidence) return p;

    return {
      ...p,
      ...(stripImg ? { receiptImageUrl: undefined } : {}),
      ...(stripEvidence ? { receiptEvidenceUrl: undefined } : {}),
    };
  });
}

/**
 * Strips inline base64 data:image/ URLs from expense records for localStorage caching
 * without altering React state or Firestore documents.
 */
export function stripDataUrlsFromExpenses(
  expenses: Expense[],
  maxInlineLength = 2048
): Expense[] {
  return expenses.map((e) => {
    const stripImg =
      typeof e.receiptImageUrl === 'string' &&
      e.receiptImageUrl.startsWith('data:image/') &&
      e.receiptImageUrl.length > maxInlineLength;
    const stripEvidence =
      typeof e.receiptEvidenceUrl === 'string' &&
      e.receiptEvidenceUrl.startsWith('data:image/') &&
      e.receiptEvidenceUrl.length > maxInlineLength;

    if (!stripImg && !stripEvidence) return e;

    return {
      ...e,
      ...(stripImg ? { receiptImageUrl: undefined } : {}),
      ...(stripEvidence ? { receiptEvidenceUrl: undefined } : {}),
    };
  });
}

/**
 * Safely persists JSON to storage, falling back to a compact payload (e.g., without
 * large inline receipt images) if browser localStorage quota is exceeded.
 */
export function persistStorageWithFallback<T>(
  storage: StorageLike,
  key: string,
  value: T,
  compactFallback?: T
): { persisted: boolean; usedFallback: boolean } {
  try {
    storage.setItem(key, JSON.stringify(value));
    return { persisted: true, usedFallback: false };
  } catch {
    if (compactFallback !== undefined) {
      try {
        storage.setItem(key, JSON.stringify(compactFallback));
        return { persisted: true, usedFallback: true };
      } catch {
        return { persisted: false, usedFallback: true };
      }
    }
    return { persisted: false, usedFallback: false };
  }
}

export interface StorageKeysReadable extends StorageLike {
  length: number;
  key: (index: number) => string | null;
  getItem: (key: string) => string | null;
}

export const ACCOUNT_SCOPED_KEY_PREFIX = 'unitspot_u_';

export const LEGACY_UNSCOPED_PREFIXES = [
  'unitspot_app_state_',
  'klarency_app_state_',
  'klarency_pre_repair_snapshot',
];

export const ACCOUNT_STATE_SUBKEYS = [
  'users',
  'groups',
  'currentGroup',
  'groupMembers',
  'contributions',
  'assignments',
  'payments',
  'commitments',
  'commitmentEvents',
  'expenses',
  'disputes',
  'joinRequests',
  'notifications',
  'auditLogs',
  'communications',
  'notificationConfig',
  'pre_repair_snapshot',
] as const;

export function getAccountStoragePrefix(uid: string): string {
  const safeUid = uid.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${ACCOUNT_SCOPED_KEY_PREFIX}${safeUid}_`;
}

export function getAccountStorageKey(uid: string, subkey: string): string {
  return `${getAccountStoragePrefix(uid)}${subkey}`;
}

function collectStorageKeys(storage: StorageKeysReadable): string[] {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i);
    if (k) keys.push(k);
  }
  return keys;
}

/**
 * Removes all legacy unscoped global financial cache keys so an unauthenticated browser
 * or new account can never hydrate stale data from prior app versions or previous sessions.
 */
export function purgeLegacyUnscopedStorage(storage: StorageKeysReadable): number {
  let removed = 0;
  for (const key of collectStorageKeys(storage)) {
    if (LEGACY_UNSCOPED_PREFIXES.some((prefix) => key.startsWith(prefix))) {
      storage.removeItem?.(key);
      removed += 1;
    }
  }
  return removed;
}

/**
 * Removes all cached financial/account state belonging to a specific UID (on Sign Out / Clear Cache)
 * or belonging to any OTHER UID (when switching accounts on the same device).
 */
export function purgeAccountScopedStorage(
  storage: StorageKeysReadable,
  options: { targetUid?: string; preserveUid?: string } = {}
): number {
  let removed = 0;
  const targetPrefix = options.targetUid ? getAccountStoragePrefix(options.targetUid) : null;
  const preservePrefix = options.preserveUid ? getAccountStoragePrefix(options.preserveUid) : null;

  for (const key of collectStorageKeys(storage)) {
    if (!key.startsWith(ACCOUNT_SCOPED_KEY_PREFIX)) continue;
    if (targetPrefix && key.startsWith(targetPrefix)) {
      storage.removeItem?.(key);
      removed += 1;
    } else if (!targetPrefix && (!preservePrefix || !key.startsWith(preservePrefix))) {
      storage.removeItem?.(key);
      removed += 1;
    }
  }
  return removed;
}

/**
 * Safely reads JSON from a UID-scoped storage key; never reads unscoped global financial keys.
 */
export function readUidScopedStorage<T>(
  storage: Pick<StorageKeysReadable, 'getItem'>,
  uid: string | null | undefined,
  subkey: string,
  fallback: T
): T {
  if (!uid) return fallback;
  try {
    const raw = storage.getItem(getAccountStorageKey(uid, subkey));
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/**
 * Merges incoming Firestore items into an existing collection by unique `id`
 * and optionally sorts the result without mutating inputs.
 */
export function mergeItemsById<T extends { id: string }>(
  prev: T[],
  incoming: T[],
  sortCompare?: (a: T, b: T) => number
): T[] {
  const merged = [...prev];
  incoming.forEach((item) => {
    const idx = merged.findIndex((p) => p.id === item.id);
    if (idx >= 0) merged[idx] = item;
    else merged.push(item);
  });
  if (sortCompare) {
    merged.sort(sortCompare);
  }
  return merged;
}

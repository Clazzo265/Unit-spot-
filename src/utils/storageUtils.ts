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

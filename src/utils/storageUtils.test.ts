import test from 'node:test';
import assert from 'node:assert/strict';
import {
  stripDataUrlsFromPayments,
  stripDataUrlsFromExpenses,
  persistStorageWithFallback,
  mergeItemsById,
} from './storageUtils';
import { Expense, Payment } from '../types';

test('stripDataUrlsFromPayments strips oversized data:image URLs without mutating originals', () => {
  const largeDataUrl = `data:image/jpeg;base64,${'A'.repeat(3000)}`;
  const smallHttpsUrl = 'https://example.com/receipt.jpg';
  const payments: Payment[] = [
    {
      id: 'TX-1',
      assignmentId: 'a1',
      contributionId: 'c1',
      groupId: 'g1',
      memberId: 'm1',
      amountReceived: 10000,
      paymentDate: '2026-04-01T00:00:00.000Z',
      paymentMethod: 'airtel_money',
      transactionReference: 'AM-123456',
      collectorId: 'adm1',
      verificationStatus: 'verified',
      receiptImageUrl: largeDataUrl,
      receiptEvidenceUrl: largeDataUrl,
      createdAt: '2026-04-01T00:00:00.000Z',
    },
    {
      id: 'TX-2',
      assignmentId: 'a2',
      contributionId: 'c1',
      groupId: 'g1',
      memberId: 'm2',
      amountReceived: 5000,
      paymentDate: '2026-04-01T00:00:00.000Z',
      paymentMethod: 'cash',
      transactionReference: 'CASH-1',
      collectorId: 'adm1',
      verificationStatus: 'verified',
      receiptImageUrl: smallHttpsUrl,
      createdAt: '2026-04-01T00:00:00.000Z',
    },
  ];

  const stripped = stripDataUrlsFromPayments(payments);

  assert.equal(stripped[0].receiptImageUrl, undefined);
  assert.equal(stripped[0].receiptEvidenceUrl, undefined);
  assert.equal(payments[0].receiptImageUrl, largeDataUrl);
  assert.equal(stripped[1], payments[1]);
  assert.equal(stripped[1].receiptImageUrl, smallHttpsUrl);
});

test('stripDataUrlsFromExpenses strips oversized data:image URLs safely', () => {
  const largeDataUrl = `data:image/png;base64,${'B'.repeat(2500)}`;
  const expenses: Expense[] = [
    {
      id: 'exp-1',
      groupId: 'g1',
      name: 'ESCOM Token',
      category: 'electricity',
      amount: 25000,
      date: '2026-04-02',
      description: 'Prepaid unit token',
      responsiblePersonId: 'adm1',
      receiptImageUrl: largeDataUrl,
      receiptEvidenceUrl: 'https://cdn.example/token.png',
      status: 'approved',
      createdAt: '2026-04-02T00:00:00.000Z',
    },
  ];

  const stripped = stripDataUrlsFromExpenses(expenses);
  assert.equal(stripped[0].receiptImageUrl, undefined);
  assert.equal(stripped[0].receiptEvidenceUrl, 'https://cdn.example/token.png');
  assert.equal(expenses[0].receiptImageUrl, largeDataUrl);
});

test('persistStorageWithFallback uses compact fallback when primary write exceeds quota', () => {
  const store = new Map<string, string>();
  const quotaStorage = {
    setItem: (k: string, v: string) => {
      if (v.length > 100) {
        throw new Error('QuotaExceededError');
      }
      store.set(k, v);
    },
  };

  const largePayload = [{ id: '1', data: 'x'.repeat(200) }];
  const compactPayload = [{ id: '1', data: 'ok' }];

  const result = persistStorageWithFallback(
    quotaStorage,
    'payments',
    largePayload,
    compactPayload
  );

  assert.equal(result.persisted, true);
  assert.equal(result.usedFallback, true);
  assert.equal(store.get('payments'), JSON.stringify(compactPayload));
});

test('mergeItemsById merges updates cleanly and sorts when comparator is supplied', () => {
  const prev = [
    { id: '1', name: 'Old', ts: 10 },
    { id: '2', name: 'Keep', ts: 20 },
  ];
  const incoming = [
    { id: '1', name: 'Updated', ts: 30 },
    { id: '3', name: 'New', ts: 25 },
  ];

  const merged = mergeItemsById(prev, incoming, (a, b) => b.ts - a.ts);
  assert.deepEqual(
    merged.map((x) => x.id),
    ['1', '3', '2']
  );
  assert.equal(merged[0].name, 'Updated');
});

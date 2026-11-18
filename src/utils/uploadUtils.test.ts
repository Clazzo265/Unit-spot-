import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_UPLOAD_SIZE_BYTES,
  validateUploadFile,
  isUploadInProgress,
  computeUploadProgressPct,
  classifyStorageError,
  getUploadStatusLabel,
  formatFriendlyFirestoreError,
  formatUploadFileSize,
} from './uploadUtils';

test('validateUploadFile accepts PDF, JPG, JPEG, and PNG documents up to 5 MB', () => {
  const validPdf = validateUploadFile({
    fileName: 'escom-bill.pdf',
    fileType: 'application/pdf',
    fileSize: 1024 * 512,
    allowPdf: true,
  });
  assert.equal(validPdf.valid, true);
  assert.equal(validPdf.isPdf, true);
  assert.equal(validPdf.normalizedType, 'application/pdf');

  const validJpg = validateUploadFile({
    fileName: 'mpamba_receipt.JPG',
    fileType: 'image/jpeg',
    fileSize: 900_000,
    allowPdf: true,
  });
  assert.equal(validJpg.valid, true);
  assert.equal(validJpg.isImage, true);
  assert.equal(validJpg.normalizedType, 'image/jpeg');

  const validJpegNoMime = validateUploadFile({
    fileName: 'photo.jpeg',
    fileType: '',
    fileSize: 800_000,
    allowPdf: false,
  });
  assert.equal(validJpegNoMime.valid, true);
  assert.equal(validJpegNoMime.normalizedType, 'image/jpeg');

  const validPng = validateUploadFile({
    fileName: 'screenshot.png',
    fileType: 'image/png',
    fileSize: 250_000,
    allowPdf: true,
  });
  assert.equal(validPng.valid, true);
  assert.equal(validPng.normalizedType, 'image/png');
});

test('validateUploadFile rejects empty, oversized, PDFs-where-disallowed, and unsupported formats clearly', () => {
  assert.equal(
    validateUploadFile({ fileName: 'empty.jpg', fileType: 'image/jpeg', fileSize: 0 }).valid,
    false
  );

  const unsupported = validateUploadFile({
    fileName: 'notes.docx',
    fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    fileSize: 12_000,
  });
  assert.equal(unsupported.valid, false);
  assert.match(unsupported.error || '', /PDF, JPG, JPEG, or PNG/);

  const pdfForAvatar = validateUploadFile({
    fileName: 'avatar.pdf',
    fileType: 'application/pdf',
    fileSize: 120_000,
    allowPdf: false,
  });
  assert.equal(pdfForAvatar.valid, false);

  const oversizedPdf = validateUploadFile({
    fileName: 'huge.pdf',
    fileType: 'application/pdf',
    fileSize: MAX_UPLOAD_SIZE_BYTES + 1,
    allowPdf: true,
  });
  assert.equal(oversizedPdf.valid, false);
  assert.match(oversizedPdf.error || '', /5\.00 MB/);

  // Large raw camera photos (> 5 MB) are permitted pre-preparation so client compression can shrink them
  const rawCameraPhoto = validateUploadFile({
    fileName: 'IMG_2026.jpg',
    fileType: 'image/jpeg',
    fileSize: 8 * 1024 * 1024,
    allowPdf: true,
    prePreparation: true,
  });
  assert.equal(rawCameraPhoto.valid, true);
});

test('isUploadInProgress guards active upload states accurately', () => {
  assert.equal(isUploadInProgress('preparing'), true);
  assert.equal(isUploadInProgress('uploading'), true);
  assert.equal(isUploadInProgress('paused'), true);
  assert.equal(isUploadInProgress('retrying'), true);

  assert.equal(isUploadInProgress('idle'), false);
  assert.equal(isUploadInProgress('completed'), false);
  assert.equal(isUploadInProgress('failed'), false);
  assert.equal(isUploadInProgress('cancelled'), false);
});

test('computeUploadProgressPct clamps genuine progress to 0..99 before getDownloadURL', () => {
  assert.equal(computeUploadProgressPct(0, 0), 0);
  assert.equal(computeUploadProgressPct(500, 1000), 50);
  assert.equal(computeUploadProgressPct(1000, 1000), 99);
});

test('classifyStorageError provides clear plain-language feedback for quota, permissions, auth, and offline states', () => {
  assert.equal(classifyStorageError({ code: 'storage/canceled' }).category, 'cancelled');
  assert.equal(classifyStorageError({ code: 'storage/unauthorized' }).category, 'permission');
  assert.equal(classifyStorageError({ code: 'storage/unauthenticated' }).category, 'auth');
  assert.equal(classifyStorageError({ code: 'storage/quota-exceeded' }).category, 'quota');
  assert.equal(classifyStorageError({ code: 'storage/retry-limit-exceeded' }).retryable, true);
  assert.equal(classifyStorageError(new Error('failed'), { isOnline: false }).category, 'network');
  assert.equal(classifyStorageError(null, { authMismatch: true }).category, 'auth');
});

test('getUploadStatusLabel, formatUploadFileSize, and formatFriendlyFirestoreError produce readable text without internal errors', () => {
  assert.equal(getUploadStatusLabel('preparing'), 'Preparing receipt...');
  assert.equal(getUploadStatusLabel('uploading', 42), 'Uploading (42%)');
  assert.equal(getUploadStatusLabel('paused', 60), 'Upload paused (60%)');
  assert.equal(getUploadStatusLabel('completed', 100), 'Upload completed');

  assert.equal(formatUploadFileSize(512), '512 B');
  assert.equal(formatUploadFileSize(2048), '2 KB');
  assert.equal(formatUploadFileSize(2 * 1024 * 1024), '2.00 MB');

  const sanitized = formatFriendlyFirestoreError(
    new Error('FirebaseError: [code=permission-denied]: raw stack details'),
    true
  );
  assert.doesNotMatch(sanitized, /FirebaseError|raw stack/);
});

export type UploadStatus =
  | 'idle'
  | 'preparing'
  | 'uploading'
  | 'paused'
  | 'retrying'
  | 'completed'
  | 'failed'
  | 'cancelled';

export const MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB final upload cap
export const MAX_RAW_IMAGE_BEFORE_COMPRESSION_BYTES = 25 * 1024 * 1024; // 25 MB raw camera ceiling

export const SUPPORTED_DOCUMENT_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
]);

export const SUPPORTED_DOCUMENT_EXTENSIONS = new Set(['pdf', 'jpg', 'jpeg', 'png']);

export const SUPPORTED_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png']);
export const SUPPORTED_IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png']);

export interface UploadValidationInput {
  fileName: string;
  fileType?: string;
  fileSize: number;
  allowPdf?: boolean;
  maxSizeBytes?: number;
  prePreparation?: boolean;
}

export interface UploadValidationResult {
  valid: boolean;
  normalizedType: 'application/pdf' | 'image/jpeg' | 'image/png' | null;
  isPdf: boolean;
  isImage: boolean;
  error?: string;
}

export function extractFileExtension(fileName: string): string {
  const match = (fileName || '').trim().match(/\.([a-zA-Z0-9]+)$/);
  return match ? match[1].toLowerCase() : '';
}

export function formatUploadFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function normalizeSupportedMimeType(
  fileName: string,
  fileType?: string
): 'application/pdf' | 'image/jpeg' | 'image/png' | null {
  const mime = (fileType || '').trim().toLowerCase();
  const ext = extractFileExtension(fileName);

  if (mime === 'application/pdf' || (!mime && ext === 'pdf')) {
    return 'application/pdf';
  }
  if (mime === 'image/png' || (!mime && ext === 'png')) {
    return 'image/png';
  }
  if (
    mime === 'image/jpeg' ||
    mime === 'image/jpg' ||
    (!mime && (ext === 'jpg' || ext === 'jpeg'))
  ) {
    return 'image/jpeg';
  }
  return null;
}

export function validateUploadFile(input: UploadValidationInput): UploadValidationResult {
  const {
    fileName,
    fileType,
    fileSize,
    allowPdf = true,
    maxSizeBytes = MAX_UPLOAD_SIZE_BYTES,
    prePreparation = false,
  } = input;

  if (!Number.isFinite(fileSize) || fileSize <= 0) {
    return {
      valid: false,
      normalizedType: null,
      isPdf: false,
      isImage: false,
      error: 'The selected file is empty (0 bytes). Please choose another file.',
    };
  }

  const normalizedType = normalizeSupportedMimeType(fileName, fileType);
  const ext = extractFileExtension(fileName);
  const mimeLower = (fileType || '').trim().toLowerCase();

  // Guard against mismatched extension if an explicit MIME type is present
  const extMatchesSupported = allowPdf
    ? SUPPORTED_DOCUMENT_EXTENSIONS.has(ext)
    : SUPPORTED_IMAGE_EXTENSIONS.has(ext);
  const mimeSupported = allowPdf
    ? SUPPORTED_DOCUMENT_MIME_TYPES.has(mimeLower)
    : SUPPORTED_IMAGE_MIME_TYPES.has(mimeLower);

  if (!normalizedType || (!mimeSupported && !extMatchesSupported)) {
    return {
      valid: false,
      normalizedType: null,
      isPdf: false,
      isImage: false,
      error: allowPdf
        ? 'Unsupported file format. Please choose a PDF, JPG, JPEG, or PNG file.'
        : 'Unsupported image format. Please choose a JPG, JPEG, or PNG image.',
    };
  }

  const isPdf = normalizedType === 'application/pdf';
  const isImage = !isPdf;

  if (!allowPdf && isPdf) {
    return {
      valid: false,
      normalizedType: null,
      isPdf: true,
      isImage: false,
      error: 'PDF files are not allowed here. Please choose a JPG, JPEG, or PNG photo.',
    };
  }

  const effectiveLimit =
    prePreparation && isImage ? MAX_RAW_IMAGE_BEFORE_COMPRESSION_BYTES : maxSizeBytes;

  if (fileSize > effectiveLimit) {
    const limitLabel = formatUploadFileSize(effectiveLimit);
    return {
      valid: false,
      normalizedType,
      isPdf,
      isImage,
      error: `File is too large (${formatUploadFileSize(fileSize)}). Maximum allowed size is ${limitLabel}.`,
    };
  }

  return {
    valid: true,
    normalizedType,
    isPdf,
    isImage,
  };
}

export function isUploadInProgress(status: UploadStatus): boolean {
  return (
    status === 'preparing' ||
    status === 'uploading' ||
    status === 'paused' ||
    status === 'retrying'
  );
}

export function computeUploadProgressPct(bytesTransferred: number, totalBytes: number): number {
  if (!Number.isFinite(bytesTransferred) || !Number.isFinite(totalBytes) || totalBytes <= 0) {
    return 0;
  }
  const raw = Math.round((Math.max(0, bytesTransferred) / totalBytes) * 100);
  // Hold at 99% until getDownloadURL confirms object metadata & URL retrieval
  return Math.max(0, Math.min(99, raw));
}

export type StorageErrorCategory =
  | 'cancelled'
  | 'auth'
  | 'permission'
  | 'quota'
  | 'network'
  | 'config'
  | 'retry_limit'
  | 'unknown';

export interface ClassifiedStorageError {
  message: string;
  category: StorageErrorCategory;
  retryable: boolean;
}

export function classifyStorageError(
  err: unknown,
  options: { isOnline?: boolean; authMismatch?: boolean } = {}
): ClassifiedStorageError {
  const { isOnline = true, authMismatch = false } = options;

  if (authMismatch) {
    return {
      category: 'auth',
      retryable: false,
      message: 'Your signed-in account changed while uploading. Please try uploading again.',
    };
  }

  const code = ((err as { code?: string })?.code || '').toLowerCase();
  const msg = (err instanceof Error ? err.message : String(err || '')).toLowerCase();

  if (code === 'storage/canceled' || msg.includes('upload cancelled') || msg.includes('canceled')) {
    return {
      category: 'cancelled',
      retryable: true,
      message: 'Upload cancelled.',
    };
  }

  if (code === 'storage/unauthenticated') {
    return {
      category: 'auth',
      retryable: false,
      message: 'Your session has expired. Please sign in again and tap Retry.',
    };
  }

  if (code === 'storage/unauthorized') {
    return {
      category: 'permission',
      retryable: false,
      message:
        'Upload permission denied. Make sure your account email is verified and you are an active member of this group.',
    };
  }

  if (code === 'storage/quota-exceeded') {
    return {
      category: 'quota',
      retryable: false,
      message:
        'Cloud storage quota has been reached for this project. Contact your administrator.',
    };
  }

  if (
    code === 'storage/bucket-not-found' ||
    code === 'storage/project-not-found' ||
    code === 'storage/no-default-bucket'
  ) {
    return {
      category: 'config',
      retryable: false,
      message: 'Cloud storage is not properly configured for this project.',
    };
  }

  if (code === 'storage/retry-limit-exceeded') {
    return {
      category: 'retry_limit',
      retryable: true,
      message:
        'Your internet connection was too unstable to finish uploading. Your form is safe — tap Retry when connected.',
    };
  }

  if (!isOnline) {
    return {
      category: 'network',
      retryable: true,
      message:
        'You are offline. Reconnect to the internet and tap Retry — your form details are preserved.',
    };
  }

  if (code === 'storage/invalid-checksum' || msg.includes('network')) {
    return {
      category: 'network',
      retryable: true,
      message:
        'Network transfer error interrupted the upload. Your form is safe — tap Retry.',
    };
  }

  return {
    category: 'unknown',
    retryable: true,
    message:
      'Could not upload this file to cloud storage. Check your connection and tap Retry.',
  };
}

export function getUploadStatusLabel(status: UploadStatus, progressPct = 0): string {
  switch (status) {
    case 'preparing':
      return 'Preparing receipt...';
    case 'uploading':
      return `Uploading (${progressPct}%)`;
    case 'paused':
      return `Upload paused (${progressPct}%)`;
    case 'retrying':
      return 'Retrying upload...';
    case 'completed':
      return 'Upload completed';
    case 'failed':
      return 'Upload failed';
    case 'cancelled':
      return 'Upload cancelled';
    default:
      return '';
  }
}

export function formatFriendlyFirestoreError(err: unknown, hasRevert: boolean): string {
  const code = ((err as { code?: string })?.code || '').toLowerCase();
  if (code.includes('permission-denied')) {
    return hasRevert
      ? 'Permission check blocked this save. Your previous records remain unchanged.'
      : 'You do not have permission to perform this update.';
  }
  if (code.includes('unauthenticated')) {
    return 'Your sign-in session expired. Please sign in again.';
  }
  if (code.includes('unavailable') || code.includes('network')) {
    return 'Could not reach the server right now. Check your connection and try again.';
  }
  return hasRevert
    ? 'Could not save this update cleanly. Please check your connection and try again.'
    : 'Cloud sync encountered a problem. Changes will retry when connection improves.';
}

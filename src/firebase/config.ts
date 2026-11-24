import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as fbSignOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
} from 'firebase/firestore';
import {
  getStorage,
  ref as storageRef,
  uploadBytesResumable,
  getDownloadURL,
  UploadTask,
} from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  UploadStatus,
  MAX_UPLOAD_SIZE_BYTES,
  classifyStorageError,
  computeUploadProgressPct,
  formatUploadFileSize,
  validateUploadFile,
} from '../utils/uploadUtils';

// Initialize Firebase App
export const app = initializeApp(firebaseConfig);

// Initialize Auth & Providers
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Initialize Firestore with specific database ID from config
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Initialize Firebase Storage with resilient retry windows (no arbitrary 30s transfer cutoff)
export const storage = getStorage(app);
storage.maxUploadRetryTime = 600_000; // 10 minutes
storage.maxOperationRetryTime = 180_000; // 3 minutes

export {
  signInWithPopup,
  fbSignOut,
  onAuthStateChanged,
};
export type { FirebaseUser };

export async function signUpWithEmail(name: string, email: string, password: string): Promise<FirebaseUser> {
  const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
  if (name.trim()) {
    await updateProfile(credential.user, { displayName: name.trim() });
  }
  try {
    await sendEmailVerification(credential.user);
  } catch (err) {
    console.warn('Could not send initial verification email:', err);
  }
  return credential.user;
}

export async function signInWithEmail(email: string, password: string): Promise<FirebaseUser> {
  const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
  return credential.user;
}

export async function resetPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email.trim());
}

export async function resendVerificationEmail(): Promise<void> {
  if (!auth.currentUser) {
    throw new Error('No signed-in user to verify.');
  }
  await sendEmailVerification(auth.currentUser);
}

export async function reloadCurrentUser(): Promise<FirebaseUser | null> {
  if (!auth.currentUser) return null;
  await auth.currentUser.reload();
  // Firestore security rules read email_verified from the ID token, which is
  // cached until expiry. Force a refresh so a just-verified account can write.
  await auth.currentUser.getIdToken(true);
  return auth.currentUser;
}

function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(',');
  const mimeMatch = parts[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const binary = atob(parts[1] || '');
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

export interface UploadedFileMetadata {
  url: string;
  storagePath: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  uploadedToCloud: true;
}

export interface UploadTaskController {
  pause: () => boolean;
  resume: () => boolean;
  cancel: () => boolean;
}

export interface FileUploadOptions {
  folder: 'receipts' | 'supportingDocs' | 'avatars';
  groupId?: string;
  recordId: string;
  file: Blob | File;
  fileName: string;
  contentType?: string;
  maxSizeBytes?: number;
  scopeMeta?: { uploaderUid?: string; adminId?: string; treasurerId?: string };
  onProgress?: (pct: number) => void;
  onStateChange?: (status: UploadStatus, pct: number) => void;
  onTaskCreated?: (controller: UploadTaskController) => void;
}

export function formatFileSize(bytes: number): string {
  return formatUploadFileSize(bytes);
}

const activeUploadTasks = new Set<UploadTask>();

/**
 * Cancels all in-flight Firebase Storage uploads (called on sign-out or account change).
 */
export function cancelAllActiveUploads(): void {
  activeUploadTasks.forEach((task) => {
    try {
      task.cancel();
    } catch {
      // ignore already-settled tasks
    }
  });
  activeUploadTasks.clear();
}

/**
 * Genuine resumable Firebase Storage upload using uploadBytesResumable.
 * Emits real byte-transfer progress (0..99%) and transitions to 100% only after getDownloadURL succeeds.
 */
export async function uploadFileToCloudStorage(
  options: FileUploadOptions
): Promise<UploadedFileMetadata> {
  const {
    folder,
    groupId,
    recordId,
    file,
    fileName,
    contentType,
    maxSizeBytes = MAX_UPLOAD_SIZE_BYTES,
    scopeMeta,
    onProgress,
    onStateChange,
    onTaskCreated,
  } = options;

  const allowPdf = folder !== 'avatars';
  const validation = validateUploadFile({
    fileName,
    fileType: contentType || file.type,
    fileSize: file.size,
    allowPdf,
    maxSizeBytes,
    prePreparation: false,
  });

  if (!validation.valid || !validation.normalizedType) {
    throw new Error(validation.error || 'Unsupported file.');
  }

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new Error(
      'You are offline. Reconnect to the internet and tap Retry — your form details are preserved.'
    );
  }

  const uploaderUid = auth.currentUser?.uid || scopeMeta?.uploaderUid;
  if (!uploaderUid) {
    throw new Error('Please sign in with a verified account before uploading files.');
  }
  if (auth.currentUser && !auth.currentUser.emailVerified) {
    throw new Error('Verify your email address before uploading receipts or documents.');
  }

  const resolvedType = validation.normalizedType;
  const isPdf = validation.isPdf;
  const safeRecordId = recordId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const ext = isPdf ? 'pdf' : resolvedType === 'image/png' ? 'png' : 'jpg';
  const safeFileName = `${safeRecordId}.${ext}`;

  let path: string;
  if (folder === 'avatars') {
    path = `avatars/${uploaderUid}/${safeFileName}`;
  } else {
    const safeGroupId = (groupId || 'general').replace(/[^a-zA-Z0-9_-]/g, '_');
    path = `${folder}/${safeGroupId}/${uploaderUid}/${safeFileName}`;
  }

  const customMetadata: Record<string, string> = {
    uploaderUid,
    originalName: fileName.slice(0, 140),
    ...(groupId ? { groupId: groupId.replace(/[^a-zA-Z0-9_-]/g, '_') } : {}),
    ...(scopeMeta?.adminId ? { adminId: scopeMeta.adminId } : {}),
    ...(scopeMeta?.treasurerId ? { treasurerId: scopeMeta.treasurerId } : {}),
  };

  const fileRef = storageRef(storage, path);
  const task = uploadBytesResumable(fileRef, file, {
    contentType: resolvedType,
    customMetadata,
  });

  activeUploadTasks.add(task);

  const controller: UploadTaskController = {
    pause: () => {
      try {
        return task.pause();
      } catch {
        return false;
      }
    },
    resume: () => {
      try {
        return task.resume();
      } catch {
        return false;
      }
    },
    cancel: () => {
      try {
        return task.cancel();
      } catch {
        return false;
      }
    },
  };
  onTaskCreated?.(controller);

  const downloadUrl = await new Promise<string>((resolve, reject) => {
    let lastPct = 0;
    onProgress?.(0);
    onStateChange?.('uploading', 0);

    task.on(
      'state_changed',
      (snapshot) => {
        // Cancel immediately if user switched account or signed out mid-transfer
        if (auth.currentUser && auth.currentUser.uid !== uploaderUid) {
          try {
            task.cancel();
          } catch {
            // no-op
          }
          activeUploadTasks.delete(task);
          reject(
            new Error(
              classifyStorageError(null, { authMismatch: true }).message
            )
          );
          return;
        }

        if (snapshot.totalBytes > 0) {
          lastPct = computeUploadProgressPct(snapshot.bytesTransferred, snapshot.totalBytes);
          onProgress?.(lastPct);
        }

        if (snapshot.state === 'paused') {
          onStateChange?.('paused', lastPct);
        } else if (snapshot.state === 'running') {
          onStateChange?.('uploading', lastPct);
        }
      },
      (err) => {
        activeUploadTasks.delete(task);
        const isOnline = typeof navigator === 'undefined' ? true : navigator.onLine;
        const classified = classifyStorageError(err, { isOnline });
        onStateChange?.(classified.category === 'cancelled' ? 'cancelled' : 'failed', lastPct);
        reject(new Error(classified.message));
      },
      async () => {
        try {
          if (auth.currentUser && auth.currentUser.uid !== uploaderUid) {
            activeUploadTasks.delete(task);
            onStateChange?.('failed', lastPct);
            reject(new Error(classifyStorageError(null, { authMismatch: true }).message));
            return;
          }
          const url = await getDownloadURL(task.snapshot.ref);
          activeUploadTasks.delete(task);
          onProgress?.(100);
          onStateChange?.('completed', 100);
          resolve(url);
        } catch (urlErr) {
          activeUploadTasks.delete(task);
          const isOnline = typeof navigator === 'undefined' ? true : navigator.onLine;
          const classified = classifyStorageError(urlErr, { isOnline });
          onStateChange?.('failed', lastPct);
          reject(new Error(classified.message));
        }
      }
    );
  });

  return {
    url: downloadUrl,
    storagePath: path,
    fileName,
    fileType: resolvedType,
    fileSize: file.size,
    uploadedToCloud: true,
  };
}

export async function updateFirebaseProfileAvatar(photoUrl: string): Promise<void> {
  if (!auth.currentUser) return;
  await updateProfile(auth.currentUser, { photoURL: photoUrl });
}

/**
 * Legacy helper preserved for data URL uploads (now throws real errors instead of faking cloud success).
 */
export async function uploadReceiptImage(
  groupId: string,
  recordId: string,
  dataUrl: string,
  onProgress?: (pct: number) => void,
  scopeMeta?: { uploaderUid?: string; adminId?: string; treasurerId?: string }
): Promise<{ url: string; storagePath?: string; uploadedToCloud: boolean }> {
  if (!dataUrl || !dataUrl.startsWith('data:image/')) {
    throw new Error('Invalid image data for upload.');
  }
  const blob = dataUrlToBlob(dataUrl);
  const res = await uploadFileToCloudStorage({
    folder: 'receipts',
    groupId,
    recordId,
    file: blob,
    fileName: `${recordId}.jpg`,
    contentType: blob.type || 'image/jpeg',
    scopeMeta,
    onProgress,
  });
  return { url: res.url, storagePath: res.storagePath, uploadedToCloud: true };
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Test connection on boot
export async function testFirestoreConnection() {
  try {
    await getDocFromServer(doc(db, 'system_health', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase connection: client appears offline.');
    }
  }
}

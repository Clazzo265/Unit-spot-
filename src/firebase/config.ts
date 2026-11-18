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
} from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App
export const app = initializeApp(firebaseConfig);

// Initialize Auth & Providers
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Initialize Firestore with specific database ID from config
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Initialize Firebase Storage for receipts
export const storage = getStorage(app);

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
  onTaskCreated?: (cancel: () => void) => void;
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function mapStorageErrorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code || '';
  const msg = err instanceof Error ? err.message : String(err || '');

  if (code === 'storage/canceled' || msg.toLowerCase().includes('cancel')) {
    return 'Upload cancelled.';
  }
  if (code === 'storage/unauthorized') {
    return 'Permission denied by Storage security rules. Ensure your account email is verified and you belong to this group.';
  }
  if (code === 'storage/unauthenticated') {
    return 'Please sign in with a verified account before uploading files.';
  }
  if (code === 'storage/retry-limit-exceeded' || msg.toLowerCase().includes('timeout')) {
    return 'Upload timed out on a slow connection. Keep your form details and tap Retry.';
  }
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return 'You are offline. Reconnect to the internet and tap Retry to upload this file.';
  }
  return msg || 'Could not upload file to cloud storage. Check your connection and tap Retry.';
}

/**
 * Genuine Firebase Storage upload using uploadBytesResumable.
 * Emits real byte-transfer percentages (0..100%) and rejects honestly on offline/rules/timeout errors.
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
    maxSizeBytes = 5 * 1024 * 1024,
    scopeMeta,
    onProgress,
    onTaskCreated,
  } = options;

  const resolvedType = contentType || file.type || 'application/octet-stream';
  const isImage = resolvedType.startsWith('image/');
  const isPdf = resolvedType === 'application/pdf';

  if (folder === 'avatars' && !isImage) {
    throw new Error('Profile photo must be an image file (JPG, PNG, or WebP).');
  }
  if (folder !== 'avatars' && !isImage && !isPdf) {
    throw new Error('Only image files (JPG, PNG, WebP) or PDF documents are supported.');
  }
  if (file.size <= 0) {
    throw new Error('Selected file is empty.');
  }
  if (file.size > maxSizeBytes) {
    throw new Error(`File exceeds maximum size of ${formatFileSize(maxSizeBytes)}. Please choose a smaller file.`);
  }
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new Error('You appear to be offline. Reconnect to upload this file, or submit without attaching it if optional.');
  }

  const uploaderUid = auth.currentUser?.uid || scopeMeta?.uploaderUid;
  if (!uploaderUid) {
    throw new Error('Please sign in first before uploading files.');
  }

  const safeRecordId = recordId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanExtMatch = fileName.match(/\.([a-zA-Z0-9]+)$/);
  const fallbackExt = isPdf ? 'pdf' : isImage ? (resolvedType.split('/')[1] || 'jpg').replace(/[^a-zA-Z0-9]/g, '') : 'bin';
  const ext = (cleanExtMatch ? cleanExtMatch[1].toLowerCase() : fallbackExt) || 'bin';
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

  onTaskCreated?.(() => {
    try {
      task.cancel();
    } catch {
      // no-op
    }
  });

  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    const downloadUrl = await Promise.race<string>([
      new Promise<string>((resolve, reject) => {
        onProgress?.(0);
        task.on(
          'state_changed',
          (snapshot) => {
            if (snapshot.totalBytes > 0 && onProgress) {
              const pct = Math.min(
                99,
                Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)
              );
              onProgress(pct);
            }
          },
          (err) => reject(new Error(mapStorageErrorMessage(err))),
          async () => {
            try {
              const url = await getDownloadURL(task.snapshot.ref);
              onProgress?.(100);
              resolve(url);
            } catch (urlErr) {
              reject(new Error(mapStorageErrorMessage(urlErr)));
            }
          }
        );
      }),
      new Promise<string>((_, reject) => {
        timeoutId = setTimeout(() => {
          try {
            task.cancel();
          } catch {
            // no-op
          }
          reject(new Error('Upload timed out after 30 seconds. Please check your connection and tap Retry.'));
        }, 30000);
      }),
    ]);

    return {
      url: downloadUrl,
      storagePath: path,
      fileName,
      fileType: resolvedType,
      fileSize: file.size,
      uploadedToCloud: true,
    };
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
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

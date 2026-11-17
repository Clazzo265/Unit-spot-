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

/**
 * Upload compressed receipt image to Firebase Storage under a UID-scoped path when authenticated & online.
 * Path: receipts/${groupId}/${uploaderUid}/${recordId}.jpg
 * Attaches customMetadata (groupId, uploaderUid, adminId, treasurerId) so Storage rules restrict access.
 */
export async function uploadReceiptImage(
  groupId: string,
  recordId: string,
  dataUrl: string,
  onProgress?: (pct: number) => void,
  scopeMeta?: { uploaderUid?: string; adminId?: string; treasurerId?: string }
): Promise<{ url: string; storagePath?: string; uploadedToCloud: boolean }> {
  if (!dataUrl || !dataUrl.startsWith('data:image/')) {
    return { url: dataUrl, uploadedToCloud: false };
  }

  const uploaderUid = auth.currentUser?.uid || scopeMeta?.uploaderUid;
  if (!uploaderUid) {
    return { url: dataUrl, uploadedToCloud: false };
  }

  const safeGroupId = groupId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeRecordId = recordId.replace(/[^a-zA-Z0-9_-]/g, '_');

  try {
    const blob = dataUrlToBlob(dataUrl);
    const path = `receipts/${safeGroupId}/${uploaderUid}/${safeRecordId}.jpg`;
    const fileRef = storageRef(storage, path);

    const customMetadata: Record<string, string> = {
      groupId: safeGroupId,
      uploaderUid,
      ...(scopeMeta?.adminId ? { adminId: scopeMeta.adminId } : {}),
      ...(scopeMeta?.treasurerId ? { treasurerId: scopeMeta.treasurerId } : {}),
    };

    const downloadUrl = await Promise.race<string>([
      new Promise<string>((resolve, reject) => {
        const task = uploadBytesResumable(fileRef, blob, {
          contentType: blob.type || 'image/jpeg',
          customMetadata,
        });
        task.on(
          'state_changed',
          (snapshot) => {
            if (snapshot.totalBytes > 0 && onProgress) {
              const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
              onProgress(pct);
            }
          },
          (err) => reject(err),
          async () => {
            try {
              const url = await getDownloadURL(task.snapshot.ref);
              onProgress?.(100);
              resolve(url);
            } catch (urlErr) {
              reject(urlErr);
            }
          }
        );
      }),
      new Promise<string>((_, reject) =>
        setTimeout(() => reject(new Error('Storage upload timeout')), 12000)
      ),
    ]);

    return { url: downloadUrl, storagePath: path, uploadedToCloud: true };
  } catch (err) {
    console.warn('Firebase Storage receipt upload unavailable; storing compressed preview fallback:', err);
    return { url: dataUrl, uploadedToCloud: false };
  }
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

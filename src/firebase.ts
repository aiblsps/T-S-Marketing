import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeFirestore, getDocFromServer, doc, memoryLocalCache } from 'firebase/firestore';
import { getAuth, setPersistence, inMemoryPersistence, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../firebase-applet-config.json';

console.log("Firebase: Initializing with Project ID:", firebaseConfig.projectId);

let app: any;
try {
  if (getApps().length > 0) {
    app = getApp();
  } else {
    app = initializeApp(firebaseConfig);
  }
} catch (err) {
  console.error("Firebase initialization error:", err);
}

// Initialize Firestore with memory cache for better stability in certain environments
const databaseId = (firebaseConfig as any).firestoreDatabaseId || '(default)';
export const db = initializeFirestore(app, {
  localCache: memoryLocalCache(),
}, databaseId);
export const auth = getAuth(app);
export const storage = getStorage(app);

// Use inMemoryPersistence so user must login on every single app load/refresh/entrance
setPersistence(auth, inMemoryPersistence)
  .then(() => {
    console.log("Firebase: Persistence set to memory");
    // Explicitly sign out to clear any lingering IndexedDB/LocalStorage sessions from previous settings
    return signOut(auth);
  })
  .catch(err => console.error("Firebase: Persistence error:", err));

export const loginWithEmail = (email: string, password: string) => {
  console.log("Firebase: Calling signInWithEmailAndPassword for", email);
  return signInWithEmailAndPassword(auth, email, password);
};

export const logout = () => {
  return signOut(auth);
};

export { onAuthStateChanged };

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
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Validate Connection to Firestore with retry logic
async function testConnection() {
  const checkConnection = async (attempt: number = 1) => {
    try {
      const dbId = (firebaseConfig as any).firestoreDatabaseId || '(default)';
      console.log(`Firestore: Checking connection to database: ${dbId}, attempt ${attempt}`);
      // Use getDocFromServer to force a network request
      await getDocFromServer(doc(db, 'test', 'connection'));
      console.log("Firestore connection successful");
    } catch (error: any) {
      const errorMsg = error?.message || String(error);
      const errorCode = error?.code || 'unknown';
      console.warn(`Firestore connection attempt ${attempt} failed: [${errorCode}] ${errorMsg}`);
      
      if (attempt <= 3) {
        console.log(`Retrying in 2 seconds (attempt ${attempt + 1})...`);
        setTimeout(() => checkConnection(attempt + 1), 2000);
      } else {
        if (errorMsg.includes('the client is offline')) {
          console.error("Please check your Firebase configuration. The client is offline.");
        } else {
          console.error("Firestore connection could not be established:", errorMsg, errorCode);
        }
      }
    }
  };
  checkConnection();
}
testConnection();

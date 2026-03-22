import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, User as FirebaseUser, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, onSnapshot, updateDoc, increment } from 'firebase/firestore';
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

console.log("Firebase: Initializing app with config:", firebaseConfig.projectId);

let app;
try {
  app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  console.log("Firebase: App initialized successfully.");
} catch (error) {
  console.error("Firebase: App initialization failed:", error);
  throw error;
}

export const auth = getAuth(app);
// Persistence is handled by default, setPersistence can sometimes hang in iframes
// setPersistence(auth, browserLocalPersistence)...

export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

export interface UserProfile {
  uid: string;
  email: string;
  role: 'admin' | 'user';
  plan: string;
  generations_used: number;
  generation_limit: number;
  stripe_customer_id?: string;
  subscription_status?: string;
  last_reset?: string;
}

export const signIn = () => signInWithPopup(auth, googleProvider);
export const signOut = () => auth.signOut();

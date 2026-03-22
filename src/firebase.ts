import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAkbzaHyrNGY6Kj4o4_O1tvSJnHDVqXChU",
  authDomain: "gen-lang-client-0142077997.firebaseapp.com",
  projectId: "gen-lang-client-0142077997",
  storageBucket: "gen-lang-client-0142077997.firebasestorage.app",
  messagingSenderId: "1090879634440",
  appId: "1:1090879634440:web:bd9666c7fdd6f7f3fce5bd",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

export const signIn = () => signInWithPopup(auth, googleProvider);
export const signOut = () => auth.signOut();

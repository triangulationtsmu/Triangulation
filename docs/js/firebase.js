// Firebase initialisation (modular v10 SDK from the gstatic CDN).
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import {
  getAuth, signInWithCustomToken, signOut, onAuthStateChanged, setPersistence,
  browserLocalPersistence,
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-functions.js';
import { firebaseConfig, FUNCTIONS_REGION } from './config.js';

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app, FUNCTIONS_REGION);

// Persist the session in localStorage so a reload keeps the user signed in.
setPersistence(auth, browserLocalPersistence).catch(() => {});

export const callable = (name) => httpsCallable(functions, name);
export { signInWithCustomToken, signOut, onAuthStateChanged };

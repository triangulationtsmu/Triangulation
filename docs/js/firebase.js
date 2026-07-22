// Firebase initialisation (modular v10 SDK from the gstatic CDN).
// Client-side model: Firestore only (no Firebase Auth, no Cloud Functions).
// App-level authentication is handled in api.js against the `users` /
// `credentials` collections. Works on the free Spark plan.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';
import { firebaseConfig } from './config.js';

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

export function normalizeUsername(u) { return String(u || '').trim().toLowerCase(); }

// Salted SHA-256 (Web Crypto). Not as strong as bcrypt, but keeps plaintext
// passwords out of the database. Must stay identical to scripts/seedAdmin.js.
export function randomSalt() {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, '0')).join('');
}
export async function hashPassword(password, salt) {
  const data = new TextEncoder().encode(`${salt}:${password}`);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

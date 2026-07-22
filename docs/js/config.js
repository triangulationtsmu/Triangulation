// Firebase public web config (safe to expose in a static frontend).
// Mirror of .env FIREBASE_* values. If you fork to another Firebase project,
// change these values only.
export const firebaseConfig = {
  apiKey: 'AIzaSyBfPmfNTZNzRRP2zKp-SLqAFwEcEkjNnck',
  authDomain: 'triangulation-6c04e.firebaseapp.com',
  projectId: 'triangulation-6c04e',
  storageBucket: 'triangulation-6c04e.firebasestorage.app',
  messagingSenderId: '954556518341',
  appId: '1:954556518341:web:28b2df66863a09be4805ac',
  measurementId: 'G-9SB6H5XLMX',
};

// Cloud Functions region (must match setGlobalOptions in functions/index.js).
export const FUNCTIONS_REGION = 'us-central1';

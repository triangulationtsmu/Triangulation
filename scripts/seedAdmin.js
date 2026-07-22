#!/usr/bin/env node
/**
 * Idempotent bootstrap of the initial administrator.
 *
 *   კახაბერ ჭერლიძე — username: kakha — password: 1234
 *   role: department_head — isAdmin: true
 *
 * Runs server-side with the Firebase Admin SDK. Requires application-default
 * credentials or a service-account JSON referenced by
 * GOOGLE_APPLICATION_CREDENTIALS. NEVER commit that key.
 *
 * Usage:  npm run seed:admin
 *
 * Idempotency:
 *   - If the username already exists, nothing is created or overwritten.
 *   - The password hash lives only in privateCredentials/{uid} (bcrypt),
 *     never in the public user profile and never printed to the client.
 */
'use strict';

require('dotenv').config();
const admin = require('firebase-admin');
const bcrypt = require('bcryptjs');

const BCRYPT_ROUNDS = 12;

const CFG = {
  username: process.env.SEED_ADMIN_USERNAME || 'kakha',
  password: process.env.SEED_ADMIN_PASSWORD || '1234',
  firstName: process.env.SEED_ADMIN_FIRST_NAME || 'კახაბერ',
  lastName: process.env.SEED_ADMIN_LAST_NAME || 'ჭერლიძე',
  role: process.env.SEED_ADMIN_ROLE || 'department_head',
};

function normalizeUsername(u) {
  return String(u || '').trim().toLowerCase();
}

async function main() {
  if (!admin.apps.length) {
    // Uses GOOGLE_APPLICATION_CREDENTIALS (service account) or ADC.
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId:
        process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || undefined,
    });
  }

  const db = admin.firestore();
  const auth = admin.auth();
  const normalized = normalizeUsername(CFG.username);

  const indexRef = db.collection('usernameIndex').doc(normalized);
  const indexSnap = await indexRef.get();
  if (indexSnap.exists) {
    console.log(
      `✓ admin "${CFG.username}" already exists (uid: ${indexSnap.data().uid}). ` +
        'Nothing changed (idempotent).'
    );
    return;
  }

  // Create (or reuse) the Auth account for this admin.
  let userRecord;
  const authEmail = `${normalized}@triangulation.local`; // internal, never shown
  try {
    userRecord = await auth.getUserByEmail(authEmail);
    console.log(`• reusing existing Auth user ${userRecord.uid}`);
  } catch (_) {
    userRecord = await auth.createUser({
      email: authEmail,
      emailVerified: false,
      displayName: `${CFG.firstName} ${CFG.lastName}`.trim(),
      disabled: false,
    });
    console.log(`• created Auth user ${userRecord.uid}`);
  }
  const uid = userRecord.uid;

  const claims = { isAdmin: true, role: CFG.role, departmentId: null };
  await auth.setCustomUserClaims(uid, claims);

  const now = admin.firestore.FieldValue.serverTimestamp();
  const passwordHash = await bcrypt.hash(CFG.password, BCRYPT_ROUNDS);

  const batch = db.batch();
  batch.set(db.collection('users').doc(uid), {
    uid,
    username: CFG.username,
    normalizedUsername: normalized,
    firstName: CFG.firstName,
    lastName: CFG.lastName,
    role: CFG.role,
    isAdmin: true,
    departmentId: null,
    active: true,
    createdAt: now,
    updatedAt: now,
  });
  batch.set(indexRef, { uid, username: CFG.username, createdAt: now });
  batch.set(db.collection('privateCredentials').doc(uid), {
    uid,
    passwordHash,
    passwordUpdatedAt: now,
    failedAttempts: 0,
    lockedUntil: null,
  });
  await batch.commit();

  console.log('');
  console.log('✅ Initial administrator created:');
  console.log(`   name:     ${CFG.firstName} ${CFG.lastName}`);
  console.log(`   username: ${CFG.username}`);
  console.log(`   password: ${CFG.password}  (change after first login)`);
  console.log(`   role:     ${CFG.role} (isAdmin: true)`);
  console.log(`   uid:      ${uid}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('✗ seed:admin failed:', err.message || err);
    process.exit(1);
  });

'use strict';

/**
 * Triangulation — Cloud Functions (2nd gen callable).
 *
 * Responsibilities that MUST stay server-side:
 *   - password hashing & verification (bcrypt)   -> login, changeOwnPassword
 *   - custom-token minting with role/admin claims -> login
 *   - user/credential creation & mutation         -> adminCreateUser, ...
 *   - anonymous UCEEM scoring & storage           -> submitUceem
 *
 * Password hashes live only in privateCredentials/{uid} and are never
 * returned to any client.
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2');
const admin = require('firebase-admin');
const bcrypt = require('bcryptjs');

admin.initializeApp();
setGlobalOptions({ region: 'us-central1', maxInstances: 10 });

const db = admin.firestore();
const auth = admin.auth();
const FieldValue = admin.firestore.FieldValue;

const BCRYPT_ROUNDS = 12;
const MAX_FAILED = 10;
const LOCK_MINUTES = 15;

const ALLOWED_ROLES = [
  'department_head', // დეპარტამენტის ხელმძღვანელი
  'curator',         // კურატორი
  'doctor',          // ექიმი
  'nurse',           // ექთანი
  'lecturer',        // ლექტორი
  'assessor',        // სხვა უფლებამოსილი შემფასებელი
  'admin',           // (reserved) administrator-only role
];

// -------------------------------------------------------------------------
// helpers
// -------------------------------------------------------------------------
function normalizeUsername(u) {
  return String(u || '').trim().toLowerCase();
}
function reqStr(v, field, { min = 1, max = 200 } = {}) {
  const s = typeof v === 'string' ? v.trim() : '';
  if (s.length < min || s.length > max) {
    throw new HttpsError('invalid-argument', `ველი "${field}" არასწორია.`);
  }
  return s;
}
async function requireAdmin(request) {
  if (!request.auth) throw new HttpsError('unauthenticated', 'ავტორიზაცია საჭიროა.');
  // Trust the freshly-verified token claim, then double-check the profile.
  if (request.auth.token && request.auth.token.isAdmin === true) return request.auth.uid;
  const snap = await db.collection('users').doc(request.auth.uid).get();
  if (!snap.exists || snap.data().isAdmin !== true || snap.data().active !== true) {
    throw new HttpsError('permission-denied', 'მხოლოდ ადმინისტრატორს აქვს ეს უფლება.');
  }
  return request.auth.uid;
}
async function syncClaims(uid, { isAdmin, role, departmentId }) {
  await auth.setCustomUserClaims(uid, {
    isAdmin: !!isAdmin,
    role: role || null,
    departmentId: departmentId || null,
  });
}

// =========================================================================
// login  (public — no auth required)
// =========================================================================
exports.login = onCall(async (request) => {
  const username = reqStr(request.data && request.data.username, 'მომხმარებელი');
  const password = reqStr(request.data && request.data.password, 'პაროლი', { min: 1, max: 256 });
  const normalized = normalizeUsername(username);

  const idxSnap = await db.collection('usernameIndex').doc(normalized).get();
  if (!idxSnap.exists) {
    throw new HttpsError('permission-denied', 'მომხმარებელი ან პაროლი არასწორია.');
  }
  const uid = idxSnap.data().uid;

  const userSnap = await db.collection('users').doc(uid).get();
  if (!userSnap.exists) {
    throw new HttpsError('permission-denied', 'მომხმარებელი ან პაროლი არასწორია.');
  }
  const user = userSnap.data();
  if (user.active !== true) {
    throw new HttpsError('permission-denied', 'მომხმარებელი გათიშულია. მიმართეთ ადმინისტრატორს.');
  }

  const credRef = db.collection('privateCredentials').doc(uid);
  const credSnap = await credRef.get();
  if (!credSnap.exists) {
    throw new HttpsError('permission-denied', 'მომხმარებელი ან პაროლი არასწორია.');
  }
  const cred = credSnap.data();

  const now = Date.now();
  if (cred.lockedUntil && cred.lockedUntil.toMillis && cred.lockedUntil.toMillis() > now) {
    throw new HttpsError('resource-exhausted',
      'ანგარიში დროებით დაბლოკილია მრავალი მცდელობის გამო. სცადეთ მოგვიანებით.');
  }

  const ok = await bcrypt.compare(password, cred.passwordHash || '');
  if (!ok) {
    const attempts = (cred.failedAttempts || 0) + 1;
    const update = { failedAttempts: attempts };
    if (attempts >= MAX_FAILED) {
      update.lockedUntil = admin.firestore.Timestamp.fromMillis(now + LOCK_MINUTES * 60000);
      update.failedAttempts = 0;
    }
    await credRef.set(update, { merge: true });
    throw new HttpsError('permission-denied', 'მომხმარებელი ან პაროლი არასწორია.');
  }

  await credRef.set({ failedAttempts: 0, lockedUntil: null }, { merge: true });

  // Keep persistent claims in sync so refreshed ID tokens stay correct.
  const claims = { isAdmin: !!user.isAdmin, role: user.role || null, departmentId: user.departmentId || null };
  await syncClaims(uid, claims);

  const token = await auth.createCustomToken(uid, claims);
  return {
    token,
    profile: {
      uid,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      isAdmin: !!user.isAdmin,
      departmentId: user.departmentId || null,
    },
  };
});

// =========================================================================
// adminCreateUser  (admin only)
// =========================================================================
exports.adminCreateUser = onCall(async (request) => {
  await requireAdmin(request);
  const d = request.data || {};

  const username = reqStr(d.username, 'მომხმარებელი', { min: 2, max: 60 });
  const password = reqStr(d.password, 'პაროლი', { min: 1, max: 256 });
  const firstName = reqStr(d.firstName, 'სახელი', { min: 1, max: 100 });
  const lastName = reqStr(d.lastName, 'გვარი', { min: 1, max: 100 });
  const role = reqStr(d.role, 'როლი');
  if (!ALLOWED_ROLES.includes(role)) {
    throw new HttpsError('invalid-argument', 'უცნობი როლი.');
  }
  const departmentId = d.departmentId ? String(d.departmentId) : null;
  const active = d.active === undefined ? true : !!d.active;
  const isAdmin = role === 'admin' ? true : !!d.isAdmin;
  const normalized = normalizeUsername(username);

  const idxRef = db.collection('usernameIndex').doc(normalized);
  if ((await idxRef.get()).exists) {
    throw new HttpsError('already-exists', 'ეს username უკვე გამოყენებულია.');
  }

  const authEmail = `${normalized}@triangulation.local`;
  let userRecord;
  try {
    userRecord = await auth.createUser({
      email: authEmail,
      displayName: `${firstName} ${lastName}`.trim(),
      disabled: !active,
    });
  } catch (e) {
    throw new HttpsError('already-exists', 'მომხმარებლის შექმნა ვერ მოხერხდა (შესაძლოა username დაკავებულია).');
  }
  const uid = userRecord.uid;

  await syncClaims(uid, { isAdmin, role, departmentId });

  const now = FieldValue.serverTimestamp();
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const batch = db.batch();
  batch.set(db.collection('users').doc(uid), {
    uid, username, normalizedUsername: normalized,
    firstName, lastName, role, isAdmin, departmentId, active,
    createdBy: request.auth.uid, createdAt: now, updatedAt: now,
  });
  batch.set(idxRef, { uid, username, createdAt: now });
  batch.set(db.collection('privateCredentials').doc(uid), {
    uid, passwordHash, passwordUpdatedAt: now, failedAttempts: 0, lockedUntil: null,
  });
  await batch.commit();

  return { uid, username };
});

// =========================================================================
// adminResetPassword  (admin only)
// =========================================================================
exports.adminResetPassword = onCall(async (request) => {
  await requireAdmin(request);
  const uid = reqStr(request.data && request.data.uid, 'uid');
  const newPassword = reqStr(request.data && request.data.newPassword, 'ახალი პაროლი', { min: 1, max: 256 });

  const userSnap = await db.collection('users').doc(uid).get();
  if (!userSnap.exists) throw new HttpsError('not-found', 'მომხმარებელი ვერ მოიძებნა.');

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await db.collection('privateCredentials').doc(uid).set({
    uid, passwordHash,
    passwordUpdatedAt: FieldValue.serverTimestamp(),
    failedAttempts: 0, lockedUntil: null,
  }, { merge: true });

  return { ok: true };
});

// =========================================================================
// adminSetUserActive  (admin only) — enable / disable a user
// =========================================================================
exports.adminSetUserActive = onCall(async (request) => {
  const callerUid = await requireAdmin(request);
  const uid = reqStr(request.data && request.data.uid, 'uid');
  const active = !!(request.data && request.data.active);

  if (uid === callerUid && !active) {
    throw new HttpsError('failed-precondition', 'საკუთარი ანგარიშის გათიშვა შეუძლებელია.');
  }
  const userSnap = await db.collection('users').doc(uid).get();
  if (!userSnap.exists) throw new HttpsError('not-found', 'მომხმარებელი ვერ მოიძებნა.');

  await auth.updateUser(uid, { disabled: !active });
  if (!active) {
    await auth.revokeRefreshTokens(uid); // force sign-out everywhere
  }
  await db.collection('users').doc(uid).set(
    { active, updatedAt: FieldValue.serverTimestamp() }, { merge: true }
  );
  return { ok: true, active };
});

// =========================================================================
// changeOwnPassword  (any signed-in user)
// =========================================================================
exports.changeOwnPassword = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'ავტორიზაცია საჭიროა.');
  const uid = request.auth.uid;
  const currentPassword = reqStr(request.data && request.data.currentPassword, 'მიმდინარე პაროლი', { min: 1, max: 256 });
  const newPassword = reqStr(request.data && request.data.newPassword, 'ახალი პაროლი', { min: 1, max: 256 });

  const credRef = db.collection('privateCredentials').doc(uid);
  const credSnap = await credRef.get();
  if (!credSnap.exists) throw new HttpsError('not-found', 'ავტორიზაციის მონაცემები ვერ მოიძებნა.');

  const ok = await bcrypt.compare(currentPassword, credSnap.data().passwordHash || '');
  if (!ok) throw new HttpsError('permission-denied', 'მიმდინარე პაროლი არასწორია.');

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await credRef.set({
    passwordHash, passwordUpdatedAt: FieldValue.serverTimestamp(),
    failedAttempts: 0, lockedUntil: null,
  }, { merge: true });

  return { ok: true };
});

// =========================================================================
// submitUceem  (public, anonymous) — score & store, no respondent identity
// =========================================================================
const UCEEM_SECTIONS = [
  { id: 'A1', count: 11, max: 55 },
  { id: 'A2', count: 6, max: 30 },
  { id: 'B1', count: 6, max: 30 },
  { id: 'B2', count: 2, max: 10 },
];
const UCEEM_TOTAL_MAX = 125;

exports.submitUceem = onCall(async (request) => {
  const d = request.data || {};
  const campaignId = reqStr(d.campaignId, 'campaignId');
  const targetUserId = reqStr(d.targetUserId, 'targetUserId');
  const answers = d.answers && typeof d.answers === 'object' ? d.answers : null;
  if (!answers) throw new HttpsError('invalid-argument', 'პასუხები არასწორია.');

  const campSnap = await db.collection('uceemCampaigns').doc(campaignId).get();
  if (!campSnap.exists) throw new HttpsError('not-found', 'კამპანია ვერ მოიძებნა.');
  const camp = campSnap.data();
  if (camp.active !== true) throw new HttpsError('failed-precondition', 'კამპანია დახურულია.');

  const target = (camp.targets || []).find((t) => t.userId === targetUserId);
  if (!target) throw new HttpsError('invalid-argument', 'შესაფასებელი პირი კამპანიაში ვერ მოიძებნა.');

  // Validate + score strictly from the fixed structure.
  const sectionScores = {};
  let total = 0;
  let answered = 0;
  for (const sec of UCEEM_SECTIONS) {
    let secTotal = 0;
    let secAnswered = 0;
    for (let i = 1; i <= sec.count; i++) {
      const code = `${sec.id}.${i}`;
      const raw = answers[code];
      if (raw === undefined || raw === null || raw === '') continue;
      const v = Number(raw);
      if (!Number.isInteger(v) || v < 1 || v > 5) {
        throw new HttpsError('invalid-argument', `პასუხი ${code} უნდა იყოს 1-5.`);
      }
      secTotal += v;
      secAnswered += 1;
    }
    sectionScores[sec.id] = { total: secTotal, answered: secAnswered, max: sec.max };
    total += secTotal;
    answered += secAnswered;
  }
  if (answered === 0) throw new HttpsError('invalid-argument', 'ერთი პასუხი მაინც აუცილებელია.');

  // Anonymous doc — NO respondent uid / student id / ip / user-agent.
  const responseId = db.collection('uceemResponses').doc().id;
  await db.collection('uceemResponses').doc(responseId).set({
    anonymousResponseId: responseId,
    campaignId,
    targetUserId,
    targetRole: target.role || null,
    targetName: target.name || null,
    departmentId: camp.departmentId || null,
    academicYear: camp.academicYear || null,
    semester: camp.semester || null,
    group: camp.group || null,
    answers, // raw 1-5 by code, carries no identity
    calculatedScores: { total, totalMax: UCEEM_TOTAL_MAX, answered, sections: sectionScores },
    createdAt: FieldValue.serverTimestamp(),
  });

  return { ok: true, anonymousResponseId: responseId };
});

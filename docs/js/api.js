// Data-access layer + client-side authentication (no Firebase Auth / Functions).
import {
  collection, doc, getDoc, getDocs, addDoc, setDoc, updateDoc, deleteDoc,
  query, where, orderBy, limit, serverTimestamp, writeBatch,
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';
import { db, normalizeUsername, randomSalt, hashPassword } from './firebase.js';

function randomPublicKey() {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// =========================================================================
// Authentication (app-level, against Firestore)
//   users/{uid}        : profile (NO password)
//   credentials/{uid}  : { salt, passwordHash }        (never shown in UI)
//   usernameIndex/{n}  : { uid, username }             (uniqueness + lookup)
// =========================================================================
function profileFrom(uid, u) {
  return {
    uid, username: u.username, firstName: u.firstName, lastName: u.lastName,
    role: u.role, isAdmin: u.isAdmin === true, departmentId: u.departmentId || null,
    active: u.active !== false,
  };
}

export async function loginUser(username, password) {
  const normalized = normalizeUsername(username);
  const idx = await getDoc(doc(db, 'usernameIndex', normalized));
  if (!idx.exists()) throw new Error('მომხმარებელი ან პაროლი არასწორია.');
  const uid = idx.data().uid;

  const userSnap = await getDoc(doc(db, 'users', uid));
  if (!userSnap.exists()) throw new Error('მომხმარებელი ან პაროლი არასწორია.');
  const u = userSnap.data();
  if (u.active === false) throw new Error('მომხმარებელი გათიშულია. მიმართეთ ადმინისტრატორს.');

  const credSnap = await getDoc(doc(db, 'credentials', uid));
  if (!credSnap.exists()) throw new Error('მომხმარებელი ან პაროლი არასწორია.');
  const { salt, passwordHash } = credSnap.data();
  const attempt = await hashPassword(password, salt);
  if (attempt !== passwordHash) throw new Error('მომხმარებელი ან პაროლი არასწორია.');

  return profileFrom(uid, u);
}

// Re-fetch a profile (used on boot to validate a stored session).
export async function fetchProfile(uid) {
  const s = await getDoc(doc(db, 'users', uid));
  return s.exists() ? profileFrom(uid, s.data()) : null;
}

export async function createUserAccount(data, creatorUid) {
  const normalized = normalizeUsername(data.username);
  if (!normalized) throw new Error('username სავალდებულოა.');
  if (!data.password) throw new Error('პაროლი სავალდებულოა.');
  const idxRef = doc(db, 'usernameIndex', normalized);
  if ((await getDoc(idxRef)).exists()) throw new Error('ეს username უკვე გამოყენებულია.');

  const ref = doc(collection(db, 'users'));
  const uid = ref.id;
  const salt = randomSalt();
  const passwordHash = await hashPassword(data.password, salt);
  const now = serverTimestamp();

  await setDoc(ref, {
    uid, username: data.username, normalizedUsername: normalized,
    firstName: data.firstName, lastName: data.lastName,
    role: data.role, isAdmin: data.isAdmin === true,
    departmentId: data.departmentId || null,
    active: data.active !== false,
    createdBy: creatorUid || null, createdAt: now, updatedAt: now,
  });
  await setDoc(doc(db, 'credentials', uid), { salt, passwordHash, passwordUpdatedAt: now });
  await setDoc(idxRef, { uid, username: data.username, createdAt: now });
  return uid;
}

export async function resetUserPassword(uid, newPassword) {
  if (!newPassword) throw new Error('ახალი პაროლი სავალდებულოა.');
  const salt = randomSalt();
  const passwordHash = await hashPassword(newPassword, salt);
  await setDoc(doc(db, 'credentials', uid),
    { salt, passwordHash, passwordUpdatedAt: serverTimestamp() }, { merge: true });
}

export async function changeUserPassword(uid, currentPassword, newPassword) {
  const credSnap = await getDoc(doc(db, 'credentials', uid));
  if (!credSnap.exists()) throw new Error('ავტორიზაციის მონაცემები ვერ მოიძებნა.');
  const { salt, passwordHash } = credSnap.data();
  if ((await hashPassword(currentPassword, salt)) !== passwordHash) {
    throw new Error('მიმდინარე პაროლი არასწორია.');
  }
  await resetUserPassword(uid, newPassword);
}

export async function setUserActive(uid, active) {
  await updateDoc(doc(db, 'users', uid), { active: !!active, updatedAt: serverTimestamp() });
}
export async function updateUserAccount(uid, data) {
  const userRef = doc(db, 'users', uid);
  const currentSnap = await getDoc(userRef);
  if (!currentSnap.exists()) throw new Error('მომხმარებელი ვერ მოიძებნა.');
  const current = currentSnap.data();
  const normalized = normalizeUsername(data.username || current.username);
  if (!normalized) throw new Error('username სავალდებულოა.');
  const oldNormalized = current.normalizedUsername || normalizeUsername(current.username);
  const idxRef = doc(db, 'usernameIndex', normalized);
  if (normalized !== oldNormalized && (await getDoc(idxRef)).exists()) {
    throw new Error('ეს username უკვე გამოყენებულია.');
  }

  const batch = writeBatch(db);
  batch.update(userRef, {
    username: data.username,
    normalizedUsername: normalized,
    firstName: data.firstName,
    lastName: data.lastName,
    role: data.role,
    isAdmin: data.isAdmin === true,
    departmentId: data.departmentId || null,
    active: data.active !== false,
    updatedAt: serverTimestamp(),
  });
  if (normalized !== oldNormalized) {
    batch.delete(doc(db, 'usernameIndex', oldNormalized));
    batch.set(idxRef, { uid, username: data.username, createdAt: serverTimestamp() });
  }
  await batch.commit();
}
export async function deleteUserAccount(uid) {
  const userSnap = await getDoc(doc(db, 'users', uid));
  if (!userSnap.exists()) return;
  const u = userSnap.data();
  const normalized = u.normalizedUsername || normalizeUsername(u.username);
  const batch = writeBatch(db);
  batch.delete(doc(db, 'users', uid));
  batch.delete(doc(db, 'credentials', uid));
  if (normalized) batch.delete(doc(db, 'usernameIndex', normalized));
  await batch.commit();
}

// One-time bootstrap of the initial administrator (idempotent).
export async function ensureAdminSeed() {
  const normalized = 'kakha';
  const idx = await getDoc(doc(db, 'usernameIndex', normalized));
  if (idx.exists()) {
    const uid = idx.data().uid;
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists() && userSnap.data().lastName === 'ჭერლიძე') {
      await updateDoc(userRef, { lastName: 'ჭელიძე', updatedAt: serverTimestamp() });
    }
    return false;
  }
  await createUserAccount({
    username: 'kakha', password: '1234',
    firstName: 'კახაბერ', lastName: 'ჭელიძე',
    role: 'department_head', isAdmin: true, departmentId: null, active: true,
  }, 'seed');
  return true;
}

// ---- departments --------------------------------------------------------
export async function listDepartments() {
  const snap = await getDocs(query(collection(db, 'departments'), orderBy('name')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
export async function createDepartment(data, uid) {
  return addDoc(collection(db, 'departments'), {
    name: data.name, code: data.code || null, active: data.active !== false,
    createdBy: uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
}
export async function updateDepartment(id, data) {
  return updateDoc(doc(db, 'departments', id), { ...data, updatedAt: serverTimestamp() });
}

// ---- users --------------------------------------------------------------
export async function listUsers() {
  const snap = await getDocs(query(collection(db, 'users'), orderBy('lastName')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ---- students -----------------------------------------------------------
export async function queryStudents({ departmentId = null, group = null } = {}) {
  const clauses = [];
  if (departmentId) clauses.push(where('departmentId', '==', departmentId));
  if (group) clauses.push(where('group', '==', group));
  const q = clauses.length
    ? query(collection(db, 'students'), ...clauses)
    : query(collection(db, 'students'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    .filter((s) => s.groupArchived !== true);
}
export async function createStudent(data, uid) {
  return addDoc(collection(db, 'students'), {
    firstName: data.firstName, lastName: data.lastName,
    phone: String(data.phone || ''), email: data.email || null,
    englishName: data.englishName || null, group: data.group,
    semester: data.semester, course: data.course,
    curation: data.curation || null,
    curationStart: data.curationStart || null,
    curationEnd: data.curationEnd || null,
    isShechrili: !!data.isShechrili, academicYear: data.academicYear,
    departmentId: data.departmentId || null, groupId: data.groupId || null,
    groupArchived: data.groupArchived === true,
    createdBy: uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
}
export async function updateStudent(id, data) {
  return updateDoc(doc(db, 'students', id), { ...data, updatedAt: serverTimestamp() });
}
export async function deleteStudent(id) {
  return deleteDoc(doc(db, 'students', id));
}

// ---- student groups -----------------------------------------------------
export async function listStudentGroups() {
  const snap = await getDocs(collection(db, 'studentGroups'));
  const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  rows.sort((a, b) => (`${a.academicYear || ''} ${a.group || ''}`).localeCompare(`${b.academicYear || ''} ${b.group || ''}`, 'ka'));
  return rows;
}
export async function createStudentGroupWithStudents(groupData, students, uid) {
  const batch = writeBatch(db);
  const groupRef = doc(collection(db, 'studentGroups'));
  const now = serverTimestamp();
  batch.set(groupRef, {
    ...groupData,
    archived: false,
    studentCount: students.length,
    createdBy: uid,
    createdAt: now,
    updatedAt: now,
  });
  students.forEach((student) => {
    const studentRef = doc(collection(db, 'students'));
    batch.set(studentRef, {
      ...student,
      groupId: groupRef.id,
      groupArchived: false,
      createdBy: uid,
      createdAt: now,
      updatedAt: now,
    });
  });
  await batch.commit();
  return groupRef.id;
}
export async function createStudentsBulk(students, uid) {
  const batch = writeBatch(db);
  const now = serverTimestamp();
  students.forEach((student) => {
    const studentRef = doc(collection(db, 'students'));
    batch.set(studentRef, {
      ...student,
      groupId: student.groupId || null,
      groupArchived: false,
      createdBy: uid,
      createdAt: now,
      updatedAt: now,
    });
  });
  await batch.commit();
}
export async function setStudentGroupArchived(groupId, archived) {
  const batch = writeBatch(db);
  batch.update(doc(db, 'studentGroups', groupId), { archived: !!archived, updatedAt: serverTimestamp() });
  const snap = await getDocs(query(collection(db, 'students'), where('groupId', '==', groupId)));
  snap.docs.forEach((row) => batch.update(row.ref, { groupArchived: !!archived, updatedAt: serverTimestamp() }));
  await batch.commit();
}
export async function deleteStudentGroup(groupId) {
  const batch = writeBatch(db);
  const now = serverTimestamp();
  const snap = await getDocs(query(collection(db, 'students'), where('groupId', '==', groupId)));
  snap.docs.forEach((row) => batch.update(row.ref, { groupId: null, groupArchived: false, updatedAt: now }));
  batch.delete(doc(db, 'studentGroups', groupId));
  await batch.commit();
}

// ---- evaluations --------------------------------------------------------
export async function createEvaluation(data) {
  return addDoc(collection(db, 'evaluations'), {
    ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
}
export async function listEvaluationsByStudent(studentId, type = null) {
  const clauses = [where('studentId', '==', studentId)];
  if (type) clauses.push(where('type', '==', type));
  const snap = await getDocs(query(collection(db, 'evaluations'), ...clauses));
  const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  rows.sort((a, b) => (tsMillis(a.createdAt) - tsMillis(b.createdAt)));
  return rows;
}

// ---- UCEEM campaigns / responses ---------------------------------------
export async function listCampaigns() {
  const snap = await getDocs(collection(db, 'uceemCampaigns'));
  const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  rows.sort((a, b) => (tsMillis(b.createdAt) - tsMillis(a.createdAt)));
  return rows;
}
export async function getCampaign(id) {
  const s = await getDoc(doc(db, 'uceemCampaigns', id));
  return s.exists() ? { id: s.id, ...s.data() } : null;
}
export async function createCampaign(data, uid) {
  return addDoc(collection(db, 'uceemCampaigns'), {
    title: data.title || null, departmentId: data.departmentId || null,
    academicYear: data.academicYear || null, semester: data.semester || null,
    group: data.group || null, targets: data.targets || [],
    publicKey: randomPublicKey(),
    active: data.active !== false,
    createdBy: uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
}
export async function setCampaignActive(id, active) {
  return updateDoc(doc(db, 'uceemCampaigns', id), { active, updatedAt: serverTimestamp() });
}
export async function listUceemResponses() {
  const snap = await getDocs(collection(db, 'uceemResponses'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
// Anonymous submission — writes ONLY assessment data, never respondent identity.
export async function createUceemResponse(payload) {
  const responseId = doc(collection(db, 'uceemResponses')).id;
  await setDoc(doc(db, 'uceemResponses', responseId), {
    anonymousResponseId: responseId, ...payload, createdAt: serverTimestamp(),
  });
  return responseId;
}

// ---- helpers ------------------------------------------------------------
export function tsMillis(ts) {
  if (!ts) return 0;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (ts.seconds) return ts.seconds * 1000;
  return 0;
}

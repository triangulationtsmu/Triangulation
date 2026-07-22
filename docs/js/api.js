// Firestore data-access layer + Cloud Function callables.
import {
  collection, doc, getDoc, getDocs, addDoc, setDoc, updateDoc, deleteDoc,
  query, where, orderBy, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';
import { db, callable } from './firebase.js';

// ---- callables ----------------------------------------------------------
export const fnLogin = callable('login');
export const fnCreateUser = callable('adminCreateUser');
export const fnResetPassword = callable('adminResetPassword');
export const fnSetUserActive = callable('adminSetUserActive');
export const fnChangePassword = callable('changeOwnPassword');
export const fnSubmitUceem = callable('submitUceem');

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

export async function getUserDoc(uid) {
  const s = await getDoc(doc(db, 'users', uid));
  return s.exists() ? { id: s.id, ...s.data() } : null;
}

// ---- students -----------------------------------------------------------
// Server-side equality filters (indexed): departmentId, group. The rest is
// applied client-side so multiple filters can combine freely.
export async function queryStudents({ departmentId = null, group = null } = {}) {
  const clauses = [];
  if (departmentId) clauses.push(where('departmentId', '==', departmentId));
  if (group) clauses.push(where('group', '==', group));
  const q = clauses.length
    ? query(collection(db, 'students'), ...clauses)
    : query(collection(db, 'students'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
export async function createStudent(data, uid) {
  return addDoc(collection(db, 'students'), {
    firstName: data.firstName, lastName: data.lastName,
    phone: String(data.phone || ''), group: data.group,
    semester: data.semester, course: data.course,
    isShechrili: !!data.isShechrili, academicYear: data.academicYear,
    departmentId: data.departmentId || null,
    createdBy: uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
}
export async function updateStudent(id, data) {
  return updateDoc(doc(db, 'students', id), { ...data, updatedAt: serverTimestamp() });
}
export async function deleteStudent(id) {
  return deleteDoc(doc(db, 'students', id));
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
    title: data.title || null,
    departmentId: data.departmentId || null,
    academicYear: data.academicYear || null,
    semester: data.semester || null,
    group: data.group || null,
    targets: data.targets || [], // [{userId, name, role}]
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

// ---- helpers ------------------------------------------------------------
export function tsMillis(ts) {
  if (!ts) return 0;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (ts.seconds) return ts.seconds * 1000;
  return 0;
}
